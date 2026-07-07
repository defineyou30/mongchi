import AsyncStorage from "@react-native-async-storage/async-storage";
import { ArrowLeft, Mail, Share2, Sparkles } from "lucide-react-native";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

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
import { ScreenHeaderRow } from "../../shared/ui/ScreenHeaderRow";
import { GeneratedPetAssetImage } from "../../shared/assets/generatedPetAssets";
import { buildFriendShareMessage, sharePetCard } from "../../shared/share/petShare";
import { GardenSceneFrame } from "../appShell/GardenSceneFrame";
import { useTerrariumSession } from "../session/TerrariumSessionProvider";
import type { FriendPoseCell } from "./friendProfilePresentation";
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
    return (
      <Animated.View
        style={{
          opacity: envelopeOpacity,
          transform: [{ rotate: shake.interpolate({ inputRange: [-1, 1], outputRange: ["-3deg", "3deg"] }) }]
        }}
      >
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
  memoryText: {
    color: colors.mutedInk,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700"
  }
});

interface PoseRevealCellProps {
  cell: FriendPoseCell;
  petName: string;
  assetUri: string | null;
  isNewlyRevealed: boolean;
  staggerIndex: number;
  reduceMotionEnabled: boolean;
}

/** Per-cell stagger delay for the pose reveal showcase -- ~200ms apart per the plan, capped so a large future pack doesn't stall the grid for seconds. */
const POSE_REVEAL_STAGGER_MS = 200;
const POSE_REVEAL_MAX_STAGGER_INDEX = 8;

// Matches TerrariumHomeScreen's JINGLE_DUCK_MS: briefly dips BGM volume
// while a jingle plays (see docs/gamefeel-sound-plan.md §2's ducking API
// requirement), long enough to cover the placeholder jingle_* durations
// from synth_sfx.py (well under 1s) with room to spare.
const JINGLE_DUCK_MS = 900;

/**
 * A single pose gallery cell. Cells flagged `isNewlyRevealed` play a
 * staggered fade+scale entrance (the "reveal showcase" for a just-completed
 * expression pack); every other cell (already-owned, still-locked) renders
 * immediately with no animation so re-visits of the friend page never
 * replay motion for old poses.
 */
function PoseRevealCell({ cell, petName, assetUri, isNewlyRevealed, staggerIndex, reduceMotionEnabled }: PoseRevealCellProps) {
  const reveal = useRef(new Animated.Value(isNewlyRevealed && !reduceMotionEnabled ? 0 : 1)).current;

  useEffect(() => {
    if (!isNewlyRevealed || reduceMotionEnabled) {
      return;
    }

    const delayMs = Math.min(staggerIndex, POSE_REVEAL_MAX_STAGGER_INDEX) * POSE_REVEAL_STAGGER_MS;
    const animation = Animated.sequence([
      Animated.delay(delayMs),
      Animated.timing(reveal, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true })
    ]);

    animation.start();

    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={[
        poseRevealStyles.poseCell,
        cell.status === "locked" ? poseRevealStyles.poseCellLocked : null,
        {
          opacity: reveal,
          transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }]
        }
      ]}
    >
      {cell.status === "owned" ? (
        <GeneratedPetAssetImage
          accessibilityLabel={`${petName}'s ${cell.state} pose`}
          assetId={cell.assetId}
          remoteUri={assetUri}
          style={poseRevealStyles.poseSprite}
        />
      ) : (
        <Text style={poseRevealStyles.poseLockedGlyph}>?</Text>
      )}
    </Animated.View>
  );
}

const poseRevealStyles = StyleSheet.create({
  poseCell: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.95)"
  },
  poseCellLocked: {
    backgroundColor: "rgba(122,110,102,0.14)",
    borderColor: "rgba(255,255,255,0.55)"
  },
  poseSprite: {
    width: 52,
    height: 52
  },
  poseLockedGlyph: {
    color: colors.mutedInk,
    fontSize: 22,
    fontWeight: "900"
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
  const introLine = activePet.memoryNote?.trim() ? activePet.memoryNote : movedInLine;

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
      <ScreenHeaderRow
        title={activePet.name}
        titleFontFamily={fontFamilies.display}
        backAccessibilityLabel="Back home"
        style={styles.headerRow}
        onBack={() => router.push("/terrarium")}
      />

      <View style={styles.heroCard}>
        <View style={styles.petFrame}>
          <GeneratedPetAssetImage
            accessibilityLabel={`${activePet.name}'s portrait`}
            assetId={petAssetId}
            remoteUri={petAssetUri}
            style={styles.petSprite}
          />
        </View>
        <Text style={[styles.introLine, typography.body]}>{introLine}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, typography.title]}>Bond</Text>
          <View style={styles.levelBadge}>
            <Text style={[styles.levelBadgeText, typography.label]}>{bond.levelLabel}</Text>
          </View>
        </View>
        <View accessibilityLabel={`Bond progress toward level ${bond.level + 1}`} accessibilityRole="progressbar" style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(bond.progressFraction * 100)}%` }]} />
        </View>
        <Text style={[styles.cardCaption, typography.label]}>Every bit of care grows this bar.</Text>
      </View>

      <View style={styles.card}>
        <Text style={[styles.cardTitle, typography.title]}>Lately, {activePet.name}...</Text>
        {habitSummary.habitLines.map((line, index) => (
          <Text key={`habit-${index}`} style={[styles.streakHeadline, typography.body]}>
            {activePet.name} {line}
          </Text>
        ))}
        {habitSummary.favoriteThingLine ? (
          <Text style={[styles.cardCaption, typography.label]}>{habitSummary.favoriteThingLine}</Text>
        ) : null}
        {habitSummary.favoriteTreatLine ? (
          <Text style={[styles.cardCaption, typography.label]}>{habitSummary.favoriteTreatLine}</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={[styles.cardTitle, typography.title]}>Streak</Text>
        <Text style={[styles.streakHeadline, typography.body]}>{streak.headline}</Text>
        <Text style={[styles.cardCaption, typography.label]}>{streak.subline}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, typography.title]}>Walk finds</Text>
          <Text style={[styles.cardCaption, typography.label]}>{walkFinds.progressLabel}</Text>
        </View>
        <View style={styles.walkGrid}>
          {walkFinds.cells.map((cell) => (
            <View
              key={cell.id}
              accessibilityLabel={cell.found ? `${cell.name}, found ${cell.count} time${cell.count === 1 ? "" : "s"}` : "Undiscovered walk find"}
              style={[styles.walkCell, cell.found ? null : styles.walkCellLocked]}
            >
              <Text style={[styles.walkEmoji, cell.found ? null : styles.walkEmojiLocked]}>{cell.emoji}</Text>
              <Text numberOfLines={1} style={[styles.walkName, typography.label]}>
                {cell.name}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, typography.title]}>{activePet.name}'s moments</Text>
          <View style={styles.letterEnvelopeBadge}>
            <Sparkles color={colors.gold} size={16} strokeWidth={2.4} />
          </View>
        </View>
        {poseRevealBannerLine ? (
          <Text accessibilityLiveRegion="polite" style={[styles.streakHeadline, typography.body]}>
            {poseRevealBannerLine}
          </Text>
        ) : null}
        <View style={styles.poseGrid}>
          {poseGallery.cells.map((cell, index) => (
            <PoseRevealCell
              key={cell.state}
              cell={cell}
              petName={activePet.name}
              assetUri={cell.assetId ? generatedAssetUriById[cell.assetId] ?? null : null}
              isNewlyRevealed={newlyRevealedPoseStates.includes(cell.state)}
              staggerIndex={index}
              reduceMotionEnabled={reduceMotionEnabled}
            />
          ))}
        </View>
        {poseGallery.cards.map((card) => (
          <View key={card.packId} style={styles.poseCard}>
            <Text style={[styles.streakHeadline, typography.body]}>{card.label}</Text>
            {card.status === "purchasing" && card.progressLine ? (
              <Text style={[styles.cardCaption, typography.label]}>{card.progressLine}</Text>
            ) : null}
            {card.status === "failed" && card.failureLine ? (
              <Text style={[styles.cardCaption, typography.label]}>{card.failureLine}</Text>
            ) : null}
            {card.status !== "purchasing" ? (
              <ActionButton
                accessibilityLabel={`Unlock ${card.nameEn} for ${activePet.name}`}
                label={card.status === "failed" ? "Try again" : "Unlock"}
                Icon={Sparkles}
                size="compact"
                onPress={() => void handleUnlockPosePack(card.packId)}
              />
            ) : null}
          </View>
        ))}
        {purchasingPackMessage ? <Text style={[styles.cardCaption, typography.label]}>{purchasingPackMessage}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={[styles.cardTitle, typography.title]}>Our little moments</Text>
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
        {memoryAlbum.isSparse ? (
          <Text style={[styles.cardCaption, typography.label]}>{memoryAlbum.sparseLine}</Text>
        ) : null}
        {memoryAlbum.hasMore ? <Text style={[styles.cardCaption, typography.label]}>{MEMORY_ALBUM_FOOTLINE}</Text> : null}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, typography.title]}>{activePet.name}'s letter</Text>
          <View style={styles.letterEnvelopeBadge}>
            <Mail color={colors.gold} size={16} strokeWidth={2.4} />
          </View>
        </View>

        {monthlyLetter.status === "locked" ? (
          <>
            <Text style={[styles.streakHeadline, typography.body]}>{monthlyLetter.previewLine}</Text>
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
        <View style={styles.card}>
          <Text style={[styles.cardTitle, typography.title]}>Memory note</Text>
          <Text style={[styles.memoryText, { fontFamily: fontFamilies.body }]}>{activePet.memoryNote}</Text>
        </View>
      ) : null}

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
    gap: spacing.md
  },
  headerRow: {
    // No marginTop here: content.paddingTop already provides the gap below
    // the safe area. Adding marginTop on top of that padding used to double
    // up the top margin (see settings-screen audit, applied here too).
    marginBottom: spacing.xs
  },
  heroCard: {
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.panel,
    backgroundColor: "rgba(255,245,222,0.92)",
    borderWidth: 3,
    borderBottomWidth: 6,
    borderColor: "rgba(255,255,255,0.86)",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    ...shadows.gamePanel
  },
  petFrame: {
    width: 140,
    height: 140,
    borderRadius: 30,
    backgroundColor: colors.cream,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.84)",
    alignItems: "center",
    justifyContent: "center",
    ...shadows.tile
  },
  petSprite: {
    width: 118,
    height: 118
  },
  introLine: {
    color: colors.mutedInk,
    textAlign: "center"
  },
  card: {
    borderRadius: radii.panel,
    backgroundColor: "rgba(255,245,222,0.9)",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.82)",
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.gamePanel
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
  levelBadge: {
    borderRadius: radii.pill,
    backgroundColor: "rgba(246,184,79,0.24)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.7)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4
  },
  levelBadgeText: {
    color: colors.gold
  },
  letterEnvelopeBadge: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: "rgba(246,184,79,0.24)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.7)",
    alignItems: "center",
    justifyContent: "center"
  },
  progressTrack: {
    height: 16,
    borderRadius: radii.pill,
    backgroundColor: "rgba(122,110,102,0.18)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.7)",
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    borderRadius: radii.pill,
    backgroundColor: colors.honey
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
  walkEmoji: {
    fontSize: 22
  },
  walkEmojiLocked: {
    color: colors.mutedInk,
    fontSize: 18,
    fontWeight: "900"
  },
  walkName: {
    color: colors.ink
  },
  poseGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  poseCard: {
    gap: spacing.xs,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.8)",
    padding: spacing.sm
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
  footerAction: {
    alignSelf: "stretch"
  }
});
