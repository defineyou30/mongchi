import { describe, expect, it } from "vitest";

import { parseLiveChatAvailability } from "./liveChatAvailability";

describe("live chat availability", () => {
  it("defaults to disabled and accepts only an explicit true value", () => {
    expect(parseLiveChatAvailability(undefined)).toBe(false);
    expect(parseLiveChatAvailability("false")).toBe(false);
    expect(parseLiveChatAvailability("1")).toBe(false);
    expect(parseLiveChatAvailability("true")).toBe(true);
    expect(parseLiveChatAvailability(" TRUE ")).toBe(true);
  });
});
