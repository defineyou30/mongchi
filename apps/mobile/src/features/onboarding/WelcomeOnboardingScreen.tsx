import { useState } from "react";
import { ArrowRight, Camera } from "lucide-react-native";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { colors, radii, shadows, spacing, useFontFamilies } from "../../shared/design/tokens";
import { ActionButton } from "../../shared/ui/ActionButton";
import { OnboardingStoryArt } from "../../shared/ui/OnboardingStoryArt";
import type { OnboardingStoryArtVariant } from "../../shared/ui/OnboardingStoryArt";
import { GardenSceneFrame } from "../appShell/GardenSceneFrame";
import { markWelcomeOnboardingSeen } from "./welcomeOnboardingStorage";

interface WelcomeOnboardingSlide {
  readonly body: string;
  readonly step: string;
  readonly title: string;
  readonly variant: OnboardingStoryArtVariant;
}

const welcomeSlides = [
  {
    step: "Step 1",
    title: "Keep your beloved pet close",
    body: "Mongchi turns care into a quiet little world you can open whenever you miss them.",
    variant: "welcome"
  },
  {
    step: "Step 2",
    title: "Begin with one real photo",
    body: "Choose a clear favorite photo, then shape a tiny friend with a name, mood, and voice.",
    variant: "photo"
  },
  {
    step: "Step 3",
    title: "Let them move into your garden",
    body: "Feed, play, rest, and return each day to grow a gentle bond in your pocket.",
    variant: "profile"
  }
] as const satisfies readonly WelcomeOnboardingSlide[];

const lastSlideIndex = welcomeSlides.length - 1;

export function WelcomeOnboardingScreen() {
  const { height, width } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const compact = height < 720 || width < 380;
  const fontFamilies = useFontFamilies();
  const activeSlide = welcomeSlides[activeIndex] ?? welcomeSlides[0];
  const isLastSlide = activeIndex === lastSlideIndex;

  const continueToPetSetup = () => {
    void markWelcomeOnboardingSeen();
    router.replace("/onboarding");
  };

  const handleNext = () => {
    if (isLastSlide) {
      continueToPetSetup();
      return;
    }

    setActiveIndex((currentIndex) => Math.min(currentIndex + 1, lastSlideIndex));
  };

  return (
    <GardenSceneFrame
      accessibilityLabel="Mongchi welcome onboarding"
      contentStyle={compact ? styles.compactContent : styles.content}
      includeBottomEdge
      innerStyle={styles.inner}
    >
      <View style={[styles.card, compact ? styles.compactCard : null]}>
        <OnboardingStoryArt
          accessibilityLabel={`${activeSlide.step}: ${activeSlide.title}`}
          compact={compact}
          style={[styles.art, compact ? styles.compactArt : null]}
          variant={activeSlide.variant}
        />

        <View style={styles.copy}>
          <Text style={[styles.step, { fontFamily: fontFamilies.label }]}>{activeSlide.step}</Text>
          <Text accessibilityRole="header" style={[styles.title, { fontFamily: fontFamilies.display }, compact ? styles.compactTitle : null]}>
            {activeSlide.title}
          </Text>
          <Text style={[styles.body, { fontFamily: fontFamilies.body }, compact ? styles.compactBody : null]}>{activeSlide.body}</Text>
        </View>

        <View accessible accessibilityLabel={`Welcome page ${activeIndex + 1} of ${welcomeSlides.length}`} style={styles.dots}>
          {welcomeSlides.map((slide, index) => (
            <View key={slide.step} style={[styles.dot, index === activeIndex ? styles.activeDot : null]} />
          ))}
        </View>

        <View style={styles.actions}>
          <ActionButton
            label={isLastSlide ? "Start with a photo" : "Next"}
            Icon={isLastSlide ? Camera : ArrowRight}
            onPress={handleNext}
          />
          <Pressable accessibilityLabel="Skip welcome onboarding" accessibilityRole="button" hitSlop={10} style={styles.skipLink} onPress={continueToPetSetup}>
            <Text style={[styles.skipText, { fontFamily: fontFamilies.label }]}>Skip</Text>
          </Pressable>
        </View>
      </View>
    </GardenSceneFrame>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    justifyContent: "center"
  },
  compactContent: {
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    justifyContent: "center"
  },
  inner: {
    justifyContent: "center"
  },
  card: {
    borderRadius: 32,
    borderWidth: 4,
    borderBottomWidth: 8,
    borderColor: "rgba(255,255,255,0.86)",
    backgroundColor: "rgba(255,245,222,0.95)",
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.gamePanel
  },
  compactCard: {
    padding: spacing.sm,
    gap: spacing.sm
  },
  art: {
    minHeight: 346,
    borderRadius: 28
  },
  compactArt: {
    minHeight: 258
  },
  copy: {
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm
  },
  step: {
    color: colors.skyDeep,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  title: {
    color: colors.ink,
    fontSize: 29,
    lineHeight: 34,
    fontWeight: "900",
    textAlign: "center"
  },
  compactTitle: {
    fontSize: 24,
    lineHeight: 28
  },
  body: {
    color: colors.mutedInk,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    textAlign: "center"
  },
  compactBody: {
    fontSize: 12,
    lineHeight: 17
  },
  dots: {
    minHeight: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.xs
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.line
  },
  activeDot: {
    width: 22,
    backgroundColor: colors.ink
  },
  actions: {
    gap: spacing.sm
  },
  skipLink: {
    alignSelf: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  skipText: {
    color: colors.skyDeep,
    fontSize: 13,
    fontWeight: "900"
  }
});
