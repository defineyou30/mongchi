import { describe, expect, it } from "vitest";

import { makeMockGeneratedAsset } from "@mongchi/shared";
import type { GeneratedAsset } from "@mongchi/shared";

import { buildHeroPoseSlides, getRemainingPoseCountByPackId, getUnlockOverlayHeadline, orderHeroPoseCells } from "./friendHeroPosePresentation";
import { getFriendPoseGalleryPresentation } from "./friendProfilePresentation";

const freeTrioAssets: GeneratedAsset[] = (["idle", "happy", "sleep"] as const).map((state) =>
  makeMockGeneratedAsset(state, { petId: "pet_local_001", generationJobId: "gen_local_001" })
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
  it("pairs every locked cell with its owning pack's card", () => {
    const { cells, cards } = getFriendPoseGalleryPresentation(freeTrioAssets, "Momo");

    const slides = buildHeroPoseSlides(cells, cards);
    const lockedSlides = slides.filter((slide) => slide.cell.status === "locked");

    expect(lockedSlides.length).toBeGreaterThan(0);
    for (const slide of lockedSlides) {
      expect(slide.lockedCard?.packId).toBe("pack-everyday-moments");
    }
  });

  it("never attaches a locked card to an owned slide", () => {
    const { cells, cards } = getFriendPoseGalleryPresentation(freeTrioAssets, "Momo");

    const slides = buildHeroPoseSlides(cells, cards);

    for (const slide of slides.filter((entry) => entry.cell.status === "owned")) {
      expect(slide.lockedCard).toBeNull();
    }
  });

  it("carries a pack's purchasing/failed status through to every one of its locked slides", () => {
    const { cells, cards } = getFriendPoseGalleryPresentation(freeTrioAssets, "Momo", {
      "pack-everyday-moments": { status: "failed", failureMessageSafe: "That didn't quite work. Let's try again." }
    });

    const slides = buildHeroPoseSlides(cells, cards);
    const lockedSlides = slides.filter((slide) => slide.cell.status === "locked");

    expect(lockedSlides.length).toBeGreaterThan(0);
    for (const slide of lockedSlides) {
      expect(slide.lockedCard?.status).toBe("failed");
      expect(slide.lockedCard?.failureLine).toBe("That didn't quite work. Let's try again.");
    }
  });

  it("orders slides idle-first, mirroring orderHeroPoseCells", () => {
    const { cells, cards } = getFriendPoseGalleryPresentation(freeTrioAssets, "Momo");

    const slides = buildHeroPoseSlides(cells, cards);

    expect(slides[0]?.cell.state).toBe("idle");
  });

  it("has no locked slides once every pack is fully owned", () => {
    const allAssets: GeneratedAsset[] = [
      ...freeTrioAssets,
      ...(["curious", "play", "hungry"] as const).map((state) =>
        makeMockGeneratedAsset(state, { petId: "pet_local_001", generationJobId: "gen_pack_001" })
      )
    ];
    const { cells, cards } = getFriendPoseGalleryPresentation(allAssets, "Momo");

    const slides = buildHeroPoseSlides(cells, cards);

    expect(slides.every((slide) => slide.cell.status === "owned")).toBe(true);
    expect(slides.every((slide) => slide.lockedCard === null)).toBe(true);
  });
});

describe("getRemainingPoseCountByPackId", () => {
  it("counts every locked slide belonging to the same pack, keyed by packId", () => {
    const { cells, cards } = getFriendPoseGalleryPresentation(freeTrioAssets, "Momo");
    const slides = buildHeroPoseSlides(cells, cards);

    const counts = getRemainingPoseCountByPackId(slides);

    expect(counts["pack-everyday-moments"]).toBe(3);
  });

  it("returns an empty map once every pack is fully owned (no locked slides left)", () => {
    const allAssets: GeneratedAsset[] = [
      ...freeTrioAssets,
      ...(["curious", "play", "hungry"] as const).map((state) =>
        makeMockGeneratedAsset(state, { petId: "pet_local_001", generationJobId: "gen_pack_001" })
      )
    ];
    const { cells, cards } = getFriendPoseGalleryPresentation(allAssets, "Momo");
    const slides = buildHeroPoseSlides(cells, cards);

    expect(getRemainingPoseCountByPackId(slides)).toEqual({});
  });
});

describe("getUnlockOverlayHeadline", () => {
  it("pluralizes 'moments' for counts other than one, and singularizes for exactly one", () => {
    expect(getUnlockOverlayHeadline(3, 12)).toBe("Unlock 3 more moments · 12cr");
    expect(getUnlockOverlayHeadline(1, 12)).toBe("Unlock 1 more moment · 12cr");
    expect(getUnlockOverlayHeadline(0, 12)).toBe("Unlock 0 more moments · 12cr");
  });
});
