/**
 * Running "live commentary" lines shown over the paw-print trail during a
 * walk's wait (user feedback: the 3-minute wait with nothing but a paw
 * animation and a countdown read as dead air). A short line fades in every
 * 40-60s, tied to how far along the walk is -- early sniffing, a mid-walk
 * beat, then a late "found something" line that primes the reward the walk
 * panel's "Greet & claim" button delivers once the pet is back.
 *
 * Pure judgment/selection only: callers own the timer that decides *when*
 * to roll a new line (see getWalkCommentaryIntervalMs) and the fade
 * choreography -- this module only decides *which* line, deterministically,
 * from a seeded 0..1 roll (same pattern as pickButterflyTapLine /
 * pickAutonomousBehavior in dayNightCycle.ts).
 */

export type WalkCommentaryStage = "early" | "mid" | "late";

/**
 * Templates use `{petName}` where the pet's name should be substituted --
 * matches the walk panel's own "`${activePet.name} is on the path`" phrasing
 * (TerrariumHomeScreen.tsx) rather than a pronoun-only line, so the running
 * commentary reads as being about *this* specific pet.
 */
const walkCommentaryTemplatesByStage: Record<WalkCommentaryStage, readonly string[]> = {
  early: [
    "{petName} is sniffing something very important…",
    "{petName}'s ears just perked up at something exciting.",
    "Nose down, tail up -- {petName} is on a mission."
  ],
  mid: [
    "Made a friend. It's a leaf.",
    "{petName} stopped to say hello to a very serious pigeon.",
    "Chasing a shadow. {petName} is winning, probably."
  ],
  late: [
    "Found something! Bringing it home.",
    "{petName} is trotting back with a little treasure.",
    "Almost home -- and {petName} looks very proud of something.",
    "One last happy zoomie before the front door."
  ]
};

/** Total lines across all three stages (kept to a 8-10 line pool per the design ask). */
export const WALK_COMMENTARY_LINE_COUNT = Object.values(walkCommentaryTemplatesByStage).reduce(
  (total, lines) => total + lines.length,
  0
);

/** Fills the `{petName}` token, falling back to a neutral label for a blank name. */
export const formatWalkCommentaryLine = (template: string, petName: string): string =>
  template.replaceAll("{petName}", petName.trim() || "Your pet");

/**
 * Maps a 0..1 walk-progress fraction to a three-act stage: sniffing around
 * (early), settled into the walk (mid), or heading home with a find (late).
 * Even thirds keep each stage's window simple and easy to reason about.
 */
export const getWalkCommentaryStage = (progress: number): WalkCommentaryStage => {
  const clamped = Math.min(1, Math.max(0, progress));

  if (clamped < 1 / 3) {
    return "early";
  }

  if (clamped < 2 / 3) {
    return "mid";
  }

  return "late";
};

/** How far into the walk `elapsedMs` is, as a 0..1 fraction of `durationMs`. Defensive against a zero/negative duration. */
export const getWalkProgress = (elapsedMs: number, durationMs: number): number => {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return 1;
  }

  return Math.min(1, Math.max(0, elapsedMs / durationMs));
};

/** Seeded pick from the given stage's line pool, formatted for `petName`. Pass a `0..1` roll (e.g. from createSeededRandom). */
export const pickWalkCommentaryLine = (stage: WalkCommentaryStage, roll: number, petName: string): string => {
  const templates = walkCommentaryTemplatesByStage[stage];
  const clamped = Math.min(0.999999, Math.max(0, roll));
  const index = Math.floor(clamped * templates.length);
  const template = templates[index] ?? templates[0]!;

  return formatWalkCommentaryLine(template, petName);
};

/** Convenience wrapper: derives the stage from elapsed/duration, then picks a line for it. */
export const pickWalkCommentaryLineForElapsed = (
  elapsedMs: number,
  durationMs: number,
  roll: number,
  petName: string
): string => pickWalkCommentaryLine(getWalkCommentaryStage(getWalkProgress(elapsedMs, durationMs)), roll, petName);

export const WALK_COMMENTARY_MIN_INTERVAL_MS = 40_000;
export const WALK_COMMENTARY_MAX_INTERVAL_MS = 60_000;

/** Seeded 40-60s gap between commentary beats -- pass a `0..1` roll so the same seed always resolves to the same wait. */
export const getWalkCommentaryIntervalMs = (roll: number): number => {
  const clamped = Math.min(1, Math.max(0, roll));

  return Math.round(
    WALK_COMMENTARY_MIN_INTERVAL_MS + clamped * (WALK_COMMENTARY_MAX_INTERVAL_MS - WALK_COMMENTARY_MIN_INTERVAL_MS)
  );
};
