import type { CareActionRequest, CareActionResult, CareState } from "../domain/care";
import type { ActiveCareBuff } from "../domain/careBuffs";
import { getActionGainMultiplier, getBuffOverlapHours, getDecayReductionBuffs } from "../domain/careBuffs";
import type { ItemId } from "../domain/common";

const clampMeter = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

type CareMeterKey = "satiety" | "happiness" | "cleanliness" | "energy" | "gardenHealth" | "affection";
type DecayingCareMeter = CareMeterKey;
type CareMeterPatch = Partial<Record<CareMeterKey, number>>;

interface CareDecayRule {
  graceHours: number;
  pointsPerHour: number;
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Neglect decay never fully bottoms a meter out. A returning owner should
 * always have *something* to work with instead of staring at a wall of
 * zeros -- see the mongchi "케어 체감 밸런스" fix (a healing app should never
 * read as a failure state). Paired with the catchup multiplier below so the
 * first few care actions after a long absence feel like they're actually
 * doing something.
 */
const DECAY_FLOOR = 15;

const careDecayRules: Record<DecayingCareMeter, CareDecayRule> = {
  satiety: { graceHours: 2, pointsPerHour: 4 },
  happiness: { graceHours: 4, pointsPerHour: 2.5 },
  cleanliness: { graceHours: 12, pointsPerHour: 1.5 },
  energy: { graceHours: 8, pointsPerHour: 1.25 },
  gardenHealth: { graceHours: 24, pointsPerHour: 1.5 },
  affection: { graceHours: 8, pointsPerHour: 1.6 }
};

/**
 * Catchup amplifies an action's positive gain the further below
 * CATCHUP_THRESHOLD the meter currently sits, ramping linearly up to
 * CATCHUP_MAX_MULTIPLIER right at 0. This is what makes "I cared for my
 * neglected pet" actually move the needle instead of a small flat gain
 * getting lost against how far the meter fell. Stacks multiplicatively with
 * buff-driven action_gain_boost multipliers (see applyGainMultiplier below),
 * but the combined multiplier is clamped so a buffed catchup action can't
 * runaway past a sane ceiling.
 */
const CATCHUP_THRESHOLD = 40;
const CATCHUP_MAX_MULTIPLIER = 2.0;
const COMBINED_GAIN_MULTIPLIER_CAP = 3.0;

const getCatchupMultiplier = (currentValue: number): number => {
  if (currentValue >= CATCHUP_THRESHOLD) {
    return 1;
  }

  const deficitRatio = (CATCHUP_THRESHOLD - currentValue) / CATCHUP_THRESHOLD;
  return 1 + deficitRatio * (CATCHUP_MAX_MULTIPLIER - 1);
};

const careMeterKeys = ["satiety", "happiness", "cleanliness", "energy", "gardenHealth", "affection"] as const satisfies readonly CareMeterKey[];

const specialItemEffectsByAction: Partial<Record<CareActionRequest["action"], Record<ItemId, CareMeterPatch>>> = {
  affection: {
    // Nap cushions double as a rest moment (docs/gamefeel-sound-plan.md §1
    // Tier 4 -- rest's own dock button stays retired to avoid a 6th dock
    // slot, so this is the cushion's "cozy nap" stand-in). +14 energy is half
    // of rest's own +28 gain -- a real nap-sized bonus on top of the base
    // affection effect, without letting one cushion tap fully substitute for
    // the dedicated rest action.
    item_cushion_rose: { affection: 10, happiness: 4, energy: 14 },
    item_cloud_cushion_sky: { affection: 10, happiness: 4, energy: 14 },
    item_clover_nap_mat: { affection: 8, happiness: 4, energy: 12 },
    item_moon_pillow: { affection: 8, happiness: 4, energy: 12 },
    item_star_blanket: { affection: 8, happiness: 4, energy: 12 },
    item_cozy_basket: { affection: 10, happiness: 5, energy: 14 },
    item_window_perch: { affection: 9, happiness: 6, energy: 12 },
    item_patchwork_rug: { affection: 8, happiness: 4, energy: 12 },
    item_sleep_tent: { affection: 11, happiness: 5, energy: 16 },
    item_donut_bed: { affection: 10, happiness: 5, energy: 14 },
    item_garden_hammock: { affection: 11, happiness: 6, energy: 16 },
    item_lantern_nest: { affection: 12, happiness: 6, energy: 18 },
    item_plush_toy_buddy: { affection: 8, happiness: 4 }
  },
  play: {
    item_toy_ball_mint: { happiness: 4 },
    item_plush_toy_buddy: { happiness: 10, affection: 5 },
    item_moon_frisbee: { happiness: 5 },
    item_bell_roller: { happiness: 5, affection: 2 },
    item_feather_teaser: { happiness: 6 },
    item_snuffle_mat: { happiness: 8, affection: 3 },
    item_wobble_treat_ball: { happiness: 8, affection: 3 },
    item_crinkle_leaf: { happiness: 5 },
    item_sunbeam_spinner: { happiness: 5, affection: 2 }
  },
  treat: {
    item_berry_yogurt: { happiness: 5, affection: 3 },
    item_duck_biscuit: { happiness: 6, affection: 2 },
    item_honey_paw_wafer: { happiness: 4, affection: 2 }
  },
  walk: {
    item_stepping_stone_path: { happiness: 7, energy: 5, affection: 3 }
  },
  water_garden: {
    item_milk_pup_cup: { gardenHealth: 12, satiety: 4, happiness: 5 },
    item_dewdrop_water: { gardenHealth: 6, energy: 2 },
    item_apple_sip: { gardenHealth: 6, happiness: 2 },
    item_berry_milk: { gardenHealth: 6, happiness: 3 },
    item_pumpkin_cream: { gardenHealth: 8, happiness: 4, affection: 2 },
    item_blueberry_smoothie: { gardenHealth: 8, happiness: 5 },
    item_carrot_cooler: { gardenHealth: 6, energy: 3 },
    item_sweet_potato_shake: { gardenHealth: 6, happiness: 3, affection: 2 },
    item_salmon_broth: { gardenHealth: 8, satiety: 4, affection: 2 },
    item_tuna_broth: { gardenHealth: 6, satiety: 3 },
    item_coconut_splash: { gardenHealth: 8, happiness: 4, energy: 3 },
    item_pear_nectar: { gardenHealth: 6, happiness: 2 },
    item_pond_tile_lily: { gardenHealth: 8, happiness: 3 }
  }
};

const getElapsedHours = (from: string | undefined, to: string): number => {
  if (!from) {
    return 0;
  }

  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();

  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    return 0;
  }

  return Math.max(0, (toMs - fromMs) / HOUR_MS);
};

const decayMeter = (value: number, elapsedHours: number, rule: CareDecayRule): number => {
  const activeHours = Math.max(0, elapsedHours - rule.graceHours);
  const decayed = clampMeter(value - activeHours * rule.pointsPerHour);
  // The floor only ever holds decay back -- it must never raise a value that
  // an action (e.g. play's cleanliness cost) already legitimately pushed
  // below the floor without any time passing.
  return activeHours > 0 ? Math.max(DECAY_FLOOR, decayed) : decayed;
};

// Credits back decay that active decay_reduction buffs prevented within the
// actual decaying window (anchor + grace .. now), never exceeding the original value.
const decayMeterWithBuffs = (
  value: number,
  anchor: string | undefined,
  now: string,
  meter: CareMeterKey,
  rule: CareDecayRule,
  buffs: readonly ActiveCareBuff[]
): number => {
  const elapsedHours = getElapsedHours(anchor, now);
  const decayed = decayMeter(value, elapsedHours, rule);
  const meterBuffs = getDecayReductionBuffs(buffs, meter);

  if (meterBuffs.length === 0 || decayed >= value || !anchor) {
    return decayed;
  }

  const decayStart = new Date(new Date(anchor).getTime() + rule.graceHours * HOUR_MS).toISOString();
  const credit = meterBuffs.reduce(
    (total, buff) => total + getBuffOverlapHours(buff, decayStart, now) * rule.pointsPerHour * (1 - buff.magnitude),
    0
  );

  return clampMeter(Math.min(value, decayed + Math.max(0, credit)));
};

export const projectCareStateForTime = (
  state: CareState,
  now: string,
  buffs: readonly ActiveCareBuff[] = []
): CareState => {
  const interactionAnchor = state.lastInteractionAt ?? state.updatedAt;
  const gardenAnchor = state.lastGardenWateredAt ?? state.updatedAt;
  const satiety = decayMeterWithBuffs(state.satiety, state.updatedAt, now, "satiety", careDecayRules.satiety, buffs);
  const cleanliness = decayMeterWithBuffs(state.cleanliness, state.updatedAt, now, "cleanliness", careDecayRules.cleanliness, buffs);
  const baseHappiness = decayMeterWithBuffs(state.happiness, interactionAnchor, now, "happiness", careDecayRules.happiness, buffs);
  const hungerMoodPenalty = Math.max(0, 45 - satiety) * 0.25;
  const messyMoodPenalty = Math.max(0, 35 - cleanliness) * 0.15;

  return {
    ...state,
    satiety,
    cleanliness,
    // Same "never a wall of zeros" floor as the other meters -- the
    // hunger/messy mood penalties stack on top of happiness's own decay
    // floor, so without re-flooring here a hungry+messy pet's mood could
    // still read as 0 even though every meter individually has a floor.
    happiness: Math.max(DECAY_FLOOR, clampMeter(baseHappiness - hungerMoodPenalty - messyMoodPenalty)),
    energy: decayMeterWithBuffs(state.energy, state.updatedAt, now, "energy", careDecayRules.energy, buffs),
    gardenHealth: decayMeterWithBuffs(state.gardenHealth, gardenAnchor, now, "gardenHealth", careDecayRules.gardenHealth, buffs),
    affection: decayMeterWithBuffs(state.affection, interactionAnchor, now, "affection", careDecayRules.affection, buffs),
    updatedAt: now
  };
};

const touch = (state: CareState, occurredAt: string): CareState => ({
  ...state,
  lastInteractionAt: occurredAt,
  updatedAt: occurredAt
});

const applyCareMeterPatch = (state: CareState, patch: CareMeterPatch): CareState => {
  let nextState = state;

  for (const key of careMeterKeys) {
    const delta = patch[key];

    if (typeof delta !== "number" || delta === 0) {
      continue;
    }

    nextState = {
      ...nextState,
      [key]: clampMeter(nextState[key] + delta)
    };
  }

  return nextState;
};

const applySpecialItemEffect = (state: CareState, request: CareActionRequest): CareState => {
  if (!request.itemId) {
    return state;
  }

  const actionEffects = specialItemEffectsByAction[request.action];
  const effect = actionEffects?.[request.itemId];

  return effect ? applyCareMeterPatch(state, effect) : state;
};

/**
 * Scales an action's positive meter gains (losses untouched) by the catchup
 * multiplier (per-meter, based on how low that meter currently sits) times
 * the buff-driven action_gain_boost multiplier. The two stack
 * multiplicatively -- a favorite-toy buff on top of a starving meter should
 * feel extra generous -- but the combined multiplier is clamped so a buffed
 * catchup action can't run away past a sane ceiling.
 */
const applyGainMultiplier = (baseState: CareState, nextState: CareState, buffMultiplier: number): CareState => {
  let boosted = nextState;

  for (const key of careMeterKeys) {
    const gain = nextState[key] - baseState[key];

    if (gain <= 0) {
      continue;
    }

    const combinedMultiplier = Math.min(getCatchupMultiplier(baseState[key]) * buffMultiplier, COMBINED_GAIN_MULTIPLIER_CAP);

    if (combinedMultiplier <= 1) {
      continue;
    }

    boosted = {
      ...boosted,
      [key]: clampMeter(baseState[key] + gain * combinedMultiplier)
    };
  }

  return boosted;
};

export const applyLocalCareAction = (
  previousState: CareState,
  request: CareActionRequest,
  buffs: readonly ActiveCareBuff[] = []
): CareActionResult => {
  const projectedPreviousState = projectCareStateForTime(previousState, request.occurredAt, buffs);
  const state = touch(projectedPreviousState, request.occurredAt);

  let nextState: CareState;

  switch (request.action) {
    case "feed":
      nextState = {
        ...state,
        satiety: clampMeter(state.satiety + 28),
        happiness: clampMeter(state.happiness + 8),
        // A full belly brings a little energy back too -- eating naturally
        // perks a pet up (see the mongchi "케어 체감 밸런스" fix).
        energy: clampMeter(state.energy + 14),
        lastFedAt: request.occurredAt
      };
      break;
    case "talk":
      nextState = {
        ...state,
        happiness: clampMeter(state.happiness + 5),
        affection: clampMeter(state.affection + 3)
      };
      break;
    case "walk":
      nextState = {
        ...state,
        energy: clampMeter(state.energy - 12),
        happiness: clampMeter(state.happiness + 12),
        activeWalkId: state.activeWalkId ?? "mock_walk_pending"
      };
      break;
    case "play":
      nextState = {
        ...state,
        energy: clampMeter(state.energy - 8),
        happiness: clampMeter(state.happiness + 14),
        cleanliness: clampMeter(state.cleanliness - 4)
      };
      break;
    case "rest":
      nextState = {
        ...state,
        energy: clampMeter(state.energy + 28),
        happiness: clampMeter(state.happiness + 4)
      };
      break;
    case "affection":
      nextState = {
        ...state,
        affection: clampMeter(state.affection + 16),
        happiness: clampMeter(state.happiness + 14)
      };
      break;
    case "water_garden":
      nextState = {
        ...state,
        gardenHealth: clampMeter(state.gardenHealth + 28),
        happiness: clampMeter(state.happiness + 3),
        // A drink of water perks a pet up a little too, same rationale as feed.
        energy: clampMeter(state.energy + 14),
        lastGardenWateredAt: request.occurredAt
      };
      break;
    case "clean":
      nextState = {
        ...state,
        cleanliness: clampMeter(state.cleanliness + 26),
        happiness: clampMeter(state.happiness + 4)
      };
      break;
    case "treat":
      nextState = {
        ...state,
        satiety: clampMeter(state.satiety + 10),
        happiness: clampMeter(state.happiness + 18),
        affection: clampMeter(state.affection + 6)
      };
      break;
  }

  const withItemEffect = applySpecialItemEffect(nextState, request);
  const gainMultiplier = getActionGainMultiplier(buffs, request.action, request.occurredAt);

  return {
    action: request.action,
    previousState: projectedPreviousState,
    nextState: applyGainMultiplier(state, withItemEffect, gainMultiplier)
  };
};
