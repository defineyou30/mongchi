import type { CareActionType } from "./care";
import type { ISODateTime, ItemId } from "./common";

/**
 * Time-limited buffs granted by using special items. Buffs make items feel
 * meaningfully different instead of flat one-time stat bumps:
 * - decay_reduction: slows a meter's decay while active
 * - action_gain_boost: amplifies the positive stat gains of one care action
 * - bond_xp_multiplier: multiplies bond XP from care actions
 */
export type CareBuffKind = "decay_reduction" | "action_gain_boost" | "bond_xp_multiplier";

export type BuffableMeter = "satiety" | "happiness" | "energy" | "affection" | "gardenHealth" | "cleanliness";

export interface CareBuffTemplate {
  buffId: string;
  kind: CareBuffKind;
  /** Meter whose decay is reduced (decay_reduction only). */
  meter?: BuffableMeter;
  /** Care action whose gains are boosted (action_gain_boost only). */
  action?: CareActionType;
  /**
   * Effect strength. decay_reduction: fraction of decay remaining (0.5 = half decay).
   * action_gain_boost / bond_xp_multiplier: gain multiplier (1.5 = +50%, 2 = double).
   */
  magnitude: number;
  durationHours: number;
  /** Optional cap on boosted action uses (action_gain_boost only). */
  uses?: number;
  labelEn: string;
  labelKo: string;
}

export interface ActiveCareBuff extends CareBuffTemplate {
  sourceItemId: ItemId;
  startedAt: ISODateTime;
  expiresAt: ISODateTime;
  usesLeft?: number;
}

/**
 * Which item grants which buff when used in a care action. Attached to existing
 * catalog items so no catalog/server changes are needed for the first pass.
 */
export const careBuffTemplatesByItem: Partial<Record<ItemId, CareBuffTemplate>> = {
  item_berry_yogurt: {
    buffId: "buff_full_belly",
    kind: "decay_reduction",
    meter: "satiety",
    magnitude: 0.5,
    durationHours: 4,
    labelEn: "Full belly",
    labelKo: "든든한 배"
  },
  item_plush_toy_buddy: {
    buffId: "buff_favorite_toy",
    kind: "action_gain_boost",
    action: "play",
    magnitude: 1.5,
    durationHours: 24,
    uses: 3,
    labelEn: "Favorite toy",
    labelKo: "최애 장난감"
  },
  item_cushion_rose: {
    buffId: "buff_cozy_cushion",
    kind: "action_gain_boost",
    action: "rest",
    magnitude: 1.5,
    durationHours: 12,
    labelEn: "Cozy cushion",
    labelKo: "포근한 쿠션"
  },
  item_duck_biscuit: {
    buffId: "buff_training_treat",
    kind: "bond_xp_multiplier",
    magnitude: 2,
    durationHours: 2,
    labelEn: "Bond boost",
    labelKo: "유대 부스트"
  }
};

const HOUR_MS = 60 * 60 * 1000;

export const createActiveCareBuff = (template: CareBuffTemplate, sourceItemId: ItemId, now: ISODateTime): ActiveCareBuff => ({
  ...template,
  sourceItemId,
  startedAt: now,
  expiresAt: new Date(new Date(now).getTime() + template.durationHours * HOUR_MS).toISOString(),
  ...(template.uses !== undefined ? { usesLeft: template.uses } : {})
});

export const isCareBuffActive = (buff: ActiveCareBuff, now: ISODateTime): boolean => {
  if (buff.usesLeft !== undefined && buff.usesLeft <= 0) {
    return false;
  }

  return new Date(now).getTime() < new Date(buff.expiresAt).getTime();
};

export const pruneActiveCareBuffs = (buffs: readonly ActiveCareBuff[], now: ISODateTime): ActiveCareBuff[] =>
  buffs.filter((buff) => isCareBuffActive(buff, now));

/** Adds a buff, replacing any existing instance of the same buffId (no stacking). */
export const addActiveCareBuff = (
  buffs: readonly ActiveCareBuff[],
  template: CareBuffTemplate,
  sourceItemId: ItemId,
  now: ISODateTime
): ActiveCareBuff[] => [
  ...pruneActiveCareBuffs(buffs, now).filter((buff) => buff.buffId !== template.buffId),
  createActiveCareBuff(template, sourceItemId, now)
];

export const getActionGainMultiplier = (
  buffs: readonly ActiveCareBuff[],
  action: CareActionType,
  now: ISODateTime
): number =>
  pruneActiveCareBuffs(buffs, now)
    .filter((buff) => buff.kind === "action_gain_boost" && buff.action === action)
    .reduce((multiplier, buff) => multiplier * buff.magnitude, 1);

export const getBondXpMultiplier = (buffs: readonly ActiveCareBuff[], now: ISODateTime): number =>
  pruneActiveCareBuffs(buffs, now)
    .filter((buff) => buff.kind === "bond_xp_multiplier")
    .reduce((multiplier, buff) => multiplier * buff.magnitude, 1);

/**
 * Consumes one use from matching action_gain_boost buffs and drops spent ones.
 */
export const consumeActionBuffUses = (
  buffs: readonly ActiveCareBuff[],
  action: CareActionType,
  now: ISODateTime
): ActiveCareBuff[] =>
  pruneActiveCareBuffs(buffs, now)
    .map((buff) =>
      buff.kind === "action_gain_boost" && buff.action === action && buff.usesLeft !== undefined
        ? { ...buff, usesLeft: buff.usesLeft - 1 }
        : buff
    )
    .filter((buff) => buff.usesLeft === undefined || buff.usesLeft > 0);

/**
 * Hours within [windowStart, windowEnd] during which the buff was active.
 * Used to credit back decay that a decay_reduction buff prevented.
 */
export const getBuffOverlapHours = (buff: ActiveCareBuff, windowStart: ISODateTime, windowEnd: ISODateTime): number => {
  const start = Math.max(new Date(buff.startedAt).getTime(), new Date(windowStart).getTime());
  const end = Math.min(new Date(buff.expiresAt).getTime(), new Date(windowEnd).getTime());

  return Math.max(0, (end - start) / HOUR_MS);
};

export const getDecayReductionBuffs = (buffs: readonly ActiveCareBuff[], meter: BuffableMeter): ActiveCareBuff[] =>
  buffs.filter((buff) => buff.kind === "decay_reduction" && buff.meter === meter);

export const getRemainingBuffMinutes = (buff: ActiveCareBuff, now: ISODateTime): number =>
  Math.max(0, Math.ceil((new Date(buff.expiresAt).getTime() - new Date(now).getTime()) / 60_000));
