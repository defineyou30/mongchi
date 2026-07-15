import { X } from "lucide-react-native";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { ImageSourcePropType } from "react-native";

import { colors, homeRetentionSurfaces, radii, shadows, spacing, useFontFamilies } from "../../shared/design/tokens";
import type {
  HomeRetentionCardDisplayMode,
  HomeRetentionPromptAction,
  HomeRetentionPromptPresentation,
  HomeRetentionPromptTone
} from "./homeRetentionPresentation";

interface HomeRetentionPromptCardProps {
  readonly prompt: HomeRetentionPromptPresentation;
  readonly displayMode: HomeRetentionCardDisplayMode;
  /** X tap on the full card: folds it to a chip for the rest of today. */
  readonly onCollapse: () => void;
  /** Chip tap: peek back at the full card. */
  readonly onExpand: () => void;
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

const retentionIconByTone = {
  daily: require("../../../assets/game-buttons/energy.png"),
  reward: require("../../../assets/game-items/hud/gift-box.png"),
  memory: require("../../../assets/status-icons/cozy.png"),
  letter: require("../../../assets/generated/items/gift-v3.png")
} satisfies Record<HomeRetentionPromptTone, ImageSourcePropType>;

const retentionIconSizeByTone = {
  daily: 31,
  reward: 26,
  memory: 28,
  letter: 30
} satisfies Record<HomeRetentionPromptTone, number>;

const getRetentionIconSize = (tone: HomeRetentionPromptTone): number => {
  switch (tone) {
    case "daily":
    case "reward":
    case "memory":
    case "letter":
      return retentionIconSizeByTone[tone];
  }
};

function RetentionIcon({ tone }: { readonly tone: HomeRetentionPromptTone }) {
  const iconSize = getRetentionIconSize(tone);

  return (
    <Image
      accessibilityIgnoresInvertColors
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      resizeMode="contain"
      source={retentionIconByTone[tone]}
      style={{ width: iconSize, height: iconSize }}
    />
  );
}

export function HomeRetentionPromptCard({ prompt, displayMode, onCollapse, onExpand, onPress }: HomeRetentionPromptCardProps) {
  const fontFamilies = useFontFamilies();

  if (displayMode === "chip") {
    return (
      <Pressable
        accessibilityLabel={prompt.chipAccessibilityLabel}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.chip,
          { backgroundColor: getSurfaceColor(prompt.tone) },
          pressed ? styles.chipPressed : null
        ]}
        onPress={onExpand}
      >
        <View style={styles.chipIconFrame}>
          <RetentionIcon tone={prompt.tone} />
        </View>
        <Text numberOfLines={1} style={[styles.chipTitle, { fontFamily: fontFamilies.label }]}>
          {prompt.title}
        </Text>
      </Pressable>
    );
  }

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
          <View style={styles.headerSpacer} />
          <Pressable
            accessibilityLabel={prompt.collapseAccessibilityLabel}
            accessibilityRole="button"
            hitSlop={8}
            style={styles.collapseButton}
            onPress={onCollapse}
          >
            <X color={colors.mutedInk} size={13} strokeWidth={3} />
          </Pressable>
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
  headerSpacer: {
    flex: 1
  },
  collapseButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.55)"
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
  },
  chip: {
    position: "absolute",
    left: 22,
    bottom: 164,
    zIndex: 205,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: homeRetentionSurfaces.rim,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    ...shadows.tile
  },
  chipPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 2
  },
  chipIconFrame: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  },
  chipTitle: {
    color: colors.ink,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "900",
    maxWidth: 220
  }
});
