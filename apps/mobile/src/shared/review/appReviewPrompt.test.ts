import { beforeEach, describe, expect, it, vi } from "vitest";

const { getItem, setItem, isAvailableAsync, requestReview } = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  isAvailableAsync: vi.fn(),
  requestReview: vi.fn()
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: (...args: unknown[]) => getItem(...args),
    setItem: (...args: unknown[]) => setItem(...args)
  }
}));

vi.mock("expo-store-review", () => ({
  isAvailableAsync: (...args: unknown[]) => isAvailableAsync(...args),
  requestReview: (...args: unknown[]) => requestReview(...args)
}));

import {
  emptyAppReviewPromptHistory,
  maybeRequestAppReview,
  MAX_APP_REVIEW_PROMPTS_TOTAL,
  MIN_DAYS_BETWEEN_APP_REVIEW_PROMPTS,
  MIN_DAYS_TOGETHER_FOR_APP_REVIEW,
  recordAppReviewPrompt,
  shouldRequestAppReview
} from "./appReviewPrompt";

const NOW = "2026-07-15T12:00:00.000Z";

describe("shouldRequestAppReview", () => {
  it("skips when the pet moved in too recently", () => {
    expect(
      shouldRequestAppReview({
        now: NOW,
        daysTogether: MIN_DAYS_TOGETHER_FOR_APP_REVIEW - 1,
        history: emptyAppReviewPromptHistory
      })
    ).toBe(false);
  });

  it("passes at exactly the days-together minimum with no prior history", () => {
    expect(
      shouldRequestAppReview({
        now: NOW,
        daysTogether: MIN_DAYS_TOGETHER_FOR_APP_REVIEW,
        history: emptyAppReviewPromptHistory
      })
    ).toBe(true);
  });

  it("skips once the total lifetime prompt count is reached", () => {
    const history = { promptedAt: Array.from({ length: MAX_APP_REVIEW_PROMPTS_TOTAL }, (_, i) => `2020-0${i + 1}-01T00:00:00.000Z`) };

    expect(shouldRequestAppReview({ now: NOW, daysTogether: 30, history })).toBe(false);
  });

  it("allows one prompt short of the lifetime cap", () => {
    const history = { promptedAt: Array.from({ length: MAX_APP_REVIEW_PROMPTS_TOTAL - 1 }, (_, i) => `2020-0${i + 1}-01T00:00:00.000Z`) };

    expect(shouldRequestAppReview({ now: NOW, daysTogether: 30, history })).toBe(true);
  });

  it("skips when fewer than the minimum days have passed since the last prompt", () => {
    const lastPromptedAt = "2026-04-01T12:00:00.000Z"; // ~105 days before NOW
    expect(
      shouldRequestAppReview({ now: NOW, daysTogether: 30, history: { promptedAt: [lastPromptedAt] } })
    ).toBe(false);
  });

  it("allows a prompt exactly at the minimum day spacing", () => {
    const lastPromptedAtMs = new Date(NOW).getTime() - MIN_DAYS_BETWEEN_APP_REVIEW_PROMPTS * 24 * 60 * 60 * 1000;
    const lastPromptedAt = new Date(lastPromptedAtMs).toISOString();

    expect(
      shouldRequestAppReview({ now: NOW, daysTogether: 30, history: { promptedAt: [lastPromptedAt] } })
    ).toBe(true);
  });

  it("only considers the most recent prompt for the spacing check", () => {
    const history = {
      promptedAt: ["2020-01-01T00:00:00.000Z", "2026-06-01T12:00:00.000Z"] // last one is well within 122 days of NOW
    };

    expect(shouldRequestAppReview({ now: NOW, daysTogether: 30, history })).toBe(false);
  });
});

describe("recordAppReviewPrompt", () => {
  it("appends without mutating the input history", () => {
    const history = { promptedAt: ["2020-01-01T00:00:00.000Z"] };

    const next = recordAppReviewPrompt(history, NOW);

    expect(next.promptedAt).toEqual(["2020-01-01T00:00:00.000Z", NOW]);
    expect(history.promptedAt).toEqual(["2020-01-01T00:00:00.000Z"]);
  });
});

describe("maybeRequestAppReview", () => {
  beforeEach(() => {
    getItem.mockReset();
    setItem.mockReset();
    isAvailableAsync.mockReset();
    requestReview.mockReset();
  });

  it("does nothing when the gate fails (pet too new)", async () => {
    getItem.mockResolvedValueOnce(null);

    await maybeRequestAppReview("streak_reward_claimed", { daysTogether: 1, now: NOW });

    expect(setItem).not.toHaveBeenCalled();
    expect(isAvailableAsync).not.toHaveBeenCalled();
    expect(requestReview).not.toHaveBeenCalled();
  });

  it("does nothing when the total prompt budget is already spent", async () => {
    getItem.mockResolvedValueOnce(
      JSON.stringify({ promptedAt: ["2020-01-01T00:00:00.000Z", "2020-02-01T00:00:00.000Z", "2020-03-01T00:00:00.000Z"] })
    );

    await maybeRequestAppReview("monthly_letter_opened", { daysTogether: 60, now: NOW });

    expect(setItem).not.toHaveBeenCalled();
    expect(requestReview).not.toHaveBeenCalled();
  });

  it("records the attempt and requests a review when the gate passes and the platform supports it", async () => {
    getItem.mockResolvedValueOnce(null);
    isAvailableAsync.mockResolvedValueOnce(true);
    requestReview.mockResolvedValueOnce(undefined);
    setItem.mockResolvedValueOnce(undefined);

    await maybeRequestAppReview("streak_reward_claimed", { daysTogether: 5, now: NOW });

    expect(setItem).toHaveBeenCalledWith("mongchi.review.promptHistory.v1", JSON.stringify({ promptedAt: [NOW] }));
    expect(isAvailableAsync).toHaveBeenCalledTimes(1);
    expect(requestReview).toHaveBeenCalledTimes(1);
  });

  it("still records the attempt when the platform can't show a review dialog (e.g. simulator)", async () => {
    getItem.mockResolvedValueOnce(null);
    isAvailableAsync.mockResolvedValueOnce(false);
    setItem.mockResolvedValueOnce(undefined);

    await maybeRequestAppReview("streak_reward_claimed", { daysTogether: 5, now: NOW });

    expect(setItem).toHaveBeenCalledWith("mongchi.review.promptHistory.v1", JSON.stringify({ promptedAt: [NOW] }));
    expect(requestReview).not.toHaveBeenCalled();
  });

  it("never throws when the native review call rejects", async () => {
    getItem.mockResolvedValueOnce(null);
    isAvailableAsync.mockResolvedValueOnce(true);
    requestReview.mockRejectedValueOnce(new Error("no native module"));
    setItem.mockResolvedValueOnce(undefined);

    await expect(maybeRequestAppReview("streak_reward_claimed", { daysTogether: 5, now: NOW })).resolves.toBeUndefined();
  });

  it("never throws when storage itself fails", async () => {
    getItem.mockRejectedValueOnce(new Error("storage unavailable"));
    isAvailableAsync.mockResolvedValueOnce(true);
    requestReview.mockResolvedValueOnce(undefined);
    setItem.mockRejectedValueOnce(new Error("storage unavailable"));

    await expect(maybeRequestAppReview("streak_reward_claimed", { daysTogether: 5, now: NOW })).resolves.toBeUndefined();
  });
});
