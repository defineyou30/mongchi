import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import type { SupabaseClient } from "@supabase/supabase-js";

import { canCreatePet, generationStepStatuses } from "@mongchi/shared";
import type {
  GeneratedAsset,
  GeneratedAssetState,
  GenerationJobStatus,
  PetBundle,
  PrototypeSessionState
} from "@mongchi/shared";

import type { MobileApiError } from "../../shared/api";
import { getConfiguredSupabaseAnonKey, getConfiguredSupabaseUrl } from "./supabaseClient";
import { reporter } from "../../shared/errors/reporter";

export type SupabaseGenerationFlowResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: MobileApiError;
    };

const generationPollIntervalMs = 900;
const petMediaBucket = "pet-media";
const signedUrlExpirySeconds = 7 * 24 * 60 * 60; // 7 days
const sourcePhotoMaxLongEdge = 768;
const sourcePhotoJpegCompression = 0.8;

const addMs = (timestamp: string, durationMs: number): string =>
  new Date(new Date(timestamp).getTime() + durationMs).toISOString();

/** Exported for reuse by other Supabase-transport session modules (see ensureSupabaseSession's doc comment above). */
export const toMobileError = (
  status: number,
  code: string,
  messageSafe: string,
  retryable = false
): MobileApiError => ({
  status,
  code,
  messageSafe,
  retryable
});

const errorResult = (error: MobileApiError): SupabaseGenerationFlowResult<never> => ({
  ok: false,
  error
});

/**
 * Mirrors apiGenerationSession.ts's toLocalGenerationState, but sourced from
 * the Supabase generation_jobs status vocabulary (a subset of
 * GenerationJobStatus: created|safety_checking|generating|quality_checking|
 * uploading_assets|completed|failed).
 */
const toLocalGenerationState = (
  status: GenerationJobStatus,
  now: string,
  retryCount: number,
  pollAttemptCount: number,
  failure?: { failureCode?: string | null; failureMessageSafe?: string | null }
): PrototypeSessionState["generation"] => {
  const currentStepIndex = Math.max(0, generationStepStatuses.indexOf(status));
  const terminal = status === "completed" || status === "failed";

  return {
    retryCount,
    pollAttemptCount,
    status,
    currentStepIndex,
    lastPolledAt: now,
    ...(terminal ? {} : { nextPollAfter: addMs(now, generationPollIntervalMs) }),
    ...(status === "completed" ? { completedAt: now } : {}),
    ...(status === "failed"
      ? {
          failedAt: now,
          ...(failure?.failureCode ? { failureCode: failure.failureCode } : {}),
          ...(failure?.failureMessageSafe ? { failureMessageSafe: failure.failureMessageSafe } : {})
        }
      : {})
  };
};

export interface EnsuredSupabaseSession {
  ok: true;
  userId: string;
}

export type EnsureSupabaseSessionResult = EnsuredSupabaseSession | { ok: false; error: MobileApiError };

/**
 * Signs the device in anonymously if it doesn't already hold a session. Only
 * called from the start flow, never on app boot, so a user never gets an
 * anonymous identity until they actually try to move a pet in.
 *
 * Exported for reuse by other Supabase-transport session modules (chat's
 * supabasePremiumChatSession.ts) that need the same "ensure an identity
 * before invoking an Edge Function" step -- see docs/chat-live-design.md §6.1.
 */
export const ensureSupabaseSession = async (client: SupabaseClient): Promise<EnsureSupabaseSessionResult> => {
  const existing = await client.auth.getSession();

  if (existing.data.session?.user.id) {
    return { ok: true, userId: existing.data.session.user.id };
  }

  const signedIn = await client.auth.signInAnonymously();

  if (signedIn.error || !signedIn.data.session?.user.id) {
    return {
      ok: false,
      error: toMobileError(0, "supabase_anonymous_sign_in_failed", "Could not start your session. Try again.", true)
    };
  }

  return { ok: true, userId: signedIn.data.session.user.id };
};

interface ResolvedSourcePhoto {
  uri: string;
  width: number;
  height: number;
}

const resolveSourcePhotoUri = (
  state: PrototypeSessionState
): { ok: true; uri: string } | { ok: false; error: MobileApiError } => {
  if (state.photo.selectedMockPhoto) {
    return { ok: true, uri: "sample://mongchi/pet-photo.png" };
  }

  if (!state.photo.selectedPhotoUri) {
    return {
      ok: false,
      error: toMobileError(0, "source_photo_required", "Choose a pet photo so your tiny friend can move in.")
    };
  }

  return { ok: true, uri: state.photo.selectedPhotoUri };
};

/**
 * Downscales the source photo to a 768px long edge and re-encodes as
 * compressed JPEG, so uploads stay small and consistent regardless of the
 * original camera resolution or format. Kept deliberately small (usually
 * ~100-250KB): the iOS Simulator's network stack has been observed to reject
 * uploads around ~1MB with NSPOSIXErrorDomain Code=40 ("Message too long"),
 * even when the transfer is handed to native uploadAsync rather than routed
 * through the JS bridge.
 */
const prepareOriginalPhotoForUpload = async (
  sourceUri: string,
  manipulate: typeof manipulateAsync = manipulateAsync
): Promise<ResolvedSourcePhoto> => {
  const manipulated = await manipulate(
    sourceUri,
    [{ resize: { width: sourcePhotoMaxLongEdge } }],
    { format: SaveFormat.JPEG, compress: sourcePhotoJpegCompression }
  );

  return {
    uri: manipulated.uri,
    width: manipulated.width,
    height: manipulated.height
  };
};

const generateOriginalPhotoObjectName = (): string => `${Crypto.randomUUID()}.jpg`;

interface UploadedOriginalPhoto {
  storagePath: string;
}

const uploadOriginalPhoto = async (
  client: SupabaseClient,
  userId: string,
  preparedUri: string
): Promise<{ ok: true; data: UploadedOriginalPhoto } | { ok: false; error: MobileApiError }> => {
  try {
    const storagePath = `original-photos/${userId}/${generateOriginalPhotoObjectName()}`;

    // React Native's fetch(uri) -> arrayBuffer() -> upload(bytes) path serializes
    // the whole image across the JS<->native bridge as a single message, which
    // hits the bridge's message-size limit (EMSGSIZE) for anything beyond ~1MB
    // ("Message too long"). Handing a RN FormData file part to supabase-js's
    // storage client also fails ("Unsupported FormDataPart implementation") --
    // its internal body handling doesn't recognize RN's FormData file parts.
    // So we bypass supabase-js's storage client entirely and POST straight to
    // the Storage REST endpoint via expo-file-system's native uploadAsync,
    // which streams the file from disk without touching the JS bridge or
    // supabase-js's body serialization.
    const supabaseUrl = getConfiguredSupabaseUrl();
    const supabaseAnonKey = getConfiguredSupabaseAnonKey();

    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        ok: false,
        error: toMobileError(0, "original_photo_upload_failed", "Photo upload failed. Try again.", true)
      };
    }

    const session = await client.auth.getSession();
    const accessToken = session.data.session?.access_token;

    if (!accessToken) {
      return {
        ok: false,
        error: toMobileError(0, "original_photo_upload_failed", "Photo upload failed. Try again.", true)
      };
    }

    const uploadUrl = `${supabaseUrl}/storage/v1/object/${petMediaBucket}/${storagePath}`;

    // Diagnostic only: surfaces the on-disk size of what we're about to send,
    // which is the key signal for narrowing down transport-layer upload caps
    // (e.g. the iOS Simulator's ~1MB "Message too long" ceiling). Never blocks
    // the upload if the size can't be read.
    const fileInfo = await FileSystem.getInfoAsync(preparedUri).catch(() => null);
    const fileSizeBytes = fileInfo && fileInfo.exists ? fileInfo.size : undefined;

    const result = await FileSystem.uploadAsync(uploadUrl, preparedUri, {
      httpMethod: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
        "Content-Type": "image/jpeg",
        "x-upsert": "false"
      },
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT
    });

    if (result.status !== 200) {
      console.warn(
        "[generation] original photo upload rejected:",
        `status=${result.status}`,
        `bytes=${fileSizeBytes ?? "unknown"}`,
        result.body?.slice(0, 200)
      );
      return {
        ok: false,
        error: toMobileError(0, "original_photo_upload_failed", "Photo upload failed. Try again.", true)
      };
    }

    return { ok: true, data: { storagePath } };
  } catch (cause) {
    console.warn("[generation] original photo upload threw:", cause instanceof Error ? cause.message : String(cause));
    reporter.captureMessage("generation: original photo upload threw", {
      cause: cause instanceof Error ? cause.message : String(cause)
    });
    return {
      ok: false,
      error: toMobileError(0, "original_photo_upload_network_error", "Photo upload failed. Check your connection and try again.", true)
    };
  }
};

interface InvokeGenerateAvatarResult {
  ok: true;
  jobId: string;
}

type InvokeGenerateAvatarOutcome = InvokeGenerateAvatarResult | { ok: false; error: MobileApiError };

const buildGenerationInputSnapshot = (draft: PrototypeSessionState["draft"]) => {
  const petName = draft.name.trim();

  return {
    species: draft.species,
    ...(petName ? { petName } : {}),
    ...(draft.personalityTags.length > 0 ? { personalityTags: draft.personalityTags } : {}),
    ...(draft.talkingStyle ? { talkingStyle: draft.talkingStyle } : {})
  };
};

/**
 * The Edge Function's 402 response distinguishes two different reasons
 * (`quota_exhausted` -- free 1x generation used up -- vs `insufficient_credits`
 * -- paid credit_wallets balance too low, see
 * supabase/functions/generate-avatar/index.ts and
 * docs/credit-phase1-design.md §4.2/§6.3) that need different copy on the
 * client. supabase-js's FunctionsHttpError only exposes the raw failed
 * Response as `context` (no parsed body), so the JSON body has to be read
 * off it explicitly. Best-effort: a body read failure (already-consumed
 * stream, non-JSON body, etc) just falls back to the generic quota message
 * rather than throwing.
 */
/** Exported for reuse by other Supabase-transport session modules (see ensureSupabaseSession's doc comment above). */
export const readInvokeErrorBody = async (context: unknown): Promise<{ error?: string; message?: string } | null> => {
  if (!context || typeof (context as Response).json !== "function") {
    return null;
  }

  try {
    return (await (context as Response).json()) as { error?: string };
  } catch {
    return null;
  }
};

const invokeGenerateAvatarWithBody = async (
  client: SupabaseClient,
  body: Record<string, unknown>
): Promise<InvokeGenerateAvatarOutcome> => {
  const invoked = await client.functions.invoke("generate-avatar", { body });

  if (invoked.error) {
    const context = (invoked.error as { context?: { status?: number } }).context;
    const status = context?.status ?? 0;

    if (status === 402) {
      const errorBody = await readInvokeErrorBody(context);

      if (errorBody?.error === "insufficient_credits") {
        return {
          ok: false,
          error: toMobileError(
            402,
            "insufficient_credits",
            "You're out of credits for this one. Grab more and let's try again soon."
          )
        };
      }

      return {
        ok: false,
        error: toMobileError(402, "generation_quota_exceeded", "You're out of avatar generations for now. Check back soon.")
      };
    }

    if (status === 429) {
      return {
        ok: false,
        error: toMobileError(
          429,
          "rate_limited",
          "Your friend needs a little breather — try again in a few minutes.",
          true
        )
      };
    }

    return {
      ok: false,
      error: toMobileError(status, "generate_avatar_invoke_failed", "Could not start creating your companion. Try again.", true)
    };
  }

  const jobId = (invoked.data as { jobId?: string } | null)?.jobId;

  if (!jobId) {
    return {
      ok: false,
      error: toMobileError(0, "generate_avatar_response_invalid", "Could not start creating your companion. Try again.", true)
    };
  }

  return { ok: true, jobId };
};

const invokeGenerateAvatar = (
  client: SupabaseClient,
  state: PrototypeSessionState,
  originalPhotoPath: string
): Promise<InvokeGenerateAvatarOutcome> =>
  invokeGenerateAvatarWithBody(client, {
    inputSnapshot: buildGenerationInputSnapshot(state.draft),
    originalPhotoPath
  });

const startSupabaseGenerationFlowInner = async (
  client: SupabaseClient,
  state: PrototypeSessionState & PetBundle,
  now: string,
  manipulate: typeof manipulateAsync = manipulateAsync
): Promise<SupabaseGenerationFlowResult<Partial<PrototypeSessionState> & Partial<PetBundle>>> => {
  const sourcePhoto = resolveSourcePhotoUri(state);

  if (!sourcePhoto.ok) {
    return sourcePhoto;
  }

  if (!canCreatePet(state)) {
    return errorResult(
      toMobileError(0, "pet_setup_required", "Choose your pet's name and personality before they move in.")
    );
  }

  const session = await ensureSupabaseSession(client);

  if (!session.ok) {
    return session;
  }

  // The source photo's file:// URI can point at an ImagePicker temp cache
  // entry that iOS has since cleaned up (observed hours after selection).
  // manipulateAsync throws in that case rather than resolving, and that
  // throw isn't caught anywhere upstream -- without this try/catch it
  // propagates out of the flow entirely, gets silently swallowed by
  // TerrariumSessionProvider's asyncActionGuard, and the user sees no error,
  // no job, and no log. Route it to the same photo-missing failure state
  // instead so the user is nudged to re-select a photo.
  let preparedUri: string;

  try {
    const prepared = await prepareOriginalPhotoForUpload(sourcePhoto.uri, manipulate);
    preparedUri = prepared.uri;
  } catch (cause) {
    console.warn(
      "[generation] source photo prepare failed:",
      cause instanceof Error ? cause.message : String(cause)
    );
    reporter.captureMessage("generation: source photo prepare failed", {
      cause: cause instanceof Error ? cause.message : String(cause)
    });
    return errorResult(
      toMobileError(
        0,
        "source_photo_unreadable",
        "Choose your pet's photo again so we can try once more.",
        false
      )
    );
  }

  const uploaded = await uploadOriginalPhoto(client, session.userId, preparedUri);

  if (!uploaded.ok) {
    return uploaded;
  }

  const invoked = await invokeGenerateAvatar(client, state, uploaded.data.storagePath);

  if (!invoked.ok) {
    return invoked;
  }

  const localPet: PetBundle["petProfile"] = {
    ...(state.petProfile ?? {
      id: `pet_local_${Crypto.randomUUID()}`,
      userId: session.userId,
      name: state.draft.name,
      species: state.draft.species,
      personalityTags: state.draft.personalityTags,
      talkingStyle: state.draft.talkingStyle,
      lifecycleStatus: "draft",
      createdAt: now,
      updatedAt: now
    }),
    activeGenerationJobId: invoked.jobId
  };

  return {
    ok: true,
    data: {
      petProfile: localPet,
      generation: {
        retryCount: state.generation.retryCount,
        pollAttemptCount: 0,
        status: "preprocessing",
        currentStepIndex: 0,
        startedAt: now,
        lastPolledAt: now,
        nextPollAfter: addMs(now, generationPollIntervalMs)
      },
      acceptedAsset: null,
      acceptedAssets: []
    }
  };
};

/**
 * Design-audit invariant I4 (failures must never be silent), same shield as
 * pollSupabaseGenerationFlow below. Before this wrapper, a raw throw from any
 * await in the inner flow (session sign-in, prepareOriginalPhotoForUpload,
 * uploadOriginalPhoto's own awaits, invokeGenerateAvatar) escaped uncaught as
 * an unhandled promise rejection -- unlike the poll flows, which already had
 * this shield. Since credit Phase 1c wired the expression-pack purchase path
 * through this same start-flow shape to a paid server-side consume_credits
 * debit, an uncaught throw here is no longer just "no error shown": it can
 * leave the purchase attempt with no retry path and no visible failure state
 * at all.
 *
 * Double-charge note: if the Edge Function's consume_credits call already
 * committed server-side before the throw (e.g. the invoke's HTTP response
 * itself is what threw, after the server processed the request), the
 * server-side debit already happened and is NOT undone by this catch -- it
 * only stops the throw from crashing the client. That's fine: the debit was
 * for a request that legitimately started, and hydrateServerCreditBalance
 * (called elsewhere on foreground resume / shop entry / post-generation)
 * will pick up the true server balance on next hydrate regardless of what
 * this catch returns locally. If the *caller* retries this same purchase
 * attempt, callers are expected to reuse the same requestId (see
 * startSupabaseExpressionPackFlow's doc comment) -- the Edge Function's
 * consume_credits keys its ledger entry on that request_id, so a retried
 * invoke with the same id is idempotent and never debits twice.
 */
export const startSupabaseGenerationFlow = async (
  client: SupabaseClient,
  state: PrototypeSessionState & PetBundle,
  now: string,
  manipulate: typeof manipulateAsync = manipulateAsync
): Promise<SupabaseGenerationFlowResult<Partial<PrototypeSessionState> & Partial<PetBundle>>> => {
  try {
    return await startSupabaseGenerationFlowInner(client, state, now, manipulate);
  } catch (cause) {
    console.warn("[generation] start flow threw:", cause instanceof Error ? cause.message : String(cause));
    reporter.captureMessage("generation: start flow threw", {
      cause: cause instanceof Error ? cause.message : String(cause)
    });
    return errorResult(
      toMobileError(
        0,
        "generation_start_failed",
        "We need a moment to connect. Try starting again.",
        true
      )
    );
  }
};

interface GenerationJobRow {
  id: string;
  status: GenerationJobStatus;
  failure_code: string | null;
  failure_message_safe: string | null;
  required_states: string[] | null;
  created_at: string;
  updated_at: string;
  generated_assets: GeneratedAssetRow[] | null;
}

interface GeneratedAssetRow {
  job_id: string;
  state: GeneratedAssetState;
  storage_path: string;
  width: number;
  height: number;
}

const toGeneratedAssetPlaceholder = (
  row: GeneratedAssetRow,
  petId: string,
  now: string,
  signedUri: string
): GeneratedAsset => ({
  id: `${row.job_id}:${row.state}`,
  petId,
  generationJobId: row.job_id,
  state: row.state,
  uri: signedUri,
  width: row.width,
  height: row.height,
  contentHash: row.storage_path,
  mimeType: "image/png",
  storageClass: "private_app_asset",
  version: 1,
  qualityStatus: "passed",
  createdAt: now,
  updatedAt: now
});

const signGeneratedAssetUrls = async (
  client: SupabaseClient,
  assets: GeneratedAssetRow[],
  petId: string,
  now: string
): Promise<GeneratedAsset[]> => {
  const signed: GeneratedAsset[] = [];

  for (const asset of assets) {
    const result = await client.storage.from(petMediaBucket).createSignedUrl(asset.storage_path, signedUrlExpirySeconds);

    if (result.error || !result.data?.signedUrl) {
      continue;
    }

    signed.push(toGeneratedAssetPlaceholder(asset, petId, now, result.data.signedUrl));
  }

  return signed;
};

// A transient hiccup while polling (session expiry, etc.) must not kill an
// otherwise-healthy in-flight job -- the generation pipeline keeps running
// server-side regardless of whether this device can currently poll it. This
// patch intentionally touches only lastPolledAt/nextPollAfter (via the
// generation poll interval), leaving status/currentStepIndex/etc untouched,
// so the next poll tick simply tries again instead of the job appearing
// failed.
const transientPollRetryPatch = (
  state: PrototypeSessionState,
  now: string
): Partial<PrototypeSessionState> => ({
  generation: {
    ...state.generation,
    lastPolledAt: now,
    nextPollAfter: addMs(now, generationPollIntervalMs)
  }
});

const pollSupabaseGenerationFlowInner = async (
  client: SupabaseClient,
  state: PrototypeSessionState & PetBundle,
  now: string
): Promise<SupabaseGenerationFlowResult<Partial<PrototypeSessionState> & Partial<PetBundle>>> => {
  const jobId = state.petProfile?.activeGenerationJobId;

  if (!jobId) {
    return errorResult(toMobileError(0, "generation_job_missing", "Generation job could not be found."));
  }

  // The device's Supabase session (anonymous or otherwise) can expire while
  // a generation job is still in flight server-side. That is a transient,
  // recoverable condition -- not a reason to mark the job failed -- so it is
  // checked explicitly before polling and handled with a patch that only
  // reschedules the next poll attempt, per the audit's I4/session-expiry
  // guidance ("session expiry is retryable transient, don't kill the job").
  const session = await ensureSupabaseSession(client);

  if (!session.ok) {
    return {
      ok: true,
      data: transientPollRetryPatch(state, now)
    };
  }

  const polled = await client
    .from("generation_jobs")
    .select("*, generated_assets(*)")
    .eq("id", jobId)
    .single();

  if (polled.error || !polled.data) {
    return errorResult(toMobileError(0, "generation_job_poll_failed", "Could not check on your companion's progress.", true));
  }

  const job = polled.data as GenerationJobRow;
  const pollAttemptCount = (state.generation.pollAttemptCount ?? 0) + 1;

  const generation = toLocalGenerationState(job.status, now, state.generation.retryCount, pollAttemptCount, {
    failureCode: job.failure_code,
    failureMessageSafe: job.failure_message_safe
  });

  if (job.status !== "completed" || !job.generated_assets || job.generated_assets.length === 0) {
    return {
      ok: true,
      data: { generation }
    };
  }

  const petId = state.petProfile?.id ?? job.id;
  const signedAssets = await signGeneratedAssetUrls(client, job.generated_assets, petId, now);

  if (signedAssets.length === 0) {
    return {
      ok: true,
      data: { generation }
    };
  }

  return {
    ok: true,
    data: {
      generation,
      acceptedAsset: signedAssets[0]!,
      acceptedAssets: signedAssets
    }
  };
};

/**
 * Design-audit invariant I4 (failures must never be silent): every await in
 * the poll flow above -- ensureSupabaseSession, the generation_jobs select/
 * single(), and signGeneratedAssetUrls's per-asset createSignedUrl calls --
 * can throw (network errors, an unexpected Supabase client-library
 * exception) rather than resolving to a `{ error }` result object. Previously
 * nothing here caught that: the throw propagated out of
 * TerrariumSessionProvider's asyncActionGuard.run and was swallowed as an
 * unhandled promise rejection, leaving the UI stuck mid-progress-bar with no
 * error shown and no further polling. Wrapping the whole flow turns any such
 * throw into a visible, retryable generation_job_poll_failed error instead.
 */
export const pollSupabaseGenerationFlow = async (
  client: SupabaseClient,
  state: PrototypeSessionState & PetBundle,
  now: string
): Promise<SupabaseGenerationFlowResult<Partial<PrototypeSessionState> & Partial<PetBundle>>> => {
  try {
    return await pollSupabaseGenerationFlowInner(client, state, now);
  } catch (cause) {
    console.warn("[generation] poll flow threw:", cause instanceof Error ? cause.message : String(cause));
    reporter.captureMessage("generation: poll flow threw", {
      cause: cause instanceof Error ? cause.message : String(cause)
    });
    return errorResult(
      toMobileError(0, "generation_job_poll_failed", "Could not check on your companion's progress.", true)
    );
  }
};

export const retrySupabaseGenerationFlow = async (
  client: SupabaseClient,
  state: PrototypeSessionState & PetBundle,
  now: string,
  manipulate: typeof manipulateAsync = manipulateAsync
): Promise<SupabaseGenerationFlowResult<Partial<PrototypeSessionState> & Partial<PetBundle>>> => {
  const jobId = state.petProfile?.activeGenerationJobId;

  if (!jobId) {
    return errorResult(toMobileError(0, "generation_job_missing", "Generation job could not be found."));
  }

  const session = await ensureSupabaseSession(client);

  if (!session.ok) {
    return session;
  }

  // Prefer re-using the previously uploaded original photo. If the local
  // session no longer has a source photo to fall back on (e.g. the original
  // was deleted), surface a state that nudges the user to re-select a photo
  // instead of silently failing.
  const sourcePhoto = resolveSourcePhotoUri(state);

  if (!sourcePhoto.ok) {
    return {
      ok: true,
      data: {
        generation: {
          retryCount: state.generation.retryCount + 1,
          pollAttemptCount: 0,
          status: "failed",
          currentStepIndex: state.generation.currentStepIndex,
          ...(state.generation.startedAt ? { startedAt: state.generation.startedAt } : {}),
          lastPolledAt: now,
          failedAt: now,
          failureCode: "source_photo_required",
          failureMessageSafe: "Choose your pet's photo again so we can try once more."
        }
      }
    };
  }

  // See the matching try/catch in startSupabaseGenerationFlow: the source
  // photo's file:// URI can go stale between selection and retry (iOS
  // cleaning up the ImagePicker temp cache), and manipulateAsync throws
  // rather than resolving in that case. Left uncaught, that throw escapes
  // this flow and gets silently swallowed by asyncActionGuard -- no job, no
  // log, no error state, and the "Try again" button looks like it did
  // nothing. Fall back to the same photo-missing failure patch used above so
  // the user is nudged to re-select a photo instead.
  let preparedUri: string;

  try {
    const prepared = await prepareOriginalPhotoForUpload(sourcePhoto.uri, manipulate);
    preparedUri = prepared.uri;
  } catch (cause) {
    console.warn(
      "[generation] source photo prepare failed:",
      cause instanceof Error ? cause.message : String(cause)
    );
    reporter.captureMessage("generation: source photo prepare failed on retry", {
      cause: cause instanceof Error ? cause.message : String(cause)
    });
    return {
      ok: true,
      data: {
        generation: {
          retryCount: state.generation.retryCount + 1,
          pollAttemptCount: 0,
          status: "failed",
          currentStepIndex: state.generation.currentStepIndex,
          ...(state.generation.startedAt ? { startedAt: state.generation.startedAt } : {}),
          lastPolledAt: now,
          failedAt: now,
          failureCode: "source_photo_unreadable",
          failureMessageSafe: "Choose your pet's photo again so we can try once more."
        }
      }
    };
  }

  const uploaded = await uploadOriginalPhoto(client, session.userId, preparedUri);

  if (!uploaded.ok) {
    return uploaded;
  }

  const invoked = await invokeGenerateAvatar(client, state, uploaded.data.storagePath);

  if (!invoked.ok) {
    return invoked;
  }

  const localPet: PetBundle["petProfile"] = state.petProfile
    ? { ...state.petProfile, activeGenerationJobId: invoked.jobId }
    : null;

  return {
    ok: true,
    data: {
      ...(localPet ? { petProfile: localPet } : {}),
      generation: {
        retryCount: state.generation.retryCount + 1,
        pollAttemptCount: 0,
        status: "preprocessing",
        currentStepIndex: 0,
        startedAt: now,
        lastPolledAt: now,
        nextPollAfter: addMs(now, generationPollIntervalMs)
      },
      acceptedAsset: null,
      acceptedAssets: []
    }
  };
};

// ---------------------------------------------------------------------------
// Expression packs: a small, additional set of generated-asset states (e.g.
// curious/play/hungry) seeded from an already-accepted idle sprite rather
// than a fresh source photo. See supabase/functions/generate-avatar's
// isExpressionPackRequest branch for the server side of this contract:
// `source_asset_path` (a pet-media storage path) + `requested_states`
// replaces `originalPhotoPath`, skips the safety check and quota debit, and
// is gated only by the same rate limiter as ordinary generation.
// ---------------------------------------------------------------------------

/**
 * A signed pet-media URL created by createSignedUrl always has the shape
 * `${supabaseUrl}/storage/v1/object/sign/pet-media/<path>?token=...` (see
 * uploadOriginalPhoto's matching upload URL). This pulls `<path>` back out
 * for a signed URL that didn't come from this device's own
 * signGeneratedAssetUrls call (so no contentHash carrying the raw path is
 * available) -- a defensive fallback, since the primary lookup below prefers
 * the accepted asset's contentHash.
 */
const extractPetMediaStoragePathFromSignedUrl = (signedUrl: string): string | null => {
  const marker = `/${petMediaBucket}/`;
  const markerIndex = signedUrl.indexOf(marker);

  if (markerIndex === -1) {
    return null;
  }

  const afterMarker = signedUrl.slice(markerIndex + marker.length);
  const withoutQuery = afterMarker.split("?")[0];

  return withoutQuery && withoutQuery.length > 0 ? withoutQuery : null;
};

export type ResolveIdleAssetStoragePathResult =
  | { ok: true; storagePath: string }
  | { ok: false; error: MobileApiError };

/**
 * Finds the pet-media storage path of the accepted idle sprite -- the seed
 * image an expression pack job generates its new states from. Prefers
 * `contentHash` (signGeneratedAssetUrls stamps the *bucket-relative* storage
 * path there directly -- e.g. `avatars/<user>/<job>/idle.png`, matching the
 * server's own `storagePath` variable in generate-avatar's upload step; see
 * toGeneratedAssetPlaceholder), falling back to parsing the signed `uri` for
 * an idle asset restored from a shape that didn't preserve contentHash (e.g.
 * an older persisted session). A mock/local asset's contentHash
 * (`mock_hash_<key>_<state>`, see mockData.ts) never contains a `/`, so the
 * `/` check also keeps this from ever mistaking a mock placeholder for a
 * real path -- callers only reach this in Supabase mode regardless.
 */
export const resolveIdleAssetStoragePath = (state: PrototypeSessionState & PetBundle): ResolveIdleAssetStoragePathResult => {
  const idleAsset = state.acceptedAssets.find((asset) => asset.state === "idle") ?? state.acceptedAsset;

  if (!idleAsset) {
    return {
      ok: false,
      error: toMobileError(0, "idle_asset_missing", "We need your companion's current look before adding new expressions.")
    };
  }

  if (idleAsset.contentHash && idleAsset.contentHash.includes("/")) {
    return { ok: true, storagePath: idleAsset.contentHash };
  }

  const fromUri = extractPetMediaStoragePathFromSignedUrl(idleAsset.uri);

  if (fromUri) {
    return { ok: true, storagePath: fromUri };
  }

  return {
    ok: false,
    error: toMobileError(0, "idle_asset_missing", "We need your companion's current look before adding new expressions.")
  };
};

export interface StartExpressionPackFlowResult {
  jobId: string;
}

/**
 * Starts a server-side expression-pack generation job seeded from the
 * player's already-accepted idle sprite. Mirrors startSupabaseGenerationFlow's
 * shape (ensure session -> invoke generate-avatar) but skips the
 * photo-upload step entirely, since there is no fresh source photo in this
 * mode. Returns just the job id -- callers (TerrariumSessionProvider) own
 * deciding when to charge credits (only after this resolves ok) and how to
 * track pending/polling state, since an expression pack purchase is not a
 * replacement for the main generation.status machine.
 *
 * As of credit Phase 1c (docs/credit-phase1-design.md §6.3), this is a paid
 * server-side debit, not a free ride: `requestId` is sent as the request
 * body's `request_id`, the same idempotency key the Edge Function's
 * consume_credits call keys its ledger entry on (see
 * supabase/functions/generate-avatar/index.ts step 4). Passing the *same*
 * requestId across retries of the same purchase attempt guarantees the
 * server only ever debits once for it; callers should mint a fresh UUID per
 * new purchase attempt (not per retry).
 */
const startSupabaseExpressionPackFlowInner = async (
  client: SupabaseClient,
  state: PrototypeSessionState & PetBundle,
  packId: string,
  requestedStates: readonly string[],
  requestId: string
): Promise<SupabaseGenerationFlowResult<StartExpressionPackFlowResult>> => {
  const storagePath = resolveIdleAssetStoragePath(state);

  if (!storagePath.ok) {
    return errorResult(storagePath.error);
  }

  const session = await ensureSupabaseSession(client);

  if (!session.ok) {
    return session;
  }

  const invoked = await invokeGenerateAvatarWithBody(client, {
    inputSnapshot: buildGenerationInputSnapshot(state.draft),
    source_asset_path: storagePath.storagePath,
    expression_pack_id: packId,
    requested_states: [...requestedStates],
    request_id: requestId
  });

  if (!invoked.ok) {
    return invoked;
  }

  return { ok: true, data: { jobId: invoked.jobId } };
};

/**
 * Same I4 shield as startSupabaseGenerationFlow above, and doubly important
 * here: this start flow is the one that triggers the server's paid
 * consume_credits debit (credit Phase 1c, docs/credit-phase1-design.md §6.3).
 * Per §6.4 ("paid generation must never be optimistic"), nothing here mutates
 * local wallet/ownership state on success or failure -- the caller
 * (TerrariumSessionProvider) only charges/advances state after this resolves
 * `ok: true`, so a caught throw naturally leaves the wallet and pet ownership
 * completely untouched, exactly like any other `ok: false` result from this
 * function.
 *
 * Double-charge note: if the throw happens *after* the server already
 * committed the consume_credits debit (e.g. the invoke's own response
 * handling throws post-commit), that debit is real and intentionally not
 * rolled back here -- catching only prevents the client from crashing/
 * hanging on it. The client's local balance simply hasn't caught up yet;
 * hydrateServerCreditBalance re-reads the server-authoritative balance on the
 * next hydrate. If the caller retries the same purchase attempt with the
 * same requestId (see this function's outer doc comment on requestId reuse),
 * the Edge Function's consume_credits is idempotent on request_id, so the
 * retry cannot debit a second time -- it just re-resolves against the
 * already-recorded ledger entry for that id.
 */
export const startSupabaseExpressionPackFlow = async (
  client: SupabaseClient,
  state: PrototypeSessionState & PetBundle,
  packId: string,
  requestedStates: readonly string[],
  requestId: string
): Promise<SupabaseGenerationFlowResult<StartExpressionPackFlowResult>> => {
  try {
    return await startSupabaseExpressionPackFlowInner(client, state, packId, requestedStates, requestId);
  } catch (cause) {
    console.warn("[expressionPack] start flow threw:", cause instanceof Error ? cause.message : String(cause));
    reporter.captureMessage("expressionPack: start flow threw", {
      cause: cause instanceof Error ? cause.message : String(cause)
    });
    return errorResult(
      toMobileError(
        0,
        "expression_pack_start_failed",
        "We need a moment to connect. Try starting again.",
        true
      )
    );
  }
};

export type ExpressionPackPollStatus = "pending" | "completed" | "failed";

export interface ExpressionPackPollOutcome {
  status: ExpressionPackPollStatus;
  assets: GeneratedAsset[];
  failureMessageSafe: string | null;
}

const pollSupabaseExpressionPackFlowInner = async (
  client: SupabaseClient,
  jobId: string,
  petId: string,
  now: string
): Promise<SupabaseGenerationFlowResult<ExpressionPackPollOutcome>> => {
  const session = await ensureSupabaseSession(client);

  if (!session.ok) {
    // Same transient-session-expiry handling as pollSupabaseGenerationFlowInner:
    // a lapsed device session is retryable, never a job failure.
    return { ok: true, data: { status: "pending", assets: [], failureMessageSafe: null } };
  }

  const polled = await client
    .from("generation_jobs")
    .select("*, generated_assets(*)")
    .eq("id", jobId)
    .single();

  if (polled.error || !polled.data) {
    return errorResult(toMobileError(0, "generation_job_poll_failed", "Could not check on your companion's new expressions.", true));
  }

  const job = polled.data as GenerationJobRow;

  if (job.status === "failed") {
    return {
      ok: true,
      data: {
        status: "failed",
        assets: [],
        failureMessageSafe: job.failure_message_safe ?? "The tiny door got stuck. Let's try adding these expressions again."
      }
    };
  }

  if (job.status !== "completed" || !job.generated_assets || job.generated_assets.length === 0) {
    return { ok: true, data: { status: "pending", assets: [], failureMessageSafe: null } };
  }

  const signedAssets = await signGeneratedAssetUrls(client, job.generated_assets, petId, now);

  if (signedAssets.length === 0) {
    return { ok: true, data: { status: "pending", assets: [], failureMessageSafe: null } };
  }

  return { ok: true, data: { status: "completed", assets: signedAssets, failureMessageSafe: null } };
};

/**
 * Polls an expression-pack job by explicit id (rather than
 * state.petProfile.activeGenerationJobId, which stays pointed at the pet's
 * original portrait job throughout). Wrapped in the same try/catch shield as
 * pollSupabaseGenerationFlow -- see that function's doc comment for why an
 * uncaught throw here would otherwise strand the UI silently.
 */
export const pollSupabaseExpressionPackFlow = async (
  client: SupabaseClient,
  jobId: string,
  petId: string,
  now: string
): Promise<SupabaseGenerationFlowResult<ExpressionPackPollOutcome>> => {
  try {
    return await pollSupabaseExpressionPackFlowInner(client, jobId, petId, now);
  } catch (cause) {
    console.warn("[expressionPack] poll flow threw:", cause instanceof Error ? cause.message : String(cause));
    reporter.captureMessage("expressionPack: poll flow threw", {
      cause: cause instanceof Error ? cause.message : String(cause)
    });
    return errorResult(
      toMobileError(0, "generation_job_poll_failed", "Could not check on your companion's new expressions.", true)
    );
  }
};

// ---------------------------------------------------------------------------
// Server credit balance hydration (credit Phase 1c, see
// docs/credit-phase1-design.md §6.2). credit_wallets.balance is now the
// server's source of truth for CreditWallet.credits -- bonusCredits stays a
// purely local bucket (play-earned, fine to lose) and is never touched here.
// Callers decide *when* to hydrate (foreground resume, shop/gallery entry,
// right after a purchase/generation completes) -- this function itself is
// just the read, deliberately not wired to any interval/clock so it can
// never get looped into a per-second re-render cost on the home screen.
// ---------------------------------------------------------------------------

export interface HydrateServerCreditBalanceResult {
  ok: true;
  credits: number;
}

export type HydrateServerCreditBalanceOutcome =
  | HydrateServerCreditBalanceResult
  | { ok: false; error: MobileApiError };

const hydrateServerCreditBalanceInner = async (client: SupabaseClient): Promise<HydrateServerCreditBalanceOutcome> => {
  const session = await ensureSupabaseSession(client);

  if (!session.ok) {
    return session;
  }

  const balance = await client.rpc("get_credit_balance", { p_user: session.userId });

  if (balance.error || typeof balance.data !== "number") {
    return {
      ok: false,
      error: toMobileError(0, "credit_balance_fetch_failed", "Could not refresh your credit balance.", true)
    };
  }

  return { ok: true, credits: balance.data };
};

/**
 * Reads the server-authoritative credit balance (credit_wallets.balance, via
 * the get_credit_balance RPC -- see supabase/migrations/0004_credit_ledger.sql
 * §3.4) for the current device's Supabase session. Wrapped in the same
 * try/catch shield as the other poll/flow helpers in this file: a thrown
 * client-library exception here must never propagate out as an unhandled
 * rejection, it should just surface as a retryable error the caller can
 * silently retry later (design doc §6.4: "hydrate failure -> last cache +
 * quiet retry", no error banner spam).
 */
export const hydrateServerCreditBalance = async (
  client: SupabaseClient
): Promise<HydrateServerCreditBalanceOutcome> => {
  try {
    return await hydrateServerCreditBalanceInner(client);
  } catch (cause) {
    console.warn("[credits] hydrate flow threw:", cause instanceof Error ? cause.message : String(cause));
    reporter.captureMessage("credits: hydrate flow threw", {
      cause: cause instanceof Error ? cause.message : String(cause)
    });
    return {
      ok: false,
      error: toMobileError(0, "credit_balance_fetch_failed", "Could not refresh your credit balance.", true)
    };
  }
};
