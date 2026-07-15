import { useEffect, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { ConversationMessage } from "@mongchi/shared";

import { colors, shadows, spacing, useFontFamilies } from "../../shared/design/tokens";
import { MongchiIcon } from "../../shared/ui/MongchiIcon";
import type { OptimisticChatTurn } from "./chatOptimisticTurn";

interface ChatConversationHistoryProps {
  readonly messages: readonly ConversationMessage[];
  readonly optimisticTurn: OptimisticChatTurn | null;
  readonly petName: string;
  readonly onRetry: (turn: OptimisticChatTurn) => void;
  readonly reportedMessageIds: readonly string[];
  readonly onReport: (messageId: string) => void;
}

export function ChatConversationHistory({
  messages,
  optimisticTurn,
  petName,
  onRetry,
  reportedMessageIds,
  onReport
}: ChatConversationHistoryProps) {
  const fontFamilies = useFontFamilies();
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  // The very first time this thread has anything to show (the auto-loaded
  // history landing all at once), jump to the latest turn instantly -- an
  // animated scroll here races the screen's own mount/keyboard settle and
  // can look like it silently failed (real-device QA: the viewport stayed
  // at the top after auto-load). Every later arrival (a new sent/received
  // turn) gets a smooth animated scroll instead, which doesn't feel abrupt.
  const hasScrolledToLatestRef = useRef(false);

  const scrollToLatest = () => {
    const animated = hasScrolledToLatestRef.current;

    hasScrolledToLatestRef.current = true;
    scrollRef.current?.scrollToEnd({ animated });
  };

  // Data-driven trigger, independent of onContentSizeChange's layout-callback
  // timing below -- covers the case where content size settles without
  // firing (or before the ref is attached). Keyed on turn count, not the
  // array/turn identity, so this never fires for reasons unrelated to new
  // content (e.g. a keyboard show/hide, which doesn't touch message counts).
  const turnCount = messages.length + (optimisticTurn ? 1 : 0);

  useEffect(() => {
    scrollToLatest();
    // scrollToLatest reads/writes a ref and is stable in spirit (it doesn't
    // depend on props); re-running it only on turnCount changes is
    // intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnCount]);

  const renderMessage = (message: ConversationMessage) => {
    const isUser = message.sender === "user";
    const isPet = message.sender === "pet_ai";
    const reported = reportedMessageIds.includes(message.id);

    return (
      <View
        key={message.id}
        style={[styles.chatBubble, isUser ? styles.userBubble : styles.petBubble, !isUser && !isPet ? styles.systemBubble : null]}
      >
        <Text style={[styles.messageLabel, { fontFamily: fontFamilies.label }, isUser ? styles.userMessageLabel : null]}>
          {isUser ? t("chat.history.user") : isPet ? petName : t("chat.history.notice")}
        </Text>
        <Text style={[styles.messageText, { fontFamily: fontFamilies.body }]}>{message.text}</Text>
        {isPet ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={reported ? t("chat.report.reported") : t("chat.report.button")}
            accessibilityState={{ disabled: reported }}
            disabled={reported}
            hitSlop={8}
            style={[styles.reportButton, reported ? styles.reportButtonDisabled : null]}
            onPress={() => onReport(message.id)}
          >
            <MongchiIcon decorative id="shield-alert" size={18} style={reported ? styles.reportIconDisabled : undefined} />
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <ScrollView
      ref={scrollRef}
      accessibilityLabel={t("chat.history.accessibilityLabel", { petName })}
      contentContainerStyle={styles.messageStack}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      showsVerticalScrollIndicator
      style={styles.historyViewport}
      onContentSizeChange={scrollToLatest}
    >
      {messages.length === 0 && optimisticTurn === null ? (
        <View style={styles.emptyBubble}>
          <Text style={[styles.emptyText, { fontFamily: fontFamilies.body }]}>{t("chat.history.empty")}</Text>
        </View>
      ) : null}
      {messages.map(renderMessage)}
      {optimisticTurn ? (
        <View style={[styles.chatBubble, styles.userBubble, optimisticTurn.delivery === "failed" ? styles.failedBubble : null]}>
          <Text style={[styles.messageLabel, styles.userMessageLabel, { fontFamily: fontFamilies.label }]}>{t("chat.history.user")}</Text>
          <View style={styles.optimisticCopy}>
            <Text style={[styles.messageText, { fontFamily: fontFamilies.body }]}>{optimisticTurn.text}</Text>
            {optimisticTurn.delivery === "failed" ? (
              <View style={styles.retryRow}>
                <Text style={[styles.deliveryText, { fontFamily: fontFamilies.body }]}>{t("chat.history.notSent")}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("chat.history.retryAccessibilityLabel")}
                  style={({ pressed }) => [styles.retryButton, pressed ? styles.retryButtonPressed : null]}
                  onPress={() => onRetry(optimisticTurn)}
                >
                  <Text style={[styles.retryText, { fontFamily: fontFamilies.label }]}>{t("chat.history.retry")}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
      {optimisticTurn?.delivery === "sending" ? (
        <View accessibilityLiveRegion="polite" style={styles.typingBubble}>
          <Text style={[styles.typingText, { fontFamily: fontFamilies.body }]}>{t("chat.history.typing", { petName })}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  historyViewport: {
    flex: 1
  },
  messageStack: {
    gap: spacing.sm,
    paddingVertical: spacing.xs
  },
  chatBubble: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.86)",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadows.tile
  },
  petBubble: {
    alignSelf: "stretch",
    backgroundColor: "rgba(218,240,255,0.92)"
  },
  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "92%",
    backgroundColor: "rgba(255,232,199,0.94)"
  },
  systemBubble: {
    alignSelf: "center",
    backgroundColor: "rgba(255,245,222,0.92)"
  },
  failedBubble: {
    borderColor: colors.coral
  },
  messageLabel: {
    color: colors.skyDeep,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    textTransform: "uppercase",
    flexShrink: 0,
    paddingTop: 3,
    maxWidth: 68
  },
  userMessageLabel: {
    color: colors.woodDark
  },
  messageText: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800"
  },
  reportButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  },
  reportButtonDisabled: {
    opacity: 0.48
  },
  reportIconDisabled: {
    opacity: 0.66
  },
  optimisticCopy: {
    flexShrink: 1,
    gap: spacing.xs
  },
  retryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  deliveryText: {
    color: colors.coral,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800"
  },
  retryButton: {
    minHeight: 32,
    borderRadius: 16,
    backgroundColor: colors.cream,
    justifyContent: "center",
    paddingHorizontal: spacing.md
  },
  retryButtonPressed: {
    transform: [{ translateY: 1 }]
  },
  retryText: {
    color: colors.woodDark,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900"
  },
  typingBubble: {
    alignSelf: "flex-start",
    borderRadius: 16,
    backgroundColor: "rgba(218,240,255,0.92)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.86)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  typingText: {
    color: colors.woodDark,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800"
  },
  emptyBubble: {
    alignSelf: "stretch",
    borderRadius: 16,
    backgroundColor: "rgba(255,245,222,0.82)",
    padding: spacing.md
  },
  emptyText: {
    color: colors.mutedInk,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    textAlign: "center"
  }
});
