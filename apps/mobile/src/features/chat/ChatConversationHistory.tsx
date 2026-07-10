import { useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ConversationMessage } from "@mongchi/shared";

import { colors, shadows, spacing, useFontFamilies } from "../../shared/design/tokens";
import type { OptimisticChatTurn } from "./chatOptimisticTurn";
import { getChatTypingLabel } from "./chatOptimisticTurn";

interface ChatConversationHistoryProps {
  readonly messages: readonly ConversationMessage[];
  readonly optimisticTurn: OptimisticChatTurn | null;
  readonly petName: string;
  readonly onRetry: (turn: OptimisticChatTurn) => void;
}

export function ChatConversationHistory({
  messages,
  optimisticTurn,
  petName,
  onRetry
}: ChatConversationHistoryProps) {
  const fontFamilies = useFontFamilies();
  const scrollRef = useRef<ScrollView>(null);

  const renderMessage = (message: ConversationMessage) => {
    const isUser = message.sender === "user";
    const isPet = message.sender === "pet_ai";

    return (
      <View
        key={message.id}
        style={[styles.chatBubble, isUser ? styles.userBubble : styles.petBubble, !isUser && !isPet ? styles.systemBubble : null]}
      >
        <Text style={[styles.messageLabel, { fontFamily: fontFamilies.label }, isUser ? styles.userMessageLabel : null]}>
          {isUser ? "You" : isPet ? petName : "Notice"}
        </Text>
        <Text style={[styles.messageText, { fontFamily: fontFamilies.body }]}>{message.text}</Text>
      </View>
    );
  };

  return (
    <ScrollView
      ref={scrollRef}
      accessibilityLabel={`Conversation history with ${petName}`}
      contentContainerStyle={styles.messageStack}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      showsVerticalScrollIndicator
      style={styles.historyViewport}
      onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
    >
      {messages.length === 0 && optimisticTurn === null ? (
        <View style={styles.emptyBubble}>
          <Text style={[styles.emptyText, { fontFamily: fontFamilies.body }]}>Your cozy conversation starts here.</Text>
        </View>
      ) : null}
      {messages.map(renderMessage)}
      {optimisticTurn ? (
        <View style={[styles.chatBubble, styles.userBubble, optimisticTurn.delivery === "failed" ? styles.failedBubble : null]}>
          <Text style={[styles.messageLabel, styles.userMessageLabel, { fontFamily: fontFamilies.label }]}>You</Text>
          <View style={styles.optimisticCopy}>
            <Text style={[styles.messageText, { fontFamily: fontFamilies.body }]}>{optimisticTurn.text}</Text>
            {optimisticTurn.delivery === "failed" ? (
              <View style={styles.retryRow}>
                <Text style={[styles.deliveryText, { fontFamily: fontFamilies.body }]}>Not sent yet.</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Retry sending message"
                  style={({ pressed }) => [styles.retryButton, pressed ? styles.retryButtonPressed : null]}
                  onPress={() => onRetry(optimisticTurn)}
                >
                  <Text style={[styles.retryText, { fontFamily: fontFamilies.label }]}>Retry</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
      {optimisticTurn?.delivery === "sending" ? (
        <View accessibilityLiveRegion="polite" style={styles.typingBubble}>
          <Text style={[styles.typingText, { fontFamily: fontFamilies.body }]}>{getChatTypingLabel(petName)}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  historyViewport: {
    maxHeight: 268
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
