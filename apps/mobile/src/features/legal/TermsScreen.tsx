import { ArrowLeft, ExternalLink, FileText } from "lucide-react-native";
import { router } from "expo-router";
import { Linking, StyleSheet, Text, View } from "react-native";

import { getPublicReleaseConfig } from "../../shared/config/publicReleaseConfig";
import { colors, radii, spacing } from "../../shared/design/tokens";
import { ActionButton } from "../../shared/ui/ActionButton";
import { BackButton } from "../../shared/ui/BackButton";
import { GardenSceneFrame } from "../appShell/GardenSceneFrame";

const termsItems = [
  "The first pet flow keeps your selected photo under your control and lets you delete it separately.",
  "Bad generations, system failures, and quality checks should not consume paid value.",
  "Basic care remains free. Paid items must add expression, not recovery from neglect.",
  "Generated pet conversations must never claim to be the real pet's consciousness."
];

export function TermsScreen() {
  const releaseConfig = getPublicReleaseConfig();

  return (
    <GardenSceneFrame accessibilityLabel="Terms and paid value">
      <BackButton accessibilityLabel="Back to settings" onPress={() => router.replace("/settings")} />

      <View style={styles.copy}>
        <Text style={styles.eyebrow}>Terms</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Fair use and paid value
        </Text>
      </View>

      <View style={styles.list}>
        {termsItems.map((item) => (
          <View key={item} style={styles.row}>
            <FileText color={colors.skyDeep} size={20} strokeWidth={2.5} />
            <Text style={styles.itemText}>{item}</Text>
          </View>
        ))}
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Terms link</Text>
        <Text style={styles.noticeText}>{releaseConfig.termsUrl ?? "A secure terms link will appear here when available."}</Text>
        <ActionButton
          label="Open terms"
          Icon={ExternalLink}
          variant="secondary"
          disabled={!releaseConfig.termsUrl}
          onPress={() => {
            if (releaseConfig.termsUrl) {
              void Linking.openURL(releaseConfig.termsUrl);
            }
          }}
        />
      </View>

      <ActionButton label="Back to settings" Icon={ArrowLeft} onPress={() => router.push("/settings")} />
    </GardenSceneFrame>
  );
}

const styles = StyleSheet.create({
  copy: {
    gap: spacing.sm
  },
  eyebrow: {
    color: colors.skyDeep,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  title: {
    color: colors.ink,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900"
  },
  list: {
    gap: spacing.md
  },
  row: {
    borderRadius: radii.card,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    flexDirection: "row",
    gap: spacing.md
  },
  itemText: {
    flex: 1,
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700"
  },
  notice: {
    borderRadius: radii.card,
    backgroundColor: "#F4FFF6",
    borderWidth: 1,
    borderColor: colors.leaf,
    padding: spacing.lg,
    gap: spacing.sm
  },
  noticeTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900"
  },
  noticeText: {
    color: colors.mutedInk,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700"
  }
});
