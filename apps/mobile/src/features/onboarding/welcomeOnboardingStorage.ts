import AsyncStorage from "@react-native-async-storage/async-storage";

const welcomeOnboardingSeenKey = "mongchi.welcome.onboarding.v1";

export const hasSeenWelcomeOnboarding = async (): Promise<boolean> => {
  const stored = await AsyncStorage.getItem(welcomeOnboardingSeenKey).catch(() => null);

  return stored !== null;
};

export const markWelcomeOnboardingSeen = async (): Promise<void> => {
  await AsyncStorage.setItem(welcomeOnboardingSeenKey, new Date().toISOString()).catch(() => undefined);
};
