import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import {
  PixelifySans_400Regular,
  PixelifySans_500Medium,
  PixelifySans_600SemiBold,
  PixelifySans_700Bold
} from "@expo-google-fonts/pixelify-sans";
import {
  Baloo2_400Regular,
  Baloo2_500Medium,
  Baloo2_600SemiBold,
  Baloo2_700Bold,
  Baloo2_800ExtraBold
} from "@expo-google-fonts/baloo-2";
import {
  Fredoka_300Light,
  Fredoka_400Regular,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold
} from "@expo-google-fonts/fredoka";
import {
  Nunito_400Regular,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black
} from "@expo-google-fonts/nunito";
import { StatusBar } from "expo-status-bar";
import { AppState, Text, TextInput, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import {
  getActiveAppLocale,
  hydrateAppLanguagePreference,
  i18n,
  syncAppLocale
} from "../src/localization/config";
import { normalizeAppLocale } from "../src/localization/localeNormalization";
import { TerrariumSessionProvider, useTerrariumSession } from "../src/features/session/TerrariumSessionProvider";
import { RewardClaimOverlay } from "../src/features/rewards/RewardClaimOverlay";
import { AppDialogProvider } from "../src/shared/ui/AppDialog";
import { useReducedMotionPreference } from "../src/shared/accessibility/useReducedMotionPreference";
import { useNotificationSync } from "../src/features/notifications/useNotificationSync";
import { fontPairFamilies } from "../src/shared/design/fontPair";
import { getFontFamilyForLocale } from "../src/shared/design/tokens";
import {
  ensureAudioSettingsHydrated,
  initSoundManager,
  isDaytimeNow,
  playBgmForTimeOfDay,
  preloadAmbience,
  preloadBgm,
  preloadSfx,
  registerBackgroundAudioHandling
} from "../src/shared/audio";
import { ErrorBoundary } from "../src/shared/errors/ErrorBoundary";
import { installGlobalErrorHooks } from "../src/shared/errors/globalErrorHooks";

// Wired at module scope so uncaught JS errors/unhandled rejections are
// captured from the very first tick, before RootLayout even mounts (see
// docs/readiness-diagnosis.md item 5). Idempotent -- safe if this module
// re-evaluates (e.g. fast refresh).
installGlobalErrorHooks();

const rootBackground = "#9FDBFF";
// Blanket fallback face for any Text/TextInput that hasn't been migrated to
// a typography token yet (see shared/design/tokens.ts). Migrated screens
// override this per-role via typography.<role>.fontFamily, so this only
// needs to be Pair A's body face, not pair-reactive.
const getFallbackFontFamily = () => getFontFamilyForLocale(getActiveAppLocale(), fontPairFamilies.A.body);
const defaultFontBaselines = new WeakMap<object, unknown>();
type DefaultFontComponent = (typeof Text | typeof TextInput) & {
  defaultProps?: {
    style?: unknown;
  };
};

function NotificationSync() {
  useNotificationSync();
  return null;
}

// Single reward-claim overlay for the whole app (see RewardClaimOverlay's doc
// comment) -- reads its queue from TerrariumSessionProvider, so it must live
// inside that provider, as a sibling to <Stack/> rather than inside any one
// screen, so a reward earned on Chat/Friend/Home alike can surface here.
function RewardClaimSurface() {
  const { pendingRewardClaim, claimPendingReward, dismissPendingReward } = useTerrariumSession();
  const reduceMotion = useReducedMotionPreference();
  const { i18n: activeI18n } = useTranslation();
  const locale = normalizeAppLocale(activeI18n.resolvedLanguage);

  return (
    <RewardClaimOverlay
      item={pendingRewardClaim}
      locale={locale}
      reduceMotion={reduceMotion}
      onClaim={claimPendingReward}
      onDone={dismissPendingReward}
    />
  );
}

const applyDefaultFont = (Component: typeof Text | typeof TextInput, fontFamily: string) => {
  const component = Component as DefaultFontComponent;

  component.defaultProps = component.defaultProps ?? {};

  if (!defaultFontBaselines.has(component)) {
    defaultFontBaselines.set(component, component.defaultProps.style);
  }

  component.defaultProps.style = [defaultFontBaselines.get(component), { fontFamily }];
};

export default function RootLayout() {
  const [languagePreferenceLoaded, setLanguagePreferenceLoaded] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    PixelifySans_400Regular,
    PixelifySans_500Medium,
    PixelifySans_600SemiBold,
    PixelifySans_700Bold,
    Baloo2_400Regular,
    Baloo2_500Medium,
    Baloo2_600SemiBold,
    Baloo2_700Bold,
    Baloo2_800ExtraBold,
    Fredoka_300Light,
    Fredoka_400Regular,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
    Nunito_400Regular,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
    FusionPixel10Proportional_ko: require("../assets/fonts/FusionPixel10Proportional-ko.ttf"),
    FusionPixel10Proportional_ja: require("../assets/fonts/FusionPixel10Proportional-ja.ttf"),
    FusionPixel10Proportional_zhTW: require("../assets/fonts/FusionPixel10Proportional-zh-TW.ttf")
  });

  useEffect(() => {
    let cancelled = false;

    void hydrateAppLanguagePreference()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setLanguagePreferenceLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if ((!fontsLoaded && !fontError) || !languagePreferenceLoaded) {
      return;
    }

    const applyLocalizedFallbackFont = () => {
      const fallbackFontFamily = fontsLoaded ? getFallbackFontFamily() : "System";
      applyDefaultFont(Text, fallbackFontFamily);
      applyDefaultFont(TextInput, fallbackFontFamily);
    };

    applyLocalizedFallbackFont();
    i18n.on("languageChanged", applyLocalizedFallbackFont);

    return () => {
      i18n.off("languageChanged", applyLocalizedFallbackFont);
    };
  }, [fontError, fontsLoaded, languagePreferenceLoaded]);

  // Sound Phase 1+2 (see docs/gamefeel-sound-plan.md §2): set the global
  // audio mode (mixWithOthers so a user's own music/podcast never stops),
  // preload every SFX/BGM/ambience source once at startup so the first play
  // has no load latency, and register the AppState pause/resume handling
  // BGM/ambience need since they loop continuously (unlike one-shot SFX,
  // which need no background handling at all).
  //
  // BGM now starts here too (rather than waiting for TerrariumHomeScreen),
  // so onboarding/welcome -- the very first thing a new user sees -- isn't
  // silent. Bugfix: this used to call playBgmForTimeOfDay synchronously,
  // right after preloadBgm() -- safe against the *player* not existing yet,
  // but not against getActiveAudioSettings() itself: that only reflects the
  // real persisted Music/Sounds settings once SettingsScreen's
  // useAudioSettings() hook has hydrated it from storage, which hadn't
  // happened yet this early. So a user who'd previously turned Music off
  // would still hear BGM start on the very next cold launch, ignoring their
  // saved preference, until they happened to revisit Settings (see
  // useAudioSettings.ts's ensureAudioSettingsHydrated doc comment for the
  // full story). Awaiting ensureAudioSettingsHydrated() first means
  // playBgmForTimeOfDay's internal musicEnabled check sees the real value
  // -- is a no-op if the user had it off (still records the desired track,
  // see playBgm's doc comment, so it resumes instantly if they turn Music
  // back on) -- and is a no-op if TerrariumSessionProvider's own
  // theme-aware effect (see TerrariumSessionProvider.tsx) already started
  // the same track first (playBgm no-ops when the requested track is
  // already desired) -- whichever of the two effects resolves first "wins"
  // harmlessly.
  useEffect(() => {
    void initSoundManager();
    preloadSfx();
    preloadBgm();
    preloadAmbience();
    registerBackgroundAudioHandling();

    let cancelled = false;
    void ensureAudioSettingsHydrated().then(() => {
      if (!cancelled) {
        playBgmForTimeOfDay(isDaytimeNow());
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void syncAppLocale().catch(() => undefined);
      }
    });

    return () => subscription.remove();
  }, []);

  if ((!fontsLoaded && !fontError) || !languagePreferenceLoaded) {
    return <View style={{ flex: 1, backgroundColor: rootBackground }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: rootBackground }}>
      <ErrorBoundary>
        <SafeAreaProvider style={{ flex: 1, backgroundColor: rootBackground }}>
          <AppDialogProvider>
            <TerrariumSessionProvider>
              <NotificationSync />
              <Stack
                screenOptions={{
                  animation: "none",
                  gestureEnabled: false,
                  headerShown: false,
                  contentStyle: {
                    backgroundColor: rootBackground
                  }
                }}
              />
              <RewardClaimSurface />
              <StatusBar hidden style="light" />
            </TerrariumSessionProvider>
          </AppDialogProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </View>
  );
}
