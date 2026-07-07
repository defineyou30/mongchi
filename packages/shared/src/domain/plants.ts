import type { ISODateTime, ItemId, MeterValue } from "./common";

/**
 * Dormant domain module. Plant/pot placeable decor was retired from the live
 * mobile app in the "배치형 소품 시스템 철거" wave (mobile no longer owns any
 * plant catalog items, calls no watering-growth code, and shows no plant UI).
 * This module stays in the codebase only because `services/api` still
 * depends on its exports for its own placed-items/plant-growth persistence
 * layer — see `services/api/src/service.ts`, `postgresApiService.ts`,
 * `postgresDailyLoopRepository.ts`, and `apiSnapshotRepository.ts`, plus the
 * `placed_items` table and `inventories.plant_growth` column. Do not wire
 * this back into the mobile app; if `services/api` is ever migrated off
 * plant-growth persistence too, this file can be deleted along with the
 * placement functions in `inventory.ts`.
 */

export type PlantGrowthStageKey = "seed" | "sprout" | "leafy" | "bloom";
export type PlantGrowthCondition = "unstarted" | "fresh" | "growing" | "thirsty" | "blooming";
export type PlantPlacementPresetKey = "front_pot" | "side_leaf" | "seasonal_patch";

export type PlantPlacementLane = "frontPlant" | "sidePlant" | "seasonalPlant";

export interface PlantPlacementPreset {
  key: PlantPlacementPresetKey;
  displayName: string;
  placementLane: PlantPlacementLane;
  defaultAnchor: {
    x: number;
    y: number;
    rotation: number;
    scale: number;
  };
  growthRole: "living_decor";
  allowsFailureState: false;
  assetPromptTags: readonly string[];
}

export interface PlantGrowthPreset {
  itemId: ItemId;
  displayName: string;
  growthEnabled: true;
  placementPreset: PlantPlacementPresetKey;
  waterPointsPerStage: number;
  thirstyAfterHours: number;
  stages: readonly PlantGrowthStageKey[];
  stageScale: Partial<Record<PlantGrowthStageKey, number>>;
  assetPromptTags: readonly string[];
}

export interface PlantGrowthVisualState {
  itemId: ItemId;
  placementPreset: PlantPlacementPreset;
  stageKey: PlantGrowthStageKey | null;
  stageLabel: string;
  condition: PlantGrowthCondition;
  conditionLabel: string;
  progressValue: MeterValue;
  scale: number;
  assetPromptTags: readonly string[];
}

export interface PlantGrowthEntry {
  itemId: ItemId;
  stageIndex: number;
  waterPoints: number;
  lastWateredAt?: ISODateTime;
  updatedAt: ISODateTime;
}

export interface PlantGrowthWateringOutcome {
  entries: PlantGrowthEntry[];
  wateredItemIds: ItemId[];
  advancedItemIds: ItemId[];
  bloomedItemIds: ItemId[];
}

export interface PlantBloomReward {
  type: "plant_bloom";
  itemId: ItemId;
  bonusCredits: number;
  bondXp: number;
}

export const plantGrowthStageLabels: Record<PlantGrowthStageKey, string> = {
  seed: "Seed",
  sprout: "Sprout",
  leafy: "Leafy",
  bloom: "Bloom"
};

export const plantGrowthConditionLabels: Record<PlantGrowthCondition, string> = {
  unstarted: "Ready",
  fresh: "Fresh",
  growing: "Growing",
  thirsty: "Thirsty",
  blooming: "Blooming"
};

export const plantPlacementPresets: Record<PlantPlacementPresetKey, PlantPlacementPreset> = {
  front_pot: {
    key: "front_pot",
    displayName: "Front Pot",
    placementLane: "frontPlant",
    defaultAnchor: {
      x: 0.18,
      y: 0.78,
      rotation: -5,
      scale: 0.82
    },
    growthRole: "living_decor",
    allowsFailureState: false,
    assetPromptTags: ["front garden pot", "small readable silhouette", "does not cover the pet"]
  },
  side_leaf: {
    key: "side_leaf",
    displayName: "Side Leaf",
    placementLane: "sidePlant",
    defaultAnchor: {
      x: 0.82,
      y: 0.72,
      rotation: 5,
      scale: 0.86
    },
    growthRole: "living_decor",
    allowsFailureState: false,
    assetPromptTags: ["side garden foliage", "vertical leafy silhouette", "frames the pet scene"]
  },
  seasonal_patch: {
    key: "seasonal_patch",
    displayName: "Seasonal Patch",
    placementLane: "seasonalPlant",
    defaultAnchor: {
      x: 0.62,
      y: 0.58,
      rotation: 0,
      scale: 0.8
    },
    growthRole: "living_decor",
    allowsFailureState: false,
    assetPromptTags: ["seasonal flower patch", "premium garden accent", "midground blossom detail"]
  }
};

export const starterPlantGrowthPresets: readonly PlantGrowthPreset[] = [
  {
    itemId: "item_flower_pot_sunny",
    displayName: "Sunny Flower Pot",
    growthEnabled: true,
    placementPreset: "front_pot",
    waterPointsPerStage: 2,
    thirstyAfterHours: 18,
    stages: ["seed", "sprout", "leafy", "bloom"],
    stageScale: {
      seed: 0.62,
      sprout: 0.76,
      leafy: 0.92,
      bloom: 1
    },
    assetPromptTags: ["small potted flower", "rounded soft 2d game prop", "warm garden palette"]
  },
  {
    itemId: "item_leafy_plant_clover",
    displayName: "Clover Leaf Plant",
    growthEnabled: true,
    placementPreset: "side_leaf",
    waterPointsPerStage: 2,
    thirstyAfterHours: 18,
    stages: ["sprout", "leafy", "bloom"],
    stageScale: {
      sprout: 0.76,
      leafy: 0.92,
      bloom: 1.04
    },
    assetPromptTags: ["leafy clover plant", "lush rounded leaves", "soft garden prop"]
  },
  {
    itemId: "item_seasonal_flowers_spring",
    displayName: "Spring Flower Patch",
    growthEnabled: true,
    placementPreset: "seasonal_patch",
    waterPointsPerStage: 3,
    thirstyAfterHours: 24,
    stages: ["sprout", "leafy", "bloom"],
    stageScale: {
      sprout: 0.74,
      leafy: 0.9,
      bloom: 1.06
    },
    assetPromptTags: ["spring flower patch", "tiny blossoms", "premium cozy garden prop"]
  }
];

export const getPlantGrowthPreset = (itemId: ItemId): PlantGrowthPreset | null =>
  starterPlantGrowthPresets.find((preset) => preset.itemId === itemId) ?? null;

export const isPlantGrowthEnabledItemId = (itemId: ItemId): boolean => getPlantGrowthPreset(itemId) !== null;

export const getPlantPlacementPreset = (presetKey: PlantPlacementPresetKey): PlantPlacementPreset => plantPlacementPresets[presetKey];

export const getPlantPlacementPresetForItemId = (itemId: ItemId): PlantPlacementPreset | null => {
  const preset = getPlantGrowthPreset(itemId);

  return preset ? getPlantPlacementPreset(preset.placementPreset) : null;
};

export const getPlantBloomReward = (itemId: ItemId): PlantBloomReward | null => {
  const preset = getPlantGrowthPreset(itemId);

  if (!preset) {
    return null;
  }

  return {
    type: "plant_bloom",
    itemId,
    bonusCredits: preset.placementPreset === "seasonal_patch" ? 2 : 1,
    bondXp: preset.placementPreset === "seasonal_patch" ? 5 : 3
  };
};

export const getPlantBloomRewards = (itemIds: readonly ItemId[]): PlantBloomReward[] =>
  itemIds.flatMap((itemId) => {
    const reward = getPlantBloomReward(itemId);

    return reward ? [reward] : [];
  });

export const summarizePlantBloomRewards = (
  rewards: readonly PlantBloomReward[]
): Pick<PlantBloomReward, "bonusCredits" | "bondXp"> => ({
  bonusCredits: rewards.reduce((total, reward) => total + reward.bonusCredits, 0),
  bondXp: rewards.reduce((total, reward) => total + reward.bondXp, 0)
});

export const createPlantGrowthEntry = (itemId: ItemId, now: ISODateTime): PlantGrowthEntry => ({
  itemId,
  stageIndex: 0,
  waterPoints: 0,
  updatedAt: now
});

export const getPlantGrowthStageKey = (entry: PlantGrowthEntry): PlantGrowthStageKey | null => {
  const preset = getPlantGrowthPreset(entry.itemId);

  return preset?.stages[Math.min(entry.stageIndex, preset.stages.length - 1)] ?? null;
};

export const getPlantGrowthStageLabel = (entry: PlantGrowthEntry): string => {
  const stageKey = getPlantGrowthStageKey(entry);

  return stageKey ? plantGrowthStageLabels[stageKey] : "Decor";
};

export const getPlantGrowthStageScale = (entry: PlantGrowthEntry): number => {
  const preset = getPlantGrowthPreset(entry.itemId);
  const stageKey = getPlantGrowthStageKey(entry);

  if (!preset || !stageKey) {
    return 1;
  }

  return preset.stageScale[stageKey] ?? 1;
};

const hoursBetween = (from: ISODateTime, to: ISODateTime): number =>
  Math.max(0, (new Date(to).getTime() - new Date(from).getTime()) / 3_600_000);

export const getPlantGrowthCondition = (entry: PlantGrowthEntry, now: ISODateTime): PlantGrowthCondition => {
  const preset = getPlantGrowthPreset(entry.itemId);

  if (!preset) {
    return "unstarted";
  }

  if (!entry.lastWateredAt) {
    return "thirsty";
  }

  if (entry.stageIndex >= preset.stages.length - 1) {
    return "blooming";
  }

  if (hoursBetween(entry.lastWateredAt, now) >= preset.thirstyAfterHours) {
    return "thirsty";
  }

  if (entry.waterPoints > 0) {
    return "growing";
  }

  return "fresh";
};

export const getPlantGrowthConditionLabel = (entry: PlantGrowthEntry, now: ISODateTime): string =>
  plantGrowthConditionLabels[getPlantGrowthCondition(entry, now)];

export const getPlantGrowthProgressValue = (entry: PlantGrowthEntry): MeterValue => {
  const preset = getPlantGrowthPreset(entry.itemId);

  if (!preset) {
    return 0;
  }

  return Math.round((Math.min(entry.waterPoints, preset.waterPointsPerStage) / preset.waterPointsPerStage) * 100);
};

export const getPlantGrowthVisualState = (entry: PlantGrowthEntry, now: ISODateTime): PlantGrowthVisualState | null => {
  const growthPreset = getPlantGrowthPreset(entry.itemId);

  if (!growthPreset) {
    return null;
  }

  const placementPreset = getPlantPlacementPreset(growthPreset.placementPreset);
  const stageKey = getPlantGrowthStageKey(entry);
  const condition = getPlantGrowthCondition(entry, now);

  return {
    itemId: entry.itemId,
    placementPreset,
    stageKey,
    stageLabel: stageKey ? plantGrowthStageLabels[stageKey] : "Decor",
    condition,
    conditionLabel: plantGrowthConditionLabels[condition],
    progressValue: getPlantGrowthProgressValue(entry),
    scale: getPlantGrowthStageScale(entry),
    assetPromptTags: [...placementPreset.assetPromptTags, ...growthPreset.assetPromptTags]
  };
};

export const waterPlantGrowthEntries = (
  entries: readonly PlantGrowthEntry[],
  itemIds: readonly ItemId[],
  now: ISODateTime
): PlantGrowthEntry[] => waterPlantGrowthEntriesWithOutcome(entries, itemIds, now).entries;

export const waterPlantGrowthEntriesWithOutcome = (
  entries: readonly PlantGrowthEntry[],
  itemIds: readonly ItemId[],
  now: ISODateTime
): PlantGrowthWateringOutcome => {
  const byItemId = new Map(entries.map((entry) => [entry.itemId, entry]));
  const wateredItemIds: ItemId[] = [];
  const advancedItemIds: ItemId[] = [];
  const bloomedItemIds: ItemId[] = [];

  for (const itemId of itemIds) {
    const preset = getPlantGrowthPreset(itemId);

    if (!preset) {
      continue;
    }

    const current = byItemId.get(itemId) ?? createPlantGrowthEntry(itemId, now);
    const maxStageIndex = preset.stages.length - 1;
    const nextWaterPoints = current.waterPoints + 1;
    const shouldGrow = nextWaterPoints >= preset.waterPointsPerStage && current.stageIndex < maxStageIndex;
    const nextStageIndex = shouldGrow ? current.stageIndex + 1 : current.stageIndex;

    wateredItemIds.push(itemId);

    if (shouldGrow) {
      advancedItemIds.push(itemId);
    }

    if (shouldGrow && nextStageIndex >= maxStageIndex && current.stageIndex < maxStageIndex) {
      bloomedItemIds.push(itemId);
    }

    byItemId.set(itemId, {
      ...current,
      stageIndex: nextStageIndex,
      waterPoints: shouldGrow ? 0 : Math.min(nextWaterPoints, preset.waterPointsPerStage),
      lastWateredAt: now,
      updatedAt: now
    });
  }

  return {
    entries: [...byItemId.values()],
    wateredItemIds,
    advancedItemIds,
    bloomedItemIds
  };
};
