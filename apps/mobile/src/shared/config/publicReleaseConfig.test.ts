import { describe, expect, it } from "vitest";

import {
  getMissingPublicReleaseConfigKeys,
  normalizeConfiguredEmail,
  normalizeConfiguredUrl
} from "./publicReleaseConfig";

describe("public release config", () => {
  it("accepts only production-safe HTTPS URLs", () => {
    expect(normalizeConfiguredUrl("https://mongchi.app/privacy")).toBe("https://mongchi.app/privacy");
    expect(normalizeConfiguredUrl("http://mongchi.app/privacy")).toBeNull();
    expect(normalizeConfiguredUrl("https://example.com/privacy")).toBeNull();
    expect(normalizeConfiguredUrl("todo")).toBeNull();
  });

  it("accepts only non-placeholder support emails", () => {
    expect(normalizeConfiguredEmail("HELP@mongchi.app")).toBe("help@mongchi.app");
    expect(normalizeConfiguredEmail("support@example.com")).toBeNull();
    expect(normalizeConfiguredEmail("not-an-email")).toBeNull();
  });

  it("reports missing release config keys", () => {
    expect(
      getMissingPublicReleaseConfigKeys({
        privacyPolicyUrl: "https://mongchi.app/privacy",
        termsUrl: null,
        supportEmail: null
      })
    ).toEqual(["termsUrl", "supportEmail"]);
  });
});
