import { describe, expect, it, vi } from "vitest";
import type { manipulateAsync } from "expo-image-manipulator";

vi.mock("expo-crypto", () => ({
  randomUUID: vi.fn(() => "11111111-1111-4111-8111-111111111111")
}));

vi.mock("expo-image-manipulator", () => ({
  SaveFormat: { PNG: "png", JPEG: "jpeg", WEBP: "webp" },
  manipulateAsync: vi.fn(async (uri: string) => ({
    uri: `manipulated://${uri}`,
    width: 1024,
    height: 768
  }))
}));

const { uploadAsyncMock, getInfoAsyncMock } = vi.hoisted(() => ({
  uploadAsyncMock: vi.fn(async (_url: string, _fileUri: string, _options: Record<string, unknown>) => ({
    status: 200,
    headers: {},
    mimeType: "image/jpeg",
    body: ""
  })),
  getInfoAsyncMock: vi.fn(async (_fileUri: string) => ({
    exists: true,
    uri: _fileUri,
    size: 153_600,
    isDirectory: false,
    modificationTime: 0,
    md5: undefined
  }))
}));

vi.mock("expo-file-system/legacy", () => ({
  uploadAsync: uploadAsyncMock,
  getInfoAsync: getInfoAsyncMock,
  FileSystemUploadType: { BINARY_CONTENT: 0, MULTIPART: 1 }
}));

vi.mock("./supabaseClient", () => ({
  getConfiguredSupabaseUrl: vi.fn(() => "https://project.supabase.co"),
  getConfiguredSupabaseAnonKey: vi.fn(() => "anon-key-001")
}));

import {
  createInitialPrototypeSession,
  getActivePetBundle,
  setPrototypeConsentAccepted,
  setPrototypeMockPhotoSelected,
  setPrototypeSelectedPhotoUri,
  updatePrototypeDraft
} from "@mongchi/shared";
import type { PetBundle, PrototypeSessionState } from "@mongchi/shared";

import {
  pollSupabaseExpressionPackFlow,
  pollSupabaseGenerationFlow,
  resolveIdleAssetStoragePath,
  retrySupabaseGenerationFlow,
  startSupabaseExpressionPackFlow,
  startSupabaseGenerationFlow
} from "./supabaseGenerationSession";

// supabaseGenerationSession.ts's flows read per-pet fields (petProfile/
// acceptedAsset(s)) directly off their `state` parameter -- in production
// that parameter is TerrariumSessionProvider's `legacyFlatState` (the
// active bundle flattened back onto the top level), not the raw
// PrototypeSessionState. These tests call the flows directly, so they need
// the same flattening.
const toLegacyFlatState = (state: PrototypeSessionState): PrototypeSessionState & PetBundle => ({
  ...state,
  ...getActivePetBundle(state)
});

const createReadyState = (): PrototypeSessionState & PetBundle => {
  let state = createInitialPrototypeSession("2026-07-03T09:00:00.000Z");

  state = updatePrototypeDraft(state, {
    name: "Miso",
    species: "dog",
    talkingStyle: "gentle",
    personalityTags: ["affectionate"]
  });
  state = setPrototypeSelectedPhotoUri(state, "file://device/pet-photo.jpg", "library", {
    byteSize: 4096,
    mimeType: "image/jpeg"
  });
  state = setPrototypeConsentAccepted(state, true);

  return toLegacyFlatState(state);
};

const createMockPhotoState = (): PrototypeSessionState & PetBundle => {
  let state = createInitialPrototypeSession("2026-07-03T09:00:00.000Z");

  state = updatePrototypeDraft(state, {
    name: "Miso",
    species: "dog",
    talkingStyle: "gentle",
    personalityTags: ["affectionate"]
  });
  state = setPrototypeMockPhotoSelected(state, true);
  state = setPrototypeConsentAccepted(state, true);

  return toLegacyFlatState(state);
};

interface FakeSupabaseClientOptions {
  session?: { user: { id: string }; access_token?: string } | null;
  signInError?: { message: string } | null;
  invokeError?: { message: string; context?: { status?: number } } | null;
  invokeData?: { jobId?: string } | null;
  jobRow?: Record<string, unknown> | null;
  jobError?: { message: string } | null;
  signedUrl?: string | null;
  signedUrlError?: { message: string } | null;
}

const createFakeSupabaseClient = (options: FakeSupabaseClientOptions = {}) => {
  const invokeCalls: Array<{ name: string; body: unknown }> = [];
  const signedUrlCalls: string[] = [];
  let currentSession = options.session ?? null;

  const client = {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: currentSession }
      })),
      signInAnonymously: vi.fn(async () => {
        if (options.signInError) {
          return { data: { session: null }, error: options.signInError };
        }

        currentSession = { user: { id: "user_anon_001" }, access_token: "token_anon_001" };

        return {
          data: { session: currentSession },
          error: null
        };
      })
    },
    storage: {
      from: vi.fn((_bucket: string) => ({
        createSignedUrl: vi.fn(async (path: string, _expiresIn: number) => {
          signedUrlCalls.push(path);

          if (options.signedUrlError) {
            return { data: null, error: options.signedUrlError };
          }

          return {
            data: { signedUrl: options.signedUrl ?? `https://signed.example.com/${path}` },
            error: null
          };
        })
      }))
    },
    functions: {
      invoke: vi.fn(async (name: string, init: { body: unknown }) => {
        invokeCalls.push({ name, body: init.body });

        if (options.invokeError) {
          return { data: null, error: options.invokeError };
        }

        return { data: options.invokeData ?? { jobId: "job_supabase_001" }, error: null };
      })
    },
    from: vi.fn((_table: string) => ({
      select: vi.fn((_columns: string) => ({
        eq: vi.fn((_column: string, _value: string) => ({
          single: vi.fn(async () => {
            if (options.jobError) {
              return { data: null, error: options.jobError };
            }

            return { data: options.jobRow ?? null, error: null };
          })
        }))
      }))
    }))
  };

  return { client, invokeCalls, signedUrlCalls };
};

describe("supabase generation session start flow", () => {
  it("signs in anonymously, uploads the resized photo via expo-file-system, and invokes generate-avatar with the contract body", async () => {
    uploadAsyncMock.mockClear();
    uploadAsyncMock.mockResolvedValueOnce({ status: 200, headers: {}, mimeType: "image/jpeg", body: "" });

    const { client, invokeCalls } = createFakeSupabaseClient({ session: null });

    const result = await startSupabaseGenerationFlow(client as never, createReadyState(), "2026-07-03T09:01:00.000Z");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(client.auth.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(uploadAsyncMock).toHaveBeenCalledTimes(1);

    const [uploadUrl, fileUri, uploadOptions] = uploadAsyncMock.mock.calls[0]!;
    expect(uploadUrl).toBe(
      "https://project.supabase.co/storage/v1/object/pet-media/original-photos/user_anon_001/11111111-1111-4111-8111-111111111111.jpg"
    );
    expect(fileUri).toBe("manipulated://file://device/pet-photo.jpg");
    expect(uploadOptions).toMatchObject({
      httpMethod: "POST",
      headers: {
        Authorization: "Bearer token_anon_001",
        apikey: "anon-key-001",
        "Content-Type": "image/jpeg",
        "x-upsert": "false"
      }
    });

    expect(invokeCalls).toHaveLength(1);
    expect(invokeCalls[0]!.name).toBe("generate-avatar");
    expect(invokeCalls[0]!.body).toEqual({
      inputSnapshot: {
        species: "dog",
        petName: "Miso",
        personalityTags: ["affectionate"],
        talkingStyle: "gentle"
      },
      originalPhotoPath: "original-photos/user_anon_001/11111111-1111-4111-8111-111111111111.jpg"
    });

    expect(result.data.petProfile?.activeGenerationJobId).toBe("job_supabase_001");
    expect(result.data.generation?.status).toBe("preprocessing");
    expect(result.data.acceptedAsset).toBeNull();
    expect(result.data.acceptedAssets).toEqual([]);
  });

  it("reuses an existing session without signing in again", async () => {
    uploadAsyncMock.mockClear();
    uploadAsyncMock.mockResolvedValueOnce({ status: 200, headers: {}, mimeType: "image/jpeg", body: "" });

    const { client } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" }
    });

    const result = await startSupabaseGenerationFlow(client as never, createMockPhotoState(), "2026-07-03T09:01:00.000Z");

    expect(result.ok).toBe(true);
    expect(client.auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("starts generation right after photo confirmation, before the setup draft has a name, omitting petName from the request", async () => {
    // Mirrors PhotoUploadScreen's Continue handler: startMockGeneration now
    // fires as soon as the photo is confirmed, before the pet-setup screen
    // has collected a name into the draft (personalityTags/talkingStyle
    // already carry sensible defaults from initialDraft, so only petName is
    // blank at this point).
    uploadAsyncMock.mockClear();
    uploadAsyncMock.mockResolvedValueOnce({ status: 200, headers: {}, mimeType: "image/jpeg", body: "" });

    const { client, invokeCalls } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" }
    });

    let state = createInitialPrototypeSession("2026-07-03T09:00:00.000Z");
    state = setPrototypeSelectedPhotoUri(state, "file://device/pet-photo.jpg", "library", {
      byteSize: 4096,
      mimeType: "image/jpeg"
    });
    state = setPrototypeConsentAccepted(state, true);

    const result = await startSupabaseGenerationFlow(client as never, toLegacyFlatState(state), "2026-07-03T09:01:00.000Z");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(invokeCalls).toHaveLength(1);
    expect(invokeCalls[0]!.body).toEqual({
      inputSnapshot: {
        species: "dog",
        personalityTags: ["affectionate"],
        talkingStyle: "gentle"
      },
      originalPhotoPath: "original-photos/user_existing_001/11111111-1111-4111-8111-111111111111.jpg"
    });
  });

  it("requires a source photo before starting generation", async () => {
    const { client } = createFakeSupabaseClient();
    const state = createInitialPrototypeSession("2026-07-03T09:00:00.000Z");

    const result = await startSupabaseGenerationFlow(client as never, toLegacyFlatState(state), "2026-07-03T09:01:00.000Z");

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("source_photo_required");
  });

  it("maps a 402 quota-exceeded invoke error to a non-retryable generation error", async () => {
    uploadAsyncMock.mockClear();
    uploadAsyncMock.mockResolvedValueOnce({ status: 200, headers: {}, mimeType: "image/jpeg", body: "" });

    const { client } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" },
      invokeError: { message: "quota exceeded", context: { status: 402 } }
    });

    const result = await startSupabaseGenerationFlow(client as never, createReadyState(), "2026-07-03T09:01:00.000Z");

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("generation_quota_exceeded");
    expect(result.error.status).toBe(402);
    expect(result.error.retryable).toBe(false);
  });

  it("maps a 429 rate-limited invoke error to a retryable error with warm copy", async () => {
    uploadAsyncMock.mockClear();
    uploadAsyncMock.mockResolvedValueOnce({ status: 200, headers: {}, mimeType: "image/jpeg", body: "" });

    const { client } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" },
      invokeError: { message: "rate limited", context: { status: 429 } }
    });

    const result = await startSupabaseGenerationFlow(client as never, createReadyState(), "2026-07-03T09:01:00.000Z");

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("rate_limited");
    expect(result.error.status).toBe(429);
    expect(result.error.retryable).toBe(true);
    expect(result.error.messageSafe).toBe("Your friend needs a little breather — try again in a few minutes.");
  });

  it("surfaces a retryable error when anonymous sign-in fails", async () => {
    const { client } = createFakeSupabaseClient({
      session: null,
      signInError: { message: "network down" }
    });

    const result = await startSupabaseGenerationFlow(client as never, createReadyState(), "2026-07-03T09:01:00.000Z");

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("supabase_anonymous_sign_in_failed");
    expect(result.error.retryable).toBe(true);
  });

  it("surfaces an upload failure without invoking generate-avatar", async () => {
    uploadAsyncMock.mockClear();
    uploadAsyncMock.mockResolvedValueOnce({ status: 400, headers: {}, mimeType: "application/json", body: "bad request" });

    const { client, invokeCalls } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" }
    });

    const result = await startSupabaseGenerationFlow(client as never, createReadyState(), "2026-07-03T09:01:00.000Z");

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("original_photo_upload_failed");
    expect(invokeCalls).toHaveLength(0);
  });

  it("surfaces a source_photo_unreadable error when preparing the photo throws, instead of letting the throw escape", async () => {
    // Regression: a user's file:// URI can go stale (iOS cleans up the
    // ImagePicker temp cache) between selection and generation start.
    // manipulateAsync throws rather than resolving in that case; previously
    // this propagated out of the flow uncaught, was silently swallowed by
    // asyncActionGuard, and left no job, no log, and no error state.
    const { client, invokeCalls } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" }
    });

    const throwingManipulate = vi.fn(async () => {
      throw new Error("File does not exist");
    }) as unknown as typeof manipulateAsync;

    const result = await startSupabaseGenerationFlow(
      client as never,
      createReadyState(),
      "2026-07-03T09:01:00.000Z",
      throwingManipulate
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("source_photo_unreadable");
    expect(invokeCalls).toHaveLength(0);
  });
});

describe("supabase generation session poll flow", () => {
  const stateWithJob = (): PrototypeSessionState & PetBundle => {
    const base = createReadyState();

    return {
      ...base,
      petProfile: {
        id: "pet_local_001",
        userId: "user_existing_001",
        name: "Miso",
        species: "dog",
        personalityTags: ["affectionate"],
        talkingStyle: "gentle",
        lifecycleStatus: "draft",
        activeGenerationJobId: "job_supabase_001",
        createdAt: "2026-07-03T09:01:00.000Z",
        updatedAt: "2026-07-03T09:01:00.000Z"
      }
    };
  };

  it("maps an in-progress job status into local generation state without assets", async () => {
    const { client } = createFakeSupabaseClient({
      jobRow: {
        id: "job_supabase_001",
        status: "generating",
        failure_code: null,
        failure_message_safe: null,
        required_states: null,
        created_at: "2026-07-03T09:01:00.000Z",
        updated_at: "2026-07-03T09:01:30.000Z",
        generated_assets: []
      }
    });

    const result = await pollSupabaseGenerationFlow(client as never, stateWithJob(), "2026-07-03T09:01:31.000Z");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.generation?.status).toBe("generating");
    expect(result.data.generation?.nextPollAfter).toBeDefined();
    expect(result.data.acceptedAsset).toBeUndefined();
  });

  it("signs generated asset URLs and populates acceptedAsset/acceptedAssets when completed", async () => {
    const { client, signedUrlCalls } = createFakeSupabaseClient({
      jobRow: {
        id: "job_supabase_001",
        status: "completed",
        failure_code: null,
        failure_message_safe: null,
        required_states: null,
        created_at: "2026-07-03T09:01:00.000Z",
        updated_at: "2026-07-03T09:02:00.000Z",
        generated_assets: [
          { job_id: "job_supabase_001", state: "idle", storage_path: "generated/job_supabase_001/idle.png", width: 512, height: 512 },
          { job_id: "job_supabase_001", state: "base", storage_path: "generated/job_supabase_001/base.png", width: 512, height: 512 }
        ]
      }
    });

    const result = await pollSupabaseGenerationFlow(client as never, stateWithJob(), "2026-07-03T09:02:01.000Z");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(signedUrlCalls).toEqual([
      "generated/job_supabase_001/idle.png",
      "generated/job_supabase_001/base.png"
    ]);
    expect(result.data.generation?.status).toBe("completed");
    expect(result.data.acceptedAssets).toHaveLength(2);
    expect(result.data.acceptedAsset?.uri).toBe("https://signed.example.com/generated/job_supabase_001/idle.png");
    expect(result.data.acceptedAssets?.[0]!.state).toBe("idle");
  });

  it("maps a failed job status with the failure reason", async () => {
    const { client } = createFakeSupabaseClient({
      jobRow: {
        id: "job_supabase_001",
        status: "failed",
        failure_code: "safety_check_failed",
        failure_message_safe: "This photo could not be used. Try a different one.",
        required_states: null,
        created_at: "2026-07-03T09:01:00.000Z",
        updated_at: "2026-07-03T09:01:45.000Z",
        generated_assets: []
      }
    });

    const result = await pollSupabaseGenerationFlow(client as never, stateWithJob(), "2026-07-03T09:01:46.000Z");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.generation?.status).toBe("failed");
    expect(result.data.generation?.failureCode).toBe("safety_check_failed");
    expect(result.data.generation?.failureMessageSafe).toBe("This photo could not be used. Try a different one.");
    expect(result.data.generation?.nextPollAfter).toBeUndefined();
  });

  it("returns a local error when there is no active generation job", async () => {
    const { client } = createFakeSupabaseClient();

    const result = await pollSupabaseGenerationFlow(client as never, createReadyState(), "2026-07-03T09:01:00.000Z");

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("generation_job_missing");
  });

  it("treats an expired/failed session as a transient retry, not a job failure", async () => {
    // Regression for the design audit's I4/session-expiry guidance: a
    // device's Supabase session can expire mid-generation-poll. That must
    // never flip an otherwise-healthy in-flight job to "failed" -- only the
    // poll schedule should move forward so the next tick can try again once
    // the session recovers.
    const { client } = createFakeSupabaseClient({
      session: null,
      signInError: { message: "network down" },
      jobRow: {
        id: "job_supabase_001",
        status: "generating",
        failure_code: null,
        failure_message_safe: null,
        required_states: null,
        created_at: "2026-07-03T09:01:00.000Z",
        updated_at: "2026-07-03T09:01:30.000Z",
        generated_assets: []
      }
    });

    const state = stateWithJob();
    const result = await pollSupabaseGenerationFlow(client as never, state, "2026-07-03T09:01:31.000Z");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    // Untouched: the job's own status/currentStepIndex must not be
    // downgraded to failed just because this poll attempt's session expired.
    expect(result.data.generation?.status).toBe(state.generation.status);
    expect(result.data.generation?.nextPollAfter).toBeDefined();
    expect(client.from).not.toHaveBeenCalled();
  });

  it("catches an unexpected throw from the generation_jobs query and returns a retryable poll-failed error instead of letting it escape", async () => {
    // Regression for I4 (failures must never be silent): previously nothing
    // wrapped this flow, so a throwing Supabase client call propagated
    // uncaught, was silently swallowed by asyncActionGuard, and the UI got
    // stuck mid-progress with no error shown.
    const { client } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" }
    });

    client.from = vi.fn(() => {
      throw new Error("unexpected client failure");
    }) as never;

    const result = await pollSupabaseGenerationFlow(client as never, stateWithJob(), "2026-07-03T09:01:31.000Z");

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("generation_job_poll_failed");
    expect(result.error.retryable).toBe(true);
  });
});

describe("supabase generation session retry flow", () => {
  const stateWithJob = (): PrototypeSessionState & PetBundle => {
    const base = createReadyState();

    return {
      ...base,
      petProfile: {
        id: "pet_local_001",
        userId: "user_existing_001",
        name: "Miso",
        species: "dog",
        personalityTags: ["affectionate"],
        talkingStyle: "gentle",
        lifecycleStatus: "draft",
        activeGenerationJobId: "job_supabase_001",
        createdAt: "2026-07-03T09:01:00.000Z",
        updatedAt: "2026-07-03T09:01:00.000Z"
      }
    };
  };

  it("re-uploads the source photo and invokes generate-avatar again, bumping retryCount", async () => {
    uploadAsyncMock.mockClear();
    uploadAsyncMock.mockResolvedValueOnce({ status: 200, headers: {}, mimeType: "image/jpeg", body: "" });

    const { client, invokeCalls } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" },
      invokeData: { jobId: "job_supabase_002" }
    });

    const result = await retrySupabaseGenerationFlow(client as never, stateWithJob(), "2026-07-03T09:05:00.000Z");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(uploadAsyncMock).toHaveBeenCalledTimes(1);
    expect(invokeCalls).toHaveLength(1);
    expect(result.data.petProfile?.activeGenerationJobId).toBe("job_supabase_002");
    expect(result.data.generation?.retryCount).toBe(1);
    expect(result.data.generation?.status).toBe("preprocessing");
  });

  it("returns a re-selection-required failure state when the original photo is gone", async () => {
    const { client, invokeCalls } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" }
    });

    const state = stateWithJob();
    const stateWithoutPhoto: PrototypeSessionState & PetBundle = {
      ...state,
      photo: {
        ...state.photo,
        selectedMockPhoto: false,
        selectedPhotoUri: null
      }
    };

    const result = await retrySupabaseGenerationFlow(client as never, stateWithoutPhoto, "2026-07-03T09:05:00.000Z");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.generation?.status).toBe("failed");
    expect(result.data.generation?.failureCode).toBe("source_photo_required");
    expect(invokeCalls).toHaveLength(0);
  });

  it("returns a local error when there is no active generation job to retry", async () => {
    const { client } = createFakeSupabaseClient();

    const result = await retrySupabaseGenerationFlow(client as never, createReadyState(), "2026-07-03T09:05:00.000Z");

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("generation_job_missing");
  });

  it("returns a source_photo_unreadable failure patch (bumping retryCount) when preparing the photo throws on retry", async () => {
    // Regression: the same stale file:// URI failure mode as the start flow,
    // but hit via "Try again" hours after the original photo was picked.
    // Previously the throw from prepareOriginalPhotoForUpload escaped this
    // flow uncaught and was silently swallowed by asyncActionGuard -- no new
    // job, no console log, no failure state update, and (since retryCount
    // never changed) the "Try again" button stayed disabled forever.
    const { client, invokeCalls } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" }
    });

    const throwingManipulate = vi.fn(async () => {
      throw new Error("File does not exist");
    }) as unknown as typeof manipulateAsync;

    const result = await retrySupabaseGenerationFlow(
      client as never,
      stateWithJob(),
      "2026-07-03T09:05:00.000Z",
      throwingManipulate
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.generation?.status).toBe("failed");
    expect(result.data.generation?.failureCode).toBe("source_photo_unreadable");
    expect(result.data.generation?.retryCount).toBe(1);
    expect(invokeCalls).toHaveLength(0);
  });
});

describe("resolveIdleAssetStoragePath", () => {
  const withIdleAsset = (contentHash: string, uri = "https://signed.example.com/avatars/user/job/idle.png"): PrototypeSessionState & PetBundle => {
    const base = createReadyState();

    return {
      ...base,
      acceptedAssets: [
        {
          id: "asset_idle_001",
          petId: "pet_local_001",
          generationJobId: "job_supabase_001",
          state: "idle",
          uri,
          width: 512,
          height: 512,
          contentHash,
          mimeType: "image/png",
          storageClass: "private_app_asset",
          version: 1,
          qualityStatus: "passed",
          createdAt: "2026-07-03T09:02:00.000Z",
          updatedAt: "2026-07-03T09:02:00.000Z"
        }
      ]
    };
  };

  it("prefers the bucket-relative contentHash stamped by signGeneratedAssetUrls", () => {
    const state = withIdleAsset("avatars/user_existing_001/job_supabase_001/idle.png");

    const result = resolveIdleAssetStoragePath(state);

    expect(result).toEqual({ ok: true, storagePath: "avatars/user_existing_001/job_supabase_001/idle.png" });
  });

  it("falls back to parsing the signed uri when contentHash looks like a mock hash (no slash)", () => {
    const state = withIdleAsset(
      "mock_hash_miso_idle",
      "https://project.supabase.co/storage/v1/object/sign/pet-media/avatars/user/job/idle.png?token=abc123"
    );

    const result = resolveIdleAssetStoragePath(state);

    expect(result).toEqual({ ok: true, storagePath: "avatars/user/job/idle.png" });
  });

  it("fails when there is no accepted idle asset yet", () => {
    const state = createReadyState();

    const result = resolveIdleAssetStoragePath(state);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("idle_asset_missing");
  });
});

describe("supabase expression pack start flow", () => {
  const stateWithIdleAsset = (): PrototypeSessionState & PetBundle => {
    const base = createReadyState();

    return {
      ...base,
      acceptedAssets: [
        {
          id: "asset_idle_001",
          petId: "pet_local_001",
          generationJobId: "job_supabase_001",
          state: "idle",
          uri: "https://signed.example.com/avatars/user_existing_001/job_supabase_001/idle.png",
          width: 512,
          height: 512,
          contentHash: "avatars/user_existing_001/job_supabase_001/idle.png",
          mimeType: "image/png",
          storageClass: "private_app_asset",
          version: 1,
          qualityStatus: "passed",
          createdAt: "2026-07-03T09:02:00.000Z",
          updatedAt: "2026-07-03T09:02:00.000Z"
        }
      ]
    };
  };

  it("invokes generate-avatar with source_asset_path and requested_states, no originalPhotoPath", async () => {
    const { client, invokeCalls } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" },
      invokeData: { jobId: "job_expression_pack_001" }
    });

    const result = await startSupabaseExpressionPackFlow(client as never, stateWithIdleAsset(), ["curious", "play", "hungry"]);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.jobId).toBe("job_expression_pack_001");
    expect(invokeCalls).toHaveLength(1);
    expect(invokeCalls[0]!.body).toEqual({
      inputSnapshot: {
        species: "dog",
        petName: "Miso",
        personalityTags: ["affectionate"],
        talkingStyle: "gentle"
      },
      source_asset_path: "avatars/user_existing_001/job_supabase_001/idle.png",
      requested_states: ["curious", "play", "hungry"]
    });
  });

  it("fails fast without invoking generate-avatar when there is no idle asset to seed from", async () => {
    const { client, invokeCalls } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" }
    });

    const result = await startSupabaseExpressionPackFlow(client as never, createReadyState(), ["curious"]);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("idle_asset_missing");
    expect(invokeCalls).toHaveLength(0);
  });

  it("maps a 429 rate-limited response the same way as ordinary generation", async () => {
    const { client } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" },
      invokeError: { message: "rate limited", context: { status: 429 } }
    });

    const result = await startSupabaseExpressionPackFlow(client as never, stateWithIdleAsset(), ["curious"]);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("rate_limited");
    expect(result.error.retryable).toBe(true);
  });
});

describe("supabase expression pack poll flow", () => {
  it("reports pending while the job is still generating", async () => {
    const { client } = createFakeSupabaseClient({
      jobRow: {
        id: "job_expression_pack_001",
        status: "generating",
        failure_code: null,
        failure_message_safe: null,
        required_states: ["curious", "play", "hungry"],
        created_at: "2026-07-03T09:10:00.000Z",
        updated_at: "2026-07-03T09:10:30.000Z",
        generated_assets: []
      }
    });

    const result = await pollSupabaseExpressionPackFlow(client as never, "job_expression_pack_001", "pet_local_001", "2026-07-03T09:10:31.000Z");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.status).toBe("pending");
    expect(result.data.assets).toEqual([]);
  });

  it("signs and returns every generated asset once the job completes", async () => {
    const { client, signedUrlCalls } = createFakeSupabaseClient({
      jobRow: {
        id: "job_expression_pack_001",
        status: "completed",
        failure_code: null,
        failure_message_safe: null,
        required_states: ["curious", "play", "hungry"],
        created_at: "2026-07-03T09:10:00.000Z",
        updated_at: "2026-07-03T09:11:00.000Z",
        generated_assets: [
          { job_id: "job_expression_pack_001", state: "curious", storage_path: "avatars/user/job_expression_pack_001/curious.png", width: 512, height: 512 },
          { job_id: "job_expression_pack_001", state: "play", storage_path: "avatars/user/job_expression_pack_001/play.png", width: 512, height: 512 },
          { job_id: "job_expression_pack_001", state: "hungry", storage_path: "avatars/user/job_expression_pack_001/hungry.png", width: 512, height: 512 }
        ]
      }
    });

    const result = await pollSupabaseExpressionPackFlow(client as never, "job_expression_pack_001", "pet_local_001", "2026-07-03T09:11:01.000Z");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.status).toBe("completed");
    expect(result.data.assets.map((asset) => asset.state)).toEqual(["curious", "play", "hungry"]);
    expect(signedUrlCalls).toEqual([
      "avatars/user/job_expression_pack_001/curious.png",
      "avatars/user/job_expression_pack_001/play.png",
      "avatars/user/job_expression_pack_001/hungry.png"
    ]);
  });

  it("reports failed with a warm fallback message when none is provided by the server", async () => {
    const { client } = createFakeSupabaseClient({
      jobRow: {
        id: "job_expression_pack_001",
        status: "failed",
        failure_code: "generation_failed",
        failure_message_safe: null,
        required_states: ["curious", "play", "hungry"],
        created_at: "2026-07-03T09:10:00.000Z",
        updated_at: "2026-07-03T09:10:45.000Z",
        generated_assets: []
      }
    });

    const result = await pollSupabaseExpressionPackFlow(client as never, "job_expression_pack_001", "pet_local_001", "2026-07-03T09:10:46.000Z");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.status).toBe("failed");
    expect(result.data.failureMessageSafe).toBe("The tiny door got stuck. Let's try adding these expressions again.");
  });

  it("treats a lapsed device session as pending (transient), not a job failure", async () => {
    const { client } = createFakeSupabaseClient({
      session: null,
      signInError: { message: "network down" }
    });

    const result = await pollSupabaseExpressionPackFlow(client as never, "job_expression_pack_001", "pet_local_001", "2026-07-03T09:10:31.000Z");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.status).toBe("pending");
    expect(client.from).not.toHaveBeenCalled();
  });

  it("catches an unexpected throw and returns a retryable poll-failed error", async () => {
    const { client } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" }
    });

    client.from = vi.fn(() => {
      throw new Error("unexpected client failure");
    }) as never;

    const result = await pollSupabaseExpressionPackFlow(client as never, "job_expression_pack_001", "pet_local_001", "2026-07-03T09:10:31.000Z");

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("generation_job_poll_failed");
    expect(result.error.retryable).toBe(true);
  });
});
