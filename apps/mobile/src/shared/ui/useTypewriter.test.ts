import { describe, expect, it } from "vitest";

import { getTypewriterVisibleCharCount, shouldPlayTypewriter } from "./useTypewriter";

describe("getTypewriterVisibleCharCount", () => {
  it("reveals zero characters at zero elapsed time", () => {
    expect(getTypewriterVisibleCharCount(10, 0, 40)).toBe(0);
  });

  it("reveals one character per msPerChar of elapsed time", () => {
    expect(getTypewriterVisibleCharCount(10, 40, 40)).toBe(1);
    expect(getTypewriterVisibleCharCount(10, 79, 40)).toBe(1);
    expect(getTypewriterVisibleCharCount(10, 80, 40)).toBe(2);
    expect(getTypewriterVisibleCharCount(10, 200, 40)).toBe(5);
  });

  it("clamps to the full text length once elapsed time exceeds the total duration", () => {
    expect(getTypewriterVisibleCharCount(10, 10_000, 40)).toBe(10);
  });

  it("returns zero for empty text regardless of elapsed time", () => {
    expect(getTypewriterVisibleCharCount(0, 500, 40)).toBe(0);
  });

  it("reveals the full text immediately when msPerChar is zero or negative", () => {
    expect(getTypewriterVisibleCharCount(10, 0, 0)).toBe(10);
    expect(getTypewriterVisibleCharCount(10, 0, -5)).toBe(10);
  });

  it("never returns a negative count for negative elapsed time", () => {
    expect(getTypewriterVisibleCharCount(10, -50, 40)).toBe(0);
  });
});

describe("shouldPlayTypewriter", () => {
  it("plays when the key has never been played before", () => {
    expect(shouldPlayTypewriter("hello", null, true)).toBe(true);
  });

  it("plays when the key changed from a previously played key", () => {
    expect(shouldPlayTypewriter("new line", "old line", true)).toBe(true);
  });

  it("does not replay when the same key re-renders", () => {
    expect(shouldPlayTypewriter("hello", "hello", true)).toBe(false);
  });

  it("does not play when disabled, even for a brand new key (Reduce Motion)", () => {
    expect(shouldPlayTypewriter("hello", null, false)).toBe(false);
  });

  it("does not play when disabled for a changed key", () => {
    expect(shouldPlayTypewriter("new line", "old line", false)).toBe(false);
  });
});
