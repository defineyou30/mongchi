import AsyncStorage from "@react-native-async-storage/async-storage";

const chatDisclosureBannerSeenKey = "mongchi.chat.aiDisclosureBanner.v1";

/**
 * App-review guidance (and the app's own P15 commitment) requires the
 * AI-conversation disclosure to surface inline at least once, not only
 * behind the header's info icon -- see chatGatePresentation.ts's
 * shouldShowChatDisclosureBanner for the gating logic this backs.
 */
export const hasSeenChatDisclosureBanner = async (): Promise<boolean> => {
  const stored = await AsyncStorage.getItem(chatDisclosureBannerSeenKey).catch(() => null);

  return stored !== null;
};

export const markChatDisclosureBannerSeen = async (): Promise<void> => {
  await AsyncStorage.setItem(chatDisclosureBannerSeenKey, new Date().toISOString()).catch(() => undefined);
};
