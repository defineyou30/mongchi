import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react-native";
import { router } from "expo-router";
import { Linking, StyleSheet, Text, View } from "react-native";

import { getPublicReleaseConfig } from "../../shared/config/publicReleaseConfig";
import { colors, radii, spacing } from "../../shared/design/tokens";
import { ActionButton } from "../../shared/ui/ActionButton";
import { BackButton } from "../../shared/ui/BackButton";
import { GardenSceneFrame } from "../appShell/GardenSceneFrame";

// Last updated July 7, 2026 · v1.0 — keep in sync with docs/legal/privacy-policy.md.
const PRIVACY_LAST_UPDATED = "Last updated July 7, 2026 · v1.0";

const privacyItems = [
  "No account, no email — the app opens with an anonymous session, not a signup.",
  "Your pet's original photo is sent to OpenAI only to run a safety check and generate the avatar, then it is automatically deleted from our servers the moment generation finishes.",
  "Unlocking more expression states later reuses your already-generated avatar art, not your original photo — it no longer exists on our servers by then.",
  "Generated avatars live in a private storage bucket and are only ever shown through short-lived signed links, never a public URL.",
  "Care stats, memories, and garden progress are stored locally on your device (not our servers), so uninstalling the app removes them permanently.",
  "Approximate location, if you allow it, is used once for a weather lookup and is not stored on our servers.",
  "Premium chat is labeled as AI-generated and moderated before messages appear.",
  "No ad or tracking SDKs, and analytics avoid raw photos, raw chat text, and payment details."
];

const privacySections: Array<{ title: string; body: string }> = [
  {
    title: "Third parties we share data with",
    body:
      "OpenAI processes your pet's source photo (safety check + avatar generation) and, for premium chat, your pet's profile and recent conversation context. Supabase hosts our database, private storage, and anonymous auth on our behalf. Apple/Google handle in-app purchase payments directly — we only receive a receipt to grant your credit, never your card details."
  },
  {
    title: "Your rights",
    body:
      "You can delete your original photo separately from the generated avatar during the photo flow. You can request full deletion of your session's data — generated avatars, stored profile data, and server-side records — by contacting support below. This covers access, correction, and deletion rights under regimes like GDPR and CCPA."
  },
  {
    title: "Children",
    body:
      "Mongchi is not directed at children under 13. Because we don't collect names, emails, or accounts, we have no practical way to link data to a child's identity — if you believe a child provided us information through a photo or chat, contact support and we will delete it."
  }
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
        <Text style={styles.versionText}>{PRIVACY_LAST_UPDATED}</Text>
      </View>

      <View style={styles.list}>
        {privacyItems.map((item) => (
          <View key={item} style={styles.row}>
            <ShieldCheck color={colors.skyDeep} size={20} strokeWidth={2.6} />
            <Text style={styles.itemText}>{item}</Text>
          </View>
        ))}
      </View>

      {privacySections.map((section) => (
        <View key={section.title} style={styles.notice}>
          <Text style={styles.noticeTitle}>{section.title}</Text>
          <Text style={styles.noticeText}>{section.body}</Text>
        </View>
      ))}

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
