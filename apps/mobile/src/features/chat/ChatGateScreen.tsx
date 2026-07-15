import * as Crypto from "expo-crypto";
import { router } from "expo-router";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Animated, ActivityIndicator, Easing, ImageBackground, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
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
  isNightTime,
  selectGeneratedAssetForReaction,
  settlementMissionRewardKeys
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
import { MongchiIcon } from "../../shared/ui/MongchiIcon";
import { useTypewriter } from "../../shared/ui/useTypewriter";
import { WeatherSceneLayer } from "../../shared/ui/WeatherSceneLayer";
import { purchaseApiChatDayPass, sendApiPremiumChatTurn, startApiPremiumChatThread } from "../session/apiPremiumChatSession";
import { hasQueuedRewardLocally, markRewardQueuedLocally } from "../rewards/rewardClaimLocalFlags";
import { loadSupabaseChatAllowance, reportSupabaseChatMessage } from "../session/supabasePremiumChatSession";
import type { ChatMessageReportReason } from "../session/supabasePremiumChatSession";
import { getSupabaseClient } from "../session/supabaseClient";
import { useTerrariumSession } from "../session/TerrariumSessionProvider";
import { ChatConversationHistory } from "./ChatConversationHistory";
import { hasSeenChatDisclosureBanner, markChatDisclosureBannerSeen } from "./chatDisclosureBannerStorage";
import { ChatInfoSheet } from "./ChatInfoSheet";
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
  getChatDayPassOfferPresentation,
  getPremiumChatAccessPresentation,
  getShortChatReplyText,
  shouldShowChatAmbientBubble,
  shouldShowChatConversationStarters,
  shouldShowChatDisclosureBanner
} from "./chatGatePresentation";
import { isLiveChatEnabled } from "./liveChatAvailability";
import { ChatReportDialog } from "./ChatReportDialog";

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
    enqueueCreditRewardClaim,
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
  const [reportMessageId, setReportMessageId] = useState<string | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportFailed, setReportFailed] = useState(false);
  const [reportedMessageIds, setReportedMessageIds] = useState<readonly string[]>([]);
  const [reportNotice, setReportNotice] = useState<string | null>(null);
  const [quickTalkStartedAtMs] = useState<number | null>(null);
  // Gates the one-time inline AI-disclosure banner (see
  // shouldShowChatDisclosureBanner) -- starts unhydrated so the banner never
  // flashes on for a returning device before the persisted flag loads.
  const [disclosureBannerHydrated, setDisclosureBannerHydrated] = useState(false);
  const [disclosureBannerSeen, setDisclosureBannerSeen] = useState(false);
  const [infoSheetVisible, setInfoSheetVisible] = useState(false);
  // Fixed once per mount rather than recomputed every render: the greeting
  // copy it feeds is only time-sensitive at day granularity, so freezing it
  // avoids re-deriving the whole chat presentation (and re-rendering the
  // typewriter's parent tree) on every unrelated state change.
  const [replyNow] = useState(() => new Date().toISOString());
  const [sendGate] = useState(createChatSendGate);
  const [liveChatEnabled] = useState(isLiveChatEnabled);
  // Local-only day-pass state (Chat Live BM decision: "chatty day pass").
  // There is no "is my pass still active" read endpoint, so this is set
  // from two authoritative moments only: a successful purchase response, and
  // any chat-turn response whose chargeKind reveals whether a pass covered
  // (or stopped covering) that turn -- see sendPremiumMessage below.
  const [dayPassActive, setDayPassActive] = useState(false);
  const [dayPassExpiresAt, setDayPassExpiresAt] = useState<string | null>(null);
  const [dayPassPurchasing, setDayPassPurchasing] = useState(false);
  const [dayPassError, setDayPassError] = useState<string | null>(null);
  // One id per purchase attempt, reused across retries of that same attempt
  // (idempotent), then cleared on success so a future purchase (after the
  // next pass expires) mints a fresh one -- same principle as
  // supabaseGenerationSession's request_id handling.
  const dayPassRequestIdRef = useRef<string | null>(null);
  // dayPassActive alone can go stale if this screen stays mounted past the
  // pass's 24h window (there is no "is my pass still active" read endpoint
  // to refresh it from) -- when an expiry is known, this recomputes on every
  // render instead. Only ever narrows dayPassActive toward false; the server
  // remains the real authority regardless (chat-turn simply stops returning
  // chargeKind "day_pass" once its own window lapses).
  const dayPassStillActive = dayPassActive && (dayPassExpiresAt === null || new Date(dayPassExpiresAt).getTime() > Date.now());
  // Guards the one-time chat_access hydration below against StrictMode's
  // double-invoke and any re-render before the request resolves.
  const allowanceHydratedRef = useRef(false);
  // Once a real chat-turn response has corrected wallet.freeChatTickets
  // (sendPremiumMessage's syncWallet(sent.wallet) call below), the slower
  // chat_access read below must never overwrite it with a now-stale snapshot
  // taken before that turn was charged.
  const allowanceTurnCorrectedRef = useRef(false);
  // Guards the mount auto-load effect against StrictMode's double-invoke --
  // see that effect's doc comment below.
  const autoLoadTriggeredRef = useRef(false);
  // Settlement mission: the owner's first-ever visit to this free "hello"
  // chat screen (+1 credit, settle_first_chat_hello -- see
  // docs/game-economy-bm-proposal.md's 2026-07-15 faucet budget). Chat's own
  // files are otherwise off-limits this wave (another workstream is mid-edit
  // here), so this is deliberately the only hook added to this screen --
  // rewardClaimLocalFlags owns the cross-session "don't re-offer" guard so a
  // returning visit here never re-queues the claim card.
  const firstChatHelloRewardQueuedRef = useRef(false);

  useEffect(() => {
    if (firstChatHelloRewardQueuedRef.current) {
      return;
    }

    firstChatHelloRewardQueuedRef.current = true;

    void hasQueuedRewardLocally(settlementMissionRewardKeys.firstChatHello).then((alreadyQueued) => {
      if (alreadyQueued) {
        return;
      }

      enqueueCreditRewardClaim(settlementMissionRewardKeys.firstChatHello, "settlement");
      void markRewardQueuedLocally(settlementMissionRewardKeys.firstChatHello);
    });
  }, [enqueueCreditRewardClaim]);

  // Hydrates the free-chat chip/pip AND an already-active day pass from
  // server truth (chat_access, via RLS select-own) the moment this screen
  // mounts, instead of leaving them on whatever local wallet.freeChatTickets/
  // dayPassActive defaults the session started with -- see
  // loadSupabaseChatAllowance's doc comment for the starter + daily allowance
  // math this mirrors, and for why it now also returns day_pass_expires_at
  // (real-device QA: a user with an active pass saw the credit-balance chip
  // instead of "Day Pass active" after an app restart, because this read
  // previously only checked starter/daily columns). Once any real chat-turn
  // response arrives, that response's freeTurnsRemaining/chargeKind is the
  // freshest truth and this effect must no longer clobber either piece of
  // state (see allowanceTurnCorrectedRef above) -- a lapsed
  // day_pass_expires_at (in the past) is simply ignored, leaving
  // dayPassActive at its default false rather than reviving a dead pass.
  useEffect(() => {
    if (!supabaseClient || allowanceHydratedRef.current) {
      return;
    }

    allowanceHydratedRef.current = true;

    void loadSupabaseChatAllowance(supabaseClient).then((outcome) => {
      if (!outcome.ok || allowanceTurnCorrectedRef.current) {
        return;
      }

      syncWallet({
        ...wallet,
        freeChatTickets: outcome.allowance.freeChatTurnsRemaining,
        updatedAt: new Date().toISOString()
      });

      const { dayPassExpiresAt } = outcome.allowance;

      if (dayPassExpiresAt && new Date(dayPassExpiresAt).getTime() > Date.now()) {
        setDayPassActive(true);
        setDayPassExpiresAt(dayPassExpiresAt);
      }
    });
    // One-time mount hydration (guarded by allowanceHydratedRef above);
    // wallet/syncWallet are intentionally read from the closure captured at
    // mount rather than re-running this effect on every wallet change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseClient]);

  // One-time mount hydration for the inline AI-disclosure banner's persisted
  // seen-flag -- see shouldShowChatDisclosureBanner's doc comment for why the
  // banner stays hidden until this resolves.
  useEffect(() => {
    let cancelled = false;

    void hasSeenChatDisclosureBanner().then((seen) => {
      if (cancelled) {
        return;
      }

      setDisclosureBannerSeen(seen);
      setDisclosureBannerHydrated(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

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
  const premiumChatReady = liveChatEnabled && supabaseClient != null;
  const allowanceChip = getChatAllowanceChipPresentation({
    hasPremiumChatEntitlement,
    dayPassActive: dayPassStillActive,
    freeChatTickets: wallet.freeChatTickets,
    creditBalance,
    locale
  });
  const dayPassOffer = getChatDayPassOfferPresentation({
    petName: activePet.name,
    hasPremiumChatEntitlement,
    dayPassActive: dayPassStillActive,
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
  // Night-entry crossfade: the header thumbnail briefly shows the pet's sleep
  // pose before settling into its normal chat portrait, like just being
  // woken up ("밤 시간대 채팅 자다 깬 톤" world-flavor) -- purely cosmetic, never
  // blocks or changes what chat can do. isNight is derived from replyNow,
  // itself frozen once per mount (see replyNow's own doc comment above), so
  // this plays exactly once per screen visit rather than flip-flopping.
  const isNight = useMemo(() => isNightTime(replyNow), [replyNow]);
  const nightSleepAssetId = useMemo(
    () => (isNight ? selectGeneratedAssetForReaction(acceptedAssets, acceptedAsset, "sleep")?.id ?? null : null),
    [isNight, acceptedAssets, acceptedAsset]
  );
  const nightSleepAssetUri = nightSleepAssetId ? generatedAssetUriById[nightSleepAssetId] ?? null : null;
  // Skipped entirely under reduced motion -- the header just opens straight
  // on the normal chat portrait, matching this screen's existing
  // reduceMotionEnabled gate on the typewriter greeting below.
  const [showingNightWake, setShowingNightWake] = useState(() => isNight && !reduceMotionEnabled);
  const nightWakeOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!showingNightWake) {
      return;
    }

    const holdTimer = setTimeout(() => {
      Animated.timing(nightWakeOpacity, {
        toValue: 0,
        duration: 700,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      }).start(() => setShowingNightWake(false));
    }, 900);

    return () => clearTimeout(holdTimer);
    // One-shot on mount -- showingNightWake only ever starts true and settles
    // to false once, so this intentionally never re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
  const showConversationStarters = shouldShowChatConversationStarters({
    premiumChatReady,
    chatStarted,
    messageCount: messages.length,
    hasOptimisticTurn: optimisticTurn !== null,
    hasDraftText: Boolean(trimmedDraft),
    isSending: chatStatus === "sending"
  });
  const showAmbientBubble = shouldShowChatAmbientBubble({
    chatStarted,
    messageCount: messages.length,
    hasOptimisticTurn: optimisticTurn !== null
  });
  const showDisclosureBanner = shouldShowChatDisclosureBanner({
    hasHydratedSeenFlag: disclosureBannerHydrated,
    hasSeenDisclosureBanner: disclosureBannerSeen
  });

  const handleDismissDisclosureBanner = () => {
    setDisclosureBannerSeen(true);
    void markChatDisclosureBannerSeen();
  };

  const handleStartPremiumChat = async () => {
    // Guards against duplicate concurrent loads now that this is reachable
    // from three places: the mount auto-load effect below, the retry card
    // (on a failed load), and the send button's pre-thread fallback.
    if (!premiumChatReady || !supabaseClient || chatStarted || chatStatus === "starting") {
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

  // Auto-continues the conversation the moment the screen is usable, instead
  // of requiring a tap on a "start chatting" gate card first -- real-device
  // QA found users didn't realize the old gate card was tappable.
  // startApiPremiumChatThread -> loadSupabasePremiumChatThread is an RLS
  // select-own read (see that function's doc comment); nothing is charged by
  // loading history. premiumChatReady is derived from liveChatEnabled/
  // supabaseClient, both fixed at mount, so this fires at most once per
  // screen lifetime -- the ref guard exists only against StrictMode's
  // double-invoke, not because premiumChatReady is expected to change later.
  useEffect(() => {
    if (!premiumChatReady || autoLoadTriggeredRef.current) {
      return;
    }

    autoLoadTriggeredRef.current = true;
    void handleStartPremiumChat();
    // handleStartPremiumChat is intentionally omitted -- it's redefined every
    // render but its guarded body only ever needs to run once here, gated by
    // autoLoadTriggeredRef above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [premiumChatReady]);

  const handlePurchaseDayPass = async () => {
    if (!supabaseClient || dayPassPurchasing) {
      return;
    }

    if (!dayPassRequestIdRef.current) {
      dayPassRequestIdRef.current = Crypto.randomUUID();
    }

    setDayPassPurchasing(true);
    setDayPassError(null);

    const result = await purchaseApiChatDayPass(supabaseClient, { wallet, locale }, dayPassRequestIdRef.current);

    if (!result.ok) {
      setDayPassError(result.error.messageSafe);
      setDayPassPurchasing(false);
      return;
    }

    // Success (fresh purchase or a confirmed already-active pass) frees the
    // request id for a future purchase attempt, once this pass eventually
    // expires.
    dayPassRequestIdRef.current = null;
    syncWallet(result.wallet);
    setDayPassExpiresAt(result.dayPassExpiresAt);
    setDayPassActive(true);
    setDayPassPurchasing(false);
    playSfx("sfx_purchase");
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
            careContext: buildChatCareContext(careState, careDaysAway, replyNow)
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
        // The day-pass offer card below already covers "free turns are gone"
        // with its own warm, actionable copy once freeChatTickets reads 0 --
        // showing the generic red error bubble on top of it would just be
        // the same news twice.
        if (sent.error.code !== "insufficient_credits") {
          setChatError(sent.error.messageSafe);
        }
        setChatStatus("ready");
        return;
      }

      if (shouldReportChatLatency(latency)) {
        reporter.captureMessage("chat: slow turn timing", { ...latency, outcome: "success" });
      }
      // A real chat-turn response is always fresher than the chat_access
      // hydration effect above -- once one lands, that effect must stop
      // overwriting freeChatTickets with its own (now possibly stale) read.
      allowanceTurnCorrectedRef.current = true;
      syncWallet(sent.wallet);
      setConversationId(sent.thread.conversationId);
      setMessages(sent.thread.messages);
      setOptimisticTurn(null);
      setChatStatus("ready");
      // Keeps the local day-pass flag honest against the server's actual
      // settlement for this turn -- "day_pass" confirms a pass is covering
      // turns (even if this screen never saw the purchase, e.g. bought last
      // night); any other paid/free kind other than "plus"/"crisis" means no
      // pass is active (either it never was, or it just lapsed).
      if (sent.chargeKind === "day_pass") {
        setDayPassActive(true);
      } else if (sent.chargeKind !== "plus" && sent.chargeKind !== "crisis") {
        setDayPassActive(false);
        setDayPassExpiresAt(null);
      }
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

  const submitMessageReport = async (reason: ChatMessageReportReason) => {
    if (!supabaseClient || !reportMessageId || reportSubmitting) {
      return;
    }

    setReportSubmitting(true);
    setReportFailed(false);
    const result = await reportSupabaseChatMessage(supabaseClient, reportMessageId, reason);

    if (!result.ok) {
      setReportFailed(true);
      setReportSubmitting(false);
      return;
    }

    setReportedMessageIds((current) => [...current, reportMessageId]);
    setReportMessageId(null);
    setReportSubmitting(false);
    setReportNotice(t("chat.report.success"));
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

        {/* Compact header: back, small pet identity, allowance chip, info trigger --
            replaces the old hero-sprite layout so the thread below can take most of
            the screen (see DESIGN brief: "conversation-focused UI"). */}
        <View style={styles.headerBlock}>
          <View style={styles.headerRow}>
            <BackButton accessibilityLabel={t("chat.back")} onPress={() => router.replace("/terrarium")} />
            <View style={styles.headerIdentity}>
              <View style={styles.headerPetThumbWrap}>
                <GeneratedPetAssetImage
                  accessibilityLabel={t("chat.petAccessibilityLabel")}
                  assetId={petAssetId ?? null}
                  decorative
                  remoteUri={petAssetUri ?? null}
                  style={styles.headerPetThumb}
                />
                {/* Night-entry crossfade: a brief sleep-pose overlay that fades
                    out to reveal the normal chat portrait beneath it, like the
                    pet just woke up (see showingNightWake's doc comment above). */}
                {showingNightWake ? (
                  <Animated.View style={[styles.headerPetThumbOverlay, { opacity: nightWakeOpacity }]}>
                    <GeneratedPetAssetImage
                      accessibilityLabel={t("chat.petAccessibilityLabel")}
                      assetId={nightSleepAssetId}
                      decorative
                      remoteUri={nightSleepAssetUri}
                      style={styles.headerPetThumb}
                    />
                  </Animated.View>
                ) : null}
              </View>
              <Text numberOfLines={1} style={[styles.headerPetName, { fontFamily: fontFamilies.title }]}>
                {activePet.name}
              </Text>
            </View>
            <View accessible accessibilityLabel={allowanceChip.accessibilityLabel} style={styles.allowanceChip}>
              <Text numberOfLines={1} style={[styles.allowanceChipText, { fontFamily: fontFamilies.label }]}>
                {allowanceChip.label}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("chat.info.button")}
              hitSlop={8}
              style={styles.infoButton}
              onPress={() => setInfoSheetVisible(true)}
            >
              <MongchiIcon decorative id="document" size={20} />
            </Pressable>
          </View>

          {/* First-open-only exception to the info-sheet move -- app review
              (and the app's own P15 commitment) requires the AI disclosure to
              surface inline at least once, not only behind the info icon. See
              shouldShowChatDisclosureBanner. */}
          {showDisclosureBanner ? (
            <View style={styles.disclosureBanner}>
              <MongchiIcon decorative id="chat" size={18} style={styles.disclosureBannerIcon} />
              <Text style={[styles.disclosureBannerText, { fontFamily: fontFamilies.body }]}>{t("chat.disclosure")}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("chat.disclosureBanner.dismissAccessibilityLabel")}
                hitSlop={8}
                style={styles.disclosureBannerDismiss}
                onPress={handleDismissDisclosureBanner}
              >
                <MongchiIcon decorative id="close" size={16} />
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* The conversation thread now owns most of the screen -- everything
            below is fixed height (header above, footer/input below) so this
            flex region is the one that grows and scrolls. */}
        <View style={styles.threadArea}>
          {showAmbientBubble ? (
            <View style={styles.ambientBubbleRow}>
              <PetThoughtBubble
                petName={activePet.name}
                text={shortReplyText}
                msPerChar={chatTypewriterMsPerChar}
                enabled={!reduceMotionEnabled}
                bubbleFontFamily={fontFamilies.bubble}
                accessibilityLabel={t("chat.petSays", { petName: activePet.name, text: shortReplyText })}
                accessibilityHint={t("chat.finishMessageHint")}
              />
            </View>
          ) : null}

          {chatStarted ? (
            <ChatConversationHistory
              messages={messages}
              optimisticTurn={optimisticTurn}
              petName={activePet.name}
              reportedMessageIds={reportedMessageIds}
              onRetry={(turn) => void sendPremiumMessage(turn)}
              onReport={(messageId) => {
                setReportFailed(false);
                setReportNotice(null);
                setReportMessageId(messageId);
              }}
            />
          ) : (
            <ScrollView contentContainerStyle={styles.preChatScroll} showsVerticalScrollIndicator={false} style={styles.preChatScrollView}>
              {!premiumChatReady ? (
                // Locked state: the live-chat flag is off, or the Supabase
                // client never came up -- there is nothing an auto-load
                // attempt could fix here, so this stays a static notice
                // (matches the pre-redesign "long chat is resting" copy).
                <View
                  accessible
                  accessibilityLabel={`${t("chat.unavailableTitle")}. ${t("chat.unavailableDetail")}`}
                  style={styles.premiumGate}
                >
                  <View style={styles.premiumGateIcon}>
                    <MongchiIcon decorative id="lock" size={22} />
                  </View>
                  <View style={styles.bubbleCopy}>
                    <Text style={[styles.lockedTitle, { fontFamily: fontFamilies.title }]}>{t("chat.unavailableTitle")}</Text>
                    <Text numberOfLines={2} style={[styles.lockedText, { fontFamily: fontFamilies.body }]}>
                      {t("chat.unavailableDetail")}
                    </Text>
                  </View>
                </View>
              ) : chatError ? (
                // The auto-load attempt failed -- offer a tap-to-retry card
                // instead of a silent, permanent spinner.
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${chatError} ${t("chat.history.retry")}`}
                  style={styles.premiumGate}
                  onPress={() => void handleStartPremiumChat()}
                >
                  <View style={styles.premiumGateIcon}>
                    <MongchiIcon decorative id="refresh" size={22} />
                  </View>
                  <View style={styles.bubbleCopy}>
                    <Text style={[styles.lockedTitle, { fontFamily: fontFamilies.title }]}>{t("chat.history.retry")}</Text>
                    <Text numberOfLines={2} style={[styles.lockedText, { fontFamily: fontFamilies.body }]}>{chatError}</Text>
                  </View>
                </Pressable>
              ) : (
                // Covers both the instant before the auto-load effect fires
                // and the "starting" request itself -- a single lightweight
                // loading state, no tap required.
                <View accessible accessibilityLabel={t("chat.opening")} style={styles.loadingState}>
                  <ActivityIndicator color={colors.woodDark} />
                  <Text style={[styles.loadingText, { fontFamily: fontFamilies.body }]}>{t("chat.opening")}</Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>

        <View style={styles.footerStack}>
          {/* Once the thread is loaded, its own send/turn errors surface
              here. Before that, a failed auto-load already shows its own
              retry card above (with the same chatError text) -- showing it
              a second time here would just repeat the news. */}
          {chatStarted && (chatError || dayPassError) ? (
            <View style={styles.errorBubble}>
              <Text style={[styles.errorText, { fontFamily: fontFamilies.body }]}>{dayPassError ?? chatError}</Text>
            </View>
          ) : null}

          {chatStarted && dayPassOffer.state !== "hidden" ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={dayPassOffer.accessibilityLabel}
              accessibilityState={{ disabled: dayPassOffer.state === "offer" && dayPassPurchasing }}
              disabled={dayPassOffer.state === "offer" && dayPassPurchasing}
              style={[styles.dayPassOfferCard, dayPassOffer.state === "offer" && dayPassPurchasing ? styles.disabledBubble : null]}
              onPress={() => {
                if (dayPassOffer.state === "offer") {
                  void handlePurchaseDayPass();
                  return;
                }

                router.push("/credits");
              }}
            >
              <View style={styles.dayPassOfferCopy}>
                <Text numberOfLines={2} style={[styles.dayPassOfferTitle, { fontFamily: fontFamilies.title }]}>
                  {dayPassOffer.title}
                </Text>
                <Text numberOfLines={2} style={[styles.dayPassOfferDetail, { fontFamily: fontFamilies.body }]}>
                  {dayPassOffer.detail}
                </Text>
              </View>
              <View style={styles.dayPassOfferCta}>
                <Text numberOfLines={1} style={[styles.dayPassOfferCtaText, { fontFamily: fontFamilies.label }]}>
                  {dayPassOffer.state === "offer" && dayPassPurchasing ? t("creditsStore.actions.purchasing") : dayPassOffer.ctaLabel}
                </Text>
              </View>
            </Pressable>
          ) : null}

          {reportNotice ? (
            <View style={styles.reportNotice}>
              <Text accessibilityLiveRegion="polite" style={[styles.reportNoticeText, { fontFamily: fontFamilies.body }]}>
                {reportNotice}
              </Text>
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
              <MongchiIcon decorative id="microphone" size={20} />
            </View>
            <TextInput
              accessibilityLabel={t("chat.inputAccessibilityLabel")}
              editable={premiumChatReady && chatStarted && chatStatus !== "sending"}
              value={draft}
              placeholder={
                premiumChatReady && chatStarted
                  ? t("chat.inputPlaceholder", { petName: activePet.name })
                  : liveChatEnabled
                    ? premiumChatAccess.inputPlaceholder
                    : t("chat.unavailableInput")
              }
              placeholderTextColor={colors.mutedInk}
              maxLength={240}
              style={[styles.chatInput, { fontFamily: fontFamilies.body }]}
              onChangeText={setDraft}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={chatStarted ? t("chat.sendAccessibilityLabel") : liveChatEnabled ? premiumChatAccess.ctaLabel : t("chat.unavailableTitle")}
              accessibilityState={{ disabled: !liveChatEnabled || (chatStarted ? chatStatus === "sending" || optimisticTurn !== null || !trimmedDraft : chatStatus === "starting") }}
              disabled={!liveChatEnabled || (chatStarted ? chatStatus === "sending" || optimisticTurn !== null || !trimmedDraft : chatStatus === "starting")}
              style={({ pressed }) => [
                styles.sendButton,
                pressed ? styles.sendButtonPressed : null,
                chatStarted ? (trimmedDraft && optimisticTurn === null ? null : styles.sendButtonDisabled) : null
              ]}
              onPress={!liveChatEnabled ? undefined : chatStarted ? () => void sendPremiumMessage() : () => void handleStartPremiumChat()}
            >
              <MongchiIcon decorative id="send" size={20} />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
      <ChatReportDialog
        error={reportFailed}
        submitting={reportSubmitting}
        visible={reportMessageId !== null}
        onDismiss={() => {
          if (!reportSubmitting) {
            setReportMessageId(null);
            setReportFailed(false);
          }
        }}
        onSubmit={(reason) => void submitMessageReport(reason)}
      />
      <ChatInfoSheet visible={infoSheetVisible} onDismiss={() => setInfoSheetVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  reportNotice: {
    borderRadius: radii.control,
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  reportNoticeText: {
    color: colors.moss,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    textAlign: "center"
  },
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
  // Conversation-focused redesign: the garden background stays for mood, but
  // the wash is now dark and strong enough to keep the thread/header legible
  // over any generated art or weather overlay (was a near-invisible 0.08
  // cream tint sized for a hero-sprite layout with much less text on top).
  chatSceneWash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(37,29,26,0.4)"
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
  // Compact header: back + small pet identity + allowance chip + info
  // trigger, replacing the old hero-sprite/top-bar pairing.
  headerBlock: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 48
  },
  headerIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  headerPetThumbWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.cream,
    backgroundColor: "rgba(255,245,222,0.9)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...shadows.tile
  },
  headerPetThumb: {
    width: 34,
    height: 34
  },
  // Night-entry crossfade overlay -- stacks the sleep-pose thumbnail on top
  // of the (already-rendered) normal chat portrait, so fading its opacity
  // out reveals the portrait beneath rather than needing to swap sources.
  headerPetThumbOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,245,222,0.9)"
  },
  headerPetName: {
    flexShrink: 1,
    color: colors.cream,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "900",
    textShadowColor: "rgba(37,29,26,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2
  },
  allowanceChip: {
    minHeight: 36,
    maxWidth: 122,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.cream,
    backgroundColor: "rgba(255,232,199,0.94)",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    ...shadows.tile
  },
  allowanceChipText: {
    color: colors.woodDark,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900"
  },
  infoButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,245,222,0.94)",
    borderWidth: 2,
    borderColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.tile
  },
  // One-time inline exception to the info-sheet move -- see
  // shouldShowChatDisclosureBanner's doc comment.
  disclosureBanner: {
    marginTop: spacing.sm,
    borderRadius: 16,
    backgroundColor: "rgba(255,245,222,0.92)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.8)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm
  },
  disclosureBannerIcon: {
    marginTop: 2
  },
  disclosureBannerText: {
    flex: 1,
    color: colors.mutedInk,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800"
  },
  disclosureBannerDismiss: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  // The thread now owns most of the screen -- header above and the footer
  // (errors/day-pass/starters/input) below are both fixed height.
  threadArea: {
    flex: 1,
    paddingHorizontal: spacing.lg
  },
  ambientBubbleRow: {
    alignItems: "center",
    paddingBottom: spacing.sm
  },
  preChatScrollView: {
    flex: 1
  },
  preChatScroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: spacing.md
  },
  loadingState: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg
  },
  loadingText: {
    color: colors.cream,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    textShadowColor: "rgba(37,29,26,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2
  },
  petThoughtPressable: {
    width: "100%",
    maxWidth: 340,
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
  footerStack: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    gap: spacing.sm
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
  dayPassOfferCard: {
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.86)",
    backgroundColor: "rgba(255,232,199,0.94)",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadows.tile
  },
  dayPassOfferCopy: {
    flex: 1,
    minWidth: 0
  },
  dayPassOfferTitle: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900"
  },
  dayPassOfferDetail: {
    color: colors.woodDark,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    marginTop: 2
  },
  dayPassOfferCta: {
    borderRadius: radii.pill,
    backgroundColor: colors.apple,
    borderWidth: 2,
    borderColor: colors.cream,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  dayPassOfferCtaText: {
    color: colors.white,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900"
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
  }
});
