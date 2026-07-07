import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react-native";
import { router } from "expo-router";
import { Linking, StyleSheet, Text, View } from "react-native";

import { getPublicReleaseConfig } from "../../shared/config/publicReleaseConfig";
import { colors, radii, spacing } from "../../shared/design/tokens";
import { ActionButton } from "../../shared/ui/ActionButton";
import { BackButton } from "../../shared/ui/BackButton";
import { GardenSceneFrame } from "../appShell/GardenSceneFrame";

const privacyItems = [
  "Original pet photos are private and can be deleted separately from the generated avatar.",
  "Free reactions are authored locally and do not call AI.",
  "Premium chat is labeled as AI-generated and moderated before messages appear.",
  "Analytics avoid raw photos, raw chat text, and payment details."
];

export function PrivacyScreen() {
  const releaseConfig = getPublicReleaseConfig();

  return (
    <GardenSceneFrame accessibilityLabel="Privacy policy and AI disclosure">
      <BackButton accessibilityLabel="Back to settings" onPress={() => router.replace("/settings")} />

      <View style={styles.copy}>
        <Text style={styles.eyebrow}>Privacy</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Photo and chat safety
        </Text>
      </View>

      <View style={styles.list}>
        {privacyItems.map((item) => (
          <View key={item} style={styles.row}>
            <ShieldCheck color={colors.skyDeep} size={20} strokeWidth={2.6} />
            <Text style={styles.itemText}>{item}</Text>
          </View>
        ))}
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Policy link</Text>
        <Text style={styles.noticeText}>
          {releaseConfig.privacyPolicyUrl ?? "A secure privacy policy link will appear here when available."}
        </Text>
        <ActionButton
          label="Open policy"
          Icon={ExternalLink}
          variant="secondary"
          disabled={!releaseConfig.privacyPolicyUrl}
          onPress={() => {
            if (releaseConfig.privacyPolicyUrl) {
              void Linking.openURL(releaseConfig.privacyPolicyUrl);
            }
          }}
        />
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>AI disclosure</Text>
        <Text style={styles.noticeText}>
          This is an AI-generated conversation shaped by your pet's profile. It is not your real pet's consciousness.
        </Text>
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
