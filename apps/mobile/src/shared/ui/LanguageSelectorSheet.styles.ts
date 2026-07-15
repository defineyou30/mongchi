import { StyleSheet } from "react-native";

import { colors, radii, shadows, spacing } from "../design/tokens";

export const languageSelectorStyles = StyleSheet.create({
  globeButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    borderBottomWidth: 5,
    borderColor: "rgba(255,255,255,0.9)",
    backgroundColor: "rgba(255,245,222,0.96)",
    alignItems: "center",
    justifyContent: "center",
    ...shadows.tile
  },
  globeButtonPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 3
  },
  overlay: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    backgroundColor: "rgba(34,23,20,0.58)",
    alignItems: "center",
    justifyContent: "center"
  },
  sheet: {
    width: "100%",
    maxWidth: 430,
    maxHeight: "84%",
    borderRadius: radii.panel,
    borderWidth: 4,
    borderBottomWidth: 8,
    borderColor: "rgba(255,255,255,0.9)",
    backgroundColor: colors.cream,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.gamePanel
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "rgba(61,145,200,0.24)",
    backgroundColor: colors.skySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  headerCopy: {
    flex: 1,
    gap: 2,
    paddingTop: 1
  },
  title: {
    color: colors.ink,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "900"
  },
  subtitle: {
    color: colors.mutedInk,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800"
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center"
  },
  closeButtonPressed: {
    transform: [{ scale: 0.95 }]
  },
  optionList: {
    gap: spacing.xs,
    paddingBottom: spacing.xs
  },
  saveError: {
    color: colors.coralDeep,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    textAlign: "center"
  },
  option: {
    minHeight: 58,
    borderRadius: radii.card,
    borderWidth: 2,
    borderColor: "transparent",
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  optionSelected: {
    borderColor: colors.skyDeep,
    backgroundColor: "rgba(201,240,255,0.72)"
  },
  optionPressed: {
    backgroundColor: "rgba(246,209,163,0.5)"
  },
  optionCode: {
    width: 40,
    height: 40,
    borderRadius: radii.card,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center"
  },
  deviceCode: {
    borderColor: "rgba(61,145,200,0.26)",
    backgroundColor: colors.skySoft
  },
  optionCodeText: {
    color: colors.woodDark,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900"
  },
  optionCopy: {
    flex: 1,
    minWidth: 0
  },
  optionTitle: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900"
  },
  languageName: {
    flex: 1
  },
  optionDetail: {
    color: colors.mutedInk,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800"
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.leaf,
    alignItems: "center",
    justifyContent: "center"
  },
  checkPlaceholder: {
    width: 28,
    height: 28
  },
  divider: {
    height: 2,
    marginVertical: spacing.xs,
    marginHorizontal: spacing.sm,
    backgroundColor: "rgba(232,207,169,0.72)"
  }
});
