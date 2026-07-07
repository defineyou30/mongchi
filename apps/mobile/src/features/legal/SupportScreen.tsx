import { AlertTriangle, ArrowLeft, CheckCircle2, LifeBuoy, Mail, PawPrint, ShieldAlert } from "lucide-react-native";
import { router } from "expo-router";
import { Linking, StyleSheet, Text, View } from "react-native";

import type { GenerationIssueCategory } from "@mongchi/shared";
import { getPublicReleaseConfig } from "../../shared/config/publicReleaseConfig";
import { colors, radii, spacing } from "../../shared/design/tokens";
import { recordMobileEvent } from "../../shared/analytics/mobileAnalytics";
import { ActionButton } from "../../shared/ui/ActionButton";
import { useAppDialog } from "../../shared/ui/AppDialog";
import { BackButton } from "../../shared/ui/BackButton";
import { GardenSceneFrame } from "../appShell/GardenSceneFrame";
import { useTerrariumSession } from "../session/TerrariumSessionProvider";

const generationIssueOptions: Array<{
  category: GenerationIssueCategory;
  label: string;
  description: string;
  Icon: typeof AlertTriangle;
}> = [
  {
    category: "wrong_pet",
    label: "Looks wrong",
    description: "Species, markings, or face feels off.",
    Icon: PawPrint
  },
  {
    category: "unsafe_or_scary",
    label: "Unsafe look",
    description: "Something feels uncomfortable or scary.",
    Icon: ShieldAlert
  },
  {
    category: "poor_quality",
    label: "Blurry result",
    description: "The pet is hard to recognize.",
    Icon: AlertTriangle
  }
];

const generationIssueLabelByCategory: Record<GenerationIssueCategory, string> = {
  wrong_pet: "Looks wrong",
  unsafe_or_scary: "Unsafe look",
  poor_quality: "Blurry result"
};

export function SupportScreen() {
  const releaseConfig = getPublicReleaseConfig();
  const { showDialog } = useAppDialog();
  const { generationIssueReport, reportGenerationIssue } = useTerrariumSession();

  const handleReport = (category: GenerationIssueCategory) => {
    reportGenerationIssue(category);
    recordMobileEvent("generation_issue_reported", { category });
    showDialog({ title: "Report saved", message: "Only the issue category was saved. No raw photo or chat text was attached." });
  };

  return (
    <GardenSceneFrame accessibilityLabel="Support and generation reports">
      <BackButton accessibilityLabel="Back to settings" onPress={() => router.replace("/settings")} />

      <View style={styles.copy}>
        <Text style={styles.eyebrow}>Support</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Help and reports
        </Text>
      </View>

      <View style={styles.panel}>
        <LifeBuoy color={colors.skyDeep} size={28} strokeWidth={2.5} />
        <Text style={styles.panelTitle}>Support contact</Text>
        <Text style={styles.panelText}>
          {releaseConfig.supportEmail ?? "Use the report controls below. Email support opens when an address is available."}
        </Text>
        <ActionButton
          label="Email support"
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
        <Text style={styles.panelTitle}>Report generation issue</Text>
        <Text style={styles.panelText}>
          Issue reports use a safe category and avoid sending raw photos through analytics.
        </Text>
        <View style={styles.reportList}>
          {generationIssueOptions.map(({ category, label, description, Icon }) => {
            const selected = generationIssueReport?.category === category;

            return (
              <View key={category} style={[styles.reportOption, selected ? styles.reportOptionSelected : null]}>
                <Icon color={selected ? colors.leaf : colors.skyDeep} size={24} strokeWidth={2.5} />
                <View style={styles.reportCopy}>
                  <Text style={styles.reportTitle}>{label}</Text>
                  <Text style={styles.reportText}>{description}</Text>
                </View>
                <View style={styles.reportAction}>
                  <ActionButton
                    label={selected ? "Saved" : "Report"}
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
            Last report: {generationIssueLabelByCategory[generationIssueReport.category]}
          </Text>
        ) : null}
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
  savedReportText: {
    color: colors.leaf,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "900"
  }
});
