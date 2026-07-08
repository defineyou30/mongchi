import { Camera, Heart, PawPrint, ShieldCheck } from "lucide-react-native";
import { router } from "expo-router";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { colors, radii, shadows, spacing, useFontFamilies } from "../../shared/design/tokens";
import { ActionButton } from "../../shared/ui/ActionButton";
import { OnboardingStoryArt } from "../../shared/ui/OnboardingStoryArt";
import { GardenSceneFrame } from "../appShell/GardenSceneFrame";

export function OnboardingScreen() {
  const { height, width } = useWindowDimensions();
  const compact = height < 720 || width < 380;
  const fontFamilies = useFontFamilies();

  return (
    <GardenSceneFrame
      accessibilityLabel="Tiny pet photo intro"
      contentStyle={compact ? styles.compactContent : null}
      includeBottomEdge
      innerStyle={compact ? styles.compactInner : null}
    >
      <OnboardingStoryArt
        accessibilityLabel="One pet photo opening into a tiny garden home"
        compact={compact}
        variant="welcome"
        style={[styles.hero, compact ? styles.compactHero : null]}
      />

      <View style={[styles.entryPanel, compact ? styles.compactEntryPanel : null]}>
        <View style={styles.titleLockup}>
          <Text style={[styles.eyebrow, { fontFamily: fontFamilies.label }]}>Mongchi</Text>
          <Text
            accessibilityRole="header"
            style={[styles.title, { fontFamily: fontFamilies.display }, compact ? styles.compactTitle : null]}
          >
            Raise your beloved pet in your hands
          </Text>
          <Text style={[styles.welcomeCopy, { fontFamily: fontFamilies.body }, compact ? styles.compactWelcomeCopy : null]}>
            Start with one clear photo, give them a tiny name and voice, then meet the little friend waiting in your garden.
          </Text>
        </View>

        <View style={styles.questRow}>
          <View style={styles.questPip}>
            <Camera color={colors.violet} size={16} strokeWidth={2.8} />
            <Text style={[styles.questText, { fontFamily: fontFamilies.label }]}>Photo</Text>
          </View>
          <View style={styles.questPip}>
            <PawPrint color={colors.gold} size={16} strokeWidth={2.8} />
            <Text style={[styles.questText, { fontFamily: fontFamilies.label }]}>Name</Text>
          </View>
          <View style={styles.questPip}>
            <Heart color={colors.coral} size={16} strokeWidth={2.8} />
            <Text style={[styles.questText, { fontFamily: fontFamilies.label }]}>Move in</Text>
          </View>
        </View>

        <View style={styles.photoNotice}>
          <ShieldCheck color={colors.moss} size={18} strokeWidth={2.5} />
          <Text style={[styles.noticeText, { fontFamily: fontFamilies.body }, compact ? styles.compactNoticeText : null]}>
            Your photo is only used to create your tiny friend. Delete the original anytime after they move in.
          </Text>
        </View>
      </View>

      <ActionButton label="Choose pet photo" Icon={Camera} onPress={() => router.push("/photo-upload")} />
    </GardenSceneFrame>
  );
}

const styles = StyleSheet.create({
  hero: {
    minHeight: 318,
    justifyContent: "flex-end"
  },
  compactContent: {
    paddingTop: spacing.md,
    paddingBottom: spacing.md
  },
  compactInner: {
    gap: spacing.md
  },
  compactHero: {
    minHeight: 232
  },
  entryPanel: {
    borderRadius: radii.panel,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: "rgba(255,255,255,0.86)",
    backgroundColor: "rgba(255,245,222,0.93)",
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.gamePanel
  },
  compactEntryPanel: {
    padding: spacing.sm,
    gap: spacing.sm
  },
  titleLockup: {
    gap: 4
  },
  eyebrow: {
    color: colors.skyDeep,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  title: {
    color: colors.ink,
    fontSize: 29,
    lineHeight: 34,
    fontWeight: "900"
  },
  compactTitle: {
    fontSize: 25,
    lineHeight: 29
  },
  welcomeCopy: {
    color: colors.mutedInk,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
    marginTop: 2
  },
  compactWelcomeCopy: {
    fontSize: 12,
    lineHeight: 16
  },
  questRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  questPip: {
    flex: 1,
    minHeight: 42,
    minWidth: 0,
    borderRadius: radii.control,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5
  },
  questText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900"
  },
  photoNotice: {
    minHeight: 48,
    borderRadius: radii.control,
    borderWidth: 2,
    borderColor: "rgba(62,122,66,0.24)",
    backgroundColor: "rgba(255,255,255,0.64)",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  noticeText: {
    flex: 1,
    color: colors.mutedInk,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800"
  },
  compactNoticeText: {
    fontSize: 12,
    lineHeight: 16
  }
});
