import { describe, expect, it } from "vitest";

import {
  acceptPrototypeGeneratedPet,
  applyPrototypeTheme,
  createInitialPrototypeSession,
  DEFAULT_THEME_ID,
  getActivePetBundle,
  getSpendableCreditBalance,
  purchasePrototypeThemeBundle,
  themeBundles
} from "../index";

const now = "2026-06-24T09:00:00.000Z";
const active = getActivePetBundle;

describe("theme bundle purchase", () => {
  it("spends credits, records ownership, and applies the background theme in one purchase", () => {
    const state = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);
    const bundle = themeBundles[0]!;
    const creditsBefore = getSpendableCreditBalance(state.wallet);

    const result = purchasePrototypeThemeBundle(state, bundle.id, "2026-06-24T09:05:00.000Z");

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.alreadyOwned).toBe(false);
    expect(getSpendableCreditBalance(result.state.wallet)).toBe(creditsBefore - bundle.creditCost);
    expect(result.state.inventory.selectedTerrariumThemeId).toBe(bundle.themeId);
    expect(result.state.inventory.ownedThemeIds).toContain(bundle.themeId);
    expect(active(result.state).currentReaction).toBeTruthy();
  });

  it("rejects the purchase when credits are insufficient", () => {
    const state = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);
    const broke = { ...state, wallet: { ...state.wallet, credits: 0, bonusCredits: 0 } };

    const result = purchasePrototypeThemeBundle(broke, themeBundles[0]!.id, now);

    expect(result).toEqual({ ok: false, reason: "insufficient_credits" });
  });

  it("rejects unknown bundle ids", () => {
    const state = createInitialPrototypeSession(now);

    expect(purchasePrototypeThemeBundle(state, "bundle_missing", now)).toEqual({ ok: false, reason: "bundle_not_found" });
  });

  it("does not re-charge credits for a theme the player already owns (re-purchase/re-apply)", () => {
    const baseState = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);
    // Enough credits for two 18cr themes plus a re-apply of the first.
    const initial = { ...baseState, wallet: { ...baseState.wallet, bonusCredits: 60 } };
    const bundle = themeBundles[0]!;

    const firstPurchase = purchasePrototypeThemeBundle(initial, bundle.id, "2026-06-24T09:05:00.000Z");
    expect(firstPurchase.ok).toBe(true);
    if (!firstPurchase.ok) {
      return;
    }

    // Switch to a different theme, then come back to the already-owned one --
    // this is exactly the "same theme, two prices" bug: re-selecting an owned
    // theme must never spend credits again.
    const secondBundle = themeBundles[1]!;
    const purchaseSecond = purchasePrototypeThemeBundle(firstPurchase.state, secondBundle.id, "2026-06-24T09:06:00.000Z");
    expect(purchaseSecond.ok).toBe(true);
    if (!purchaseSecond.ok) {
      return;
    }

    const creditsBeforeReapply = getSpendableCreditBalance(purchaseSecond.state.wallet);
    const reapply = purchasePrototypeThemeBundle(purchaseSecond.state, bundle.id, "2026-06-24T09:07:00.000Z");

    expect(reapply.ok).toBe(true);
    if (!reapply.ok) {
      return;
    }

    expect(reapply.alreadyOwned).toBe(true);
    expect(getSpendableCreditBalance(reapply.state.wallet)).toBe(creditsBeforeReapply);
    expect(reapply.state.inventory.selectedTerrariumThemeId).toBe(bundle.themeId);
    // Ownership list is not duplicated by re-purchasing.
    expect(reapply.state.inventory.ownedThemeIds.filter((id) => id === bundle.themeId)).toHaveLength(1);
  });

  it("succeeds re-applying an owned theme even with an empty wallet (no charge attempted)", () => {
    const initial = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);
    const bundle = themeBundles[0]!;
    const purchased = purchasePrototypeThemeBundle(initial, bundle.id, "2026-06-24T09:05:00.000Z");
    expect(purchased.ok).toBe(true);
    if (!purchased.ok) {
      return;
    }

    const broke = { ...purchased.state, wallet: { ...purchased.state.wallet, credits: 0, bonusCredits: 0 } };
    const reapply = purchasePrototypeThemeBundle(broke, bundle.id, "2026-06-24T09:08:00.000Z");

    expect(reapply).toMatchObject({ ok: true, alreadyOwned: true });
  });
});

describe("applyPrototypeTheme (free re-apply of an owned theme)", () => {
  it("applies the always-free default theme without touching the wallet", () => {
    const state = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);
    const creditsBefore = getSpendableCreditBalance(state.wallet);

    const result = applyPrototypeTheme(state, DEFAULT_THEME_ID, "2026-06-24T09:05:00.000Z");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.state.inventory.selectedTerrariumThemeId).toBe(DEFAULT_THEME_ID);
    expect(getSpendableCreditBalance(result.state.wallet)).toBe(creditsBefore);
  });

  it("applies an already-owned purchased theme for free", () => {
    const initial = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);
    const bundle = themeBundles[0]!;
    const purchased = purchasePrototypeThemeBundle(initial, bundle.id, "2026-06-24T09:05:00.000Z");
    expect(purchased.ok).toBe(true);
    if (!purchased.ok) {
      return;
    }

    // Apply the default theme first so selectedTerrariumThemeId changes...
    const backToDefault = applyPrototypeTheme(purchased.state, DEFAULT_THEME_ID, "2026-06-24T09:06:00.000Z");
    expect(backToDefault.ok).toBe(true);
    if (!backToDefault.ok) {
      return;
    }

    const creditsBefore = getSpendableCreditBalance(backToDefault.state.wallet);
    // ...then re-apply the owned theme via applyPrototypeTheme, not the purchase path.
    const reapplied = applyPrototypeTheme(backToDefault.state, bundle.themeId, "2026-06-24T09:07:00.000Z");

    expect(reapplied.ok).toBe(true);
    if (!reapplied.ok) {
      return;
    }

    expect(reapplied.state.inventory.selectedTerrariumThemeId).toBe(bundle.themeId);
    expect(getSpendableCreditBalance(reapplied.state.wallet)).toBe(creditsBefore);
  });

  it("refuses to apply a theme that was never purchased", () => {
    const state = acceptPrototypeGeneratedPet(createInitialPrototypeSession(now), now);
    const unownedThemeId = themeBundles[0]!.themeId;

    const result = applyPrototypeTheme(state, unownedThemeId, now);

    expect(result).toEqual({ ok: false, reason: "theme_not_owned" });
  });
});
