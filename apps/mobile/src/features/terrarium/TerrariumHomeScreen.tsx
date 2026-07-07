import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { Droplets, Flame, Footprints, Gift, Heart, MessageCircle, Moon, PawPrint, Utensils, Zap } from "lucide-react-native";
import { router } from "expo-router";
import { Animated, Easing, Image, ImageBackground, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ImageSourcePropType } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  createSeededRandom,
  deriveAmbientPetAssetState,
  getAutonomousBehaviorIntervalMs,
  getAvailableTreatItemId,
  getCareDaysAway,
  getWalkCollectibleById,
  defaultWeatherContext,
  getWeatherScenePresentation,
  hasCaredToday,
  isNightTime,
  pickAutonomousBehavior,
  pickButterflyTapLine,
  projectCareStreakForNow,
  pruneActiveCareBuffs,
  selectEpisodeLine,
  selectGeneratedAssetForReaction,
  selectLocalReaction,
  shouldShowMorningStretch,
  shouldSpawnButterflyVisit,
  starterReactionRules,
  AUTONOMOUS_BEHAVIOR_HOLD_MS
} from "@mongchi/shared";
import type {
  CareActionType,
  CareState,
  GeneratedAssetState,
  ItemId,
  MemoryEntry,
  RelationshipState,
  SelectedReaction,
  WeatherContext
} from "@mongchi/shared";

import { colors, radii, shadows, spacing, useFontFamilies } from "../../shared/design/tokens";
import { getHomeBackgroundSource } from "../../shared/assets/weatherSceneAssets";
import { GameItemImage, gameItemAssetByCatalogId } from "../../shared/ui/GameIllustrations";
import type { GameItemAssetKey } from "../../shared/ui/GameIllustrations";
import { LottieAnimation } from "../../shared/ui/LottieAnimation";
import { WeatherSceneLayer } from "../../shared/ui/WeatherSceneLayer";
import { useTypewriter } from "../../shared/ui/useTypewriter";
import { GeneratedPetAssetImage } from "../../shared/assets/generatedPetAssets";
import { useReducedMotionPreference } from "../../shared/accessibility/useReducedMotionPreference";
import {
  careActionSfxById,
  duckBgmForMs,
  isDaytimeNow,
  playAmbienceForWeather,
  playBgmForTimeOfDay,
  playLightImpactHaptic,
  playSfx,
  playSuccessHaptic
} from "../../shared/audio";
import { useTerrariumSession } from "../session/TerrariumSessionProvider";
import { requestNotificationPermissionAfterFirstCareAction } from "../notifications/notificationPermission";
import { getDaysTogether } from "../friend/friendProfilePresentation";
import { CareMomentLayer } from "./CareMomentLayer";
import { NightWashLayer, NightZzzFloat } from "./NightOverlayLayer";
import { ButterflyVisitorLayer } from "./ButterflyVisitorLayer";
import { HomeCareActionTray } from "./HomeCareActionTray";
import type {
  HomeCareActionFeedbackIcon,
  HomeCareActionFeedbackPresentation,
  HomeEventTogglePresentation,
  HudMeterKey
} from "./terrariumHomePresentation";
import {
  getAmbientReactionSeed,
  getBondLevelToastPersistedKey,
  getBondLevelUpTogglePresentation,
  getBuffToastPersistedKey,
  getDaysMilestoneToastPersistedKey,
  getDaysMilestoneTogglePresentation,
  getExpressionPackToastPersistedKey,
  getExpressionPackUnlockedTogglePresentation,
  getFriendEntryBadgeVisible,
  getHomeBuffTogglePresentation,
  getHomeCareActionFeedbackPresentation,
  getHomeStreakTogglePresentation,
  getHomeThoughtPresentation,
  getHudMeterGuidePresentation,
  getStreakToastPersistedKey,
  getWalkCollectionCompleteTogglePresentation,
  getWalkDiscoveryCardPresentation,
  isCelebrationReaction,
  pruneEventToastPersistedKeys
} from "./terrariumHomePresentation";
import { getVisibleHomeCareMenuOptions } from "./terrariumHomeCareMenu";
import {
  getHomeCareActionCooldownLeftMs,
  getHomeCarePressDecision,
  homeActionFeedbackMs,
  homeFloatingDockActions,
  type HomeFloatingDockAction,
  isHomeFloatingDockAction
} from "./terrariumHomeInteractionContract";
import {
  HOME_THOUGHT_BUBBLE_MAX_LINES,
  HOME_THOUGHT_BUBBLE_WIDTH_PX,
  estimateHomeThoughtBubbleLineCount,
  getHomePetStageBottomPx,
  getHomeStageHorizontalMarginLeftPx,
  getHomeThoughtBubbleBottomPx,
  getHomeThoughtBubbleHeightPx,
  getHomeThoughtBubbleVerticalPaddingPx
} from "./homeStageLayout";

interface CareButtonConfig {
  action: CareActionType;
  label: string;
  Icon: ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
  buttonAsset?: ImageSourcePropType;
  color: string;
  item?: GameItemAssetKey;
}

type HudMeterIcon = "food" | "heart" | "zap" | "water";

interface HudMeterConfig {
  key: HudMeterKey;
  label: string;
  value: number;
  icon: HudMeterIcon;
  color: string;
}

interface LastCareActionSnapshot {
  action: CareActionType;
  previousCareState: CareState;
  previousRelationshipState: RelationshipState;
  // A per-press identity, distinct from `action` -- two consecutive presses
  // of the *same* action (e.g. feed, feed) would otherwise share every field
  // above, so components keyed only by `action` (HudDeltaFloater,
  // AnimatedCareFeedbackToast) wouldn't remount/re-animate on the second
  // press when the resulting deltas happen to match the first press exactly.
  actedAtMs: number;
}

const careButtons: CareButtonConfig[] = [
  { action: "feed", label: "Feed", Icon: Utensils, buttonAsset: require("../../../assets/game-buttons/dock/feed.png"), color: colors.coral, item: "foodBowl" },
  { action: "talk", label: "Talk", Icon: MessageCircle, color: colors.skyDeep },
  { action: "walk", label: "Walk", Icon: Footprints, buttonAsset: require("../../../assets/game-buttons/dock/path.png"), color: colors.honey },
  { action: "play", label: "Play", Icon: Zap, buttonAsset: require("../../../assets/game-buttons/dock/play.png"), color: colors.yellow, item: "toyBall" },
  { action: "rest", label: "Rest", Icon: Moon, buttonAsset: require("../../../assets/game-buttons/rest.png"), color: colors.skyDeep },
  { action: "affection", label: "Pet", Icon: Heart, buttonAsset: require("../../../assets/game-buttons/dock/affection.png"), color: colors.rose },
  { action: "water_garden", label: "Water", Icon: Droplets, buttonAsset: require("../../../assets/game-buttons/dock/water.png"), color: colors.leaf, item: "drinkWaterBowl" },
  { action: "clean", label: "Clean", Icon: Droplets, color: colors.lavender },
  { action: "treat", label: "Treat", Icon: Gift, color: colors.wood, item: "treatPlate" }
];

const hudMeterSegments = [0, 1, 2, 3, 4] as const;
const HOME_WELCOME_SEEN_KEY = "mongchi.home.welcome.v1";
const HOME_EVENT_TOAST_SHOWN_KEYS_KEY = "mongchi.home.eventToast.shownKeys.v1";
/** Same key the friend page writes when its 30-day letter is opened -- read here only to drive the badge dot. */
const MONTHLY_LETTER_OPENED_KEY = "mongchi.friend.monthlyLetter.openedAt.v1";
/** Local-wallet cost of the "Bring home now" early-walk-return button. */
const WALK_EARLY_RETURN_CREDIT_COST = 1;

/**
 * Picks the event toast's SFX by its id prefix (HomeEventTogglePresentation
 * has no discriminant field beyond `id` -- see terrariumHomePresentation.ts)
 * and plays a matching haptic for the two celebration-grade toasts. Bond
 * level-ups and discovery-grade moments (walk finds, walk journal
 * completion, expression pack unlocks) get their own jingle; every other
 * event toast (streaks, buffs, days-together milestones) gets the shared,
 * lower-key sfx_toast chime.
 */
// Jingle length here matches the placeholder jingle_* durations from
// synth_sfx.py (well under 1s); ducking briefly for it is a "make room for
// the jingle" dip, not a full BGM pause, so it recovers on its own via
// duckBgmForMs -- no separate unduck call needed at these call sites.
const JINGLE_DUCK_MS = 900;

const playEventToastSfx = (toastId: string): void => {
  if (toastId.startsWith("bond-level-")) {
    duckBgmForMs(JINGLE_DUCK_MS);
    playSfx("jingle_levelup");
    playSuccessHaptic();
    return;
  }

  if (
    toastId.startsWith("walk-discovery-") ||
    toastId === "walk-collection-complete" ||
    toastId.startsWith("expression-pack-")
  ) {
    duckBgmForMs(JINGLE_DUCK_MS);
    playSfx("jingle_discovery");
    return;
  }

  playSfx("sfx_toast");
};
const speechBubbleAsset = require("../../../assets/generated/ui/speech-bubble-v1.png");
const pawsAnimation = require("../../../assets/lottie/paws-animation.json");
const pathButtonAsset = require("../../../assets/game-buttons/path.png");
const homeActionAssetPreference: Record<CareActionType, GeneratedAssetState> = {
  affection: "happy",
  clean: "happy",
  feed: "happy",
  play: "play",
  rest: "sleep",
  talk: "chat_portrait",
  treat: "treat_reaction",
  walk: "idle",
  water_garden: "happy"
};

const hudButtonAssets: Record<HudMeterIcon, ImageSourcePropType> = {
  food: require("../../../assets/game-buttons/feed.png"),
  heart: require("../../../assets/game-buttons/affection.png"),
  zap: require("../../../assets/game-buttons/energy.png"),
  water: require("../../../assets/game-buttons/water.png")
};

const sideRailButtonAssets = {
  shop: require("../../../assets/game-buttons/side-nav/shop.png"),
  chat: require("../../../assets/game-buttons/side-nav/chat.png"),
  settings: require("../../../assets/game-buttons/side-nav/settings.png")
} satisfies Record<string, ImageSourcePropType>;

// Seeded (not Math.random) on purpose: see getAmbientReactionSeed for why an
// unseeded pick made the speech bubble read as empty/invisible.
const createInitialReaction = (
  careState: CareState,
  pet: ReturnType<typeof useTerrariumSession>["activePet"],
  now: string,
  recentReactions: ReturnType<typeof useTerrariumSession>["recentReactions"],
  weather: WeatherContext
): SelectedReaction =>
  selectLocalReaction(
    starterReactionRules,
    {
      locale: "en-US",
      now,
      pet,
      careState,
      daysAway: getCareDaysAway(careState, now),
      weather,
      recentReactions
    },
    { random: createSeededRandom(getAmbientReactionSeed(pet.id, careState, now, weather)) }
  );

const formatCooldownBadge = (milliseconds: number): string => {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.ceil(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m`;
  }

  return `${Math.ceil(minutes / 60)}h`;
};

const renderCareFeedbackIcon = (icon: HomeCareActionFeedbackIcon) => {
  switch (icon) {
    case "food":
      return <GameItemImage accessibilityLabel="Food feedback" decorative item="foodBowl" style={styles.careFeedbackItemIcon} variant="hud" />;
    case "play":
      return <GameItemImage accessibilityLabel="Play feedback" decorative item="toyBall" style={styles.careFeedbackItemIcon} variant="hud" />;
    case "water":
      return <GameItemImage accessibilityLabel="Water feedback" decorative item="drinkWaterBowl" style={styles.careFeedbackItemIcon} variant="hud" />;
    case "treat":
      return <GameItemImage accessibilityLabel="Treat feedback" decorative item="treatPlate" style={styles.careFeedbackItemIcon} variant="hud" />;
    case "reward":
      return <Gift color={colors.honey} size={22} strokeWidth={3} />;
    case "talk":
      return <MessageCircle color={colors.skyDeep} size={22} strokeWidth={3} />;
    case "walk":
      return (
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel="Path feedback"
          resizeMode="contain"
          source={pathButtonAsset}
          style={styles.careFeedbackItemIcon}
        />
      );
    case "rest":
      return <Moon color={colors.skyDeep} size={22} strokeWidth={3} />;
    case "clean":
      return <Droplets color={colors.lavender} size={22} strokeWidth={3} />;
    case "heart":
      return <Heart color={colors.rose} fill={colors.rose} size={21} strokeWidth={2.4} />;
  }
};

function BreathingPetLayer({ children }: { children: ReactNode }) {
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        })
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [breath]);

  return (
    <Animated.View
      style={{
        transform: [
          { scaleY: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.018] }) },
          { translateY: breath.interpolate({ inputRange: [0, 1], outputRange: [0, -1.5] }) }
        ]
      }}
    >
      {children}
    </Animated.View>
  );
}

interface AnimatedResourceTrackProps {
  value: number;
  color: string;
}

/**
 * HUD gauge segments used to snap to their new fill state the instant
 * careState updated (a single re-render, no animation at all) -- this
 * animates the underlying 0-100 value over ~0.6s so each segment lights up
 * as the value crosses its 20% threshold, instead of all changed segments
 * popping at once. useNativeDriver can't animate backgroundColor/width
 * directly here since segment count is derived from the value in JS, so this
 * drives a plain (non-native) Animated.Value and reads it once per frame via
 * addListener -- cheap at 5 segments and only while the value is in motion.
 */
function AnimatedResourceTrack({ value, color }: AnimatedResourceTrackProps) {
  const animatedValue = useRef(new Animated.Value(value)).current;
  const [displayedValue, setDisplayedValue] = useState(value);
  const reduceMotionEnabled = useReducedMotionPreference();

  useEffect(() => {
    if (reduceMotionEnabled) {
      animatedValue.setValue(value);
      setDisplayedValue(value);
      return;
    }

    const animation = Animated.timing(animatedValue, {
      toValue: value,
      duration: 600,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false
    });

    animation.start();

    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduceMotionEnabled]);

  useEffect(() => {
    const id = animatedValue.addListener(({ value: nextValue }) => setDisplayedValue(nextValue));

    return () => animatedValue.removeListener(id);
  }, [animatedValue]);

  return (
    <View style={styles.resourceTrack}>
      {hudMeterSegments.map((segment) => (
        <View
          key={segment}
          style={[styles.resourceSegment, displayedValue >= (segment + 1) * 20 ? { backgroundColor: color } : null]}
        />
      ))}
    </View>
  );
}

interface HudDeltaFloaterProps {
  meterKey: HudMeterKey;
  value: number;
}

/** A brief "+12"-style number that rises and fades over a care meter right after an action lands -- see HomeCareActionFeedbackDelta. */
function HudDeltaFloater({ value }: HudDeltaFloaterProps) {
  const appear = useRef(new Animated.Value(0)).current;
  const fontFamilies = useFontFamilies();

  useEffect(() => {
    appear.setValue(0);
    Animated.timing(appear, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (value === 0) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.hudDeltaFloater,
        {
          opacity: appear.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] }),
          transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [0, -18] }) }]
        }
      ]}
    >
      <Text style={[styles.hudDeltaFloaterText, { fontFamily: fontFamilies.label }]}>
        {value > 0 ? `+${value}` : value}
      </Text>
    </Animated.View>
  );
}

const homeEventToastVisibleMs = 4600;

interface HomeEventToastProps {
  line: string;
  accessibilityLabel: string;
  onDone: () => void;
}

/** Brief, self-dismissing celebration toast for streak/buff moments — never a persistent badge. */
function HomeEventToast({ line, accessibilityLabel, onDone }: HomeEventToastProps) {
  const appear = useRef(new Animated.Value(0)).current;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const fontFamilies = useFontFamilies();

  useEffect(() => {
    const sequence = Animated.sequence([
      Animated.timing(appear, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      }),
      Animated.delay(homeEventToastVisibleMs - 260 - 320),
      Animated.timing(appear, {
        toValue: 0,
        duration: 320,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true
      })
    ]);

    sequence.start(({ finished }) => {
      if (finished) {
        onDoneRef.current();
      }
    });

    return () => sequence.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line]);

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      accessibilityLabel={accessibilityLabel}
      pointerEvents="none"
      style={[
        styles.homeEventToast,
        {
          opacity: appear,
          transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }]
        }
      ]}
    >
      <Text numberOfLines={2} style={[styles.homeEventToastText, { fontFamily: fontFamilies.body }]}>
        {line}
      </Text>
    </Animated.View>
  );
}

interface AnimatedCareFeedbackToastProps {
  feedback: HomeCareActionFeedbackPresentation;
}

/**
 * The HUD's per-action feedback bubble ("Bowl filled · Food +12") used to be
 * a plain View that popped in and snapped away with no transition at all --
 * every other toast on this screen (HomeEventToast) animates in/out, so this
 * mirrors that exact appear/hold/disappear timing instead of introducing a
 * third, different motion language.
 */
function AnimatedCareFeedbackToast({ feedback }: AnimatedCareFeedbackToastProps) {
  const appear = useRef(new Animated.Value(0)).current;
  const fontFamilies = useFontFamilies();

  useEffect(() => {
    appear.setValue(0);
    const sequence = Animated.sequence([
      Animated.timing(appear, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      }),
      Animated.delay(Math.max(0, homeActionFeedbackMs - 220 - 260)),
      Animated.timing(appear, {
        toValue: 0,
        duration: 260,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true
      })
    ]);

    sequence.start();

    return () => sequence.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback.title, feedback.line]);

  return (
    <Animated.View
      accessibilityLabel={feedback.accessibilityLabel}
      style={[
        styles.hudFeedbackToast,
        feedback.tone === "reward" ? styles.careFeedbackReward : null,
        feedback.tone === "tradeoff" ? styles.careFeedbackTradeoff : null,
        {
          opacity: appear,
          transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }]
        }
      ]}
    >
      <View style={styles.careFeedbackIconFrame}>{renderCareFeedbackIcon(feedback.icon)}</View>
      <View style={styles.careFeedbackCopy}>
        <Text numberOfLines={1} style={[styles.careFeedbackTitle, { fontFamily: fontFamilies.title }]}>
          {feedback.title}
        </Text>
        <Text numberOfLines={1} style={[styles.careFeedbackLine, { fontFamily: fontFamilies.body }]}>
          {feedback.line}
        </Text>
      </View>
    </Animated.View>
  );
}

interface SceneRailButtonProps {
  accessibilityLabel: string;
  imageLabel: string;
  delayMs: number;
  source: ImageSourcePropType;
  onPress: () => void;
}

function SceneRailButton({ accessibilityLabel, imageLabel, delayMs, source, onPress }: SceneRailButtonProps) {
  const motion = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delayMs),
        Animated.timing(motion, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(motion, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        }),
        Animated.delay(1800)
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [delayMs, motion]);

  const animatedStyle = {
    transform: [
      {
        translateY: motion.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -3]
        })
      },
      {
        scale: motion.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.035]
        })
      },
      {
        rotate: motion.interpolate({
          inputRange: [0, 1],
          outputRange: ["-0.7deg", "0.7deg"]
        })
      }
    ]
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={12}
      style={({ pressed }) => [styles.sceneRailButton, pressed ? styles.sceneRailButtonPressed : null]}
      onPress={onPress}
    >
      <Animated.Image
        accessibilityIgnoresInvertColors
        accessibilityLabel={imageLabel}
        resizeMode="contain"
        source={source}
        style={[styles.sceneRailButtonImage, animatedStyle]}
      />
    </Pressable>
  );
}

interface FriendRailButtonProps {
  accessibilityLabel: string;
  onPress: () => void;
  /** Small unread-letter dot -- shown once the 30-day letter has arrived and stays unopened. */
  showBadge?: boolean;
}

/**
 * The friend page's side-rail entry has no PNG art yet (shop/chat/settings
 * do), so it's built from existing tokens instead of require()'d art — a
 * cream pixel-bordered tile (shadows.tile) matching the other rail buttons'
 * footprint, with a paw glyph so it reads as "this pet's page" at a glance.
 */
function FriendRailButton({ accessibilityLabel, onPress, showBadge = false }: FriendRailButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={showBadge ? `${accessibilityLabel}. A new letter is waiting.` : accessibilityLabel}
      hitSlop={12}
      style={({ pressed }) => [styles.friendRailButton, pressed ? styles.friendRailButtonPressed : null]}
      onPress={onPress}
    >
      <PawPrint color={colors.woodDark} size={24} strokeWidth={2.6} />
      {showBadge ? <View accessibilityElementsHidden importantForAccessibility="no" style={styles.friendRailBadgeDot} /> : null}
    </Pressable>
  );
}

export function TerrariumHomeScreen() {
  const {
    activeBuffs,
    activePet,
    activeWalk,
    acceptedAssets,
    careCooldownUntilByAction,
    careState,
    careStreak,
    claimWalkReward,
    completeWalkEarly,
    creditBalance,
    currentReaction,
    acceptedAsset,
    careStats,
    catalogItems,
    devStoreUnlocked,
    generatedAssetUriById,
    inventory,
    lastWalkDiscovery,
    memories,
    originalPhotoDeletedAt,
    performCareAction,
    recentReactions,
    refreshWalk,
    relationshipState,
    satisfactionSummary,
    setCareActionCooldown,
    weatherState
  } = useTerrariumSession();
  const [lastAction, setLastAction] = useState<CareActionType | null>(null);
  const [lastActionSnapshot, setLastActionSnapshot] = useState<LastCareActionSnapshot | null>(null);
  // Set the instant "Greet & claim" is tapped, cleared after
  // homeActionFeedbackMs — mirrors lastActionSnapshot's lifecycle so the
  // claim's own currentReaction (discovery line / collection-complete line)
  // gets the same "recently acted" window to show in the bubble and drive the
  // pet's expression, instead of being silently replaced by the ambient
  // reaction the instant claimWalkReward() resolves.
  const [justClaimedWalkAt, setJustClaimedWalkAt] = useState<number | null>(null);
  // Plays the pet's run-in-from-the-side entrance exactly once per walk
  // return, then settles back to translateX 0 for the rest of the visit.
  const walkGreetEntrance = useRef(new Animated.Value(0)).current;
  const hasPlayedWalkGreetEntranceRef = useRef(false);
  // Bond level-up toast: watches relationshipState.bondLevel for an increase
  // and celebrates every crossed level, independent of which care action (or
  // walk claim) caused it -- see getBondLevelUpTogglePresentation.
  const previousBondLevelRef = useRef<number | null>(null);
  const [celebratingBondLevelUntil, setCelebratingBondLevelUntil] = useState(0);
  // Visual hint that a long-press (opens the friend page) is available:
  // scales the pet down slightly while the finger is down, same idea as
  // FriendRailButton's pressed translateY -- purely cosmetic, no gesture logic.
  const [petPressed, setPetPressed] = useState(false);
  const [openCareMenu, setOpenCareMenu] = useState<HomeFloatingDockAction | null>(null);
  const [actionLockedUntil, setActionLockedUntil] = useState(0);
  const actionLockedUntilRef = useRef(0);
  const [clock, setClock] = useState(() => Date.now());
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const [firstCareGuideVisible, setFirstCareGuideVisible] = useState(false);
  const [eventToastQueue, setEventToastQueue] = useState<HomeEventTogglePresentation[]>([]);
  const shownEventToastIdsRef = useRef(new Set<string>());
  // Keys already shown in a *previous* app session (loaded from AsyncStorage on
  // mount) plus any shown this session — persisted so a restart on the same
  // local day does not replay today's streak toast or a buff grant's toast.
  const persistedEventToastKeysRef = useRef<string[]>([]);
  const [persistedEventToastKeysLoaded, setPersistedEventToastKeysLoaded] = useState(false);
  const [hudGuideMeterKey, setHudGuideMeterKey] = useState<HudMeterKey | null>(null);
  // Episode-line dedupe + "first bubble of this session" state -- session-only
  // (not persisted), matching the house rule against touching prototypeSession's
  // memory/migration plumbing for this wave. Worst case on app restart: an
  // episode line that was already shown last session can repeat once.
  const shownEpisodeLineKeysRef = useRef(new Set<string>());
  const isFirstHomeThoughtRef = useRef(true);
  const previousWeatherConditionRef = useRef<WeatherContext["condition"] | null>(null);
  // Tier 3 world-autonomy state (docs/gamefeel-sound-plan.md §1 Tier 3) --
  // session-only, matching the house rule against touching prototypeSession's
  // persisted shape for this wave. Worst case on restart: a fresh morning
  // stretch/butterfly roll, never a crash or stuck state.
  //
  // Morning stretch: fires once, the first render after the pet was last
  // seen asleep and it is now daytime -- compared against careState's own
  // lastInteractionAt/updatedAt (the existing "last touched" signal, see
  // getCareDaysAway) rather than a new persisted field.
  const hasEvaluatedMorningStretchRef = useRef(false);
  const [showingMorningStretchUntil, setShowingMorningStretchUntil] = useState(0);
  // Autonomous idle behavior: a small expression+motion flourish every
  // 40-90s while nothing else (recent action, walk, celebration) is already
  // driving the pet's expression -- see pickAutonomousBehavior.
  const [autonomousBehaviorUntil, setAutonomousBehaviorUntil] = useState(0);
  const autonomousBehaviorRollRef = useRef(0);
  // Butterfly visitor: at most one roll per home-screen mount, never
  // re-rolled on every render.
  const hasRolledButterflyVisitRef = useRef(false);
  const [butterflyVisitActive, setButterflyVisitActive] = useState(false);
  const [butterflyCaughtLine, setButterflyCaughtLine] = useState<string | null>(null);
  const [nightCareAcknowledgedUntil, setNightCareAcknowledgedUntil] = useState(0);
  const availableTreatItemId = useMemo(() => getAvailableTreatItemId(inventory, catalogItems), [catalogItems, inventory]);
  const [hasOpenedMonthlyLetter, setHasOpenedMonthlyLetter] = useState(false);
  const daysTogether = useMemo(
    () => getDaysTogether(activePet.createdAt, new Date(clock).toISOString()),
    [activePet.createdAt, clock]
  );
  const showFriendEntryBadge = getFriendEntryBadgeVisible(daysTogether, hasOpenedMonthlyLetter);
  const fontFamilies = useFontFamilies();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  // Declared here (rather than further down with the rest of the derived
  // render values) because the Tier 3 autonomous-behavior timer effect below
  // needs it as an effect dependency, and hooks can't be called after an
  // effect that depends on them.
  const reduceMotionEnabled = useReducedMotionPreference();

  useEffect(() => {
    let cancelled = false;

    void AsyncStorage.getItem(HOME_EVENT_TOAST_SHOWN_KEYS_KEY)
      .then((raw) => {
        if (cancelled || !raw) {
          return;
        }

        const parsed = JSON.parse(raw);

        if (Array.isArray(parsed)) {
          persistedEventToastKeysRef.current = parsed.filter((key): key is string => typeof key === "string");
        }
      })
      .catch(() => {
        // Silent: worst case a toast shows once more than intended, never crash for this.
      })
      .finally(() => {
        if (!cancelled) {
          setPersistedEventToastKeysLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const persistEventToastKey = (persistedKey: string) => {
    persistedEventToastKeysRef.current = pruneEventToastPersistedKeys([...persistedEventToastKeysRef.current, persistedKey]);

    void AsyncStorage.setItem(HOME_EVENT_TOAST_SHOWN_KEYS_KEY, JSON.stringify(persistedEventToastKeysRef.current)).catch(() => {
      // Silent: a missed persist just means the toast might replay once next launch.
    });
  };

  const enqueueEventToast = (toast: HomeEventTogglePresentation | null, persistedKey?: string) => {
    if (!toast || shownEventToastIdsRef.current.has(toast.id)) {
      return;
    }

    // Wait for the persisted-keys load so a restart doesn't briefly re-show
    // today's toast before storage has had a chance to report it was already seen.
    if (persistedKey && !persistedEventToastKeysLoaded) {
      return;
    }

    if (persistedKey && persistedEventToastKeysRef.current.includes(persistedKey)) {
      shownEventToastIdsRef.current.add(toast.id);
      return;
    }

    shownEventToastIdsRef.current.add(toast.id);
    setEventToastQueue((current) => [...current, toast]);
    playEventToastSfx(toast.id);

    if (persistedKey) {
      persistEventToastKey(persistedKey);
    }
  };

  const dismissCurrentEventToast = () => {
    setEventToastQueue((current) => current.slice(1));
  };

  // Streak/buff moments are event toasts, not always-on badges: fire once when
  // today's first care lands, and once per newly granted buff.
  useEffect(() => {
    const now = new Date(clock).toISOString();

    if (hasCaredToday(careStreak, now) && careStreak.lastCareDayKey) {
      enqueueEventToast(
        getHomeStreakTogglePresentation(projectCareStreakForNow(careStreak, now).current),
        getStreakToastPersistedKey(careStreak.lastCareDayKey)
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [careStreak.lastCareDayKey, persistedEventToastKeysLoaded]);

  useEffect(() => {
    const now = new Date(clock).toISOString();

    pruneActiveCareBuffs(activeBuffs ?? [], now).forEach((buff) => {
      enqueueEventToast(getHomeBuffTogglePresentation(buff), getBuffToastPersistedKey(buff.buffId, buff.startedAt));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBuffs, persistedEventToastKeysLoaded]);

  // Bond level-up moment: prototypeSession already grants the reward and a
  // `bond_level_up_*` celebration reaction the instant bondLevel crosses (see
  // applyBondLevelRewards), but that reaction only ever reached the speech
  // bubble transiently -- nothing on Home fired its own toast, so a level-up
  // reached during a walk claim or a quiet feed passed with zero durable
  // feedback. This watches the level itself, independent of which action
  // caused it, and also holds the pet's celebrate expression for a few
  // seconds so the toast and the pet's face land together.
  useEffect(() => {
    const level = relationshipState.bondLevel;

    if (previousBondLevelRef.current === null) {
      previousBondLevelRef.current = level;
      return;
    }

    if (level > previousBondLevelRef.current) {
      for (let crossed = previousBondLevelRef.current + 1; crossed <= level; crossed += 1) {
        enqueueEventToast(getBondLevelUpTogglePresentation(crossed), getBondLevelToastPersistedKey(crossed));
      }

      setCelebratingBondLevelUntil(Date.now() + homeActionFeedbackMs);
    }

    previousBondLevelRef.current = level;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relationshipState.bondLevel, persistedEventToastKeysLoaded]);

  // D7/D14/D30 celebration: fires once, the day a days_milestone memory is
  // first recorded (recordDaysTogetherMilestoneIfCrossed in prototypeSession
  // already writes these -- this just surfaces the ones dated today).
  useEffect(() => {
    const now = new Date(clock).toISOString();

    memories
      .filter((memory): memory is MemoryEntry => memory.type === "days_milestone")
      .forEach((memory) => {
        const toast = getDaysMilestoneTogglePresentation(memory, activePet.name, now);
        const daysTogetherForKey = memory.refs?.daysTogether;

        if (toast && daysTogetherForKey !== undefined) {
          enqueueEventToast(toast, getDaysMilestoneToastPersistedKey(daysTogetherForKey));
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memories, activePet.name, persistedEventToastKeysLoaded]);

  // Expression pack unlock celebration: fires once per pack the moment its
  // purchase finishes and lands in inventory.ownedExpressionPackIds -- the
  // purchase's own poll loop lives in TerrariumSessionProvider (not this
  // screen), so this fires the very first time the owner sees Home again
  // after navigating away mid-purchase, exactly matching the "polling
  // continues, one toast on completion" requirement.
  useEffect(() => {
    (inventory.ownedExpressionPackIds ?? []).forEach((packId) => {
      enqueueEventToast(
        getExpressionPackUnlockedTogglePresentation(packId, activePet.name),
        getExpressionPackToastPersistedKey(packId)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventory.ownedExpressionPackIds, activePet.name, persistedEventToastKeysLoaded]);

  // Mirrors the friend page's monthly-letter "opened" flag purely to decide
  // whether the friend rail button's unread-letter badge dot should show --
  // never writes this key, only reads it.
  useEffect(() => {
    let cancelled = false;

    void AsyncStorage.getItem(MONTHLY_LETTER_OPENED_KEY)
      .then((openedAt) => {
        if (!cancelled && openedAt) {
          setHasOpenedMonthlyLetter(true);
        }
      })
      .catch(() => {
        // Silent: worst case the badge shows a little longer than necessary.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void AsyncStorage.getItem(HOME_WELCOME_SEEN_KEY).then((seenAt) => {
      if (!cancelled && !seenAt) {
        setWelcomeVisible(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Sound Phase 2 (see docs/gamefeel-sound-plan.md §2): start BGM for the
  // current time of day on entering the home screen (BGM is app-global once
  // started -- it keeps playing if the user navigates away and back, rather
  // than restarting, since playBgm/playAmbienceForWeather are no-ops when
  // the requested track is already active). No-ops silently when the
  // "Music & ambience" setting is off.
  useEffect(() => {
    playBgmForTimeOfDay(isDaytimeNow());
  }, []);

  // Ambience follows the active weather condition (falls back to the
  // default/clear context when weather scenes are turned off, matching
  // activeWeather's derivation below) -- swaps only when the mapped track
  // actually changes.
  useEffect(() => {
    const condition = weatherState.settings.enabled ? weatherState.context.condition : defaultWeatherContext.condition;
    playAmbienceForWeather(condition);
  }, [weatherState.settings.enabled, weatherState.context.condition]);

  const dismissWelcome = () => {
    setWelcomeVisible(false);
    setFirstCareGuideVisible(true);
    void AsyncStorage.setItem(HOME_WELCOME_SEEN_KEY, new Date().toISOString());
  };
  const visibleCareMenuOptions = useMemo(
    () =>
      openCareMenu
        ? getVisibleHomeCareMenuOptions({
            action: openCareMenu,
            catalogItems,
            devStoreUnlocked,
            inventory,
            limit: openCareMenu === "feed" ? 5 : 4
          })
        : [],
    [catalogItems, devStoreUnlocked, inventory, openCareMenu]
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setClock(Date.now());
      if (activeWalk?.status === "walking") {
        refreshWalk();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeWalk?.status, refreshWalk]);

  useEffect(() => {
    if (!lastActionSnapshot) {
      return;
    }

    const timeout = setTimeout(() => {
      setLastAction(null);
      setLastActionSnapshot(null);
    }, homeActionFeedbackMs);

    return () => clearTimeout(timeout);
  }, [lastActionSnapshot]);

  // Morning stretch (docs/gamefeel-sound-plan.md §1 Tier 3): evaluated once
  // per mount against the pet's last-touched timestamp (the existing
  // lastInteractionAt/updatedAt signal, see getCareDaysAway) -- if the owner
  // was last here while the pet was asleep and it's now daytime, play a
  // short "just woke up" beat instead of settling straight into idle.
  useEffect(() => {
    if (hasEvaluatedMorningStretchRef.current || !persistedEventToastKeysLoaded) {
      return;
    }

    hasEvaluatedMorningStretchRef.current = true;
    const lastSeenIso = careState.lastInteractionAt ?? careState.updatedAt ?? null;
    const nowIso = new Date().toISOString();

    if (shouldShowMorningStretch(lastSeenIso, nowIso)) {
      setShowingMorningStretchUntil(Date.now() + homeActionFeedbackMs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistedEventToastKeysLoaded]);

  // Autonomous idle behavior (docs/gamefeel-sound-plan.md §1 Tier 3): every
  // 40-90s, while the pet is otherwise just idling, briefly swap to a small
  // curious/happy/play flourish with a matching motion cue -- "the dog does
  // something on its own" even when the owner isn't touching anything. Each
  // beat re-rolls both its own duration and the next gap so the rhythm never
  // feels metronomic. Skipped entirely at night (the pet is asleep) and
  // under reduced motion (no swap worth making without the motion to sell it).
  useEffect(() => {
    if (reduceMotionEnabled) {
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const scheduleNext = () => {
      const gapRoll = Math.random();
      const gapMs = getAutonomousBehaviorIntervalMs(gapRoll);

      timeoutId = setTimeout(() => {
        if (cancelled) {
          return;
        }

        autonomousBehaviorRollRef.current = Math.random();
        const untilMs = Date.now() + AUTONOMOUS_BEHAVIOR_HOLD_MS;
        setAutonomousBehaviorUntil(untilMs);
        scheduleNext();
      }, gapMs);
    };

    scheduleNext();

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [reduceMotionEnabled]);

  // Butterfly visitor (docs/gamefeel-sound-plan.md §1 Tier 3): one roll per
  // home-screen mount, daytime only, ~15% chance (shouldSpawnButterflyVisit).
  // Rolled once persisted state has loaded so it doesn't fire ahead of the
  // welcome/first-care-guide flows.
  useEffect(() => {
    if (hasRolledButterflyVisitRef.current || !persistedEventToastKeysLoaded) {
      return;
    }

    hasRolledButterflyVisitRef.current = true;
    const roll = Math.random();

    if (shouldSpawnButterflyVisit(roll, !isNightTime(new Date().toISOString()))) {
      setButterflyVisitActive(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistedEventToastKeysLoaded]);

  // showingMorningStretchUntil/autonomousBehaviorUntil are plain "expires at
  // this clock reading" timestamps (same pattern as celebratingBondLevelUntil
  // above) -- the render body's own `> clock` comparison already turns them
  // off once the 1s clock tick passes that point, so no separate reset timer
  // is needed here.

  useEffect(() => {
    if (!butterflyCaughtLine) {
      return;
    }

    const timeout = setTimeout(() => setButterflyCaughtLine(null), homeActionFeedbackMs);

    return () => clearTimeout(timeout);
  }, [butterflyCaughtLine]);

  useEffect(() => {
    if (justClaimedWalkAt === null) {
      return;
    }

    const timeout = setTimeout(() => {
      setJustClaimedWalkAt(null);
    }, homeActionFeedbackMs);

    return () => clearTimeout(timeout);
  }, [justClaimedWalkAt]);

  // New-find banner / journal-complete toast: claimPrototypeWalkReward always
  // writes lastWalkDiscovery (see prototypeSession.ts), but nothing ever read
  // it before this -- it's the one stable, non-reaction-shaped signal for
  // "was this specific find new" and "did the journal just complete", so it
  // drives these toasts instead of trying to parse the bubble's reaction line.
  useEffect(() => {
    if (justClaimedWalkAt === null || !lastWalkDiscovery) {
      return;
    }

    if (lastWalkDiscovery.collectionCompleted) {
      enqueueEventToast(getWalkCollectionCompleteTogglePresentation());
      return;
    }

    if (lastWalkDiscovery.isNew) {
      const collectible = getWalkCollectibleById(lastWalkDiscovery.collectibleId);

      if (collectible) {
        enqueueEventToast(getWalkDiscoveryCardPresentation(collectible.nameEn, collectible.rarity));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justClaimedWalkAt]);

  // Run-in-from-the-side entrance: plays once per claim (never on ambient
  // re-renders), reusing the same paw-steps Lottie the "walking" state shows
  // so the walk-out and walk-home motions read as the same trip. Skips
  // entirely under reduced-motion, matching the rest of this screen's motion
  // gating (see useReducedMotionPreference usage below).
  useEffect(() => {
    if (justClaimedWalkAt === null || hasPlayedWalkGreetEntranceRef.current) {
      return;
    }

    hasPlayedWalkGreetEntranceRef.current = true;
    walkGreetEntrance.setValue(1);
    Animated.timing(walkGreetEntrance, {
      toValue: 0,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justClaimedWalkAt]);

  // Resets the "already played" guard once the claim window fully closes, so
  // a *later* walk's claim plays its own entrance instead of silently no-op'ing.
  useEffect(() => {
    if (justClaimedWalkAt === null) {
      hasPlayedWalkGreetEntranceRef.current = false;
    }
  }, [justClaimedWalkAt]);

  const getActionCooldownLeftMs = (action: CareActionType) =>
    getHomeCareActionCooldownLeftMs(action, careCooldownUntilByAction, clock);
  const isCareActionLocked = actionLockedUntil > clock;

  const handleCareAction = (action: CareActionType, itemId?: ItemId) => {
    const nowMs = Date.now();
    const decision = getHomeCarePressDecision({
      action,
      nowMs,
      cooldownUntilByAction: careCooldownUntilByAction,
      actionLockedUntilMs: actionLockedUntilRef.current,
      activeWalkStatus: activeWalk?.status ?? null,
      availableTreatItemId,
      requestedItemId: itemId ?? null
    });

    if (decision.kind === "blocked" || decision.kind === "cooldown") {
      return;
    }

    if (decision.kind === "shop") {
      router.push("/shop");
      return;
    }

    setOpenCareMenu(null);

    if (firstCareGuideVisible) {
      // Ask for notification permission right after the player's very first care
      // action - never during onboarding, and never again once they've made a
      // choice. requestNotificationPermissionAfterFirstCareAction() already
      // no-ops if permission was previously granted or permanently denied.
      void requestNotificationPermissionAfterFirstCareAction();
    }

    setFirstCareGuideVisible(false);
    performCareAction(action, decision.itemId);
    const careSfxId = careActionSfxById[action];
    if (careSfxId) {
      playSfx(careSfxId);
    }
    playLightImpactHaptic();
    actionLockedUntilRef.current = decision.lockUntilMs;
    setCareActionCooldown(action, decision.cooldownUntilMs);
    setActionLockedUntil(decision.lockUntilMs);
    setLastActionSnapshot({
      action,
      previousCareState: careState,
      previousRelationshipState: relationshipState,
      actedAtMs: nowMs
    });
    setLastAction(action);

    // Night care, no penalty (docs/gamefeel-sound-plan.md §1 Tier 3): a care
    // tap during the 22:00-06:00 sleep window still fully applies (no stat
    // changed, no cooldown skipped) -- this only swaps the speech bubble to a
    // gentle "thanks, going back to sleep" line for the same brief window the
    // action's own feedback already shows, instead of the pet's usual
    // wide-awake reaction line.
    if (isNightTime(new Date(nowMs).toISOString())) {
      setNightCareAcknowledgedUntil(nowMs + homeActionFeedbackMs);
    }
  };

  const handleFloatingDockButtonPress = (action: HomeFloatingDockAction) => {
    if (isCareActionLocked) {
      return;
    }

    setOpenCareMenu((current) => (current === action ? null : action));
  };

  const handleCareButtonPress = (action: CareActionType) => {
    if (isHomeFloatingDockAction(action)) {
      handleFloatingDockButtonPress(action);
      return;
    }

    setOpenCareMenu(null);
    handleCareAction(action);
  };

  const canAffordBringHomeNow = creditBalance >= WALK_EARLY_RETURN_CREDIT_COST;

  // Transactional by construction: completeWalkEarly only mutates state (and
  // returns true) once the credit spend itself succeeds, so a tap never
  // burns a credit without the pet actually coming home early.
  const handleBringHomeNow = () => {
    if (!canAffordBringHomeNow) {
      return;
    }

    completeWalkEarly();
  };

  // "Greet & claim" used to just call claimWalkReward() directly, so the
  // domain's own discovery/collection-complete celebration reaction landed in
  // currentReaction but nothing on this screen ever looked at it once the
  // walk-returned panel unmounted — lastActionSnapshot (the only thing that
  // gated reading currentReaction below) is only ever set by handleCareAction,
  // never by a walk claim. justClaimedWalkAt gives the claim the same
  // "recently acted" window so its reaction reaches the bubble, the pet's
  // expression, and the walk-discovery/collection-complete toasts.
  const handleClaimWalkReward = () => {
    claimWalkReward();
    setJustClaimedWalkAt(Date.now());
  };

  // Butterfly visitor tap (docs/gamefeel-sound-plan.md §1 Tier 3): the
  // visitor is a momentary flight, not a memory-spine entry (out of scope
  // for this wave per the plan doc) -- catching it just picks one of the two
  // authored tap lines and gives the pet a brief curious reaction, then both
  // clear themselves the same way lastActionSnapshot's own feedback window
  // does.
  const handleButterflyCaught = () => {
    setButterflyVisitActive(false);
    setButterflyCaughtLine(pickButterflyTapLine(Math.random()));
    playLightImpactHaptic();
  };

  const handleButterflyFlownOff = () => {
    setButterflyVisitActive(false);
  };

  const reactionNow = new Date(clock).toISOString();
  const activeWeather = weatherState.settings.enabled ? weatherState.context : defaultWeatherContext;
  const weatherScene = getWeatherScenePresentation("home", activeWeather, "en-US");
  const daysAway = getCareDaysAway(careState, reactionNow);
  const ambientReaction = createInitialReaction(careState, activePet, reactionNow, recentReactions, activeWeather);
  const reaction = lastActionSnapshot || justClaimedWalkAt !== null ? currentReaction ?? ambientReaction : ambientReaction;
  const displayedCareStreak = projectCareStreakForNow(careStreak, reactionNow).current;

  // Yesterday's weather, as far as this session has observed it -- read once
  // per mount (falls back to today's condition until an effect below records
  // a real "previous" value), tracked in a ref rather than persisted state so
  // the "weather changed" episode line has something to compare against
  // without touching prototypeSession's persisted shape.
  const episodeLine = selectEpisodeLine({
    petName: activePet.name,
    memories,
    careStats,
    streak: displayedCareStreak,
    bondLevel: relationshipState.bondLevel,
    weather: activeWeather,
    previousWeatherCondition: previousWeatherConditionRef.current ?? activeWeather.condition,
    now: reactionNow,
    recentShownKeys: Array.from(shownEpisodeLineKeysRef.current)
  });
  // First bubble of the session always favors an episode line when one is
  // available; after that, a seeded ~35% roll per ambient-reaction window
  // (same 5-minute cadence as the ambient reaction seed) decides so the
  // bubble doesn't feel like it's on a fixed metronome.
  const episodeRollSeed = getAmbientReactionSeed(`${activePet.id}:episode`, careState, reactionNow, activeWeather);
  const episodeRoll = createSeededRandom(episodeRollSeed)();
  const preferEpisodeLine = isFirstHomeThoughtRef.current || episodeRoll < 0.35;
  const isShowingNightCareAcknowledgement = nightCareAcknowledgedUntil > clock;
  const homeThought = getHomeThoughtPresentation({
    petName: activePet.name,
    reaction: daysAway > 0 && !lastActionSnapshot && justClaimedWalkAt === null ? ambientReaction : reaction,
    satisfactionSummary,
    careState,
    weather: activeWeather,
    now: reactionNow,
    recentAction: lastActionSnapshot?.action ?? null,
    daysAway,
    episodeLine,
    preferEpisodeLine,
    isShowingNightCareAcknowledgement,
    momentOverrideLine: butterflyCaughtLine
  });
  const episodeLineIsShowing = Boolean(episodeLine && preferEpisodeLine && homeThought.line === episodeLine.line);

  // Records "seen this episode line" / "no longer the first bubble" / "today's
  // weather becomes tomorrow's previous weather" after each render settles --
  // deliberately after render (not during) so it never affects this render's
  // own output, only the next one.
  useEffect(() => {
    isFirstHomeThoughtRef.current = false;
    previousWeatherConditionRef.current = activeWeather.condition;

    if (episodeLineIsShowing && episodeLine) {
      shownEpisodeLineKeysRef.current.add(episodeLine.key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeThought.line]);
  // 30ms/char reads as noticeably snappier than the shared 40ms default on
  // the home bubble specifically (real-device feedback: 40ms read as "not
  // typing at all"). Chat keeps its own separate 38ms — untouched here.
  const homeThoughtTypewriter = useTypewriter({
    text: homeThought.line,
    enabled: !reduceMotionEnabled,
    msPerChar: 30
  });
  const careFeedback = lastActionSnapshot
    ? getHomeCareActionFeedbackPresentation({
        action: lastActionSnapshot.action,
        previousCareState: lastActionSnapshot.previousCareState,
        nextCareState: careState,
        previousRelationshipState: lastActionSnapshot.previousRelationshipState,
        nextRelationshipState: relationshipState,
        reward: null
      })
    : null;
  const walkSecondsLeft =
    activeWalk?.status === "walking" ? Math.max(0, Math.ceil((new Date(activeWalk.returnAt).getTime() - clock) / 1000)) : 0;
  // While walking, the pet is genuinely away from the garden — no sprite, no
  // speech bubble. It reappears the moment the walk resolves to "returned".
  const isPetOnWalk = activeWalk?.status === "walking";
  const feedCooldownLeftMs = getActionCooldownLeftMs("feed");
  // Tier 3 night sleep (docs/gamefeel-sound-plan.md §1 Tier 3): 22:00-06:00
  // local, the pet defaults to its `sleep` pose under the NightWashLayer
  // wash + NightZzzFloat -- unless something more specific is already
  // driving the expression (a just-taken care action, a claimed walk, a
  // bond-level celebration, or genuine neglect), all of which stay visible
  // so a night care tap still gets its normal brief reaction before settling
  // back to sleep (see isShowingNightSleepPose below). isNight is also read
  // to gate the daytime-only butterfly visitor and the after-night morning
  // stretch.
  const isNight = isNightTime(reactionNow);
  // Ambient expression: neglect shows on the pet's body (sad/sick/messy/hungry),
  // and a healthy idle pet cycles small autonomous behaviors so it never
  // feels frozen (see pickAutonomousBehavior / the autonomous-behavior timer
  // effect below).
  const ambientAssetState = deriveAmbientPetAssetState(careState, satisfactionSummary.tier);
  const isShowingMorningStretch = showingMorningStretchUntil > clock;
  const isShowingAutonomousBehavior = !isNight && autonomousBehaviorUntil > clock;
  const autonomousBehaviorPick = isShowingAutonomousBehavior ? pickAutonomousBehavior(autonomousBehaviorRollRef.current) : null;
  const idlePulseState: GeneratedAssetState | null = ambientAssetState === "idle" ? autonomousBehaviorPick?.expression ?? null : null;
  const isCelebratingBondLevel = celebratingBondLevelUntil > clock;
  const isShowingButterflyCaughtReaction = Boolean(butterflyCaughtLine);
  // True only when nothing more specific (action feedback, walk, celebration,
  // butterfly catch, morning stretch, genuine neglect) is already driving the
  // expression -- i.e. the moments the pet is actually shown curled up
  // asleep under NightZzzFloat, not just "it happens to be nighttime."
  const isShowingNightSleepPose =
    isNight &&
    ambientAssetState === "idle" &&
    activeWalk?.status !== "returned" &&
    justClaimedWalkAt === null &&
    !isCelebratingBondLevel &&
    !lastActionSnapshot &&
    !isShowingButterflyCaughtReaction &&
    !isShowingMorningStretch;
  const petAssetPreference =
    activeWalk?.status === "returned"
      ? "walk_return"
      // Once claimed, activeWalk clears and would otherwise fall through to
      // the generic ambient/idle expression, losing the celebrate face that
      // the domain's discovery/collection-complete reaction asked for.
      : justClaimedWalkAt !== null
        ? reaction
        : isCelebratingBondLevel
          ? "celebrate"
          : lastActionSnapshot
            ? homeActionAssetPreference[lastActionSnapshot.action]
            : isShowingButterflyCaughtReaction
              ? "curious"
              : isShowingMorningStretch
                ? "happy"
                : isShowingNightSleepPose
                  ? "sleep"
                  : ambientAssetState !== "idle"
                    ? ambientAssetState
                    : idlePulseState ?? reaction;
  const displayedPetAsset = selectGeneratedAssetForReaction(acceptedAssets, acceptedAsset, petAssetPreference);
  const petAssetId = displayedPetAsset?.id ?? activePet.activeAssetId ?? null;
  const petAssetUri = petAssetId ? generatedAssetUriById[petAssetId] ?? null : null;
  // Both the pet stage and its speech bubble used to sit at fixed pixel
  // offsets from the screen bottom, which overlapped on the smallest
  // supported screens (see homeStageLayout.ts). They now scale with the
  // actual window height/width. The bubble is sized off the *final* line
  // (homeThought.line), not the partially-typed text, so it doesn't resize
  // mid-typewriter.
  const homeThoughtBubbleLineCount = estimateHomeThoughtBubbleLineCount(homeThought.line);
  const homeThoughtBubbleHeightPx = getHomeThoughtBubbleHeightPx(homeThoughtBubbleLineCount);
  // The bubble art's rounded top/bottom walls occupy a *fraction* of the
  // container height (resizeMode:"stretch"), not a fixed px amount — a fixed
  // paddingTop/paddingBottom let text cross into the curve at the heights a
  // 2-3 line bubble needs. Padding now scales with the bubble's own height
  // (see homeStageLayout.ts's asset-geometry note) so text always lands in
  // the art's flat-wall safe zone.
  const homeThoughtBubbleVerticalPadding = getHomeThoughtBubbleVerticalPaddingPx(homeThoughtBubbleHeightPx);
  const homePetStageBottomPx = getHomePetStageBottomPx(windowHeight);
  const homeThoughtBubbleBottomPx = getHomeThoughtBubbleBottomPx(windowHeight, homeThoughtBubbleHeightPx);
  const homeStageHorizontalMarginLeftPx = getHomeStageHorizontalMarginLeftPx(windowWidth, HOME_THOUGHT_BUBBLE_WIDTH_PX);
  const hudMeters = useMemo<HudMeterConfig[]>(
    () => {
      const moodValue = Math.max(0, Math.min(100, Math.round(careState.happiness * 0.65 + careState.affection * 0.35)));

      return [
        { key: "fullness", label: "Full", value: careState.satiety, icon: "food", color: colors.coral },
        { key: "thirst", label: "Water", value: careState.gardenHealth, icon: "water", color: colors.skyDeep },
        { key: "mood", label: "Mood", value: moodValue, icon: "heart", color: colors.rose },
        { key: "energy", label: "Energy", value: careState.energy, icon: "zap", color: colors.honey }
      ];
    },
    [careState.affection, careState.energy, careState.gardenHealth, careState.happiness, careState.satiety]
  );
  const openHudMeter = hudGuideMeterKey ? hudMeters.find((meter) => meter.key === hudGuideMeterKey) ?? null : null;
  const hudGuidePresentation = openHudMeter ? getHudMeterGuidePresentation(openHudMeter.key, openHudMeter.value) : null;
  // Delta floaters ("+12") for each HUD meter, computed straight from the raw
  // before/after CareState the just-finished action left behind -- kept
  // independent of getHomeCareActionFeedbackPresentation's own label-based
  // deltas (that copy is for the HUD toast's text line, not per-gauge
  // floaters, and "mood" isn't a real CareState field so it needs its own
  // blended-value comparison to match hudMeters' own moodValue formula above).
  const hudMeterDeltaByKey: Record<HudMeterKey, number> = lastActionSnapshot
    ? {
        fullness: careState.satiety - lastActionSnapshot.previousCareState.satiety,
        thirst: careState.gardenHealth - lastActionSnapshot.previousCareState.gardenHealth,
        energy: careState.energy - lastActionSnapshot.previousCareState.energy,
        mood: Math.round(careState.happiness * 0.65 + careState.affection * 0.35) -
          Math.round(lastActionSnapshot.previousCareState.happiness * 0.65 + lastActionSnapshot.previousCareState.affection * 0.35)
      }
    : { fullness: 0, thirst: 0, energy: 0, mood: 0 };

  const floatingDockButtons = homeFloatingDockActions
    .map((action) => careButtons.find((button) => button.action === action))
    .filter((button): button is CareButtonConfig => Boolean(button));
  const recommendedDockAction = satisfactionSummary.recommendedAction
    ? isHomeFloatingDockAction(satisfactionSummary.recommendedAction)
      ? satisfactionSummary.recommendedAction
      : null
    : null;
  return (
    <View style={styles.homeRoot}>
      <ImageBackground
        accessibilityElementsHidden
        resizeMode="cover"
        source={getHomeBackgroundSource(weatherScene.backgroundKey, inventory.selectedTerrariumThemeId)}
        style={styles.homeBackground}
      >
        <View style={styles.homeSceneWash} />
        <WeatherSceneLayer overlayKey={weatherScene.overlayKey} />
      </ImageBackground>
      {isNight ? <NightWashLayer /> : null}
      <SafeAreaView accessibilityLabel={`${activePet.name}'s playable tiny garden home. ${weatherScene.accessibilityLabel}`} edges={["left", "right"]} style={styles.homeSafe}>
        <Text accessibilityRole="header" style={[styles.screenReaderTitle, { fontFamily: fontFamilies.display }]}>
          {activePet.name}'s tiny garden
        </Text>
        {/* scene="garden" full-screen home canvas */}
        <View style={styles.gameHud}>
          <View accessibilityLabel="Tiny garden game HUD" style={styles.resourceBar}>
            {hudMeters.map((meter) => (
              <Pressable
                key={meter.key}
                accessibilityRole="button"
                accessibilityLabel={`${meter.label} status. Tap for details.`}
                hitSlop={4}
                style={styles.resourceChip}
                onPress={() => setHudGuideMeterKey(meter.key)}
              >
                <View style={styles.resourceIconFrame}>
                  <Image
                    accessibilityIgnoresInvertColors
                    accessibilityLabel={`${meter.label} HUD art`}
                    resizeMode="contain"
                    source={hudButtonAssets[meter.icon]}
                    style={styles.resourceButtonIcon}
                  />
                </View>
                <AnimatedResourceTrack color={meter.color} value={meter.value} />
                {hudMeterDeltaByKey[meter.key] !== 0 ? (
                  <HudDeltaFloater
                    key={`${meter.key}-${lastActionSnapshot?.actedAtMs ?? "none"}`}
                    meterKey={meter.key}
                    value={hudMeterDeltaByKey[meter.key]}
                  />
                ) : null}
                <View style={styles.resourceTextGroup}>
                  <Text style={[styles.resourceValue, { fontFamily: fontFamilies.label }]}>{meter.value}</Text>
                  <Text style={[styles.resourceLabel, { fontFamily: fontFamilies.label }]}>{meter.label}</Text>
                </View>
              </Pressable>
            ))}
          </View>
          {careFeedback ? (
            <AnimatedCareFeedbackToast key={lastActionSnapshot?.actedAtMs ?? "none"} feedback={careFeedback} />
          ) : null}
        </View>

        <View pointerEvents="box-none" style={styles.sceneSideRailLeft}>
          <SceneRailButton
            accessibilityLabel="Open shop"
            delayMs={0}
            imageLabel="Shop button art"
            source={sideRailButtonAssets.shop}
            onPress={() => router.push("/shop")}
          />
          <SceneRailButton
            accessibilityLabel={`Open ${activePet.name}'s chat`}
            delayMs={180}
            imageLabel="Chat button art"
            source={sideRailButtonAssets.chat}
            onPress={() => router.push("/chat")}
          />
        </View>

        <View pointerEvents="box-none" style={styles.sceneSideRailRight}>
          <FriendRailButton
            accessibilityLabel={`Open ${activePet.name}'s friend page`}
            showBadge={showFriendEntryBadge}
            onPress={() => router.push("/friend")}
          />
          <SceneRailButton
            accessibilityLabel="Open settings"
            delayMs={360}
            imageLabel="Settings button art"
            source={sideRailButtonAssets.settings}
            onPress={() => router.push("/settings")}
          />
        </View>

        <View pointerEvents="box-none" style={styles.stageLayer}>
          {isPetOnWalk ? (
            // Pet is away on the path: no sprite, no speech bubble — the
            // paw trail below carries the "gone for a walk" read instead of
            // an idle pet standing in an empty conversation.
            <View pointerEvents="none" style={styles.walkPawsLayer}>
              <LottieAnimation
                accessibilityLabel={`${activePet.name} walking paw steps`}
                loop
                source={pawsAnimation}
                style={styles.walkPawsAnimation}
              />
            </View>
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Pet ${activePet.name}`}
                accessibilityHint={`Long press to open ${activePet.name}'s friend page`}
                disabled={isCareActionLocked}
                style={[styles.homePetStage, { bottom: homePetStageBottomPx }]}
                onPress={() => handleCareAction("affection")}
                onPressIn={() => setPetPressed(true)}
                onPressOut={() => setPetPressed(false)}
                onLongPress={() => router.push("/friend")}
              >
                <View style={styles.homePetShadow} />
                <Animated.View
                  style={
                    reduceMotionEnabled
                      ? undefined
                      : {
                          transform: [
                            {
                              translateX: walkGreetEntrance.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, windowWidth * 0.6]
                              })
                            },
                            { scale: petPressed ? 0.94 : 1 }
                          ]
                        }
                  }
                >
                  <BreathingPetLayer>
                    <GeneratedPetAssetImage
                      accessibilityLabel="Generated pet avatar"
                      assetId={petAssetId ?? null}
                      remoteUri={petAssetUri ?? null}
                      style={styles.homePetSprite}
                    />
                  </BreathingPetLayer>
                </Animated.View>
              </Pressable>
              <Pressable
                accessibilityHint={homeThoughtTypewriter.isComplete ? undefined : "Tap to show the full message now."}
                accessibilityLabel={homeThought.accessibilityLabel}
                accessibilityRole="button"
                // The absolute-position anchor must live on this Pressable: its
                // parent (stageLayer) is the intended positioning ancestor. If the
                // absolute style sits on the ImageBackground instead, it anchors to
                // this zero-sized Pressable and the bubble renders off-screen.
                // Horizontal centering and vertical placement are computed from
                // the actual window size (homeStageLayout.ts) rather than a
                // parent-relative `left: "50%"`, so they can't drift off-center
                // or overlap the pet on smaller screens — see fix notes there.
                style={[
                  styles.homeThoughtBubble,
                  { bottom: homeThoughtBubbleBottomPx, marginLeft: homeStageHorizontalMarginLeftPx }
                ]}
                onPress={homeThoughtTypewriter.skip}
              >
                <ImageBackground
                  imageStyle={styles.homeThoughtBubbleImage}
                  importantForAccessibility="no"
                  resizeMode="stretch"
                  source={speechBubbleAsset}
                  style={[
                    styles.homeThoughtBubbleInner,
                    {
                      minHeight: homeThoughtBubbleHeightPx,
                      paddingTop: homeThoughtBubbleVerticalPadding.top,
                      paddingBottom: homeThoughtBubbleVerticalPadding.bottom
                    }
                  ]}
                >
                  <Text
                    numberOfLines={HOME_THOUGHT_BUBBLE_MAX_LINES}
                    style={[styles.homeThoughtText, { fontFamily: fontFamilies.bubble }]}
                  >
                    {homeThoughtTypewriter.displayedText}
                  </Text>
                </ImageBackground>
              </Pressable>
              <CareMomentLayer
                action={lastActionSnapshot?.action ?? null}
                actedAtMs={lastActionSnapshot?.actedAtMs ?? null}
                petStageBottomPx={homePetStageBottomPx}
              />
              {isShowingNightSleepPose ? (
                <NightZzzFloat petStageBottomPx={homePetStageBottomPx} reduceMotionEnabled={reduceMotionEnabled} />
              ) : null}
              {butterflyVisitActive && !isNight ? (
                <ButterflyVisitorLayer
                  reduceMotionEnabled={reduceMotionEnabled}
                  windowHeight={windowHeight}
                  windowWidth={windowWidth}
                  onCaught={handleButterflyCaught}
                  onFlownOff={handleButterflyFlownOff}
                />
              ) : null}
            </>
          )}
          {eventToastQueue[0] ? (
            <HomeEventToast
              key={eventToastQueue[0].id}
              accessibilityLabel={eventToastQueue[0].accessibilityLabel}
              line={eventToastQueue[0].line}
              onDone={dismissCurrentEventToast}
            />
          ) : null}
        </View>

      {activeWalk?.status === "walking" ? (
        <View style={styles.walkPanel}>
          <Text style={[styles.walkPanelTitle, { fontFamily: fontFamilies.body }]}>
            {activePet.name} is on the path · back in {formatCooldownBadge(walkSecondsLeft * 1000)}
          </Text>
          <View style={styles.walkPanelButtons}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                canAffordBringHomeNow
                  ? `Spend 1 credit to bring ${activePet.name} home right now`
                  : `Not enough credits to bring ${activePet.name} home right now`
              }
              accessibilityState={{ disabled: !canAffordBringHomeNow }}
              disabled={!canAffordBringHomeNow}
              style={({ pressed }) => [
                styles.walkPanelButton,
                pressed ? styles.walkPanelButtonPressed : null,
                !canAffordBringHomeNow ? styles.walkPanelButtonDisabled : null
              ]}
              onPress={handleBringHomeNow}
            >
              <GameItemImage accessibilityLabel="Coin currency" decorative item="coin" style={styles.walkPanelButtonCoinIcon} variant="hud" />
              <Text style={[styles.walkPanelButtonText, { fontFamily: fontFamilies.button }]}>Bring home now · {WALK_EARLY_RETURN_CREDIT_COST}</Text>
            </Pressable>
          </View>
          {!canAffordBringHomeNow ? (
            <Text style={[styles.walkPanelHint, { fontFamily: fontFamilies.body }]}>{activePet.name} will be back soon — hang tight.</Text>
          ) : null}
        </View>
      ) : null}

      {activeWalk?.status === "returned" ? (
        <View style={styles.walkPanel}>
          <Text style={[styles.walkPanelTitle, { fontFamily: fontFamilies.body }]}>
            {activePet.name} is back with a little gift!
          </Text>
          <View style={styles.walkPanelButtons}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Greet ${activePet.name} and claim the walk gift`}
              style={({ pressed }) => [styles.walkPanelButton, styles.walkPanelButtonClaim, pressed ? styles.walkPanelButtonPressed : null]}
              onPress={handleClaimWalkReward}
            >
              <Gift color={colors.ink} size={15} strokeWidth={2.8} />
              <Text style={[styles.walkPanelButtonText, { fontFamily: fontFamilies.button }]}>Greet & claim</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {firstCareGuideVisible && !welcomeVisible ? (
        <View pointerEvents="none" style={styles.firstCareGuide}>
          <Text style={[styles.firstCareGuideText, { fontFamily: fontFamilies.body }]}>
            {satisfactionSummary.recommendedActionLabel
              ? `Try "${satisfactionSummary.recommendedActionLabel}" first — ${activePet.name} will love it.`
              : `Tap a care button below to look after ${activePet.name}.`}
          </Text>
          <View style={styles.firstCareGuideArrow} />
        </View>
      ) : null}

      {openCareMenu ? (
        <HomeCareActionTray
          action={openCareMenu}
          activePetName={activePet.name}
          getCooldownLeftMs={getActionCooldownLeftMs}
          isCareActionLocked={isCareActionLocked}
          options={visibleCareMenuOptions}
          onOpenShop={() => router.push("/shop")}
          onSelectOption={handleCareAction}
        />
      ) : null}

      <View style={styles.careGrid}>
        {floatingDockButtons.map(({ action, label, Icon, buttonAsset, color, item }) => {
          const cooldownLeftMs = getActionCooldownLeftMs(action);
          const actionDisabled = isCareActionLocked || (action === "walk" && activeWalk?.status === "walking");
          const cooldownSecondsLeft =
            action === "walk" && activeWalk?.status === "walking" ? walkSecondsLeft : Math.ceil(cooldownLeftMs / 1000);
          const cooldownBadgeLabel =
            action === "walk" && activeWalk?.status === "walking"
              ? formatCooldownBadge(walkSecondsLeft * 1000)
              : cooldownLeftMs > 0
                ? formatCooldownBadge(cooldownLeftMs)
                : "";
          const accessibilityLabel =
            action === "feed"
              ? feedCooldownLeftMs > 0
                ? `Feed menu. Daily meal cooldown ${formatCooldownBadge(feedCooldownLeftMs)}. Treats may still be available.`
                : `Feed menu for ${activePet.name}.`
              : action === "walk" && activeWalk?.status === "walking"
                ? `Walk is active. ${activePet.name} returns in ${walkSecondsLeft} seconds.`
                : cooldownLeftMs > 0
                  ? `${label} menu. Basic option cooldown ${formatCooldownBadge(cooldownLeftMs)}. Special items may still be available.`
                  : recommendedDockAction === action
                    ? `Recommended: ${label} ${activePet.name}. ${satisfactionSummary.hint}`
                    : `${label} ${activePet.name}`;

          return (
            <Pressable
              key={action}
              accessibilityRole="button"
              accessibilityLabel={accessibilityLabel}
              accessibilityState={{ disabled: actionDisabled }}
              disabled={actionDisabled}
              style={[
                styles.careButton,
                buttonAsset ? styles.careButtonAssetShell : { backgroundColor: color },
                recommendedDockAction === action ? styles.careButtonRecommended : null,
                openCareMenu === action ? styles.careButtonMenuOpen : null,
                lastAction === action ? styles.careButtonActive : null,
                actionDisabled ? styles.careButtonDisabled : null
              ]}
              onPress={() => handleCareButtonPress(action)}
            >
              {buttonAsset ? (
                <Image
                  accessibilityIgnoresInvertColors
                  accessibilityLabel={`${label} care icon`}
                  resizeMode="contain"
                  source={buttonAsset}
                  style={[
                    styles.careButtonImage,
                    action === "feed" ? styles.careButtonImageFeed : null,
                    action === "play" ? styles.careButtonImagePlay : null,
                    action === "walk" ? styles.careButtonImageWalk : null,
                    action === "affection" ? styles.careButtonImageAffection : null
                  ]}
                />
              ) : item ? (
                <GameItemImage accessibilityLabel={`${label} care item`} decorative item={item} style={styles.careItemIcon} variant="action" />
              ) : (
                <Icon color={colors.white} size={25} strokeWidth={2.8} />
              )}
              <Text style={[styles.careButtonText, { fontFamily: fontFamilies.label }]}>{label}</Text>
              {cooldownSecondsLeft > 0 ? (
                <View pointerEvents="none" style={styles.careCooldownBadge}>
                  <Text numberOfLines={1} style={[styles.careCooldownText, { fontFamily: fontFamilies.label }]}>
                    {cooldownBadgeLabel}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {originalPhotoDeletedAt ? (
        <View style={styles.privacyNotice}>
          <Text style={[styles.privacyNoticeText, { fontFamily: fontFamilies.body }]}>Original photo deleted for this session.</Text>
        </View>
      ) : null}

      <Modal
        animationType="fade"
        transparent
        visible={hudGuidePresentation !== null}
        onRequestClose={() => setHudGuideMeterKey(null)}
      >
        <Pressable
          accessibilityLabel="Close gauge guide"
          style={styles.hudGuideBackdrop}
          onPress={() => setHudGuideMeterKey(null)}
        >
          <Pressable accessibilityViewIsModal style={styles.hudGuideCard} onPress={(event) => event.stopPropagation()}>
            <Text accessibilityRole="header" style={[styles.hudGuideTitle, { fontFamily: fontFamilies.title }]}>
              {hudGuidePresentation?.title}
            </Text>
            {/*
              Action-guidance-first: the care-button icon(s) that resolve this
              meter plus a 1-line "what fixes this" come before the status
              line, so tapping a meter always answers "what do I do" first —
              see the redesign note on getHudMeterGuidePresentation. The old
              streak-summary row was removed entirely; the friend page is the
              one place that shows the care streak now.
            */}
            <View style={styles.hudGuideActionRow}>
              <View style={styles.hudGuideActionIconFrame}>
                {hudGuidePresentation?.actionIcons.map((icon, index) => (
                  <View key={`${icon}-${index}`} style={styles.hudGuideActionIcon}>
                    {renderCareFeedbackIcon(icon)}
                  </View>
                ))}
              </View>
              <Text style={[styles.hudGuideHowTo, { fontFamily: fontFamilies.body }]}>{hudGuidePresentation?.howTo}</Text>
            </View>
            <Text style={[styles.hudGuideBody, { fontFamily: fontFamilies.body }]}>{hudGuidePresentation?.description}</Text>
            <View style={styles.hudGuideStatusPill}>
              <Text style={[styles.hudGuideStatusText, { fontFamily: fontFamilies.label }]}>{hudGuidePresentation?.statusLine}</Text>
            </View>
            <Pressable accessibilityRole="button" style={styles.hudGuideCloseButton} onPress={() => setHudGuideMeterKey(null)}>
              <Text style={[styles.hudGuideCloseButtonText, { fontFamily: fontFamilies.button }]}>Got it</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal animationType="fade" transparent visible={welcomeVisible} onRequestClose={dismissWelcome}>
        <View style={styles.welcomeBackdrop}>
          <View accessibilityViewIsModal style={styles.welcomeCard}>
            <Text accessibilityRole="header" style={[styles.welcomeTitle, { fontFamily: fontFamilies.title }]}>
              Welcome to {activePet.name}'s tiny garden
            </Text>
            <Text style={[styles.welcomeBody, { fontFamily: fontFamilies.body }]}>
              {activePet.name} now lives here and counts on you for little moments of care.
            </Text>
            <View style={styles.welcomeTipRow}>
              <Utensils color={colors.coral} size={16} strokeWidth={2.8} />
              <Text style={[styles.welcomeTipText, { fontFamily: fontFamilies.body }]}>Feed, water, play, and pet to keep the meters up.</Text>
            </View>
            <View style={styles.welcomeTipRow}>
              <MessageCircle color={colors.skyDeep} size={16} strokeWidth={2.8} />
              <Text style={[styles.welcomeTipText, { fontFamily: fontFamilies.body }]}>The speech bubble tells you what {activePet.name} needs right now.</Text>
            </View>
            <View style={styles.welcomeTipRow}>
              <Flame color={colors.honey} size={16} strokeWidth={2.8} />
              <Text style={[styles.welcomeTipText, { fontFamily: fontFamilies.body }]}>Come back every day to grow your care streak.</Text>
            </View>
            <Pressable accessibilityRole="button" style={styles.welcomeButton} onPress={dismissWelcome}>
              <Text style={[styles.welcomeButtonText, { fontFamily: fontFamilies.button }]}>Start caring</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  homeRoot: {
    flex: 1,
    backgroundColor: colors.sky,
    overflow: "hidden"
  },
  homeBackground: {
    position: "absolute",
    top: -96,
    right: 0,
    bottom: -96,
    left: 0,
    backgroundColor: colors.sky
  },
  homeSafe: {
    flex: 1,
    backgroundColor: "transparent"
  },
  screenReaderTitle: {
    position: "absolute",
    left: -1000,
    top: 0,
    width: 1,
    height: 1,
    opacity: 0
  },
  homeSceneWash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(255,255,255,0.02)"
  },
  homeContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md
  },
  homeInner: {
    gap: spacing.sm
  },
  gameHud: {
    position: "absolute",
    top: 58,
    left: 18,
    right: 18,
    zIndex: 180
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm
  },
  headerCopy: {
    flex: 1,
    minWidth: 0
  },
  namePlate: {
    flex: 1,
    minWidth: 0,
    minHeight: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: "rgba(255,255,255,0.88)",
    backgroundColor: "rgba(255,232,199,0.98)",
    paddingHorizontal: spacing.md,
    justifyContent: "center"
  },
  eyebrow: {
    color: colors.woodDark,
    fontSize: 8,
    lineHeight: 9,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  title: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 18,
    fontWeight: "900",
    flexShrink: 1
  },
  headerActions: {
    flexDirection: "row",
    flexShrink: 0,
    gap: 6,
    display: "none"
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.parchment,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.cream,
    ...shadows.tile
  },
  resourceBar: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "space-between"
  },
  resourceChip: {
    flex: 1,
    height: 31,
    borderRadius: 22,
    backgroundColor: "#20283F",
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.cream,
    paddingLeft: 35,
    paddingRight: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    overflow: "visible",
    position: "relative"
  },
  resourceIcon: {
    width: 27,
    height: 27
  },
  resourceIconFrame: {
    position: "absolute",
    left: -8,
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2
  },
  resourceButtonIcon: {
    width: 43,
    height: 43
  },
  resourceTrack: {
    flex: 1,
    height: 12,
    minWidth: 14,
    borderRadius: 6,
    backgroundColor: "rgba(12,18,34,0.48)",
    borderWidth: 1,
    borderColor: "rgba(255,245,222,0.26)",
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
    padding: 2
  },
  resourceSegment: {
    flex: 1,
    height: "100%",
    borderRadius: 3,
    backgroundColor: "rgba(255,245,222,0.12)"
  },
  hudDeltaFloater: {
    position: "absolute",
    top: -16,
    right: 6,
    zIndex: 6
  },
  hudDeltaFloaterText: {
    color: colors.cream,
    fontSize: 12,
    fontWeight: "900",
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2
  },
  resourceTextGroup: {
    display: "none"
  },
  resourceValue: {
    color: colors.cream,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "900"
  },
  resourceLabel: {
    color: "rgba(255,245,222,0.78)",
    fontSize: 6,
    lineHeight: 7,
    fontWeight: "900",
    textTransform: "uppercase",
    display: "none"
  },
  walkPanel: {
    position: "absolute",
    bottom: 118,
    left: 28,
    right: 28,
    borderRadius: 18,
    backgroundColor: "rgba(255,245,222,0.96)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    zIndex: 230
  },
  walkPanelTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center"
  },
  walkPanelButtons: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8
  },
  walkPanelButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 14,
    backgroundColor: colors.honey,
    borderWidth: 2,
    borderBottomWidth: 3,
    borderColor: "rgba(255,255,255,0.85)",
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  walkPanelButtonClaim: {
    backgroundColor: colors.apple
  },
  walkPanelButtonPressed: {
    transform: [{ translateY: 1 }],
    borderBottomWidth: 2
  },
  walkPanelButtonDisabled: {
    opacity: 0.5
  },
  walkPanelButtonCoinIcon: {
    width: 18,
    height: 18
  },
  walkPanelButtonText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900"
  },
  walkPanelHint: {
    color: colors.mutedInk,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    textAlign: "center"
  },
  firstCareGuide: {
    position: "absolute",
    bottom: 118,
    left: 32,
    right: 32,
    alignItems: "center",
    zIndex: 240
  },
  firstCareGuideText: {
    color: colors.ink,
    backgroundColor: "rgba(255,245,222,0.97)",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
    textAlign: "center",
    overflow: "hidden"
  },
  firstCareGuideArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "rgba(255,245,222,0.97)"
  },
  welcomeBackdrop: {
    flex: 1,
    backgroundColor: "rgba(24,28,44,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg
  },
  welcomeCard: {
    width: "100%",
    maxWidth: 340,
    borderRadius: radii.panel,
    backgroundColor: "rgba(255,248,232,0.99)",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.9)",
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.gamePanel
  },
  welcomeTitle: {
    color: colors.ink,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "900"
  },
  welcomeBody: {
    color: colors.mutedInk,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700"
  },
  welcomeTipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: 2
  },
  welcomeTipText: {
    flex: 1,
    color: colors.ink,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700"
  },
  welcomeButton: {
    marginTop: spacing.sm,
    borderRadius: 18,
    backgroundColor: colors.honey,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: "rgba(255,255,255,0.85)",
    paddingVertical: 11,
    alignItems: "center"
  },
  welcomeButtonText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900"
  },
  hudGuideBackdrop: {
    flex: 1,
    backgroundColor: "rgba(24,28,44,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg
  },
  hudGuideCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: radii.panel,
    backgroundColor: "rgba(255,248,232,0.99)",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.9)",
    padding: spacing.lg,
    gap: 10,
    ...shadows.gamePanel
  },
  hudGuideTitle: {
    color: colors.ink,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "900",
    textAlign: "center"
  },
  // Action-guidance row: the care-button icon(s) that fix this meter, next
  // to the 1-line "what fixes this" copy -- leads the popup so tapping a
  // meter answers "what do I do" before "how is it doing" (hudGuideBody /
  // hudGuideStatusPill below it). See getHudMeterGuidePresentation.
  hudGuideActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.panel,
    backgroundColor: "rgba(255,232,199,0.55)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.8)",
    padding: spacing.sm
  },
  hudGuideActionIconFrame: {
    flexDirection: "row",
    flexShrink: 0,
    gap: 6
  },
  hudGuideActionIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: colors.cream,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.84)",
    alignItems: "center",
    justifyContent: "center"
  },
  hudGuideHowTo: {
    flex: 1,
    color: colors.ink,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
    textAlign: "left"
  },
  hudGuideBody: {
    color: colors.mutedInk,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    textAlign: "center"
  },
  hudGuideStatusPill: {
    alignSelf: "center",
    borderRadius: 14,
    backgroundColor: "rgba(255,232,199,0.9)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)",
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  hudGuideStatusText: {
    color: colors.woodDark,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    textAlign: "center"
  },
  hudGuideCloseButton: {
    marginTop: spacing.xs,
    borderRadius: 18,
    backgroundColor: colors.honey,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: "rgba(255,255,255,0.85)",
    paddingVertical: 11,
    alignItems: "center"
  },
  hudGuideCloseButtonText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900"
  },
  hudFeedbackToast: {
    alignSelf: "center",
    marginTop: 9,
    maxWidth: 262,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,245,222,0.94)",
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: "rgba(255,255,255,0.9)",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingLeft: 7,
    paddingRight: 12,
    zIndex: 220,
    ...shadows.tile
  },
  terrarium: {
    gap: spacing.sm
  },
  homeScene: {
    minHeight: 452,
    borderRadius: 30,
    borderWidth: 4,
    borderBottomWidth: 7,
    borderColor: "rgba(255,245,222,0.95)",
    ...shadows.gamePanel
  },
  stageLayer: {
    position: "absolute",
    top: 82,
    right: 0,
    bottom: 104,
    left: 0
  },
  // Low, off-center "grass band" trail: crosses the garden floor in front of
  // where the pet normally stands, instead of stamping on top of the pet's
  // body (the pet is hidden during the walk anyway) or a decor slot — decor
  // near-slots sit around 71-75% of window height, this stays below them.
  walkPawsLayer: {
    position: "absolute",
    left: "18%",
    bottom: 64,
    width: 132,
    height: 132,
    opacity: 0.82,
    zIndex: 40
  },
  walkPawsAnimation: {
    width: "100%",
    height: "100%"
  },
  rightCharm: {
    position: "absolute",
    top: 74,
    right: 4,
    width: 86,
    height: 138,
    zIndex: 70,
    alignItems: "center"
  },
  rightCharmIcon: {
    width: 84,
    height: 128
  },
  floatingHouse: {
    position: "absolute",
    left: 22,
    bottom: 198,
    width: 78,
    height: 78,
    zIndex: 16
  },
  floatingBed: {
    position: "absolute",
    left: 106,
    bottom: 222,
    width: 88,
    height: 88,
    zIndex: 24
  },
  floatingPond: {
    position: "absolute",
    left: 26,
    bottom: 96,
    width: 132,
    height: 96,
    zIndex: 18
  },
  floatingPot: {
    position: "absolute",
    right: 52,
    bottom: 210,
    width: 76,
    height: 76,
    zIndex: 26
  },
  floatingPotImage: {
    width: "100%",
    height: "100%"
  },
  floatingLantern: {
    position: "absolute",
    right: 28,
    bottom: 150,
    width: 70,
    height: 70,
    zIndex: 52
  },
  walkStartBubble: {
    position: "absolute",
    left: 66,
    bottom: 236,
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 124
  },
  walkStartIcon: {
    width: 72,
    height: 72
  },
  homePetStage: {
    position: "absolute",
    alignSelf: "center",
    bottom: 170,
    width: 218,
    height: 218,
    zIndex: 55,
    alignItems: "center",
    justifyContent: "flex-end"
  },
  homePetShadow: {
    position: "absolute",
    bottom: 10,
    width: 140,
    height: 30,
    borderRadius: 999,
    backgroundColor: "rgba(60,45,35,0.24)"
  },
  homePetSprite: {
    width: 214,
    height: 214
  },
  gardenFeedbackBubble: {
    position: "absolute",
    right: 40,
    bottom: 288,
    minWidth: 78,
    height: 34,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: "rgba(255,245,222,0.92)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    zIndex: 124,
    ...shadows.tile
  },
  gardenFeedbackBloom: {
    minWidth: 118
  },
  gardenFeedbackText: {
    color: colors.skyDeep,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "900"
  },
  careFeedbackBubble: {
    position: "absolute",
    right: 24,
    bottom: 286,
    maxWidth: 206,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,245,222,0.94)",
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: "rgba(255,255,255,0.9)",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingLeft: 7,
    paddingRight: 12,
    zIndex: 132,
    ...shadows.tile
  },
  careFeedbackReward: {
    backgroundColor: "rgba(244,255,240,0.96)"
  },
  careFeedbackTradeoff: {
    backgroundColor: "rgba(232,247,255,0.94)"
  },
  careFeedbackIconFrame: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cream,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.84)",
    alignItems: "center",
    justifyContent: "center"
  },
  careFeedbackItemIcon: {
    width: 30,
    height: 30
  },
  careFeedbackCopy: {
    flex: 1,
    minWidth: 0
  },
  careFeedbackTitle: {
    color: colors.woodDark,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "900"
  },
  careFeedbackLine: {
    color: colors.ink,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "900"
  },
  homeThoughtBubble: {
    // left/bottom/marginLeft are overridden inline in TerrariumHomeScreen
    // with values derived from the actual window size (homeStageLayout.ts)
    // — left stays 0 here (not "50%") because centering is done entirely via
    // the dynamic marginLeft, computed against windowWidth.
    position: "absolute",
    left: 0,
    bottom: 406,
    width: HOME_THOUGHT_BUBBLE_WIDTH_PX,
    marginLeft: -HOME_THOUGHT_BUBBLE_WIDTH_PX / 2,
    zIndex: 95,
    overflow: "visible"
  },
  homeThoughtBubbleInner: {
    // minHeight/paddingTop/paddingBottom are all overridden inline with
    // values derived from the estimated line count (homeStageLayout.ts) —
    // the vertical padding must scale with the container height because the
    // bubble art's rounded top/bottom walls are a fraction of that height,
    // not a fixed px band (see the geometry note in homeStageLayout.ts).
    // The values below are just a 2-line fallback before that computation.
    // Width must be the explicit bubble width, not "100%": with a percentage
    // width here the rendered box came out at (bubble width - horizontal
    // padding) = 218, leaving the stretched art narrower than the text
    // (measured via onLayout on device). And no flexDirection:"row" — RN Text
    // children of a row don't shrink by default, so long lines refused to
    // wrap and bled past the art's right edge.
    width: HOME_THOUGHT_BUBBLE_WIDTH_PX,
    minHeight: 103,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 30,
    paddingBottom: 38
  },
  homeThoughtBubbleImage: {
    resizeMode: "stretch"
  },
  homeEventToast: {
    position: "absolute",
    left: "50%",
    bottom: 486,
    width: 252,
    marginLeft: -126,
    borderRadius: 20,
    backgroundColor: "rgba(255,245,222,0.96)",
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    zIndex: 210,
    ...shadows.tile
  },
  homeEventToastText: {
    color: colors.woodDark,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "900",
    textAlign: "center"
  },
  homeThoughtTail: {
    position: "absolute",
    left: "48%",
    bottom: -12,
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: "#FFF3D9",
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderColor: colors.cream,
    transform: [{ rotate: "45deg" }]
  },
  homeThoughtIconFrame: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center"
  },
  homeThoughtItemIcon: {
    width: 30,
    height: 30
  },
  homeThoughtText: {
    // fontSize/lineHeight match the chat bubble's petThoughtText exactly
    // (ChatGateScreen) -- see homeStageLayout.ts's BUBBLE_APPROX_CHAR_WIDTH_PX
    // / BUBBLE_LINE_HEIGHT_PX comments for the layout-math implications of
    // this size (bubble width was widened to compensate).
    color: colors.ink,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    textAlign: "center"
  },
  dome: {
    minHeight: 330,
    borderRadius: radii.card,
    overflow: "hidden",
    backgroundColor: colors.sky,
    alignItems: "center",
    justifyContent: "flex-end",
    borderWidth: 1,
    borderColor: colors.line
  },
  cloud: {
    position: "absolute",
    top: 54,
    left: 42,
    width: 100,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.82)"
  },
  sun: {
    position: "absolute",
    top: 42,
    right: 48,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.yellow
  },
  ground: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    height: 122,
    backgroundColor: colors.mint,
    borderTopLeftRadius: 120,
    borderTopRightRadius: 120,
    borderTopWidth: 14,
    borderTopColor: colors.apple
  },
  petAsset: {
    width: 132,
    height: 132,
    marginBottom: 48
  },
  petReturned: {
    transform: [{ translateY: -5 }]
  },
  walkTrail: {
    position: "absolute",
    alignSelf: "center",
    bottom: 238,
    width: 104,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.5)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.8)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 70
  },
  walkTrailIcon: {
    width: 46,
    height: 46,
    marginBottom: -4
  },
  walkTrailText: {
    color: colors.skyDeep,
    fontSize: 13,
    fontWeight: "900"
  },
  // Left rail: shop + chat. Right rail (sceneSideRailRight) mirrors this same
  // top offset on the opposite edge -- see the friend/settings split note
  // there for why the 4-button stack was divided this way.
  sceneSideRailLeft: {
    position: "absolute",
    left: 14,
    top: 126,
    gap: 16,
    zIndex: 160
  },
  // Right rail: friend (paw) + settings. Splitting the old single 4-button
  // left stack into 2+2 on opposite edges keeps neither rail from crowding
  // the pet stage/speech bubble and gives the friend entry (with its unread-
  // letter badge) a more prominent, symmetric position instead of being
  // buried at the bottom of a tall stack.
  sceneSideRailRight: {
    position: "absolute",
    right: 14,
    top: 126,
    gap: 16,
    zIndex: 160,
    alignItems: "center"
  },
  sceneRailButton: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderWidth: 0
  },
  sceneRailButtonPressed: {
    transform: [{ scale: 0.92 }],
    opacity: 0.85
  },
  sceneRailButtonImage: {
    width: 58,
    height: 58
  },
  friendRailButton: {
    width: 50,
    height: 50,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    backgroundColor: "rgba(255,245,222,0.94)",
    borderWidth: 3,
    borderBottomWidth: 5,
    borderColor: "rgba(255,255,255,0.86)",
    ...shadows.tile
  },
  friendRailButtonPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 3
  },
  friendRailBadgeDot: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.coral,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.94)"
  },
  pond: {
    position: "absolute",
    bottom: 76,
    left: 42,
    width: 84,
    height: 34,
    borderRadius: 20,
    backgroundColor: "rgba(75,169,217,0.68)"
  },
  bridge: {
    position: "absolute",
    bottom: 94,
    left: 54,
    width: 62,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#B88957",
    transform: [{ rotate: "-8deg" }]
  },
  house: {
    position: "absolute",
    bottom: 90,
    right: 46,
    width: 54,
    height: 50,
    borderRadius: 12,
    backgroundColor: "#FFB36B",
    borderTopWidth: 14,
    borderTopColor: colors.coral
  },
  bowl: {
    position: "absolute",
    bottom: 54,
    left: 70,
    width: 48,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.yellow
  },
  ball: {
    position: "absolute",
    bottom: 64,
    right: 76,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.skyDeep
  },
  flowerOne: {
    position: "absolute",
    bottom: 116,
    left: 145,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.coral
  },
  flowerTwo: {
    position: "absolute",
    bottom: 126,
    left: 168,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.yellow
  },
  sceneSpeechBubble: {
    position: "absolute",
    left: 68,
    right: 22,
    bottom: 16,
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 3,
    borderBottomWidth: 5,
    borderColor: "rgba(255,255,255,0.9)",
    backgroundColor: "rgba(255,245,222,0.94)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: "center",
    ...shadows.tile
  },
  sceneSpeechText: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800"
  },
  actionText: {
    color: colors.mutedInk,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "800",
    marginTop: spacing.sm,
    textTransform: "capitalize"
  },
  meters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    display: "none"
  },
  meterCard: {
    width: "48.7%",
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "rgba(255,245,222,0.94)",
    borderWidth: 2,
    borderBottomWidth: 3,
    borderColor: "rgba(255,255,255,0.7)",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: 5,
    ...shadows.tile
  },
  meterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.xs
  },
  meterTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexShrink: 1
  },
  meterLabel: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "800"
  },
  meterTrack: {
    height: 9,
    borderRadius: 5,
    backgroundColor: "rgba(84,62,42,0.18)",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.64)"
  },
  meterFill: {
    height: "100%",
    borderRadius: 5
  },
  meterValue: {
    textAlign: "right",
    color: colors.mutedInk,
    fontSize: 12,
    fontWeight: "900"
  },
  feedActionTray: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 152,
    zIndex: 220,
    borderRadius: 26,
    backgroundColor: "rgba(255,245,222,0.94)",
    borderWidth: 3,
    borderBottomWidth: 5,
    borderColor: "rgba(255,255,255,0.9)",
    padding: 10,
    gap: 8,
    ...shadows.tile
  },
  feedActionTrayTitle: {
    color: colors.woodDark,
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "900",
    textAlign: "center",
    textTransform: "uppercase"
  },
  feedActionOptions: {
    flexDirection: "row",
    gap: 8
  },
  feedActionOption: {
    width: 96,
    minHeight: 88,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.76)",
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    paddingVertical: 7,
    gap: 2
  },
  feedActionOptionShop: {
    backgroundColor: "rgba(244,255,240,0.9)"
  },
  feedActionOptionDisabled: {
    opacity: 0.5
  },
  feedActionOptionIconFrame: {
    width: 46,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible"
  },
  feedActionOptionIcon: {
    width: 42,
    height: 42
  },
  feedActionOptionTitle: {
    color: colors.ink,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "900"
  },
  feedActionOptionMeta: {
    color: colors.mutedInk,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "900"
  },
  careGrid: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 72,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 190
  },
  careButton: {
    width: 70,
    height: 70,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible"
  },
  careButtonAssetShell: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderBottomWidth: 0
  },
  careItemIcon: {
    width: 60,
    height: 60
  },
  careButtonImage: {
    width: 62,
    height: 62
  },
  careButtonImageFeed: {
    width: 62,
    height: 62
  },
  careButtonImagePlay: {
    width: 62,
    height: 62,
    // The play-ball artwork sits higher in its frame than its dock siblings
    // (round icon vs. flat-bottomed bowls/heart), so nudge it down to match
    // the shared optical baseline across the tray.
    transform: [{ translateY: 3 }]
  },
  careButtonImageWalk: {
    width: 62,
    height: 62
  },
  careButtonImageAffection: {
    width: 62,
    height: 62
  },
  careButtonActive: {
    transform: [{ translateY: -3 }, { scale: 1.005 }]
  },
  careButtonRecommended: {
    transform: [{ translateY: -4 }, { scale: 1.005 }]
  },
  careButtonMenuOpen: {
    transform: [{ translateY: -5 }, { scale: 1.01 }]
  },
  recommendedCareBadge: {
    position: "absolute",
    top: 3,
    right: 4,
    zIndex: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.cream,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.88)",
    alignItems: "center",
    justifyContent: "center"
  },
  careButtonDisabled: {
    opacity: 1
  },
  careCooldownBadge: {
    position: "absolute",
    right: -2,
    top: -5,
    minWidth: 34,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#20283F",
    borderWidth: 2,
    borderColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    zIndex: 8
  },
  careCooldownText: {
    color: colors.cream,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "900"
  },
  careButtonText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "900",
    textShadowColor: "rgba(59,46,42,0.44)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
    display: "none"
  },
  walkRewardArt: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: colors.parchment,
    borderWidth: 3,
    borderColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.tile
  },
  walkRewardIcon: {
    width: 62,
    height: 62
  },
  walkPanelBody: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm
  },
  walkStatusBadge: {
    alignSelf: "flex-start",
    minHeight: 30,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.cream,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    ...shadows.tile
  },
  walkStatusText: {
    color: colors.woodDark,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  walkPanelAction: {
    alignSelf: "flex-start",
    minWidth: 142
  },
  walkCopy: {
    gap: spacing.xs
  },
  walkTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900"
  },
  walkText: {
    color: colors.mutedInk,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700"
  },
  rewardNotice: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 78,
    zIndex: 185,
    borderRadius: radii.panel,
    backgroundColor: "rgba(255,232,199,0.92)",
    borderWidth: 3,
    borderColor: colors.cream,
    padding: spacing.sm,
    gap: spacing.sm,
    ...shadows.gamePanel
  },
  rewardRibbon: {
    minHeight: 32,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.cream,
    backgroundColor: colors.honey,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    ...shadows.tile
  },
  rewardRibbonLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  rewardRibbonText: {
    color: colors.woodDark,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  rewardCountPill: {
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,245,222,0.9)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4
  },
  rewardCountText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900"
  },
  claimedRewardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  claimedRewardArt: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.cream,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.82)",
    alignItems: "center",
    justifyContent: "center"
  },
  claimedRewardIcon: {
    width: 46,
    height: 46
  },
  claimedRewardCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs
  },
  rewardNoticeTitle: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "900"
  },
  rewardNoticeText: {
    color: colors.mutedInk,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800"
  },
  rewardActions: {
    flexDirection: "row",
    gap: spacing.sm
  },
  rewardAction: {
    flex: 1
  },
  rewardSceneOverlay: {
    position: "absolute",
    left: 24,
    bottom: 238,
    width: 74,
    height: 74,
    borderRadius: 22,
    backgroundColor: "rgba(255,232,199,0.58)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.82)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
    ...shadows.tile
  },
  rewardSceneGlow: {
    position: "absolute",
    top: -8,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(255,191,68,0.22)"
  },
  rewardSceneIcon: {
    width: 58,
    height: 58
  },
  rewardSceneTag: {
    display: "none"
  },
  rewardSceneTagText: {
    color: colors.woodDark,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  privacyNotice: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 92,
    zIndex: 185,
    borderRadius: 18,
    backgroundColor: "rgba(244,255,246,0.88)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.76)",
    padding: spacing.md
  },
  privacyNoticeText: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800"
  }
});
