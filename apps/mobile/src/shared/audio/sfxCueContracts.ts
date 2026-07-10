import type { SfxId } from "./audioAssets";

export const dedicatedSfxCueIds = ["clean", "walk_return", "purchase"] as const;

export type DedicatedSfxCueId = (typeof dedicatedSfxCueIds)[number];

export interface DedicatedSfxCueContract {
  readonly assetId: SfxId;
  readonly releaseStatus: "licensed_ready";
}

export const dedicatedSfxCueContracts: Record<DedicatedSfxCueId, DedicatedSfxCueContract> = {
  clean: {
    assetId: "sfx_clean",
    releaseStatus: "licensed_ready"
  },
  walk_return: {
    assetId: "sfx_walk_return",
    releaseStatus: "licensed_ready"
  },
  purchase: {
    assetId: "sfx_purchase",
    releaseStatus: "licensed_ready"
  }
};
