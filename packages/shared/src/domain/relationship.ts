import type { CareActionType } from "./care";
import type { ISODateTime, MeterValue, PetId } from "./common";

export interface RelationshipState {
  petId: PetId;
  bondXp: number;
  bondLevel: number;
  totalCareActions: number;
  totalTalkCount: number;
  daysTogether: number;
  lastBondedAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

const BOND_XP_PER_LEVEL = 100;

const bondXpByCareAction: Record<CareActionType, number> = {
  feed: 1,
  talk: 3,
  walk: 2,
  play: 2,
  rest: 1,
  affection: 4,
  water_garden: 1,
  clean: 1,
  treat: 5
};

export const getBondXpForCareAction = (action: CareActionType): number => bondXpByCareAction[action];

export const getBondLevelFromXp = (bondXp: number): number =>
  Math.max(1, Math.floor(Math.max(0, bondXp) / BOND_XP_PER_LEVEL) + 1);

export const getBondProgressValue = (relationship: RelationshipState): MeterValue =>
  Math.round(Math.max(0, relationship.bondXp) % BOND_XP_PER_LEVEL);

export const applyRelationshipCareAction = (
  previousState: RelationshipState,
  action: CareActionType,
  occurredAt: ISODateTime,
  /**
   * Overrides the bond XP granted for this action (e.g. 0 once a daily
   * farming cap is reached -- see careStats.shouldGrantTreatBondXp /
   * shouldGrantTalkBondXp). Defaults to the action's normal XP amount so
   * every existing call site is unaffected.
   */
  xpOverride?: number
): RelationshipState => {
  const xpGain = xpOverride ?? bondXpByCareAction[action];
  const nextBondXp = Math.max(0, previousState.bondXp + xpGain);

  return {
    ...previousState,
    bondXp: nextBondXp,
    bondLevel: getBondLevelFromXp(nextBondXp),
    totalCareActions: previousState.totalCareActions + 1,
    totalTalkCount: previousState.totalTalkCount + (action === "talk" ? 1 : 0),
    lastBondedAt: occurredAt,
    updatedAt: occurredAt
  };
};

export const grantRelationshipBondXp = (
  previousState: RelationshipState,
  bondXp: number,
  grantedAt: ISODateTime
): RelationshipState => {
  const nextBondXp = Math.max(0, previousState.bondXp + Math.max(0, bondXp));

  return {
    ...previousState,
    bondXp: nextBondXp,
    bondLevel: getBondLevelFromXp(nextBondXp),
    lastBondedAt: grantedAt,
    updatedAt: grantedAt
  };
};
