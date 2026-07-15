import { describe, expect, it } from "vitest";

import type { RewardClaimCopyCategory } from "@mongchi/shared";

import { supportedAppLocales } from "../../localization/localeNormalization";
import {
  getRewardClaimArt,
  getRewardClaimCardCopy,
  getRewardClaimReceiveButtonLabel,
  getRewardClaimRetryLine
} from "./rewardClaimPresentation";

const categories: RewardClaimCopyCategory[] = ["settlement", "streak", "letter", "collection", "bond", "daily_treat"];

describe("getRewardClaimCardCopy", () => {
  it("returns a non-empty title and body for every category in every supported locale", () => {
    for (const category of categories) {
      for (const locale of supportedAppLocales) {
        const copy = getRewardClaimCardCopy(category, locale);

        expect(copy.title.length).toBeGreaterThan(0);
        expect(copy.body.length).toBeGreaterThan(0);
        expect(copy.accessibilityLabel).toContain(copy.title);
        expect(copy.accessibilityLabel).toContain(copy.body);
      }
    }
  });

  it("never uses a transactional/guilt-tripping word in the English copy", () => {
    const bannedWords = ["must", "don't forget", "hurry", "expire", "you owe", "overdue"];

    for (const category of categories) {
      const copy = getRewardClaimCardCopy(category, "en-US");
      const combined = `${copy.title} ${copy.body}`.toLowerCase();

      for (const banned of bannedWords) {
        expect(combined).not.toContain(banned);
      }
    }
  });

  it("gives each category a distinct English title", () => {
    const titles = categories.map((category) => getRewardClaimCardCopy(category, "en-US").title);

    expect(new Set(titles).size).toBe(categories.length);
  });

  it("matches the settlement mission's specified warm tone in Korean", () => {
    expect(getRewardClaimCardCopy("settlement", "ko-KR").title).toBe("작은 이사 선물이 도착했어요");
  });

  it("matches the daily-treat reward's specified warm tone in Korean", () => {
    const copy = getRewardClaimCardCopy("daily_treat", "ko-KR");

    expect(copy.body).toBe("오늘도 잘 돌봐줘서, 작은 간식이 생겼어.");
  });
});

describe("getRewardClaimReceiveButtonLabel", () => {
  it("returns a non-empty label for every supported locale", () => {
    for (const locale of supportedAppLocales) {
      expect(getRewardClaimReceiveButtonLabel(locale).length).toBeGreaterThan(0);
    }
  });

  it("returns the expected English/Korean labels", () => {
    expect(getRewardClaimReceiveButtonLabel("en-US")).toBe("Receive");
    expect(getRewardClaimReceiveButtonLabel("ko-KR")).toBe("받기");
  });
});

describe("getRewardClaimRetryLine", () => {
  it("returns a non-empty retry line for every supported locale", () => {
    for (const locale of supportedAppLocales) {
      expect(getRewardClaimRetryLine(locale).length).toBeGreaterThan(0);
    }
  });
});

describe("getRewardClaimArt", () => {
  it("maps credit rewards to the gem art and treat rewards to item art", () => {
    expect(getRewardClaimArt("credit")).toBe("credit_gem");
    expect(getRewardClaimArt("treat")).toBe("treat_item");
  });
});
