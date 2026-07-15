import { describe, expect, it } from "vitest";

import {
  getMissingPublicReleaseConfigKeys,
  getPublicReleaseConfig,
  normalizeConfiguredEmail,
  normalizeConfiguredUrl
} from "./publicReleaseConfig";

const withEnv = <T>(overrides: Record<string, string | undefined>, run: () => T): T => {
  const previous: Record<string, string | undefined> = {};

  for (const key of Object.keys(overrides)) {
    previous[key] = process.env[key];

    if (overrides[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = overrides[key];
    }
  }

  try {
    return run();
  } finally {
    for (const key of Object.keys(overrides)) {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  }
};

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

  it("falls back to the production landing URLs when no env override is set", () => {
    withEnv(
      {
        EXPO_PUBLIC_TINY_PET_PRIVACY_URL: undefined,
        EXPO_PUBLIC_TINY_PET_TERMS_URL: undefined,
        EXPO_PUBLIC_TINY_PET_SUPPORT_EMAIL: undefined
      },
      () => {
        const config = getPublicReleaseConfig();

        expect(config.privacyPolicyUrl).toBe("https://www.mongchi.app/privacy.html");
        expect(config.termsUrl).toBe("https://www.mongchi.app/terms.html");
        expect(config.supportEmail).toBeNull();
      }
    );
  });

  it("prefers an explicit env override over the baked-in defaults", () => {
    withEnv(
      {
        EXPO_PUBLIC_TINY_PET_PRIVACY_URL: "https://staging.mongchi.app/privacy.html",
        EXPO_PUBLIC_TINY_PET_TERMS_URL: "https://staging.mongchi.app/terms.html",
        EXPO_PUBLIC_TINY_PET_SUPPORT_EMAIL: "help@mongchi.app"
      },
      () => {
        const config = getPublicReleaseConfig();

        expect(config.privacyPolicyUrl).toBe("https://staging.mongchi.app/privacy.html");
        expect(config.termsUrl).toBe("https://staging.mongchi.app/terms.html");
        expect(config.supportEmail).toBe("help@mongchi.app");
      }
    );
  });
});
