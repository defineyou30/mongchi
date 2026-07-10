import { describe, expect, it } from "vitest";

import {
  MAX_NOTIFICATION_ACTION_LENGTH,
  MAX_NOTIFICATION_KEY_LENGTH,
  MAX_NOTIFICATION_OWNER_LENGTH,
  parseBoundedNotificationPayloadFields
} from "./notificationPayloadBoundary";

const makeRecord = (owner: string, key: string, action: string) => ({
  mongchiNotificationVersion: 1,
  mongchiNotificationOwner: owner,
  mongchiNotificationKey: key,
  mongchiNotificationAction: action
});

describe("notification payload boundary", () => {
  it("accepts the canonical four-field version 1 envelope", () => {
    expect(parseBoundedNotificationPayloadFields(makeRecord("garden", "meal_due", "feed"))).toEqual({
      owner: "garden",
      key: "meal_due",
      action: "feed"
    });
  });

  it("rejects a field that exceeds its character limit", () => {
    expect(
      parseBoundedNotificationPayloadFields(
        makeRecord("g".repeat(MAX_NOTIFICATION_OWNER_LENGTH + 1), "meal_due", "feed")
      )
    ).toBeNull();
  });

  it("rejects an envelope whose UTF-8 bytes exceed the total limit while field lengths remain valid", () => {
    expect(
      parseBoundedNotificationPayloadFields(
        makeRecord(
          "가".repeat(MAX_NOTIFICATION_OWNER_LENGTH),
          "나".repeat(MAX_NOTIFICATION_KEY_LENGTH),
          "다".repeat(MAX_NOTIFICATION_ACTION_LENGTH)
        )
      )
    ).toBeNull();
  });

  it("fails closed for a revoked payload Proxy", () => {
    const revocable = Proxy.revocable(makeRecord("garden", "meal_due", "feed"), {});
    revocable.revoke();
    let result: ReturnType<typeof parseBoundedNotificationPayloadFields> | undefined;

    expect(() => {
      result = parseBoundedNotificationPayloadFields(revocable.proxy);
    }).not.toThrow();
    expect(result).toBeNull();
  });

  it("fails closed when the own-property descriptor trap throws", () => {
    const hostile = new Proxy(makeRecord("garden", "meal_due", "feed"), {
      getOwnPropertyDescriptor: () => {
        throw new Error("hostile descriptor trap");
      }
    });

    expect(parseBoundedNotificationPayloadFields(hostile)).toBeNull();
  });
});
