import * as Crypto from "expo-crypto";
import { router } from "expo-router";
import { Lock, MessageCircle, Mic, Send } from "lucide-react-native";
import { memo, useMemo, useState } from "react";
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { ImageSourcePropType } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import {
  buildChatCareContext,
  buildChatMemoryContext,
  defaultWeatherContext,
  getCareDaysAway,
  getPremiumChatPaymentPreview,
  getWeatherScenePresentation,
  selectGeneratedAssetForReaction
} from "@mongchi/shared";
import type { ConversationMessage } from "@mongchi/shared";
import { normalizeAppLocale } from "../../localization/localeNormalization";
import { useReducedMotionPreference } from "../../shared/accessibility/useReducedMotionPreference";
import { playSfx } from "../../shared/audio";
import { GeneratedPetAssetImage } from "../../shared/assets/generatedPetAssets";
import { getWeatherBackgroundSource } from "../../shared/assets/weatherSceneAssets";
import { colors, radii, shadows, spacing, useFontFamilies } from "../../shared/design/tokens";
import { reporter } from "../../shared/errors/reporter";
import { BackButton } from "../../shared/ui/BackButton";
import { useTypewriter } from "../../shared/ui/useTypewriter";
import { WeatherSceneLayer } from "../../shared/ui/WeatherSceneLayer";
import { sendApiPremiumChatTurn, startApiPremiumChatThread } from "../session/apiPremiumChatSession";
import { getSupabaseClient } from "../session/supabaseClient";
import { useTerrariumSession } from "../session/TerrariumSessionProvider";
import { ChatConversationHistory } from "./ChatConversationHistory";
import { buildChatLatencySample, shouldReportChatLatency } from "./chatLatencyDiagnostics";
import {
  beginOptimisticChatTurn,
  createChatSendGate,
  failOptimisticChatTurn,
  retryOptimisticChatTurn
} from "./chatOptimisticTurn";
import type { OptimisticChatTurn } from "./chatOptimisticTurn";
import {
  getChatAllowanceChipPresentation,
  getChatConversationStarters,
  getPremiumChatAccessPresentation,
  getShortChatReplyText
} from "./chatGatePresentation";

type ChatStatus = "idle" | "starting" | "ready" | "sending";

const speechBubbleAsset: ImageSourcePropType = require("../../../assets/generated/ui/speech-bubble-v1.png");
const chatTypewriterMsPerChar = 38;

interface PetThoughtBubbleProps {
  petName: string;
  text: string;
  msPerChar: number;
  enabled: boolean;
  bubbleFontFamily: string;
  accessibilityLabel: string;
  accessibilityHint: string;
}

const PetThoughtBubble = memo(function PetThoughtBubble({ text, msPerChar, enabled, bubbleFontFamily, accessibilityLabel, accessibilityHint }: PetThoughtBubbleProps) {
  const petThought = useTypewriter({ text, msPerChar, enabled });

  return (
    <Pressable
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={petThought.isComplete ? undefined : accessibilityHint}
      style={styles.petThoughtPressable}
      onPress={petThought.skip}
    >
      <ImageBackground
        accessibilityElementsHidden
        imageStyle={styles.petThoughtImage}
        resizeMode="stretch"
        source={speechBubbleAsset}
        style={styles.petThought}
      >
        <View style={styles.petThoughtTextBox}>
          <Text numberOfLines={2} style={[styles.petThoughtText, { fontFamily: bubbleFontFamily }]}>
            {petThought.displayedText}
          </Text>
        </View>
      </ImageBackground>
    </Pressable>
  );
});

export function ChatGateScreen() {
  const {
    acceptedAsset,
    acceptedAssets,
    activePet,
    activeWalk,
    careState,
    careStats,
    creditBalance,
    generatedAssetUriById,
    hasPremiumChatEntitlement,
    memories,
    recentReactions,
    satisfactionScore,
    satisfactionSummary,
    syncWallet,
    weatherState,
    wallet
  } = useTerrariumSession();
  // Chat's own "is Mong on a walk" read -- swaps the ticket-less initial
  // greeting to a walk-aware line (see getShortChatReplyText/isOnWalk)
  // instead of a memory/care-status one while the pet is genuinely away.
  const isPetOnWalk = activeWalk?.status === "walking";
  const fontFamilies = useFontFamilies();
  const { i18n, t } = useTranslation();
  const locale = normalizeAppLocale(i18n.resolvedLanguage);
  const [supabaseClient] = useState(() => getSupabaseClient());
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [chatStarted, setChatStarted] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [optimisticTurn, setOptimisticTurn] = useState<OptimisticChatTurn | null>(null);
  const [draft, setDraft] = useState("");
  const [chatStatus, setChatStatus] = useState<ChatStatus>("idle");
  const [chatError, setChatError] = useState<string | null>(null);
  const [quickTalkStartedAtMs] = useState<number | null>(null);
  // Fixed once per mount rather than recomputed every render: the greeting
  // copy it feeds is only time-sensitive at day granularity, so freezing it
  // avoids re-deriving the whole chat presentation (and re-rendering the
  // typewriter's parent tree) on every unrelated state change.
  const [replyNow] = useState(() => new Date().toISOString());
  const [sendGate] = useState(createChatSendGate);

  const chatPayment = getPremiumChatPaymentPreview(wallet, hasPremiumChatEntitlement);
  const premiumChatAccess = getPremiumChatAccessPresentation({
    petName: activePet.name,
    apiReady: supabaseClient != null,
    payment: chatPayment,
    hasPremiumChatEntitlement,
    freeChatTickets: wallet.freeChatTickets,
    creditBalance,
    locale
  });
  const premiumChatReady = premiumChatAccess.ready;
  const allowanceChip = getChatAllowanceChipPresentation({
    hasPremiumChatEntitlement,
    freeChatTickets: wallet.freeChatTickets,
    creditBalance,
    locale
  });
  const trimmedDraft = draft.trim();
  const chatPetAsset = selectGeneratedAssetForReaction(acceptedAssets, acceptedAsset, "chat_portrait");
  const petAssetId = chatPetAsset?.id ?? activePet.activeAssetId ?? null;
  const petAssetUri = petAssetId ? generatedAssetUriById[petAssetId] ?? null : null;
  const activeWeather = weatherState.settings.enabled ? weatherState.context : defaultWeatherContext;
  const weatherScene = useMemo(() => getWeatherScenePresentation("chat", activeWeather, locale), [activeWeather, locale]);
  const careDaysAway = useMemo(() => getCareDaysAway(careState, replyNow), [careState, replyNow]);
  const shortReplyText = useMemo(
    () =>
      getShortChatReplyText({
        petName: activePet.name,
        quickTalkStartedAtMs,
        recentReactions,
        satisfactionSummary,
        careState,
        weather: activeWeather,
        now: replyNow,
        daysAway: careDaysAway,
        memories,
        careStats,
        isOnWalk: isPetOnWalk,
        locale
      }),
    [
      activePet.name,
      quickTalkStartedAtMs,
      recentReactions,
      satisfactionSummary,
      careState,
      activeWeather,
      replyNow,
      careDaysAway,
      memories,
      careStats,
      isPetOnWalk,
      locale
    ]
  );
  const reduceMotionEnabled = useReducedMotionPreference();
  const conversationStarters = useMemo(
    () =>
      getChatConversationStarters({
        petName: activePet.name,
        careState,
        weather: activeWeather,
        now: replyNow,
        daysAway: careDaysAway,
        locale
      }),
    [activePet.name, careState, activeWeather, replyNow, careDaysAway, locale]
  );
  const showConversationStarters = premiumChatReady && chatStarted && optimisticTurn === null && !trimmedDraft && chatStatus !== "sending";

  const handleStartPremiumChat = async () => {
    if (!premiumChatReady || !supabaseClient) {
      return;
    }

    setChatStatus("starting");
    setChatError(null);

    const started = await startApiPremiumChatThread(supabaseClient, activePet.id, locale);

    if (!started.ok) {
      setChatError(started.error.messageSafe);
      setChatStatus("idle");
      return;
    }

    setChatStarted(true);
    setConversationId(started.thread.conversationId);
    setMessages(started.thread.messages);
    setChatStatus("ready");
  };

  const sendPremiumMessage = async (retryTurn?: OptimisticChatTurn) => {
    const text = retryTurn?.text ?? trimmedDraft;

    if (!premiumChatReady || !supabaseClient || !chatStarted || !text || !sendGate.tryAcquire()) {
      return;
    }

    const pressedAtMs = Date.now();
    const nextTurn = retryTurn
      ? retryOptimisticChatTurn(retryTurn)
      : beginOptimisticChatTurn({ requestId: Crypto.randomUUID(), draft: text, now: new Date().toISOString() });

    playSfx("sfx_tap");
    setDraft("");
    setOptimisticTurn(nextTurn);
    setChatStatus("sending");
    setChatError(null);
    const optimisticAtMs = Date.now();

    try {
      const sent = await sendApiPremiumChatTurn(
        supabaseClient,
        {
          context: {
            petId: activePet.id,
            petProfile: activePet,
            wallet,
            hasPremiumChatEntitlement,
            locale,
            memoryContext: buildChatMemoryContext({ memories, careStats }),
            careContext: buildChatCareContext(careState, careDaysAway)
          },
          currentThread: { conversationId, messages },
          text: nextTurn.text,
          requestId: nextTurn.requestId
        }
      );
      const latency = buildChatLatencySample({ pressedAtMs, optimisticAtMs, completedAtMs: Date.now() });

      if (!sent.ok) {
        reporter.captureMessage("chat: turn timing", { ...latency, outcome: "failed" });
        setOptimisticTurn(failOptimisticChatTurn(nextTurn));
        setChatError(sent.error.messageSafe);
        setChatStatus("ready");
        return;
      }

      if (shouldReportChatLatency(latency)) {
        reporter.captureMessage("chat: slow turn timing", { ...latency, outcome: "success" });
      }
      syncWallet(sent.wallet);
      setConversationId(sent.thread.conversationId);
      setMessages(sent.thread.messages);
      setOptimisticTurn(null);
      setChatStatus("ready");
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error("Unexpected chat send failure");
      const latency = buildChatLatencySample({ pressedAtMs, optimisticAtMs, completedAtMs: Date.now() });
      reporter.captureError(error, { surface: "chat_send", ...latency });
      setOptimisticTurn(failOptimisticChatTurn(nextTurn));
      setChatError(t("chat.networkError"));
      setChatStatus("ready");
    } finally {
      sendGate.release();
    }
  };

  return (
    <View style={styles.chatRoot}>
      <ImageBackground accessibilityElementsHidden resizeMode="cover" source={getWeatherBackgroundSource(weatherScene.backgroundKey)} style={styles.chatBackground}>
        <View style={styles.chatSceneWash} />
        <WeatherSceneLayer overlayKey={weatherScene.overlayKey} />
      </ImageBackground>

      <SafeAreaView accessibilityLabel={`${t("chat.screenAccessibilityLabel", { petName: activePet.name })}. ${weatherScene.accessibilityLabel}`} edges={["top", "left", "right"]} style={styles.chatSafe}>
        <Text accessibilityRole="header" style={[styles.screenReaderTitle, { fontFamily: fontFamilies.title }]}>
          {t("chat.screenReaderTitle", { petName: activePet.name })}
        </Text>
        <ScrollView bounces={false} contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
          <View style={styles.sceneTopBar}>
            <BackButton accessibilityLabel={t("chat.back")} style={styles.backButton} onPress={() => router.replace("/terrarium")} />
            <View accessible accessibilityLabel={allowanceChip.accessibilityLabel} style={styles.allowanceChip}>
              <Text numberOfLines={1} style={[styles.allowanceChipText, { fontFamily: fontFamilies.label }]}>
                {allowanceChip.label}
              </Text>
            </View>
          </View>

          <View style={styles.chatStage}>
            <View pointerEvents="none" style={styles.petStage}>
              <View style={styles.petGroundShadow} />
              <GeneratedPetAssetImage
                accessibilityLabel={t("chat.petAccessibilityLabel")}
                assetId={petAssetId ?? null}
                decorative
                remoteUri={petAssetUri ?? null}
                style={styles.petSprite}
              />
            </View>

            <PetThoughtBubble
              petName={activePet.name}
              text={shortReplyText}
              msPerChar={chatTypewriterMsPerChar}
              enabled={!reduceMotionEnabled}
              bubbleFontFamily={fontFamilies.bubble}
              accessibilityLabel={t("chat.petSays", { petName: activePet.name, text: shortReplyText })}
              accessibilityHint={t("chat.finishMessageHint")}
            />

            <View style={styles.chatTray}>
              {chatStarted ? (
                <ChatConversationHistory
                  messages={messages}
                  optimisticTurn={optimisticTurn}
                  petName={activePet.name}
                  onRetry={(turn) => void sendPremiumMessage(turn)}
                />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={premiumChatAccess.isLocked ? `${premiumChatAccess.ctaLabel}. ${premiumChatAccess.accessibilityLabel}` : premiumChatAccess.accessibilityLabel}
                  accessibilityState={{ disabled: chatStatus === "starting" }}
                  disabled={chatStatus === "starting"}
                  style={[styles.premiumGate, chatStatus === "starting" ? styles.disabledBubble : null]}
                  onPress={premiumChatReady ? () => void handleStartPremiumChat() : () => router.push("/shop")}
                >
                  <View style={styles.premiumGateIcon}>
                    {premiumChatAccess.isLocked ? (
                      <Lock color={colors.woodDark} size={20} strokeWidth={3} />
                    ) : (
                      <MessageCircle color={colors.woodDark} size={20} strokeWidth={3} />
                    )}
                  </View>
                  <View style={styles.bubbleCopy}>
                    <Text style={[styles.lockedTitle, { fontFamily: fontFamilies.title }]}>{premiumChatAccess.title}</Text>
                    <Text numberOfLines={2} style={[styles.lockedText, { fontFamily: fontFamilies.body }]}>
                      {premiumChatReady && chatStatus === "starting" ? t("chat.opening") : premiumChatAccess.detail}
                    </Text>
                  </View>
                </Pressable>
                )}

              {chatError ? (
                <View style={styles.errorBubble}>
                  <Text style={[styles.errorText, { fontFamily: fontFamilies.body }]}>{chatError}</Text>
                </View>
              ) : null}

              {showConversationStarters ? (
                <View accessibilityLabel={t("chat.startersAccessibilityLabel")} style={styles.starterRow}>
                  {conversationStarters.map((starter) => (
                    <Pressable
                      key={starter}
                      accessibilityRole="button"
                      accessibilityLabel={t("chat.starterAccessibilityLabel", { starter })}
                      style={({ pressed }) => [styles.starterChip, pressed ? styles.starterChipPressed : null]}
                      onPress={() => setDraft(starter)}
                    >
                      <Text numberOfLines={1} style={[styles.starterChipText, { fontFamily: fontFamilies.body }]}>
                        {starter}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              <View style={styles.inputBar}>
                <View style={styles.micButton}>
                  <Mic color={colors.white} size={22} strokeWidth={2.8} />
                </View>
                <TextInput
                  accessibilityLabel={t("chat.inputAccessibilityLabel")}
                  editable={premiumChatReady && chatStarted && chatStatus !== "sending"}
                  value={draft}
                  placeholder={premiumChatReady && chatStarted ? t("chat.inputPlaceholder", { petName: activePet.name }) : premiumChatAccess.inputPlaceholder}
                  placeholderTextColor={colors.mutedInk}
                  maxLength={240}
                  style={[styles.chatInput, { fontFamily: fontFamilies.body }]}
                  onChangeText={setDraft}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={chatStarted ? t("chat.sendAccessibilityLabel") : premiumChatAccess.ctaLabel}
                  accessibilityState={{ disabled: chatStarted ? chatStatus === "sending" || optimisticTurn !== null || !trimmedDraft : chatStatus === "starting" }}
                  disabled={chatStarted ? chatStatus === "sending" || optimisticTurn !== null || !trimmedDraft : chatStatus === "starting"}
                  style={({ pressed }) => [
                    styles.sendButton,
                    pressed ? styles.sendButtonPressed : null,
                    chatStarted ? (trimmedDraft && optimisticTurn === null ? null : styles.sendButtonDisabled) : null
                  ]}
                  onPress={chatStarted ? () => void sendPremiumMessage() : premiumChatReady ? () => void handleStartPremiumChat() : () => router.push("/shop")}
                >
                  <Send color={colors.white} size={22} strokeWidth={3} />
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.disclosureStrip}>
            <MessageCircle color={colors.skyDeep} size={14} strokeWidth={2.5} />
            <Text style={[styles.disclosureText, { fontFamily: fontFamilies.body }]}>{t("chat.disclosure")}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  starterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 4
  },
  starterChip: {
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.86)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 11,
    paddingVertical: 6,
    maxWidth: "100%"
  },
  starterChipPressed: {
    backgroundColor: "rgba(255,245,222,0.96)"
  },
  starterChipText: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700"
  },
  chatRoot: {
    flex: 1,
    backgroundColor: colors.skySoft
  },
  chatBackground: {
    position: "absolute",
    top: -96,
    right: 0,
    bottom: -96,
    left: 0
  },
  chatSceneWash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(255,245,222,0.08)"
  },
  chatSafe: {
    flex: 1
  },
  screenReaderTitle: {
    position: "absolute",
    left: -1000,
    top: 0,
    width: 1,
    height: 1,
    opacity: 0
  },
  screenContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    // Single top-of-content gap below the safe area (~8-12pt target,
    // matching the rest of the app's screens post-audit) -- sceneTopBar/
    // backButton below carry no additional top margin.
    paddingTop: spacing.sm,
    paddingBottom: spacing.md
  },
  chatStage: {
    minHeight: 676,
    position: "relative",
    justifyContent: "flex-end",
    overflow: "visible"
  },
  sceneDoghouse: {
    position: "absolute",
    left: 18,
    top: 278,
    zIndex: 4,
    width: 76,
    height: 76
  },
  sceneToyBall: {
    position: "absolute",
    right: 54,
    top: 358,
    zIndex: 5,
    width: 48,
    height: 48,
    transform: [{ rotate: "-8deg" }]
  },
  petStage: {
    position: "absolute",
    top: 98,
    alignSelf: "center",
    zIndex: 8,
    width: 176,
    height: 180,
    alignItems: "center",
    justifyContent: "flex-end"
  },
  petGroundShadow: {
    position: "absolute",
    bottom: 12,
    width: 104,
    height: 22,
    borderRadius: 999,
    backgroundColor: "rgba(58,70,43,0.2)",
    transform: [{ scaleX: 1.25 }]
  },
  petSprite: {
    width: 164,
    height: 164
  },
  sceneTopBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 52,
    marginBottom: 2,
    zIndex: 30
  },
  backButton: {
    zIndex: 10
  },
  allowanceChip: {
    minHeight: 36,
    maxWidth: 168,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.cream,
    backgroundColor: "rgba(255,232,199,0.94)",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    ...shadows.tile
  },
  allowanceChipText: {
    color: colors.woodDark,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900"
  },
  petThoughtPressable: {
    position: "absolute",
    top: 40,
    alignSelf: "center",
    zIndex: 15,
    width: 360,
    height: 92
  },
  petThought: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible"
  },
  petThoughtImage: {
    width: "100%",
    height: "100%"
  },
  petThoughtTextBox: {
    position: "absolute",
    top: 16,
    right: 36,
    left: 36,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center"
  },
  petThoughtText: {
    width: "100%",
    color: colors.ink,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    textAlign: "center",
    flexShrink: 1,
    textShadowColor: "rgba(255,255,255,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0
  },
  chatTray: {
    zIndex: 18,
    gap: spacing.sm,
    paddingTop: 0,
    paddingBottom: spacing.sm
  },
  premiumGate: {
    minHeight: 70,
    borderRadius: 22,
    borderWidth: 3,
    borderBottomWidth: 6,
    borderColor: colors.cream,
    backgroundColor: "rgba(255,232,199,0.94)",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadows.tile
  },
  premiumGateIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center"
  },
  disabledBubble: {
    opacity: 0.68
  },
  bubbleCopy: {
    flex: 1,
    minWidth: 0
  },
  lockedTitle: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "900"
  },
  lockedText: {
    color: colors.woodDark,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800"
  },
  errorBubble: {
    borderRadius: 16,
    backgroundColor: "rgba(255,127,123,0.18)",
    borderWidth: 2,
    borderColor: colors.coral,
    padding: spacing.sm
  },
  errorText: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800"
  },
  inputBar: {
    minHeight: 58,
    borderRadius: 22,
    backgroundColor: "rgba(255,245,222,0.94)",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.86)",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    ...shadows.gamePanel
  },
  micButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(122,110,102,0.72)",
    alignItems: "center",
    justifyContent: "center"
  },
  chatInput: {
    flex: 1,
    minHeight: 38,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.62)",
    borderWidth: 2,
    borderColor: "rgba(128,81,46,0.12)",
    color: colors.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "800",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.apple,
    borderWidth: 3,
    borderColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.button
  },
  sendButtonPressed: {
    transform: [{ translateY: 2 }]
  },
  sendButtonDisabled: {
    opacity: 0.62
  },
  disclosureStrip: {
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,245,222,0.74)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.72)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm
  },
  disclosureText: {
    flex: 1,
    color: colors.mutedInk,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800"
  }
});
