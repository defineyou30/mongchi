#!/usr/bin/env python3
"""Synthesizes Mongchi's placeholder jingle/SFX family with numpy + macOS afconvert.

This is the tool referenced by code comments across apps/mobile (e.g.
TerrariumHomeScreen.tsx's JINGLE_DUCK_MS, FriendProfileScreen.tsx's ducking
comment) as the origin of the jingle_*/sfx_* placeholder audio in
apps/mobile/assets/audio/. It was missing from the repo (comments referenced
it, the file did not exist) -- this restores it and adds the cues for
jingle_arrival, sfx_walk_start, and the sfx_reveal replacement (a "second
movement" continuing jingle_arrival's ending note into PetRevealScreen's
own cue).

Pipeline: numpy synthesizes float samples -> stdlib `wave` writes a 16-bit
PCM .wav -> macOS `afconvert -f m4af -d aac` re-encodes to the .m4a the app
actually bundles (matches the existing assets: 48kHz, stereo, AAC).

No third-party samples, no scipy -- every tone below is additive synthesis
(a small stack of sine partials with independent decay envelopes) plus
occasional short filtered noise for pluck/breath texture, so every sound
here is 100% original and needs no license/attribution (see
apps/mobile/assets/audio/PROVENANCE.md).

Usage:
    python3 scripts/audio/synth_sfx.py candidates [--cue jingle_arrival|sfx_reveal]
        Renders the melody/timbre candidates for one (or, with no --cue, all)
        "pick one" cues into scripts/audio/candidates/ (both .wav and .m4a)
        for a listen-through (`afplay scripts/audio/candidates/<cue>_<name>.m4a`).

    python3 scripts/audio/synth_sfx.py adopt --name <candidate> --cue jingle_arrival|sfx_reveal
        Renders one named candidate straight into
        apps/mobile/assets/audio/<cue>.m4a (the bundled asset).

    python3 scripts/audio/synth_sfx.py render --cue sfx_walk_start
        Renders a registered single cue (see CUES below) straight into its
        apps/mobile/assets/audio/<cue>.m4a target.

    python3 scripts/audio/synth_sfx.py render-all
        Renders every registered cue into apps/mobile/assets/audio/ (used to
        regenerate the whole placeholder set if ever needed).

Every render prints duration, file size, and a peak-amplitude check so a
0-byte or silent asset never lands unnoticed.
"""

from __future__ import annotations

import argparse
import math
import os
import re
import subprocess
import sys
import wave
from dataclasses import dataclass, field
from typing import Callable, Sequence

import numpy as np

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ASSETS_DIR = os.path.join(REPO_ROOT, "apps", "mobile", "assets", "audio")
CANDIDATES_DIR = os.path.join(os.path.dirname(__file__), "candidates")

SAMPLE_RATE = 48000
BITRATE = 128000  # matches the ~126kbps AAC seen in the existing bundled assets

# -- Note table (equal temperament, A4 = 440Hz) --------------------------------
_NOTE_INDEX = {"C": -9, "D": -7, "E": -5, "F": -4, "G": -2, "A": 0, "B": 2}


def note_freq(name: str) -> float:
    """e.g. note_freq("C4") -> 261.63, note_freq("F#4") -> 369.99."""
    m = re.match(r"^([A-G])(#?)(-?\d+)$", name)
    if not m:
        raise ValueError(f"Unrecognized note name: {name!r}")
    letter, sharp, octave_s = m.groups()
    semitone = _NOTE_INDEX[letter] + (1 if sharp else 0)
    octave = int(octave_s)
    semitones_from_a4 = semitone + (octave - 4) * 12
    return 440.0 * (2.0 ** (semitones_from_a4 / 12.0))


# -- Envelope + tone synthesis --------------------------------------------------


def _attack_decay_envelope(n: int, sr: int, attack_ms: float, decay_tau: float) -> np.ndarray:
    """Soft raised-cosine attack ramp, then exponential decay -- a plucked/
    struck-tine shape rather than a hard synth-drum onset."""
    attack_n = max(1, min(n, int(sr * attack_ms / 1000)))
    env = np.empty(n, dtype=np.float64)
    env[:attack_n] = 0.5 - 0.5 * np.cos(np.pi * np.arange(attack_n) / attack_n)
    if attack_n < n:
        t_decay = np.arange(n - attack_n) / sr
        env[attack_n:] = np.exp(-t_decay / decay_tau)
    return env


@dataclass
class Partial:
    ratio: float  # multiple of the fundamental frequency (allows slight inharmonicity)
    amplitude: float
    decay_tau: float


@dataclass
class Timbre:
    """A named additive-synthesis preset (kalimba, music box, bell, ...)."""

    name: str
    partials: Sequence[Partial]
    attack_ms: float = 12.0
    pluck_noise: float = 0.0  # 0..1, brief noise burst mixed in at the attack


TIMBRES: dict[str, Timbre] = {
    # Warm, round, fast-decaying tine pluck -- classic kalimba. A dominant
    # fundamental plus two quiet, slightly inharmonic overtones that die out
    # much faster than the fundamental (that faster-decaying-overtone shape
    # is what reads as "plucked metal tine" rather than "synth bell").
    "kalimba": Timbre(
        name="kalimba",
        partials=[
            Partial(ratio=1.0, amplitude=1.0, decay_tau=0.42),
            Partial(ratio=2.76, amplitude=0.22, decay_tau=0.16),
            Partial(ratio=4.07, amplitude=0.11, decay_tau=0.09),
        ],
        attack_ms=10.0,
        pluck_noise=0.02,
    ),
    # Brighter/harder-plucked kalimba variant -- more high-partial energy and
    # a shorter attack, for a slightly more percussive/playful take.
    "kalimba_bright": Timbre(
        name="kalimba_bright",
        partials=[
            Partial(ratio=1.0, amplitude=1.0, decay_tau=0.34),
            Partial(ratio=2.76, amplitude=0.34, decay_tau=0.14),
            Partial(ratio=4.07, amplitude=0.20, decay_tau=0.08),
            Partial(ratio=5.4, amplitude=0.09, decay_tau=0.05),
        ],
        attack_ms=6.0,
        pluck_noise=0.035,
    ),
    # Music-box: strong octave partial + a very short, very bright "ting"
    # transient (a high partial with an extremely fast decay), sitting on a
    # longer-sustained fundamental than the kalimba presets.
    "musicbox": Timbre(
        name="musicbox",
        partials=[
            Partial(ratio=1.0, amplitude=1.0, decay_tau=0.55),
            Partial(ratio=2.0, amplitude=0.45, decay_tau=0.40),
            Partial(ratio=3.99, amplitude=0.20, decay_tau=0.22),
            Partial(ratio=6.02, amplitude=0.14, decay_tau=0.07),
        ],
        attack_ms=7.0,
        pluck_noise=0.015,
    ),
    # Small, bright, very short metallic double-tap -- for a collar/bell
    # jingle rather than a musical note.
    "bell": Timbre(
        name="bell",
        partials=[
            Partial(ratio=1.0, amplitude=1.0, decay_tau=0.075),
            Partial(ratio=2.4, amplitude=0.5, decay_tau=0.05),
            Partial(ratio=3.8, amplitude=0.28, decay_tau=0.035),
        ],
        attack_ms=2.0,
        pluck_noise=0.05,
    ),
    # -- BGM-loop timbres (see BGM_LOOP builder functions below) --
    # These four all set pluck_noise=0.0 deliberately: a BGM loop tiles the
    # same rendered phrase back-to-back (see _bgm_loop_buffer), and the pluck
    # noise burst lands at sample 0 with a nonzero value even though every
    # tonal partial's raised-cosine attack is exactly 0 there -- which would
    # turn each loop's silent, sample-accurate zero-crossing boundary into a
    # tiny audible tick. Foreground one-shot SFX (kalimba/kalimba_bright/
    # musicbox/bell above) don't loop, so their pluck noise is fine.
    "musicbox_dreamy": Timbre(
        name="musicbox_dreamy",
        partials=[
            Partial(ratio=1.0, amplitude=1.0, decay_tau=0.95),
            Partial(ratio=2.0, amplitude=0.35, decay_tau=0.70),
            Partial(ratio=3.99, amplitude=0.14, decay_tau=0.40),
        ],
        attack_ms=18.0,
        pluck_noise=0.0,
    ),
    "kalimba_wave": Timbre(
        name="kalimba_wave",
        partials=[
            Partial(ratio=1.0, amplitude=1.0, decay_tau=0.55),
            Partial(ratio=2.76, amplitude=0.30, decay_tau=0.22),
            Partial(ratio=4.07, amplitude=0.16, decay_tau=0.12),
        ],
        attack_ms=8.0,
        pluck_noise=0.0,
    ),
    "kalimba_warm": Timbre(
        name="kalimba_warm",
        partials=[
            Partial(ratio=1.0, amplitude=1.0, decay_tau=0.68),
            Partial(ratio=2.0, amplitude=0.22, decay_tau=0.40),
            Partial(ratio=2.76, amplitude=0.12, decay_tau=0.20),
        ],
        attack_ms=16.0,
        pluck_noise=0.0,
    ),
    "bell_pad": Timbre(
        name="bell_pad",
        partials=[
            Partial(ratio=1.0, amplitude=1.0, decay_tau=1.30),
            Partial(ratio=2.4, amplitude=0.30, decay_tau=0.9),
            Partial(ratio=3.8, amplitude=0.14, decay_tau=0.55),
        ],
        attack_ms=10.0,
        pluck_noise=0.0,
    ),
}


def render_note(freq: float, duration: float, timbre: Timbre, sr: int = SAMPLE_RATE, rng: np.random.Generator | None = None) -> np.ndarray:
    n = max(1, int(sr * duration))
    t = np.arange(n) / sr
    sig = np.zeros(n, dtype=np.float64)

    for partial in timbre.partials:
        env = _attack_decay_envelope(n, sr, timbre.attack_ms, partial.decay_tau)
        sig += partial.amplitude * env * np.sin(2 * np.pi * freq * partial.ratio * t)

    if timbre.pluck_noise > 0:
        rng = rng or np.random.default_rng()
        noise_len = min(n, max(4, int(sr * 0.006)))
        noise_env = np.exp(-np.arange(noise_len) / max(1.0, noise_len / 4))
        sig[:noise_len] += rng.standard_normal(noise_len) * noise_env * timbre.pluck_noise

    peak = np.max(np.abs(sig))
    if peak < 1e-9:
        raise RuntimeError(f"render_note produced a silent buffer for freq={freq}")
    return sig


@dataclass
class NoteEvent:
    note: str
    start: float  # seconds from the start of the sequence
    duration: float  # this note's own decay window (not the gap to the next note)


def render_sequence(events: Sequence[NoteEvent], timbre: Timbre, sr: int = SAMPLE_RATE, tail_pad: float = 0.06) -> np.ndarray:
    """Mixes a list of NoteEvents (arpeggio/jingle) into one mono buffer,
    each note added at its own start offset so notes can overlap slightly
    (legato) the way a real arpeggio does."""
    rng = np.random.default_rng(20260707)  # fixed seed: deterministic, reproducible renders
    end_time = max(ev.start + ev.duration for ev in events) + tail_pad
    total_n = int(sr * end_time)
    buf = np.zeros(total_n, dtype=np.float64)

    for ev in events:
        freq = note_freq(ev.note)
        tone = render_note(freq, ev.duration, timbre, sr=sr, rng=rng)
        start_n = int(sr * ev.start)
        end_n = start_n + len(tone)
        if end_n > total_n:
            tone = tone[: total_n - start_n]
            end_n = total_n
        buf[start_n:end_n] += tone

    # Short linear fade over the last ~25ms so the tail doesn't end on a hard
    # sample-value jump (audible click).
    fade_n = min(total_n, int(sr * 0.025))
    if fade_n > 1:
        buf[-fade_n:] *= np.linspace(1.0, 0.0, fade_n)

    return buf


def add_shimmer_stereo(mono: np.ndarray, sr: int = SAMPLE_RATE, detune_cents: float = 5.0, mix: float = 0.22) -> tuple[np.ndarray, np.ndarray]:
    """Cheap chorus/width trick: sums the dry mono signal with a slightly
    detuned copy of itself (opposite detune direction per channel) instead of
    true convolution reverb. Reads as a gentle music-box/kalimba stereo
    shimmer rather than a hard-panned mono blip."""
    n = len(mono)
    detune_ratio_up = 2.0 ** (detune_cents / 1200.0)
    detune_ratio_down = 2.0 ** (-detune_cents / 1200.0)

    # Resample via simple linear interpolation against a stretched time axis
    # -- good enough for a few cents of detune on short percussive tones.
    idx = np.arange(n)
    up_idx = np.clip(idx * detune_ratio_up, 0, n - 1)
    down_idx = np.clip(idx * detune_ratio_down, 0, n - 1)
    detuned_up = np.interp(up_idx, idx, mono)
    detuned_down = np.interp(down_idx, idx, mono)

    left = mono * (1 - mix) + detuned_down * mix
    right = mono * (1 - mix) + detuned_up * mix
    return left, right


def add_echo(mono: np.ndarray, sr: int = SAMPLE_RATE, delay_ms: float = 90.0, decay: float = 0.18, repeats: int = 1) -> np.ndarray:
    """A couple of quiet delayed repeats for a light "room" tail -- not a
    full reverb, just enough to keep the last note from feeling clipped-dry."""
    delay_n = int(sr * delay_ms / 1000)
    pad = delay_n * repeats
    out = np.concatenate([mono, np.zeros(pad)])
    cur_decay = decay
    for r in range(1, repeats + 1):
        shifted = np.concatenate([np.zeros(delay_n * r), mono, np.zeros(pad - delay_n * r)])
        out += shifted * cur_decay
        cur_decay *= decay
    return out


def add_sparkle_tail(mono: np.ndarray, sr: int, start_time: float, sparkle_note: str, duration: float = 1.0, amplitude: float = 0.05, shimmer_rate_hz: float = 5.5) -> np.ndarray:
    """Lays a faint, slowly tremolo'd high partial over part of the buffer --
    a "soft twinkle" texture distinct from add_shimmer_stereo's chorus width
    (this is a mono addition to the signal itself, not a stereo trick). Used
    for sfx_reveal's "옅은 셔머" (faint shimmer) requirement: quiet enough to
    read as sparkle, not a second competing melody."""
    n = len(mono)
    start_n = int(sr * start_time)
    dur_n = min(n - start_n, int(sr * duration))
    if dur_n <= 0:
        return mono

    freq = note_freq(sparkle_note)
    t = np.arange(dur_n) / sr
    env = np.exp(-t / max(0.05, duration * 0.6))
    tremolo = 0.5 + 0.5 * np.sin(2 * np.pi * shimmer_rate_hz * t)
    sparkle = amplitude * env * tremolo * np.sin(2 * np.pi * freq * t)

    out = mono.copy()
    out[start_n : start_n + dur_n] += sparkle
    return out


def normalize_stereo(left: np.ndarray, right: np.ndarray, target_peak: float = 0.9) -> tuple[np.ndarray, np.ndarray]:
    peak = max(np.max(np.abs(left)), np.max(np.abs(right)), 1e-9)
    scale = target_peak / peak
    return left * scale, right * scale


# -- File I/O --------------------------------------------------------------------


def write_wav_stereo(path: str, left: np.ndarray, right: np.ndarray, sr: int = SAMPLE_RATE) -> None:
    n = min(len(left), len(right))
    stereo = np.empty(n * 2, dtype=np.int16)
    stereo[0::2] = np.clip(left[:n] * 32767, -32768, 32767).astype(np.int16)
    stereo[1::2] = np.clip(right[:n] * 32767, -32768, 32767).astype(np.int16)

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(stereo.tobytes())


def convert_to_m4a(wav_path: str, m4a_path: str, bitrate: int = BITRATE) -> None:
    os.makedirs(os.path.dirname(m4a_path), exist_ok=True)
    subprocess.run(
        ["afconvert", "-f", "m4af", "-d", "aac", "-b", str(bitrate), wav_path, m4a_path],
        check=True,
        capture_output=True,
    )


def probe_duration_seconds(m4a_path: str) -> float | None:
    try:
        result = subprocess.run(["afinfo", m4a_path], check=True, capture_output=True, text=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None
    m = re.search(r"estimated duration:\s*([\d.]+)\s*sec", result.stdout)
    return float(m.group(1)) if m else None


def report_asset(m4a_path: str, raw_peak: float) -> None:
    size = os.path.getsize(m4a_path)
    duration = probe_duration_seconds(m4a_path)
    duration_s = f"{duration:.3f}s" if duration is not None else "unknown"
    status = "OK" if size > 0 and raw_peak > 1e-6 else "SILENT/EMPTY -- BROKEN"
    print(f"  {os.path.relpath(m4a_path, REPO_ROOT)}: {size} bytes, duration {duration_s}, pre-normalize peak {raw_peak:.4f} [{status}]")
    if size == 0 or raw_peak <= 1e-6:
        raise RuntimeError(f"Refusing to leave a silent/empty asset in place: {m4a_path}")


# -- Cue definitions ---------------------------------------------------------------


def _jingle_buffer(events: Sequence[NoteEvent], timbre_name: str) -> tuple[np.ndarray, np.ndarray, float]:
    timbre = TIMBRES[timbre_name]
    mono = render_sequence(events, timbre)
    mono_with_tail = add_echo(mono)
    raw_peak = float(np.max(np.abs(mono_with_tail)))
    left, right = add_shimmer_stereo(mono_with_tail)
    left, right = normalize_stereo(left, right)
    return left, right, raw_peak


# jingle_arrival candidates -- major-pentatonic ascending runs, 1.5-2s,
# "a friend has arrived, glad to see you" rather than "enemy spotted" (the
# jingle_discovery problem this replaces). See generationPresentation.ts's
# playGenerationArrivalCueOnce for where this plays.
ARRIVAL_CANDIDATES: dict[str, Callable[[], tuple[np.ndarray, np.ndarray, float]]] = {
    # A: a resolved I-III-V-I arc (most "home/welcome"-feeling of the three),
    # warm round kalimba, generous held final octave with tail.
    "candidate_a_kalimba_resolve": lambda: _jingle_buffer(
        [
            NoteEvent("C4", 0.00, 0.42),
            NoteEvent("E4", 0.27, 0.42),
            NoteEvent("G4", 0.54, 0.48),
            NoteEvent("C5", 0.88, 0.82),
        ],
        "kalimba",
    ),
    # B: a quicker 5-note pentatonic skip (more playful/curious energy),
    # brighter music-box tone with its own short "ting" shimmer.
    "candidate_b_musicbox_skip": lambda: _jingle_buffer(
        [
            NoteEvent("C4", 0.00, 0.30),
            NoteEvent("D4", 0.19, 0.30),
            NoteEvent("E4", 0.38, 0.32),
            NoteEvent("G4", 0.57, 0.34),
            NoteEvent("A4", 0.78, 0.85),
        ],
        "musicbox",
    ),
    # C: pentatonic run to the octave (C-E-G-A-C), bright/percussive kalimba
    # pluck -- the most "sparkly" of the three.
    "candidate_c_kalimba_bright": lambda: _jingle_buffer(
        [
            NoteEvent("C4", 0.00, 0.30),
            NoteEvent("E4", 0.22, 0.30),
            NoteEvent("G4", 0.44, 0.32),
            NoteEvent("A4", 0.66, 0.34),
            NoteEvent("C5", 0.90, 0.80),
        ],
        "kalimba_bright",
    ),
}


def _reveal_buffer(events: Sequence[NoteEvent], timbre_name: str, sparkle_note: str, sparkle_start: float, sparkle_amplitude: float = 0.05) -> tuple[np.ndarray, np.ndarray, float]:
    """sfx_reveal candidates: a "second movement" continuing from
    jingle_arrival's C4-E4-G4-C5 ending note -- these all start on/around C5
    and climb further (G4-C5-E5-G5, per the reveal-specific melody), so the
    two cues read as one arc across the generation-complete -> pet-reveal
    flow instead of two unrelated stingers. A soft sparkle tail sits on the
    final note (add_sparkle_tail) for "부드러운 반짝임" without a loud "ta-da"."""
    timbre = TIMBRES[timbre_name]
    mono = render_sequence(events, timbre)
    mono = add_sparkle_tail(mono, SAMPLE_RATE, sparkle_start, sparkle_note, duration=1.1, amplitude=sparkle_amplitude)
    mono_with_tail = add_echo(mono)
    raw_peak = float(np.max(np.abs(mono_with_tail)))
    left, right = add_shimmer_stereo(mono_with_tail, mix=0.26)
    left, right = normalize_stereo(left, right)
    return left, right, raw_peak


# sfx_reveal candidates -- the "meet your pet's face" moment on
# PetRevealScreen (see PetRevealScreen.tsx's mount effect). Continues
# jingle_arrival's ascending C4-E4-G4-C5 with a further G4-C5-E5-G5 climb
# (as if the two jingles are one phrase split across the generation-complete
# and pet-reveal beats), 1.5-2.5s, soft attack throughout, no loud "ta-da" --
# a warm swell + faint sparkle, not a fanfare.
REVEAL_CANDIDATES: dict[str, Callable[[], tuple[np.ndarray, np.ndarray, float]]] = {
    # A: music-box bloom -- moderate tempo, sparkle rides the whole held G5 tail.
    "candidate_a_musicbox_bloom": lambda: _reveal_buffer(
        [
            NoteEvent("G4", 0.00, 0.30),
            NoteEvent("C5", 0.22, 0.30),
            NoteEvent("E5", 0.44, 0.32),
            NoteEvent("G5", 0.68, 1.10),
        ],
        "musicbox",
        sparkle_note="G6",
        sparkle_start=0.68,
        sparkle_amplitude=0.05,
    ),
    # B: kalimba gentle -- warmer/rounder tone, slightly slower, minimal
    # sparkle (leans on the chorus shimmer alone) for the most "quiet hug"
    # of the three.
    "candidate_b_kalimba_gentle": lambda: _reveal_buffer(
        [
            NoteEvent("G4", 0.00, 0.34),
            NoteEvent("C5", 0.26, 0.34),
            NoteEvent("E5", 0.52, 0.36),
            NoteEvent("G5", 0.80, 1.15),
        ],
        "kalimba",
        sparkle_note="G6",
        sparkle_start=0.80,
        sparkle_amplitude=0.03,
    ),
    # C: music-box sparkle -- quicker climb, most pronounced shimmer overlay
    # (highest amplitude, longest-held tail) for the most "twinkly" take.
    "candidate_c_musicbox_sparkle": lambda: _reveal_buffer(
        [
            NoteEvent("G4", 0.00, 0.28),
            NoteEvent("C5", 0.20, 0.28),
            NoteEvent("E5", 0.40, 0.30),
            NoteEvent("G5", 0.62, 1.25),
        ],
        "musicbox",
        sparkle_note="G6",
        sparkle_start=0.62,
        sparkle_amplitude=0.07,
    ),
}


def _walk_start_buffer() -> tuple[np.ndarray, np.ndarray, float]:
    """Two short, bright collar-bell taps (~0.35s total) -- a "leash jingle"
    for the moment a walk starts. See careActionSfxById's "walk" mapping in
    audioAssets.ts. Deliberately non-vocal/non-bark per the gamefeel-sound-plan
    dog-sound principle: polyphonic collar/footstep textures only."""
    timbre = TIMBRES["bell"]
    events = [
        NoteEvent("A5", 0.00, 0.16),
        NoteEvent("D6", 0.15, 0.20),
    ]
    mono = render_sequence(events, timbre, tail_pad=0.05)
    raw_peak = float(np.max(np.abs(mono)))
    left, right = add_shimmer_stereo(mono, mix=0.3)
    left, right = normalize_stereo(left, right)
    return left, right, raw_peak


# -- Per-theme BGM loops (see bgmAssets.ts's getBgmTrackForTheme / PROVENANCE.md) --
#
# These are prototypes, explicitly meant to be swapped for licensed music once
# purchased (see PROVENANCE.md) -- the goal here is a pleasant, seamless,
# quiet loop per garden theme, not a final score.


def _bgm_loop_buffer(
    events: Sequence[NoteEvent],
    timbre_name: str,
    repeats: int,
    target_peak: float = 0.34,
    shimmer_mix: float = 0.24,
) -> tuple[np.ndarray, np.ndarray, float]:
    """Builds a seamlessly loopable BGM bed: renders one melodic phrase via
    render_sequence -- whose raised-cosine attack makes every buffer start at
    exactly 0.0, and whose closing ~25ms linear fade makes every buffer end at
    exactly 0.0 (see render_sequence above) -- then tiles that identical
    phrase `repeats` times back-to-back. Since both ends of the phrase are a
    hard zero by construction (and the BGM-loop timbres above all use
    pluck_noise=0.0, so no noise burst spoils the sample-0 zero either), the
    tile boundary is a true zero-crossing with no crossfade needed and no
    audible seam when expo-audio's `loop = true` wraps back to sample 0.
    Normalized to a much quieter target_peak than the foreground SFX cues,
    since this plays continuously behind everything else (bgmPlayer.ts's own
    BGM_VOLUME then attenuates it further at playback)."""
    timbre = TIMBRES[timbre_name]
    phrase = render_sequence(events, timbre)
    mono = np.tile(phrase, repeats)
    raw_peak = float(np.max(np.abs(mono)))
    left, right = add_shimmer_stereo(mono, mix=shimmer_mix)
    left, right = normalize_stereo(left, right, target_peak=target_peak)
    left, right = _hard_zero_loop_seam(left, right)
    return left, right, raw_peak


def _hard_zero_loop_seam(left: np.ndarray, right: np.ndarray, sr: int = SAMPLE_RATE, fade_ms: float = 8.0) -> tuple[np.ndarray, np.ndarray]:
    """Forces both channels' final sample down to an exact 0.0. The mono
    phrase already ends on a hard 0.0 (render_sequence's own closing linear
    fade), but add_shimmer_stereo's stereo-widening trick resamples a
    slightly time-shifted copy of the signal per channel -- one channel's
    detune direction happens to clip exactly at the buffer edge (landing back
    on the true 0.0), the other samples a hair before it (a barely-nonzero
    tail, well under 2% of the loop's already-quiet peak). A short linear
    taper over the last few ms removes that residual without being audible
    (it's already deep in the phrase's decay tail at this point), so the loop
    boundary is a true zero-crossing on both channels rather than "close
    enough"."""
    fade_n = min(len(left), int(sr * fade_ms / 1000))
    if fade_n <= 1:
        return left, right

    ramp = np.linspace(1.0, 0.0, fade_n)
    left = left.copy()
    right = right.copy()
    left[-fade_n:] *= ramp
    right[-fade_n:] *= ramp
    return left, right


def _fairy_garden_bgm_buffer() -> tuple[np.ndarray, np.ndarray, float]:
    """Fairy Garden theme BGM loop -- dreamy A-minor-pentatonic arpeggio
    (A4-C5-D5-E5-G5-E5-D5-C5) that rises then settles back down, slow legato
    music-box tone, 70 BPM. Tiled 6x from one ~7s phrase for a ~42s seamless
    loop (day variant only -- night reuses bgm_garden_night, see
    getBgmTrackForTheme in bgmAssets.ts)."""
    beat = 60.0 / 70.0
    notes = ["A4", "C5", "D5", "E5", "G5", "E5", "D5", "C5"]
    events = [NoteEvent(note, i * beat, 1.0) for i, note in enumerate(notes)]
    return _bgm_loop_buffer(events, "musicbox_dreamy", repeats=6, target_peak=0.34, shimmer_mix=0.28)


def _seaside_cove_bgm_buffer() -> tuple[np.ndarray, np.ndarray, float]:
    """Seaside Cove theme BGM loop -- bright C-major "wave" arpeggio
    (C4-E4-G4-C5-G4-E4, up then back down like a swell rolling in and out),
    brighter kalimba tone, 78 BPM. Tiled 8x from one ~4.8s phrase for a ~38s
    seamless loop."""
    beat = 60.0 / 78.0
    notes = ["C4", "E4", "G4", "C5", "G4", "E4"]
    events = [NoteEvent(note, i * beat, 0.85) for i, note in enumerate(notes)]
    return _bgm_loop_buffer(events, "kalimba_wave", repeats=8, target_peak=0.34, shimmer_mix=0.24)


def _autumn_woods_bgm_buffer() -> tuple[np.ndarray, np.ndarray, float]:
    """Autumn Woods theme BGM loop -- warm A-natural-minor arpeggio
    (A3-C4-E4-A4-G4-E4-C4), round low-register kalimba tone, 68 BPM. Tiled 6x
    from one ~6.4s phrase for a ~38s seamless loop."""
    beat = 60.0 / 68.0
    notes = ["A3", "C4", "E4", "A4", "G4", "E4", "C4"]
    events = [NoteEvent(note, i * beat, 1.05) for i, note in enumerate(notes)]
    return _bgm_loop_buffer(events, "kalimba_warm", repeats=6, target_peak=0.34, shimmer_mix=0.22)


def _winter_lights_bgm_buffer() -> tuple[np.ndarray, np.ndarray, float]:
    """Winter Lights theme BGM loop -- sparse, clear E-major bell hits
    (E5-B4-C#5-G#4-F#5-B4) spaced two beats apart so each tone rings out
    before the next starts ("twinkling lights" rather than a continuous
    run), 72 BPM. Tiled 4x from one ~9.7s phrase for a ~39s seamless loop."""
    beat = 60.0 / 72.0
    notes = ["E5", "B4", "C#5", "G#4", "F#5", "B4"]
    events = [NoteEvent(note, i * beat * 2, 1.3) for i, note in enumerate(notes)]
    return _bgm_loop_buffer(events, "bell_pad", repeats=4, target_peak=0.32, shimmer_mix=0.3)


# -- Weather ambience noise loops (see ambienceAssets.ts's weatherToAmbienceTrack) --
#
# amb_birds/amb_rain are licensed Kenney/OpenGameArt loops (see PROVENANCE.md);
# amb_wind/amb_snow below are synthesized in-house instead, using colored
# (band-limited) noise rather than the additive tone synthesis every other
# cue in this file uses -- wind/snow read as air movement, not a melody.


def _periodic_band_noise(n: int, sr: int, rng: np.random.Generator, low_hz: float, high_hz: float, slope: float) -> np.ndarray:
    """Synthesizes n samples of colored noise band-limited to [low_hz, high_hz]
    via inverse-FFT spectral synthesis: draw a magnitude spectrum shaped by
    `slope` (amplitude ~ 1/freq**slope, i.e. pink/brown-ish rolloff) with
    random phases in that band and zero elsewhere, then np.fft.irfft back to
    the time domain. This -- not a crossfaded loop -- is what makes the
    result *exactly* periodic over n samples with zero discontinuity: an
    IDFT/IFFT output is periodic over its own length by construction, so
    looping this buffer (expo-audio's `loop = true`) wraps with a true
    zero-crossing at the seam, the same guarantee the tonal BGM loops above
    get from render_sequence's hard-zero attack/fade (see _bgm_loop_buffer),
    just reached through the frequency domain instead of the time domain."""
    freqs = np.fft.rfftfreq(n, d=1.0 / sr)
    magnitude = np.zeros_like(freqs)
    band = (freqs >= low_hz) & (freqs <= high_hz)
    magnitude[band] = 1.0 / np.power(np.maximum(freqs[band], 1.0), slope)
    phases = rng.uniform(0, 2 * np.pi, size=freqs.shape)
    spectrum = magnitude * np.exp(1j * phases)
    signal = np.fft.irfft(spectrum, n=n)
    peak = np.max(np.abs(signal))
    return signal / peak if peak > 1e-12 else signal


def _wind_ambience_buffer(duration_s: float = 36.0, target_peak: float = 0.30) -> tuple[np.ndarray, np.ndarray, float]:
    """amb_wind -- a soft, filtered noise swell: band-limited (60-900Hz, so
    it reads as moving air rather than hiss) colored noise, independently
    generated per channel for natural stereo width, with a slow 3-cycle
    amplitude swell across the loop (gusting in and out). The swell's cycle
    count is an integer, so sin(2*pi*3*t/duration) has the same value *and*
    slope at t=0 and t=duration -- the envelope closes seamlessly onto
    itself exactly like the underlying periodic noise does."""
    sr = SAMPLE_RATE
    n = int(sr * duration_s)
    rng = np.random.default_rng(20260714)
    t = np.arange(n) / sr

    left = _periodic_band_noise(n, sr, rng, low_hz=60, high_hz=900, slope=1.35)
    right = _periodic_band_noise(n, sr, rng, low_hz=60, high_hz=900, slope=1.35)
    swell_cycles = 3
    swell = 0.72 + 0.28 * np.sin(2 * np.pi * swell_cycles * t / duration_s - np.pi / 2)

    mono_left = left * swell
    mono_right = right * swell
    raw_peak = float(max(np.max(np.abs(mono_left)), np.max(np.abs(mono_right))))
    left_n, right_n = normalize_stereo(mono_left, mono_right, target_peak=target_peak)
    return left_n, right_n, raw_peak


def _snow_ambience_buffer(duration_s: float = 36.0, target_peak: float = 0.20) -> tuple[np.ndarray, np.ndarray, float]:
    """amb_snow -- hushed and lower than amb_wind (tighter 40-380Hz band, a
    steeper rolloff, quieter target_peak) so a snowy scene reads as more
    muffled/still, plus a few faint high "glint" tones (reusing
    add_sparkle_tail, the same helper sfx_reveal's shimmer uses) scattered
    well clear of both loop edges so their decay never touches the seam."""
    sr = SAMPLE_RATE
    n = int(sr * duration_s)
    rng = np.random.default_rng(20260715)
    t = np.arange(n) / sr

    left = _periodic_band_noise(n, sr, rng, low_hz=40, high_hz=380, slope=1.7)
    right = _periodic_band_noise(n, sr, rng, low_hz=40, high_hz=380, slope=1.7)
    swell_cycles = 2
    swell = 0.78 + 0.22 * np.sin(2 * np.pi * swell_cycles * t / duration_s)

    mono_left = left * swell
    mono_right = right * swell

    glints = [(7.5, "C6"), (16.0, "E6"), (24.5, "G6"), (31.0, "C6")]
    for start_time, note in glints:
        mono_left = add_sparkle_tail(mono_left, sr, start_time, note, duration=1.4, amplitude=0.045, shimmer_rate_hz=6.0)
        mono_right = add_sparkle_tail(mono_right, sr, start_time, note, duration=1.4, amplitude=0.045, shimmer_rate_hz=6.0)

    raw_peak = float(max(np.max(np.abs(mono_left)), np.max(np.abs(mono_right))))
    left_n, right_n = normalize_stereo(mono_left, mono_right, target_peak=target_peak)
    return left_n, right_n, raw_peak


# Registry of cues renderable straight into apps/mobile/assets/audio/<cue>.m4a
# via `render`/`render-all` (cues with multiple melody/timbre candidates are
# handled separately by `candidates`/`adopt` since they need a listen-through
# pick first -- see CANDIDATE_CUES below).
SINGLE_CUES: dict[str, Callable[[], tuple[np.ndarray, np.ndarray, float]]] = {
    "sfx_walk_start": _walk_start_buffer,
    "bgm_theme_fairy_garden": _fairy_garden_bgm_buffer,
    "bgm_theme_seaside_cove": _seaside_cove_bgm_buffer,
    "bgm_theme_autumn_woods": _autumn_woods_bgm_buffer,
    "bgm_theme_winter_lights": _winter_lights_bgm_buffer,
    "amb_wind": _wind_ambience_buffer,
    "amb_snow": _snow_ambience_buffer,
}

# Registry of cues that ship as several melody/timbre candidates for a
# listen-through pick (`candidates` renders all of them to
# scripts/audio/candidates/, `adopt` bundles the chosen one).
CANDIDATE_CUES: dict[str, dict[str, Callable[[], tuple[np.ndarray, np.ndarray, float]]]] = {
    "jingle_arrival": ARRIVAL_CANDIDATES,
    "sfx_reveal": REVEAL_CANDIDATES,
}


# -- CLI -----------------------------------------------------------------------


def _write_and_convert(left: np.ndarray, right: np.ndarray, raw_peak: float, wav_path: str, m4a_path: str) -> None:
    write_wav_stereo(wav_path, left, right)
    convert_to_m4a(wav_path, m4a_path)
    report_asset(m4a_path, raw_peak)


def cmd_candidates(args: argparse.Namespace) -> None:
    os.makedirs(CANDIDATES_DIR, exist_ok=True)
    cue_names = [args.cue] if args.cue else sorted(CANDIDATE_CUES)

    for cue in cue_names:
        if cue not in CANDIDATE_CUES:
            raise SystemExit(f"Unknown cue {cue!r}. Options: {sorted(CANDIDATE_CUES)}")

        print(f"Rendering {cue} candidates:")
        for name, builder in CANDIDATE_CUES[cue].items():
            left, right, raw_peak = builder()
            wav_path = os.path.join(CANDIDATES_DIR, f"{cue}_{name}.wav")
            m4a_path = os.path.join(CANDIDATES_DIR, f"{cue}_{name}.m4a")
            _write_and_convert(left, right, raw_peak, wav_path, m4a_path)
        print(f"\nListen with: afplay {os.path.relpath(CANDIDATES_DIR, REPO_ROOT)}/{cue}_<name>.m4a\n")


def cmd_adopt(args: argparse.Namespace) -> None:
    if args.cue not in CANDIDATE_CUES:
        raise SystemExit(f"Unknown cue {args.cue!r}. Options: {sorted(CANDIDATE_CUES)}")

    candidates = CANDIDATE_CUES[args.cue]
    if args.name not in candidates:
        raise SystemExit(f"Unknown candidate {args.name!r}. Options: {sorted(candidates)}")

    left, right, raw_peak = candidates[args.name]()
    wav_path = os.path.join(CANDIDATES_DIR, f"_adopt_{args.cue}.wav")
    m4a_path = os.path.join(ASSETS_DIR, f"{args.cue}.m4a")
    _write_and_convert(left, right, raw_peak, wav_path, m4a_path)
    os.remove(wav_path)
    print(f"\nAdopted {args.name!r} as {os.path.relpath(m4a_path, REPO_ROOT)}")


def cmd_render(args: argparse.Namespace) -> None:
    if args.cue not in SINGLE_CUES:
        raise SystemExit(f"Unknown cue {args.cue!r}. Options: {sorted(SINGLE_CUES)}")
    left, right, raw_peak = SINGLE_CUES[args.cue]()
    wav_path = os.path.join(CANDIDATES_DIR, f"_render_{args.cue}.wav")
    m4a_path = os.path.join(ASSETS_DIR, f"{args.cue}.m4a")
    _write_and_convert(left, right, raw_peak, wav_path, m4a_path)
    os.remove(wav_path)


def cmd_render_all(_args: argparse.Namespace) -> None:
    for cue in SINGLE_CUES:
        cmd_render(argparse.Namespace(cue=cue))


def main(argv: Sequence[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    p_candidates = sub.add_parser("candidates", help="Render melody/timbre candidates into scripts/audio/candidates/ (all candidate cues, or one with --cue).")
    p_candidates.add_argument("--cue", choices=sorted(CANDIDATE_CUES), help="Limit to one cue's candidates (default: all).")
    p_candidates.set_defaults(func=cmd_candidates)

    p_adopt = sub.add_parser("adopt", help="Render a chosen candidate straight into the bundled asset.")
    p_adopt.add_argument("--name", required=True, help="Candidate key, e.g. candidate_b_musicbox_skip")
    p_adopt.add_argument("--cue", required=True, choices=sorted(CANDIDATE_CUES))
    p_adopt.set_defaults(func=cmd_adopt)

    p_render = sub.add_parser("render", help="Render one registered single cue into apps/mobile/assets/audio/.")
    p_render.add_argument("--cue", required=True, choices=sorted(SINGLE_CUES))
    p_render.set_defaults(func=cmd_render)

    sub.add_parser("render-all", help="Render every registered single cue.").set_defaults(func=cmd_render_all)

    args = parser.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
