import { describe, expect, it } from "vitest";

import { dedicatedSfxCueContracts, dedicatedSfxCueIds } from "./sfxCueContracts";

describe("dedicatedSfxCueContracts", () => {
  it("reserves clean, walk-return, purchase, walk-start, and arrival as dedicated final cues", () => {
    expect(dedicatedSfxCueIds).toEqual(["clean", "walk_return", "purchase", "walk_start", "arrival"]);
    expect(dedicatedSfxCueContracts.clean.assetId).toBe("sfx_clean");
    expect(dedicatedSfxCueContracts.walk_return.assetId).toBe("sfx_walk_return");
    expect(dedicatedSfxCueContracts.purchase.assetId).toBe("sfx_purchase");
    expect(dedicatedSfxCueContracts.walk_start.assetId).toBe("sfx_walk_start");
    expect(dedicatedSfxCueContracts.arrival.assetId).toBe("jingle_arrival");
  });

  it("makes every dedicated cue eligible for licensed playback", () => {
    Object.values(dedicatedSfxCueContracts).forEach((contract) => {
      expect(contract.releaseStatus).toBe("licensed_ready");
    });
  });
});
