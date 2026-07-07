import { describe, expect, it } from "vitest";

import {
  acceptPrototypeGeneratedPet,
  confirmPrototypeExpressionPackPurchase,
  createInitialPrototypeSession,
  expressionPacks,
  getExpressionPackById,
  getSpendableCreditBalance,
  isExpressionPackUnlocked,
  mergePrototypeGeneratedAssets,
  validatePrototypeExpressionPackPurchase
} from "../index";
import { makeMockGeneratedAsset } from "../mock/mockData";

const now = "2026-06-24T09:00:00.000Z";

describe("expressionPacks catalog", () => {
  it("defines the everyday-moments vertical slice pack with the expected states and price", () => {
    const pack = getExpressionPackById("pack-everyday-moments");

    expect(pack).not.toBeNull();
    expect(pack?.nameEn).toBe("Everyday Moments");
    expect(pack?.states).toEqual(["curious", "play", "hungry"]);
    expect(pack?.creditCost).toBe(12);
  });

  it("returns null for an unknown pack id", () => {
    expect(getExpressionPackById("pack-does-not-exist")).toBeNull();
  });

  it("exposes packs as an array so future packs can be appended", () => {
    expect(Array.isArray(expressionPacks)).toBe(true);
    expect(expressionPacks.length).toBeGreaterThan(0);
  });

  it("never overlaps the free idle/happy/sleep trio in any pack", () => {
    const freeStates = new Set(["idle", "happy", "sleep"]);

    for (const pack of expressionPacks) {
      for (const state of pack.states) {
        expect(freeStates.has(state)).toBe(false);
      }
    }
  });
});

describe("isExpressionPackUnlocked", () => {
  const pack = getExpressionPackById("pack-everyday-moments")!;

  it("is false when no matching states are present", () => {
    expect(isExpressionPackUnlocked(pack, ["idle", "happy", "sleep"])).toBe(false);
  });

  it("is false when only some matching states are present", () => {
    expect(isExpressionPackUnlocked(pack, ["idle", "happy", "sleep", "curious"])).toBe(false);
  });

  it("is true once every pack state has a matching asset", () => {
    expect(isExpressionPackUnlocked(pack, ["idle", "happy", "sleep", "curious", "play", "hungry"])).toBe(true);
  });
});

describe("validatePrototypeExpressionPackPurchase", () => {
  it("succeeds for an affordable, unowned pack", () => {
    const state = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);
    const result = validatePrototypeExpressionPackPurchase(state, "pack-everyday-moments");

    expect(result).toEqual({ ok: true, pack: getExpressionPackById("pack-everyday-moments") });
  });

  it("rejects an unknown pack id", () => {
    const state = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);

    expect(validatePrototypeExpressionPackPurchase(state, "pack-missing")).toEqual({
      ok: false,
      reason: "pack_not_found"
    });
  });

  it("rejects a pack the player already owns", () => {
    const baseState = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);
    const state = {
      ...baseState,
      inventory: { ...baseState.inventory, ownedExpressionPackIds: ["pack-everyday-moments"] }
    };

    expect(validatePrototypeExpressionPackPurchase(state, "pack-everyday-moments")).toEqual({
      ok: false,
      reason: "already_owned"
    });
  });

  it("rejects the purchase when credits are insufficient", () => {
    const baseState = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);
    const broke = { ...baseState, wallet: { ...baseState.wallet, credits: 0, bonusCredits: 0 } };

    expect(validatePrototypeExpressionPackPurchase(broke, "pack-everyday-moments")).toEqual({
      ok: false,
      reason: "insufficient_credits"
    });
  });

  it("never mutates the wallet (pre-flight check only)", () => {
    const state = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);
    const creditsBefore = getSpendableCreditBalance(state.wallet);

    validatePrototypeExpressionPackPurchase(state, "pack-everyday-moments");

    expect(getSpendableCreditBalance(state.wallet)).toBe(creditsBefore);
  });
});

describe("confirmPrototypeExpressionPackPurchase (transactional purchase)", () => {
  it("spends credits, records ownership, and leaves an expression_pack memory on success", () => {
    const state = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);
    const pack = getExpressionPackById("pack-everyday-moments")!;
    const creditsBefore = getSpendableCreditBalance(state.wallet);

    const result = confirmPrototypeExpressionPackPurchase(state, pack.id, "2026-06-24T09:05:00.000Z");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(getSpendableCreditBalance(result.state.wallet)).toBe(creditsBefore - pack.creditCost);
    expect(result.state.inventory.ownedExpressionPackIds).toContain(pack.id);
    const memory = result.state.memories.find((entry) => entry.type === "expression_pack");
    expect(memory).toBeTruthy();
    expect(memory?.refs?.itemId).toBe(pack.id);
  });

  it("leaves state completely unchanged when the pack is unknown (failure = no-op)", () => {
    const state = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);

    const result = confirmPrototypeExpressionPackPurchase(state, "pack-missing", now);

    expect(result).toEqual({ ok: false, reason: "pack_not_found" });
  });

  it("leaves the wallet and inventory completely unchanged when credits are insufficient (failure = no-op)", () => {
    const baseState = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);
    const broke = { ...baseState, wallet: { ...baseState.wallet, credits: 0, bonusCredits: 0 } };

    const result = confirmPrototypeExpressionPackPurchase(broke, "pack-everyday-moments", now);

    expect(result).toEqual({ ok: false, reason: "insufficient_credits" });
  });

  it("prevents double-purchasing the same pack (duplicate-purchase guard)", () => {
    const state = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);
    const pack = getExpressionPackById("pack-everyday-moments")!;

    const first = confirmPrototypeExpressionPackPurchase(state, pack.id, "2026-06-24T09:05:00.000Z");
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    const second = confirmPrototypeExpressionPackPurchase(first.state, pack.id, "2026-06-24T09:06:00.000Z");

    expect(second).toEqual({ ok: false, reason: "already_owned" });
    // Ownership list is not duplicated, and no second charge was attempted.
    expect(first.state.inventory.ownedExpressionPackIds?.filter((id) => id === pack.id)).toHaveLength(1);
  });

  it("prefers bonusCredits first, matching spendCredits' standard precedence", () => {
    const baseState = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);
    const pack = getExpressionPackById("pack-everyday-moments")!;
    const state = {
      ...baseState,
      wallet: { ...baseState.wallet, credits: 100, bonusCredits: 5 }
    };

    const result = confirmPrototypeExpressionPackPurchase(state, pack.id, now);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    // 5 bonus credits cover part of the 12cr cost; the rest (7) comes from credits.
    expect(result.state.wallet.bonusCredits).toBe(0);
    expect(result.state.wallet.credits).toBe(100 - (pack.creditCost - 5));
  });
});

describe("mergePrototypeGeneratedAssets", () => {
  it("adds new expression-pack assets alongside the existing free trio without dropping any", () => {
    const state = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);
    const originalStates = state.acceptedAssets.map((asset) => asset.state);
    expect(originalStates).toContain("idle");
    expect(originalStates).toContain("happy");
    expect(originalStates).toContain("sleep");

    const newAssets = ["curious", "play", "hungry"].map((assetState) =>
      makeMockGeneratedAsset(assetState as "curious" | "play" | "hungry", {
        petId: state.petProfile!.id,
        generationJobId: "gen_expression_pack_001"
      })
    );

    const merged = mergePrototypeGeneratedAssets(state, newAssets);
    const mergedStates = merged.acceptedAssets.map((asset) => asset.state);

    expect(mergedStates).toEqual(expect.arrayContaining([...originalStates, "curious", "play", "hungry"]));
    expect(merged.acceptedAssets).toHaveLength(new Set(mergedStates).size);
  });

  it("replaces an existing asset of the same state rather than duplicating it", () => {
    const state = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);
    const replacementIdle = makeMockGeneratedAsset("idle", {
      petId: state.petProfile!.id,
      generationJobId: "gen_reroll_001"
    });

    const merged = mergePrototypeGeneratedAssets(state, [replacementIdle]);
    const idleAssets = merged.acceptedAssets.filter((asset) => asset.state === "idle");

    expect(idleAssets).toHaveLength(1);
    expect(idleAssets[0]?.generationJobId).toBe("gen_reroll_001");
  });

  it("is a no-op when given an empty asset list", () => {
    const state = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);

    expect(mergePrototypeGeneratedAssets(state, [])).toBe(state);
  });

  it("preserves acceptedAsset (the primary display asset) when it is already set", () => {
    const state = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);
    const originalAcceptedAsset = state.acceptedAsset;

    const newAssets = [makeMockGeneratedAsset("curious", { petId: state.petProfile!.id, generationJobId: "gen_pack" })];
    const merged = mergePrototypeGeneratedAssets(state, newAssets);

    expect(merged.acceptedAsset).toBe(originalAcceptedAsset);
  });
});
