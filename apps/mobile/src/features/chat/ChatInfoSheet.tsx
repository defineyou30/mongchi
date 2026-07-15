import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { colors, radii, shadows, spacing, useFontFamilies } from "../../shared/design/tokens";
import { MongchiIcon } from "../../shared/ui/MongchiIcon";

interface ChatInfoSheetProps {
  readonly visible: boolean;
  readonly onDismiss: () => void;
}

/**
 * The chat-focused redesign moves the AI disclosure and billing notices out
 * of an always-visible strip and into this on-demand sheet, reached from the
 * header's info icon -- see ChatGateScreen's disclosure banner for the
 * one-time inline exception app review still requires.
 */
export function ChatInfoSheet({ visible, onDismiss }: ChatInfoSheetProps) {
  const { t } = useTranslation();
  const fontFamilies = useFontFamilies();

  return (
    <Modal animationType="fade" onRequestClose={onDismiss} transparent visible={visible}>
      <View accessibilityLabel={t("chat.info.title")} accessibilityViewIsModal style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={styles.header}>
            <View style={styles.titleIcon}>
              <MongchiIcon decorative id="document" size={22} />
            </View>
            <Text accessibilityRole="header" style={[styles.title, { fontFamily: fontFamilies.title }]}>
              {t("chat.info.title")}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("chat.info.close")}
              hitSlop={10}
              style={styles.closeButton}
              onPress={onDismiss}
            >
              <MongchiIcon decorative id="close" size={22} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { fontFamily: fontFamilies.label }]}>{t("chat.info.aiTitle")}</Text>
              <Text style={[styles.sectionBody, { fontFamily: fontFamilies.body }]}>{t("chat.disclosure")}</Text>
            </View>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { fontFamily: fontFamilies.label }]}>{t("chat.info.billingTitle")}</Text>
              <Text style={[styles.sectionBody, { fontFamily: fontFamilies.body }]}>{t("chat.info.billingBody")}</Text>
            </View>
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("chat.info.close")}
            style={({ pressed }) => [styles.doneButton, pressed ? styles.doneButtonPressed : null]}
            onPress={onDismiss}
          >
            <Text style={[styles.doneButtonText, { fontFamily: fontFamilies.label }]}>{t("chat.info.close")}</Text>
          </Pressable>
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
    maxHeight: "82%",
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
  body: {
    gap: spacing.md
  },
  section: {
    gap: spacing.xs
  },
  sectionTitle: {
    color: colors.woodDark,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  sectionBody: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700"
  },
  doneButton: {
    minHeight: 48,
    borderRadius: radii.control,
    backgroundColor: colors.apple,
    borderWidth: 2,
    borderColor: colors.cream,
    alignItems: "center",
    justifyContent: "center"
  },
  doneButtonPressed: {
    transform: [{ translateY: 1 }]
  },
  doneButtonText: {
    color: colors.white,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900"
  }
});
