import { describe, expect, it } from "vitest";

import {
  SNOWFLAKE_COUNT,
  STORM_LEAF_COUNT,
  WIND_LEAF_COUNT,
  buildSnowflakeParticles,
  buildWindLeafParticles
} from "./weatherParticleLayout";

describe("buildSnowflakeParticles", () => {
  it("defaults to SNOWFLAKE_COUNT flakes, within the 15-25 particle-count spec", () => {
    expect(SNOWFLAKE_COUNT).toBeGreaterThanOrEqual(15);
    expect(SNOWFLAKE_COUNT).toBeLessThanOrEqual(25);
    expect(buildSnowflakeParticles()).toHaveLength(SNOWFLAKE_COUNT);
  });

  it("respects an explicit count", () => {
    expect(buildSnowflakeParticles(6)).toHaveLength(6);
  });

  it("is a pure function of count -- identical input produces an identical particle set", () => {
    expect(buildSnowflakeParticles(SNOWFLAKE_COUNT)).toEqual(buildSnowflakeParticles(SNOWFLAKE_COUNT));
  });

  it("gives every flake a unique key", () => {
    const keys = buildSnowflakeParticles().map((flake) => flake.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("keeps every geometry/timing value within its intended range", () => {
    for (const flake of buildSnowflakeParticles()) {
      expect(flake.leftPercent).toBeGreaterThanOrEqual(0);
      expect(flake.leftPercent).toBeLessThan(100);
      expect(flake.restTopPercent).toBeGreaterThanOrEqual(0);
      expect(flake.restTopPercent).toBeLessThan(90);
      expect(flake.sizePx).toBeGreaterThan(0);
      expect(flake.baseOpacity).toBeGreaterThan(0);
      expect(flake.baseOpacity).toBeLessThanOrEqual(1);
      expect(flake.fallDurationMs).toBeGreaterThan(0);
      expect(flake.startDelayMs).toBeGreaterThanOrEqual(0);
      expect(flake.driftAmplitudePx).toBeGreaterThan(0);
      expect(flake.rotateAmplitudeDeg).toBeGreaterThan(0);
    }
  });

  it("varies fall duration and drift so flakes read as individually drifting, not a single repeated sprite", () => {
    const particles = buildSnowflakeParticles();
    const fallDurations = new Set(particles.map((flake) => flake.fallDurationMs));
    const drifts = new Set(particles.map((flake) => flake.driftAmplitudePx));

    expect(fallDurations.size).toBeGreaterThan(1);
    expect(drifts.size).toBeGreaterThan(1);
  });
});

describe("buildWindLeafParticles", () => {
  it("supports the wind particle spec's 3-6 count range", () => {
    expect(WIND_LEAF_COUNT).toBeGreaterThanOrEqual(3);
    expect(WIND_LEAF_COUNT).toBeLessThanOrEqual(6);
    expect(buildWindLeafParticles(WIND_LEAF_COUNT)).toHaveLength(WIND_LEAF_COUNT);
  });

  it("supports a smaller storm-flourish count", () => {
    expect(STORM_LEAF_COUNT).toBeLessThan(WIND_LEAF_COUNT);
    expect(buildWindLeafParticles(STORM_LEAF_COUNT)).toHaveLength(STORM_LEAF_COUNT);
  });

  it("is a pure function of count -- identical input produces an identical particle set", () => {
    expect(buildWindLeafParticles(WIND_LEAF_COUNT)).toEqual(buildWindLeafParticles(WIND_LEAF_COUNT));
  });

  it("gives every leaf a unique key", () => {
    const keys = buildWindLeafParticles(WIND_LEAF_COUNT).map((leaf) => leaf.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("mixes both crossing directions rather than sending every leaf the same way", () => {
    const directions = new Set(buildWindLeafParticles(WIND_LEAF_COUNT).map((leaf) => leaf.direction));
    expect(directions.has(1)).toBe(true);
    expect(directions.has(-1)).toBe(true);
  });

  it("keeps every geometry/timing value within its intended range", () => {
    for (const leaf of buildWindLeafParticles(WIND_LEAF_COUNT)) {
      expect([1, -1]).toContain(leaf.direction);
      expect(leaf.topPercent).toBeGreaterThanOrEqual(0);
      expect(leaf.topPercent).toBeLessThan(100);
      expect(leaf.restLeftPercent).toBeGreaterThanOrEqual(0);
      expect(leaf.restLeftPercent).toBeLessThan(96);
      expect(leaf.crossDurationMs).toBeGreaterThan(0);
      expect(leaf.pauseDurationMs).toBeGreaterThan(0);
      expect(leaf.bobAmplitudePx).toBeGreaterThan(0);
      expect(leaf.rotateAmplitudeDeg).toBeGreaterThan(0);
    }
  });
});
