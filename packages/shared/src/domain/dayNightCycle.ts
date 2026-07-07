import type { GeneratedAssetState } from "./assets";

/**
 * Tier 3 "world autonomy" (docs/gamefeel-sound-plan.md §1 Tier 3): local-time
 * sleep, small autonomous idle behaviors, and a rare daytime butterfly
 * visitor -- all pure judgment functions so the screen only wires up timers
 * and Animated values, never decision logic.
 *
 * Night boundary matches apps/mobile/src/shared/audio/bgmAssets.ts's
 * `isDaytimeHour` (22:00 up to, not including, 06:00) on purpose -- the BGM
 * day/night crossfade and this sleep visual should always agree on when
 * "night" starts, so re-derive it once here rather than importing from the
 * mobile app (packages/shared cannot depend on apps/mobile).
 */
export const NIGHT_START_HOUR = 22;
export const NIGHT_END_HOUR = 6;

/** True for local hours 22:00-23:59 and 00:00-05:59 -- the sleep window. */
export const isNightHour = (hour: number): boolean => hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;

/** Reads the given ISO timestamp's local hour and applies `isNightHour`. */
export const isNightTime = (nowIso: string): boolean => isNightHour(new Date(nowIso).getHours());

/**
 * Whether tonight's first entry (or any entry during the sleep window)
 * should show the short "just woke up" stretch beat instead of settling
 * straight into the sleeping pose: true only the moment `nowIso` has crossed
 * from night into day since `lastSeenIso` -- i.e. the owner was last here
 * while the pet was asleep, and it is now daytime. A `lastSeenIso` of null
 * (first-ever session) never triggers a stretch -- there is nothing to wake
 * up *from* yet, and the app's own first-launch welcome flow already owns
 * that moment.
 */
export const shouldShowMorningStretch = (lastSeenIso: string | null, nowIso: string): boolean => {
  if (!lastSeenIso) {
    return false;
  }

  return isNightTime(lastSeenIso) && !isNightTime(nowIso);
};

/**
 * A gentle, penalty-free acknowledgement line for a care action taken during
 * the sleep window -- the pet briefly acknowledges the touch and settles
 * back down, never a scold or a guilt line (healing-app tone, see CLAUDE.md).
 */
export const NIGHT_CARE_ACKNOWLEDGEMENT_LINE = "Mmh... thank you. *settles back into a cozy curl*";

export interface AutonomousBehaviorPick {
  /** Which existing expression state to briefly swap to (never a new/paid asset). */
  expression: GeneratedAssetState;
  /** A small, purely cosmetic motion flourish layered on top of the expression swap. */
  motion: "shift" | "bounce" | "flip" | "none";
}

/**
 * The small day-time "gone but not frozen" behaviors an idle, uncared-for
 * pet cycles through between 40-90s beats (see getAutonomousBehaviorIntervalMs).
 * Kept to expressions the free tier already ships (idle/happy/sleep) plus the
 * two paid-pack ones (curious/play) that selectGeneratedAssetForReaction
 * already falls back gracefully from when the pack isn't owned -- no new
 * artwork, ever.
 */
const autonomousBehaviorPool: AutonomousBehaviorPick[] = [
  { expression: "curious", motion: "shift" },
  { expression: "happy", motion: "bounce" },
  { expression: "play", motion: "flip" },
  { expression: "curious", motion: "none" },
  { expression: "happy", motion: "shift" }
];

/** Seeded pick from the small autonomous-behavior pool -- pass a `0..1` roll (e.g. from createSeededRandom). */
export const pickAutonomousBehavior = (roll: number): AutonomousBehaviorPick => {
  const clamped = Math.min(0.999999, Math.max(0, roll));
  const index = Math.floor(clamped * autonomousBehaviorPool.length);

  return autonomousBehaviorPool[index] ?? autonomousBehaviorPool[0]!;
};

export const AUTONOMOUS_BEHAVIOR_MIN_INTERVAL_MS = 40_000;
export const AUTONOMOUS_BEHAVIOR_MAX_INTERVAL_MS = 90_000;

/** Seeded 40-90s gap between autonomous idle beats -- pass a `0..1` roll so the same seed always resolves to the same wait. */
export const getAutonomousBehaviorIntervalMs = (roll: number): number => {
  const clamped = Math.min(1, Math.max(0, roll));

  return Math.round(
    AUTONOMOUS_BEHAVIOR_MIN_INTERVAL_MS + clamped * (AUTONOMOUS_BEHAVIOR_MAX_INTERVAL_MS - AUTONOMOUS_BEHAVIOR_MIN_INTERVAL_MS)
  );
};

/** How long a single autonomous behavior beat stays on screen before settling back to the normal idle pose. */
export const AUTONOMOUS_BEHAVIOR_HOLD_MS = 2600;

export const BUTTERFLY_VISIT_CHANCE = 0.15;

/**
 * Whether a butterfly visitor should appear this home-screen entry: a low,
 * one-shot-per-entry daytime roll (never at night -- the pet and garden are
 * asleep). Pass a seeded `0..1` roll (e.g. from createSeededRandom keyed by
 * pet id + entry timestamp) so the decision is stable for that visit rather
 * than reshuffling on every re-render.
 */
export const shouldSpawnButterflyVisit = (roll: number, isDaytime: boolean): boolean => {
  if (!isDaytime) {
    return false;
  }

  return roll < BUTTERFLY_VISIT_CHANCE;
};

/** Reaction lines for tapping the rare butterfly visitor -- short, warm, no memory-spine write in this wave (see plan doc scope note). */
export const BUTTERFLY_TAP_LINES: readonly string[] = [
  "Ooh, a little visitor!",
  "A butterfly! Can I keep it?"
];

/** Seeded pick between the butterfly tap lines. */
export const pickButterflyTapLine = (roll: number): string => {
  const clamped = Math.min(0.999999, Math.max(0, roll));
  const index = Math.floor(clamped * BUTTERFLY_TAP_LINES.length);

  return BUTTERFLY_TAP_LINES[index] ?? BUTTERFLY_TAP_LINES[0]!;
};
