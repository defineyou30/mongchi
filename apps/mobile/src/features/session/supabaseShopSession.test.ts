import { describe, expect, it, vi } from "vitest";

const { ensureSupabaseSessionMock, toMobileErrorMock } = vi.hoisted(() => ({
  ensureSupabaseSessionMock: vi.fn(async () => ({ ok: true as const, userId: "user_shop_001" })),
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

import { purchaseSupabaseInventoryItem, purchaseSupabaseThemeBundle } from "./supabaseShopSession";

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
        data: options.data ?? [{ outcome: "purchased", balance: 8 }],
        error: options.error ?? null
      };
    })
  };

  return { client, rpcCalls };
};

describe("purchaseSupabaseInventoryItem", () => {
  it("charges the authenticated wallet for the item and returns the server balance", async () => {
    const { client, rpcCalls } = createFakeClient();

    const result = await purchaseSupabaseInventoryItem(client as never, "item_bone_biscuit", "req_item_001");

    expect(result).toEqual({ ok: true, serverBalance: 8 });
    expect(rpcCalls).toEqual([
      {
        fn: "purchase_inventory_item",
        args: { p_item_id: "item_bone_biscuit", p_request_id: "req_item_001" }
      }
    ]);
  });

  it("returns the authoritative balance when the server rejects an unaffordable purchase", async () => {
    const { client } = createFakeClient({ data: [{ outcome: "insufficient_credits", balance: 1 }] });

    const result = await purchaseSupabaseInventoryItem(client as never, "item_bone_biscuit", "req_item_002");

    expect(result).toEqual({ ok: false, reason: "insufficient_balance", serverBalance: 1 });
  });

  it("reports unknown_item without a server balance for an id outside the server's whitelist", async () => {
    const { client } = createFakeClient({ data: [{ outcome: "unknown_item", balance: 3 }] });

    const result = await purchaseSupabaseInventoryItem(client as never, "item_stepping_stone_path", "req_item_003");

    expect(result).toEqual({ ok: false, reason: "unknown_item" });
  });

  it("maps an RPC failure to a retryable mobile error without reporting a successful charge", async () => {
    const { client } = createFakeClient({ error: { message: "connection reset" } });

    const result = await purchaseSupabaseInventoryItem(client as never, "item_bone_biscuit", "req_item_004");

    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== "request_failed") {
      throw new Error("expected request_failed");
    }

    expect(result.error.code).toBe("shop_purchase_failed");
    expect(result.error.retryable).toBe(true);
  });

  it("rejects malformed RPC data instead of granting the item locally", async () => {
    const { client } = createFakeClient({ data: [{ outcome: "purchased", balance: "8" }] });

    const result = await purchaseSupabaseInventoryItem(client as never, "item_bone_biscuit", "req_item_005");

    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== "request_failed") {
      throw new Error("expected request_failed");
    }
  });

  it("catches an unexpected client exception so the purchase can be retried", async () => {
    const { client } = createFakeClient({ throws: new Error("socket closed") });

    const result = await purchaseSupabaseInventoryItem(client as never, "item_bone_biscuit", "req_item_006");

    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== "request_failed") {
      throw new Error("expected request_failed");
    }

    expect(result.error.retryable).toBe(true);
  });
});

describe("purchaseSupabaseThemeBundle", () => {
  it("charges the authenticated wallet for the theme bundle and returns the server balance", async () => {
    const { client, rpcCalls } = createFakeClient({ data: [{ outcome: "purchased", balance: 12 }] });

    const result = await purchaseSupabaseThemeBundle(client as never, "bundle_fairy_garden", "req_theme_001");

    expect(result).toEqual({ ok: true, serverBalance: 12 });
    expect(rpcCalls).toEqual([
      {
        fn: "purchase_theme_bundle",
        args: { p_bundle_id: "bundle_fairy_garden", p_request_id: "req_theme_001" }
      }
    ]);
  });

  it("returns the authoritative balance when the server rejects an unaffordable purchase", async () => {
    const { client } = createFakeClient({ data: [{ outcome: "insufficient_credits", balance: 4 }] });

    const result = await purchaseSupabaseThemeBundle(client as never, "bundle_fairy_garden", "req_theme_002");

    expect(result).toEqual({ ok: false, reason: "insufficient_balance", serverBalance: 4 });
  });

  it("reports unknown_item for a bundle id outside the server's whitelist", async () => {
    const { client } = createFakeClient({ data: [{ outcome: "unknown_item", balance: 4 }] });

    const result = await purchaseSupabaseThemeBundle(client as never, "bundle_does_not_exist", "req_theme_003");

    expect(result).toEqual({ ok: false, reason: "unknown_item" });
  });

  it("maps an RPC failure to a retryable mobile error", async () => {
    const { client } = createFakeClient({ error: { message: "connection reset" } });

    const result = await purchaseSupabaseThemeBundle(client as never, "bundle_fairy_garden", "req_theme_004");

    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== "request_failed") {
      throw new Error("expected request_failed");
    }

    expect(result.error.code).toBe("shop_purchase_failed");
    expect(result.error.retryable).toBe(true);
  });

  it("catches an unexpected client exception so the purchase can be retried", async () => {
    const { client } = createFakeClient({ throws: new Error("socket closed") });

    const result = await purchaseSupabaseThemeBundle(client as never, "bundle_fairy_garden", "req_theme_005");

    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== "request_failed") {
      throw new Error("expected request_failed");
    }
  });
});
