import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react-native";
import { router } from "expo-router";
import { Linking, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { getPublicReleaseConfig } from "../../shared/config/publicReleaseConfig";
import { colors, radii, spacing } from "../../shared/design/tokens";
import { ActionButton } from "../../shared/ui/ActionButton";
import { BackButton } from "../../shared/ui/BackButton";
import { GardenSceneFrame } from "../appShell/GardenSceneFrame";

export function PrivacyScreen() {
  const releaseConfig = getPublicReleaseConfig();
  const { t } = useTranslation();
  const privacyItems = [t("legal.privacy.items.first"), t("legal.privacy.items.second"), t("legal.privacy.items.third"), t("legal.privacy.items.fourth"), t("legal.privacy.items.fifth"), t("legal.privacy.items.sixth"), t("legal.privacy.items.seventh"), t("legal.privacy.items.eighth")];
  const privacySections = [
    { title: t("legal.privacy.sections.sharingTitle"), body: t("legal.privacy.sections.sharingBody") },
    { title: t("legal.privacy.sections.rightsTitle"), body: t("legal.privacy.sections.rightsBody") },
    { title: t("legal.privacy.sections.childrenTitle"), body: t("legal.privacy.sections.childrenBody") }
  ];

  return (
    <GardenSceneFrame accessibilityLabel={t("legal.privacy.accessibilityLabel")}>
      <BackButton accessibilityLabel={t("legal.back")} onPress={() => router.replace("/settings")} />

      <View style={styles.copy}>
        <Text style={styles.eyebrow}>{t("legal.privacy.eyebrow")}</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {t("legal.privacy.title")}
        </Text>
        <Text style={styles.versionText}>{t("legal.privacy.updated")}</Text>
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
        <Text style={styles.noticeTitle}>{t("legal.privacy.policyLink")}</Text>
        <Text style={styles.noticeText}>
          {releaseConfig.privacyPolicyUrl ?? t("legal.privacy.policyFallback")}
        </Text>
        <ActionButton
          label={t("legal.privacy.openPolicy")}
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
        <Text style={styles.noticeTitle}>{t("legal.privacy.aiTitle")}</Text>
        <Text style={styles.noticeText}>{t("legal.privacy.aiBody")}</Text>
      </View>

      <ActionButton label={t("legal.back")} Icon={ArrowLeft} onPress={() => router.push("/settings")} />
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
