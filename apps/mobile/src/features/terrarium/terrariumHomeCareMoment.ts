import type { CareActionType, ItemId } from "@mongchi/shared";

// Imported from the pure-data mapping module (no react-native/runtime
// imports of its own) rather than GameIllustrations.tsx or gameItemCatalog.ts
// -- those pull in react-native's own module tree via GameItemImage's
// component code, which this plain domain-logic module (and its vitest
// suite, run outside any React Native transform) must never depend on.
import { gameItemAssetByCatalogId } from "../../shared/assets/gameItemCatalogMapping";
import type { GameItemAssetKey } from "../../shared/assets/gameItemCatalogMapping";

/**
 * Tier 2 "care moment" context staging (see docs/gamefeel-sound-plan.md §1
 * Tier 2): a prop appears only for the beat of the care action itself, then
 * disappears -- never a placed/persistent decoration. Keeping the action ->
 * staging mapping here as a pure function (rather than inline in
 * TerrariumHomeScreen) makes it independently testable and easy to extend
 * with a new action's staging without touching the render tree.
 */
export type CareMomentKind = "bowl" | "ball" | "heartBurst" | "bubbleBurst";

export interface CareMomentBowlStaging {
  kind: "bowl";
  item: GameItemAssetKey;
  accessibilityLabel: string;
  /** Total on-screen lifetime in ms: scale+fade in, hold, then fade out. */
  totalMs: number;
  appearMs: number;
  holdMs: number;
  disappearMs: number;
}

export interface CareMomentBallStaging {
  kind: "ball";
  item: GameItemAssetKey;
  accessibilityLabel: string;
  /** Total ms for the ball's roll-out arc (translateX/Y + rotate). */
  totalMs: number;
}

export interface CareMomentHeartBurstStaging {
  kind: "heartBurst";
  accessibilityLabel: string;
  /** How many hearts float up (2-3 per the Tier 2 spec). */
  heartCount: number;
  totalMs: number;
  /**
   * Set only when the affection tap used a specific owned item (e.g. a bed
   * behaviorTagged "sleep"/"affection", picked from the Pet tray) -- CareMomentLayer
   * shows a small fading icon of that item alongside the heart burst instead
   * of inventing item art inside the burst itself. Left undefined for the
   * base petting action (no item involved).
   */
  item?: GameItemAssetKey;
}

export interface CareMomentBubbleBurstStaging {
  kind: "bubbleBurst";
  accessibilityLabel: string;
  /** How many soap bubbles float up and pop (2-3 per the Tier 2 spec, same range as heartBurst). */
  bubbleCount: number;
  totalMs: number;
}

export type CareMomentStaging =
  | CareMomentBowlStaging
  | CareMomentBallStaging
  | CareMomentHeartBurstStaging
  | CareMomentBubbleBurstStaging;

const BOWL_APPEAR_MS = 260;
const BOWL_HOLD_MS = 1700;
const BOWL_DISAPPEAR_MS = 340;
const BOWL_TOTAL_MS = BOWL_APPEAR_MS + BOWL_HOLD_MS + BOWL_DISAPPEAR_MS;
const BALL_TOTAL_MS = 1450;
const HEART_BURST_TOTAL_MS = 1100;
const BUBBLE_BURST_TOTAL_MS = 1100;

const feedStaging: CareMomentBowlStaging = {
  kind: "bowl",
  item: "foodBowl",
  accessibilityLabel: "A food bowl appears for a moment",
  totalMs: BOWL_TOTAL_MS,
  appearMs: BOWL_APPEAR_MS,
  holdMs: BOWL_HOLD_MS,
  disappearMs: BOWL_DISAPPEAR_MS
};

const waterStaging: CareMomentBowlStaging = {
  kind: "bowl",
  item: "drinkWaterBowl",
  accessibilityLabel: "A water bowl appears for a moment",
  totalMs: BOWL_TOTAL_MS,
  appearMs: BOWL_APPEAR_MS,
  holdMs: BOWL_HOLD_MS,
  disappearMs: BOWL_DISAPPEAR_MS
};

const playStaging: CareMomentBallStaging = {
  kind: "ball",
  item: "toyBall",
  accessibilityLabel: "A ball rolls out to play",
  totalMs: BALL_TOTAL_MS
};

// Reuses the bowl kind/timing rather than a bespoke "treatMoment" component --
// a treat is, mechanically, the same beat as feed/water_garden (an item
// appears in front of the pet, scale+fades in, holds for a nibble, fades
// out), and always carries a resolved itemId in practice
// (getHomeCarePressDecision falls back to availableTreatItemId whenever the
// treat action has no explicit requestedItemId), so getCareMomentStaging's
// itemId swap below already lands the specific treat's own action art here
// every time.
const treatStaging: CareMomentBowlStaging = {
  kind: "bowl",
  item: "treatPlate",
  accessibilityLabel: "A treat appears for a moment",
  totalMs: BOWL_TOTAL_MS,
  appearMs: BOWL_APPEAR_MS,
  holdMs: BOWL_HOLD_MS,
  disappearMs: BOWL_DISAPPEAR_MS
};

const affectionStaging: CareMomentHeartBurstStaging = {
  kind: "heartBurst",
  accessibilityLabel: "Little hearts float up",
  heartCount: 3,
  totalMs: HEART_BURST_TOTAL_MS
};

const cleanStaging: CareMomentBubbleBurstStaging = {
  kind: "bubbleBurst",
  accessibilityLabel: "Little soap bubbles float up and pop",
  bubbleCount: 3,
  totalMs: BUBBLE_BURST_TOTAL_MS
};

const careMomentByAction: Partial<Record<CareActionType, CareMomentStaging>> = {
  feed: feedStaging,
  water_garden: waterStaging,
  play: playStaging,
  affection: affectionStaging,
  clean: cleanStaging,
  treat: treatStaging
};

const resolveItemAssetKey = (itemId: ItemId | null | undefined): GameItemAssetKey | null =>
  itemId ? gameItemAssetByCatalogId[itemId] ?? null : null;

/**
 * Returns the one-shot staging for a care action, or null when that action
 * has no Tier 2 moment. When itemId resolves to a known game item (a
 * specific treat/drink/toy/bed picked from a care tray, not the base
 * no-item action), the generic category art (foodBowl/drinkWaterBowl/
 * toyBall/treatPlate) is swapped for that item's own "action" variant art --
 * see gameItemCatalog.ts, every item already ships all four variants
 * (scene/ui/hud/action), so this is purely a staging swap, no new assets.
 * bubbleBurst (clean/Bath) never carries an itemId today (Bath is always
 * the base, item-less option) so it is left as-is.
 *
 * Tier 2 scope note (2026-07 "every item gets its own moment" decision):
 * walk/rest/talk stay out of scope -- rest specifically has no dock entry
 * to press it from today (see careButtons' unrendered "rest" config in
 * TerrariumHomeScreen.tsx), so there is nothing live to stage yet; wiring
 * rest back into the dock is a separate, larger change than this staging
 * function. treat *is* now in scope (see treatStaging below) since it is
 * both reachable today and, per the BM decision, expected to show the
 * specific treat that was used like every other item action.
 */
export const getCareMomentStaging = (action: CareActionType, itemId?: ItemId | null): CareMomentStaging | null => {
  const baseStaging = careMomentByAction[action] ?? null;

  if (!baseStaging) {
    return null;
  }

  const resolvedItem = resolveItemAssetKey(itemId);

  if (!resolvedItem) {
    return baseStaging;
  }

  if (baseStaging.kind === "bowl" || baseStaging.kind === "ball") {
    return { ...baseStaging, item: resolvedItem };
  }

  if (baseStaging.kind === "heartBurst") {
    return { ...baseStaging, item: resolvedItem };
  }

  return baseStaging;
};
