declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

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

export const getPublicReleaseConfig = (): PublicReleaseConfig => ({
  privacyPolicyUrl: normalizeConfiguredUrl(
    typeof process === "undefined" ? null : process.env?.EXPO_PUBLIC_TINY_PET_PRIVACY_URL
  ),
  termsUrl: normalizeConfiguredUrl(typeof process === "undefined" ? null : process.env?.EXPO_PUBLIC_TINY_PET_TERMS_URL),
  supportEmail: normalizeConfiguredEmail(
    typeof process === "undefined" ? null : process.env?.EXPO_PUBLIC_TINY_PET_SUPPORT_EMAIL
  )
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
