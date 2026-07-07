import { createAudioPlayer } from "expo-audio";
import type { AudioPlayer } from "expo-audio";
import type { WeatherCondition } from "@mongchi/shared";

import { ambienceAssetSources, weatherToAmbienceTrack } from "./ambienceAssets";
import type { AmbienceTrackId } from "./ambienceAssets";
import { getActiveAudioSettings } from "./useAudioSettings";

// Ambience sits quieter than BGM -- it's a texture bed, not a melody -- see
// synth_bgm.py's -24/-26dBFS RMS target for the placeholder tracks
// themselves. This is an additional ceiling on top of that.
const AMBIENCE_VOLUME = 0.5;

const CROSSFADE_MS = 2000;
const VOLUME_STEP_MS = 50;

let players: Partial<Record<AmbienceTrackId, AudioPlayer>> | null = null;

// The track that *should* be audible right now, independent of whether
// "Music & ambience" is currently on -- mirrors bgmPlayer.ts's
// desiredTrackId, see that file's doc comment for why this survives the
// setting being off (so syncAmbienceWithSettings can resume immediately).
let desiredTrackId: AmbienceTrackId | null = null;

// Phase 3 note (see docs/gamefeel-sound-plan.md §2 Phase 3): wind/night
// layers will be additional *simultaneous* players mixed under the weather
// track picked here, not more branches of a single-track chooser -- when
// that lands, this module gains a second "layer" player set rather than
// growing playAmbienceForWeather's swapping logic.

const getOrCreatePlayers = (): Partial<Record<AmbienceTrackId, AudioPlayer>> => {
  if (!players) {
    const created: Partial<Record<AmbienceTrackId, AudioPlayer>> = {};

    for (const id of Object.keys(ambienceAssetSources) as AmbienceTrackId[]) {
      try {
        const player = createAudioPlayer(ambienceAssetSources[id]);
        player.loop = true;
        player.volume = 0;
        created[id] = player;
      } catch {
        // Silent: a single bad/missing ambience asset should never block
        // the rest of the app -- see the equivalent comment in
        // sfxPlayer.ts's getOrCreatePlayers.
      }
    }

    players = created;
  }

  return players;
};

/** Preloads every ambience track up front (call once near app startup). */
export const preloadAmbience = (): void => {
  getOrCreatePlayers();
};

const targetVolumeForTrack = (id: AmbienceTrackId): number =>
  desiredTrackId === id && getActiveAudioSettings().musicEnabled ? AMBIENCE_VOLUME : 0;

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
    // Silent: an ambience track failing to start should never crash the
    // screen it's attached to.
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
 * Starts (or crossfades into) the given ambience track directly. Most
 * callers should use playAmbienceForWeather instead; this is exposed for
 * tests and any future direct-track callers (e.g. a settings preview).
 * Records `trackId` as desired even when "Music & ambience" is off -- see
 * the desiredTrackId doc comment above.
 */
export const playAmbienceTrack = (trackId: AmbienceTrackId): void => {
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

/**
 * Subscribes ambience to the current weather condition -- swaps track
 * (crossfading) whenever the mapped track differs from what's already
 * playing. Safe to call on every weather-state change; it's a no-op when
 * the mapped track hasn't changed.
 */
export const playAmbienceForWeather = (condition: WeatherCondition): void => {
  playAmbienceTrack(weatherToAmbienceTrack(condition));
};

/** Stops whichever ambience track is currently desired/active (fades out, then pauses). Clears the desired track entirely. */
export const stopAmbience = (): void => {
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
 * desired -- mirrors bgmPlayer.ts's syncBgmWithSettings, see its doc
 * comment. Call this from the Settings screen whenever musicEnabled
 * changes.
 */
export const syncAmbienceWithSettings = (): void => {
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

/** Pauses ambience without resetting position -- for AppState backgrounding. */
export const pauseAmbienceForBackground = (): void => {
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

/** Resumes ambience after returning to foreground, if a track was desired and Music is still enabled. */
export const resumeAmbienceForForeground = (): void => {
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
export const resetAmbiencePlayerForTests = (): void => {
  players = null;
  desiredTrackId = null;
};

/** Test-only: current desired/active track id, for assertions. */
export const getActiveAmbienceTrackIdForTests = (): AmbienceTrackId | null => desiredTrackId;
