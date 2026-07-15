import { describe, expect, it, vi } from "vitest";

const { ensureSupabaseSessionMock, toMobileErrorMock } = vi.hoisted(() => ({
  ensureSupabaseSessionMock: vi.fn(async () => ({ ok: true as const, userId: "user_reward_001" })),
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

import { claimSupabaseCreditReward } from "./supabaseRewardSession";

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
        data: options.data ?? [{ outcome: "granted", balance: 3 }],
        error: options.error ?? null
      };
    })
  };

  return { client, rpcCalls };
};

describe("claimSupabaseCreditReward", () => {
  it("claims the reward and returns the server balance", async () => {
    const { client, rpcCalls } = createFakeClient({ data: [{ outcome: "granted", balance: 3 }] });

    const result = await claimSupabaseCreditReward(client as never, "settle_first_feed");

    expect(result).toEqual({ ok: true, outcome: "granted", serverBalance: 3 });
    expect(rpcCalls).toEqual([{ fn: "claim_credit_reward", args: { p_reward_key: "settle_first_feed" } }]);
  });

  it("reports already_claimed as an ok idempotent replay with the current balance", async () => {
    const { client } = createFakeClient({ data: [{ outcome: "already_claimed", balance: 3 }] });

    const result = await claimSupabaseCreditReward(client as never, "settle_first_feed");

    expect(result).toEqual({ ok: true, outcome: "already_claimed", serverBalance: 3 });
  });

  it("reports unknown_reward for a key outside the server's whitelist", async () => {
    const { client } = createFakeClient({ data: [{ outcome: "unknown_reward", balance: 0 }] });

    const result = await claimSupabaseCreditReward(client as never, "not_a_real_reward");

    expect(result).toEqual({ ok: false, reason: "unknown_reward" });
  });

  it("maps an RPC failure to a retryable mobile error without granting anything", async () => {
    const { client } = createFakeClient({ error: { message: "connection reset" } });

    const result = await claimSupabaseCreditReward(client as never, "streak_3");

    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== "request_failed") {
      throw new Error("expected request_failed");
    }

    expect(result.error.code).toBe("reward_claim_failed");
    expect(result.error.retryable).toBe(true);
  });

  it("rejects malformed RPC data instead of reporting a successful claim", async () => {
    const { client } = createFakeClient({ data: [{ outcome: "granted", balance: "3" }] });

    const result = await claimSupabaseCreditReward(client as never, "streak_3");

    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== "request_failed") {
      throw new Error("expected request_failed");
    }
  });

  it("catches an unexpected client exception so the claim can be retried", async () => {
    const { client } = createFakeClient({ throws: new Error("socket closed") });

    const result = await claimSupabaseCreditReward(client as never, "bond_5");

    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== "request_failed") {
      throw new Error("expected request_failed");
    }

    expect(result.error.retryable).toBe(true);
  });

  it("propagates a failed session check without calling the RPC", async () => {
    ensureSupabaseSessionMock.mockResolvedValueOnce({
      ok: false,
      error: { status: 401, code: "not_authenticated", messageSafe: "Please sign in again.", retryable: false }
    } as never);
    const { client, rpcCalls } = createFakeClient();

    const result = await claimSupabaseCreditReward(client as never, "bond_10");

    expect(result).toEqual({
      ok: false,
      reason: "request_failed",
      error: { status: 401, code: "not_authenticated", messageSafe: "Please sign in again.", retryable: false }
    });
    expect(rpcCalls).toEqual([]);
  });
});
