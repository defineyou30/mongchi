import { Flame, Gift, Heart, Mail } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, homeRetentionSurfaces, radii, shadows, spacing, useFontFamilies } from "../../shared/design/tokens";
import type { HomeRetentionPromptAction, HomeRetentionPromptPresentation, HomeRetentionPromptTone } from "./homeRetentionPresentation";

interface HomeRetentionPromptCardProps {
  readonly prompt: HomeRetentionPromptPresentation;
  readonly onPress: (action: HomeRetentionPromptAction) => void;
}

const getSurfaceColor = (tone: HomeRetentionPromptTone): string => {
  switch (tone) {
    case "daily":
      return homeRetentionSurfaces.card;
    case "reward":
      return homeRetentionSurfaces.cardReward;
    case "memory":
      return homeRetentionSurfaces.cardMemory;
    case "letter":
      return homeRetentionSurfaces.cardLetter;
  }
};

const retentionIconByTone: Record<HomeRetentionPromptTone, { readonly Icon: LucideIcon; readonly color: string }> = {
  daily: { Icon: Flame, color: colors.honey },
  reward: { Icon: Gift, color: colors.moss },
  memory: { Icon: Heart, color: colors.skyDeep },
  letter: { Icon: Mail, color: colors.woodDark }
};

function RetentionIcon({ tone }: { readonly tone: HomeRetentionPromptTone }) {
  const { Icon, color } = retentionIconByTone[tone];

  return <Icon color={color} size={15} strokeWidth={2.8} />;
}

export function HomeRetentionPromptCard({ prompt, onPress }: HomeRetentionPromptCardProps) {
  const fontFamilies = useFontFamilies();

  return (
    <Pressable
      accessibilityLabel={prompt.accessibilityLabel}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: getSurfaceColor(prompt.tone) },
        pressed ? styles.cardPressed : null
      ]}
      onPress={() => onPress(prompt.action)}
    >
      <View style={styles.iconFrame}>
        <RetentionIcon tone={prompt.tone} />
      </View>
      <View style={styles.copy}>
        <View style={styles.headerRow}>
          <Text numberOfLines={1} style={[styles.eyebrow, { fontFamily: fontFamilies.label }]}>
            {prompt.eyebrow}
          </Text>
          <Text numberOfLines={1} style={[styles.progress, { fontFamily: fontFamilies.label }]}>
            {prompt.progressLabel}
          </Text>
        </View>
        <Text numberOfLines={1} style={[styles.title, { fontFamily: fontFamilies.title }]}>
          {prompt.title}
        </Text>
        <Text numberOfLines={2} style={[styles.line, { fontFamily: fontFamilies.body }]}>
          {prompt.line}
        </Text>
      </View>
      <View style={styles.cta}>
        <Text numberOfLines={1} style={[styles.ctaText, { fontFamily: fontFamilies.button }]}>
          {prompt.ctaLabel}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    left: 22,
    right: 22,
    bottom: 164,
    zIndex: 205,
    minHeight: 74,
    borderRadius: 22,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: homeRetentionSurfaces.rim,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    ...shadows.gamePanel
  },
  cardPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 3
  },
  iconFrame: {
    width: 38,
    height: 38,
    borderRadius: 16,
    backgroundColor: colors.cream,
    borderWidth: 2,
    borderColor: homeRetentionSurfaces.rim,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 1
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  eyebrow: {
    color: colors.woodDark,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "900"
  },
  progress: {
    color: colors.moss,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "900",
    borderRadius: radii.pill,
    backgroundColor: homeRetentionSurfaces.progressTrack,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: "hidden"
  },
  title: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "900"
  },
  line: {
    color: colors.mutedInk,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800"
  },
  cta: {
    minWidth: 78,
    borderRadius: 15,
    backgroundColor: colors.honey,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: homeRetentionSurfaces.softRim,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    alignItems: "center",
    flexShrink: 0
  },
  ctaText: {
    color: colors.ink,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "900"
  }
});
