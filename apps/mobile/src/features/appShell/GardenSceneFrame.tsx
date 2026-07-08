import type { ReactNode } from "react";
import type { Href } from "expo-router";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { ImageBackground, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, shadows, spacing } from "../../shared/design/tokens";

const gardenSceneBackground = require("../../../assets/generated/backgrounds/candidates/home-garden-premium-v2-portrait.png");
const defaultSafeAreaEdges = ["top", "left", "right"] as const;
const bottomSafeAreaEdges = ["top", "left", "right", "bottom"] as const;

interface GardenSceneFrameProps {
  accessibilityLabel?: string;
  backAccessibilityLabel?: string;
  /**
   * @deprecated Unused — every screen now renders its own in-flow
   * `BackButton` (see shared/ui/BackButton.tsx) instead of relying on this
   * absolute-positioned slot, for consistent placement and spacing across
   * the app. Kept only to avoid an unrelated prop-surface break; do not
   * wire this up in new screens.
   */
  backHref?: Href;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  includeBottomEdge?: boolean;
  innerStyle?: StyleProp<ViewStyle>;
}

export function GardenSceneFrame({
  accessibilityLabel,
  backAccessibilityLabel = "Back",
  backHref,
  children,
  contentStyle,
  includeBottomEdge = false,
  innerStyle
}: GardenSceneFrameProps) {
  return (
    <View style={styles.root}>
      <ImageBackground accessibilityElementsHidden resizeMode="cover" source={gardenSceneBackground} style={styles.background}>
        <View style={styles.wash} />
      </ImageBackground>
      <SafeAreaView
        accessibilityLabel={accessibilityLabel}
        edges={includeBottomEdge ? bottomSafeAreaEdges : defaultSafeAreaEdges}
        style={styles.safeArea}
      >
        {backHref ? (
          <Pressable
            accessibilityLabel={backAccessibilityLabel}
            accessibilityRole="button"
            hitSlop={10}
            style={({ pressed }) => [styles.backButton, pressed ? styles.backButtonPressed : null]}
            onPress={() => router.replace(backHref)}
          >
            <ArrowLeft color={colors.woodDark} size={22} strokeWidth={3.2} />
          </Pressable>
        ) : null}
        <ScrollView
          bounces={false}
          contentContainerStyle={[styles.content, backHref ? styles.contentWithBack : null, contentStyle]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.inner, innerStyle]}>{children}</View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.skySoft
  },
  background: {
    position: "absolute",
    top: -96,
    right: 0,
    bottom: -96,
    left: 0
  },
  wash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(255,245,222,0.08)"
  },
  safeArea: {
    flex: 1
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl
  },
  contentWithBack: {
    paddingTop: 42
  },
  backButton: {
    position: "absolute",
    top: 18,
    left: spacing.lg,
    zIndex: 40,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,245,222,0.94)",
    borderWidth: 3,
    borderBottomWidth: 5,
    borderColor: "rgba(255,255,255,0.86)",
    alignItems: "center",
    justifyContent: "center",
    ...shadows.tile
  },
  backButtonPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 3
  },
  inner: {
    flex: 1,
    gap: spacing.lg
  }
});
