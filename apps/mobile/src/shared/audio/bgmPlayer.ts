import { createAudioPlayer } from "expo-audio";
import type { AudioPlayer } from "expo-audio";

import { bgmAssetSources, bgmTrackForTimeOfDay } from "./bgmAssets";
import type { BgmTrackId } from "./bgmAssets";
import { getActiveAudioSettings } from "./useAudioSettings";

// BGM sits well under SFX/jingles since it loops continuously underneath
// every interaction -- see synth_bgm.py's -14/-16dBFS RMS target for the
// placeholder tracks themselves. This is the steady-state ceiling; ducking
// (see duckBgm below) temporarily multiplies it down further.
const BGM_VOLUME = 0.55;

// How long a crossfade between two BGM tracks (day<->night swap) takes.
// Long enough to be unnoticeable as a "cut", short enough that a settings
// toggle or scene change doesn't leave two tracks audibly overlapping for
// long.
const CROSSFADE_MS = 2500;

// How long a ducking ramp (volume dip for a jingle, then recovery) takes on
// each side.
const DUCK_RAMP_MS = 200;
const DUCK_VOLUME_MULTIPLIER = 0.35;

const VOLUME_STEP_MS = 50;

let players: Partial<Record<BgmTrackId, AudioPlayer>> | null = null;

// The track that *should* be audible right now, independent of whether
// "Music & ambience" is currently on. Kept even while the setting is off so
// that flipping the setting back on (via syncBgmWithSettings, called from
// the Settings screen toggle) can resume the right track immediately
// without needing the screen that originally called playBgm to remount.
let desiredTrackId: BgmTrackId | null = null;
let duckDepth = 0; // number of overlapping duckBgm() calls currently active

const getOrCreatePlayers = (): Partial<Record<BgmTrackId, AudioPlayer>> => {
  if (!players) {
    const created: Partial<Record<BgmTrackId, AudioPlayer>> = {};

    for (const id of Object.keys(bgmAssetSources) as BgmTrackId[]) {
      try {
        const player = createAudioPlayer(bgmAssetSources[id]);
        player.loop = true;
        player.volume = 0;
        created[id] = player;
      } catch {
        // Silent: a single bad/missing BGM asset should never block the
        // rest of the app from working -- see the equivalent comment in
        // sfxPlayer.ts's getOrCreatePlayers.
      }
    }

    players = created;
  }

  return players;
};

/** Preloads both BGM tracks up front (call once near app startup). */
export const preloadBgm = (): void => {
  getOrCreatePlayers();
};

const targetVolumeForTrack = (id: BgmTrackId): number => {
  if (desiredTrackId !== id || !getActiveAudioSettings().musicEnabled) {
    return 0;
  }

  return BGM_VOLUME * (duckDepth > 0 ? DUCK_VOLUME_MULTIPLIER : 1);
};

/**
 * Ramps a player's volume from its current value to `target` over
 * `durationMs`, in small steps. Cancels cleanly (no queued step will
 * override a newer ramp) by stamping each ramp with a token and checking it
 * still owns the player before writing -- see rampToken usage below.
 */
const rampTokens = new WeakMap<AudioPlayer, number>();
let nextRampToken = 1;

const rampVolume = (player: AudioPlayer, target: number, durationMs: number): void => {
  const token = nextRampToken++;
  rampTokens.set(player, token);

  const steps = Math.max(1, Math.round(durationMs / VOLUME_STEP_MS));
  const start = player.volume;
  let step = 0;

  const tick = () => {
    if (rampTokens.get(player) !== token) {
      return; // superseded by a newer ramp
    }

    step += 1;
    const t = step / steps;
    try {
      player.volume = start + (target - start) * t;
    } catch {
      return; // player was released mid-ramp
    }

    if (step < steps) {
      setTimeout(tick, VOLUME_STEP_MS);
    }
  };

  if (steps <= 1) {
    try {
      player.volume = target;
    } catch {
      // Silent: see rampVolume doc comment above.
    }
    return;
  }

  setTimeout(tick, VOLUME_STEP_MS);
};

const playTrackSilently = (player: AudioPlayer): void => {
  try {
    if (!player.playing) {
      player.play();
    }
  } catch {
    // Silent: a BGM track failing to start should never crash the screen
    // it's attached to.
  }
};

const stopTrack = (player: AudioPlayer): void => {
  try {
    player.pause();
    player.seekTo(0);
  } catch {
    // Silent: see stopTrack doc comment above.
  }
};

/**
 * Starts (or crossfades into) the given BGM track. Records `trackId` as the
 * desired track even when "Music & ambience" is off (no audible change in
 * that case, but syncBgmWithSettings can then bring it in immediately once
 * the setting is turned back on). Calling this with the track that's
 * already desired is a safe no-op (does not restart or re-fade it) so
 * repeated calls from e.g. a re-render effect don't cause audible stutter.
 */
export const playBgm = (trackId: BgmTrackId): void => {
  if (desiredTrackId === trackId) {
    return;
  }

  const previousTrackId = desiredTrackId;
  desiredTrackId = trackId;

  if (!getActiveAudioSettings().musicEnabled) {
    return;
  }

  const allPlayers = getOrCreatePlayers();
  const nextPlayer = allPlayers[trackId];

  if (!nextPlayer) {
    return;
  }

  playTrackSilently(nextPlayer);
  rampVolume(nextPlayer, targetVolumeForTrack(trackId), CROSSFADE_MS);

  if (previousTrackId && previousTrackId !== trackId) {
    const previousPlayer = allPlayers[previousTrackId];
    if (previousPlayer) {
      rampVolume(previousPlayer, 0, CROSSFADE_MS);
      setTimeout(() => stopTrack(previousPlayer), CROSSFADE_MS + VOLUME_STEP_MS);
    }
  }
};

/** Convenience wrapper: picks day/night track from a boolean and plays it. */
export const playBgmForTimeOfDay = (isDaytime: boolean): void => {
  playBgm(bgmTrackForTimeOfDay(isDaytime));
};

/** Stops whichever BGM track is currently desired/active (fades out, then pauses). Clears the desired track entirely. */
export const stopBgm = (): void => {
  if (!desiredTrackId) {
    return;
  }

  const allPlayers = getOrCreatePlayers();
  const player = allPlayers[desiredTrackId];
  desiredTrackId = null;

  if (player) {
    rampVolume(player, 0, CROSSFADE_MS);
    setTimeout(() => stopTrack(player), CROSSFADE_MS + VOLUME_STEP_MS);
  }
};

/**
 * Re-applies the current "Music & ambience" setting to whatever track is
 * desired: brings it in (from silence, no crossfade needed since nothing
 * else is playing) if the setting just turned on, or fades it out without
 * forgetting it's still the desired track if the setting just turned off.
 * Call this from the Settings screen whenever musicEnabled changes, so the
 * toggle takes effect immediately without needing a screen remount.
 */
export const syncBgmWithSettings = (): void => {
  if (!desiredTrackId) {
    return;
  }

  const player = getOrCreatePlayers()[desiredTrackId];
  if (!player) {
    return;
  }

  if (getActiveAudioSettings().musicEnabled) {
    playTrackSilently(player);
    rampVolume(player, targetVolumeForTrack(desiredTrackId), CROSSFADE_MS);
  } else {
    rampVolume(player, 0, CROSSFADE_MS);
    setTimeout(() => stopTrack(player), CROSSFADE_MS + VOLUME_STEP_MS);
  }
};

/**
 * Temporarily lowers BGM volume (e.g. while a jingle plays) and returns a
 * function that restores it. Safe to call multiple times concurrently --
 * BGM only returns to full volume once every duck has been released
 * (reference-counted via duckDepth), so two overlapping jingles don't cause
 * the first jingle's release to prematurely restore full volume under the
 * second.
 *
 * Usage: `const unduck = duckBgm(); playSfx("jingle_levelup"); ...later:
 * unduck();` (or use duckBgmForMs for a fire-and-forget timed duck).
 */
export const duckBgm = (): (() => void) => {
  duckDepth += 1;
  applyDuckToActiveTrack();

  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    duckDepth = Math.max(0, duckDepth - 1);
    applyDuckToActiveTrack();
  };
};

/** Fire-and-forget duck for a fixed duration -- ducks now, restores after `durationMs`. */
export const duckBgmForMs = (durationMs: number): void => {
  const unduck = duckBgm();
  setTimeout(unduck, durationMs);
};

const applyDuckToActiveTrack = (): void => {
  if (!desiredTrackId) {
    return;
  }

  const player = getOrCreatePlayers()[desiredTrackId];
  if (!player) {
    return;
  }

  rampVolume(player, targetVolumeForTrack(desiredTrackId), DUCK_RAMP_MS);
};

/** Pauses BGM without resetting position or the crossfade/duck state -- for AppState backgrounding. */
export const pauseBgmForBackground = (): void => {
  if (!desiredTrackId) {
    return;
  }

  const player = getOrCreatePlayers()[desiredTrackId];
  if (!player) {
    return;
  }

  try {
    player.pause();
  } catch {
    // Silent: see stopTrack doc comment above.
  }
};

/** Resumes BGM after returning to foreground, if a track was desired and Music is still enabled. */
export const resumeBgmForForeground = (): void => {
  if (!desiredTrackId || !getActiveAudioSettings().musicEnabled) {
    return;
  }

  const player = getOrCreatePlayers()[desiredTrackId];
  if (!player) {
    return;
  }

  playTrackSilently(player);
};

/** Test-only: lets each test start from a clean player cache and playback state. */
export const resetBgmPlayerForTests = (): void => {
  players = null;
  desiredTrackId = null;
  duckDepth = 0;
};

/** Test-only: current desired/active track id, for assertions. */
export const getActiveBgmTrackIdForTests = (): BgmTrackId | null => desiredTrackId;
