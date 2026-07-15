import { describe, expect, it } from "vitest";

import {
  getInitialShareCardPoseState,
  getInitialShareCardThemeId,
  getShareCardPoseOptions,
  getShareCardThemeOptions,
  resolveShareCardPoseAssetId,
  selectShareCardPose,
  selectShareCardTheme
} from "./shareCardPresentation";
import type { FriendPoseCell } from "./friendProfilePresentation";

const ownedCell = (state: FriendPoseCell["state"], assetId: string): FriendPoseCell => ({
  state,
  status: "owned",
  assetId
});

const lockedCell = (state: FriendPoseCell["state"]): FriendPoseCell => ({
  state,
  status: "locked",
  assetId: null
});

describe("getShareCardPoseOptions", () => {
  it("only includes owned poses, ordered idle-first", () => {
    const cells = [
      ownedCell("happy", "asset_happy"),
      ownedCell("idle", "asset_idle"),
      lockedCell("play")
    ];

    const options = getShareCardPoseOptions(cells);

    expect(options.map((option) => option.state)).toEqual(["idle", "happy"]);
    expect(options.every((option) => typeof option.assetId === "string" && option.assetId!.length > 0)).toBe(true);
  });

  it("labels each pose in the requested locale", () => {
    const cells = [ownedCell("idle", "asset_idle"), ownedCell("play", "asset_play")];

    const enOptions = getShareCardPoseOptions(cells, "en-US");
    const koOptions = getShareCardPoseOptions(cells, "ko-KR");

    expect(enOptions.find((option) => option.state === "play")?.label).toBe("Playful");
    expect(koOptions.find((option) => option.state === "play")?.label).toBe("신나게");
  });

  it("falls back to a single idle option with a null asset id when nothing is owned yet", () => {
    const options = getShareCardPoseOptions([]);

    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({ state: "idle", assetId: null });
  });
});

describe("getInitialShareCardPoseState / selectShareCardPose", () => {
  const options = getShareCardPoseOptions([ownedCell("idle", "asset_idle"), ownedCell("happy", "asset_happy")]);

  it("keeps a preferred pose when it is owned", () => {
    expect(getInitialShareCardPoseState(options, "happy")).toBe("happy");
  });

  it("falls back to the first option when the preferred pose is not owned", () => {
    expect(getInitialShareCardPoseState(options, "sleep")).toBe("idle");
  });

  it("falls back to the first option when there is no preference yet", () => {
    expect(getInitialShareCardPoseState(options, null)).toBe("idle");
  });

  it("rejects selecting a pose that is not among the owned options", () => {
    expect(selectShareCardPose(options, "sleep", "idle")).toBe("idle");
    expect(selectShareCardPose(options, "happy", "idle")).toBe("happy");
  });
});

describe("resolveShareCardPoseAssetId", () => {
  it("resolves the asset id for an owned pose state", () => {
    const options = getShareCardPoseOptions([ownedCell("idle", "asset_idle")]);

    expect(resolveShareCardPoseAssetId(options, "idle")).toBe("asset_idle");
  });

  it("returns null for a state absent from the options", () => {
    const options = getShareCardPoseOptions([ownedCell("idle", "asset_idle")]);

    expect(resolveShareCardPoseAssetId(options, "happy")).toBeNull();
  });
});

describe("getShareCardThemeOptions", () => {
  it("always includes the default garden even with no purchases", () => {
    const options = getShareCardThemeOptions([]);

    expect(options).toEqual([{ themeId: "theme-default-garden", name: "Cozy Garden" }]);
  });

  it("filters out themes the player has not purchased", () => {
    const options = getShareCardThemeOptions(["theme-fairy-garden"]);

    expect(options.map((option) => option.themeId)).toEqual(["theme-default-garden", "theme-fairy-garden"]);
  });

  it("includes every owned theme and localizes each name", () => {
    const ownedThemeIds = ["theme-fairy-garden", "theme-seaside-cove", "theme-autumn-woods", "theme-winter-lights"];

    const enOptions = getShareCardThemeOptions(ownedThemeIds, "en-US");
    const koOptions = getShareCardThemeOptions(ownedThemeIds, "ko-KR");

    expect(enOptions.map((option) => option.name)).toEqual([
      "Cozy Garden",
      "Fairy Garden",
      "Seaside Cove",
      "Autumn Woods",
      "Winter Lights"
    ]);
    expect(koOptions.find((option) => option.themeId === "theme-fairy-garden")?.name).toBe("요정 정원");
  });
});

describe("getInitialShareCardThemeId / selectShareCardTheme", () => {
  const options = getShareCardThemeOptions(["theme-fairy-garden"]);

  it("keeps a preferred theme when it is owned", () => {
    expect(getInitialShareCardThemeId(options, "theme-fairy-garden")).toBe("theme-fairy-garden");
  });

  it("falls back to the default garden when the preferred theme is not owned", () => {
    expect(getInitialShareCardThemeId(options, "theme-seaside-cove")).toBe("theme-default-garden");
  });

  it("falls back to the default garden when there is no preference yet", () => {
    expect(getInitialShareCardThemeId(options, null)).toBe("theme-default-garden");
  });

  it("rejects selecting a theme the player does not own", () => {
    expect(selectShareCardTheme(options, "theme-seaside-cove", "theme-default-garden")).toBe("theme-default-garden");
    expect(selectShareCardTheme(options, "theme-fairy-garden", "theme-default-garden")).toBe("theme-fairy-garden");
  });
});
