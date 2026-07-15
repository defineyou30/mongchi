import { createAudioPlayer } from "expo-audio";
import type { AudioPlayer } from "expo-audio";

import type { ItemId } from "@mongchi/shared";

import { bgmAssetSources, getBgmTrackForTheme } from "./bgmAssets";
import type { BgmTrackId } from "./bgmAssets";
import { getActiveAudioSettings } from "./useAudioSettings";

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

// The garden theme playBgmForTimeOfDay should resolve its day track against
// -- set by playBgmForThemeAndTimeOfDay (see below) whenever the selected
// theme changes or hydrates, and left in place across screen remounts so a
// later bare playBgmForTimeOfDay(isDaytimeNow()) call (e.g.
// TerrariumHomeScreen's own mount effect) stays theme-aware without needing
// to thread the theme id through every call site.
let activeThemeId: ItemId | undefined;

let duckDepth = 0; // number of overlapping duckBgm() calls currently active
let scheduledStopTimers: Partial<Record<BgmTrackId, ReturnType<typeof setTimeout>>> = {};
let trackLifecycleTokens: Partial<Record<BgmTrackId, number>> = {};
let nextTrackLifecycleToken = 1;

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

const clearScheduledStop = (trackId: BgmTrackId): void => {
  const timer = scheduledStopTimers[trackId];

  if (timer !== undefined) {
    clearTimeout(timer);
    delete scheduledStopTimers[trackId];
  }
};

const markTrackReactivated = (trackId: BgmTrackId): void => {
  clearScheduledStop(trackId);
  trackLifecycleTokens[trackId] = nextTrackLifecycleToken;
  nextTrackLifecycleToken += 1;
};

const scheduleTrackStop = (trackId: BgmTrackId, player: AudioPlayer): void => {
  clearScheduledStop(trackId);
  const lifecycleToken = nextTrackLifecycleToken;
  nextTrackLifecycleToken += 1;
  trackLifecycleTokens[trackId] = lifecycleToken;

  scheduledStopTimers[trackId] = setTimeout(() => {
    if (trackLifecycleTokens[trackId] !== lifecycleToken) {
      return;
    }

    delete scheduledStopTimers[trackId];
    stopTrack(player);
  }, CROSSFADE_MS + VOLUME_STEP_MS);
};

const playTrackSilently = (trackId: BgmTrackId, player: AudioPlayer): void => {
  markTrackReactivated(trackId);

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
 *
 * Bugfix note: switching away from a previous track is handled *before* the
 * musicEnabled gate and unconditionally on it -- previously the function
 * returned immediately when Music was off, without ever fading/stopping
 * whatever the *previous* desiredTrackId's player was. If that previous
 * player had started while Music was (or briefly appeared) on -- e.g. the
 * onboarding-start call in app/_layout.tsx racing the audio-settings
 * hydration that only happens once SettingsScreen's useAudioSettings()
 * mounts, or any theme change arriving while Music is off -- desiredTrackId
 * would move on to the new track while the old, still-audible player was
 * permanently orphaned: no future syncBgmWithSettings()/playBgm() call
 * could ever reach it again, since none of them address a BGM track by
 * anything other than the *current* desiredTrackId. Now every track swap
 * always resolves the previous player's fade-and-stop first, regardless of
 * whether the new track is actually allowed to start playing.
 */
export const playBgm = (trackId: BgmTrackId): void => {
  if (desiredTrackId === trackId) {
    return;
  }

  const previousTrackId = desiredTrackId;
  desiredTrackId = trackId;

  const allPlayers = getOrCreatePlayers();

  if (previousTrackId && previousTrackId !== trackId) {
    const previousPlayer = allPlayers[previousTrackId];
    if (previousPlayer) {
      rampVolume(previousPlayer, 0, CROSSFADE_MS);
      scheduleTrackStop(previousTrackId, previousPlayer);
    }
  }

  if (!getActiveAudioSettings().musicEnabled) {
    return;
  }

  const nextPlayer = allPlayers[trackId];

  if (!nextPlayer) {
    return;
  }

  playTrackSilently(trackId, nextPlayer);
  rampVolume(nextPlayer, targetVolumeForTrack(trackId), CROSSFADE_MS);
};

/**
 * Convenience wrapper: picks the track for the currently active garden theme
 * (see activeThemeId above -- theme-default-garden or no theme yet both
 * resolve to the plain garden track) and a day/night boolean, then plays it.
 */
export const playBgmForTimeOfDay = (isDaytime: boolean): void => {
  playBgm(getBgmTrackForTheme(activeThemeId, isDaytime));
};

/**
 * Records which garden theme's BGM should be used from now on (persists
 * across screen remounts -- see activeThemeId above) and immediately
 * crossfades into the matching track for the given day/night signal. Call
 * this whenever the selected theme changes or hydrates (see
 * TerrariumSessionProvider's theme-sync effect) so that later plain
 * playBgmForTimeOfDay(isDaytimeNow()) calls elsewhere resolve to the right
 * theme without needing to pass it through.
 */
export const playBgmForThemeAndTimeOfDay = (themeId: ItemId | undefined, isDaytime: boolean): void => {
  activeThemeId = themeId;
  playBgm(getBgmTrackForTheme(themeId, isDaytime));
};

/** Stops whichever BGM track is currently desired/active (fades out, then pauses). Clears the desired track entirely. */
export const stopBgm = (): void => {
  if (!desiredTrackId) {
    return;
  }

  const trackId = desiredTrackId;
  const allPlayers = getOrCreatePlayers();
  const player = allPlayers[trackId];
  desiredTrackId = null;

  if (player) {
    rampVolume(player, 0, CROSSFADE_MS);
    scheduleTrackStop(trackId, player);
  }
};

/**
 * Re-applies the current "Music & ambience" setting to whatever track is
 * desired: brings it in (from silence, no crossfade needed since nothing
 * else is playing) if the setting just turned on, or fades it out without
 * forgetting it's still the desired track if the setting just turned off.
 * Call this from the Settings screen whenever musicEnabled changes, so the
 * toggle takes effect immediately without needing a screen remount.
 *
 * The "turned off" branch also hard-silences+pauses *every other* player
 * immediately (not just desiredTrackId's), as a safety net: mid-crossfade
 * there can briefly be two real players in flight (the outgoing track
 * fading down, the incoming one fading up), and playBgm's own bookkeeping
 * already schedules the outgoing one's stop independently -- but this
 * belt-and-suspenders sweep means "off" is immediately and fully silent
 * even if some future bug (or a still-orphaned player from before the
 * playBgm fix -- see its doc comment) leaves a non-desired player audible.
 */
export const syncBgmWithSettings = (): void => {
  const allPlayers = getOrCreatePlayers();

  if (getActiveAudioSettings().musicEnabled) {
    if (!desiredTrackId) {
      return;
    }

    const player = allPlayers[desiredTrackId];
    if (!player) {
      return;
    }

    playTrackSilently(desiredTrackId, player);
    rampVolume(player, targetVolumeForTrack(desiredTrackId), CROSSFADE_MS);
    return;
  }

  if (desiredTrackId) {
    const player = allPlayers[desiredTrackId];
    if (player) {
      rampVolume(player, 0, CROSSFADE_MS);
      scheduleTrackStop(desiredTrackId, player);
    }
  }

  (Object.keys(allPlayers) as BgmTrackId[]).forEach((trackId) => {
    if (trackId === desiredTrackId) {
      return; // already handled above (fades, doesn't cut -- keep that smoother path for the real desired track)
    }

    const player = allPlayers[trackId];
    if (!player?.playing) {
      return;
    }

    rampVolume(player, 0, 0); // synchronously zero + claim the ramp token, see rampVolume's steps<=1 branch
    clearScheduledStop(trackId);
    stopTrack(player);
  });
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

const pauseExistingBgmPlayers = (): void => {
  Object.values(players ?? {}).forEach((player) => {
    if (!player?.playing) {
      return;
    }

    try {
      player.pause();
    } catch {
      // Silent: see stopTrack doc comment above.
    }
  });
};

/** Pauses BGM without resetting position or the crossfade/duck state -- for AppState backgrounding. */
export const pauseBgmForBackground = (): void => {
  pauseExistingBgmPlayers();
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

  playTrackSilently(desiredTrackId, player);
};

/** Test-only: lets each test start from a clean player cache and playback state. */
export const resetBgmPlayerForTests = (): void => {
  Object.values(scheduledStopTimers).forEach((timer) => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  });

  players = null;
  desiredTrackId = null;
  activeThemeId = undefined;
  duckDepth = 0;
  scheduledStopTimers = {};
  trackLifecycleTokens = {};
  nextTrackLifecycleToken = 1;
};

/** Test-only: current desired/active track id, for assertions. */
export const getActiveBgmTrackIdForTests = (): BgmTrackId | null => desiredTrackId;

/** Test-only: current active theme id (see playBgmForThemeAndTimeOfDay), for assertions. */
export const getActiveBgmThemeIdForTests = (): ItemId | undefined => activeThemeId;
