import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { recordMobileEvent, setMobileAnalyticsSink } from "./mobileAnalytics";

describe("recordMobileEvent", () => {
  afterEach(() => {
    setMobileAnalyticsSink(null);
  });

  it("forwards a whitelisted event and its properties to the registered sink", () => {
    const sink = vi.fn();

    setMobileAnalyticsSink(sink);
    recordMobileEvent("session_opened", { days_together: 4 });

    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith("session_opened", { days_together: 4 });
  });

  it("returns the created event even with no sink registered", () => {
    const event = recordMobileEvent("onboarding_started", {});

    expect(event.name).toBe("onboarding_started");
    expect(event.properties).toEqual({});
    expect(typeof event.createdAt).toBe("string");
  });

  it("never forwards a non-whitelisted property to the sink, and never throws", () => {
    const sink = vi.fn();

    setMobileAnalyticsSink(sink);

    expect(() => recordMobileEvent("onboarding_started", { freeText: "whatever the caller typed" })).not.toThrow();
    expect(sink).not.toHaveBeenCalled();
  });

  it("never forwards a raw photo/message-shaped key even though it isn't in this event's allow-list", () => {
    const sink = vi.fn();

    setMobileAnalyticsSink(sink);

    expect(() => recordMobileEvent("photo_selected", { photoUri: "file:///private/pet.jpg" })).not.toThrow();
    expect(sink).not.toHaveBeenCalled();
  });

  it("stops forwarding once the sink is unregistered", () => {
    const sink = vi.fn();

    setMobileAnalyticsSink(sink);
    setMobileAnalyticsSink(null);
    recordMobileEvent("theme_purchased", {});

    expect(sink).not.toHaveBeenCalled();
  });
});
