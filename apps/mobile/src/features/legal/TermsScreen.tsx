import { ArrowLeft, ExternalLink, FileText } from "lucide-react-native";
import { router } from "expo-router";
import { Linking, StyleSheet, Text, View } from "react-native";

import { getPublicReleaseConfig } from "../../shared/config/publicReleaseConfig";
import { colors, radii, spacing } from "../../shared/design/tokens";
import { ActionButton } from "../../shared/ui/ActionButton";
import { BackButton } from "../../shared/ui/BackButton";
import { GardenSceneFrame } from "../appShell/GardenSceneFrame";

// Last updated July 7, 2026 · v1.0 — keep in sync with docs/legal/terms.md.
const TERMS_LAST_UPDATED = "Last updated July 7, 2026 · v1.0";

const termsItems = [
  "Mongchi is AI-generated entertainment — your companion and its chat are not your real pet's consciousness, memory, or medical advice.",
  "The first pet flow keeps your selected photo under your control and lets you delete it separately.",
  "Bad generations, system failures, and quality checks should not consume paid value.",
  "Basic care remains free. Paid items must add expression, not recovery from neglect.",
  "Credits and paid items have no cash value and refunds follow the App Store or Google Play policy you purchased through.",
  "Generated pet conversations must never claim to be the real pet's consciousness."
];

const termsSections: Array<{ title: string; body: string }> = [
  {
    title: "Acceptable use",
    body:
      "Don't upload photos containing people, explicit or graphic content, or anything illegal. Don't try to bypass generation limits or safety checks, or use chat to jailbreak the underlying AI model. We may restrict access for sessions that violate these terms."
  },
  {
    title: "No account portability",
    body:
      "Mongchi doesn't use traditional accounts — your session and local game data live on your device. Uninstalling the app or switching devices without a backup may permanently lose your companion's local progress, memories, and credits."
  },
  {
    title: "Disclaimer",
    body:
      "Mongchi is provided as-is. AI-generated content may occasionally be inaccurate or fail to generate despite our safety and quality checks. See the full terms for the complete disclaimer and liability limits."
  }
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
        <Text style={styles.versionText}>{TERMS_LAST_UPDATED}</Text>
      </View>

      <View style={styles.list}>
        {termsItems.map((item) => (
          <View key={item} style={styles.row}>
            <FileText color={colors.skyDeep} size={20} strokeWidth={2.5} />
            <Text style={styles.itemText}>{item}</Text>
          </View>
        ))}
      </View>

      {termsSections.map((section) => (
        <View key={section.title} style={styles.notice}>
          <Text style={styles.noticeTitle}>{section.title}</Text>
          <Text style={styles.noticeText}>{section.body}</Text>
        </View>
      ))}

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
  versionText: {
    color: colors.mutedInk,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700"
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
