// Mongchi generate-avatar Edge Function.
//
// Accepts a source photo already uploaded to the pet-media bucket, consumes
// one unit of generation quota, and kicks off an async pipeline that runs
// safety classification, per-state image generation, a lightweight quality
// gate, and asset upload — all via OpenAI. The HTTP handler responds with
// 202 + { jobId } immediately; the pipeline itself runs in the background via
// EdgeRuntime.waitUntil so the client can poll generation_jobs for status.
//
// Expression pack mode: when the request carries source_asset_path (plus
// requested_states), there is no source photo -- it was already deleted for
// privacy after the pet's first avatar was generated (see runPipeline's
// completion step). Instead, a previously generated sprite (typically the
// idle state) is downloaded and used as the seed image for the newly
// requested states. This mode skips safety classification (the seed is our
// own generated art, not user photo content) and skips consume_generation_quota
// -- it is instead billed server-side against credit_wallets via
// consume_credits (see step 4 below and supabase/migrations/0004_credit_ledger.sql),
// with the debit happening before the job row is created so the server, not
// the client, is authoritative for whether the purchase is allowed. It still
// runs through the same rate limit, generation, chroma-key, quality gate,
// and upload pipeline, and never deletes the seed asset.
//
// Multi-pet namespace (supabase/migrations/0005_pet_namespace.sql): requests
// may carry an optional pet_id identifying which of the caller's pets this
// job/asset belongs to. Omitted (or absent) pet_id means the pre-multi-pet
// first/only pet -- every existing client falls into this bucket, so this is
// a pure backward-compat default, not a special case. When pet_id is
// present, generated asset storage paths are namespaced under it
// (avatars/{userId}/{petId}/{jobId}/{state}.png instead of
// avatars/{userId}/{jobId}/{state}.png) and a first-ever (non-expression-
// pack) generation for a pet_id beyond the user's first is gated on
// pet_slots rather than the free generation_quota allowance -- see step 4
// and reserve_pet_generation_slot below.
//
// Deno / Supabase Edge Runtime. TypeScript strict.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { type ChromaKeyOutcome, removeChromaKeyBackground } from "./chromakey.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PetSpecies = "dog" | "cat";
type TalkingStyle = "cute" | "gentle" | "cheerful" | "comforting";

type GeneratedAssetState = string;

// Mirrors packages/shared/src/domain/assets.ts's generatedAssetStates. Kept
// as a local literal (rather than an import) because this Edge Function is
// deployed standalone via Deno with npm: specifiers only -- see the rest of
// this file for the same pattern (e.g. statePosePrompts below already
// duplicates per-state knowledge locally). Used only to validate
// GENERATION_TEST_STATES (see below); update alongside the shared package if
// the canonical state list changes.
const KNOWN_ASSET_STATES: readonly string[] = [
  "idle",
  "base",
  "happy",
  "sleep",
  "play",
  "hungry",
  "walk_return",
  "treat_reaction",
  "chat_portrait",
  "curious",
  "celebrate",
  "garden_help",
  "seasonal",
  "sad",
  "sick",
  "messy"
];

// species is the only field guaranteed at photo-confirm time (before the
// setup screen collects a name/personality/voice) -- petName/personalityTags/
// talkingStyle are optional there and filled in once the client re-invokes
// with the full draft. Requests that already carry the full snapshot
// (existing callers) keep working unchanged.
interface GenerationInputSnapshot {
  species: PetSpecies;
  petName?: string;
  personalityTags?: string[];
  talkingStyle?: TalkingStyle;
}

// source_asset_path / requested_states (snake_case, unlike the rest of this
// body) are the "expression pack" contract: a client that already has a
// generated pixel sprite (and no original photo -- see the privacy-driven
// deletion in runPipeline below) can request additional states seeded from
// that sprite instead of a fresh source photo. Field casing intentionally
// mirrors the generation_jobs column names on the wire since this is a new,
// separate contract from inputSnapshot/originalPhotoPath.
interface GenerateAvatarRequestBody {
  inputSnapshot: GenerationInputSnapshot;
  // Required unless source_asset_path is set (expression pack mode) -- see
  // the isExpressionPackRequest branch in the HTTP handler below.
  originalPhotoPath?: string;
  source_asset_path?: string;
  requested_states?: string[];
  // Idempotency key for any credit-funded request (currently: expression
  // packs). Client-supplied (a UUID generated once per logical purchase
  // attempt and reused across retries) so consume_credits never double-
  // charges a retried request. Optional for now because the client hasn't
  // been migrated to send it yet (Phase 1c) -- see request_id fallback in
  // the HTTP handler below.
  request_id?: string;
  // Which of the caller's pets this request is for (see 0005_pet_namespace.sql
  // and the module doc comment above). Optional and, as of this migration,
  // never sent by any shipped client -- omitted means the pre-multi-pet
  // first/only pet. When present, must match PET_ID_PATTERN below (it's
  // used as a literal storage path segment, so it's restricted to a safe
  // charset rather than accepting arbitrary strings).
  pet_id?: string;
}

interface GenerationJobRow {
  id: string;
  user_id: string;
  status: string;
  input_snapshot: GenerationInputSnapshot;
  required_states: string[];
  original_photo_path: string | null;
  source_asset_path: string | null;
  credit_ref: string | null;
  pet_id: string | null;
}

// ---------------------------------------------------------------------------
// Config / constants
// ---------------------------------------------------------------------------

const OPENAI_BASE_URL = "https://api.openai.com/v1";
// gpt-image-1 loses platform support 2026-10-23; gpt-image-1.5 is the
// forward-looking default. OPENAI_IMAGE_MODEL still overrides for rollback.
const DEFAULT_IMAGE_MODEL = "gpt-image-1.5";
const SAFETY_MODEL = "gpt-5.5";
const BUCKET = "pet-media";

// Default generation quality: "low" ($0.011/image) matches the free-tier
// generation budget. Only override via env for paid/premium tiers.
const DEFAULT_IMAGE_QUALITY = Deno.env.get("OPENAI_IMAGE_QUALITY") ?? "low";

// Short-window burst guard, separate from generation_quota's longer-lived
// free/paid allowance -- see supabase/migrations/0002_rate_limit.sql. Caps a
// single user to RATE_LIMIT_MAX_ATTEMPTS generate-avatar calls per
// RATE_LIMIT_WINDOW_SECONDS, checked before quota is consumed so a
// rate-limited request never spends a quota unit it can't use.
const RATE_LIMIT_WINDOW_SECONDS = 300;
const RATE_LIMIT_MAX_ATTEMPTS = 3;

// Server-authoritative expression pack cost in credit_wallets credits (see
// supabase/migrations/0004_credit_ledger.sql). Deliberately a server
// constant, not read from the request body -- the client's credit_reason is
// never trusted for pricing (see docs/credit-phase1-design.md §4.1), so a
// tampered request can't buy a paid generation for less than this.
const EXPRESSION_PACK_CREDIT_COST = 12;

// Hard cap on how many distinct states a single expression-pack request can
// ask for. Without this, a client could submit requested_states padded with
// duplicates (e.g. ['happy','happy',...] x hundreds) and turn one rate-limit
// slot into an unbounded number of paid OpenAI generation calls, since
// generation fans out per requested state. Deduplication happens before this
// cap is enforced (see the isExpressionPackRequest validation below), so the
// cap always bounds distinct, billable states -- not raw array length.
const MAX_EXPRESSION_PACK_STATES = 6;

// Charset for an incoming pet_id (see the GenerateAvatarRequestBody.pet_id
// doc comment above). This is used verbatim as a storage path segment
// (avatars/{userId}/{petId}/...), so it's restricted to a safe, boring
// charset rather than accepting arbitrary strings -- in particular no "/" or
// "..", which would otherwise let a crafted pet_id escape the intended
// per-pet storage prefix.
const PET_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

// Per-OpenAI-call abort timeout. Chosen so that safety check (1 call) +
// state generation (calls now run in parallel, so this is ~1 call's worth of
// wall time) + upload can all fail fast enough to leave room, within the
// platform's 400s Edge Function wall-clock limit, for markJobFailed +
// refund_generation_quota to complete:
//   safety check   <= 150s
//   generation     <= 150s (parallel across states, not per-state)
//   upload+misc    ~50s budget (storage + DB writes, not OpenAI-bounded)
//   failure/refund margin ~50s
//   150 + 150 + 50 + 50 = 400s ceiling, ~200s in the common/success case.
const OPENAI_CALL_TIMEOUT_MS = 150_000;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const MIN_ASSET_SIDE_PX = 128;

// ---------------------------------------------------------------------------
// DRY RUN mode
//
// Bypasses only the two paid OpenAI calls (safety classification + per-state
// image generation) with deterministic local fixtures, so the rest of the
// pipeline -- status transitions, chroma-key, the quality gate, storage
// upload, generated_assets insert, completion, refund-on-failure, and
// original-photo deletion -- all run through their real code paths
// unchanged. Intended for local/staging smoke-testing without spending on
// OpenAI. Double-gated deliberately: GENERATION_DRY_RUN=true is not enough by
// itself, and a configured OPENAI_API_KEY always wins, so this can never
// silently activate (or stay active) in an environment that has real
// credentials configured -- e.g. an env var left set by mistake in
// production.
// ---------------------------------------------------------------------------

const DRY_RUN = Deno.env.get("GENERATION_DRY_RUN") === "true" && !Deno.env.get("OPENAI_API_KEY");

if (DRY_RUN) {
  console.warn(
    "[generate-avatar] DRY RUN ACTIVE — GENERATION_DRY_RUN=true and no OPENAI_API_KEY configured. " +
      "Safety classification and image generation are bypassed with local fixture PNGs. Never enable this in production."
  );
}

// DRY RUN delay: how long the fixture "generating" step sleeps before
// returning, standing in for real OpenAI generation latency. Defaults to
// 4000ms (a quick smoke-test wait); set GENERATION_DRY_RUN_DELAY_MS higher
// (e.g. 60000) to reproduce the real end-to-end client UX for $0 --
// background completion while the setup screen is still being filled in,
// long polling, and app-switch/return behavior. Clamped to
// DRY_RUN_MAX_DELAY_MS so a misconfigured huge value can't stall the
// pipeline past the Edge Function's wall-clock budget. Non-numeric or
// negative values fall back to the default rather than throwing.
const DRY_RUN_DEFAULT_DELAY_MS = 4_000;
const DRY_RUN_MAX_DELAY_MS = 120_000;

const parseDryRunDelayMs = (): number => {
  const raw = Deno.env.get("GENERATION_DRY_RUN_DELAY_MS");

  if (!raw) {
    return DRY_RUN_DEFAULT_DELAY_MS;
  }

  const parsed = Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return DRY_RUN_DEFAULT_DELAY_MS;
  }

  return Math.min(parsed, DRY_RUN_MAX_DELAY_MS);
};

const DRY_RUN_DELAY_MS = DRY_RUN ? parseDryRunDelayMs() : DRY_RUN_DEFAULT_DELAY_MS;

if (DRY_RUN && DRY_RUN_DELAY_MS !== DRY_RUN_DEFAULT_DELAY_MS) {
  console.warn(`[generate-avatar] DRY RUN delay overridden to ${DRY_RUN_DELAY_MS}ms via GENERATION_DRY_RUN_DELAY_MS.`);
}

// ---------------------------------------------------------------------------
// Test states override
//
// Unlike DRY_RUN, this is NOT gated on a missing OPENAI_API_KEY -- it needs
// to work with real credentials too, so a single real generation can be
// smoke-tested against production/staging OpenAI without paying for the
// full required_states set. Comma-separated list of known state names (see
// KNOWN_ASSET_STATES above); unknown entries are dropped, and an
// empty/all-unknown result is ignored (falls back to the DB default). This
// is DANGEROUS to leave set in production (it silently shrinks every user's
// avatar to fewer states), hence the loud boot warning and the
// docs/launch-plan.md §6 pre-launch checklist entry.
// ---------------------------------------------------------------------------

const parseTestStatesOverride = (): string[] | null => {
  const raw = Deno.env.get("GENERATION_TEST_STATES");

  if (!raw || raw.trim().length === 0) {
    return null;
  }

  const requested = raw
    .split(",")
    .map((state) => state.trim())
    .filter((state) => state.length > 0);

  const known = requested.filter((state) => KNOWN_ASSET_STATES.includes(state));

  return known.length > 0 ? known : null;
};

const TEST_STATES_OVERRIDE = parseTestStatesOverride();

if (TEST_STATES_OVERRIDE) {
  console.warn(
    `[generate-avatar] TEST STATES OVERRIDE ACTIVE: ${TEST_STATES_OVERRIDE.join(", ")} — ` +
      "every new generation job will request only these states instead of the DB default. " +
      "Set via GENERATION_TEST_STATES. This works even with a real OPENAI_API_KEY configured. " +
      "Unset before launch (see docs/launch-plan.md §6)."
  );
}

// 128x128 solid-color PNGs, one per default required state, each a real
// valid PNG (signature + IHDR both parse, see chromakey_test.ts-style
// verification at generation time in scripts). Distinct flat colors per
// state only so dry-run output is visually distinguishable during manual
// smoke-testing -- these never reach real users.
const DRY_RUN_PNG_BY_STATE: Record<string, string> = {
  idle: "iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAABUElEQVR4nO3SQQEAEADAQPQvoJg6xPDYXYI9Nu/Zd5C1fgfwlwHiDBBngDgDxBkgzgBxBogzQJwB4gwQZ4A4A8QZIM4AcQaIM0CcAeIMEGeAOAPEGSDOAHEGiDNAnAHiDBBngDgDxBkgzgBxBogzQJwB4gwQZ4A4A8QZIM4AcQaIM0CcAeIMEGeAOAPEGSDOAHEGiDNAnAHiDBBngDgDxBkgzgBxBogzQJwB4gwQZ4A4A8QZIM4AcQaIM0CcAeIMEGeAOAPEGSDOAHEGiDNAnAHiDBBngDgDxBkgzgBxBogzQJwB4gwQZ4A4A8QZIM4AcQaIM0CcAeIMEGeAOAPEGSDOAHEGiDNAnAHiDBBngDgDxBkgzgBxBogzQJwB4gwQZ4A4A8QZIM4AcQaIM0CcAeIMEGeAOAPEGSDOAHEGiDNAnAHiDBBngDgDxBkgzgBxDymeBG3GWGNHAAAAAElFTkSuQmCC",
  happy:
    "iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAABT0lEQVR4nO3SMQEAIAzAMMC/mDkEGRxNFPTovjN3kXV+B/CXAeIMEGeAOAPEGSDOAHEGiDNAnAHiDBBngDgDxBkgzgBxBogzQJwB4gwQZ4A4A8QZIM4AcQaIM0CcAeIMEGeAOAPEGSDOAHEGiDNAnAHiDBBngDgDxBkgzgBxBogzQJwB4gwQZ4A4A8QZIM4AcQaIM0CcAeIMEGeAOAPEGSDOAHEGiDNAnAHiDBBngDgDxBkgzgBxBogzQJwB4gwQZ4A4A8QZIM4AcQaIM0CcAeIMEGeAOAPEGSDOAHEGiDNAnAHiDBBngDgDxBkgzgBxBogzQJwB4gwQZ4A4A8QZIM4AcQaIM0CcAeIMEGeAOAPEGSDOAHEPIUQEXgtxAtkAAAAASUVORK5CYII=",
  sleep:
    "iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAABUElEQVR4nO3SQQEAEADAQPQPo4VYxPDYXYI9Nve5d5C1fgfwlwHiDBBngDgDxBkgzgBxBogzQJwB4gwQZ4A4A8QZIM4AcQaIM0CcAeIMEGeAOAPEGSDOAHEGiDNAnAHiDBBngDgDxBkgzgBxBogzQJwB4gwQZ4A4A8QZIM4AcQaIM0CcAeIMEGeAOAPEGSDOAHEGiDNAnAHiDBBngDgDxBkgzgBxBogzQJwB4gwQZ4A4A8QZIM4AcQaIM0CcAeIMEGeAOAPEGSDOAHEGiDNAnAHiDBBngDgDxBkgzgBxBogzQJwB4gwQZ4A4A8QZIM4AcQaIM0CcAeIMEGeAOAPEGSDOAHEGiDNAnAHiDBBngDgDxBkgzgBxDy1RBHXkYo40AAAAAElFTkSuQmCC"
};

// Every DRY_RUN_PNG_BY_STATE entry falls back to the idle fixture when a
// requested state isn't one of the three baked-in fixtures (e.g. a future
// required_states configuration beyond idle/happy/sleep).
const dryRunPngBytesForState = (state: string): Uint8Array => {
  const base64 = DRY_RUN_PNG_BY_STATE[state] ?? DRY_RUN_PNG_BY_STATE.idle!;
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
};

// Carries the upstream HTTP status (e.g. OpenAI's 429/5xx) alongside the
// error message, so pipeline catch sites can record it in failure
// diagnostics without re-deriving it from response objects that are already
// out of scope by the time the catch runs.
class HttpStatusError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpStatusError";
    this.status = status;
  }
}

const safetyInstructions = [
  "You are a strict source-photo safety classifier for Mongchi.",
  "Classify whether the image is safe to use as a pet avatar source photo.",
  "Approve only ordinary, non-graphic pet photos that are clear enough to identify the pet.",
  "Return manual review for uncertainty, possible people/minors as the subject, unclear content, or ambiguous policy risk.",
  "Reject explicit sexual content, nudity, violence, gore, animal abuse, hate symbols, illegal activity, captchas, watermarks, logos, or text-dominant images.",
  "Use concise failedChecks identifiers such as source_photo_unsafe_content, source_photo_no_pet_visible, source_photo_multiple_pets_visible, source_photo_person_visible, source_photo_minor_visible, source_photo_text_or_logo, source_photo_watermark, source_photo_low_quality, source_photo_wrong_species, or source_photo_manual_review_required."
].join(" ");

const safetyClassificationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    safetyApproved: { type: "boolean" },
    manualReviewRequired: { type: "boolean" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    failedChecks: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } }
  },
  required: ["safetyApproved", "manualReviewRequired", "confidence", "failedChecks", "warnings"]
} as const;

const statePosePrompts: Record<string, string> = {
  base: "Neutral reference pose: relaxed seated or standing three-quarter front view, calm face, paws visible, stable bottom-center contact anchor, no detached objects.",
  idle: "Idle home pose: pet-only neutral room-ready pose with a small local breathing stance, gentle smile or soft curious eyes, seated or standing naturally, ready to be placed in the garden home, no detached objects, feet/paws keep the same bottom-center anchor.",
  happy: "Happy care pose: pet-only joyful raised paw, bright eyes, perked ears or lifted tail, warm smile, local tail/ear/face motion or a small celebratory lean, no detached objects, feet/paws keep the same bottom-center anchor.",
  sleep: "Sleep/rest pose: pet-only curled, seated, or tucked rest pose with closed or relaxed eyes, peaceful face, compact silhouette that still clearly preserves markings, no text, no Z letters, no bed, no blanket prop, no detached objects, feet/paws keep the same bottom-center anchor.",
  play: "Play pose: playful lean, lifted paw, tail/ears energized, looking at a toy just outside frame without drawing a separate loose toy.",
  hungry: "Hungry pose: attentive food-request expression, slightly expectant eyes, seated politely, no separate food bowl or UI.",
  walk_return: "Walk return pose: cheerful after-walk stance, tiny backpack-like energy optional only if naturally attached, paws grounded and face proud.",
  treat_reaction: "Treat reaction pose: delighted nibble or sparkle-eyed reaction, optional tiny treat held close to mouth or paw, no loose plate or scene prop.",
  chat_portrait: "Chat portrait pose: closer friendly bust-to-full-body framing, direct eye contact, expressive listening face, clean silhouette for a dialogue panel.",
  curious: "Curious pose: head tilt, one paw lifted or ears angled, inquisitive gentle expression, no question mark or speech bubble.",
  celebrate: "Celebrate pose: joyful small jump or proud sit, celebratory expression, no confetti, no text, no badge, no UI.",
  garden_help: "Garden helper pose: helpful stance as if watering or tending plants, optional tiny leaf tucked near paw only if attached, no separate garden tools.",
  seasonal: "Seasonal cozy pose: gentle festive charm through posture and expression, optional tiny wearable flower or scarf, no background, no holiday text.",
  sad: "Sad pose: gently drooped ears and lowered tail, softly downcast glossy eyes, small hunched sit, wistful but still lovable expression, no tears streaming, no rain cloud or UI symbols.",
  sick: "Under-the-weather pose: low-energy curled or slumped sit, half-closed tired eyes, slightly pale cheeks, optional tiny blanket draped on the back only if naturally attached, clearly unwell but cozy and never distressing.",
  messy: "Messy pose: ruffled fur tufts sticking out, small dust smudges on cheeks or paws, mildly sheepish expression as if just rolled somewhere dusty, no dirt pile, no separate props."
};

const contractPromptLines: string[] = [
  "Identity contract: preserve recognizable fur color, markings, face shape, ear shape, muzzle/nose details, eye feel, body type, and visible personality from the photo.",
  "Photo identity priority: do not replace the pet with a generic cute dog/cat, breed stereotype, stock mascot, bundled fallback identity, or a flat placeholder puppy look. Source-photo markings and proportions win over generic cuteness.",
  "Multi-state contract: this asset belongs to a reusable state set, so keep the same species, proportions, face identity, markings, scale, and bottom-center paw/contact anchor that would align with other states.",
  "Anchor contract: keep the feet or lowest body contact point at the same bottom-center anchor in every state; express action with local head, mouth, ear, paw, tail, face, and posture changes, not by shifting the whole body.",
  "State uniqueness contract: the requested state must read through a distinct pose, facial expression, silhouette, or attached wearable cue; do not output idle/base art with only tiny color changes."
];

const stylePromptLines: string[] = [
  "Scene-fit contract: the pet will be composited onto a garden scene later, so light the pet itself with warm daylight, but keep the canvas background empty of scenery.",
  "Style contract: cute 2D low-resolution pixel-art sprite, chunky readable silhouette, thick dark 1-2px outline, limited 16-24 color palette, flat cel shading, crisp stepped pixel edges — centered, occupying about 75% of the square canvas height.",
  "Avoid photorealism, soft painterly shading, gradient fur, pure retro 8-bit or blocky low-res mush (this is a clean 16-24 color cel-shaded sprite, not chunky 8-bit), flat vector mascot styling, clay or plastic 3D rendering, extra animals, scenery, floor, shadow, frame, text, watermark, speech bubble, duplicate subject, source-photo fragment.",
  // Chroma-key contract: background=transparent (both the FormData field and
  // prompt-only instructions) does not reliably work on /images/edits with
  // gpt-image-1 or gpt-image-1.5 — the model paints a background regardless.
  // Instead we force a uniform pure-green canvas here and key it out in
  // postprocessing (see removeChromaKeyBackground below). Verified: border
  // pixels come back within +/-3 of the requested green, which is uniform
  // enough for a clean distance-based key.
  "CRITICAL: Fill the entire background with one perfectly uniform solid pure green color RGB(0,255,0). Every pixel outside the pet's outline must be exactly that flat green with no gradient, no vignette, no shadow, no floor, no texture. Do not paint any shadow, glow, or reflection beneath or around the pet on the green background — the green must stay perfectly flat everywhere. The character must not contain green key colors anywhere on the pet itself."
];

// ---------------------------------------------------------------------------
// Safe failure messages (English, warm, no guilt-tripping)
// ---------------------------------------------------------------------------

const failureMessages = {
  quotaExhausted: "You're out of avatar generations for now. Grab more credits and let's try again soon.",
  insufficientCredits: "You're out of credits for this one. Grab more and let's try again soon.",
  petSlotRequired: "Looks like this little one needs a bit more room first. Grab a new friend slot and let's get them settled in.",
  photoMissing: "We couldn't find that photo. Try uploading it once more.",
  sourceAssetMissing: "We couldn't find that expression to build from. Try again from your companion's page.",
  safetyFailed: "That photo didn't pass our safety check. Try another clear photo of your pet.",
  safetyManualReview: "This photo needs a closer look before we continue. Try another photo for now.",
  generationFailed: "The tiny door got stuck. Let's try again.",
  qualityFailed: "The little sketch didn't come out quite right. Let's give it another try.",
  uploadFailed: "We had trouble tucking the new art away. Let's try again.",
  unexpected: "Something small went sideways on our end. Let's try again in a moment."
} as const;

// ---------------------------------------------------------------------------
// Helpers: base64 (chunked to avoid stack overflow on large buffers)
// ---------------------------------------------------------------------------

const BASE64_CHUNK_SIZE = 0x8000;

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_SIZE) {
    const chunk = bytes.subarray(offset, offset + BASE64_CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
};

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

// Copies into a fresh, definite ArrayBuffer so callers that require
// BufferSource/BlobPart (as opposed to the wider ArrayBufferLike) type-check
// under strict TS, regardless of the backing buffer of the input view.
const toArrayBufferBytes = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);

  return copy;
};

const sha256Hex = async (bytes: Uint8Array): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", toArrayBufferBytes(bytes));
  return bytesToHex(new Uint8Array(digest));
};

// ---------------------------------------------------------------------------
// Helpers: fetch with single retry on 429 / 5xx
// ---------------------------------------------------------------------------

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_RETRY_BACKOFF_MIN_MS = 500;
const DEFAULT_RETRY_BACKOFF_JITTER_MS = 500;
const MAX_RETRY_AFTER_MS = 10_000;

// Random jitter on top of the base backoff, so a burst of concurrent
// requests (e.g. Promise.all-ed per-state generation calls all hitting a
// transient 429/5xx together) don't all retry in lockstep.
const jitteredBackoffMs = (): number => DEFAULT_RETRY_BACKOFF_MIN_MS + Math.floor(Math.random() * DEFAULT_RETRY_BACKOFF_JITTER_MS);

// Honors a 429 response's Retry-After header (seconds, or an HTTP-date) when
// present, clamped to a sane ceiling so a misbehaving/huge value can't stall
// the pipeline past the Edge Function's wall-clock budget. Falls back to the
// jittered default backoff when the header is absent or unparseable.
const retryDelayMsFor = (response: Response | null): number => {
  const retryAfterHeader = response?.headers.get("Retry-After");

  if (!retryAfterHeader) {
    return jitteredBackoffMs();
  }

  const asSeconds = Number(retryAfterHeader);

  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return Math.min(asSeconds * 1000, MAX_RETRY_AFTER_MS);
  }

  const asDate = Date.parse(retryAfterHeader);

  if (Number.isFinite(asDate)) {
    return Math.min(Math.max(asDate - Date.now(), 0), MAX_RETRY_AFTER_MS);
  }

  return jitteredBackoffMs();
};

// Each attempt gets its own AbortSignal.timeout so a hung OpenAI call can't
// silently eat the whole Edge Function wall-clock budget — a timed-out
// attempt aborts with an AbortError, which is retried once just like a 5xx.
const fetchWithTimeout = (input: string, init: RequestInit): Promise<Response> =>
  fetch(input, { ...init, signal: AbortSignal.timeout(OPENAI_CALL_TIMEOUT_MS) });

const fetchWithRetry = async (input: string, init: RequestInit): Promise<Response> => {
  let first: Response;

  try {
    first = await fetchWithTimeout(input, init);
  } catch {
    // Network error or timeout abort on the first attempt: fall through to
    // the single retry below instead of failing immediately.
    await sleep(jitteredBackoffMs());
    return fetchWithTimeout(input, init);
  }

  if (first.status !== 429 && first.status < 500) {
    return first;
  }

  await sleep(retryDelayMsFor(first));

  return fetchWithTimeout(input, init);
};

// ---------------------------------------------------------------------------
// Safety classification (ported from workers/ai/src/openAiSourcePhotoSafetyClassifier.ts)
// ---------------------------------------------------------------------------

interface SafetyClassification {
  safetyApproved: boolean;
  manualReviewRequired: boolean;
  confidence: number;
  failedChecks: string[];
  warnings: string[];
}

const normalizeCheckId = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_:-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 96);

  return normalized.length > 0 ? normalized : null;
};

const normalizeCheckIds = (values: unknown): string[] => {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(new Set(values.map(normalizeCheckId).filter((value): value is string => value !== null)));
};

const clampConfidence = (confidence: number): number => Math.max(0, Math.min(1, Number.isFinite(confidence) ? confidence : 0));

const classifySourcePhotoSafety = async (input: {
  apiKey: string;
  imageBytes: Uint8Array;
  contentType: string;
  species: PetSpecies;
  petName?: string;
}): Promise<SafetyClassification> => {
  const dataUrl = `data:${input.contentType};base64,${bytesToBase64(input.imageBytes)}`;

  const response = await fetchWithRetry(`${OPENAI_BASE_URL}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: SAFETY_MODEL,
      instructions: safetyInstructions,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                "Classify this uploaded image as a source photo for generating a cute mobile-game pet avatar.",
                `Expected pet species: ${input.species}.`,
                ...(input.petName ? [`Pet name: ${input.petName}.`] : []),
                "Return JSON only according to the schema."
              ].join(" ")
            },
            {
              type: "input_image",
              image_url: dataUrl,
              detail: "low"
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "source_photo_safety_classification",
          strict: true,
          schema: safetyClassificationSchema
        }
      },
      store: false,
      max_output_tokens: 300
    })
  });

  if (!response.ok) {
    throw new HttpStatusError(`OpenAI source photo safety request failed with status ${response.status}.`, response.status);
  }

  const json = (await response.json()) as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ type?: unknown; text?: unknown; refusal?: unknown }> }>;
  };

  let text: string | undefined;
  let refusal: string | undefined;

  if (typeof json.output_text === "string" && json.output_text.trim().length > 0) {
    text = json.output_text;
  } else if (Array.isArray(json.output)) {
    const parts: string[] = [];

    for (const item of json.output) {
      for (const content of item.content ?? []) {
        if (typeof content.refusal === "string" && content.refusal.trim().length > 0) {
          refusal = content.refusal;
          break;
        }

        if (content.type === "output_text" && typeof content.text === "string") {
          parts.push(content.text);
        }
      }

      if (refusal) {
        break;
      }
    }

    if (parts.length > 0) {
      text = parts.join("");
    }
  }

  if (refusal) {
    return {
      safetyApproved: false,
      manualReviewRequired: true,
      confidence: 0,
      failedChecks: ["source_photo_safety_model_refusal"],
      warnings: []
    };
  }

  if (!text) {
    throw new Error("OpenAI source photo safety response did not include classification JSON.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("OpenAI source photo safety classification was not valid.");
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as { safetyApproved?: unknown }).safetyApproved !== "boolean" ||
    typeof (parsed as { confidence?: unknown }).confidence !== "number"
  ) {
    throw new Error("OpenAI source photo safety classification was not valid.");
  }

  const record = parsed as {
    safetyApproved: boolean;
    manualReviewRequired?: unknown;
    confidence: number;
    failedChecks?: unknown;
    warnings?: unknown;
  };
  const manualReviewRequired = record.manualReviewRequired === true;
  const failedChecks = normalizeCheckIds(record.failedChecks);

  if (!record.safetyApproved && !manualReviewRequired && failedChecks.length === 0) {
    failedChecks.push("source_photo_unsafe_content");
  }

  return {
    safetyApproved: record.safetyApproved,
    manualReviewRequired,
    confidence: clampConfidence(record.confidence),
    failedChecks,
    warnings: normalizeCheckIds(record.warnings)
  };
};

// ---------------------------------------------------------------------------
// Image generation (ported from workers/ai/src/openAiImageProvider.ts, minus
// the sharp-based multi-state sheet slicing — one call per requested state)
// ---------------------------------------------------------------------------

const buildImagePrompt = (input: {
  state: GeneratedAssetState;
  species: PetSpecies;
  petName?: string;
  personalityTags?: string[];
  talkingStyle?: TalkingStyle;
}): string =>
  [
    "Use the provided dog or cat photo as the identity reference, but transform it into a Mongchi companion avatar.",
    "Only the main pet becomes the avatar. Ignore and remove the source photo background, furniture, scenery, lighting, people, duplicate animals, and loose props.",
    `Pet species: ${input.species}.`,
    ...(input.petName ? [`Pet name for personality only, do not render text: ${input.petName}.`] : []),
    `Requested state: ${input.state}. ${statePosePrompts[input.state] ?? statePosePrompts.idle}`,
    `Personality tags: ${(input.personalityTags ?? []).join(", ") || "gentle"}.`,
    `Talking style: ${input.talkingStyle ?? "gentle"}.`,
    ...contractPromptLines,
    // Background is deliberately NOT requested as "transparent" here: that
    // instruction is not honored by /images/edits (see stylePromptLines'
    // chroma-key contract below, which requests solid green instead and
    // gets keyed out in postprocessing).
    "App integration contract: one complete pet only, centered, full body unless the requested state is chat_portrait, generous padding, no text, no UI, no watermark, no frame, no scenery, no full floor, no detached props except a tiny attached state cue when explicitly allowed.",
    ...stylePromptLines
  ].join(" ");

// Expression pack mode: the seed image is already one of our own generated
// pixel sprites (typically the idle state), not a raw source photo. Unlike
// buildImagePrompt above, this deliberately drops the "ignore and remove the
// source photo background / furniture / scenery" line (there is no messy
// photo background to strip -- the seed is already a clean sprite on a
// transparent/keyed background) and instead leads with an explicit
// same-character consistency instruction, per the expression-pack contract.
const buildExpressionPackPrompt = (input: {
  state: GeneratedAssetState;
  species: PetSpecies;
  petName?: string;
  personalityTags?: string[];
  talkingStyle?: TalkingStyle;
}): string =>
  [
    "Use the provided pixel-art sprite of a Mongchi companion avatar as the identity and style reference for a new pose.",
    `Same exact ${input.species} character, same palette and outline style as the input sprite, only the pose/expression changes.`,
    `Pet species: ${input.species}.`,
    ...(input.petName ? [`Pet name for personality only, do not render text: ${input.petName}.`] : []),
    `Requested state: ${input.state}. ${statePosePrompts[input.state] ?? statePosePrompts.idle}`,
    `Personality tags: ${(input.personalityTags ?? []).join(", ") || "gentle"}.`,
    `Talking style: ${input.talkingStyle ?? "gentle"}.`,
    ...contractPromptLines,
    "App integration contract: one complete pet only, centered, full body unless the requested state is chat_portrait, generous padding, no text, no UI, no watermark, no frame, no scenery, no full floor, no detached props except a tiny attached state cue when explicitly allowed.",
    ...stylePromptLines
  ].join(" ");

interface GeneratedImageResult {
  bytes: Uint8Array;
  width: number;
  height: number;
}

const readPngDimensions = (bytes: Uint8Array): { width: number; height: number } | null => {
  if (bytes.length < 24 || !PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    return null;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  return {
    width: view.getUint32(16, false),
    height: view.getUint32(20, false)
  };
};

const isPng = (bytes: Uint8Array): boolean => PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);

// Source photos are no longer PNG-only: the mobile client now uploads a
// compressed JPEG to stay under transport-layer upload size limits (see
// apps/mobile's supabaseGenerationSession.ts). The multipart filename here is
// cosmetic for OpenAI (mime detection comes from the Blob's `type`), but we
// still keep the extension honest for anyone inspecting request logs.
const sourceFileExtensionFor = (contentType: string): string => (contentType === "image/jpeg" ? "jpg" : "png");

const generateStateImage = async (input: {
  apiKey: string;
  model: string;
  sourceImageBytes: Uint8Array;
  sourceContentType: string;
  state: GeneratedAssetState;
  species: PetSpecies;
  petName?: string;
  personalityTags?: string[];
  talkingStyle?: TalkingStyle;
  // Expression pack mode reuses this same /images/edits call path (gpt-image
  // already supports an image input via the edits endpoint -- see the module
  // doc comment above), swapping in the seed-sprite-aware prompt instead of
  // the source-photo prompt. Defaults to "photo" so every existing call site
  // is unaffected.
  promptMode?: "photo" | "expression_pack";
}): Promise<GeneratedImageResult> => {
  const formData = new FormData();
  const buildPrompt = input.promptMode === "expression_pack" ? buildExpressionPackPrompt : buildImagePrompt;

  formData.append(
    "image",
    new Blob([toArrayBufferBytes(input.sourceImageBytes)], { type: input.sourceContentType }),
    `source.${sourceFileExtensionFor(input.sourceContentType)}`
  );
  formData.append("model", input.model);
  formData.append(
    "prompt",
    buildPrompt({
      state: input.state,
      species: input.species,
      petName: input.petName,
      personalityTags: input.personalityTags,
      talkingStyle: input.talkingStyle
    })
  );
  formData.append("n", "1");
  formData.append("size", "1024x1024");
  // No `background` field: background=transparent is not honored by
  // /images/edits (verified against gpt-image-1 and gpt-image-1.5 — the
  // model paints a background regardless). We instead force a uniform green
  // canvas via the prompt and remove it in postprocessing (chroma key).
  formData.append("output_format", "png");
  formData.append("quality", DEFAULT_IMAGE_QUALITY);

  const response = await fetchWithRetry(`${OPENAI_BASE_URL}/images/edits`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`
    },
    body: formData
  });

  if (!response.ok) {
    throw new HttpStatusError(`OpenAI image provider request failed with status ${response.status}.`, response.status);
  }

  const json = (await response.json()) as { data?: Array<{ b64_json?: unknown }> };
  const b64 = json.data?.[0]?.b64_json;

  if (typeof b64 !== "string" || b64.trim().length === 0) {
    throw new Error("OpenAI image response did not include base64 image data.");
  }

  const bytes = Uint8Array.from(atob(b64), (char) => char.charCodeAt(0));

  if (bytes.byteLength === 0) {
    throw new Error("OpenAI image response included empty image data.");
  }

  const dimensions = readPngDimensions(bytes);

  if (!dimensions) {
    throw new Error("OpenAI image provider returned unreadable image bytes.");
  }

  return { bytes, width: dimensions.width, height: dimensions.height };
};

// ---------------------------------------------------------------------------
// Lightweight quality gate: dimensions + PNG signature only. Full vision
// scoring (composition, identity match, style adherence) is out of scope for
// this pass.
// TODO: add a vision-based quality pass (openAiGenerationQualityEvaluator
// equivalent) once the pipeline is validated end-to-end.
// ---------------------------------------------------------------------------

const passesLightweightQualityGate = (asset: GeneratedImageResult): boolean =>
  isPng(asset.bytes) && asset.width >= MIN_ASSET_SIDE_PX && asset.height >= MIN_ASSET_SIDE_PX;

// ---------------------------------------------------------------------------
// Job status helpers
// ---------------------------------------------------------------------------

const updateJobStatus = async (
  admin: SupabaseClient,
  jobId: string,
  patch: Record<string, unknown>
): Promise<void> => {
  await admin
    .from("generation_jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", jobId);
};

// Diagnostic-only detail captured alongside a failure. internalError/
// httpStatus surface the raw cause (never shown to the user -- see
// failure_message_safe, which keeps its existing warm copy) so failures can
// be triaged from the generation_jobs row instead of guessing from the
// failure_code alone. Stored in the existing `quality` jsonb column rather
// than a new one to avoid a schema migration.
// TODO(diagnostics): remove internalError/failedStage from the persisted
// row once generation failures are reliably triaged in production and this
// is no longer needed -- it's diagnostic-only and not meant to be permanent.
interface JobFailureDiagnostics {
  internalError?: string;
  failedStage: string;
  httpStatus?: number;
}

const MAX_INTERNAL_ERROR_LENGTH = 300;

const truncateInternalError = (message: string): string => message.slice(0, MAX_INTERNAL_ERROR_LENGTH);

const toInternalErrorMessage = (cause: unknown): string | undefined => {
  if (cause instanceof Error) {
    return truncateInternalError(cause.message);
  }

  if (typeof cause === "string" && cause.trim().length > 0) {
    return truncateInternalError(cause);
  }

  return undefined;
};

const diagnosticsForStage = (failedStage: string, cause: unknown): JobFailureDiagnostics => ({
  failedStage,
  internalError: toInternalErrorMessage(cause),
  ...(cause instanceof HttpStatusError ? { httpStatus: cause.status } : {})
});

const markJobFailed = async (
  admin: SupabaseClient,
  jobId: string,
  userId: string,
  failureCode: string,
  failureMessageSafe: string,
  refund: boolean,
  diagnostics?: JobFailureDiagnostics,
  creditRef?: string | null,
  usedPetSlotBundle?: boolean
): Promise<void> => {
  const patch: Record<string, unknown> = {
    status: "failed",
    failure_code: failureCode,
    failure_message_safe: failureMessageSafe
  };

  if (diagnostics) {
    patch.quality = {
      failedStage: diagnostics.failedStage,
      ...(diagnostics.internalError ? { internalError: diagnostics.internalError } : {}),
      ...(diagnostics.httpStatus !== undefined ? { httpStatus: diagnostics.httpStatus } : {})
    };
  }

  await updateJobStatus(admin, jobId, patch);

  if (refund) {
    // Jobs funded by consume_credits (currently: expression packs) carry a
    // credit_ref -- the request_id used as the consume_credits idempotency
    // key -- and must be refunded through refund_credits against that same
    // key, not refund_generation_quota, since no generation_quota unit was
    // ever spent for them. Jobs funded by a purchased pet slot's bundled
    // generation grant (usedPetSlotBundle, see reserve_pet_generation_slot in
    // 0005_pet_namespace.sql) similarly never touched generation_quota or
    // credit_wallets, and must instead have that bundle restored via
    // refund_pet_generation_slot so a transient failure doesn't burn the one
    // free generation a purchased slot grants. Every other job (credit_ref
    // null, usedPetSlotBundle false/undefined) was funded by the free
    // allowance and keeps using refund_generation_quota exactly as before.
    // All three refund RPCs are safe against a retried markJobFailed call
    // (e.g. from an outer catch running after an inner one already
    // refunded) -- refund_credits is ref-keyed idempotent, and refund_
    // generation_quota/refund_pet_generation_slot rely on this function only
    // ever being called once per job (every failure path returns
    // immediately after calling it -- see runPipeline below).
    if (creditRef) {
      await admin.rpc("refund_credits", { p_user: userId, p_ref_type: "credit_request", p_ref_id: creditRef });
    } else if (usedPetSlotBundle) {
      await admin.rpc("refund_pet_generation_slot", { p_user: userId });
    } else {
      await admin.rpc("refund_generation_quota", { p_user: userId });
    }
  }
};

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

const runPipeline = async (input: {
  admin: SupabaseClient;
  job: GenerationJobRow;
  openAiApiKey: string;
  imageModel: string;
  dryRun: boolean;
  // Whether this job was funded by a purchased pet slot's bundled generation
  // grant (see reserve_pet_generation_slot in 0005_pet_namespace.sql) rather
  // than consume_credits or the free generation_quota allowance. Threaded in
  // from the HTTP handler's step 4 funding decision, the same way dryRun is
  // -- it's an outcome of that request-time decision, not something re-
  // derivable from the job row alone.
  usedPetSlotBundle: boolean;
}): Promise<void> => {
  const { admin, job, openAiApiKey, imageModel, dryRun, usedPetSlotBundle } = input;
  const originalPhotoPath = job.original_photo_path;
  const sourceAssetPath = job.source_asset_path;

  // Expression pack mode: source_asset_path is set (and original_photo_path
  // stays null -- see 0003_expression_pack_source_asset.sql). There is no
  // source photo to run through safety classification or to delete for
  // privacy afterwards; the seed is one of our own previously generated
  // sprites instead.
  const isExpressionPackMode = Boolean(sourceAssetPath);

  // Every job funded a purchase (either consume_credits, recorded as
  // job.credit_ref, a purchased pet slot's bundled generation grant
  // (usedPetSlotBundle), or the free consume_generation_quota allowance when
  // neither of those applies) and must refund it on failure -- markJobFailed
  // picks the right RPC based on creditRef/usedPetSlotBundle (see
  // markJobFailed above). Historically this was `!isExpressionPackMode`,
  // i.e. expression packs were never refunded on failure -- that was correct
  // back when expression packs skipped server-side charging entirely, but is
  // now a bug: expression packs are debited via consume_credits before the
  // job is created (see the HTTP handler's step 4), so a failure that
  // doesn't refund would silently keep the user's credits without ever
  // delivering the generation.
  const shouldRefundOnFailure = true;
  const creditRef = job.credit_ref;

  if (!originalPhotoPath && !sourceAssetPath) {
    await markJobFailed(
      admin,
      job.id,
      job.user_id,
      "original_photo_missing",
      failureMessages.photoMissing,
      shouldRefundOnFailure,
      { failedStage: "created", internalError: "Job row has no original_photo_path or source_asset_path." },
      creditRef,
      usedPetSlotBundle
    );
    return;
  }

  try {
    // a. Download the seed image: the original photo in the normal flow, or
    // a previously generated sprite in expression pack mode.
    const download = await admin.storage.from(BUCKET).download((sourceAssetPath ?? originalPhotoPath)!);

    if (download.error || !download.data) {
      await markJobFailed(
        admin,
        job.id,
        job.user_id,
        isExpressionPackMode ? "source_asset_missing" : "original_photo_missing",
        isExpressionPackMode ? failureMessages.sourceAssetMissing : failureMessages.photoMissing,
        shouldRefundOnFailure,
        {
          failedStage: "preprocessing",
          internalError:
            toInternalErrorMessage(download.error) ??
            (isExpressionPackMode ? "Source asset download returned no data." : "Original photo download returned no data.")
        },
        creditRef,
        usedPetSlotBundle
      );
      return;
    }

    const sourceArrayBuffer = await download.data.arrayBuffer();
    const sourceBytes = new Uint8Array(sourceArrayBuffer);
    const sourceContentType = download.data.type && download.data.type.length > 0 ? download.data.type : "image/png";

    // b. Safety check. Skipped entirely in expression pack mode: the seed is
    // a sprite we generated ourselves, not user-submitted photo content, so
    // there is nothing new to classify.
    let safety: SafetyClassification;

    if (isExpressionPackMode) {
      safety = { safetyApproved: true, manualReviewRequired: false, confidence: 1, failedChecks: [], warnings: [] };
    } else {
      await updateJobStatus(admin, job.id, { status: "safety_checking" });

      try {
        safety = dryRun
          ? { safetyApproved: true, manualReviewRequired: false, confidence: 1, failedChecks: [], warnings: [] }
          : await classifySourcePhotoSafety({
              apiKey: openAiApiKey,
              imageBytes: sourceBytes,
              contentType: sourceContentType,
              species: job.input_snapshot.species,
              petName: job.input_snapshot.petName
            });
      } catch (cause) {
        await markJobFailed(
          admin,
          job.id,
          job.user_id,
          "source_photo_safety_unavailable",
          failureMessages.safetyFailed,
          true,
          diagnosticsForStage("safety_checking", cause),
          creditRef,
          usedPetSlotBundle
        );
        return;
      }

      if (safety.manualReviewRequired) {
        await markJobFailed(
          admin,
          job.id,
          job.user_id,
          "source_photo_manual_review_required",
          failureMessages.safetyManualReview,
          true,
          {
            failedStage: "safety_checking",
            internalError: truncateInternalError(
              `Manual review required (confidence=${safety.confidence}): ${safety.failedChecks.join(", ") || "no specific checks flagged"}.`
            )
          },
          creditRef,
          usedPetSlotBundle
        );
        return;
      }

      if (!safety.safetyApproved) {
        await markJobFailed(
          admin,
          job.id,
          job.user_id,
          "source_photo_safety_failed",
          failureMessages.safetyFailed,
          true,
          {
            failedStage: "safety_checking",
            internalError: truncateInternalError(
              `Safety check rejected (confidence=${safety.confidence}): ${safety.failedChecks.join(", ") || "no specific checks flagged"}.`
            )
          },
          creditRef,
          usedPetSlotBundle
        );
        return;
      }
    }

    // c. Generation, one call per required state.
    await updateJobStatus(admin, job.id, { status: "generating" });

    const requiredStates = job.required_states.length > 0 ? job.required_states : ["idle", "happy", "sleep"];
    let generated: Array<{ state: string; result: GeneratedImageResult }>;

    try {
      if (dryRun) {
        // DRY RUN: skip the paid OpenAI /images/edits calls entirely and
        // decode the baked-in fixture PNGs instead. A sleep stands in for
        // real generation latency so the client's polling UI (progress bar,
        // "Creating the first tiny companion" copy) still gets to render the
        // generating step for a moment rather than flashing straight
        // through it. Duration is configurable via
        // GENERATION_DRY_RUN_DELAY_MS (see DRY_RUN_DELAY_MS above) -- set it
        // to something like 60000 to rehearse the real-world client UX
        // (background completion during setup input, long polling,
        // app-switch/return) at $0.
        await sleep(DRY_RUN_DELAY_MS);

        generated = requiredStates.map((state) => {
          const bytes = dryRunPngBytesForState(state);
          const dimensions = readPngDimensions(bytes);

          return {
            state,
            result: {
              bytes,
              width: dimensions?.width ?? MIN_ASSET_SIDE_PX,
              height: dimensions?.height ?? MIN_ASSET_SIDE_PX
            }
          };
        });
      } else {
        // Generate all required states concurrently rather than sequentially.
        // Sequential generation (60-120s per state) multiplied by 3+ states
        // could exceed the Edge Function's 400s wall-clock limit; running them
        // in parallel bounds total generation time to roughly one call's
        // duration regardless of state count. Promise.all fails fast (and the
        // whole batch is treated as failed, refund included) if any state
        // errors out, matching the prior all-or-nothing failure behavior.
        generated = await Promise.all(
          requiredStates.map((state) =>
            generateStateImage({
              apiKey: openAiApiKey,
              model: imageModel,
              sourceImageBytes: sourceBytes,
              sourceContentType,
              state,
              species: job.input_snapshot.species,
              petName: job.input_snapshot.petName,
              personalityTags: job.input_snapshot.personalityTags,
              talkingStyle: job.input_snapshot.talkingStyle,
              promptMode: isExpressionPackMode ? "expression_pack" : "photo"
            }).then((result) => ({ state, result }))
          )
        );
      }
    } catch (cause) {
      await markJobFailed(
        admin,
        job.id,
        job.user_id,
        "generation_failed",
        failureMessages.generationFailed,
        shouldRefundOnFailure,
        diagnosticsForStage("generating", cause),
        creditRef,
        usedPetSlotBundle
      );
      return;
    }

    // d. Chroma-key background removal. Runs before the quality gate so the
    // gate inspects the same PNG bytes that get uploaded. Never throws (see
    // removeChromaKeyBackground) — a keying failure falls back to the
    // original opaque asset rather than failing the job.
    const chromaKeyTags: Record<string, ChromaKeyOutcome["quality"]> = {};

    generated = generated.map(({ state, result }) => {
      const outcome = removeChromaKeyBackground(result.bytes);
      chromaKeyTags[state] = outcome.quality;

      const dimensions = readPngDimensions(outcome.bytes);

      return {
        state,
        result: {
          bytes: outcome.bytes,
          width: dimensions?.width ?? result.width,
          height: dimensions?.height ?? result.height
        }
      };
    });

    // e. Lightweight quality gate, run against the post-chroma-key PNGs.
    await updateJobStatus(admin, job.id, { status: "quality_checking" });

    const failedStates = generated.filter(({ result }) => !passesLightweightQualityGate(result));

    if (failedStates.length > 0) {
      await updateJobStatus(admin, job.id, {
        quality: {
          qualityStatus: "failed",
          failedChecks: failedStates.map(({ state }) => `generated_asset_quality_failed_${state}`),
          manualReviewRequired: false,
          retryRecommended: true,
          // Diagnostic-only, see JobFailureDiagnostics above.
          failedStage: "quality_checking",
          internalError: truncateInternalError(
            `Quality gate failed for states: ${failedStates.map(({ state }) => state).join(", ")}.`
          )
        }
      });
      await markJobFailed(
        admin,
        job.id,
        job.user_id,
        "generated_asset_quality_failed",
        failureMessages.qualityFailed,
        shouldRefundOnFailure,
        undefined,
        creditRef,
        usedPetSlotBundle
      );
      return;
    }

    // f. Upload assets.
    await updateJobStatus(admin, job.id, { status: "uploading_assets" });

    try {
      // pet_id-namespaced storage path when the job carries one, otherwise
      // the original (pre-multi-pet) layout unchanged -- see
      // 0005_pet_namespace.sql's backward-compat principle. Inserting
      // job.pet_id right after the userId segment keeps the RLS storage
      // policies (which key off (storage.foldername(name))[2] == userId,
      // see 0001_init.sql) correct in both cases: userId stays the segment
      // right after "avatars" either way.
      for (const { state, result } of generated) {
        const storagePath = job.pet_id
          ? `avatars/${job.user_id}/${job.pet_id}/${job.id}/${state}.png`
          : `avatars/${job.user_id}/${job.id}/${state}.png`;
        const contentHash = `sha256:${await sha256Hex(result.bytes)}`;

        const upload = await admin.storage.from(BUCKET).upload(storagePath, result.bytes, {
          contentType: "image/png",
          upsert: true
        });

        if (upload.error) {
          throw new Error(`Asset upload failed for state "${state}": ${upload.error.message}`);
        }

        const insert = await admin.from("generated_assets").insert({
          job_id: job.id,
          user_id: job.user_id,
          pet_id: job.pet_id,
          state,
          storage_path: storagePath,
          width: result.width,
          height: result.height,
          content_hash: contentHash
        });

        if (insert.error) {
          throw new Error(`Asset record insert failed for state "${state}": ${insert.error.message}`);
        }
      }
    } catch (cause) {
      await markJobFailed(
        admin,
        job.id,
        job.user_id,
        "asset_upload_failed",
        failureMessages.uploadFailed,
        shouldRefundOnFailure,
        diagnosticsForStage("uploading_assets", cause),
        creditRef,
        usedPetSlotBundle
      );
      return;
    }

    // g. Mark completed, then (outside expression pack mode) delete the
    // original photo for privacy -- see the isExpressionPackMode branch below.
    await updateJobStatus(admin, job.id, {
      status: "completed",
      completed_at: new Date().toISOString(),
      quality: {
        qualityStatus: "passed",
        failedChecks: [],
        manualReviewRequired: false,
        retryRecommended: false,
        chromaKey: chromaKeyTags
      }
    });

    // g (cont'd). Delete the original photo for privacy -- but never the
    // seed asset in expression pack mode: that's a permanent, reusable
    // generated_assets entry (e.g. the idle sprite), not a transient photo
    // upload, so it must survive to seed future expression pack requests too.
    if (!isExpressionPackMode && originalPhotoPath) {
      await admin.storage.from(BUCKET).remove([originalPhotoPath]);
    }
  } catch (cause) {
    await markJobFailed(
      admin,
      job.id,
      job.user_id,
      "unexpected_pipeline_error",
      failureMessages.unexpected,
      shouldRefundOnFailure,
      diagnosticsForStage("unexpected", cause),
      creditRef,
      usedPetSlotBundle
    );
  }
};

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

const jsonResponse = (body: unknown, status: number, extraHeaders?: Record<string, string>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders }
  });

// species is required; petName/personalityTags/talkingStyle are optional so
// the client can kick off generation right after photo confirmation, before
// the setup screen (name/personality/voice) has been filled in. When present,
// each field still has to be well-formed.
const isValidInputSnapshot = (value: unknown): value is GenerationInputSnapshot => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<GenerationInputSnapshot>;

  if (record.species !== "dog" && record.species !== "cat") {
    return false;
  }

  if (record.petName !== undefined && typeof record.petName !== "string") {
    return false;
  }

  if (
    record.personalityTags !== undefined &&
    (!Array.isArray(record.personalityTags) || !record.personalityTags.every((tag) => typeof tag === "string"))
  ) {
    return false;
  }

  if (
    record.talkingStyle !== undefined &&
    record.talkingStyle !== "cute" &&
    record.talkingStyle !== "gentle" &&
    record.talkingStyle !== "cheerful" &&
    record.talkingStyle !== "comforting"
  ) {
    return false;
  }

  return true;
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
  const imageModel = Deno.env.get("OPENAI_IMAGE_MODEL") ?? DEFAULT_IMAGE_MODEL;

  // OPENAI_API_KEY is only required outside DRY_RUN -- DRY_RUN itself already
  // requires OPENAI_API_KEY to be absent (see the DRY_RUN definition above),
  // so this can never mask a genuinely misconfigured production deployment.
  if (!supabaseUrl || !serviceRoleKey || (!openAiApiKey && !DRY_RUN)) {
    return jsonResponse({ error: "server_misconfigured" }, 500);
  }

  // 1. Identify the caller (including anonymous auth users) from their JWT.
  const authClient = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false }
  });

  const { data: userData, error: userError } = await authClient.auth.getUser();

  if (userError || !userData?.user) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const userId = userData.user.id;

  // 2. Parse and validate the request body.
  let body: GenerateAvatarRequestBody;

  try {
    body = (await req.json()) as GenerateAvatarRequestBody;
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  if (!isValidInputSnapshot(body.inputSnapshot)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  // pet_id (see 0005_pet_namespace.sql and the GenerateAvatarRequestBody doc
  // comment): optional, and as of this migration no shipped client sends it
  // yet -- absent/undefined means the pre-multi-pet first/only pet. When
  // present it's validated against PET_ID_PATTERN since it's used verbatim
  // as a storage path segment further down.
  let requestedPetId: string | null = null;

  if (body.pet_id !== undefined) {
    if (typeof body.pet_id !== "string" || !PET_ID_PATTERN.test(body.pet_id)) {
      return jsonResponse({ error: "invalid_request" }, 400);
    }

    requestedPetId = body.pet_id;
  }

  // Expression pack mode: source_asset_path is present, so there is no
  // original photo to require (it was already deleted after the first
  // generation -- see runPipeline's privacy-driven deletion). Every other
  // request still requires the normal originalPhotoPath contract unchanged.
  const isExpressionPackRequest = typeof body.source_asset_path === "string" && body.source_asset_path.trim().length > 0;

  if (!isExpressionPackRequest && (typeof body.originalPhotoPath !== "string" || body.originalPhotoPath.trim().length === 0)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  // service_role client for privileged writes (quota, job rows, storage) --
  // created here (rather than further down) because the expression pack
  // pet-ownership check right below needs it.
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  let requestedStates: string[] = [];

  if (isExpressionPackRequest) {
    if (
      !Array.isArray(body.requested_states) ||
      body.requested_states.length === 0 ||
      !body.requested_states.every((state) => typeof state === "string" && KNOWN_ASSET_STATES.includes(state))
    ) {
      return jsonResponse({ error: "invalid_request" }, 400);
    }

    // Dedup before enforcing the hard cap so a padded/repeated array (e.g.
    // hundreds of 'happy' entries) can't smuggle amplified generation work
    // through the length check below -- see MAX_EXPRESSION_PACK_STATES.
    const dedupedStates = Array.from(new Set(body.requested_states));

    if (dedupedStates.length === 0 || dedupedStates.length > MAX_EXPRESSION_PACK_STATES) {
      return jsonResponse({ error: "invalid_request" }, 400);
    }

    requestedStates = dedupedStates;

    // Ownership check: the Edge Function runs with the service_role key
    // (bypasses RLS) and downloads whatever path it's given, so an
    // unscoped source_asset_path would let one user seed a generation from
    // another user's generated_assets storage path. Mirrors the
    // avatars/{user_id}/{job_id}/{state}.png (or, pet-namespaced,
    // avatars/{user_id}/{pet_id}/{job_id}/{state}.png) layout this same
    // function writes to on upload (see the "f. Upload assets" step below).
    if (!body.source_asset_path!.startsWith(`avatars/${userId}/`)) {
      return jsonResponse({ error: "invalid_request" }, 400);
    }

    // Per-pet seed ownership: the prefix check above only proves the asset
    // belongs to this *user* -- once storage paths are pet-namespaced, a
    // user with two pets could otherwise seed pet B's expression pack from
    // pet A's sprite (same user, wrong pet -- docs/multi-pet-slot-plan.md's
    // "표정 팩 시드 소유권 강화"). Confirm the seed path is actually recorded
    // against the requested pet_id (or, when pet_id is absent, against the
    // legacy null-pet-id pet) in generated_assets.
    let seedOwnershipQuery = admin
      .from("generated_assets")
      .select("id")
      .eq("user_id", userId)
      .eq("storage_path", body.source_asset_path!);
    seedOwnershipQuery =
      requestedPetId === null ? seedOwnershipQuery.is("pet_id", null) : seedOwnershipQuery.eq("pet_id", requestedPetId);

    const { data: seedAssetRow, error: seedAssetError } = await seedOwnershipQuery.maybeSingle();

    if (seedAssetError) {
      return jsonResponse({ error: "source_asset_check_failed" }, 500);
    }

    if (!seedAssetRow) {
      return jsonResponse({ error: "invalid_request" }, 400);
    }
  }

  // 3. Rate limit: cap burst attempts before touching quota/credits or doing
  // any paid work. For ordinary photo generations, an RPC error here fails
  // open (log and continue) rather than blocking every request on this
  // guard's own availability -- quota consumption right below remains the
  // authoritative "how many total" check regardless. Expression pack mode is
  // now also gated by consume_credits (step 4 below), but the rate limit
  // still runs first and still fails closed for it -- defense in depth
  // against burst amplification even though credits are now the primary
  // guard.
  const { data: rateLimitOk, error: rateLimitError } = await admin.rpc("check_generation_rate_limit", {
    p_user: userId,
    p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
    p_max: RATE_LIMIT_MAX_ATTEMPTS
  });

  if (rateLimitError) {
    if (isExpressionPackRequest) {
      console.error(
        "[generate-avatar] rate limit check failed for expression pack request, failing closed:",
        rateLimitError.message
      );
      return jsonResponse(
        { error: "rate_limit_unavailable" },
        503,
        { "Retry-After": String(RATE_LIMIT_WINDOW_SECONDS) }
      );
    }

    console.warn("[generate-avatar] rate limit check failed, failing open:", rateLimitError.message);
  } else if (rateLimitOk !== true) {
    return jsonResponse({ error: "rate_limited" }, 429, { "Retry-After": String(RATE_LIMIT_WINDOW_SECONDS) });
  }

  // 4. Secure a paid generation slot atomically before doing any paid work.
  //
  // Expression pack requests are now billed server-side against
  // credit_wallets via consume_credits (supabase/migrations/0004_credit_ledger.sql)
  // instead of skipping server-side accounting entirely -- see
  // docs/credit-phase1-design.md §4.2. The debit happens here, *before* the
  // job row exists, so credit_request idempotency has to key off a
  // client-supplied request_id rather than the not-yet-created job id (see
  // §3.6 of that design doc). requestId falls back to a server-generated
  // UUID when the client hasn't been migrated to send one yet (Phase 1c) --
  // that fallback is only safe here because it's generated fresh per HTTP
  // call, so it can never coincide with a real retry's key and cause a
  // false-idempotent skip; it just means an old client's literal button-mash
  // retries aren't deduplicated until Phase 1c ships, same as before this
  // change.
  //
  // All other (non-expression-pack) requests are, by default, funded by the
  // free generation_quota allowance exactly as before -- paid generation-
  // credit pricing for regeneration/full-set is a later credit phase, not
  // Phase 1. The one exception (multi-pet W2): a non-expression-pack request
  // for a genuinely new pet beyond the user's first is instead gated on
  // pet_slots (reserve_pet_generation_slot, 0005_pet_namespace.sql) --
  // free_limit is per-USER, not per-pet, so it would otherwise already be
  // exhausted by the time a second pet exists, which is exactly the
  // multi-pet-slot-plan.md blocker this closes.
  let creditRef: string | null = null;
  let usedPetSlotBundle = false;

  if (isExpressionPackRequest) {
    const requestId =
      typeof body.request_id === "string" && body.request_id.trim().length > 0 ? body.request_id.trim() : crypto.randomUUID();

    const { data: newBalance, error: consumeError } = await admin.rpc("consume_credits", {
      p_user: userId,
      p_cost: EXPRESSION_PACK_CREDIT_COST,
      p_reason: "consume_expression_pack",
      p_ref_type: "credit_request",
      p_ref_id: requestId
    });

    if (consumeError) {
      return jsonResponse({ error: "credit_check_failed" }, 500);
    }

    if (newBalance === -1) {
      return jsonResponse({ error: "insufficient_credits", message: failureMessages.insufficientCredits }, 402);
    }

    creditRef = requestId;
  } else {
    const { data: slotDecision, error: slotError } = await admin.rpc("reserve_pet_generation_slot", {
      p_user: userId,
      p_pet_id: requestedPetId
    });

    if (slotError) {
      return jsonResponse({ error: "pet_slot_check_failed" }, 500);
    }

    if (slotDecision === "slot_required") {
      return jsonResponse({ error: "pet_slot_required", message: failureMessages.petSlotRequired }, 402);
    }

    if (slotDecision === "ok_slot_bundle") {
      // Already fully paid for at slot-purchase time (grant_pet_slot) --
      // skip both generation_quota and consume_credits for this request.
      usedPetSlotBundle = true;
    } else {
      // "ok_default": either this user's first pet, or a from-photo
      // regeneration of a pet that already has a completed generation --
      // both keep going through the existing free quota allowance.
      const { data: quotaConsumed, error: quotaError } = await admin.rpc("consume_generation_quota", { p_user: userId });

      if (quotaError) {
        return jsonResponse({ error: "quota_check_failed" }, 500);
      }

      if (quotaConsumed !== true) {
        return jsonResponse({ error: "quota_exhausted", message: failureMessages.quotaExhausted }, 402);
      }
    }
  }

  // 5. Create the job row and respond immediately; run the pipeline in the background.
  // required_states is only included when GENERATION_TEST_STATES is active or
  // this is an expression pack request (requestedStates) -- otherwise the
  // column's DB default ({idle,happy,sleep}) applies unchanged. original_photo_path
  // stays null for expression pack requests; source_asset_path carries the
  // seed sprite's storage path instead (see 0003_expression_pack_source_asset.sql).
  // credit_ref carries the consume_credits idempotency key from step 4 above
  // (null for the free-quota and pet-slot-bundle paths), used to refund the
  // right ledger entry on pipeline failure -- see markJobFailed/runPipeline.
  // pet_id is requestedPetId verbatim (null for the pre-multi-pet default).
  const { data: insertedJob, error: insertError } = await admin
    .from("generation_jobs")
    .insert({
      user_id: userId,
      status: "created",
      input_snapshot: body.inputSnapshot,
      original_photo_path: isExpressionPackRequest ? null : body.originalPhotoPath,
      credit_ref: creditRef,
      pet_id: requestedPetId,
      ...(isExpressionPackRequest ? { source_asset_path: body.source_asset_path, required_states: requestedStates } : {}),
      ...(!isExpressionPackRequest && TEST_STATES_OVERRIDE ? { required_states: TEST_STATES_OVERRIDE } : {})
    })
    .select("id, user_id, status, input_snapshot, required_states, original_photo_path, source_asset_path, credit_ref, pet_id")
    .single();

  if (insertError || !insertedJob) {
    if (creditRef) {
      await admin.rpc("refund_credits", { p_user: userId, p_ref_type: "credit_request", p_ref_id: creditRef });
    } else if (usedPetSlotBundle) {
      await admin.rpc("refund_pet_generation_slot", { p_user: userId });
    } else {
      await admin.rpc("refund_generation_quota", { p_user: userId });
    }
    return jsonResponse({ error: "job_create_failed" }, 500);
  }

  const job = insertedJob as GenerationJobRow;

  // deno-lint-ignore no-explicit-any
  const runtime = (globalThis as any).EdgeRuntime;

  // openAiApiKey is only genuinely absent when DRY_RUN is active (the
  // server_misconfigured check above already guarantees that combination is
  // impossible otherwise) -- runPipeline's dryRun branches never dereference
  // it in that case, so the empty-string fallback here is unreachable in
  // practice and exists purely to satisfy the non-optional parameter type.
  const pipelinePromise = runPipeline({
    admin,
    job,
    openAiApiKey: openAiApiKey ?? "",
    imageModel,
    dryRun: DRY_RUN,
    usedPetSlotBundle
  });

  if (runtime && typeof runtime.waitUntil === "function") {
    runtime.waitUntil(pipelinePromise);
  } else {
    // Local/non-EdgeRuntime fallback: don't block the response, but don't
    // let an unhandled rejection crash the isolate either.
    pipelinePromise.catch(() => {});
  }

  return jsonResponse({ jobId: job.id }, 202);
});
