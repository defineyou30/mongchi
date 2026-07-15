# Audio asset provenance

Source-of-truth note: the 18 files below that carry a real source URL are
**mirrored from** `docs/legal/audio-asset-provenance.json` (the machine-readable
file `scripts/analyze-mobile-audio-assets.mjs` actually validates against --
license snapshot presence, sample rate/codec/channel count, loudness, loop-seam
continuity). If the two ever disagree, the JSON is authoritative; update this
table to match it, not the other way around.

`jingle_arrival.m4a`, `sfx_walk_start.m4a`, and (as of the change below)
`sfx_reveal.m4a` are **not** third-party assets -- they're synthesized
in-house (additive sine synthesis, no samples) by `scripts/audio/synth_sfx.py`,
committed in this repo. They have no license/attribution obligation, but they
also haven't been through the same physical-device QA pass as the rest of the
set yet (see "Status" column) -- same `licensed_ready_pending_physical_device_qa`
posture as everything else in `docs/legal/audio-asset-provenance.json`.

> **Known drift, not yet reconciled:** `docs/legal/audio-asset-provenance.json`
> still lists `sfx_reveal.m4a` as the Kenney `jingles_NES13.ogg` asset (see the
> changelog entry below) -- that entry is now stale/inaccurate since the
> bundled file was replaced with the synthesized cue described here. This doc
> (the requested deliverable for this change) is correct; the JSON was
> deliberately left untouched pending a decision on whether to update it in
> place or track the swap some other way -- see the flagged follow-up task.

## Licensed (Kenney / OpenGameArt, CC0-1.0)

| File | Role | Used for | Source | Creator | License |
|---|---|---|---|---|---|
| `amb_birds.m4a` | ambience | Daytime weather ambience layer | [opengameart.org/content/forest-ambience](https://opengameart.org/content/forest-ambience) (`Forest_Ambience.mp3`) | TinyWorlds | CC0-1.0 |
| `amb_rain.m4a` | ambience | Rainy-weather ambience layer | [opengameart.org/content/rain-loopable](https://opengameart.org/content/rain-loopable) (`Rain OGG.zip::3.ogg`) | Ylmir | CC0-1.0 |
| `bgm_garden_day.m4a` | bgm | Garden home screen, daytime loop | [opengameart.org/content/school-day-rain-sun-loop](https://opengameart.org/content/school-day-rain-sun-loop) (`SchoolDaySun.ogg`) | KiluaBoy | CC0-1.0 |
| `bgm_garden_night.m4a` | bgm | Garden home screen, night loop (22:00-06:00) | [opengameart.org/content/school-day-rain-sun-loop](https://opengameart.org/content/school-day-rain-sun-loop) (`SchoolDayRain.ogg`) | KiluaBoy | CC0-1.0 |
| `jingle_discovery.m4a` | jingle | Walk-discovery card toast, walk-collectible-journal-complete toast, expression pack unlock toast (`TerrariumHomeScreen.tsx`'s `playEventToastSfx`) | [kenney.nl/assets/music-jingles](https://kenney.nl/assets/music-jingles) (`Audio/Steel jingles/jingles_STEEL02.ogg`) | Kenney Vleugels | CC0-1.0 |
| `jingle_letter.m4a` | jingle | 30-day letter open (`FriendProfileScreen.tsx`) | [kenney.nl/assets/music-jingles](https://kenney.nl/assets/music-jingles) (`Audio/Pizzicato jingles/jingles_PIZZI13.ogg`) | Kenney Vleugels | CC0-1.0 |
| `jingle_levelup.m4a` | jingle | Bond level-up toast (`TerrariumHomeScreen.tsx`'s `playEventToastSfx`) | [kenney.nl/assets/music-jingles](https://kenney.nl/assets/music-jingles) (`Audio/Pizzicato jingles/jingles_PIZZI10.ogg`) | Kenney Vleugels | CC0-1.0 |
| `sfx_affection.m4a` | sfx | "Affection" care action | [kenney.nl/assets/music-jingles](https://kenney.nl/assets/music-jingles) (`Audio/Pizzicato jingles/jingles_PIZZI05.ogg`) | Kenney Vleugels | CC0-1.0 |
| `sfx_clean.m4a` | sfx | "Clean"/bath care action | [kenney.nl/assets/interface-sounds](https://kenney.nl/assets/interface-sounds) (`Audio/glass_006.ogg`) | Kenney | CC0-1.0 |
| `sfx_feed.m4a` | sfx | "Feed" care action | [kenney.nl/assets/rpg-audio](https://kenney.nl/assets/rpg-audio) (`Audio/metalPot1.ogg`) | Kenney Vleugels | CC0-1.0 |
| `sfx_play.m4a` | sfx | "Play" care action | [kenney.nl/assets/impact-sounds](https://kenney.nl/assets/impact-sounds) (`Audio/impactSoft_medium_002.ogg`) | Kenney | CC0-1.0 |
| `sfx_purchase.m4a` | sfx | Shop/credit-store purchase success (`ShopPreviewScreen.tsx`, `CreditStoreScreen.tsx`) | [kenney.nl/assets/interface-sounds](https://kenney.nl/assets/interface-sounds) (`Audio/confirmation_004.ogg`) | Kenney | CC0-1.0 |
| `sfx_rest.m4a` | sfx | "Rest"/nap care action | [kenney.nl/assets/rpg-audio](https://kenney.nl/assets/rpg-audio) (`Audio/cloth3.ogg`) | Kenney Vleugels | CC0-1.0 |
| `sfx_tap.m4a` | sfx | Generic light tap (butterfly-visitor catch, misc small confirmations) | [kenney.nl/assets/interface-sounds](https://kenney.nl/assets/interface-sounds) (`Audio/select_003.ogg`) | Kenney | CC0-1.0 |
| `sfx_toast.m4a` | sfx | Shared low-key event toast chime (care streaks, buffs, days-together milestones) | [kenney.nl/assets/interface-sounds](https://kenney.nl/assets/interface-sounds) (`Audio/confirmation_002.ogg`) | Kenney | CC0-1.0 |
| `sfx_treat.m4a` | sfx | "Treat" care action | [kenney.nl/assets/rpg-audio](https://kenney.nl/assets/rpg-audio) (`Audio/bookPlace1.ogg`) | Kenney Vleugels | CC0-1.0 |
| `sfx_walk_return.m4a` | sfx | Walk claim with no new find/journal completion ("plain welcome home" -- `TerrariumHomeScreen.tsx`'s `handleClaimWalkReward` effect) | [kenney.nl/assets/impact-sounds](https://kenney.nl/assets/impact-sounds) (`Audio/footstep_grass_003.ogg`) | Kenney | CC0-1.0 |
| `sfx_water.m4a` | sfx | "Water garden" care action | [kenney.nl/assets/interface-sounds](https://kenney.nl/assets/interface-sounds) (`Audio/drop_003.ogg`) | Kenney | CC0-1.0 |

License snapshots for the above live under `docs/legal/audio-license-snapshots/`.

## Synthesized placeholders (in-house, original)

| File | Role | Used for | Source | License | Status |
|---|---|---|---|---|---|
| `jingle_arrival.m4a` | jingle | Generation-complete "your friend has arrived" cue, once per job (`generationPresentation.ts`'s `playGenerationArrivalCueOnce`, wired from `GenerationScreen.tsx`). Replaces the old entrance-timed `jingle_discovery` cue. | Synthesized: `scripts/audio/synth_sfx.py`, candidate `candidate_a_kalimba_resolve` (additive kalimba-tone synthesis, C4-E4-G4-C5 major arpeggio). 2 alternate candidates kept at `scripts/audio/candidates/` for comparison. | Original (no third-party material; owned outright) | Placeholder -- not yet run through physical-device QA |
| `sfx_walk_start.m4a` | sfx | "Walk" care action start, collar-jingle cue (`careActionSfxById.walk` in `audioAssets.ts`) | Synthesized: `scripts/audio/synth_sfx.py` (`sfx_walk_start` cue -- two short additive "bell" partials, A5 then D6) | Original (no third-party material; owned outright) | Placeholder -- not yet run through physical-device QA |
| `sfx_reveal.m4a` | sfx | Pet reveal screen, one-shot on mount (`PetRevealScreen.tsx`) -- "meet your pet's face" moment | Synthesized: `scripts/audio/synth_sfx.py`, candidate `candidate_a_musicbox_bloom` (additive music-box synthesis, G4-C5-E5-G5 ascending swell + faint high-partial sparkle tail; deliberately continues `jingle_arrival`'s C4-E4-G4-C5 ending note as a "second movement" of the same phrase). 2 alternate candidates kept at `scripts/audio/candidates/` for comparison. **Replaces** the previous Kenney `jingles_NES13.ogg` asset (see changelog below). | Original (no third-party material; owned outright) | Placeholder -- not yet run through physical-device QA |
| `bgm_theme_fairy_garden.m4a` | bgm | Fairy Garden theme, daytime loop (`bgmAssets.ts`'s `getBgmTrackForTheme`; night reuses `bgm_garden_night`) | Synthesized: `scripts/audio/synth_sfx.py` (`bgm_theme_fairy_garden` cue -- dreamy A-minor-pentatonic music-box arpeggio, 70 BPM, tiled to a ~42s seamless loop) | Original (no third-party material; owned outright) | **Prototype -- swap-before-ship placeholder, see note below** |
| `bgm_theme_seaside_cove.m4a` | bgm | Seaside Cove theme, daytime loop (`bgmAssets.ts`'s `getBgmTrackForTheme`; night reuses `bgm_garden_night`) | Synthesized: `scripts/audio/synth_sfx.py` (`bgm_theme_seaside_cove` cue -- bright C-major "wave" kalimba arpeggio, 78 BPM, tiled to a ~38s seamless loop) | Original (no third-party material; owned outright) | **Prototype -- swap-before-ship placeholder, see note below** |
| `bgm_theme_autumn_woods.m4a` | bgm | Autumn Woods theme, daytime loop (`bgmAssets.ts`'s `getBgmTrackForTheme`; night reuses `bgm_garden_night`) | Synthesized: `scripts/audio/synth_sfx.py` (`bgm_theme_autumn_woods` cue -- warm A-natural-minor kalimba arpeggio, 68 BPM, tiled to a ~38s seamless loop) | Original (no third-party material; owned outright) | **Prototype -- swap-before-ship placeholder, see note below** |
| `bgm_theme_winter_lights.m4a` | bgm | Winter Lights theme, daytime loop (`bgmAssets.ts`'s `getBgmTrackForTheme`; night reuses `bgm_garden_night`) | Synthesized: `scripts/audio/synth_sfx.py` (`bgm_theme_winter_lights` cue -- sparse, clear E-major bell hits, 72 BPM, tiled to a ~39s seamless loop) | Original (no third-party material; owned outright) | **Prototype -- swap-before-ship placeholder, see note below** |
| `amb_wind.m4a` | ambience | Windy-weather ambience layer (`ambienceAssets.ts`'s `weatherToAmbienceTrack`, `wind` condition) | Synthesized: `scripts/audio/synth_sfx.py` (`amb_wind` cue -- band-limited (60-900Hz) colored noise, independent per channel, slow 3-cycle amplitude swell, 36s seamless loop) | Original (no third-party material; owned outright) | Placeholder -- not yet run through physical-device QA |
| `amb_snow.m4a` | ambience | Snowy-weather ambience layer (`ambienceAssets.ts`'s `weatherToAmbienceTrack`, `snow` condition) | Synthesized: `scripts/audio/synth_sfx.py` (`amb_snow` cue -- hushed, tighter-band (40-380Hz) colored noise than `amb_wind`, 2-cycle swell, plus four faint high "glint" tones scattered through the loop; 36s seamless loop) | Original (no third-party material; owned outright) | Placeholder -- not yet run through physical-device QA |

> **Prototype note (`bgm_theme_*.m4a`, all four):** these four are explicitly
> a **replace-before-ship prototype**, not a candidate for the final game --
> unlike `jingle_arrival`/`sfx_walk_start`/`sfx_reveal` above (which are
> intended to ship as-is pending physical-device QA), these exist so the
> per-theme-BGM feature has *something* audible to crossfade into per garden
> theme while a licensed music purchase is sourced. When that purchase
> happens, only these four files need to change (same filenames, same
> `bgmAssetSources` keys in `bgmAssets.ts`) -- no app code changes required.
> Each is a single additive-synthesis melodic phrase (music-box/kalimba/bell
> timbre per theme, see `synth_sfx.py`'s `TIMBRES` and the `_bgm_loop_buffer`
> helper) tiled back-to-back into a 38-42s loop; both the mono phrase's
> raised-cosine attack (starts at exactly 0.0) and its closing linear fade
> (ends at exactly 0.0), plus a small stereo-seam correction
> (`_hard_zero_loop_seam`), guarantee the tile boundary is a true
> zero-crossing on both channels -- no crossfade-based loop trick, no click
> at the wrap point.

> **Noise-loop technique note (`amb_wind.m4a` / `amb_snow.m4a`):** unlike
> every other cue in this file (additive sine-partial synthesis), these two
> are colored noise generated via inverse-FFT spectral synthesis
> (`_periodic_band_noise` in `synth_sfx.py`): a magnitude spectrum shaped to
> a frequency band with random phases, then `np.fft.irfft` back to the time
> domain. An IDFT/IFFT output is periodic over its own buffer length by
> construction, so the loop seam is a true zero-crossing the same way the
> tonal loops get one from a hard-zero attack/fade -- just reached through
> the frequency domain instead of the time domain, with no crossfade trick
> needed for noise-based content either.

## Changelog

- **amb_wind.m4a / amb_snow.m4a added** (in-house synth, first noise-based
  cues in this pipeline -- see the noise-loop technique note above): windy
  and snowy weather previously fell back to `amb_birds.m4a`, same as every
  other non-rain condition (`ambienceAssets.ts`'s `weatherToAmbienceTrack`).
  Each now gets its own single-track ambience; snow is hushed and lower than
  wind rather than reusing it, for a bit more weather-condition variety.
- **sfx_reveal.m4a replaced** (in-house synth, continuing `jingle_arrival`):
  previously the Kenney `Audio/8-Bit jingles/jingles_NES13.ogg` CC0-1.0 asset
  (still listed that way in `docs/legal/audio-asset-provenance.json` -- that
  entry is now stale and needs reconciling, see the "Known drift" note above).
  Replaced because the reveal moment needed to read as a continuation of the
  new `jingle_arrival` cue rather than an unrelated 8-bit stinger.

## TODO (needs user confirmation)

None of the 18 previously-shipped licensed files are unconfirmed -- their real
sources are already tracked in `docs/legal/audio-asset-provenance.json` (see
table above). Nothing in this doc was invented; anything not directly
traceable to that JSON or to `scripts/audio/synth_sfx.py`'s own synthesis code
is *not* listed here rather than guessed at.
