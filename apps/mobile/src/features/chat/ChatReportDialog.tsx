import { X } from "lucide-react-native";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { colors, radii, shadows, spacing, useFontFamilies } from "../../shared/design/tokens";
import { MongchiIcon } from "../../shared/ui/MongchiIcon";
import type { ChatMessageReportReason } from "../session/supabasePremiumChatSession";

const reportReasons = ["harmful", "inappropriate", "inaccurate", "other"] as const satisfies readonly ChatMessageReportReason[];

interface ChatReportDialogProps {
  readonly visible: boolean;
  readonly submitting: boolean;
  readonly error: boolean;
  readonly onDismiss: () => void;
  readonly onSubmit: (reason: ChatMessageReportReason) => void;
}

export function ChatReportDialog({ visible, submitting, error, onDismiss, onSubmit }: ChatReportDialogProps) {
  const { t } = useTranslation();
  const fontFamilies = useFontFamilies();

  return (
    <Modal animationType="fade" onRequestClose={onDismiss} transparent visible={visible}>
      <View accessibilityLabel={t("chat.report.title")} accessibilityViewIsModal style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={styles.header}>
            <View style={styles.titleIcon}>
              <MongchiIcon decorative id="shield-alert" size={22} />
            </View>
            <Text accessibilityRole="header" style={[styles.title, { fontFamily: fontFamilies.title }]}>
              {t("chat.report.title")}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("chat.report.cancel")}
              disabled={submitting}
              hitSlop={10}
              style={styles.closeButton}
              onPress={onDismiss}
            >
              <X color={colors.woodDark} size={22} strokeWidth={3} />
            </Pressable>
          </View>
          <Text style={[styles.detail, { fontFamily: fontFamilies.body }]}>{t("chat.report.detail")}</Text>
          <View style={styles.reasonList}>
            {reportReasons.map((reason) => (
              <Pressable
                key={reason}
                accessibilityRole="button"
                accessibilityLabel={t(`chat.report.reasons.${reason}`)}
                disabled={submitting}
                style={({ pressed }) => [styles.reasonButton, pressed ? styles.reasonButtonPressed : null]}
                onPress={() => onSubmit(reason)}
              >
                <Text style={[styles.reasonText, { fontFamily: fontFamilies.label }]}>
                  {t(`chat.report.reasons.${reason}`)}
                </Text>
              </Pressable>
            ))}
          </View>
          {submitting ? (
            <Text accessibilityLiveRegion="polite" style={[styles.statusText, { fontFamily: fontFamilies.body }]}>
              {t("chat.report.sending")}
            </Text>
          ) : error ? (
            <Text accessibilityLiveRegion="assertive" style={[styles.errorText, { fontFamily: fontFamilies.body }]}>
              {t("chat.report.error")}
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.overlay,
    padding: spacing.xl
  },
  dialog: {
    width: "100%",
    maxWidth: 420,
    borderRadius: radii.panel,
    borderWidth: 4,
    borderColor: colors.cream,
    backgroundColor: colors.parchment,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.gamePanel
  },
  header: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  titleIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cream
  },
  title: {
    flex: 1,
    color: colors.ink,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "900"
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center"
  },
  detail: {
    color: colors.mutedInk,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800"
  },
  reasonList: {
    gap: spacing.sm
  },
  reasonButton: {
    minHeight: 48,
    borderRadius: radii.control,
    borderWidth: 2,
    borderColor: colors.parchmentDeep,
    backgroundColor: colors.cream,
    justifyContent: "center",
    paddingHorizontal: spacing.lg
  },
  reasonButtonPressed: {
    transform: [{ translateY: 1 }],
    backgroundColor: colors.parchmentDeep
  },
  reasonText: {
    color: colors.woodDark,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900"
  },
  statusText: {
    color: colors.skyDeep,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    textAlign: "center"
  },
  errorText: {
    color: colors.coral,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    textAlign: "center"
  }
});
