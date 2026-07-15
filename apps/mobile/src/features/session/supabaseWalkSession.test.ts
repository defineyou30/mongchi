import { describe, expect, it, vi } from "vitest";

const { ensureSupabaseSessionMock, toMobileErrorMock } = vi.hoisted(() => ({
  ensureSupabaseSessionMock: vi.fn(async () => ({ ok: true as const, userId: "user_walk_001" })),
  toMobileErrorMock: vi.fn((status: number, code: string, messageSafe: string, retryable = false) => ({
    status,
    code,
    messageSafe,
    retryable
  }))
}));

vi.mock("./supabaseGenerationSession", () => ({
  ensureSupabaseSession: ensureSupabaseSessionMock,
  toMobileError: toMobileErrorMock
}));

vi.mock("../../shared/errors/reporter", () => ({
  reporter: { captureMessage: vi.fn() }
}));

import { purchaseSupabaseWalkEarlyReturn } from "./supabaseWalkSession";

interface FakeRpcOptions {
  data?: unknown;
  error?: { message: string } | null;
  throws?: Error;
}

const createFakeClient = (options: FakeRpcOptions = {}) => {
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });

      if (options.throws) {
        throw options.throws;
      }

      return {
        data: options.data ?? [{ outcome: "completed", balance: 8, charged_credit: 1 }],
        error: options.error ?? null
      };
    })
  };

  return { client, rpcCalls };
};

describe("purchaseSupabaseWalkEarlyReturn", () => {
  it("charges the authenticated wallet for the active walk and returns the server balance", async () => {
    const { client, rpcCalls } = createFakeClient();

    const result = await purchaseSupabaseWalkEarlyReturn(client as never, "walk_1783920000000");

    expect(result).toEqual({ ok: true, serverBalance: 8 });
    expect(rpcCalls).toEqual([
      {
        fn: "purchase_walk_early_return",
        args: { p_walk_id: "walk_1783920000000" }
      }
    ]);
  });

  it("returns the authoritative balance when the server rejects an unaffordable return", async () => {
    const { client } = createFakeClient({
      data: [{ outcome: "insufficient_credits", balance: 0, charged_credit: 0 }]
    });

    const result = await purchaseSupabaseWalkEarlyReturn(client as never, "walk_1783920000001");

    expect(result).toEqual({ ok: false, reason: "insufficient_balance", serverBalance: 0 });
  });

  it("maps an RPC failure to a retryable mobile error without reporting a successful charge", async () => {
    const { client } = createFakeClient({ error: { message: "connection reset" } });

    const result = await purchaseSupabaseWalkEarlyReturn(client as never, "walk_1783920000002");

    expect(result.ok).toBe(false);
    if (result.ok || result.reason === "insufficient_balance") {
      return;
    }

    expect(result.reason).toBe("request_failed");
    expect(result.error.code).toBe("walk_early_return_failed");
    expect(result.error.retryable).toBe(true);
  });

  it("rejects malformed RPC data instead of completing the local walk", async () => {
    const { client } = createFakeClient({ data: [{ outcome: "completed", balance: "8", charged_credit: 1 }] });

    const result = await purchaseSupabaseWalkEarlyReturn(client as never, "walk_1783920000003");

    expect(result.ok).toBe(false);
    if (result.ok || result.reason === "insufficient_balance") {
      return;
    }

    expect(result.reason).toBe("request_failed");
  });

  it("catches an unexpected client exception so the home action can be retried", async () => {
    const { client } = createFakeClient({ throws: new Error("socket closed") });

    const result = await purchaseSupabaseWalkEarlyReturn(client as never, "walk_1783920000004");

    expect(result.ok).toBe(false);
    if (result.ok || result.reason === "insufficient_balance") {
      return;
    }

    expect(result.reason).toBe("request_failed");
    expect(result.error.retryable).toBe(true);
  });
});
