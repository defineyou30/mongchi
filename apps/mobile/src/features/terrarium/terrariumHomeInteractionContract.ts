import type { CareActionType, ItemId, WalkSession } from "@mongchi/shared";

export const homeFloatingDockActions = ["feed", "play", "walk", "affection", "water_garden"] as const satisfies readonly CareActionType[];
export type HomeFloatingDockAction = (typeof homeFloatingDockActions)[number];

const homeFloatingDockActionSet = new Set<CareActionType>(homeFloatingDockActions);

export const isHomeFloatingDockAction = (action: CareActionType): action is HomeFloatingDockAction =>
  homeFloatingDockActionSet.has(action);

// Lock just long enough for the action animation; feedback lingers a bit longer
// so the stat deltas stay readable (scenario contract: feedback >= 4500ms).
export const homeActionLockMs = 3000;
export const homeActionFeedbackMs = 5200;

/** Prototype walks last a few real minutes so the rewarded-ad skip is meaningful. */
export const homeWalkDurationMs = 3 * 60_000;

const minuteMs = 60_000;
const hourMs = 60 * minuteMs;

export const homeCareActionCooldownMs: Record<CareActionType, number> = {
  affection: 5 * minuteMs,
  clean: 2 * hourMs,
  feed: 4 * hourMs,
  play: 20 * minuteMs,
  rest: 60 * minuteMs,
  talk: 30_000,
  // Treats are a purchased/owned consumable, not a rhythm action -- a
  // cooldown here just blocked owners from using what they already paid for.
  // Cooldown-free (button-mash protection is the shared 3s action lock
  // instead); bond XP farming is capped separately, see careStats.ts.
  treat: 0,
  walk: 12 * hourMs,
  water_garden: 30 * minuteMs
};

export type HomeCarePressDecision =
  | {
      kind: "blocked";
      reason: "active_walk" | "global_action_lock";
    }
  | {
      kind: "cooldown";
      cooldownLeftMs: number;
    }
  | {
      kind: "shop";
      reason: "missing_treat_inventory";
    }
  | {
      kind: "perform";
      action: CareActionType;
      cooldownUntilMs: number;
      lockUntilMs: number;
      itemId?: ItemId;
    };

export interface HomeCarePressInput {
  action: CareActionType;
  nowMs: number;
  cooldownUntilByAction: Partial<Record<CareActionType, number>>;
  actionLockedUntilMs: number;
  activeWalkStatus: WalkSession["status"] | null;
  availableTreatItemId: ItemId | null;
  requestedItemId?: ItemId | null;
}

export const getHomeCareActionCooldownLeftMs = (
  action: CareActionType,
  cooldownUntilByAction: Partial<Record<CareActionType, number>>,
  nowMs: number
): number => Math.max(0, (cooldownUntilByAction[action] ?? 0) - nowMs);

export const getHomeCarePressDecision = ({
  action,
  nowMs,
  cooldownUntilByAction,
  actionLockedUntilMs,
  activeWalkStatus,
  availableTreatItemId,
  requestedItemId
}: HomeCarePressInput): HomeCarePressDecision => {
  if (actionLockedUntilMs > nowMs) {
    return {
      kind: "blocked",
      reason: "global_action_lock"
    };
  }

  if (action === "walk" && activeWalkStatus === "walking") {
    return {
      kind: "blocked",
      reason: "active_walk"
    };
  }

  const resolvedItemId = action === "treat" ? requestedItemId ?? availableTreatItemId ?? null : requestedItemId ?? null;

  if (action === "treat" && !resolvedItemId) {
    return {
      kind: "shop",
      reason: "missing_treat_inventory"
    };
  }

  // Purchased/owned items (a picked treat, or a special toy like Buddy Plush
  // / Rose Cushion chosen from the play/affection tray) skip the base
  // action's rhythm cooldown entirely -- an owner shouldn't be blocked from
  // using something they already paid for. Button-mash protection is still
  // the shared 3s global action lock above; farming is guarded separately by
  // per-action daily XP caps (see careStats.ts), not by this cooldown.
  const bypassesCooldown = resolvedItemId !== null;

  if (!bypassesCooldown) {
    const cooldownLeftMs = getHomeCareActionCooldownLeftMs(action, cooldownUntilByAction, nowMs);

    if (cooldownLeftMs > 0) {
      return {
        kind: "cooldown",
        cooldownLeftMs
      };
    }
  }

  return {
    kind: "perform",
    action,
    // An item-driven action never extends the base action's cooldown --
    // it leaves whatever cooldown the base (non-item) rhythm action already
    // has untouched, since using a purchased item is a deliberate bypass,
    // not a reason to also block a later free/base use once the item's
    // effect passes.
    cooldownUntilMs: bypassesCooldown
      ? (cooldownUntilByAction[action] ?? nowMs)
      : nowMs + homeCareActionCooldownMs[action],
    lockUntilMs: nowMs + homeActionLockMs,
    ...(resolvedItemId ? { itemId: resolvedItemId } : {})
  };
};
