import { describe, expect, it } from "vitest";

import { generatedAssetStates } from "../domain";
import { mockGeneratedAssets } from "../mock/mockData";

describe("mock generated pet assets", () => {
  it("includes generated pet reaction states with stable asset ids", () => {
    expect(mockGeneratedAssets.map((asset) => asset.state)).toEqual([...generatedAssetStates]);
    expect(mockGeneratedAssets.map((asset) => asset.id)).toEqual([
      "asset_miso_idle_001",
      "asset_miso_base_001",
      "asset_miso_happy_001",
      "asset_miso_sleep_001",
      "asset_miso_play_001",
      "asset_miso_hungry_001",
      "asset_miso_walk_return_001",
      "asset_miso_treat_reaction_001",
      "asset_miso_chat_portrait_001",
      "asset_miso_curious_001",
      "asset_miso_celebrate_001",
      "asset_miso_garden_help_001",
      "asset_miso_seasonal_001",
      "asset_miso_sad_001",
      "asset_miso_sick_001",
      "asset_miso_messy_001"
    ]);
    expect(mockGeneratedAssets.every((asset) => asset.mimeType === "image/png" && asset.qualityStatus === "passed")).toBe(true);
  });
});
