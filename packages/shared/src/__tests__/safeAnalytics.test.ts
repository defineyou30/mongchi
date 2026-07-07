import { describe, expect, it } from "vitest";

import { createSafeAnalyticsEvent } from "../index";

describe("safe analytics contract", () => {
  it("allows coarse product events without sensitive payloads", () => {
    const event = createSafeAnalyticsEvent("care_action_used", {
      action: "feed",
      value_after: 76
    }, "2026-06-24T09:00:00.000Z");

    expect(event.name).toBe("care_action_used");
    expect(event.properties.action).toBe("feed");
  });

  it("allows generation issue reports with category-only metadata", () => {
    const event = createSafeAnalyticsEvent("generation_issue_reported", {
      category: "wrong_pet"
    }, "2026-06-24T09:02:00.000Z");

    expect(event.name).toBe("generation_issue_reported");
    expect(event.properties.category).toBe("wrong_pet");
  });

  it("rejects raw photo and message payload keys", () => {
    expect(() =>
      createSafeAnalyticsEvent("photo_selected", {
        photoUri: "file:///private/pet.jpg"
      })
    ).toThrow("Unsafe analytics property key");

    expect(() =>
      createSafeAnalyticsEvent("premium_chat_gate_viewed", {
        messageText: "raw text"
      })
    ).toThrow("Unsafe analytics property key");

    expect(() =>
      createSafeAnalyticsEvent("purchase_restore_tapped", {
        storeVerificationToken: "raw-store-token"
      })
    ).toThrow("Unsafe analytics property key");

    expect(() =>
      createSafeAnalyticsEvent("purchase_restore_tapped", {
        receiptPayload: "raw-receipt"
      })
    ).toThrow("Unsafe analytics property key");
  });
});
