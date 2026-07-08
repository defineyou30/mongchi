import { StyleSheet } from "react-native";

import { colors, radii, shadows, spacing } from "../../shared/design/tokens";

export const photoUploadScreenStyles = StyleSheet.create({
  photoFlow: {
    gap: spacing.md
  },
  uploadPass: {
    borderRadius: radii.panel,
    borderWidth: 3,
    borderBottomWidth: 6,
    borderColor: "rgba(255,255,255,0.84)",
    backgroundColor: "rgba(255,245,222,0.93)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
    ...shadows.gamePanel
  },
  title: {
    minWidth: 0,
    color: colors.ink,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "900"
  },
  storyArt: {
    minHeight: 246
  },
  photoPicker: {
    minHeight: 112,
    borderRadius: radii.panel,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.84)",
    backgroundColor: "rgba(255,245,222,0.9)",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    ...shadows.gamePanel
  },
  photoPickerSelected: {
    borderColor: colors.leaf,
    backgroundColor: "rgba(244,255,240,0.92)"
  },
  photoPreview: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.sky,
    borderWidth: 3,
    borderBottomWidth: 5,
    borderColor: colors.cream
  },
  photoCopy: {
    flex: 1,
    gap: spacing.xs
  },
  photoActions: {
    gap: spacing.sm
  },
  photoAction: {
    flex: 1
  },
  photoTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900"
  },
  photoBody: {
    color: colors.mutedInk,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600"
  },
  sampleLinkRow: {
    alignSelf: "center"
  },
  sampleLinkText: {
    color: colors.skyDeep,
    fontSize: 13,
    fontWeight: "800",
    textDecorationLine: "underline"
  },
  privacyNotice: {
    color: colors.mutedInk,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    textAlign: "center"
  }
});
