import AsyncStorage from "@react-native-async-storage/async-storage";
import { ArrowLeft, Flame, Footprints, Heart, Mail, PawPrint, Share2 } from "lucide-react-native";
import { router } from "expo-router";
import type { ComponentType } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";

import {
  expressionPacks,
  getCompanionHabitHints,
  getFavoriteTreatItemId,
  isExpressionPackUnlocked,
  projectCareStreakForNow
} from "@mongchi/shared";

import { useReducedMotionPreference } from "../../shared/accessibility/useReducedMotionPreference";
import { duckBgmForMs, playSfx, playSuccessHaptic } from "../../shared/audio";
import { colors, radii, shadows, spacing, useFontFamilies, useTypography } from "../../shared/design/tokens";
import { ActionButton } from "../../shared/ui/ActionButton";
import { BackButton } from "../../shared/ui/BackButton";
import { LottieAnimation } from "../../shared/ui/LottieAnimation";
import { walkCollectibleAssets } from "../../shared/assets/walkCollectibleAssets";
import { buildFriendShareMessage, sharePetCard } from "../../shared/share/petShare";
import { GardenSceneFrame } from "../appShell/GardenSceneFrame";
import { useTerrariumSession } from "../session/TerrariumSessionProvider";
import { HeroPoseSlider } from "./FriendHeroPoseSlider";
import {
  getDaysTogether,
  getFriendBondPresentation,
  getFriendHabitSummaryPresentation,
  getFriendMemoryAlbumPresentation,
  getFriendMonthlyLetterPresentation,
  getFriendPoseGalleryPresentation,
  getFriendStreakPresentation,
  getFriendWalkCollectionPresentation,
  getMovedInLine,
  getNewlyRevealedPoseStates,
  getPoseRevealBannerLine,
  getPoseRevealPersistedKey,
  MEMORY_ALBUM_FOOTLINE
} from "./friendProfilePresentation";

/** Persists whether the 30-day letter has been opened, so it stays readable on every future visit. */
const MONTHLY_LETTER_OPENED_KEY = "mongchi.friend.monthlyLetter.openedAt.v1";

// The 30-day letter's "a gift is waiting" motif -- looped while locked/arrived,
// never shown once opened (see MonthlyLetterCardBody and the letter card's
// locked branch below). Required at module scope so it's bundled once.
const giftBoxAnimation = require("../../../assets/lottie/gift-box.json");

/** Persists which expression packs' reveal showcase (stagger + banner line) has already played once. */
const POSE_REVEAL_SEEN_PACK_IDS_KEY = "mongchi.friend.poseReveal.seenPackIds.v1";

interface MonthlyLetterCardBodyProps {
  petName: string;
  previewLine: string;
  letterText: string;
  isOpened: boolean;
  letterFontFamily: string;
  reduceMotionEnabled: boolean;
  onOpen: () => void;
}

/**
 * Drives the 30-day letter's open moment: a brief anticipation shake on the
 * envelope, then a crossfade+scale "unfold" into the full letter text. This
 * is the app's single biggest emotional payoff (see gamefeel-sound-plan.md
 * Tier 1), previously a single setState swap with zero motion. Kept as its
 * own component so the shake/crossfade Animated.Values reset per letter open
 * rather than leaking into the parent screen's render.
 */
function MonthlyLetterCardBody({
  petName,
  previewLine,
  letterText,
  isOpened,
  letterFontFamily,
  reduceMotionEnabled,
  onOpen
}: MonthlyLetterCardBodyProps) {
  const shake = useRef(new Animated.Value(0)).current;
  const envelopeOpacity = useRef(new Animated.Value(1)).current;
  const letterOpacity = useRef(new Animated.Value(0)).current;
  const letterScale = useRef(new Animated.Value(0.94)).current;
  const [showEnvelope, setShowEnvelope] = useState(!isOpened);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleOpen = () => {
    if (isAnimating) {
      return;
    }

    onOpen();

    if (reduceMotionEnabled) {
      setShowEnvelope(false);
      letterOpacity.setValue(1);
      letterScale.setValue(1);
      return;
    }

    setIsAnimating(true);

    Animated.sequence([
      // Anticipation: a quick, gentle wiggle before anything changes.
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 70, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 90, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0.6, duration: 80, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 80, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
      ]),
      // Unfold: envelope content fades out, the letter grows in and fades up.
      Animated.parallel([
        Animated.timing(envelopeOpacity, { toValue: 0, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(letterScale, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(letterOpacity, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true })
      ])
    ]).start(({ finished }) => {
      if (finished) {
        setShowEnvelope(false);
        setIsAnimating(false);
      }
    });
  };

  if (showEnvelope) {
    // Arrived-but-unopened: the gift box takes over as the visual lead --
    // a little brighter/bigger than the locked-state loop below, since this
    // one's actually ready to open -- with the existing preview line + Open
    // CTA underneath. Both fade and shake together with the rest of this
    // view during handleOpen's anticipation + unfold sequence.
    return (
      <Animated.View
        style={{
          opacity: envelopeOpacity,
          transform: [{ rotate: shake.interpolate({ inputRange: [-1, 1], outputRange: ["-3deg", "3deg"] }) }]
        }}
      >
        <LottieAnimation
          accessibilityLabel={`${petName}'s letter is wrapped as a gift, ready to open`}
          loop
          source={giftBoxAnimation}
          style={letterStyles.arrivedGiftBox}
        />
        <Text style={[letterStyles.streakHeadline, letterStyles.body]}>{previewLine}</Text>
        <ActionButton
          accessibilityLabel={`Open ${petName}'s one-month letter`}
          label="Open"
          Icon={Mail}
          size="compact"
          disabled={isAnimating}
          onPress={handleOpen}
        />
      </Animated.View>
    );
  }

  return (
    <Animated.Text
      style={[
        letterStyles.memoryText,
        { fontFamily: letterFontFamily },
        { opacity: letterOpacity, transform: [{ scale: letterScale }] }
      ]}
    >
      {letterText}
    </Animated.Text>
  );
}

/** Minimal style aliases so MonthlyLetterCardBody can share the screen's look without hoisting the whole StyleSheet above it. */
const letterStyles = StyleSheet.create({
  streakHeadline: {
    color: colors.ink
  },
  body: {
    fontSize: 15,
    lineHeight: 21
  },
  arrivedGiftBox: {
    alignSelf: "center",
    width: 108,
    height: 108
  },
  memoryText: {
    color: colors.mutedInk,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700"
  }
});

// Matches TerrariumHomeScreen's JINGLE_DUCK_MS: briefly dips BGM volume
// while a jingle plays (see docs/gamefeel-sound-plan.md §2's ducking API
// requirement), long enough to cover the placeholder jingle_* durations
// from synth_sfx.py (well under 1s) with room to spare.
const JINGLE_DUCK_MS = 900;

interface StatTileProps {
  Icon: ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
  iconColor: string;
  value: string;
  label: string;
  accessibilityLabel: string;
  /** Present only for the Bond tile -- renders a thin progress bar under the value. */
  progressFraction?: number;
}

/**
 * One mini tile in the stat ribbon (Bond / Streak / Together). Deliberately
 * plain -- icon, one big number, one label -- so all three sit on a single
 * row even on an iPhone SE. The fuller warm copy that used to live in three
 * separate full-width cards (streak headline/subline, moved-in line) still
 * reaches screen readers via accessibilityLabel, it's just not printed on
 * screen anymore.
 */
function StatTile({ Icon, iconColor, value, label, accessibilityLabel, progressFraction }: StatTileProps) {
  const typography = useTypography();
  const fontFamilies = useFontFamilies();
  const hasProgress = progressFraction !== undefined;

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={hasProgress ? "progressbar" : undefined}
      accessibilityValue={hasProgress ? { min: 0, max: 100, now: Math.round((progressFraction ?? 0) * 100) } : undefined}
      style={statTileStyles.tile}
    >
      <Icon color={iconColor} size={18} strokeWidth={2.6} />
      <Text style={[statTileStyles.value, { fontFamily: fontFamilies.display }]}>{value}</Text>
      <Text style={[statTileStyles.label, typography.label]}>{label}</Text>
      {hasProgress ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={statTileStyles.progressTrack}>
          <View style={[statTileStyles.progressFill, { width: `${Math.round((progressFraction ?? 0) * 100)}%` }]} />
        </View>
      ) : null}
    </View>
  );
}

const statTileStyles = StyleSheet.create({
  tile: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    borderRadius: radii.panel,
    backgroundColor: colors.cream,
    borderWidth: 3,
    borderBottomWidth: 5,
    borderColor: colors.line,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    ...shadows.tile
  },
  value: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "900"
  },
  label: {
    color: colors.mutedInk
  },
  progressTrack: {
    marginTop: 2,
    width: "100%",
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: "rgba(122,110,102,0.18)",
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    borderRadius: radii.pill,
    backgroundColor: colors.honey
  }
});

export function FriendProfileScreen() {
  const {
    acceptedAsset,
    acceptedAssets,
    activePet,
    careStats,
    careState,
    careStreak,
    catalogItems,
    expressionPackPurchaseStatusById,
    generatedAssetUriById,
    hydrateCreditBalance,
    memories,
    purchaseExpressionPack,
    relationshipState,
    walkCollection
  } = useTerrariumSession();
  const typography = useTypography();
  const fontFamilies = useFontFamilies();
  const reduceMotionEnabled = useReducedMotionPreference();
  const [now] = useState(() => new Date().toISOString());
  const [isSharing, setIsSharing] = useState(false);
  const [hasOpenedMonthlyLetter, setHasOpenedMonthlyLetter] = useState(false);
  const [monthlyLetterLoaded, setMonthlyLetterLoaded] = useState(false);
  const [purchasingPackMessage, setPurchasingPackMessage] = useState<string | null>(null);
  // Pack ids whose reveal showcase (stagger + banner line) has already played,
  // loaded once from AsyncStorage on mount -- undefined until that load
  // resolves, so the showcase never flashes on for an instant before the
  // dedup check has had a chance to suppress it.
  const [seenPoseRevealKeys, setSeenPoseRevealKeys] = useState<string[] | null>(null);

  const daysTogether = useMemo(() => getDaysTogether(activePet.createdAt, now), [activePet.createdAt, now]);
  const movedInLine = getMovedInLine(daysTogether);
  const bond = useMemo(() => getFriendBondPresentation(relationshipState), [relationshipState]);
  const projectedStreak = useMemo(() => projectCareStreakForNow(careStreak, now), [careStreak, now]);
  const streak = getFriendStreakPresentation(projectedStreak.current, projectedStreak.best);
  const walkFinds = useMemo(() => getFriendWalkCollectionPresentation(walkCollection), [walkCollection]);
  const memoryAlbum = useMemo(() => getFriendMemoryAlbumPresentation(memories, now), [memories, now]);
  const habitSummary = useMemo(() => {
    const hints = getCompanionHabitHints(careStats, careState);
    const favoriteTreatItemId = getFavoriteTreatItemId(careStats);

    return getFriendHabitSummaryPresentation(hints, activePet.favoriteThing, favoriteTreatItemId, catalogItems);
  }, [activePet.favoriteThing, careStats, careState, catalogItems]);
  const monthlyLetter = useMemo(
    () =>
      getFriendMonthlyLetterPresentation(
        {
          petName: activePet.name,
          memories,
          careStats,
          favoriteThing: activePet.favoriteThing,
          catalogItems,
          daysTogether,
          now
        },
        hasOpenedMonthlyLetter
      ),
    [activePet.favoriteThing, activePet.name, careStats, catalogItems, daysTogether, hasOpenedMonthlyLetter, memories, now]
  );
  const poseGallery = useMemo(
    () => getFriendPoseGalleryPresentation(acceptedAssets, activePet.name, expressionPackPurchaseStatusById),
    [acceptedAssets, activePet.name, expressionPackPurchaseStatusById]
  );

  const acceptedAssetStates = useMemo(() => acceptedAssets.map((asset) => asset.state), [acceptedAssets]);

  // Packs that are fully unlocked right now but whose reveal showcase hasn't
  // played yet (persisted key absent from the seen-list). Waits for the
  // AsyncStorage load to resolve (seenPoseRevealKeys !== null) so a
  // previously-played showcase never replays for a split second on mount.
  const pendingPoseRevealPackIds = useMemo(() => {
    if (seenPoseRevealKeys === null) {
      return [];
    }

    const seen = new Set(seenPoseRevealKeys);

    return expressionPacks
      .filter((pack) => isExpressionPackUnlocked(pack, acceptedAssetStates) && !seen.has(getPoseRevealPersistedKey(pack.id)))
      .map((pack) => pack.id);
  }, [acceptedAssetStates, seenPoseRevealKeys]);

  const newlyRevealedPoseStates = useMemo(() => {
    if (pendingPoseRevealPackIds.length === 0) {
      return [];
    }

    const pendingStates = expressionPacks
      .filter((pack) => pendingPoseRevealPackIds.includes(pack.id))
      .flatMap((pack) => pack.states);

    return getNewlyRevealedPoseStates([], pendingStates);
  }, [pendingPoseRevealPackIds]);

  const poseRevealBannerLine =
    newlyRevealedPoseStates.length > 0 ? getPoseRevealBannerLine(activePet.name, newlyRevealedPoseStates.length) : null;

  const handleUnlockPosePack = async (packId: string) => {
    setPurchasingPackMessage(null);
    const result = await purchaseExpressionPack(packId);

    if (!result.ok) {
      setPurchasingPackMessage(result.messageSafe);
    }
  };

  useEffect(() => {
    let cancelled = false;

    void AsyncStorage.getItem(MONTHLY_LETTER_OPENED_KEY)
      .then((openedAt) => {
        if (!cancelled && openedAt) {
          setHasOpenedMonthlyLetter(true);
        }
      })
      .catch(() => {
        // Silent: worst case the letter shows its "Open" state once more than needed.
      })
      .finally(() => {
        if (!cancelled) {
          setMonthlyLetterLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void AsyncStorage.getItem(POSE_REVEAL_SEEN_PACK_IDS_KEY)
      .then((raw) => {
        if (cancelled) {
          return;
        }

        if (!raw) {
          setSeenPoseRevealKeys([]);
          return;
        }

        const parsed = JSON.parse(raw);
        setSeenPoseRevealKeys(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
      })
      .catch(() => {
        // Silent: worst case a reveal showcase that already played, plays once more.
        if (!cancelled) {
          setSeenPoseRevealKeys([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Credit Phase 1c trigger point (b): this page hosts the expression pack
  // gallery (the pose cards below), so entering it refreshes wallet.credits
  // from the server before the player can see/tap a pack's price (design
  // doc §6.2). No-op without a Supabase client or on a failed fetch --
  // hydrateCreditBalance silently keeps the last cached balance either way.
  useEffect(() => {
    void hydrateCreditBalance();
  }, [hydrateCreditBalance]);

  // Once a pending reveal has actually been computed (and is about to render
  // this pass), mark its pack id(s) seen right away so the showcase plays
  // exactly once even if the owner navigates away and back before the
  // stagger animation finishes.
  useEffect(() => {
    if (pendingPoseRevealPackIds.length === 0 || seenPoseRevealKeys === null) {
      return;
    }

    const nextSeen = Array.from(
      new Set([...seenPoseRevealKeys, ...pendingPoseRevealPackIds.map((packId) => getPoseRevealPersistedKey(packId))])
    );
    setSeenPoseRevealKeys(nextSeen);
    duckBgmForMs(JINGLE_DUCK_MS);
    playSfx("jingle_discovery");
    void AsyncStorage.setItem(POSE_REVEAL_SEEN_PACK_IDS_KEY, JSON.stringify(nextSeen)).catch(() => {
      // Silent: worst case the showcase replays once on a future visit.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPoseRevealPackIds]);

  const handleOpenMonthlyLetter = () => {
    setHasOpenedMonthlyLetter(true);
    duckBgmForMs(JINGLE_DUCK_MS);
    playSfx("jingle_letter");
    playSuccessHaptic();
    void AsyncStorage.setItem(MONTHLY_LETTER_OPENED_KEY, new Date().toISOString()).catch(() => {
      // Silent: worst case the "Open" interaction is offered again next visit.
    });
  };

  const petAssetId = acceptedAsset?.id ?? activePet.activeAssetId ?? null;
  const petAssetUri = petAssetId ? generatedAssetUriById[petAssetId] ?? null : null;

  const handleShare = async () => {
    if (isSharing) {
      return;
    }

    setIsSharing(true);
    try {
      await sharePetCard({
        petName: activePet.name,
        assetUri: petAssetUri,
        message: buildFriendShareMessage({ petName: activePet.name, daysTogether })
      });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <GardenSceneFrame
      accessibilityLabel={`${activePet.name}'s friend page`}
      contentStyle={styles.content}
      innerStyle={styles.inner}
    >
      {/* 1. HERO STAGE -- the page's first beat: a back button overlaid on
          the garden backdrop (GardenSceneFrame's own background art already
          supplies the "garden" behind everything below), the name +
          moved-in line pinned above the pet as a fixed plaque, then a
          swipeable pager of the pet's poses underneath. The name plate is
          the stage's first flow element (sitting safely in the SafeAreaView
          top inset GardenSceneFrame already applies) so it's always the
          topmost thing on the page -- swiping the pager to an unowned pose's
          "Unlock" overlay stays inside the pager frame below, never floating
          over the name. */}
      <View style={styles.heroStage}>
        <View style={styles.heroHeaderOverlay}>
          <BackButton accessibilityLabel="Back home" onPress={() => router.push("/terrarium")} />
        </View>

        <View style={styles.heroNamePlate}>
          <Text accessibilityRole="header" style={[styles.heroName, { fontFamily: fontFamilies.display }]}>
            {activePet.name}
          </Text>
          <Text style={[styles.heroMovedInLine, typography.label]}>{movedInLine}</Text>
        </View>

        <HeroPoseSlider
          bannerLine={poseRevealBannerLine}
          cards={poseGallery.cards}
          cells={poseGallery.cells}
          generatedAssetUriById={generatedAssetUriById}
          newlyRevealedPoseStates={newlyRevealedPoseStates}
          petName={activePet.name}
          petSpecies={activePet.species}
          purchasingPackMessage={purchasingPackMessage}
          reduceMotionEnabled={reduceMotionEnabled}
          onUnlockPack={(packId) => void handleUnlockPosePack(packId)}
        />
      </View>

      {/* 2. STAT RIBBON -- Bond / Streak / Together condensed into one row
          of tiles, replacing three separate full-width cards. */}
      <View style={styles.statRibbon}>
        <StatTile
          accessibilityLabel={`Bond progress toward level ${bond.level + 1}: ${bond.levelLabel}`}
          Icon={Heart}
          iconColor={colors.rose}
          label="Bond"
          progressFraction={bond.progressFraction}
          value={bond.levelLabel}
        />
        <StatTile
          accessibilityLabel={`${streak.headline}. ${streak.subline}`}
          Icon={Flame}
          iconColor={colors.honey}
          label="Streak"
          value={String(streak.current)}
        />
        <StatTile accessibilityLabel={movedInLine} Icon={PawPrint} iconColor={colors.leaf} label="Together" value={String(daysTogether)} />
      </View>

      {/* 3. PERSONALITY NOTE -- "Lately, {name}..." reads like a handwritten
          note tucked into the page, not another data card. */}
      <View style={styles.noteCard}>
        <View style={styles.noteGlyphBadge}>
          <PawPrint color={colors.gold} size={14} strokeWidth={2.6} />
        </View>
        <Text style={[styles.noteTitle, typography.title]}>Lately, {activePet.name}...</Text>
        {habitSummary.habitLines.map((line, index) => (
          <Text key={`habit-${index}`} style={[styles.noteLine, typography.body]}>
            {activePet.name} {line}
          </Text>
        ))}
        {habitSummary.favoriteThingLine ? (
          <Text style={[styles.noteCaption, typography.label]}>{habitSummary.favoriteThingLine}</Text>
        ) : null}
        {habitSummary.favoriteTreatLine ? (
          <Text style={[styles.noteCaption, typography.label]}>{habitSummary.favoriteTreatLine}</Text>
        ) : null}
      </View>

      {/* 4. WALK FINDS -- the pose gallery has moved up into the hero pager
          (see HeroPoseSlider above), so this panel is walk-collectible
          discovery only now. */}
      <View style={styles.collectionsPanel}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.collectionsSectionHeading}>
            <Footprints color={colors.moss} size={16} strokeWidth={2.6} />
            <Text style={[styles.collectionsTitle, typography.title]}>Walk finds</Text>
          </View>
          <Text style={[styles.cardCaption, typography.label]}>{walkFinds.progressLabel}</Text>
        </View>
        <View style={styles.walkGrid}>
          {walkFinds.cells.map((cell) => (
            <View
              key={cell.id}
              accessibilityLabel={cell.found ? `${cell.name}, found ${cell.count} time${cell.count === 1 ? "" : "s"}` : "Undiscovered walk find"}
              style={[styles.walkCell, cell.found ? null : styles.walkCellLocked]}
            >
              <Image
                accessibilityIgnoresInvertColors
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                resizeMode="contain"
                source={walkCollectibleAssets[cell.id]}
                style={[styles.walkIcon, cell.found ? null : styles.walkIconLocked]}
              />
              <Text numberOfLines={1} style={[styles.walkName, typography.label]}>
                {cell.name}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* 5. SCRAPBOOK -- memories laid out as a connected timeline instead
          of a plain list. */}
      <View style={styles.scrapbookPanel}>
        <Text style={[styles.cardTitle, typography.title]}>Our little moments</Text>
        <View style={styles.timelineWrap}>
          {memoryAlbum.rows.length > 1 ? <View style={styles.timelineLine} /> : null}
          {memoryAlbum.rows.map((row) => (
            <View key={row.id} style={styles.memoryRow}>
              <View style={styles.memoryGlyphBadge}>
                <Text style={styles.memoryGlyphText}>{row.glyph}</Text>
              </View>
              <View style={styles.memoryRowText}>
                <Text style={[styles.memoryLine, typography.body]}>{row.line}</Text>
                <Text style={[styles.cardCaption, typography.label]}>{row.dayLabel}</Text>
              </View>
            </View>
          ))}
        </View>
        {memoryAlbum.isSparse ? <Text style={[styles.cardCaption, typography.label]}>{memoryAlbum.sparseLine}</Text> : null}
        {memoryAlbum.hasMore ? <Text style={[styles.cardCaption, typography.label]}>{MEMORY_ALBUM_FOOTLINE}</Text> : null}
      </View>

      {/* 6. LETTER -- the 30-day letter gets envelope-special treatment (a
          wax-seal badge, warm gold border); MonthlyLetterCardBody's open
          animation and status handling below are untouched. */}
      <View style={styles.letterCard}>
        <View style={styles.letterSealWrap}>
          <View style={styles.letterSealBadge}>
            <Mail color={colors.cream} size={18} strokeWidth={2.6} />
          </View>
        </View>
        <Text style={[styles.cardTitle, typography.title]}>{activePet.name}'s letter</Text>

        {monthlyLetter.status === "locked" ? (
          <>
            {/* A quietly looping gift box stands in for the old sealed-envelope
                preview line -- "a treasure waiting to be opened" -- while the
                day-count progress read stays as plain text underneath. The
                previewLine copy still reaches screen readers via this
                wrapper's accessibilityLabel. */}
            <View accessibilityLabel={monthlyLetter.previewLine} style={styles.letterGiftBoxLockedWrap}>
              <LottieAnimation loop source={giftBoxAnimation} style={styles.letterGiftBoxLocked} />
            </View>
            <Text style={[styles.cardCaption, typography.label]}>{monthlyLetter.progressLabel}</Text>
          </>
        ) : null}

        {(monthlyLetter.status === "arrived" || monthlyLetter.status === "opened") &&
        monthlyLetterLoaded &&
        monthlyLetter.letterText ? (
          <MonthlyLetterCardBody
            petName={activePet.name}
            previewLine={monthlyLetter.previewLine}
            letterText={monthlyLetter.letterText}
            isOpened={monthlyLetter.status === "opened"}
            letterFontFamily={fontFamilies.body}
            reduceMotionEnabled={reduceMotionEnabled}
            onOpen={handleOpenMonthlyLetter}
          />
        ) : null}
      </View>

      {activePet.memoryNote?.trim() ? (
        <View style={styles.plainCard}>
          <Text style={[styles.cardTitle, typography.title]}>Memory note</Text>
          <Text style={[styles.memoryText, { fontFamily: fontFamilies.body }]}>{activePet.memoryNote}</Text>
        </View>
      ) : null}

      {/* 7. Share + Back home */}
      <View style={styles.footerActions}>
        <ActionButton
          accessibilityLabel={`Share ${activePet.name}`}
          label={`Share ${activePet.name}`}
          Icon={Share2}
          variant="secondary"
          size="compact"
          disabled={isSharing}
          style={styles.footerAction}
          onPress={handleShare}
        />

        <ActionButton
          accessibilityLabel="Back home"
          label="Back home"
          Icon={ArrowLeft}
          size="compact"
          style={styles.footerAction}
          onPress={() => router.push("/terrarium")}
        />
      </View>
    </GardenSceneFrame>
  );
}

const styles = StyleSheet.create({
  content: {
    // paddingTop is the single top-of-content gap below the safe area for
    // this screen (~8-12pt target, matching the rest of the app's screens
    // post-audit) -- headerRow below intentionally carries no marginTop.
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg
  },
  inner: {
    // Group-to-group rhythm: each direct child below is one "beat" of the
    // page (hero / stats / note / collections / scrapbook / letter /
    // footer) -- a generous gap here reads as room-to-room movement, while
    // each group below sets its own tighter internal gap.
    gap: spacing.xl
  },

  // --- 1. Hero stage ------------------------------------------------------
  // GardenSceneFrame's own SafeAreaView already keeps everything here clear
  // of the status bar / dynamic island, so this stage is plain in-flow
  // content -- no manual inset math needed. heroHeaderOverlay floats the
  // back button over the name plate's row (same paddingTop as this stage's
  // own, so both start at the same height) without adding to the flow.
  heroStage: {
    position: "relative",
    alignItems: "center",
    paddingTop: spacing.sm,
    gap: spacing.sm
  },
  heroHeaderOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: spacing.sm,
    zIndex: 30
  },
  heroNamePlate: {
    alignItems: "center",
    gap: 2,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,245,222,0.9)",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.86)",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    ...shadows.tile
  },
  heroName: {
    color: colors.ink,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "900"
  },
  heroMovedInLine: {
    color: colors.mutedInk
  },

  // --- 2. Stat ribbon ------------------------------------------------------
  statRibbon: {
    flexDirection: "row",
    gap: spacing.sm
  },

  // --- 3. Personality note -------------------------------------------------
  noteCard: {
    borderRadius: radii.card,
    backgroundColor: colors.parchment,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.parchmentDeep,
    padding: spacing.md,
    gap: spacing.xs,
    transform: [{ rotate: "-1deg" }],
    ...shadows.soft
  },
  noteGlyphBadge: {
    width: 26,
    height: 26,
    borderRadius: radii.pill,
    backgroundColor: "rgba(217,149,56,0.22)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.7)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2
  },
  noteTitle: {
    color: colors.ink
  },
  noteLine: {
    color: colors.ink,
    fontStyle: "italic"
  },
  noteCaption: {
    color: colors.mutedInk
  },

  // --- 4. Collections panel -------------------------------------------------
  collectionsPanel: {
    borderRadius: radii.panel,
    backgroundColor: "rgba(201,240,255,0.55)",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.82)",
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.gamePanel
  },
  collectionsTitle: {
    color: colors.skyDeep
  },
  collectionsSectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  cardTitle: {
    color: colors.ink
  },
  cardCaption: {
    color: colors.mutedInk
  },
  streakHeadline: {
    color: colors.ink
  },
  walkGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  walkCell: {
    width: 76,
    alignItems: "center",
    gap: 3,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.95)",
    paddingVertical: 8,
    paddingHorizontal: 4
  },
  walkCellLocked: {
    backgroundColor: "rgba(122,110,102,0.14)",
    borderColor: "rgba(255,255,255,0.55)"
  },
  walkIcon: {
    width: 28,
    height: 28
  },
  // Locked cells still render the real pixel icon (never a placeholder "?")
  // but dimmed and tinted into a flat silhouette, so the shape/rarity reads
  // as "something's there, not yet discovered" rather than spoiling it.
  walkIconLocked: {
    opacity: 0.4,
    tintColor: colors.mutedInk
  },
  walkName: {
    color: colors.ink
  },

  // --- 5. Scrapbook timeline -------------------------------------------------
  scrapbookPanel: {
    borderRadius: radii.panel,
    backgroundColor: "rgba(255,245,222,0.85)",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.82)",
    padding: spacing.md,
    gap: spacing.md,
    transform: [{ rotate: "0.6deg" }],
    ...shadows.gamePanel
  },
  timelineWrap: {
    position: "relative",
    gap: spacing.md
  },
  timelineLine: {
    position: "absolute",
    top: 14,
    bottom: 14,
    left: 13,
    width: 2,
    backgroundColor: colors.line
  },
  memoryText: {
    color: colors.mutedInk,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700"
  },
  memoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  memoryGlyphBadge: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: "rgba(246,184,79,0.24)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.7)",
    alignItems: "center",
    justifyContent: "center"
  },
  memoryGlyphText: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: "900"
  },
  memoryRowText: {
    flex: 1,
    gap: 2
  },
  memoryLine: {
    color: colors.ink
  },

  // --- 6. Letter (30-day) ----------------------------------------------------
  letterCard: {
    position: "relative",
    borderRadius: radii.panel,
    backgroundColor: "rgba(246,184,79,0.22)",
    borderWidth: 3,
    borderColor: colors.honey,
    padding: spacing.md,
    paddingTop: spacing.xl,
    gap: spacing.sm,
    ...shadows.gamePanel
  },
  letterSealWrap: {
    position: "absolute",
    top: -22,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 5
  },
  letterSealBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.gold,
    borderWidth: 3,
    borderBottomWidth: 5,
    borderColor: colors.honey,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.tile
  },
  // Locked state's quiet "waiting to be opened" loop -- smaller and calmer
  // than the arrived state's gift box (see letterStyles.arrivedGiftBox)
  // since there's nothing to do yet but watch it sit there.
  letterGiftBoxLockedWrap: {
    alignSelf: "center"
  },
  letterGiftBoxLocked: {
    width: 72,
    height: 72
  },

  // --- Plain fallback card (memory note) --------------------------------------
  plainCard: {
    borderRadius: radii.panel,
    backgroundColor: "rgba(255,245,222,0.9)",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.82)",
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.gamePanel
  },

  // --- 7. Footer ------------------------------------------------------------
  footerActions: {
    gap: spacing.sm
  },
  footerAction: {
    alignSelf: "stretch"
  }
});
