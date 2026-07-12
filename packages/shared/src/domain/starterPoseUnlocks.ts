import type { CareActionType } from "./care";
import type { GeneratedAssetState } from "./assets";

export const starterPoseStates = ["idle", "happy", "sleep"] as const satisfies readonly GeneratedAssetState[];
export const initiallyVisibleStarterPoseStates = ["idle"] as const satisfies readonly GeneratedAssetState[];

export const getStarterPoseUnlockStatesForCareAction = (
  action: CareActionType,
  ownedStates: readonly GeneratedAssetState[]
): GeneratedAssetState[] => {
  const owned = new Set(ownedStates);
  const unlocks: GeneratedAssetState[] = [];

  if (!owned.has("happy")) {
    unlocks.push("happy");
  }

  if (action === "rest" && !owned.has("sleep")) {
    unlocks.push("sleep");
  }

  return unlocks;
};
