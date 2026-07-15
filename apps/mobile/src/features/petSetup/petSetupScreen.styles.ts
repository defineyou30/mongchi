import { StyleSheet } from "react-native";

import { colors, radii, shadows, spacing } from "../../shared/design/tokens";

export const petSetupScreenStyles = StyleSheet.create({
  setupFlow: {
    gap: spacing.md
  },
  storyArt: {
    minHeight: 226
  },
  titleLockup: {
    gap: 6,
    borderRadius: radii.panel,
    borderWidth: 3,
    borderBottomWidth: 6,
    borderColor: "rgba(255,255,255,0.84)",
    backgroundColor: "rgba(255,245,222,0.94)",
    padding: spacing.md,
    ...shadows.gamePanel
  },
  eyebrowTag: {
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    backgroundColor: "#20283F",
    borderWidth: 2,
    borderBottomWidth: 3,
    borderColor: colors.cream,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4
  },
  eyebrow: {
    color: colors.skySoft,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  setupCard: {
    borderRadius: radii.panel,
    borderWidth: 3,
    borderBottomWidth: 6,
    borderColor: "rgba(255,255,255,0.84)",
    backgroundColor: "rgba(255,245,222,0.93)",
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.gamePanel
  },
  continueHint: {
    color: colors.mutedInk,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
    textAlign: "center",
    marginTop: -6
  },
  title: {
    color: colors.ink,
    fontSize: 27,
    lineHeight: 32,
    fontWeight: "900"
  },
  setupCaption: {
    color: colors.mutedInk,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    marginTop: 2
  },
  divider: {
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(216,179,130,0.4)",
    marginVertical: 2
  },
  namePlate: {
    minHeight: 58,
    borderRadius: radii.control,
    borderWidth: 3,
    borderBottomWidth: 6,
    borderColor: colors.cream,
    backgroundColor: colors.wood,
    padding: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    ...shadows.tile
  },
  speciesRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  speciesOption: {
    minHeight: 76,
    flex: 1,
    borderRadius: radii.control,
    borderWidth: 3,
    borderBottomWidth: 6,
    borderColor: "rgba(216,179,130,0.68)",
    backgroundColor: colors.white,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    ...shadows.tile
  },
  speciesOptionSelected: {
    borderColor: colors.honey,
    backgroundColor: colors.parchment
  },
  speciesOptionPressed: {
    opacity: 0.82,
    transform: [{ translateY: 2 }]
  },
  speciesIconPlate: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "rgba(216,179,130,0.42)",
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible"
  },
  speciesIconPlateSelected: {
    borderColor: colors.honey,
    backgroundColor: colors.white
  },
  speciesPetIcon: {
    width: 46,
    height: 46
  },
  speciesSelectedBadge: {
    position: "absolute",
    right: -7,
    bottom: -7,
    width: 25,
    height: 25,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.cream,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.tile
  },
  speciesLabel: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900"
  },
  namePlateIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.cream,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center"
  },
  input: {
    minHeight: 42,
    borderRadius: radii.control,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.76)",
    backgroundColor: colors.white,
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
    paddingHorizontal: spacing.md
  },
  nameInput: {
    flex: 1
  },
  sectionHint: {
    color: colors.mutedInk,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800"
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  sectionLabelDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.honey
  },
  sectionLabel: {
    color: colors.woodDark,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.3
  },
  favoritePlate: {
    minHeight: 54,
    borderRadius: radii.control,
    borderWidth: 3,
    borderBottomWidth: 6,
    borderColor: colors.cream,
    backgroundColor: colors.wood,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: 5,
    ...shadows.tile
  },
  favoriteInput: {
    flex: 1
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  }
});
