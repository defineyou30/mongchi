import { useEffect } from "react";
import { router } from "expo-router";
import { Image, ImageBackground, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radii, shadows, spacing, useFontFamilies } from "../../shared/design/tokens";
import { LottieAnimation } from "../../shared/ui/LottieAnimation";
import { useTerrariumSession } from "../session/TerrariumSessionProvider";
import { getConfiguredQaScreenPresetRoute } from "../session/qaScreenSession";
import { getConfiguredStoreScreenshotPresetRoute } from "../session/storeScreenshotSession";
import { getInitialPetLaunchRoute } from "./initialPetLaunchRoute";
import { hasSeenWelcomeOnboarding } from "./welcomeOnboardingStorage";

const appLogo = require("../../../assets/icon.png");
const loadingBackground = require("../../../assets/splash.png");
const loadingAnimation = require("../../../assets/lottie/loading.json");

export function SplashScreen() {
  const { acceptedAsset, acceptedAssets, generation, isHydrated, petProfile, photo } = useTerrariumSession();
  const fontFamilies = useFontFamilies();
  const storeScreenshotPresetRoute = getConfiguredStoreScreenshotPresetRoute();
  const qaScreenPresetRoute = getConfiguredQaScreenPresetRoute();

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    let cancelled = false;

    const timeout = setTimeout(() => {
      void hasSeenWelcomeOnboarding().then((seenWelcome) => {
        if (cancelled) {
          return;
        }

        router.replace(
          storeScreenshotPresetRoute ??
            qaScreenPresetRoute ??
            getInitialPetLaunchRoute({
              hasSeenWelcome: seenWelcome,
              photo,
              generation,
              petProfile,
              acceptedAsset,
              acceptedAssets
            })
        );
      });
    }, 850);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [acceptedAsset, acceptedAssets, generation, isHydrated, petProfile, photo, qaScreenPresetRoute, storeScreenshotPresetRoute]);

  return (
    <View style={styles.root}>
      <ImageBackground accessibilityLabel="Tiny pet phone home loading screen" resizeMode="cover" source={loadingBackground} style={styles.background}>
        <View style={styles.vignette} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.copy}>
            <Image
              accessibilityIgnoresInvertColors
              accessibilityLabel="Mongchi app logo"
              resizeMode="contain"
              source={appLogo}
              style={styles.appLogo}
            />
            <Text accessibilityRole="header" style={[styles.title, { fontFamily: fontFamilies.display }]}>
              Mongchi
            </Text>
            <LottieAnimation
              accessibilityLabel="Tiny world loading animation"
              loop
              source={loadingAnimation}
              style={styles.loadingAnimation}
            />
            <Text style={[styles.body, { fontFamily: fontFamilies.body }]}>{isHydrated ? "Opening tiny home" : "Warming cozy room"}</Text>
          </View>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.sky
  },
  background: {
    flex: 1
  },
  vignette: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(35,22,16,0.04)"
  },
  safeArea: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: spacing.xl,
    paddingBottom: 26
  },
  copy: {
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radii.card,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: "rgba(255,255,255,0.86)",
    backgroundColor: "rgba(255,245,222,0.84)",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...shadows.soft
  },
  appLogo: {
    width: 82,
    height: 82,
    marginBottom: 2,
    borderRadius: 18
  },
  title: {
    color: colors.ink,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "900"
  },
  loadingAnimation: {
    width: 96,
    height: 44,
    marginTop: -2,
    marginBottom: -4
  },
  body: {
    color: colors.mutedInk,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "800"
  }
});
