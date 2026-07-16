export interface PublicReleaseConfig {
  privacyPolicyUrl: string | null;
  termsUrl: string | null;
  supportEmail: string | null;
}

const placeholderPattern = /^(todo|tbd|placeholder|replace-me|example@|support@example\.com)/i;

export const normalizeConfiguredUrl = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();

  if (!trimmed || placeholderPattern.test(trimmed)) {
    return null;
  }

  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") {
    return null;
  }

  if (parsed.hostname === "example.com" || parsed.hostname.endsWith(".example.com") || parsed.hostname === "localhost") {
    return null;
  }

  return trimmed;
};

export const normalizeConfiguredEmail = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim().toLowerCase();

  if (!trimmed || placeholderPattern.test(trimmed)) {
    return null;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return null;
  }

  if (trimmed.endsWith("@example.com")) {
    return null;
  }

  return trimmed;
};

// Production defaults for the public MongChi landing pages. These are public,
// non-secret URLs, so baking them in is safe; EXPO_PUBLIC_TINY_PET_PRIVACY_URL /
// EXPO_PUBLIC_TINY_PET_TERMS_URL still take priority when set.
const DEFAULT_PRIVACY_POLICY_URL = "https://www.mongchi.app/privacy.html";
const DEFAULT_TERMS_URL = "https://www.mongchi.app/terms.html";

// Each var below is read as a literal `process.env.EXPO_PUBLIC_...` member
// access directly inside this function body (not cached into a module-level
// constant): babel-preset-expo only inlines a literal access like this one
// at build time (a computed/optional-chained lookup comes back undefined in
// release bundles -- see scripts/validate-mobile-env-inlining.mjs), and
// reading it live here also lets publicReleaseConfig.test.ts's `withEnv`
// helper flip these vars across assertions without needing to re-import the
// module.
export const getPublicReleaseConfig = (): PublicReleaseConfig => ({
  privacyPolicyUrl: normalizeConfiguredUrl(process.env.EXPO_PUBLIC_TINY_PET_PRIVACY_URL || DEFAULT_PRIVACY_POLICY_URL),
  termsUrl: normalizeConfiguredUrl(process.env.EXPO_PUBLIC_TINY_PET_TERMS_URL || DEFAULT_TERMS_URL),
  supportEmail: normalizeConfiguredEmail(process.env.EXPO_PUBLIC_TINY_PET_SUPPORT_EMAIL)
});

export const getMissingPublicReleaseConfigKeys = (config: PublicReleaseConfig): Array<keyof PublicReleaseConfig> => {
  const missing: Array<keyof PublicReleaseConfig> = [];

  if (!config.privacyPolicyUrl) {
    missing.push("privacyPolicyUrl");
  }

  if (!config.termsUrl) {
    missing.push("termsUrl");
  }

  if (!config.supportEmail) {
    missing.push("supportEmail");
  }

  return missing;
};
