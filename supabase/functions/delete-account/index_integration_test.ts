import { assertEquals } from "jsr:@std/assert@1";

type EdgeHandler = (request: Request) => Response | Promise<Response>;
const USER_ID = "00000000-0000-4000-8000-000000000001" as const;

class HandlerCaptureError extends Error {
  override readonly name = "HandlerCaptureError";
}

const originalServeDescriptor = Object.getOwnPropertyDescriptor(Deno, "serve");
let capturedHandler: EdgeHandler | undefined;

Object.defineProperty(Deno, "serve", {
  configurable: true,
  value: (handler: EdgeHandler): void => {
    capturedHandler = handler;
  }
});

await import(`./index.ts?integration=${crypto.randomUUID()}`);

if (originalServeDescriptor) {
  Object.defineProperty(Deno, "serve", originalServeDescriptor);
}

if (!capturedHandler) {
  throw new HandlerCaptureError("delete-account handler was not captured");
}

const handleRequest = capturedHandler;

type StorageFailure = "original-photos" | "avatars" | null;

type UpstreamFixture = {
  readonly storageFailure: StorageFailure;
  readonly authFailure?: boolean;
  readonly storageListPayload?: unknown;
};

type UpstreamObservation = {
  readonly fetcher: typeof fetch;
  readonly authDeleteCalls: string[];
  readonly operationCalls: string[];
};

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const createUpstream = (fixture: UpstreamFixture): UpstreamObservation => {
  const authDeleteCalls: string[] = [];
  const operationCalls: string[] = [];

  const fetcher: typeof fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);

    if (url.pathname === "/auth/v1/user" && request.method === "GET") {
      return jsonResponse({
        id: USER_ID,
        aud: "authenticated",
        role: "authenticated",
        app_metadata: {},
        user_metadata: {},
        created_at: "2026-07-10T00:00:00.000Z"
      });
    }

    if (url.pathname.startsWith("/rest/v1/") && request.method === "HEAD") {
      return new Response(null, { status: 200, headers: { "Content-Range": "*/0" } });
    }

    if (url.pathname === "/storage/v1/object/list/pet-media" && request.method === "POST") {
      const body: unknown = await request.json();
      const prefix = isRecord(body) && typeof body.prefix === "string" ? body.prefix : "";
      operationCalls.push(prefix.startsWith("original-photos") ? "original-photos" : "avatars");

      if (fixture.storageFailure !== null && prefix.startsWith(fixture.storageFailure)) {
        return jsonResponse({ message: "storage unavailable" }, 503);
      }

      return jsonResponse(Object.hasOwn(fixture, "storageListPayload") ? fixture.storageListPayload : []);
    }

    if (url.pathname === "/storage/v1/object/pet-media" && request.method === "DELETE") {
      return jsonResponse([]);
    }

    if (url.pathname === `/auth/v1/admin/users/${USER_ID}` && request.method === "DELETE") {
      authDeleteCalls.push(url.pathname);
      operationCalls.push("auth");

      if (fixture.authFailure) {
        return jsonResponse({ message: "auth unavailable" }, 503);
      }

      return jsonResponse({});
    }

    return jsonResponse({ message: "unexpected upstream request" }, 500);
  };

  return { fetcher, authDeleteCalls, operationCalls };
};

const invokeWith = async (
  fixture: UpstreamFixture
): Promise<{ readonly response: Response; readonly authDeleteCalls: string[]; readonly operationCalls: string[] }> => {
  const originalFetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
  const originalUrl = Deno.env.get("SUPABASE_URL");
  const originalServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const upstream = createUpstream(fixture);

  Object.defineProperty(globalThis, "fetch", { configurable: true, value: upstream.fetcher });
  Deno.env.set("SUPABASE_URL", "http://supabase.test");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

  try {
    const response = await handleRequest(
      new Request("http://edge.test/delete-account", {
        method: "POST",
        headers: { Authorization: "Bearer test-user-token", "Content-Type": "application/json" },
        body: "{}"
      })
    );

    return { response, authDeleteCalls: upstream.authDeleteCalls, operationCalls: upstream.operationCalls };
  } finally {
    if (originalFetchDescriptor) {
      Object.defineProperty(globalThis, "fetch", originalFetchDescriptor);
    }

    if (originalUrl === undefined) Deno.env.delete("SUPABASE_URL");
    else Deno.env.set("SUPABASE_URL", originalUrl);

    if (originalServiceKey === undefined) Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    else Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", originalServiceKey);
  }
};

Deno.test("delete-account Edge handler keeps auth when original-photo storage deletion fails", async () => {
  // Given a valid caller whose original-photo prefix cannot be deleted.
  const result = await invokeWith({ storageFailure: "original-photos" });

  // When the real Edge handler executes, Then auth remains available for retry.
  assertEquals(result.authDeleteCalls.length, 0);
  assertEquals(result.response.status, 503);
  assertEquals(await result.response.json(), {
    ok: false,
    error: { code: "storage_delete_failed", retryable: true }
  });
});

Deno.test("delete-account Edge handler keeps auth when avatar storage deletion fails", async () => {
  // Given a valid caller whose avatar prefix cannot be deleted.
  const result = await invokeWith({ storageFailure: "avatars" });

  // When the real Edge handler executes, Then auth remains available for retry.
  assertEquals(result.authDeleteCalls.length, 0);
  assertEquals(result.operationCalls, ["original-photos", "avatars"]);
  assertEquals(result.response.status, 503);
});

Deno.test("delete-account Edge handler treats missing storage as a no-op and deletes auth last", async () => {
  // Given both storage prefixes list as already empty.
  const result = await invokeWith({ storageFailure: null });

  // When the real Edge handler executes, Then auth deletion is the final operation.
  assertEquals(result.operationCalls, ["original-photos", "avatars", "auth"]);
  assertEquals(result.response.status, 200);
  assertEquals(await result.response.json(), {
    ok: true,
    summary: {
      userId: USER_ID,
      storage: {
        originalPhotos: { deletedCount: 0, errors: [] },
        avatars: { deletedCount: 0, errors: [] }
      },
      tableCounts: {
        generation_jobs: 0,
        generated_assets: 0,
        generation_quota: 0,
        generation_rate_limits: 0,
        credit_wallets: 0,
        credit_ledger: 0,
        pet_slots: 0,
        conversations: 0,
        conversation_messages: 0
      },
      authUserDeleted: true,
      authDeleteError: null
    }
  });
});

Deno.test("delete-account Edge handler returns a typed retryable auth failure", async () => {
  // Given storage is empty and the auth provider fails its delete request.
  const result = await invokeWith({ storageFailure: null, authFailure: true });

  // When the real Edge handler executes, Then the failure remains retryable and privacy-safe.
  assertEquals(result.operationCalls, ["original-photos", "avatars", "auth"]);
  assertEquals(result.response.status, 503);
  assertEquals(await result.response.json(), {
    ok: false,
    error: { code: "auth_delete_failed", retryable: true }
  });
});

const malformedStoragePayloads = [
  { label: "null", payload: null },
  { label: "object", payload: { unexpected: true } },
  { label: "invalid entry array", payload: [{ name: "malformed.png", id: 42 }] }
] as const;

for (const malformed of malformedStoragePayloads) {
  Deno.test(`delete-account Edge handler keeps auth for malformed Storage list ${malformed.label}`, async () => {
    // Given the official Storage client receives an HTTP 200 payload that is not a valid file list.
    const result = await invokeWith({ storageFailure: null, storageListPayload: malformed.payload });

    // When the Edge handler runs, Then the provider response fails closed before auth deletion.
    assertEquals(result.operationCalls.slice(0, 2), ["original-photos", "avatars"]);
    assertEquals(result.authDeleteCalls.length, 0);
    assertEquals(result.response.status, 503);
    assertEquals(await result.response.json(), {
      ok: false,
      error: { code: "storage_delete_failed", retryable: true }
    });
  });
}
