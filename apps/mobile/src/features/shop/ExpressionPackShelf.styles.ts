import { StyleSheet } from "react-native";

import { colors, profileSurfaces, radii, shadows, spacing } from "../../shared/design/tokens";

export const styles = StyleSheet.create({
  shelf: { gap: spacing.md },
  introBand: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.card,
    borderWidth: 3,
    borderColor: colors.cream,
    backgroundColor: profileSurfaces.parchmentPanel,
    padding: spacing.md,
    ...shadows.tile
  },
  introCopy: { flex: 1, gap: spacing.xs },
  introTitle: { color: colors.ink, fontSize: 20, lineHeight: 24 },
  introText: { color: colors.mutedInk },
  packBoard: {
    overflow: "hidden",
    borderRadius: radii.card,
    borderWidth: 3,
    borderBottomWidth: 6,
    borderColor: colors.cream,
    backgroundColor: colors.parchment,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.gamePanel
  },
  accentRail: { position: "absolute", top: 0, bottom: 0, left: 0, width: 6 },
  packHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingLeft: spacing.xs },
  packHeadingCopy: { flex: 1, gap: spacing.xs },
  packTitle: { color: colors.ink, fontSize: 19, lineHeight: 23 },
  packDescription: { color: colors.mutedInk },
  poseCountTag: {
    borderRadius: radii.card,
    backgroundColor: colors.cream,
    borderWidth: 2,
    borderColor: colors.parchmentDeep,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  poseCountText: { color: colors.woodDark },
  slotRail: {
    minHeight: 134,
    flexDirection: "row",
    borderRadius: radii.card,
    borderWidth: 2,
    borderColor: colors.parchmentDeep,
    backgroundColor: colors.cream,
    overflow: "hidden"
  },
  poseSlot: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm
  },
  poseSlotDivider: { borderLeftWidth: 2, borderLeftColor: colors.parchmentDeep },
  slotIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white
  },
  poseName: { minHeight: 28, color: colors.ink, textAlign: "center" },
  poseUsage: { color: colors.mutedInk, fontSize: 11, lineHeight: 14, textAlign: "center" },
  packFooter: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  priceGroup: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  priceIcon: { width: 30, height: 30 },
  priceText: { color: colors.ink },
  statusText: { color: colors.mutedInk, fontSize: 11, lineHeight: 14 },
  packAction: { minWidth: 136 }
});
