import { Image, StyleSheet, View } from "react-native";
import type { ImageSourcePropType, StyleProp, ViewStyle } from "react-native";

import { colors, shadows } from "../design/tokens";

export type OnboardingStoryArtVariant = "welcome" | "photo" | "profile";

const storyArtSources: Record<OnboardingStoryArtVariant, ImageSourcePropType> = {
  welcome: require("../../../assets/generated/onboarding/onboarding-photo-garden-v1.png"),
  photo: require("../../../assets/generated/onboarding/onboarding-photo-picker-v1.png"),
  profile: require("../../../assets/generated/onboarding/onboarding-pet-setup-v1.png")
};

interface OnboardingStoryArtProps {
  readonly accessibilityLabel: string;
  readonly compact?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly variant: OnboardingStoryArtVariant;
}

export function OnboardingStoryArt({ accessibilityLabel, compact = false, style, variant }: OnboardingStoryArtProps) {
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
      style={[styles.panel, compact ? styles.compactPanel : null, style]}
    >
      <Image
        accessibilityElementsHidden
        accessibilityIgnoresInvertColors
        importantForAccessibility="no-hide-descendants"
        resizeMode="cover"
        source={storyArtSources[variant]}
        style={styles.image}
      />
      <View pointerEvents="none" style={styles.innerRim} />
      <View pointerEvents="none" style={styles.gloss} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    minHeight: 300,
    borderRadius: 30,
    overflow: "hidden",
    borderWidth: 4,
    borderBottomWidth: 7,
    borderColor: colors.cream,
    backgroundColor: colors.sky,
    ...shadows.gamePanel
  },
  compactPanel: {
    minHeight: 226
  },
  image: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%"
  },
  innerRim: {
    ...StyleSheet.absoluteFill,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: colors.cream
  },
  gloss: {
    position: "absolute",
    top: 0,
    right: 0,
    left: 0,
    height: "34%",
    backgroundColor: colors.white,
    opacity: 0.12
  }
});
