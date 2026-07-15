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
  makeMockGeneratedAsset,
  setPrototypeConsentAccepted,
  setPrototypeMockPhotoSelected,
  setPrototypeSelectedPhotoUri,
  updatePrototypeDraft
} from "@mongchi/shared";
import type { PetBundle, PrototypeSessionState } from "@mongchi/shared";

import {
  hydrateServerCreditBalance,
  pollSupabaseExpressionPackFlow,
  pollSupabaseGenerationFlow,
  resolveIdleAssetStoragePath,
  resyncGeneratedAssetsFromServer,
  retrySupabaseGenerationFlow,
  startSupabaseExpressionPackFlow,
  startSupabaseGenerationFlow,
  unlockSupabaseSleepPoseForNightVisit,
  unlockSupabaseStarterPosesForCareAction
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
  signedUrlErrorPaths?: readonly string[];
  rpcData?: unknown;
  rpcError?: { message: string } | null;
  generatedAssetsRows?: Array<Record<string, unknown>>;
  generatedAssetsError?: { message: string } | null;
  // Simulates a cold-boot race where the Supabase client's persisted auth
  // session hasn't finished restoring yet: getSession() reports no session
  // for this many calls (regardless of `session`/currentSession), then
  // reports the real one from the call after that onward.
  getSessionUnavailableForCalls?: number;
}

const createFakeSupabaseClient = (options: FakeSupabaseClientOptions = {}) => {
  const invokeCalls: Array<{ name: string; body: unknown }> = [];
  const signedUrlCalls: string[] = [];
  const rpcCalls: Array<{ fn: string; args: unknown }> = [];
  let currentSession = options.session ?? null;
  let getSessionCallCount = 0;

  const client = {
    auth: {
      getSession: vi.fn(async () => {
        getSessionCallCount += 1;

        if (options.getSessionUnavailableForCalls && getSessionCallCount <= options.getSessionUnavailableForCalls) {
          return { data: { session: null } };
        }

        return { data: { session: currentSession } };
      }),
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

          if (options.signedUrlError || options.signedUrlErrorPaths?.includes(path)) {
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
    from: vi.fn((table: string) => {
      if (table === "generated_assets") {
        return {
          select: vi.fn(async (_columns: string) => {
            if (options.generatedAssetsError) {
              return { data: null, error: options.generatedAssetsError };
            }

            return { data: options.generatedAssetsRows ?? [], error: null };
          })
        };
      }

      return {
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
      };
    }),
    rpc: vi.fn(async (fn: string, args: unknown) => {
      rpcCalls.push({ fn, args });

      if (options.rpcError) {
        return { data: null, error: options.rpcError };
      }

      return { data: options.rpcData ?? null, error: null };
    })
  };

  return { client, invokeCalls, signedUrlCalls, rpcCalls };
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
        "x-upsert": "true"
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
      originalPhotoPath: "original-photos/user_anon_001/11111111-1111-4111-8111-111111111111.jpg",
      request_id: "11111111-1111-4111-8111-111111111111"
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

  it("sends Dog for a completed new-onboarding setup", async () => {
    uploadAsyncMock.mockClear();
    uploadAsyncMock.mockResolvedValueOnce({ status: 200, headers: {}, mimeType: "image/jpeg", body: "" });

    const { client, invokeCalls } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" }
    });
    const result = await startSupabaseGenerationFlow(client as never, createReadyState(), "2026-07-03T09:01:00.000Z");

    expect(result.ok).toBe(true);
    expect(invokeCalls[0]?.body).toMatchObject({
      inputSnapshot: {
        species: "dog"
      }
    });
  });

  it("sends the completed setup name with the default Dog request", async () => {
    uploadAsyncMock.mockClear();
    uploadAsyncMock.mockResolvedValueOnce({ status: 200, headers: {}, mimeType: "image/jpeg", body: "" });

    const { client, invokeCalls } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" }
    });

    const result = await startSupabaseGenerationFlow(client as never, createReadyState(), "2026-07-03T09:01:00.000Z");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(invokeCalls).toHaveLength(1);
    expect(invokeCalls[0]!.body).toEqual({
      inputSnapshot: {
        species: "dog",
        petName: "Miso",
        personalityTags: ["affectionate"],
        talkingStyle: "gentle"
      },
      originalPhotoPath: "original-photos/user_existing_001/11111111-1111-4111-8111-111111111111.jpg",
      request_id: "11111111-1111-4111-8111-111111111111"
    });
  });

  it("does not create a session, upload, or invoke generation before pet setup is complete", async () => {
    uploadAsyncMock.mockClear();
    const { client, invokeCalls } = createFakeSupabaseClient();
    let state = createInitialPrototypeSession("2026-07-03T09:00:00.000Z");
    state = setPrototypeMockPhotoSelected(state, true);
    state = setPrototypeConsentAccepted(state, true);

    const result = await startSupabaseGenerationFlow(client as never, toLegacyFlatState(state), "2026-07-03T09:01:00.000Z");

    expect(result).toMatchObject({ ok: false, error: { code: "pet_setup_required" } });
    expect(client.auth.signInAnonymously).not.toHaveBeenCalled();
    expect(uploadAsyncMock).not.toHaveBeenCalled();
    expect(invokeCalls).toHaveLength(0);
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

  it("catches an unexpected raw throw from generate-avatar invoke and returns a retryable structured failure instead of letting it escape", async () => {
    // Regression (P1c gap): unlike the poll flows, the start flow had no
    // try/catch shield of its own. Since expression-pack purchases now route
    // through this same start-flow shape to a paid server-side
    // consume_credits debit, an uncaught throw here during purchase start
    // would previously propagate as an unhandled promise rejection -- app
    // crash/hang risk with no retry path for the user.
    uploadAsyncMock.mockClear();
    uploadAsyncMock.mockResolvedValueOnce({ status: 200, headers: {}, mimeType: "image/jpeg", body: "" });

    const { client } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" }
    });

    client.functions.invoke = vi.fn(async () => {
      throw new Error("network dropped mid-request");
    }) as never;

    const result = await startSupabaseGenerationFlow(client as never, createReadyState(), "2026-07-03T09:01:00.000Z");

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("generation_start_failed");
    expect(result.error.retryable).toBe(true);
  });

  it("leaves petProfile/generation state completely untouched on a caught start-flow throw (no optimistic mutation)", async () => {
    uploadAsyncMock.mockClear();
    uploadAsyncMock.mockResolvedValueOnce({ status: 200, headers: {}, mimeType: "image/jpeg", body: "" });

    const { client } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" }
    });

    client.functions.invoke = vi.fn(async () => {
      throw new Error("network dropped mid-request");
    }) as never;

    const state = createReadyState();
    const result = await startSupabaseGenerationFlow(client as never, state, "2026-07-03T09:01:00.000Z");

    expect(result.ok).toBe(false);
    // A failed start must return no `data` payload at all -- callers only
    // apply petProfile/generation/wallet patches from `ok: true` results, so
    // the caller-side state (and thus the wallet/ownership) is guaranteed
    // unchanged as long as this stays a plain `{ ok: false, error }` shape.
    expect((result as { data?: unknown }).data).toBeUndefined();
  });

  it("retries idempotently with the same request semantics after a start-flow throw (no double invoke side effect assumed)", async () => {
    // Mirrors the ambiguous "202 came back but then it threw" case: the
    // server may have already committed its work by the time the client
    // observes a throw. The client-side contract is simply that retrying
    // calls generate-avatar again; the Edge Function's consume_credits is
    // idempotent per request_id (see startSupabaseExpressionPackFlow's doc
    // comment) so a second invoke for the same logical attempt never double
    // charges server-side. This test verifies the client-side half: after a
    // caught throw, a subsequent call succeeds normally and does not carry
    // over any broken state from the failed attempt.
    uploadAsyncMock.mockClear();
    uploadAsyncMock.mockResolvedValueOnce({ status: 200, headers: {}, mimeType: "image/jpeg", body: "" });
    uploadAsyncMock.mockResolvedValueOnce({ status: 200, headers: {}, mimeType: "image/jpeg", body: "" });

    const { client, invokeCalls } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" }
    });

    let throwOnce = true;
    const realInvoke = client.functions.invoke;
    client.functions.invoke = vi.fn(async (name: string, init: { body: unknown }) => {
      if (throwOnce) {
        throwOnce = false;
        throw new Error("network dropped mid-request");
      }

      return realInvoke(name, init);
    }) as never;

    const state = createReadyState();
    const failed = await startSupabaseGenerationFlow(client as never, state, "2026-07-03T09:01:00.000Z");
    expect(failed.ok).toBe(false);

    const retried = await startSupabaseGenerationFlow(client as never, state, "2026-07-03T09:01:05.000Z");

    expect(retried.ok).toBe(true);
    if (!retried.ok) {
      return;
    }

    expect(retried.data.petProfile?.activeGenerationJobId).toBe("job_supabase_001");
    expect(invokeCalls).toHaveLength(1);
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

  it("asks the Edge Function to resume a nonterminal job after its lease expires", async () => {
    const { client, invokeCalls } = createFakeSupabaseClient({
      jobRow: {
        id: "job_supabase_001",
        status: "generating",
        failure_code: null,
        failure_message_safe: null,
        required_states: ["idle", "happy", "sleep"],
        created_at: "2026-07-03T09:01:00.000Z",
        updated_at: "2026-07-03T09:01:30.000Z",
        lease_expires_at: "2026-07-03T09:02:00.000Z",
        generated_assets: []
      }
    });

    const result = await pollSupabaseGenerationFlow(client as never, stateWithJob(), "2026-07-03T09:02:01.000Z");

    expect(result.ok).toBe(true);
    expect(invokeCalls).toEqual([
      { name: "generate-avatar", body: { resume_job_id: "job_supabase_001" } }
    ]);
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

  it("completes starter generation when RLS exposes idle but keeps reward poses locked", async () => {
    const { client } = createFakeSupabaseClient({
      jobRow: {
        id: "job_supabase_001",
        status: "completed",
        failure_code: null,
        failure_message_safe: null,
        required_states: ["idle", "happy", "sleep"],
        created_at: "2026-07-03T09:01:00.000Z",
        updated_at: "2026-07-03T09:02:00.000Z",
        generated_assets: [
          { job_id: "job_supabase_001", state: "idle", storage_path: "generated/job_supabase_001/idle.png", width: 512, height: 512 }
        ]
      }
    });

    const result = await pollSupabaseGenerationFlow(client as never, stateWithJob(), "2026-07-03T09:02:01.000Z");

    expect(result).toMatchObject({
      ok: true,
      data: {
        generation: { status: "completed" },
        acceptedAsset: { state: "idle" },
        acceptedAssets: [{ state: "idle" }]
      }
    });
  });

  it("returns an error instead of polling forever when a completed job has no visible idle asset", async () => {
    const { client } = createFakeSupabaseClient({
      jobRow: {
        id: "job_supabase_001",
        status: "completed",
        failure_code: null,
        failure_message_safe: null,
        required_states: ["idle", "happy", "sleep"],
        created_at: "2026-07-03T09:01:00.000Z",
        updated_at: "2026-07-03T09:02:00.000Z",
        generated_assets: []
      }
    });

    const result = await pollSupabaseGenerationFlow(client as never, stateWithJob(), "2026-07-03T09:02:01.000Z");

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("generation_idle_asset_unavailable");
    expect(result.error.retryable).toBe(true);
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

    const retryRequestId = "33333333-3333-4333-8333-333333333333";
    const result = await retrySupabaseGenerationFlow(
      client as never,
      stateWithJob(),
      "2026-07-03T09:05:00.000Z",
      undefined,
      retryRequestId
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(uploadAsyncMock).toHaveBeenCalledTimes(1);
    expect(uploadAsyncMock.mock.calls[0]?.[0]).toBe(
      `https://project.supabase.co/storage/v1/object/pet-media/original-photos/user_existing_001/${retryRequestId}.jpg`
    );
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

  it("replays the persisted start request when a lost response left no local job id", async () => {
    uploadAsyncMock.mockClear();
    uploadAsyncMock.mockResolvedValueOnce({ status: 200, headers: {}, mimeType: "image/jpeg", body: "" });
    const { client, invokeCalls } = createFakeSupabaseClient();
    const requestId = "44444444-4444-4444-8444-444444444444";

    const result = await retrySupabaseGenerationFlow(
      client as never,
      createReadyState(),
      "2026-07-03T09:05:00.000Z",
      undefined,
      requestId
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(invokeCalls[0]?.body).toMatchObject({ request_id: requestId });
    expect(result.data.petProfile?.activeGenerationJobId).toBe("job_supabase_001");
    expect(result.data.generation?.retryCount).toBe(1);
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

    const result = await startSupabaseExpressionPackFlow(
      client as never,
      stateWithIdleAsset(),
      "pack-everyday-moments",
      ["curious", "play", "hungry"],
      "22222222-2222-4222-8222-222222222222"
    );

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
      expression_pack_id: "pack-everyday-moments",
      requested_states: ["curious", "play", "hungry"],
      request_id: "22222222-2222-4222-8222-222222222222"
    });
  });

  it("fails fast without invoking generate-avatar when there is no idle asset to seed from", async () => {
    const { client, invokeCalls } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" }
    });

    const result = await startSupabaseExpressionPackFlow(
      client as never,
      createReadyState(),
      "pack-everyday-moments",
      ["curious"],
      "22222222-2222-4222-8222-222222222222"
    );

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

    const result = await startSupabaseExpressionPackFlow(
      client as never,
      stateWithIdleAsset(),
      "pack-everyday-moments",
      ["curious"],
      "22222222-2222-4222-8222-222222222222"
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("rate_limited");
    expect(result.error.retryable).toBe(true);
  });

  it("maps a 402 insufficient_credits response distinctly from generation_quota_exceeded", async () => {
    const jsonMock = vi.fn(async () => ({ error: "insufficient_credits", message: "not enough credits" }));
    const { client } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" },
      invokeError: { message: "insufficient credits", context: { status: 402, json: jsonMock } as never }
    });

    const result = await startSupabaseExpressionPackFlow(
      client as never,
      stateWithIdleAsset(),
      "pack-everyday-moments",
      ["curious"],
      "22222222-2222-4222-8222-222222222222"
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("insufficient_credits");
    expect(result.error.status).toBe(402);
  });

  it("preserves an idempotency conflict as a definitive expression-pack failure", async () => {
    const jsonMock = vi.fn(async () => ({
      error: "idempotency_conflict",
      message: "That request id belongs to a different pose pack."
    }));
    const { client } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" },
      invokeError: { message: "conflict", context: { status: 409, json: jsonMock } as never }
    });

    const result = await startSupabaseExpressionPackFlow(
      client as never,
      stateWithIdleAsset(),
      "pack-everyday-moments",
      ["curious"],
      "22222222-2222-4222-8222-222222222222"
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("idempotency_conflict");
    expect(result.error.retryable).toBe(false);
    expect(result.error.status).toBe(409);
    expect(result.error.messageSafe).toBe("That request id belongs to a different pose pack.");
  });

  it("catches an unexpected raw throw from generate-avatar invoke and returns a retryable structured failure instead of crashing", async () => {
    // Regression (P1c gap this test is written for): expression-pack
    // purchases trigger a real, server-side paid consume_credits debit. If a
    // network/client throw during invoke escaped uncaught, it would surface
    // as an unhandled promise rejection with no retry affordance -- exactly
    // the crash/no-recourse risk credit Phase 1c's §6.4 "no optimistic paid
    // generation" guidance is meant to prevent.
    const { client } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" }
    });

    client.functions.invoke = vi.fn(async () => {
      throw new Error("connection reset mid-request");
    }) as never;

    const result = await startSupabaseExpressionPackFlow(
      client as never,
      stateWithIdleAsset(),
      "pack-everyday-moments",
      ["curious"],
      "22222222-2222-4222-8222-222222222222"
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("expression_pack_start_failed");
    expect(result.error.retryable).toBe(true);
  });

  it("returns no data payload on a caught throw, so the caller applies no wallet/ownership mutation", async () => {
    const { client } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" }
    });

    client.functions.invoke = vi.fn(async () => {
      throw new Error("connection reset mid-request");
    }) as never;

    const result = await startSupabaseExpressionPackFlow(
      client as never,
      stateWithIdleAsset(),
      "pack-everyday-moments",
      ["curious"],
      "22222222-2222-4222-8222-222222222222"
    );

    expect(result.ok).toBe(false);
    expect((result as { data?: unknown }).data).toBeUndefined();
  });

  it("retries with the same request_id after a caught throw and only invokes generate-avatar once more (idempotency key reused, not minted fresh)", async () => {
    // The double-charge safety net for the "202 came back but then it threw"
    // ambiguous case relies on callers reusing the same requestId across a
    // retry of the same purchase attempt (see this function's own doc
    // comment: consume_credits is idempotent on request_id). This test pins
    // down the client-side half of that contract: a retry call with the same
    // requestId after a caught throw sends that same request_id again, not a
    // freshly minted one.
    const { client, invokeCalls } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" },
      invokeData: { jobId: "job_expression_pack_002" }
    });

    let throwOnce = true;
    const realInvoke = client.functions.invoke;
    client.functions.invoke = vi.fn(async (name: string, init: { body: unknown }) => {
      if (throwOnce) {
        throwOnce = false;
        throw new Error("connection reset mid-request");
      }

      return realInvoke(name, init);
    }) as never;

    const sameRequestId = "22222222-2222-4222-8222-222222222222";
    const failed = await startSupabaseExpressionPackFlow(
      client as never,
      stateWithIdleAsset(),
      "pack-everyday-moments",
      ["curious"],
      sameRequestId
    );
    expect(failed.ok).toBe(false);

    const retried = await startSupabaseExpressionPackFlow(
      client as never,
      stateWithIdleAsset(),
      "pack-everyday-moments",
      ["curious"],
      sameRequestId
    );

    expect(retried.ok).toBe(true);
    if (!retried.ok) {
      return;
    }

    expect(retried.data.jobId).toBe("job_expression_pack_002");
    expect(invokeCalls).toHaveLength(1);
    expect(invokeCalls[0]!.body).toMatchObject({ request_id: sameRequestId });
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

  it("asks the Edge Function to resume an expression pack after its lease expires", async () => {
    const { client, invokeCalls } = createFakeSupabaseClient({
      jobRow: {
        id: "job_expression_pack_001",
        status: "generating",
        lease_expires_at: "2026-07-03T09:10:30.000Z",
        failure_code: null,
        failure_message_safe: null,
        required_states: ["curious", "play", "hungry"],
        created_at: "2026-07-03T09:10:00.000Z",
        updated_at: "2026-07-03T09:10:30.000Z",
        generated_assets: []
      }
    });

    const result = await pollSupabaseExpressionPackFlow(
      client as never,
      "job_expression_pack_001",
      "pet_local_001",
      "2026-07-03T09:10:31.000Z"
    );

    expect(result).toMatchObject({ ok: true, data: { status: "pending" } });
    expect(invokeCalls).toContainEqual({
      name: "generate-avatar",
      body: { resume_job_id: "job_expression_pack_001" }
    });
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

  it("keeps a completed pack pending when even one of its three URLs cannot be signed", async () => {
    const failedPath = "avatars/user/job_expression_pack_001/hungry.png";
    const { client } = createFakeSupabaseClient({
      signedUrlErrorPaths: [failedPath],
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
          { job_id: "job_expression_pack_001", state: "hungry", storage_path: failedPath, width: 512, height: 512 }
        ]
      }
    });

    const result = await pollSupabaseExpressionPackFlow(client as never, "job_expression_pack_001", "pet_local_001", "2026-07-03T09:11:01.000Z");

    expect(result).toMatchObject({ ok: true, data: { status: "pending", assets: [] } });
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

describe("starter pose unlock flow", () => {
  it("unlocks and signs happy after the first care action", async () => {
    const idle = makeMockGeneratedAsset("idle", { petId: "pet_local_001", generationJobId: "job_starter_001" });
    const state = { ...createMockPhotoState(), acceptedAsset: idle, acceptedAssets: [idle] };
    const { client, rpcCalls } = createFakeSupabaseClient({
      rpcData: [
        {
          job_id: "job_starter_001",
          state: "happy",
          storage_path: "avatars/user/job_starter_001/happy.png",
          width: 512,
          height: 512
        }
      ]
    });

    const result = await unlockSupabaseStarterPosesForCareAction(client as never, state, "feed", "2026-07-03T09:20:00.000Z");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.assets.map((asset) => asset.state)).toEqual(["happy"]);
    expect(rpcCalls).toEqual([
      {
        fn: "unlock_starter_poses_for_care_action",
        args: { p_action: "feed", p_job_id: "job_starter_001" }
      }
    ]);
  });

  it("requests happy and sleep atomically when the care action is rest", async () => {
    const idle = makeMockGeneratedAsset("idle", { petId: "pet_local_001", generationJobId: "job_starter_001" });
    const state = { ...createMockPhotoState(), acceptedAsset: idle, acceptedAssets: [idle] };
    const { client, rpcCalls } = createFakeSupabaseClient({
      rpcData: [
        {
          job_id: "job_starter_001",
          state: "happy",
          storage_path: "avatars/user/job_starter_001/happy.png",
          width: 512,
          height: 512
        },
        {
          job_id: "job_starter_001",
          state: "sleep",
          storage_path: "avatars/user/job_starter_001/sleep.png",
          width: 512,
          height: 512
        }
      ]
    });

    const result = await unlockSupabaseStarterPosesForCareAction(client as never, state, "rest", "2026-07-03T09:20:00.000Z");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.assets.map((asset) => asset.state)).toEqual(["happy", "sleep"]);
    expect(rpcCalls).toEqual([
      {
        fn: "unlock_starter_poses_for_care_action",
        args: { p_action: "rest", p_job_id: "job_starter_001" }
      }
    ]);
  });
});

describe("sleep pose night unlock flow", () => {
  it("unlocks and signs the sleep pose with no p_job_id/p_action args (unlike unlock_starter_poses_for_care_action, this RPC is user-wide)", async () => {
    const idle = makeMockGeneratedAsset("idle", { petId: "pet_local_001", generationJobId: "job_starter_001" });
    const state = { ...createMockPhotoState(), acceptedAsset: idle, acceptedAssets: [idle] };
    const { client, rpcCalls } = createFakeSupabaseClient({
      rpcData: [
        {
          job_id: "job_starter_001",
          state: "sleep",
          storage_path: "avatars/user/job_starter_001/sleep.png",
          width: 512,
          height: 512
        }
      ]
    });

    const result = await unlockSupabaseSleepPoseForNightVisit(client as never, state, "2026-07-14T23:10:00.000Z");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.assets.map((asset) => asset.state)).toEqual(["sleep"]);
    expect(rpcCalls).toEqual([{ fn: "unlock_sleep_pose_for_night_visit", args: undefined }]);
  });

  it("returns no assets, without calling the RPC's data through, when the pet has no accepted asset yet", async () => {
    const state = createMockPhotoState();
    const { client, rpcCalls } = createFakeSupabaseClient();

    const result = await unlockSupabaseSleepPoseForNightVisit(client as never, state, "2026-07-14T23:10:00.000Z");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.assets).toEqual([]);
    expect(rpcCalls).toEqual([]);
  });

  it("is a harmless no-op (empty assets, not an error) when the sleep pose is already unlocked", async () => {
    const idle = makeMockGeneratedAsset("idle", { petId: "pet_local_001", generationJobId: "job_starter_001" });
    const state = { ...createMockPhotoState(), acceptedAsset: idle, acceptedAssets: [idle] };
    const { client, rpcCalls } = createFakeSupabaseClient({ rpcData: [] });

    const result = await unlockSupabaseSleepPoseForNightVisit(client as never, state, "2026-07-14T23:10:00.000Z");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.assets).toEqual([]);
    expect(rpcCalls).toEqual([{ fn: "unlock_sleep_pose_for_night_visit", args: undefined }]);
  });

  it("returns a retryable error when the RPC call fails", async () => {
    const idle = makeMockGeneratedAsset("idle", { petId: "pet_local_001", generationJobId: "job_starter_001" });
    const state = { ...createMockPhotoState(), acceptedAsset: idle, acceptedAssets: [idle] };
    const { client } = createFakeSupabaseClient({ rpcError: { message: "unavailable" } });

    const result = await unlockSupabaseSleepPoseForNightVisit(client as never, state, "2026-07-14T23:10:00.000Z");

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("sleep_pose_unlock_failed");
    expect(result.error.retryable).toBe(true);
  });
});

describe("resyncGeneratedAssetsFromServer", () => {
  it("signs and returns every unlocked row RLS returns for the first pet (pet_id null)", async () => {
    const { client, signedUrlCalls } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" },
      generatedAssetsRows: [
        { job_id: "job_starter_001", pet_id: null, state: "idle", storage_path: "avatars/user/job_starter_001/idle.png", width: 512, height: 512 },
        { job_id: "job_starter_001", pet_id: null, state: "happy", storage_path: "avatars/user/job_starter_001/happy.png", width: 512, height: 512 },
        { job_id: "job_pack_curious", pet_id: null, state: "curious", storage_path: "avatars/user/job_pack_curious/curious.png", width: 512, height: 512 }
      ]
    });

    const result = await resyncGeneratedAssetsFromServer(client as never, "pet_local_001", "pet_local_001", "2026-07-14T09:00:00.000Z");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.assets.map((asset) => asset.state)).toEqual(["idle", "happy", "curious"]);
    expect(result.data.assets.every((asset) => asset.petId === "pet_local_001")).toBe(true);
    expect(signedUrlCalls).toEqual([
      "avatars/user/job_starter_001/idle.png",
      "avatars/user/job_starter_001/happy.png",
      "avatars/user/job_pack_curious/curious.png"
    ]);
  });

  it("regression: a default pet whose PetProfile.id is a UUID (not the FIRST_PET_ID string) is still scoped to pet_id IS NULL via the bundle key, not the UUID", async () => {
    // Real-device bug this guards against: PetProfile.id is a freshly minted
    // `pet_local_<uuid>` once real generation starts (see
    // startSupabaseGenerationFlowInner), never the literal "pet_local_001"
    // post-generation -- an earlier version of this flow compared THAT uuid
    // against FIRST_PET_ID for the filter decision, which was always false,
    // so it fell through to an equality filter against the uuid and matched
    // zero of the account's actual (pet_id NULL) rows. bundlePetId (the pet
    // *bundle key*, state.activePetId -- always FIRST_PET_ID for the one
    // pet this codebase supports today, see PetBundle's INV-1 doc comment)
    // must be what decides the filter; assetPetId (the uuid) must only tag
    // the resulting assets.
    const uuidProfileId = "pet_local_b6c0f2ac-37bc-42b3-a3ec-3c49a66cc779";
    const { client } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" },
      generatedAssetsRows: [
        { job_id: "job_starter_001", pet_id: null, state: "idle", storage_path: "avatars/user/job_starter_001/idle.png", width: 512, height: 512 },
        { job_id: "job_starter_001", pet_id: null, state: "happy", storage_path: "avatars/user/job_starter_001/happy.png", width: 512, height: 512 },
        { job_id: "job_pack_curious", pet_id: null, state: "curious", storage_path: "avatars/user/job_pack_curious/curious.png", width: 512, height: 512 },
        { job_id: "job_pack_play", pet_id: null, state: "play", storage_path: "avatars/user/job_pack_play/play.png", width: 512, height: 512 },
        { job_id: "job_pack_hungry", pet_id: null, state: "hungry", storage_path: "avatars/user/job_pack_hungry/hungry.png", width: 512, height: 512 }
      ]
    });

    const result = await resyncGeneratedAssetsFromServer(client as never, "pet_local_001", uuidProfileId, "2026-07-14T09:00:00.000Z");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.assets.map((asset) => asset.state)).toEqual(["idle", "happy", "curious", "play", "hungry"]);
    // Tagged with the profile uuid (matching every other asset already in
    // acceptedAssets), not the bundle key used for the filter decision.
    expect(result.data.assets.every((asset) => asset.petId === uuidProfileId)).toBe(true);
  });

  it("scopes rows to the given pet's bundle key, excluding another pet's rows", async () => {
    const { client } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" },
      generatedAssetsRows: [
        { job_id: "job_starter_001", pet_id: null, state: "idle", storage_path: "avatars/user/job_starter_001/idle.png", width: 512, height: 512 },
        { job_id: "job_starter_002", pet_id: "pet_second_001", state: "idle", storage_path: "avatars/user/job_starter_002/idle.png", width: 512, height: 512 }
      ]
    });

    const first = await resyncGeneratedAssetsFromServer(client as never, "pet_local_001", "pet_local_001", "2026-07-14T09:00:00.000Z");
    const second = await resyncGeneratedAssetsFromServer(client as never, "pet_second_001", "pet_second_001", "2026-07-14T09:00:00.000Z");

    expect(first.ok && first.data.assets.map((asset) => asset.generationJobId)).toEqual(["job_starter_001"]);
    expect(second.ok && second.data.assets.map((asset) => asset.generationJobId)).toEqual(["job_starter_002"]);
  });

  it("returns no assets without erroring when RLS/the query returns nothing", async () => {
    const { client } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" },
      generatedAssetsRows: []
    });

    const result = await resyncGeneratedAssetsFromServer(client as never, "pet_local_001", "pet_local_001", "2026-07-14T09:00:00.000Z");

    expect(result.ok).toBe(true);
    expect(result.ok && result.data.assets).toEqual([]);
  });

  it("surfaces a not-yet-ready session as a retryable ok:false, never as a silent empty success", async () => {
    // Regression guard: an earlier version of this flow treated "no session"
    // as an ok:true empty result, indistinguishable from "queried fine, truly
    // nothing to sync." TerrariumSessionProvider's one-shot resync guard was
    // consumed synchronously before this resolved, so a session that simply
    // hadn't finished restoring yet (see the race test below) permanently
    // burned the device's only resync attempt. ok:false is what lets the
    // caller know to retry instead of giving up.
    const { client } = createFakeSupabaseClient({
      session: null,
      signInError: { message: "network unreachable" }
    });

    const result = await resyncGeneratedAssetsFromServer(client as never, "pet_local_001", "pet_local_001", "2026-07-14T09:00:00.000Z");

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("generated_assets_resync_session_not_ready");
    expect(!result.ok && result.error.retryable).toBe(true);
  });

  it("recovers on a later attempt once a session that was still restoring becomes available (the cold-boot race this guards against)", async () => {
    const { client } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" },
      // The first getSession() call can't see the persisted session yet
      // (still restoring), and signInAnonymously (ensureSupabaseSession's
      // fallback) also fails, exactly like a device whose network stack
      // isn't ready a split second after cold boot -- the existing
      // persisted session is never overwritten by that failed attempt.
      signInError: { message: "network not ready" },
      getSessionUnavailableForCalls: 1,
      generatedAssetsRows: [
        { job_id: "job_starter_001", pet_id: null, state: "idle", storage_path: "avatars/user/job_starter_001/idle.png", width: 512, height: 512 },
        { job_id: "job_pack_curious", pet_id: null, state: "curious", storage_path: "avatars/user/job_pack_curious/curious.png", width: 512, height: 512 }
      ]
    });

    const firstAttempt = await resyncGeneratedAssetsFromServer(client as never, "pet_local_001", "pet_local_001", "2026-07-14T09:00:00.000Z");

    expect(firstAttempt.ok).toBe(false);
    expect(!firstAttempt.ok && firstAttempt.error.retryable).toBe(true);

    // A caller that (correctly) left its one-shot guard untouched after that
    // ok:false retries with the same client shortly after -- by now the
    // session that was still restoring is visible, so this attempt succeeds
    // and returns every unlocked asset ready to merge.
    const secondAttempt = await resyncGeneratedAssetsFromServer(client as never, "pet_local_001", "pet_local_001", "2026-07-14T09:05:00.000Z");

    expect(secondAttempt.ok).toBe(true);
    expect(secondAttempt.ok && secondAttempt.data.assets.map((asset) => asset.state)).toEqual(["idle", "curious"]);
  });

  it("maps a query error to a retryable resync-failed error", async () => {
    const { client } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" },
      generatedAssetsError: { message: "permission denied" }
    });

    const result = await resyncGeneratedAssetsFromServer(client as never, "pet_local_001", "pet_local_001", "2026-07-14T09:00:00.000Z");

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("generated_assets_resync_failed");
    expect(!result.ok && result.error.retryable).toBe(true);
  });

  it("catches an unexpected throw and returns a retryable resync-failed error instead of crashing", async () => {
    const { client } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" }
    });
    client.from = vi.fn(() => {
      throw new Error("unexpected client failure");
    });

    const result = await resyncGeneratedAssetsFromServer(client as never, "pet_local_001", "pet_local_001", "2026-07-14T09:00:00.000Z");

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("generated_assets_resync_failed");
  });
});

describe("hydrateServerCreditBalance (credit Phase 1c, design doc §6.2)", () => {
  it("reads the server balance via get_credit_balance and returns it as credits", async () => {
    const { client, rpcCalls } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" },
      rpcData: 37
    });

    const result = await hydrateServerCreditBalance(client as never);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.credits).toBe(37);
    expect(rpcCalls).toEqual([{ fn: "get_credit_balance", args: { p_user: "user_existing_001" } }]);
  });

  it("signs in anonymously first when there is no existing session, same as the generation flows", async () => {
    const { client, rpcCalls } = createFakeSupabaseClient({ session: null, rpcData: 0 });

    const result = await hydrateServerCreditBalance(client as never);

    expect(result.ok).toBe(true);
    expect(rpcCalls).toEqual([{ fn: "get_credit_balance", args: { p_user: "user_anon_001" } }]);
  });

  it("returns a retryable error when the RPC call fails, without throwing", async () => {
    const { client } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" },
      rpcError: { message: "connection reset" }
    });

    const result = await hydrateServerCreditBalance(client as never);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("credit_balance_fetch_failed");
    expect(result.error.retryable).toBe(true);
  });

  it("returns a retryable error when the RPC resolves with a non-numeric payload", async () => {
    const { client } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" },
      rpcData: null
    });

    const result = await hydrateServerCreditBalance(client as never);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("credit_balance_fetch_failed");
  });

  it("catches an unexpected throw and returns a retryable error instead of propagating", async () => {
    const { client } = createFakeSupabaseClient({
      session: { user: { id: "user_existing_001" }, access_token: "token_existing_001" }
    });

    client.rpc = vi.fn(() => {
      throw new Error("unexpected client failure");
    }) as never;

    const result = await hydrateServerCreditBalance(client as never);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("credit_balance_fetch_failed");
    expect(result.error.retryable).toBe(true);
  });
});
