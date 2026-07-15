/**
 * Pure per-particle layout math for WeatherSceneLayer's snow/wind particle
 * effects, split out of the component itself for the same reason
 * homeStageLayout.ts is split out of TerrariumHomeScreen.tsx: components
 * that wire Animated.Value loops through useRef/useEffect aren't unit
 * tested directly in this app (see ButterflyVisitorLayer.tsx and
 * NightOverlayLayer.tsx -- both hook-driven, neither has a test file)
 * because calling a hook-using component as a plain function outside a
 * real React render throws. Keeping the deterministic particle geometry
 * here as hook-free pure functions keeps it covered by vitest while the
 * component itself stays thin Animated-wiring glue.
 *
 * Every value below is derived from the particle's index via fixed
 * arithmetic (no Math.random()), so two calls with the same count produce
 * an identical particle set -- deterministic, reproducible, and safe to
 * compute once at module scope (see WeatherSceneLayer.tsx).
 */

/** 15-25 per the snow particle spec -- individually drifting flakes. */
export const SNOWFLAKE_COUNT = 20;
/** 3-6 per the wind particle spec -- an intermittent handful, not a swarm. */
export const WIND_LEAF_COUNT = 5;
/** Storm reuses the same wind-leaf particle, just a smaller flourish count. */
export const STORM_LEAF_COUNT = 2;

export interface SnowflakeParticleSpec {
  readonly key: string;
  /** Horizontal anchor, as a percent of the scene width (static style, not animated). */
  readonly leftPercent: number;
  /** Vertical resting position (percent) used only when Reduce Motion holds the flake still. */
  readonly restTopPercent: number;
  readonly sizePx: number;
  readonly baseOpacity: number;
  /** One full top-to-bottom fall, in ms -- also the loop's continuous-fall duration. */
  readonly fallDurationMs: number;
  /** One-time delay before this flake's first fall, so flakes don't all start bunched near the top. */
  readonly startDelayMs: number;
  /** Peak horizontal sway distance (px) while falling. */
  readonly driftAmplitudePx: number;
  readonly rotateAmplitudeDeg: number;
}

export interface WindLeafParticleSpec {
  readonly key: string;
  /** 1 crosses left-to-right, -1 crosses right-to-left. */
  readonly direction: 1 | -1;
  /** Vertical band the crossing happens in, as a percent of the scene height. */
  readonly topPercent: number;
  /** Horizontal resting position (percent) used only when Reduce Motion holds the leaf still. */
  readonly restLeftPercent: number;
  readonly crossDurationMs: number;
  /** How long the leaf waits, parked off-screen, between crossings -- the "intermittent" part. */
  readonly pauseDurationMs: number;
  /** Peak vertical bob distance (px) along the curved crossing path. */
  readonly bobAmplitudePx: number;
  readonly rotateAmplitudeDeg: number;
}

export const buildSnowflakeParticles = (count: number = SNOWFLAKE_COUNT): SnowflakeParticleSpec[] =>
  Array.from({ length: count }, (_, index) => ({
    key: `snow-${index}`,
    leftPercent: (index * 53 + 7) % 100,
    restTopPercent: (index * 29 + 8) % 90,
    sizePx: 3 + (index % 4) * 1.5,
    baseOpacity: 0.32 + (index % 3) * 0.14,
    fallDurationMs: 6200 + (index % 5) * 900,
    startDelayMs: (index * 431) % 4200,
    driftAmplitudePx: 10 + (index % 4) * 4,
    rotateAmplitudeDeg: 8 + (index % 3) * 4
  }));

export const buildWindLeafParticles = (count: number): WindLeafParticleSpec[] =>
  Array.from({ length: count }, (_, index) => ({
    key: `leaf-${index}`,
    direction: index % 2 === 0 ? 1 : -1,
    topPercent: 14 + (index % 4) * 11,
    restLeftPercent: (index * 23 + 5) % 96,
    crossDurationMs: 5200 + (index % 3) * 900,
    pauseDurationMs: 2600 + (index % 4) * 1300,
    bobAmplitudePx: 12 + (index % 3) * 6,
    rotateAmplitudeDeg: 18 + (index % 3) * 6
  }));
