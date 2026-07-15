import { describe, expect, it } from "vitest";

import type { CareActionType } from "@mongchi/shared";

import { getCareMomentStaging } from "./terrariumHomeCareMoment";

describe("terrarium home care moment staging", () => {
  it("stages a food bowl for feed with an appear/hold/disappear timeline that adds up to the total", () => {
    const staging = getCareMomentStaging("feed");

    expect(staging?.kind).toBe("bowl");
    if (staging?.kind !== "bowl") {
      throw new Error("expected bowl staging");
    }

    expect(staging.item).toBe("foodBowl");
    expect(staging.appearMs + staging.holdMs + staging.disappearMs).toBe(staging.totalMs);
  });

  it("stages a distinct water bowl asset for water_garden using the same bowl pattern as feed", () => {
    const feedStaging = getCareMomentStaging("feed");
    const waterStaging = getCareMomentStaging("water_garden");

    expect(waterStaging?.kind).toBe("bowl");
    if (waterStaging?.kind !== "bowl" || feedStaging?.kind !== "bowl") {
      throw new Error("expected bowl staging for both feed and water_garden");
    }

    expect(waterStaging.item).toBe("drinkWaterBowl");
    expect(waterStaging.item).not.toBe(feedStaging.item);
    expect(waterStaging.totalMs).toBe(feedStaging.totalMs);
  });

  it("stages a rolling ball for play", () => {
    const staging = getCareMomentStaging("play");

    expect(staging?.kind).toBe("ball");
    if (staging?.kind !== "ball") {
      throw new Error("expected ball staging");
    }

    expect(staging.item).toBe("toyBall");
    expect(staging.totalMs).toBeGreaterThan(0);
  });

  it("stages a 2-3 heart burst for affection", () => {
    const staging = getCareMomentStaging("affection");

    expect(staging?.kind).toBe("heartBurst");
    if (staging?.kind !== "heartBurst") {
      throw new Error("expected heartBurst staging");
    }

    expect(staging.heartCount).toBeGreaterThanOrEqual(2);
    expect(staging.heartCount).toBeLessThanOrEqual(3);
  });

  it("stages a 2-3 bubble burst for clean (Bath)", () => {
    const staging = getCareMomentStaging("clean");

    expect(staging?.kind).toBe("bubbleBurst");
    if (staging?.kind !== "bubbleBurst") {
      throw new Error("expected bubbleBurst staging");
    }

    expect(staging.bubbleCount).toBeGreaterThanOrEqual(2);
    expect(staging.bubbleCount).toBeLessThanOrEqual(3);
    expect(staging.totalMs).toBeGreaterThan(0);
  });

  it("has no staging for actions outside the Tier 2 scope (walk, rest, talk)", () => {
    // treat used to be unstaged too, but the 2026-07 "every item gets its
    // own moment" decision brought it into scope (see the treat tests
    // below) -- rest stays out because it has no dock entry to press it
    // from today, and walk/talk never had a Tier 2 moment to begin with.
    const unstagedActions: CareActionType[] = ["walk", "rest", "talk"];

    for (const action of unstagedActions) {
      expect(getCareMomentStaging(action)).toBeNull();
    }
  });

  it("returns a fresh staging object each call rather than a shared mutable reference", () => {
    const first = getCareMomentStaging("feed");
    const second = getCareMomentStaging("feed");

    expect(first).toEqual(second);
  });

  it("swaps the generic bowl art for the specific treat that was fed", () => {
    const staging = getCareMomentStaging("feed", "item_salmon_bites");

    expect(staging?.kind).toBe("bowl");
    if (staging?.kind !== "bowl") {
      throw new Error("expected bowl staging");
    }

    expect(staging.item).toBe("salmonBites");
  });

  it("swaps the generic water bowl art for the specific drink that was used", () => {
    const staging = getCareMomentStaging("water_garden", "item_berry_milk");

    expect(staging?.kind).toBe("bowl");
    if (staging?.kind !== "bowl") {
      throw new Error("expected bowl staging");
    }

    expect(staging.item).toBe("berryMilk");
  });

  it("swaps the generic ball art for the specific toy that was played with", () => {
    const staging = getCareMomentStaging("play", "item_moon_frisbee");

    expect(staging?.kind).toBe("ball");
    if (staging?.kind !== "ball") {
      throw new Error("expected ball staging");
    }

    expect(staging.item).toBe("moonFrisbee");
  });

  it("adds the specific bed item's icon to the affection heart burst when one was used", () => {
    const withItem = getCareMomentStaging("affection", "item_clover_nap_mat");
    const withoutItem = getCareMomentStaging("affection");

    expect(withItem?.kind).toBe("heartBurst");
    if (withItem?.kind !== "heartBurst") {
      throw new Error("expected heartBurst staging");
    }

    expect(withItem.item).toBe("cloverNapMat");
    expect(withoutItem?.kind).toBe("heartBurst");
    if (withoutItem?.kind !== "heartBurst") {
      throw new Error("expected heartBurst staging");
    }

    expect(withoutItem.item).toBeUndefined();
  });

  it("falls back to the base staging when the itemId isn't a known game item", () => {
    const staging = getCareMomentStaging("feed", "not_a_real_item" as never);

    expect(staging?.kind).toBe("bowl");
    if (staging?.kind !== "bowl") {
      throw new Error("expected bowl staging");
    }

    expect(staging.item).toBe("foodBowl");
  });

  it("ignores a null/undefined itemId the same as calling with no itemId at all", () => {
    expect(getCareMomentStaging("feed", null)).toEqual(getCareMomentStaging("feed"));
    expect(getCareMomentStaging("feed", undefined)).toEqual(getCareMomentStaging("feed"));
  });

  it("still has no staging for unstaged actions even when an itemId is provided", () => {
    expect(getCareMomentStaging("rest", "item_cushion_rose")).toBeNull();
    expect(getCareMomentStaging("walk", "item_salmon_bites")).toBeNull();
  });

  it("stages a treat plate for the base treat action with the same bowl timeline as feed", () => {
    const staging = getCareMomentStaging("treat");
    const feedStaging = getCareMomentStaging("feed");

    expect(staging?.kind).toBe("bowl");
    if (staging?.kind !== "bowl" || feedStaging?.kind !== "bowl") {
      throw new Error("expected bowl staging for both treat and feed");
    }

    expect(staging.item).toBe("treatPlate");
    expect(staging.appearMs + staging.holdMs + staging.disappearMs).toBe(staging.totalMs);
    expect(staging.totalMs).toBe(feedStaging.totalMs);
  });

  it("swaps the generic treat plate art for the specific treat that was used", () => {
    const staging = getCareMomentStaging("treat", "item_duck_biscuit");

    expect(staging?.kind).toBe("bowl");
    if (staging?.kind !== "bowl") {
      throw new Error("expected bowl staging");
    }

    expect(staging.item).toBe("duckBiscuit");
  });
});
