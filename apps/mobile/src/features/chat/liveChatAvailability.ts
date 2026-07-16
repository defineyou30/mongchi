export const parseLiveChatAvailability = (value: string | undefined): boolean => value?.trim().toLowerCase() === "true";

// Read as a literal `process.env.EXPO_PUBLIC_...` member access -- a
// computed/optional-chained lookup is never inlined by babel-preset-expo at
// build time and comes back undefined in release bundles (see
// scripts/validate-mobile-env-inlining.mjs).
const LIVE_CHAT_ENABLED = process.env.EXPO_PUBLIC_TINY_PET_LIVE_CHAT_ENABLED;

export const isLiveChatEnabled = (): boolean => parseLiveChatAvailability(LIVE_CHAT_ENABLED);
