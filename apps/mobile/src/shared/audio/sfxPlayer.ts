import { createAudioPlayer } from "expo-audio";
import type { AudioPlayer } from "expo-audio";

import { sfxAssetSources, sfxIds } from "./audioAssets";
import type { SfxId } from "./audioAssets";
import { getActiveAudioSettings } from "./useAudioSettings";

// SFX playback volume: kept well under full scale since the placeholder
// assets themselves are already synthesized quiet (~-12dBFS peak, see
// synth_sfx.py), and short blips/chimes read as "louder" than their peak
// level suggests. Curated assets replacing the placeholders should still be
// authored quiet -- this is a safety ceiling, not the primary level control.
const SFX_VOLUME = 0.85;

let players: Partial<Record<SfxId, AudioPlayer>> | null = null;

const getOrCreatePlayers = (): Partial<Record<SfxId, AudioPlayer>> => {
  if (!players) {
    const created: Partial<Record<SfxId, AudioPlayer>> = {};

    for (const id of sfxIds) {
      try {
        const player = createAudioPlayer(sfxAssetSources[id]);
        player.volume = SFX_VOLUME;
        created[id] = player;
      } catch {
        // Silent: a single bad/missing asset should never block the rest
        // of the SFX set from preloading and playing.
      }
    }

    players = created;
  }

  return players;
};

/**
 * Preloads every known SFX id's AudioPlayer up front (call once near app
 * startup, alongside initSoundManager) so the first play of any sound has
 * no load latency.
 */
export const preloadSfx = (): void => {
  getOrCreatePlayers();
};

/**
 * Plays a SFX by id, replaying from the start even if it's already
 * mid-playback (e.g. rapid repeated taps). No-ops silently when:
 * - the "Sounds" setting is off (see useAudioSettings)
 * - the id doesn't resolve to a preloaded player (unknown/missing asset)
 *
 * Never throws -- a sound failing to play should never break the care
 * action, toast, or navigation it's attached to.
 */
export const playSfx = (id: SfxId): void => {
  if (!getActiveAudioSettings().soundsEnabled) {
    return;
  }

  const player = getOrCreatePlayers()[id];

  if (!player) {
    return;
  }

  try {
    player.seekTo(0);
    player.play();
  } catch {
    // Silent: see playSfx doc comment above.
  }
};

/** Test-only: lets each test start from a clean player cache. */
export const resetSfxPlayersForTests = (): void => {
  players = null;
};
