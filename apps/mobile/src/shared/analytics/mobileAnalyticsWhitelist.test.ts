import { describe, expect, it } from "vitest";

import { assertWhitelistedAnalyticsProperties } from "./mobileAnalyticsWhitelist";

describe("assertWhitelistedAnalyticsProperties", () => {
  it("allows an event with no declared properties when called with an empty object", () => {
    expect(() => assertWhitelistedAnalyticsProperties("onboarding_started", {})).not.toThrow();
    expect(() => assertWhitelistedAnalyticsProperties("day_pass_purchased", {})).not.toThrow();
    expect(() => assertWhitelistedAnalyticsProperties("theme_purchased", {})).not.toThrow();
    expect(() => assertWhitelistedAnalyticsProperties("expression_pack_purchased", {})).not.toThrow();
  });

  it("rejects any property on an event with no declared allow-list", () => {
    expect(() => assertWhitelistedAnalyticsProperties("onboarding_started", { anything: "x" })).toThrow(
      'not whitelisted for event "onboarding_started"'
    );
  });

  it("accepts a whitelisted numeric property", () => {
    expect(() => assertWhitelistedAnalyticsProperties("session_opened", { days_together: 12 })).not.toThrow();
  });

  it("rejects a non-numeric or non-finite value for a numeric property", () => {
    expect(() => assertWhitelistedAnalyticsProperties("session_opened", { days_together: "12" as unknown as number })).toThrow(
      "must be a finite number"
    );
    expect(() => assertWhitelistedAnalyticsProperties("session_opened", { days_together: Number.NaN })).toThrow(
      "must be a finite number"
    );
  });

  it("accepts every whitelisted enum value for credit_item_purchased's category", () => {
    for (const category of ["food", "drink", "toy", "bed", "treat", "theme"]) {
      expect(() => assertWhitelistedAnalyticsProperties("credit_item_purchased", { category })).not.toThrow();
    }
  });

  it("rejects free text outside the declared enum set", () => {
    expect(() =>
      assertWhitelistedAnalyticsProperties("credit_item_purchased", { category: "a totally made up category" })
    ).toThrow("not a whitelisted value");

    expect(() => assertWhitelistedAnalyticsProperties("chat_turn_sent", { charge_kind: "free-form-reason" })).toThrow(
      "not a whitelisted value"
    );
  });

  it("accepts every whitelisted chargeKind and rewardKind value", () => {
    for (const chargeKind of ["plus", "day_pass", "starter_free", "daily_free", "credit", "crisis"]) {
      expect(() => assertWhitelistedAnalyticsProperties("chat_turn_sent", { charge_kind: chargeKind })).not.toThrow();
    }

    for (const rewardKind of ["settlement", "streak", "letter", "collection", "bond", "daily_treat"]) {
      expect(() => assertWhitelistedAnalyticsProperties("reward_claimed", { reward_kind: rewardKind })).not.toThrow();
    }
  });

  it("accepts every whitelisted generation_failed reason", () => {
    for (const reason of [
      "quota_exceeded",
      "safety_rejected",
      "photo_invalid",
      "quality_check_failed",
      "server_error",
      "unknown"
    ]) {
      expect(() => assertWhitelistedAnalyticsProperties("generation_failed", { reason })).not.toThrow();
    }
  });

  it("accepts the existing generation_issue_reported category values", () => {
    for (const category of ["wrong_pet", "unsafe_or_scary", "poor_quality"]) {
      expect(() => assertWhitelistedAnalyticsProperties("generation_issue_reported", { category })).not.toThrow();
    }
  });
});
