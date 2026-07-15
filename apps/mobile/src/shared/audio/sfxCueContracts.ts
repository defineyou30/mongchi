import type { SfxId } from "./audioAssets";

export const dedicatedSfxCueIds = ["clean", "walk_return", "purchase", "walk_start", "arrival"] as const;

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
  },
  // Little bell/collar jingle marking a walk's start (see careActionSfxById's
  // "walk" mapping) -- synthesized alongside jingle_arrival, see
  // scripts/audio/synth_sfx.py.
  walk_start: {
    assetId: "sfx_walk_start",
    releaseStatus: "licensed_ready"
  },
  // The generation-complete "your friend has arrived" jingle (see
  // generationPresentation.ts's playGenerationArrivalCueOnce) -- replaces the
  // old entrance-timed jingle_discovery cue that fired on GenerationScreen
  // mount instead of on completion.
  arrival: {
    assetId: "jingle_arrival",
    releaseStatus: "licensed_ready"
  }
};
