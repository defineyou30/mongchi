import { describe, expect, it } from "vitest";

import { expressionPacks, makeMockGeneratedAsset } from "@mongchi/shared";
import type { GeneratedAsset } from "@mongchi/shared";

import { buildHeroPoseSlides, getHeroPoseLabel, orderHeroPoseCells } from "./friendHeroPosePresentation";
import { getFriendPoseGalleryPresentation } from "./friendProfilePresentation";

const freeTrioAssets: GeneratedAsset[] = (["idle", "happy", "sleep"] as const).map((state) =>
  makeMockGeneratedAsset(state, { petId: "pet_local_001", generationJobId: "gen_local_001" })
);
const paidPackAssets: GeneratedAsset[] = expressionPacks.flatMap((pack) =>
  pack.states.map((state) => makeMockGeneratedAsset(state, { petId: "pet_local_001", generationJobId: `gen_${pack.id}` }))
);

describe("orderHeroPoseCells", () => {
  it("moves idle to the front when it isn't already first", () => {
    const { cells } = getFriendPoseGalleryPresentation(freeTrioAssets, "Momo");
    // getFriendPoseGalleryPresentation happens to already put idle first here,
    // so shuffle it to the back to prove the reorder actually does something.
    const shuffled = [...cells.filter((cell) => cell.state !== "idle"), ...cells.filter((cell) => cell.state === "idle")];

    const ordered = orderHeroPoseCells(shuffled);

    expect(ordered[0]?.state).toBe("idle");
    // every original cell is still present, just reordered
    expect(ordered.map((cell) => cell.state).sort()).toEqual(shuffled.map((cell) => cell.state).sort());
  });

  it("is a no-op when idle is already first (and never mutates the input array)", () => {
    const { cells } = getFriendPoseGalleryPresentation(freeTrioAssets, "Momo");
    const originalOrder = [...cells];

    const ordered = orderHeroPoseCells(cells);

    expect(ordered).toEqual(originalOrder);
    expect(cells).toEqual(originalOrder);
  });

  it("leaves the list untouched when there is no idle cell at all", () => {
    const { cells } = getFriendPoseGalleryPresentation(freeTrioAssets, "Momo");
    const withoutIdle = cells.filter((cell) => cell.state !== "idle");

    expect(orderHeroPoseCells(withoutIdle)).toEqual(withoutIdle);
  });
});

describe("buildHeroPoseSlides", () => {
  it("keeps locked shop inventory out of the profile pager", () => {
    const { cells } = getFriendPoseGalleryPresentation(freeTrioAssets, "Momo");

    const slides = buildHeroPoseSlides(cells);

    expect(slides).toHaveLength(freeTrioAssets.length);
    expect(slides.every((slide) => slide.cell.status === "owned")).toBe(true);
  });

  it("orders slides idle-first, mirroring orderHeroPoseCells", () => {
    const { cells } = getFriendPoseGalleryPresentation(freeTrioAssets, "Momo");

    const slides = buildHeroPoseSlides(cells);

    expect(slides[0]?.cell.state).toBe("idle");
  });

  it("has no locked slides once every pack is fully owned", () => {
    const allAssets: GeneratedAsset[] = [...freeTrioAssets, ...paidPackAssets];
    const { cells } = getFriendPoseGalleryPresentation(allAssets, "Momo");

    const slides = buildHeroPoseSlides(cells);

    expect(slides.every((slide) => slide.cell.status === "owned")).toBe(true);
  });

  it("supplies an idle fallback when no generated assets are readable", () => {
    const { cells } = getFriendPoseGalleryPresentation([], "Momo");

    expect(buildHeroPoseSlides(cells).map((slide) => slide.cell.state)).toEqual(["idle"]);
  });
});

describe("getHeroPoseLabel", () => {
  it("uses friendly starter and paid pose names", () => {
    expect(getHeroPoseLabel("idle")).toBe("Everyday");
    expect(getHeroPoseLabel("treat_reaction")).toBe("Treat joy");
  });

  it("uses Korean starter and paid pose names without changing state ids", () => {
    expect(getHeroPoseLabel("idle", "ko-KR")).toBe("일상");
    expect(getHeroPoseLabel("treat_reaction", "ko-KR")).toBe("간식 최고");
  });

  it("uses Japanese and German labels for starter and paid poses", () => {
    expect(getHeroPoseLabel("sleep", "ja-JP")).toBe("ねむねむ");
    expect(getHeroPoseLabel("treat_reaction", "de-DE")).toBe("Leckerli-Freude");
  });

  it("localizes a base pose instead of exposing its state id", () => {
    expect(getHeroPoseLabel("base", "pt-BR")).toBe("Pose base");
  });
});
