import { useEffect, useRef, useState } from "react";

/**
 * Pure progress calculation for a typewriter effect: given how much time has
 * elapsed since the current text started animating, how many characters
 * should be visible right now.
 *
 * Kept as a standalone function (no timers, no React) so the stepping math
 * can be unit tested directly with deterministic inputs.
 */
export function getTypewriterVisibleCharCount(textLength: number, elapsedMs: number, msPerChar: number): number {
  if (textLength <= 0) {
    return 0;
  }
  if (msPerChar <= 0) {
    return textLength;
  }

  const revealed = Math.floor(elapsedMs / msPerChar);
  return Math.max(0, Math.min(textLength, revealed));
}

/**
 * Decides whether a text change should play the typewriter animation, or show
 * immediately: disabled (Reduce Motion) and re-renders of an already-played
 * key both skip straight to the full text.
 */
export function shouldPlayTypewriter(key: string, lastPlayedKey: string | null, enabled: boolean): boolean {
  return enabled && key !== lastPlayedKey;
}

export interface UseTypewriterOptions {
  /** The full text to reveal. */
  text: string;
  /** Stable identity for the text — when it changes, the animation replays. Defaults to `text`. */
  textKey?: string;
  /** Milliseconds per revealed character. Defaults to 40 (within the 30-50ms warm typing feel). */
  msPerChar?: number;
  /** When false, the full text is shown immediately (e.g. Reduce Motion enabled). */
  enabled?: boolean;
}

export interface UseTypewriterResult {
  /** The substring of `text` that should currently be rendered. */
  displayedText: string;
  /** True once the full text is visible (either typed out or skipped). */
  isComplete: boolean;
  /** Immediately reveals the full text for the current textKey. */
  skip: () => void;
}

const DEFAULT_MS_PER_CHAR = 40;
const TICK_MS = 32;

/**
 * Drives a typewriter reveal for `text`. Replays only when `textKey` (or
 * `text`, if no key is given) actually changes — re-renders with the same
 * text/key show the full string immediately. Reusable across the home
 * thought bubble and chat screens.
 */
export function useTypewriter({ text, textKey, msPerChar = DEFAULT_MS_PER_CHAR, enabled = true }: UseTypewriterOptions): UseTypewriterResult {
  const key = textKey ?? text;
  const playedKeyRef = useRef<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(() => {
    return shouldPlayTypewriter(key, playedKeyRef.current, enabled) ? 0 : text.length;
  });

  useEffect(() => {
    if (!shouldPlayTypewriter(key, playedKeyRef.current, enabled)) {
      playedKeyRef.current = key;
      setVisibleCount(text.length);
      return;
    }

    const startedAt = Date.now();
    setVisibleCount(0);

    const interval = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const nextCount = getTypewriterVisibleCharCount(text.length, elapsed, msPerChar);
      setVisibleCount(nextCount);

      if (nextCount >= text.length) {
        clearInterval(interval);
        playedKeyRef.current = key;
      }
    }, TICK_MS);

    return () => {
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  const skip = () => {
    playedKeyRef.current = key;
    setVisibleCount(text.length);
  };

  const clampedCount = Math.min(visibleCount, text.length);

  return {
    displayedText: text.slice(0, clampedCount),
    isComplete: clampedCount >= text.length,
    skip
  };
}
