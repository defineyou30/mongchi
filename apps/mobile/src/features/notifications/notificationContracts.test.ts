import { describe, expect, it } from "vitest";

import {
  createNotificationPayload,
  parseNotificationPayload,
  parseNotificationResponseRoute
} from "./notificationContracts";

describe("notification contracts", () => {
  it("maps a valid feed payload to the typed feed-tray route", () => {
    const data = createNotificationPayload({ owner: "garden", key: "meal_due", action: "feed" });
    const coldResponse = { actionIdentifier: "default", notification: { request: { content: { data } } } };
    const warmResponse = { actionIdentifier: "default", notification: { request: { content: { data } } } };

    expect(parseNotificationPayload(data)).toEqual({ owner: "garden", key: "meal_due", action: "feed" });
    expect(parseNotificationResponseRoute(coldResponse)).toEqual({ destination: "home", tray: "feed" });
    expect(parseNotificationResponseRoute(warmResponse)).toEqual({ destination: "home", tray: "feed" });
  });

  it.each([
    null,
    {},
    { mongchiNotificationVersion: 0, mongchiNotificationOwner: "garden", mongchiNotificationKey: "meal_due", mongchiNotificationAction: "feed" },
    { mongchiNotificationVersion: 1, mongchiNotificationOwner: "system", mongchiNotificationKey: "meal_due", mongchiNotificationAction: "feed" },
    { mongchiNotificationVersion: 1, mongchiNotificationOwner: "garden", mongchiNotificationKey: "__proto__", mongchiNotificationAction: "feed" },
    { mongchiNotificationVersion: 1, mongchiNotificationOwner: "garden", mongchiNotificationKey: "meal_due", mongchiNotificationAction: "launch_url" },
    { mongchiNotificationVersion: 1, mongchiNotificationOwner: "garden", mongchiNotificationKey: "attention_return", mongchiNotificationAction: "feed" },
    { mongchiNotificationVersion: 1, mongchiNotificationOwner: "walk", mongchiNotificationKey: "meal_due", mongchiNotificationAction: "feed" },
    { mongchiNotificationVersion: 1, mongchiNotificationOwner: "return", mongchiNotificationKey: "return_after_1_day", mongchiNotificationAction: "feed" },
    { mongchiNotificationVersion: 1, mongchiNotificationOwner: "garden", mongchiNotificationKey: "meal_due", mongchiNotificationAction: "feed", extra: "x" },
    { mongchiNotificationVersion: 1, mongchiNotificationOwner: "garden".repeat(20), mongchiNotificationKey: "meal_due", mongchiNotificationAction: "feed" }
  ])("rejects malformed or old payload %#", (value) => {
    expect(parseNotificationPayload(value)).toBeNull();
  });

  it("returns null for a malformed cold or warm response envelope", () => {
    expect(parseNotificationResponseRoute({ notification: { content: {} } })).toBeNull();
    expect(parseNotificationResponseRoute({ notification: { request: { content: { data: { source: "legacy" } } } } })).toBeNull();
  });

  it("rejects a valid route payload with a 64 KiB non-canonical extension", () => {
    expect(
      parseNotificationPayload({
        ...createNotificationPayload({ owner: "garden", key: "meal_due", action: "feed" }),
        untrustedExtra: "x".repeat(64 * 1024)
      })
    ).toBeNull();
  });

  it("rejects a hostile record whose own-key trap throws", () => {
    const hostile = new Proxy({}, {
      ownKeys: () => {
        throw new Error("hostile ownKeys trap");
      }
    });

    expect(parseNotificationPayload(hostile)).toBeNull();
  });

  it("fails closed for a revoked response Proxy", () => {
    const revocable = Proxy.revocable({}, {});
    revocable.revoke();
    let result: ReturnType<typeof parseNotificationResponseRoute> | undefined;

    expect(() => {
      result = parseNotificationResponseRoute(revocable.proxy);
    }).not.toThrow();
    expect(result).toBeNull();
  });

  it("rejects a response notification accessor without executing it", () => {
    let getterCalls = 0;
    const response = Object.defineProperty({}, "notification", {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        throw new Error("hostile notification accessor");
      }
    });
    let result: ReturnType<typeof parseNotificationResponseRoute> | undefined;

    expect(() => {
      result = parseNotificationResponseRoute(response);
    }).not.toThrow();
    expect(result).toBeNull();
    expect(getterCalls).toBe(0);
  });
});
