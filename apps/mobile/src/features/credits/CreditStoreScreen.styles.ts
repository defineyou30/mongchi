import { StyleSheet } from "react-native";

import { colors, radii, shadows, spacing } from "../../shared/design/tokens";

export const styles = StyleSheet.create({
  sceneRoot: { flex: 1, backgroundColor: colors.skySoft },
  sceneWash: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(255,245,222,0.1)" },
  safeArea: { flex: 1 },
  content: {
    flexGrow: 1,
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl
  },
  balanceHud: {
    minWidth: 82,
    minHeight: 40,
    borderRadius: radii.pill,
    borderWidth: 3,
    borderColor: colors.cream,
    backgroundColor: colors.ink,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs
  },
  balanceHudIcon: { width: 28, height: 28 },
  balanceHudText: { color: colors.cream },
  heroBand: {
    borderRadius: radii.panel,
    borderWidth: 4,
    borderBottomWidth: 7,
    borderColor: colors.cream,
    backgroundColor: "rgba(255,245,222,0.94)",
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    ...shadows.gamePanel
  },
  heroGemPlate: {
    width: 84,
    height: 84,
    borderRadius: radii.card,
    borderWidth: 3,
    borderColor: colors.parchmentDeep,
    backgroundColor: colors.parchment,
    alignItems: "center",
    justifyContent: "center"
  },
  heroGem: { width: 68, height: 68 },
  heroCopy: { flex: 1, gap: spacing.xs },
  heroTitle: { color: colors.ink, fontSize: 22, lineHeight: 27 },
  heroBody: { color: colors.mutedInk },
  starterBand: {
    borderRadius: radii.card,
    borderWidth: 3,
    borderColor: colors.cream,
    backgroundColor: "rgba(235,249,212,0.94)",
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    ...shadows.tile
  },
  starterCopy: { flex: 1, gap: 2 },
  starterTitle: { color: colors.ink },
  starterBody: { color: colors.mutedInk, fontSize: 12, lineHeight: 17 },
  sectionTitle: { color: colors.ink, fontSize: 20, lineHeight: 24, paddingHorizontal: spacing.xs },
  packShelf: { gap: spacing.sm },
  packCard: {
    minHeight: 128,
    borderRadius: radii.card,
    borderWidth: 3,
    borderBottomWidth: 6,
    borderColor: colors.cream,
    backgroundColor: "rgba(255,240,201,0.95)",
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.gamePanel
  },
  packCardFeatured: { borderColor: colors.honey, backgroundColor: "rgba(255,231,180,0.97)" },
  popularTag: {
    position: "absolute",
    top: -9,
    right: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.cream,
    backgroundColor: colors.violet,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    zIndex: 2
  },
  popularText: { color: colors.white, fontSize: 11 },
  packInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  packIconPlate: {
    width: 64,
    height: 64,
    borderRadius: radii.card,
    backgroundColor: colors.cream,
    borderWidth: 2,
    borderColor: colors.parchmentDeep,
    alignItems: "center",
    justifyContent: "center"
  },
  packGem: { width: 52, height: 52 },
  packCopy: { flex: 1, gap: 2 },
  packAmount: { color: colors.ink, fontSize: 20, lineHeight: 24 },
  packDetail: { color: colors.mutedInk, fontSize: 12, lineHeight: 17 },
  storePrice: { color: colors.woodDark, marginTop: spacing.xs },
  packAction: { alignSelf: "stretch" },
  storeNotice: {
    borderRadius: radii.card,
    borderWidth: 3,
    borderColor: colors.cream,
    backgroundColor: "rgba(255,245,222,0.9)",
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  storeNoticeText: { flex: 1, color: colors.mutedInk, fontSize: 12, lineHeight: 17 }
});
