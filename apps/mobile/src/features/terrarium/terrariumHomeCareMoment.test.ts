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

  it("has no staging for actions outside the Tier 2 scope (walk, rest, talk, treat)", () => {
    const unstagedActions: CareActionType[] = ["walk", "rest", "talk", "treat"];

    for (const action of unstagedActions) {
      expect(getCareMomentStaging(action)).toBeNull();
    }
  });

  it("returns a fresh staging object each call rather than a shared mutable reference", () => {
    const first = getCareMomentStaging("feed");
    const second = getCareMomentStaging("feed");

    expect(first).toEqual(second);
  });
});
