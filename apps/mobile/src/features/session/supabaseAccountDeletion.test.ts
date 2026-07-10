import { describe, expect, it, vi } from "vitest";

import { deleteSupabaseAccountData } from "./supabaseAccountDeletion";

interface FakeClientOptions {
  invokeError?: unknown;
  invokeData?: unknown;
  invokeResponse?: Response;
  throwOnInvoke?: Error | null;
}

const createFakeClient = (options: FakeClientOptions = {}) => {
  const invokeCalls: Array<{ name: string; body: unknown }> = [];

  const client = {
    functions: {
      invoke: vi.fn(async (name: string, init: { body: unknown }) => {
        invokeCalls.push({ name, body: init.body });

        if (options.throwOnInvoke) {
          throw options.throwOnInvoke;
        }

        if (options.invokeError) {
          if (options.invokeResponse) {
            return { data: null, error: options.invokeError, response: options.invokeResponse };
          }

          return { data: null, error: options.invokeError };
        }

        return { data: options.invokeData !== undefined ? options.invokeData : { ok: true, summary: {} }, error: null };
      })
    }
  };

  return { client, invokeCalls };
};

describe("deleteSupabaseAccountData", () => {
  it("invokes delete-account with an empty body and returns ok on a { ok: true } response", async () => {
    const { client, invokeCalls } = createFakeClient({ invokeData: { ok: true, summary: { userId: "user-1" } } });

    const result = await deleteSupabaseAccountData(client);

    expect(result).toEqual({ ok: true });
    expect(invokeCalls).toEqual([{ name: "delete-account", body: {} }]);
  });

  it("treats a 401 invoke error as unauthorized -- nothing left to retry", async () => {
    const { client } = createFakeClient({
      invokeError: new Error("Edge Function returned a non-2xx status code"),
      invokeResponse: new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 })
    });

    const result = await deleteSupabaseAccountData(client);

    expect(result).toEqual({
      ok: false,
      reason: "unauthorized",
      retryable: false,
      code: "unauthorized",
      status: 401
    });
  });

  it("treats a 500 invoke error as a retryable network_or_server_error", async () => {
    const { client } = createFakeClient({
      invokeError: new Error("Edge Function returned a non-2xx status code"),
      invokeResponse: new Response("", { status: 500 })
    });

    const result = await deleteSupabaseAccountData(client);

    expect(result).toEqual({
      ok: false,
      reason: "network_or_server_error",
      retryable: true,
      code: "unexpected_response",
      status: 500
    });
  });

  it("preserves a typed retryable storage failure returned by the Edge Function", async () => {
    const { client } = createFakeClient({
      invokeError: new Error("Edge Function returned a non-2xx status code"),
      invokeResponse: new Response(
        JSON.stringify({ ok: false, error: { code: "storage_delete_failed", retryable: true } }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      )
    });

    const result = await deleteSupabaseAccountData(client);

    expect(result).toEqual({
      ok: false,
      reason: "network_or_server_error",
      retryable: true,
      code: "storage_delete_failed",
      status: 503
    });
  });

  it("preserves a typed retryable auth failure returned by the Edge Function", async () => {
    const { client } = createFakeClient({
      invokeError: new Error("Edge Function returned a non-2xx status code"),
      invokeResponse: new Response(
        JSON.stringify({ ok: false, error: { code: "auth_delete_failed", retryable: true } }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      )
    });

    const result = await deleteSupabaseAccountData(client);

    expect(result).toEqual({
      ok: false,
      reason: "network_or_server_error",
      retryable: true,
      code: "auth_delete_failed",
      status: 503
    });
  });

  it("treats a network-layer invoke error with no status as a retryable network_or_server_error", async () => {
    const { client } = createFakeClient({
      invokeError: new Error("Failed to send a request to the Edge Function")
    });

    const result = await deleteSupabaseAccountData(client);

    expect(result).toEqual({
      ok: false,
      reason: "network_or_server_error",
      retryable: true,
      code: "network_or_server_error",
      status: 0
    });
  });

  it("treats a raw thrown error from invoke as a retryable network_or_server_error instead of letting it escape", async () => {
    const { client } = createFakeClient({ throwOnInvoke: new Error("offline") });

    const result = await deleteSupabaseAccountData(client);

    expect(result).toEqual({
      ok: false,
      reason: "network_or_server_error",
      retryable: true,
      code: "network_or_server_error",
      status: 0
    });
  });

  it("treats an aborted invoke as retryable so account deletion can be resumed", async () => {
    const { client } = createFakeClient({ throwOnInvoke: new DOMException("cancelled", "AbortError") });

    const result = await deleteSupabaseAccountData(client);

    expect(result).toEqual({
      ok: false,
      reason: "network_or_server_error",
      retryable: true,
      code: "network_or_server_error",
      status: 0
    });
  });

  it("stays retryable across repeated aborted deletion attempts", async () => {
    const { client } = createFakeClient({ throwOnInvoke: new DOMException("cancelled", "AbortError") });

    const first = await deleteSupabaseAccountData(client);
    const second = await deleteSupabaseAccountData(client);

    expect(first).toEqual({
      ok: false,
      reason: "network_or_server_error",
      retryable: true,
      code: "network_or_server_error",
      status: 0
    });
    expect(second).toEqual(first);
  });

  it("treats a 200 response whose body reports a partial server-side failure (ok: false) as network_or_server_error", async () => {
    const { client } = createFakeClient({
      invokeData: { ok: false, summary: { storage: { originalPhotos: { errors: ["boom"] } } } }
    });

    const result = await deleteSupabaseAccountData(client);

    expect(result).toEqual({
      ok: false,
      reason: "network_or_server_error",
      retryable: true,
      code: "unexpected_response",
      status: 200
    });
  });

  it("treats a malformed/missing response body as network_or_server_error rather than throwing", async () => {
    const { client } = createFakeClient({ invokeData: null });

    const result = await deleteSupabaseAccountData(client);

    expect(result).toEqual({
      ok: false,
      reason: "network_or_server_error",
      retryable: true,
      code: "unexpected_response",
      status: 200
    });
  });
});
