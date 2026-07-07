import type { Href } from "expo-router";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, shadows, spacing } from "../../shared/design/tokens";
import { GameItemImage, TerrariumArt } from "../../shared/ui/GameIllustrations";
import { GardenSceneFrame } from "./GardenSceneFrame";

interface ShellScreenProps {
  eyebrow: string;
  title: string;
  body: string;
  primaryLabel: string;
  primaryHref: Href;
  secondaryLabel?: string;
  secondaryHref?: Href;
}

export function ShellScreen({
  eyebrow,
  title,
  body,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref
}: ShellScreenProps) {
  return (
    <GardenSceneFrame accessibilityLabel={title}>
      <TerrariumArt accessibilityLabel={`${title} garden scene`} scene="garden" variant="empty" style={styles.hero}>
        <View style={styles.heroBadge}>
          <GameItemImage accessibilityLabel="Garden gift" decorative item="gift" style={styles.heroBadgeIcon} variant="hud" />
          <Text numberOfLines={1} style={styles.heroBadgeText}>
            Tiny garden
          </Text>
        </View>
      </TerrariumArt>

      <View style={styles.copyBlock}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <Text style={styles.body}>{body}</Text>
      </View>

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel={primaryLabel} style={styles.primaryButton} onPress={() => router.push(primaryHref)}>
          <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
        </Pressable>
        {secondaryLabel && secondaryHref ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={secondaryLabel}
            style={styles.secondaryButton}
            onPress={() => router.push(secondaryHref)}
          >
            <Text style={styles.secondaryButtonText}>{secondaryLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </GardenSceneFrame>
  );
}

const styles = StyleSheet.create({
  hero: {
    minHeight: 310
  },
  heroBadge: {
    position: "absolute",
    left: spacing.md,
    top: spacing.md,
    minHeight: 42,
    maxWidth: "64%",
    borderRadius: radii.pill,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.cream,
    backgroundColor: colors.parchment,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    ...shadows.soft
  },
  heroBadgeIcon: {
    width: 28,
    height: 28
  },
  heroBadgeText: {
    color: colors.woodDark,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900"
  },
  copyBlock: {
    borderRadius: radii.panel,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.84)",
    backgroundColor: "rgba(255,245,222,0.9)",
    padding: spacing.lg,
    gap: spacing.sm
  },
  eyebrow: {
    color: colors.skyDeep,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  title: {
    color: colors.ink,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900"
  },
  body: {
    color: colors.mutedInk,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "700"
  },
  actions: {
    gap: spacing.sm
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: radii.pill,
    backgroundColor: colors.apple,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderWidth: 3,
    borderColor: colors.cream,
    ...shadows.button
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 16
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.parchment,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.84)",
    ...shadows.tile
  },
  secondaryButtonText: {
    color: colors.ink,
    fontWeight: "900",
    fontSize: 15
  }
});
