import { ArrowLeft, ExternalLink, FileText } from "lucide-react-native";
import { router } from "expo-router";
import { Linking, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { getPublicReleaseConfig } from "../../shared/config/publicReleaseConfig";
import { colors, radii, spacing } from "../../shared/design/tokens";
import { ActionButton } from "../../shared/ui/ActionButton";
import { BackButton } from "../../shared/ui/BackButton";
import { GardenSceneFrame } from "../appShell/GardenSceneFrame";

export function TermsScreen() {
  const releaseConfig = getPublicReleaseConfig();
  const { t } = useTranslation();
  const termsItems = [t("legal.terms.items.first"), t("legal.terms.items.second"), t("legal.terms.items.third"), t("legal.terms.items.fourth"), t("legal.terms.items.fifth"), t("legal.terms.items.sixth")];
  const termsSections = [
    { title: t("legal.terms.sections.useTitle"), body: t("legal.terms.sections.useBody") },
    { title: t("legal.terms.sections.portabilityTitle"), body: t("legal.terms.sections.portabilityBody") },
    { title: t("legal.terms.sections.disclaimerTitle"), body: t("legal.terms.sections.disclaimerBody") }
  ];

  return (
    <GardenSceneFrame accessibilityLabel={t("legal.terms.accessibilityLabel")}>
      <BackButton accessibilityLabel={t("legal.back")} onPress={() => router.replace("/settings")} />

      <View style={styles.copy}>
        <Text style={styles.eyebrow}>{t("legal.terms.eyebrow")}</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {t("legal.terms.title")}
        </Text>
        <Text style={styles.versionText}>{t("legal.terms.updated")}</Text>
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
        <Text style={styles.noticeTitle}>{t("legal.terms.linkTitle")}</Text>
        <Text style={styles.noticeText}>{releaseConfig.termsUrl ?? t("legal.terms.linkFallback")}</Text>
        <ActionButton
          label={t("legal.terms.openTerms")}
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
