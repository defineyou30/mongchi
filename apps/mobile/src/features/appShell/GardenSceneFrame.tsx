import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { ImageBackground, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing } from "../../shared/design/tokens";

const gardenSceneBackground = require("../../../assets/generated/backgrounds/candidates/home-garden-premium-v2-portrait.png");
const defaultSafeAreaEdges = ["top", "left", "right"] as const;
const bottomSafeAreaEdges = ["top", "left", "right", "bottom"] as const;

interface GardenSceneFrameProps {
  accessibilityLabel?: string;
  backAccessibilityLabel?: string;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  includeBottomEdge?: boolean;
  innerStyle?: StyleProp<ViewStyle>;
}

export function GardenSceneFrame({
  accessibilityLabel,
  backAccessibilityLabel = "Back",
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
        <ScrollView bounces={false} contentContainerStyle={[styles.content, contentStyle]} showsVerticalScrollIndicator={false}>
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
  inner: {
    flex: 1,
    gap: spacing.lg
  }
});
