import { describe, expect, it, vi } from "vitest";

import { deleteSupabaseAccountData } from "./supabaseAccountDeletion";

interface FakeClientOptions {
  invokeError?: { message: string; context?: { status?: number } } | null;
  invokeData?: unknown;
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

    const result = await deleteSupabaseAccountData(client as never);

    expect(result).toEqual({ ok: true });
    expect(invokeCalls).toEqual([{ name: "delete-account", body: {} }]);
  });

  it("treats a 401 invoke error as unauthorized -- nothing left to retry", async () => {
    const { client } = createFakeClient({
      invokeError: { message: "Edge Function returned a non-2xx status code", context: { status: 401 } }
    });

    const result = await deleteSupabaseAccountData(client as never);

    expect(result).toEqual({ ok: false, reason: "unauthorized" });
  });

  it("treats a 500 invoke error as a retryable network_or_server_error", async () => {
    const { client } = createFakeClient({
      invokeError: { message: "Edge Function returned a non-2xx status code", context: { status: 500 } }
    });

    const result = await deleteSupabaseAccountData(client as never);

    expect(result).toEqual({ ok: false, reason: "network_or_server_error" });
  });

  it("treats a network-layer invoke error with no status as a retryable network_or_server_error", async () => {
    const { client } = createFakeClient({
      invokeError: { message: "Failed to send a request to the Edge Function" }
    });

    const result = await deleteSupabaseAccountData(client as never);

    expect(result).toEqual({ ok: false, reason: "network_or_server_error" });
  });

  it("treats a raw thrown error from invoke as a retryable network_or_server_error instead of letting it escape", async () => {
    const { client } = createFakeClient({ throwOnInvoke: new Error("offline") });

    const result = await deleteSupabaseAccountData(client as never);

    expect(result).toEqual({ ok: false, reason: "network_or_server_error" });
  });

  it("treats a 200 response whose body reports a partial server-side failure (ok: false) as network_or_server_error", async () => {
    const { client } = createFakeClient({
      invokeData: { ok: false, summary: { storage: { originalPhotos: { errors: ["boom"] } } } }
    });

    const result = await deleteSupabaseAccountData(client as never);

    expect(result).toEqual({ ok: false, reason: "network_or_server_error" });
  });

  it("treats a malformed/missing response body as network_or_server_error rather than throwing", async () => {
    const { client } = createFakeClient({ invokeData: null });

    const result = await deleteSupabaseAccountData(client as never);

    expect(result).toEqual({ ok: false, reason: "network_or_server_error" });
  });
});
