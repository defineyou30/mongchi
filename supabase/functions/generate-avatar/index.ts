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
import { type ChromaKeyOutcome } from "./chromakey.ts";
import { readOpenAiErrorDetail } from "./openAiError.ts";
import {
  applyChromaKeyToRgbaPanel,
  buildPoseSheetLayoutPrompt,
  decodePosePanelToRgba,
  encodePosePanelToPng,
  generateValidatedPosePanels,
  normalizePosePanelsForSafeAreaRgba,
  type PoseSheetKeyedRgbaPanel,
  removeSmallEdgeFragmentsRgba,
  splitPoseSheetToRgbaPanels,
  validatePoseSheetPanelsRgba,
  validatePoseSheetSourceEdgesRgba,
} from "./spriteSheet.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PetSpecies = "dog" | "cat";
type TalkingStyle = "cute" | "gentle" | "cheerful" | "comforting";

type GeneratedAssetState = string;
type EdgeRuntimeGlobal = typeof globalThis & {
  EdgeRuntime?: {
    waitUntil?: (promise: Promise<void>) => void;
  };
};

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
  inputSnapshot?: GenerationInputSnapshot;
  // Required unless source_asset_path is set (expression pack mode) -- see
  // the isExpressionPackRequest branch in the HTTP handler below.
  originalPhotoPath?: string;
  source_asset_path?: string;
  expression_pack_id?: string;
  requested_states?: string[];
  // Client-generated idempotency key persisted before upload or purchase.
  // It is required for both initial avatars and expression packs so a lost
  // HTTP response can always resolve to the already-funded job.
  request_id?: string;
  // Which of the caller's pets this request is for (see 0005_pet_namespace.sql
  // and the module doc comment above). Optional and, as of this migration,
  // never sent by any shipped client -- omitted means the pre-multi-pet
  // first/only pet. When present, must match PET_ID_PATTERN below (it's
  // used as a literal storage path segment, so it's restricted to a safe
  // charset rather than accepting arbitrary strings).
  pet_id?: string;
  resume_job_id?: string;
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
  lease_token: string;
  attempt_count: number;
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

const DEFAULT_IMAGE_QUALITY = Deno.env.get("OPENAI_IMAGE_QUALITY") ?? "low";

// Short-window burst guard, separate from generation_quota's longer-lived
// free/paid allowance -- see supabase/migrations/0002_rate_limit.sql. Caps a
// single user to RATE_LIMIT_MAX_ATTEMPTS generate-avatar calls per
// RATE_LIMIT_WINDOW_SECONDS, checked before quota is consumed so a
// rate-limited request never spends a quota unit it can't use.
const RATE_LIMIT_WINDOW_SECONDS = 300;
const RATE_LIMIT_MAX_ATTEMPTS = 3;
const GENERATION_MAINTENANCE_MODE = /^(1|true|yes)$/i.test(
  Deno.env.get("GENERATION_MAINTENANCE_MODE") ?? ""
);
const MAX_GENERATION_ATTEMPTS = 3;
const MAX_POSE_SHEET_LAYOUT_ATTEMPTS = 2;

// Pre-launch tuning aid: upload the raw sheet PNG from any attempt that fails
// layout validation (source_edge_clipping etc.) so a production failure can
// be inspected visually instead of guessing from the failure string alone.
// Defaults ON (unset means enabled) -- set GENERATION_DEBUG_SHEET_UPLOAD to
// "0"/"false"/"no" to disable. TODO(launch): turn this off before launch
// (see docs/launch-plan.md) once layout failures are no longer being tuned.
const DEBUG_SHEET_UPLOAD_ENABLED = !/^(0|false|no)$/i.test(
  Deno.env.get("GENERATION_DEBUG_SHEET_UPLOAD") ?? ""
);

// Server-authoritative expression pack cost in credit_wallets credits (see
// supabase/migrations/0004_credit_ledger.sql). Deliberately a server
// constant, not read from the request body -- the client's credit_reason is
// never trusted for pricing (see docs/credit-phase1-design.md §4.1), so a
// tampered request can't buy a paid generation for less than this.
const EXPRESSION_PACK_CREDIT_COST = 12;
const STARTER_CREDIT_GRANT = 5;

// Every generation is one fixed three-slot sheet. Expression packs must match
// one server-owned three-state bundle exactly; clients cannot change its size,
// order, or price by padding requested_states.
const MAX_EXPRESSION_PACK_STATES = 3;

const EXPRESSION_PACKS = [
  { id: "pack-everyday-moments", states: ["curious", "play", "hungry"] },
  { id: "pack-care-reactions", states: ["treat_reaction", "walk_return", "chat_portrait"] },
  { id: "pack-special-days", states: ["celebrate", "garden_help", "seasonal"] },
  { id: "pack-tender-care", states: ["sad", "sick", "messy"] }
] as const;

const getServerExpressionPack = (packId: string) => EXPRESSION_PACKS.find((pack) => pack.id === packId) ?? null;

const sameStringArray = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

// Charset for an incoming pet_id (see the GenerateAvatarRequestBody.pet_id
// doc comment above). This is used verbatim as a storage path segment
// (avatars/{userId}/{petId}/...), so it's restricted to a safe, boring
// charset rather than accepting arbitrary strings -- in particular no "/" or
// "..", which would otherwise let a crafted pet_id escape the intended
// per-pet storage prefix.
const PET_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

// Per-OpenAI-call abort timeout. Chosen so that safety check (1 call) +
// one three-pose sheet generation call + upload can all fail fast enough to
// leave room within the platform's 400s Edge Function wall-clock limit for markJobFailed +
// refund_generation_quota to complete:
//   safety check   <= 150s
//   generation     <= 150s (one sheet call)
//   upload+misc    ~50s budget (storage + DB writes, not OpenAI-bounded)
//   failure/refund margin ~50s
//   150 + 150 + 50 + 50 = 400s ceiling, ~200s in the common/success case.
const OPENAI_CALL_TIMEOUT_MS = 150_000;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const MIN_ASSET_SIDE_PX = 128;

// ---------------------------------------------------------------------------
// DRY RUN mode
//
// Bypasses only the two paid OpenAI calls (safety classification + pose-sheet
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
// full required_states set. The sheet contract requires exactly three distinct
// known states, so legacy one-state overrides are ignored and fall back to the
// DB default. This remains a QA-only override and must be unset for production.
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

  const known = [...new Set(requested.filter((state) => KNOWN_ASSET_STATES.includes(state)))];

  return known.length === MAX_EXPRESSION_PACK_STATES ? known : null;
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

class LeaseLostError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeaseLostError";
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
  // Geometry (size, centering, baseline) is owned entirely by the sprite
  // sheet layout prompt (see buildPoseSheetLayoutPrompt in spriteSheet.ts) --
  // this line used to also claim "occupying about 75% of the square canvas
  // height", which contradicted the sheet's bottom-baseline/top-margin
  // layout and gave the model two conflicting size instructions.
  "Style contract: cute 2D low-resolution pixel-art sprite, chunky readable silhouette, thick dark 1-2px outline, limited 16-24 color palette, flat cel shading, crisp stepped pixel edges.",
  "Avoid photorealism, soft painterly shading, gradient fur, pure retro 8-bit or blocky low-res mush (this is a clean 16-24 color cel-shaded sprite, not chunky 8-bit), flat vector mascot styling, clay or plastic 3D rendering, extra animals, scenery, floor, shadow, frame, text, watermark, speech bubble, duplicate subject, source-photo fragment.",
  // Chroma-key contract: background=transparent (both the FormData field and
  // prompt-only instructions) does not reliably work on /images/edits with
  // gpt-image-1 or gpt-image-1.5 — the model paints a background regardless.
  // Instead we force a uniform pure-green canvas here and key it out in
  // postprocessing (see applyChromaKeyToRgbaPanel in spriteSheet.ts, which
  // wraps chromakey.ts's applyChromaKey). Verified: border pixels come back
  // within +/-3 of the requested green, which is uniform enough for a clean
  // distance-based key.
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
    const detail = await readOpenAiErrorDetail(response);
    console.error("[generate-avatar] OpenAI safety request failed", { detail, status: response.status });
    throw new HttpStatusError(
      `OpenAI source photo safety request failed with status ${response.status}.`,
      response.status
    );
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

const buildPoseSheetPrompt = (input: {
  states: readonly GeneratedAssetState[];
  species: PetSpecies;
  petName?: string;
  personalityTags?: string[];
  talkingStyle?: TalkingStyle;
  promptMode: "photo" | "expression_pack";
}): string =>
  [
    input.promptMode === "expression_pack"
      ? "Use the provided pixel-art Mongchi sprite as the canonical identity and style reference for one additional three-pose pack."
      : "Use the provided dog or cat photo as the identity reference, but transform only the main pet into one consistent Mongchi companion.",
    input.promptMode === "expression_pack"
      ? `Same exact ${input.species} character, same palette, outline thickness, pixel density, scale, body proportions, markings, and bottom paw/contact anchor as the input sprite.`
      : "Ignore and remove the source photo background, furniture, scenery, lighting, people, duplicate animals, and loose props.",
    `Pet species: ${input.species}.`,
    ...(input.petName ? [`Pet name for personality only, do not render text: ${input.petName}.`] : []),
    `Personality tags: ${(input.personalityTags ?? []).join(", ") || "gentle"}.`,
    `Talking style: ${input.talkingStyle ?? "gentle"}.`,
    buildPoseSheetLayoutPrompt(
      input.states.map((state) => ({ state, pose: statePosePrompts[state] ?? statePosePrompts.idle }))
    ),
    ...(input.promptMode === "photo" ? contractPromptLines : contractPromptLines.slice(2)),
    "App integration contract: exactly three complete pets total, one per slot, generous padding, no text, no UI, no watermark, no frame, no scenery, no full floor, and no detached props except a tiny attached state cue when explicitly allowed.",
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

const generatePoseSheet = async (input: {
  apiKey: string;
  model: string;
  sourceImageBytes: Uint8Array;
  sourceContentType: string;
  states: readonly GeneratedAssetState[];
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

  formData.append(
    "image",
    new Blob([toArrayBufferBytes(input.sourceImageBytes)], { type: input.sourceContentType }),
    `source.${sourceFileExtensionFor(input.sourceContentType)}`
  );
  formData.append("model", input.model);
  formData.append(
    "prompt",
    buildPoseSheetPrompt({
      states: input.states,
      species: input.species,
      petName: input.petName,
      personalityTags: input.personalityTags,
      talkingStyle: input.talkingStyle,
      promptMode: input.promptMode ?? "photo"
    })
  );
  formData.append("n", "1");
  formData.append("size", "1536x1024");
  formData.append("input_fidelity", "high");
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
    const detail = await readOpenAiErrorDetail(response);
    console.error("[generate-avatar] OpenAI image request failed", { detail, status: response.status });
    throw new HttpStatusError(
      `OpenAI image provider request failed with status ${response.status}.`,
      response.status
    );
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
  job: GenerationJobRow,
  patch: Record<string, unknown>
): Promise<void> => {
  const status = patch.status;

  if (typeof status !== "string") {
    throw new Error("Generation status update requires a status.");
  }

  const { data, error } = await admin.rpc("advance_generation_job", {
    p_job_id: job.id,
    p_lease_token: job.lease_token,
    p_status: status,
    p_quality: patch.quality ?? null
  });

  if (error || data !== true) {
    throw new Error(`Generation job lease was lost while advancing to ${status}: ${error?.message ?? "not updated"}`);
  }
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
  job: GenerationJobRow,
  failureCode: string,
  failureMessageSafe: string,
  diagnostics?: JobFailureDiagnostics
): Promise<void> => {
  const quality = diagnostics
    ? {
      failedStage: diagnostics.failedStage,
      ...(diagnostics.internalError ? { internalError: diagnostics.internalError } : {}),
      ...(diagnostics.httpStatus !== undefined ? { httpStatus: diagnostics.httpStatus } : {})
    }
    : null;

  console.error("[generate-avatar] job failed", {
    jobId: job.id,
    failureCode,
    ...(diagnostics?.failedStage ? { failedStage: diagnostics.failedStage } : {}),
    ...(diagnostics?.internalError ? { internalError: diagnostics.internalError } : {}),
    ...(diagnostics?.httpStatus !== undefined ? { httpStatus: diagnostics.httpStatus } : {})
  });

  const { data, error } = await admin.rpc("fail_generation_job", {
    p_job_id: job.id,
    p_lease_token: job.lease_token,
    p_failure_code: failureCode,
    p_failure_message_safe: failureMessageSafe,
    p_quality: quality
  });

  if (error || (data !== "failed" && data !== "cleanup_pending" && data !== "already_failed" && data !== "already_completed")) {
    throw new Error(`Generation job failure/refund was not committed: ${error?.message ?? String(data)}`);
  }

  if (data === "cleanup_pending" && job.original_photo_path) {
    await finalizeSourceCleanup(admin, job, job.original_photo_path);
  }
};

const finalizeSourceCleanup = async (
  admin: SupabaseClient,
  job: GenerationJobRow,
  originalPhotoPath: string
): Promise<boolean> => {
  let removal: Awaited<ReturnType<ReturnType<SupabaseClient["storage"]["from"]>["remove"]>>;

  try {
    removal = await admin.storage.from(BUCKET).remove([originalPhotoPath]);
  } catch (cause) {
    console.error("[generate-avatar] source cleanup threw", {
      jobId: job.id,
      error: cause instanceof Error ? cause.message : String(cause)
    });
    return false;
  }

  if (removal.error) {
    console.error("[generate-avatar] source cleanup failed", {
      jobId: job.id,
      error: removal.error.message
    });
    return false;
  }

  const { data: finalized, error: finalizeError } = await admin.rpc("finalize_generation_source_cleanup", {
    p_job_id: job.id,
    p_lease_token: job.lease_token
  });

  if (finalizeError || finalized !== true) {
    console.error("[generate-avatar] source cleanup finalization failed", {
      jobId: job.id,
      error: finalizeError?.message ?? "lease lost"
    });
    return false;
  }

  return true;
};

const cleanupSupersededAttemptAssets = async (
  admin: SupabaseClient,
  job: GenerationJobRow
): Promise<void> => {
  const jobPrefix = job.pet_id
    ? `avatars/${job.user_id}/${job.pet_id}/${job.id}`
    : `avatars/${job.user_id}/${job.id}`;

  try {
    const listedAttempts = await admin.storage.from(BUCKET).list(jobPrefix, { limit: 20 });

    if (listedAttempts.error) {
      console.error("[generate-avatar] stale attempt listing failed", {
        jobId: job.id,
        error: listedAttempts.error.message
      });
      return;
    }

    for (const attempt of listedAttempts.data ?? []) {
      if (!UUID_PATTERN.test(attempt.name) || attempt.name === job.lease_token) {
        continue;
      }

      const attemptPrefix = `${jobPrefix}/${attempt.name}`;
      const listedAssets = await admin.storage.from(BUCKET).list(attemptPrefix, { limit: 20 });

      if (listedAssets.error) {
        console.error("[generate-avatar] stale attempt asset listing failed", {
          jobId: job.id,
          attemptToken: attempt.name,
          error: listedAssets.error.message
        });
        continue;
      }

      const stalePaths = (listedAssets.data ?? [])
        .filter((asset) => asset.name.endsWith(".png"))
        .map((asset) => `${attemptPrefix}/${asset.name}`);

      if (stalePaths.length === 0) {
        continue;
      }

      const removal = await admin.storage.from(BUCKET).remove(stalePaths);

      if (removal.error) {
        console.error("[generate-avatar] stale attempt cleanup failed", {
          jobId: job.id,
          attemptToken: attempt.name,
          error: removal.error.message
        });
      }
    }
  } catch (cause) {
    console.error("[generate-avatar] stale attempt cleanup threw", {
      jobId: job.id,
      error: cause instanceof Error ? cause.message : String(cause)
    });
  }
};

// Best-effort upload of one attempt's raw sheet PNG bytes, exactly as
// received from OpenAI (no re-encode), for offline inspection after a
// layout-validation failure. Gated by DEBUG_SHEET_UPLOAD_ENABLED (see above)
// and never allowed to affect the pipeline outcome -- an upload failure here
// is logged and swallowed, not thrown, since this is a diagnostics-only aid.
const uploadDebugAttemptSheet = async (
  admin: SupabaseClient,
  job: GenerationJobRow,
  attemptIndex: number,
  sheetBytes: Uint8Array
): Promise<void> => {
  if (!DEBUG_SHEET_UPLOAD_ENABLED) {
    return;
  }

  try {
    const path = `debug-sheets/${job.id}/attempt-${attemptIndex}.png`;
    const upload = await admin.storage.from(BUCKET).upload(path, sheetBytes, {
      contentType: "image/png",
      upsert: true
    });

    if (upload.error) {
      console.error("[generate-avatar] debug sheet upload failed", {
        jobId: job.id,
        attemptIndex,
        error: upload.error.message
      });
    }
  } catch (cause) {
    console.error("[generate-avatar] debug sheet upload threw", {
      jobId: job.id,
      attemptIndex,
      error: cause instanceof Error ? cause.message : String(cause)
    });
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
}): Promise<void> => {
  const { admin, job, openAiApiKey, imageModel, dryRun } = input;
  const originalPhotoPath = job.original_photo_path;
  const sourceAssetPath = job.source_asset_path;

  // Expression pack mode: source_asset_path is set (and original_photo_path
  // stays null -- see 0003_expression_pack_source_asset.sql). There is no
  // source photo to run through safety classification or to delete for
  // privacy afterwards; the seed is one of our own previously generated
  // sprites instead.
  const isExpressionPackMode = Boolean(sourceAssetPath);

  if (job.status === "cleanup_pending" && originalPhotoPath) {
    await finalizeSourceCleanup(admin, job, originalPhotoPath);
    return;
  }

  await cleanupSupersededAttemptAssets(admin, job);

  if (job.attempt_count > MAX_GENERATION_ATTEMPTS) {
    await markJobFailed(
      admin,
      job,
      "generation_attempts_exhausted",
      failureMessages.unexpected,
      { failedStage: "created", internalError: "Generation attempt limit exhausted." }
    );
    return;
  }

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
  if (!originalPhotoPath && !sourceAssetPath) {
    await markJobFailed(
      admin,
      job,
      "original_photo_missing",
      failureMessages.photoMissing,
      { failedStage: "created", internalError: "Job row has no original_photo_path or source_asset_path." }
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
        job,
        isExpressionPackMode ? "source_asset_missing" : "original_photo_missing",
        isExpressionPackMode ? failureMessages.sourceAssetMissing : failureMessages.photoMissing,
        {
          failedStage: "preprocessing",
          internalError:
            toInternalErrorMessage(download.error) ??
            (isExpressionPackMode ? "Source asset download returned no data." : "Original photo download returned no data.")
        }
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
      await updateJobStatus(admin, job, { status: "safety_checking" });

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
          job,
          "source_photo_safety_unavailable",
          failureMessages.safetyFailed,
          diagnosticsForStage("safety_checking", cause)
        );
        return;
      }

      if (safety.manualReviewRequired) {
        await markJobFailed(
          admin,
          job,
          "source_photo_manual_review_required",
          failureMessages.safetyManualReview,
          {
            failedStage: "safety_checking",
            internalError: truncateInternalError(
              `Manual review required (confidence=${safety.confidence}): ${safety.failedChecks.join(", ") || "no specific checks flagged"}.`
            )
          }
        );
        return;
      }

      if (!safety.safetyApproved) {
        await markJobFailed(
          admin,
          job,
          "source_photo_safety_failed",
          failureMessages.safetyFailed,
          {
            failedStage: "safety_checking",
            internalError: truncateInternalError(
              `Safety check rejected (confidence=${safety.confidence}): ${safety.failedChecks.join(", ") || "no specific checks flagged"}.`
            )
          }
        );
        return;
      }
    }

    await updateJobStatus(admin, job, { status: "generating" });

    const requiredStates = job.required_states.length > 0 ? job.required_states : ["idle", "happy", "sleep"];
    let generated: Array<{ state: string; result: GeneratedImageResult }>;

    // c. Generate, split, chroma-key, and fragment-filter -- all in RGBA.
    // Previously each attempt decoded/encoded the sheet and its panels
    // repeatedly (split -> PNG-encode 3 panels; edge-validation callback ->
    // decode+key+encode 3 panels, then discard; step d -> decode+key+encode
    // the same 3 panels again; normalize -> decode+encode 3 panels; final
    // quality gate -> decode 3 panels again), which routinely exceeded the
    // Edge Function's CPU time limit and left jobs stuck in "generating" when
    // the isolate was killed mid-attempt. Now: the sheet is decoded exactly
    // once (splitPoseSheetToRgbaPanels, using content-aware slot cuts -- see
    // its doc comment in spriteSheet.ts -- instead of a fixed 512/1024 split),
    // each panel is chroma-keyed exactly once per attempt
    // (applyChromaKeyToRgbaPanel) and immediately fragment-filtered
    // (removeSmallEdgeFragmentsRgba, which drops any small leftover sliver of
    // a neighboring pet that a content-aware cut left touching this panel's
    // edge), and that same keyed+filtered RGBA buffer is reused for edge
    // validation here, then for normalization and the quality gate below --
    // PNG encoding happens exactly once per panel, right before upload
    // (encodePosePanelToPng).
    let keyedPanels: PoseSheetKeyedRgbaPanel[];

    try {
      if (dryRun) {
        // DRY RUN: skip the paid OpenAI /images/edits call entirely and
        // decode the baked-in fixture PNGs instead, then run them through
        // the same chroma-key step as the real path so the rest of the
        // pipeline (normalize, quality gate, final encode) exercises its
        // real code path unchanged. A sleep stands in for real generation
        // latency so the client's polling UI (progress bar, "Creating the
        // first tiny companion" copy) still gets to render the generating
        // step for a moment rather than flashing straight through it.
        // Duration is configurable via GENERATION_DRY_RUN_DELAY_MS (see
        // DRY_RUN_DELAY_MS above) -- set it to something like 60000 to
        // rehearse the real-world client UX (background completion during
        // setup input, long polling, app-switch/return) at $0.
        await sleep(DRY_RUN_DELAY_MS);

        keyedPanels = requiredStates.map((state) =>
          removeSmallEdgeFragmentsRgba(
            applyChromaKeyToRgbaPanel(decodePosePanelToRgba(state, dryRunPngBytesForState(state)))
          )
        );
      } else {
        let attemptIndex = 0;

        keyedPanels = await generateValidatedPosePanels<PoseSheetKeyedRgbaPanel>(async () => {
          attemptIndex += 1;
          const currentAttempt = attemptIndex;

          const sheet = await generatePoseSheet({
            apiKey: openAiApiKey,
            model: imageModel,
            sourceImageBytes: sourceBytes,
            sourceContentType,
            states: requiredStates,
            species: job.input_snapshot.species,
            petName: job.input_snapshot.petName,
            personalityTags: job.input_snapshot.personalityTags,
            talkingStyle: job.input_snapshot.talkingStyle,
            promptMode: isExpressionPackMode ? "expression_pack" : "photo"
          });

          const panels = splitPoseSheetToRgbaPanels(sheet.bytes, requiredStates)
            .map(applyChromaKeyToRgbaPanel)
            .map(removeSmallEdgeFragmentsRgba);

          // Debug aid (see uploadDebugAttemptSheet/DEBUG_SHEET_UPLOAD_ENABLED
          // above): upload this attempt's raw sheet bytes whenever its layout
          // fails, so a repeated production failure can be inspected visually
          // instead of only through the failure string. This re-runs the same
          // (cheap, border-only) edge scan that generateValidatedPosePanels
          // performs again just below via its own validatePanels argument --
          // duplicating that scan is negligible next to the decode/key/encode
          // work already done once per attempt.
          if (!validatePoseSheetSourceEdgesRgba(panels).valid) {
            await uploadDebugAttemptSheet(admin, job, currentAttempt, sheet.bytes);
          }

          return panels;
        }, MAX_POSE_SHEET_LAYOUT_ATTEMPTS, validatePoseSheetSourceEdgesRgba);
      }
    } catch (cause) {
      await markJobFailed(
        admin,
        job,
        "generation_failed",
        failureMessages.generationFailed,
        diagnosticsForStage("generating", cause)
      );
      return;
    }

    // d. Batch safe-area normalization, still in RGBA. Chroma-keying already
    // ran exactly once per panel above (inside the generation/validation
    // loop), so it must not run again here -- chromaKeyTags is read off the
    // already-tagged panels instead of re-keying. Normalization runs across
    // all three panels at once (not per-panel) so the whole bundle shares
    // one scale -- see normalizePosePanelsForSafeAreaRgba in spriteSheet.ts
    // for why per-panel scaling would break relative size between states
    // (e.g. a curled-up sleep pose vs. a standing one).
    const chromaKeyTags: Record<string, ChromaKeyOutcome["quality"]> = {};

    for (const panel of keyedPanels) {
      chromaKeyTags[panel.state] = panel.chromaKeyQuality;
    }

    const normalizedPanels = normalizePosePanelsForSafeAreaRgba(keyedPanels);

    // e. Lightweight quality gate, run against the post-chroma-key RGBA
    // panels, followed by the one-and-only PNG encode of this attempt.
    await updateJobStatus(admin, job, { status: "quality_checking" });

    const poseValidation = validatePoseSheetPanelsRgba(normalizedPanels);

    if (!poseValidation.valid) {
      await markJobFailed(
        admin,
        job,
        "generated_asset_quality_failed",
        failureMessages.qualityFailed,
        {
          failedStage: "quality_checking",
          internalError: truncateInternalError(
            `Pose sheet quality failed after chroma key: ${poseValidation.failures.join(", ")}; chroma=${JSON.stringify(chromaKeyTags)}`
          )
        }
      );
      return;
    }

    // The only PNG encode for this attempt: once per panel, right before the
    // dimension/signature quality gate and upload below.
    generated = normalizedPanels.map((panel) => {
      const encoded = encodePosePanelToPng(panel);

      return { state: panel.state, result: { bytes: encoded.bytes, width: encoded.width, height: encoded.height } };
    });

    const failedStates = generated.filter(({ result }) => !passesLightweightQualityGate(result));

    if (failedStates.length > 0) {
      await markJobFailed(
        admin,
        job,
        "generated_asset_quality_failed",
        failureMessages.qualityFailed,
        {
          failedStage: "quality_checking",
          internalError: truncateInternalError(
            `Quality gate failed for states: ${failedStates.map(({ state }) => state).join(", ")}.`
          )
        }
      );
      return;
    }

    // f. Upload assets.
    await updateJobStatus(admin, job, { status: "uploading_assets" });

    const unlockedAt = new Date().toISOString();

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
          ? `avatars/${job.user_id}/${job.pet_id}/${job.id}/${job.lease_token}/${state}.png`
          : `avatars/${job.user_id}/${job.id}/${job.lease_token}/${state}.png`;
        const contentHash = `sha256:${await sha256Hex(result.bytes)}`;

        const upload = await admin.storage.from(BUCKET).upload(storagePath, result.bytes, {
          contentType: "image/png",
          upsert: false
        });

        if (upload.error) {
          throw new Error(`Asset upload failed for state "${state}": ${upload.error.message}`);
        }

        const { data: recorded, error: recordError } = await admin.rpc("record_generation_asset", {
          p_job_id: job.id,
          p_lease_token: job.lease_token,
          p_state: state,
          p_storage_path: storagePath,
          p_width: result.width,
          p_height: result.height,
          p_content_hash: contentHash,
          p_unlocked_at: isExpressionPackMode || state === "idle" ? unlockedAt : null
        });

        if (recordError) {
          throw new Error(`Asset record insert failed for state "${state}": ${recordError.message}`);
        }

        if (recorded !== true) {
          await admin.storage.from(BUCKET).remove([storagePath]);
          throw new LeaseLostError(`Generation lease expired before publishing state "${state}".`);
        }
      }
    } catch (cause) {
      if (cause instanceof LeaseLostError) {
        return;
      }

      await markJobFailed(
        admin,
        job,
        "asset_upload_failed",
        failureMessages.uploadFailed,
        diagnosticsForStage("uploading_assets", cause)
      );
      return;
    }

    const completionQuality = {
        qualityStatus: "passed",
        failedChecks: [],
        manualReviewRequired: false,
        retryRecommended: false,
        chromaKey: chromaKeyTags
      };
    const { data: completed, error: completionError } = await admin.rpc("complete_generation_job", {
      p_job_id: job.id,
      p_lease_token: job.lease_token,
      p_quality: completionQuality
    });

    if (completionError || completed !== true) {
      const completionRecovery = await admin
        .from("generation_jobs")
        .select("status, cleanup_target_status")
        .eq("id", job.id)
        .maybeSingle();

      if (completionRecovery.error) {
        console.error("[generate-avatar] completion recovery lookup failed", {
          jobId: job.id,
          error: completionRecovery.error.message
        });
        throw new Error(`Generation completion was not committed: ${completionError?.message ?? "not completed"}`);
      }

      const completionWasCommitted =
        completionRecovery.data?.status === "completed" ||
        (completionRecovery.data?.status === "cleanup_pending" && completionRecovery.data.cleanup_target_status === "completed");

      if (!completionWasCommitted) {
        throw new Error(`Generation completion was not committed: ${completionError?.message ?? "not completed"}`);
      }
    }

    if (!isExpressionPackMode) {
      const { error: starterGrantError } = await admin.rpc("grant_credits", {
        p_user: job.user_id,
        p_amount: STARTER_CREDIT_GRANT,
        p_reason: "grant_starter",
        p_ref_type: "user",
        p_ref_id: "starter_v1",
        p_metadata: { source: "initial_avatar_generation", job_id: job.id }
      });

      if (starterGrantError) {
        console.error("[generate-avatar] starter credit grant failed", {
          jobId: job.id,
          error: starterGrantError.message
        });
      }
    }

    if (!isExpressionPackMode && originalPhotoPath) {
      try {
        await finalizeSourceCleanup(admin, job, originalPhotoPath);
      } catch (cause) {
        console.error("[generate-avatar] source cleanup scheduling failed", {
          jobId: job.id,
          error: cause instanceof Error ? cause.message : String(cause)
        });
      }
    }
  } catch (cause) {
    if (cause instanceof LeaseLostError) {
      return;
    }

    await markJobFailed(
      admin,
      job,
      "unexpected_pipeline_error",
      failureMessages.unexpected,
      diagnosticsForStage("unexpected", cause)
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const claimGenerationJob = async (
  admin: SupabaseClient,
  userId: string,
  jobId: string
): Promise<GenerationJobRow | null> => {
  const { data, error } = await admin.rpc("claim_generation_job", {
    p_user: userId,
    p_job_id: jobId,
    p_lease_seconds: 420,
    p_max_attempts: MAX_GENERATION_ATTEMPTS
  });

  if (error) {
    throw new Error(`Generation job claim failed: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    return null;
  }

  if (
    typeof row.job_id !== "string" ||
    typeof row.user_id !== "string" ||
    typeof row.lease_token !== "string" ||
    !Array.isArray(row.required_states)
  ) {
    throw new Error("Generation job claim returned an invalid row.");
  }

  return {
    id: row.job_id,
    user_id: row.user_id,
    status: String(row.status),
    input_snapshot: row.input_snapshot as GenerationInputSnapshot,
    required_states: row.required_states.map(String),
    original_photo_path: typeof row.original_photo_path === "string" ? row.original_photo_path : null,
    source_asset_path: typeof row.source_asset_path === "string" ? row.source_asset_path : null,
    credit_ref: typeof row.credit_ref === "string" ? row.credit_ref : null,
    pet_id: typeof row.pet_id === "string" ? row.pet_id : null,
    lease_token: row.lease_token,
    attempt_count: typeof row.attempt_count === "number" ? row.attempt_count : 0
  };
};

const scheduleGenerationPipeline = (input: Parameters<typeof runPipeline>[0]): void => {
  const pipelinePromise = runPipeline(input);
  const runtime = (globalThis as EdgeRuntimeGlobal).EdgeRuntime;

  if (runtime && typeof runtime.waitUntil === "function") {
    runtime.waitUntil(pipelinePromise);
    return;
  }

  pipelinePromise.catch((cause) => {
    console.error("[generate-avatar] detached pipeline rejected", {
      jobId: input.job.id,
      error: cause instanceof Error ? cause.message : String(cause)
    });
  });
};

const removeUnclaimedSourcePhoto = async (
  admin: SupabaseClient,
  userId: string,
  originalPhotoPath: string,
  reason: string
): Promise<void> => {
  try {
    const { data: owningJob, error: ownershipError } = await admin
      .from("generation_jobs")
      .select("id")
      .eq("user_id", userId)
      .eq("original_photo_path", originalPhotoPath)
      .neq("status", "failed")
      .limit(1)
      .maybeSingle();

    if (ownershipError) {
      console.error("[generate-avatar] unclaimed source ownership check failed", {
        path: originalPhotoPath,
        reason,
        error: ownershipError.message
      });
      return;
    }

    if (owningJob) {
      return;
    }

    const removal = await admin.storage.from(BUCKET).remove([originalPhotoPath]);

    if (removal.error) {
      console.error("[generate-avatar] unclaimed source cleanup failed", {
        path: originalPhotoPath,
        reason,
        error: removal.error.message
      });
    }
  } catch (cause) {
    console.error("[generate-avatar] unclaimed source cleanup threw", {
      path: originalPhotoPath,
      reason,
      error: cause instanceof Error ? cause.message : String(cause)
    });
  }
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
  const imageModel = Deno.env.get("OPENAI_IMAGE_MODEL") ?? DEFAULT_IMAGE_MODEL;
  // Reinstall-abuse backstop secret (see
  // supabase/migrations/0028_generation_ip_throttle.sql). Unset in an
  // environment means the IP throttle check below is skipped entirely.
  const generationIpSalt = Deno.env.get("GENERATION_IP_SALT");

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

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  if (body.resume_job_id !== undefined) {
    if (typeof body.resume_job_id !== "string" || !UUID_PATTERN.test(body.resume_job_id)) {
      return jsonResponse({ error: "invalid_request" }, 400);
    }

    try {
      const resumedJob = await claimGenerationJob(admin, userId, body.resume_job_id);

      if (resumedJob) {
        scheduleGenerationPipeline({
          admin,
          job: resumedJob,
          openAiApiKey: openAiApiKey ?? "",
          imageModel,
          dryRun: DRY_RUN
        });
      }

      return jsonResponse({ jobId: body.resume_job_id }, 202);
    } catch (cause) {
      console.error("[generate-avatar] resume failed", {
        jobId: body.resume_job_id,
        error: cause instanceof Error ? cause.message : String(cause)
      });
      return jsonResponse({ error: "job_resume_failed" }, 500);
    }
  }

  if (GENERATION_MAINTENANCE_MODE) {
    const maintenanceOriginalPhotoPath =
      typeof body.originalPhotoPath === "string" && body.originalPhotoPath.startsWith(`original-photos/${userId}/`)
        ? body.originalPhotoPath.trim()
        : null;

    if (maintenanceOriginalPhotoPath) {
      await removeUnclaimedSourcePhoto(admin, userId, maintenanceOriginalPhotoPath, "maintenance");
    }

    return jsonResponse(
      { error: "generation_maintenance" },
      503,
      { "Retry-After": "60" }
    );
  }

  if (!isValidInputSnapshot(body.inputSnapshot)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  if (typeof body.request_id !== "string" || body.request_id.trim().length === 0 || body.request_id.length > 128) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  const requestId = body.request_id.trim();

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

  if (!isExpressionPackRequest && typeof body.originalPhotoPath === "string" && !body.originalPhotoPath.startsWith(`original-photos/${userId}/`)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  const ordinaryOriginalPhotoPath = isExpressionPackRequest ? null : body.originalPhotoPath?.trim() ?? null;

  // service_role client for privileged writes (quota, job rows, storage) --
  // created here (rather than further down) because the expression pack
  // pet-ownership check right below needs it.
  let requestedStates: string[] = [];
  let expressionPackRequestId: string | null = null;
  let expressionPackSourceAssetPath: string | null = null;
  let expressionPackId: string | null = null;

  if (isExpressionPackRequest) {
    if (
      !Array.isArray(body.requested_states) ||
      body.requested_states.length === 0 ||
      !body.requested_states.every((state) => typeof state === "string" && KNOWN_ASSET_STATES.includes(state)) ||
      typeof body.expression_pack_id !== "string" ||
      body.expression_pack_id.trim().length === 0
    ) {
      return jsonResponse({ error: "invalid_request" }, 400);
    }

    const sourceAssetPath = body.source_asset_path ?? "";
    expressionPackSourceAssetPath = sourceAssetPath;
    const expressionPack = getServerExpressionPack(body.expression_pack_id.trim());

    if (!expressionPack) {
      return jsonResponse({ error: "invalid_request" }, 400);
    }

    // Dedup before enforcing the hard cap so a padded/repeated array (e.g.
    // hundreds of 'happy' entries) can't smuggle amplified generation work
    // through the length check below -- see MAX_EXPRESSION_PACK_STATES.
    const dedupedStates = Array.from(new Set(body.requested_states));

    if (
      dedupedStates.length === 0 ||
      dedupedStates.length > MAX_EXPRESSION_PACK_STATES ||
      !sameStringArray(dedupedStates, expressionPack.states)
    ) {
      return jsonResponse({ error: "invalid_request" }, 400);
    }

    requestedStates = [...expressionPack.states];
    expressionPackRequestId = requestId;
    expressionPackId = expressionPack.id;

    // Ownership check: the Edge Function runs with the service_role key
    // (bypasses RLS) and downloads whatever path it's given, so an
    // unscoped source_asset_path would let one user seed a generation from
    // another user's generated_assets storage path. Mirrors the
    // avatars/{user_id}/{job_id}/{state}.png (or, pet-namespaced,
    // avatars/{user_id}/{pet_id}/{job_id}/{state}.png) layout this same
    // function writes to on upload (see the "f. Upload assets" step below).
    if (!sourceAssetPath.startsWith(`avatars/${userId}/`)) {
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
      .select("id, job_id")
      .eq("user_id", userId)
      .eq("storage_path", sourceAssetPath)
      .eq("state", "idle")
      .not("unlocked_at", "is", null);
    seedOwnershipQuery =
      requestedPetId === null ? seedOwnershipQuery.is("pet_id", null) : seedOwnershipQuery.eq("pet_id", requestedPetId);

    const { data: seedAssetRow, error: seedAssetError } = await seedOwnershipQuery.maybeSingle();

    if (seedAssetError) {
      return jsonResponse({ error: "source_asset_check_failed" }, 500);
    }

    if (!seedAssetRow) {
      return jsonResponse({ error: "invalid_request" }, 400);
    }

    const { data: seedJobRow, error: seedJobError } = await admin
      .from("generation_jobs")
      .select("status, source_asset_path")
      .eq("id", (seedAssetRow as { job_id: string }).job_id)
      .eq("user_id", userId)
      .single();

    if (seedJobError) {
      return jsonResponse({ error: "source_asset_check_failed" }, 500);
    }

    if (!seedJobRow || seedJobRow.status !== "completed" || seedJobRow.source_asset_path !== null) {
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
    if (ordinaryOriginalPhotoPath) {
      await removeUnclaimedSourcePhoto(admin, userId, ordinaryOriginalPhotoPath, "rate_limited");
    }
    return jsonResponse({ error: "rate_limited" }, 429, { "Retry-After": String(RATE_LIMIT_WINDOW_SECONDS) });
  }

  // 3b. IP throttle: a coarse backstop against reinstall abuse (delete app ->
  // fresh anonymous account -> starter credits/free quota reset -- see
  // supabase/migrations/0028_generation_ip_throttle.sql). Distinct from the
  // per-user rate limit above: this caps how many *new* generations can
  // start from one network address per day, so cycling through anonymous
  // accounts on the same device/network eventually hits this cap even
  // though each fresh account's own quota looks untouched. Only the first
  // hop of x-forwarded-for is used (the client-facing edge, not a
  // downstream proxy hop a client could otherwise spoof to pick a
  // different bucket) and it is hashed with a server-only salt before ever
  // touching storage or logs -- the raw IP is never persisted or logged.
  // GENERATION_IP_SALT unset skips this check entirely (fails open on a
  // missing secret rather than blocking every generation); see this
  // migration's deploy notes for provisioning the secret.
  if (generationIpSalt) {
    const forwardedFor = req.headers.get("x-forwarded-for") ?? "";
    const callerIp = forwardedFor.split(",")[0]?.trim() ?? "";

    if (callerIp) {
      const ipHash = await sha256Hex(new TextEncoder().encode(`${generationIpSalt}:${callerIp}`));
      const { data: ipThrottleResult, error: ipThrottleError } = await admin.rpc("register_generation_start_for_ip", {
        p_ip_hash: ipHash
      });

      if (ipThrottleError) {
        // Fails open -- same reasoning as the per-user rate limit's
        // RPC-error branch above. This is a defense-in-depth backstop, not
        // the primary guard, so its own unavailability should never block
        // every generation.
        console.warn("[generate-avatar] ip throttle check failed, failing open:", ipThrottleError.message);
      } else if ((ipThrottleResult as { outcome?: string } | null)?.outcome === "throttled") {
        if (ordinaryOriginalPhotoPath) {
          await removeUnclaimedSourcePhoto(admin, userId, ordinaryOriginalPhotoPath, "ip_throttled");
        }
        return jsonResponse({ error: "quota_exhausted", message: failureMessages.quotaExhausted }, 402);
      }
    }
  }

  let jobId: string;

  if (isExpressionPackRequest && expressionPackRequestId && expressionPackSourceAssetPath && expressionPackId) {
    const { data: atomicResult, error: atomicError } = await admin.rpc("create_expression_pack_job", {
      p_user: userId,
      p_cost: EXPRESSION_PACK_CREDIT_COST,
      p_request_id: expressionPackRequestId,
      p_product_key: expressionPackId,
      p_input_snapshot: body.inputSnapshot,
      p_source_asset_path: expressionPackSourceAssetPath,
      p_required_states: requestedStates,
      p_pet_id: requestedPetId
    });

    if (atomicError) {
      return jsonResponse({ error: "job_create_failed" }, 500);
    }

    const atomicRow = Array.isArray(atomicResult) ? atomicResult[0] : atomicResult;

    if (!atomicRow || typeof atomicRow !== "object" || typeof atomicRow.outcome !== "string") {
      return jsonResponse({ error: "job_create_failed" }, 500);
    }

    if (atomicRow.outcome === "insufficient_credits") {
      return jsonResponse({ error: "insufficient_credits", message: failureMessages.insufficientCredits }, 402);
    }

    if (atomicRow.outcome === "conflict" || atomicRow.outcome === "refunded_request") {
      return jsonResponse({ error: "idempotency_conflict" }, 409);
    }

    if ((atomicRow.outcome !== "created" && atomicRow.outcome !== "existing") || typeof atomicRow.job_id !== "string") {
      return jsonResponse({ error: "job_create_failed" }, 500);
    }

    jobId = atomicRow.job_id;
  } else {
    const originalPhotoPath = ordinaryOriginalPhotoPath ?? "";
    const { data: createResult, error: createError } = await admin.rpc("create_generation_job", {
      p_user: userId,
      p_request_id: requestId,
      p_input_snapshot: body.inputSnapshot,
      p_original_photo_path: originalPhotoPath,
      p_pet_id: requestedPetId,
      p_required_states: TEST_STATES_OVERRIDE ?? ["idle", "happy", "sleep"]
    });

    if (createError) {
      await removeUnclaimedSourcePhoto(admin, userId, originalPhotoPath, "job_create_failed");
      return jsonResponse({ error: "job_create_failed" }, 500);
    }

    const createRow = Array.isArray(createResult) ? createResult[0] : createResult;

    if (!createRow || typeof createRow.outcome !== "string") {
      await removeUnclaimedSourcePhoto(admin, userId, originalPhotoPath, "job_create_response_invalid");
      return jsonResponse({ error: "job_create_failed" }, 500);
    }

    if (createRow.outcome === "pet_slot_required") {
      await removeUnclaimedSourcePhoto(admin, userId, originalPhotoPath, "pet_slot_required");
      return jsonResponse({ error: "pet_slot_required", message: failureMessages.petSlotRequired }, 402);
    }

    if (createRow.outcome === "quota_exhausted") {
      await removeUnclaimedSourcePhoto(admin, userId, originalPhotoPath, "quota_exhausted");
      return jsonResponse({ error: "quota_exhausted", message: failureMessages.quotaExhausted }, 402);
    }

    if (createRow.outcome === "conflict" || createRow.outcome === "refunded_request") {
      await removeUnclaimedSourcePhoto(admin, userId, originalPhotoPath, createRow.outcome);
      return jsonResponse({ error: "idempotency_conflict" }, 409);
    }

    if ((createRow.outcome !== "created" && createRow.outcome !== "existing") || typeof createRow.job_id !== "string") {
      await removeUnclaimedSourcePhoto(admin, userId, originalPhotoPath, "job_create_outcome_invalid");
      return jsonResponse({ error: "job_create_failed" }, 500);
    }

    if (
      createRow.outcome === "existing" &&
      typeof createRow.stored_original_photo_path === "string" &&
      createRow.stored_original_photo_path !== originalPhotoPath
    ) {
      const redundantUploadRemoval = await admin.storage.from(BUCKET).remove([originalPhotoPath]);

      if (redundantUploadRemoval.error) {
        console.error("[generate-avatar] redundant retry upload cleanup failed", {
          jobId: createRow.job_id,
          error: redundantUploadRemoval.error.message
        });
      }
    }

    jobId = createRow.job_id;
  }

  try {
    const claimedJob = await claimGenerationJob(admin, userId, jobId);

    if (claimedJob) {
      scheduleGenerationPipeline({
        admin,
        job: claimedJob,
        openAiApiKey: openAiApiKey ?? "",
        imageModel,
        dryRun: DRY_RUN
      });
    }
  } catch (cause) {
    console.error("[generate-avatar] initial claim failed", {
      jobId,
      error: cause instanceof Error ? cause.message : String(cause)
    });
    return jsonResponse({ error: "job_claim_failed" }, 500);
  }

  return jsonResponse({ jobId }, 202);
});
