import { AlertTriangle, ArrowLeft, CheckCircle2, LifeBuoy, Mail, PawPrint, ShieldAlert } from "lucide-react-native";
import { router } from "expo-router";
import { Linking, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import type { GenerationIssueCategory } from "@mongchi/shared";
import { getPublicReleaseConfig } from "../../shared/config/publicReleaseConfig";
import { colors, radii, spacing } from "../../shared/design/tokens";
import { recordMobileEvent } from "../../shared/analytics/mobileAnalytics";
import { ActionButton } from "../../shared/ui/ActionButton";
import { useAppDialog } from "../../shared/ui/AppDialog";
import { BackButton } from "../../shared/ui/BackButton";
import { GardenSceneFrame } from "../appShell/GardenSceneFrame";
import { useTerrariumSession } from "../session/TerrariumSessionProvider";

const generationIssueIcons: Array<{
  category: GenerationIssueCategory;
  Icon: typeof AlertTriangle;
}> = [
  { category: "wrong_pet", Icon: PawPrint },
  { category: "unsafe_or_scary", Icon: ShieldAlert },
  { category: "poor_quality", Icon: AlertTriangle }
];

export function SupportScreen() {
  const releaseConfig = getPublicReleaseConfig();
  const { showDialog } = useAppDialog();
  const { t } = useTranslation();
  const { generationIssueReport, reportGenerationIssue } = useTerrariumSession();
  const generationIssueCopyByCategory: Record<GenerationIssueCategory, { label: string; description: string }> = {
    wrong_pet: { label: t("legal.support.options.wrong.label"), description: t("legal.support.options.wrong.description") },
    unsafe_or_scary: { label: t("legal.support.options.unsafe.label"), description: t("legal.support.options.unsafe.description") },
    poor_quality: { label: t("legal.support.options.quality.label"), description: t("legal.support.options.quality.description") }
  };
  const faqItems = [
    { question: t("legal.support.faq.photoQuestion"), answer: t("legal.support.faq.photoAnswer") },
    { question: t("legal.support.faq.deleteQuestion"), answer: t("legal.support.faq.deleteAnswer") },
    { question: t("legal.support.faq.creditQuestion"), answer: t("legal.support.faq.creditAnswer") }
  ];

  const handleReport = (category: GenerationIssueCategory) => {
    reportGenerationIssue(category);
    recordMobileEvent("generation_issue_reported", { category });
    showDialog({ title: t("legal.support.savedTitle"), message: t("legal.support.savedMessage") });
  };

  return (
    <GardenSceneFrame accessibilityLabel={t("legal.support.accessibilityLabel")}>
      <BackButton accessibilityLabel={t("legal.back")} onPress={() => router.replace("/settings")} />

      <View style={styles.copy}>
        <Text style={styles.eyebrow}>{t("legal.support.eyebrow")}</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {t("legal.support.title")}
        </Text>
        <Text style={styles.versionText}>{t("legal.support.updated")}</Text>
      </View>

      <View style={styles.panel}>
        <LifeBuoy color={colors.skyDeep} size={28} strokeWidth={2.5} />
        <Text style={styles.panelTitle}>{t("legal.support.contact")}</Text>
        <Text style={styles.panelText}>
          {releaseConfig.supportEmail ?? t("legal.support.contactFallback")}
        </Text>
        <ActionButton
          label={t("legal.support.email")}
          Icon={Mail}
          variant="secondary"
          disabled={!releaseConfig.supportEmail}
          onPress={() => {
            if (releaseConfig.supportEmail) {
              void Linking.openURL(`mailto:${releaseConfig.supportEmail}`);
            }
          }}
        />
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>{t("legal.support.faqTitle")}</Text>
        <View style={styles.reportList}>
          {faqItems.map((item) => (
            <View key={item.question} style={styles.faqRow}>
              <Text style={styles.faqQuestion}>{item.question}</Text>
              <Text style={styles.panelText}>{item.answer}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>{t("legal.support.reportTitle")}</Text>
        <Text style={styles.panelText}>{t("legal.support.reportDetail")}</Text>
        <View style={styles.reportList}>
          {generationIssueIcons.map(({ category, Icon }) => {
            const selected = generationIssueReport?.category === category;
            const copy = generationIssueCopyByCategory[category];

            return (
              <View key={category} style={[styles.reportOption, selected ? styles.reportOptionSelected : null]}>
                <Icon color={selected ? colors.leaf : colors.skyDeep} size={24} strokeWidth={2.5} />
                <View style={styles.reportCopy}>
                  <Text style={styles.reportTitle}>{copy.label}</Text>
                  <Text style={styles.reportText}>{copy.description}</Text>
                </View>
                <View style={styles.reportAction}>
                  <ActionButton
                    label={selected ? t("legal.support.saved") : t("legal.support.report")}
                    Icon={selected ? CheckCircle2 : AlertTriangle}
                    size="compact"
                    variant={selected ? "primary" : "secondary"}
                    onPress={() => handleReport(category)}
                  />
                </View>
              </View>
            );
          })}
        </View>
        {generationIssueReport ? (
          <Text style={styles.savedReportText}>
            {t("legal.support.lastReport", { label: generationIssueCopyByCategory[generationIssueReport.category].label })}
          </Text>
        ) : null}
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
  panel: {
    borderRadius: radii.card,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.sm
  },
  panelTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900"
  },
  panelText: {
    color: colors.mutedInk,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700"
  },
  reportList: {
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  reportOption: {
    borderRadius: radii.card,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  reportOptionSelected: {
    backgroundColor: "#F4FFF6",
    borderColor: colors.leaf
  },
  reportCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs
  },
  reportTitle: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "900"
  },
  reportText: {
    color: colors.mutedInk,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700"
  },
  reportAction: {
    width: 112
  },
  faqRow: {
    gap: spacing.xs
  },
  faqQuestion: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "900"
  },
  savedReportText: {
    color: colors.leaf,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "900"
  }
});
