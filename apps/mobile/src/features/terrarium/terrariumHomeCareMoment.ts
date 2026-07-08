import type { CareActionType } from "@mongchi/shared";

import type { GameItemAssetKey } from "../../shared/ui/GameIllustrations";

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
  clean: cleanStaging
};

/** Returns the one-shot staging for a care action, or null when that action has no Tier 2 moment. */
export const getCareMomentStaging = (action: CareActionType): CareMomentStaging | null => careMomentByAction[action] ?? null;
