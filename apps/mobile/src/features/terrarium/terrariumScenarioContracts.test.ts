import { describe, expect, it } from "vitest";

import { createInitialPrototypeSession, isTreatInventoryItem, mockItems } from "@mongchi/shared";

import { gameItemAssetByCatalogId } from "../../shared/assets/gameItemCatalogMapping";
import { getVisibleHomeCareMenuOptions } from "./terrariumHomeCareMenu";
import {
  getHomeCareActionCooldownLeftMs,
  getHomeCarePressDecision,
  homeActionFeedbackMs,
  homeCareActionCooldownMs,
  homeFloatingDockActions
} from "./terrariumHomeInteractionContract";

describe("terrarium interaction scenario contracts", () => {
  it("keeps the tappable dock limited to the five primary home actions", () => {
    expect(homeFloatingDockActions).toEqual(["feed", "play", "walk", "affection", "water_garden"]);
  });

  it("keeps treats cooldown-free so owners can use a purchased treat on demand", () => {
    // Treats are a paid/owned consumable, not a rhythm action -- a cooldown
    // here just blocked owners from using what they already paid for (see
    // the mongchi "구매 아이템 쿨다운 면제" fix). Button-mashing is stopped by
    // the shared 3s global action lock instead; bond XP farming is capped
    // separately (careStats.ts).
    expect(homeCareActionCooldownMs.treat).toBe(0);
  });

  it("routes feed taps through the food tray while meal cooldowns stay action-scoped", () => {
    const nowMs = 1_000;
    const cooldownUntilByAction = {
      feed: nowMs + 60_000
    };

    expect(getHomeCareActionCooldownLeftMs("feed", cooldownUntilByAction, nowMs)).toBe(60_000);
    expect(getHomeCareActionCooldownLeftMs("play", cooldownUntilByAction, nowMs)).toBe(0);
  });

  it("keeps action feedback visible longer than the short global input lock", () => {
    expect(homeActionFeedbackMs).toBeGreaterThanOrEqual(4_500);
  });

  it("blocks a second action only while the global input lock is active", () => {
    const firstDecision = getHomeCarePressDecision({
      action: "feed",
      nowMs: 1_000,
      cooldownUntilByAction: {},
      actionLockedUntilMs: 0,
      activeWalkStatus: null,
      availableTreatItemId: null
    });

    expect(firstDecision.kind).toBe("perform");

    if (firstDecision.kind !== "perform") {
      return;
    }

    expect(
      getHomeCarePressDecision({
        action: "play",
        nowMs: 1_100,
        cooldownUntilByAction: {
          feed: firstDecision.cooldownUntilMs
        },
        actionLockedUntilMs: firstDecision.lockUntilMs,
        activeWalkStatus: null,
        availableTreatItemId: null
      })
    ).toEqual({
      kind: "blocked",
      reason: "global_action_lock"
    });
  });

  it("keeps persisted cooldowns authoritative after route changes", () => {
    expect(
      getHomeCarePressDecision({
        action: "walk",
        nowMs: 20_000,
        cooldownUntilByAction: {
          walk: 80_000
        },
        actionLockedUntilMs: 0,
        activeWalkStatus: null,
        availableTreatItemId: null
      })
    ).toEqual({
      kind: "cooldown",
      cooldownLeftMs: 60_000
    });
  });

  it("prevents duplicate walk starts while a pet is already on the path", () => {
    expect(
      getHomeCarePressDecision({
        action: "walk",
        nowMs: 1_000,
        cooldownUntilByAction: {},
        actionLockedUntilMs: 0,
        activeWalkStatus: "walking",
        availableTreatItemId: null
      })
    ).toEqual({
      kind: "blocked",
      reason: "active_walk"
    });
  });

  it("sends treat taps to the shop until a consumable treat exists", () => {
    expect(
      getHomeCarePressDecision({
        action: "treat",
        nowMs: 1_000,
        cooldownUntilByAction: {},
        actionLockedUntilMs: 0,
        activeWalkStatus: null,
        availableTreatItemId: null
      })
    ).toEqual({
      kind: "shop",
      reason: "missing_treat_inventory"
    });

    expect(
      getHomeCarePressDecision({
        action: "treat",
        nowMs: 1_000,
        cooldownUntilByAction: {},
        actionLockedUntilMs: 0,
        activeWalkStatus: null,
        availableTreatItemId: "item_treat_plate_biscuit"
      })
    ).toMatchObject({
      kind: "perform",
      action: "treat",
      itemId: "item_treat_plate_biscuit"
    });
  });

  it("lets a purchased treat be used back-to-back with no cooldown gate (only the 3s action lock applies)", () => {
    const nowMs = 1_000;
    const firstDecision = getHomeCarePressDecision({
      action: "treat",
      nowMs,
      cooldownUntilByAction: {},
      actionLockedUntilMs: 0,
      activeWalkStatus: null,
      availableTreatItemId: "item_treat_plate_biscuit"
    });

    expect(firstDecision).toMatchObject({ kind: "perform", cooldownUntilMs: nowMs });

    if (firstDecision.kind !== "perform") {
      return;
    }

    // Immediately after the 3s action lock clears, a second treat press is
    // still a "perform" -- the treat cooldown never re-armed.
    const secondDecision = getHomeCarePressDecision({
      action: "treat",
      nowMs: firstDecision.lockUntilMs,
      cooldownUntilByAction: { treat: firstDecision.cooldownUntilMs },
      actionLockedUntilMs: firstDecision.lockUntilMs,
      activeWalkStatus: null,
      availableTreatItemId: "item_treat_plate_biscuit"
    });

    expect(secondDecision.kind).toBe("perform");
  });

  it("lets a special toy (e.g. Buddy Plush) bypass the base play cooldown while the base ball stays gated", () => {
    const nowMs = 1_000;
    const cooldownUntilByAction = {
      // Base play was just used and is deep in its 20-minute cooldown.
      play: nowMs + 19 * 60_000
    };

    // The base "Ball" option (no itemId) is still cooling down.
    expect(
      getHomeCarePressDecision({
        action: "play",
        nowMs,
        cooldownUntilByAction,
        actionLockedUntilMs: 0,
        activeWalkStatus: null,
        availableTreatItemId: null
      })
    ).toMatchObject({ kind: "cooldown" });

    // Selecting the purchased Buddy Plush from the play tray bypasses that
    // same cooldown entirely, and doesn't push the base cooldown out further.
    const plushDecision = getHomeCarePressDecision({
      action: "play",
      nowMs,
      cooldownUntilByAction,
      actionLockedUntilMs: 0,
      activeWalkStatus: null,
      availableTreatItemId: null,
      requestedItemId: "item_plush_toy_buddy"
    });

    expect(plushDecision).toMatchObject({
      kind: "perform",
      action: "play",
      itemId: "item_plush_toy_buddy",
      cooldownUntilMs: cooldownUntilByAction.play
    });
  });

  it("has a renderable game asset for every treat shown in the feed tray", () => {
    const treatItems = mockItems.filter(isTreatInventoryItem);

    expect(treatItems.length).toBeGreaterThanOrEqual(10);
    for (const item of treatItems) {
      expect(gameItemAssetByCatalogId[item.id]).toBeDefined();
    }
  });

  it("shows treat shop previews when no treat is owned yet", () => {
    const state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
    const options = getVisibleHomeCareMenuOptions({
      action: "feed",
      catalogItems: mockItems,
      devStoreUnlocked: false,
      inventory: state.inventory
    });

    expect(options).toHaveLength(3);
    expect(options[0]).toMatchObject({
      action: "feed",
      owned: true,
      title: "Meal"
    });
    expect(options.slice(1).every((option) => !option.owned)).toBe(true);
    expect(options.slice(1).every((option) => option.quantity === 0)).toBe(true);
  });

  it("unlocks visible treats during local development QA", () => {
    const state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
    const treatItems = mockItems.filter(isTreatInventoryItem);
    const options = getVisibleHomeCareMenuOptions({
      action: "feed",
      catalogItems: mockItems,
      devStoreUnlocked: true,
      inventory: state.inventory
    });

    expect(options).toHaveLength(treatItems.length + 1);
    expect(options.every((option) => option.owned)).toBe(true);
    expect(options.every((option) => option.quantity >= 1)).toBe(true);
    expect(options.every((option) => option.assetKey.length > 0)).toBe(true);
  });

  it("surfaces special item choices for every primary care action in development QA", () => {
    const state = createInitialPrototypeSession("2026-06-24T09:00:00.000Z");
    const actions = ["play", "walk", "affection", "water_garden"] as const;

    for (const action of actions) {
      const options = getVisibleHomeCareMenuOptions({
        action,
        catalogItems: mockItems,
        devStoreUnlocked: true,
        inventory: state.inventory
      });

      expect(options.length).toBeGreaterThan(1);
      expect(options[0]?.action).toBe(action);
      expect(options.slice(1).some((option) => option.itemId)).toBe(true);
    }
  });
});
