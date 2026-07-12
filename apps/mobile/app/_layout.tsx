import { useEffect } from "react";
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

import { getActiveAppLocale, syncAppLocale } from "../src/localization/config";
import { TerrariumSessionProvider } from "../src/features/session/TerrariumSessionProvider";
import { AppDialogProvider } from "../src/shared/ui/AppDialog";
import { useNotificationSync } from "../src/features/notifications/useNotificationSync";
import { fontPairFamilies } from "../src/shared/design/fontPair";
import {
  initSoundManager,
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
const getFallbackFontFamily = () => getActiveAppLocale() === "ko-KR" ? "System" : fontPairFamilies.A.body;

function NotificationSync() {
  useNotificationSync();
  return null;
}

const applyDefaultFont = (Component: typeof Text | typeof TextInput, fontFamily: string) => {
  const component = Component as unknown as {
    defaultProps?: {
      style?: unknown;
    };
  };

  component.defaultProps = component.defaultProps ?? {};
  component.defaultProps.style = [component.defaultProps.style, { fontFamily }];
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
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
    Nunito_900Black
  });

  useEffect(() => {
    if (!fontsLoaded) {
      return;
    }

    applyDefaultFont(Text, getFallbackFontFamily());
    applyDefaultFont(TextInput, getFallbackFontFamily());
  }, [fontsLoaded]);

  // Sound Phase 1+2 (see docs/gamefeel-sound-plan.md §2): set the global
  // audio mode (mixWithOthers so a user's own music/podcast never stops),
  // preload every SFX/BGM/ambience source once at startup so the first play
  // has no load latency, and register the AppState pause/resume handling
  // BGM/ambience need since they loop continuously (unlike one-shot SFX,
  // which need no background handling at all).
  useEffect(() => {
    void initSoundManager();
    preloadSfx();
    preloadBgm();
    preloadAmbience();
    registerBackgroundAudioHandling();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void syncAppLocale().then(() => {
          applyDefaultFont(Text, getFallbackFontFamily());
          applyDefaultFont(TextInput, getFallbackFontFamily());
        });
      }
    });

    return () => subscription.remove();
  }, []);

  if (!fontsLoaded) {
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
              <StatusBar hidden style="light" />
            </TerrariumSessionProvider>
          </AppDialogProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </View>
  );
}
