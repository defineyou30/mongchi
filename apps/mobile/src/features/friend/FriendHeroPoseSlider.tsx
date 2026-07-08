import { Sparkles } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";

import type { GeneratedAssetId, PetSpecies } from "@mongchi/shared";

import { getFallbackGeneratedPetAssetId, GeneratedPetAssetImage } from "../../shared/assets/generatedPetAssets";
import { colors, radii, shadows, spacing } from "../../shared/design/tokens";
import { ActionButton } from "../../shared/ui/ActionButton";
import { buildHeroPoseSlides, getRemainingPoseCountByPackId, getUnlockOverlayHeadline } from "./friendHeroPosePresentation";
import type { FriendPoseCard, FriendPoseCell } from "./friendProfilePresentation";

/** Slide + shadow footprint -- matches the size the pre-pager single-portrait hero used, so the rest of the hero layout (name plate spacing, shadow placement) needed no further tuning. */
const SLIDE_SIZE = 200;
const SPRITE_SIZE = 196;

/** Per-slide stagger delay for the reveal showcase -- mirrors the pre-pager grid's timing (~200ms apart, capped so a large future pack doesn't stall the entrance for seconds). */
const POSE_REVEAL_STAGGER_MS = 200;
const POSE_REVEAL_MAX_STAGGER_INDEX = 8;

interface HeroPoseSliderProps {
  cells: FriendPoseCell[];
  cards: FriendPoseCard[];
  petName: string;
  petSpecies: PetSpecies;
  generatedAssetUriById: Partial<Record<GeneratedAssetId, string>>;
  newlyRevealedPoseStates: readonly string[];
  reduceMotionEnabled: boolean;
  /** "Three new sides of Momo." -- one-shot line the screen already computes from the reveal showcase; rendered here so it sits right above the pager it's describing. */
  bannerLine: string | null;
  purchasingPackMessage: string | null;
  onUnlockPack: (packId: string) => void;
}

interface OwnedPoseSlideProps {
  cell: FriendPoseCell;
  petName: string;
  assetUri: string | null;
  isNewlyRevealed: boolean;
  staggerIndex: number;
  reduceMotionEnabled: boolean;
}

/**
 * One owned pose's big hero-sized portrait. Newly-revealed poses (a
 * just-completed expression pack) play the same staggered fade+scale-in the
 * old pose grid used; every other slide (already-owned, or not part of this
 * reveal batch) renders immediately with no animation so re-visits never
 * replay motion for old poses.
 */
function OwnedPoseSlide({ cell, petName, assetUri, isNewlyRevealed, staggerIndex, reduceMotionEnabled }: OwnedPoseSlideProps) {
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
        styles.spriteWrap,
        {
          opacity: reveal,
          transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }]
        }
      ]}
    >
      <GeneratedPetAssetImage
        accessibilityLabel={`${petName}'s ${cell.state} pose`}
        assetId={cell.assetId}
        remoteUri={assetUri}
        style={styles.sprite}
      />
    </Animated.View>
  );
}

interface LockedPoseSlideProps {
  petName: string;
  petSpecies: PetSpecies;
  card: FriendPoseCard | null;
  /** How many locked slides (across the whole pager) belong to this same pack -- see getRemainingPoseCountByPackId. */
  remainingCount: number;
  onUnlock: (packId: string) => void;
}

/**
 * A not-yet-owned pose: the pet's own idle art dimmed/tinted into a flat
 * silhouette (same treatment as the walk-find grid's locked cells -- real
 * shape, no spoiler) with the pack's unlock offer overlaid. There's no real
 * art to preview here (the pose doesn't exist until generated), so this
 * intentionally reuses the pet's fallback idle asset rather than a "?"
 * glyph, keeping the pager visually continuous while it's mid-swipe.
 *
 * The overlay leads with the pack name, then a pack-wide headline ("Unlock 3
 * more moments · 12cr") built from remainingCount rather than card.label --
 * the same card repeats on every locked slide of a multi-state pack, so a
 * flat "· 12cr" price read like a per-slide tag; spelling out the count
 * makes clear the price buys the pack's remaining poses all at once.
 */
function LockedPoseSlide({ petName, petSpecies, card, remainingCount, onUnlock }: LockedPoseSlideProps) {
  const fallbackAssetId = getFallbackGeneratedPetAssetId(petSpecies, "idle");

  return (
    <View style={styles.spriteWrap}>
      <GeneratedPetAssetImage
        accessibilityLabel={`An undiscovered pose of ${petName}`}
        assetId={fallbackAssetId}
        remoteUri={null}
        style={[styles.sprite, styles.spriteSilhouette]}
      />
      {card ? (
        <View style={styles.unlockOverlay}>
          <Text numberOfLines={1} style={styles.unlockPackName}>
            {card.nameEn}
          </Text>
          <Text numberOfLines={2} style={styles.unlockLabel}>
            {getUnlockOverlayHeadline(remainingCount, card.creditCost)}
          </Text>
          {card.status === "purchasing" && card.progressLine ? <Text style={styles.unlockCaption}>{card.progressLine}</Text> : null}
          {card.status === "failed" && card.failureLine ? <Text style={styles.unlockCaption}>{card.failureLine}</Text> : null}
          {card.status !== "purchasing" ? (
            <ActionButton
              accessibilityLabel={`Unlock ${card.nameEn} for ${petName}`}
              label={card.status === "failed" ? "Try again" : "Unlock"}
              Icon={Sparkles}
              size="compact"
              style={styles.unlockButton}
              onPress={() => onUnlock(card.packId)}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * The friend page hero's pet portrait, promoted from a single static sprite
 * into a horizontal pager: swipe through the everyday idle look plus every
 * owned expression, with not-yet-unlocked poses previewed as a silhouette +
 * "Unlock" offer right where the pet would otherwise be. Purely a
 * presentation of getFriendPoseGalleryPresentation's existing cells/cards --
 * the purchase flow, reveal showcase dedup, and banner copy all still live
 * in FriendProfileScreen, this just lays the same data out as swipeable
 * slides instead of a grid.
 */
export function HeroPoseSlider({
  cells,
  cards,
  petName,
  petSpecies,
  generatedAssetUriById,
  newlyRevealedPoseStates,
  reduceMotionEnabled,
  bannerLine,
  purchasingPackMessage,
  onUnlockPack
}: HeroPoseSliderProps) {
  const slides = useMemo(() => buildHeroPoseSlides(cells, cards), [cells, cards]);
  const remainingCountByPackId = useMemo(() => getRemainingPoseCountByPackId(slides), [slides]);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const rawIndex = Math.round(event.nativeEvent.contentOffset.x / SLIDE_SIZE);
    setActiveIndex(Math.max(0, Math.min(slides.length - 1, rawIndex)));
  };

  return (
    <View style={styles.wrap}>
      {bannerLine ? (
        <Text accessibilityLiveRegion="polite" style={styles.bannerLine}>
          {bannerLine}
        </Text>
      ) : null}

      <View style={styles.stage}>
        <View style={styles.shadow} />
        <ScrollView
          horizontal
          bounces={false}
          decelerationRate="fast"
          disableIntervalMomentum
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          snapToInterval={SLIDE_SIZE}
          style={styles.pager}
          onMomentumScrollEnd={handleMomentumScrollEnd}
        >
          {slides.map((slide, index) => (
            <View key={slide.cell.state} style={styles.slide}>
              {slide.cell.status === "owned" ? (
                <OwnedPoseSlide
                  assetUri={slide.cell.assetId ? (generatedAssetUriById[slide.cell.assetId] ?? null) : null}
                  cell={slide.cell}
                  isNewlyRevealed={newlyRevealedPoseStates.includes(slide.cell.state)}
                  petName={petName}
                  reduceMotionEnabled={reduceMotionEnabled}
                  staggerIndex={index}
                />
              ) : (
                <LockedPoseSlide
                  card={slide.lockedCard}
                  petName={petName}
                  petSpecies={petSpecies}
                  remainingCount={slide.lockedCard ? (remainingCountByPackId[slide.lockedCard.packId] ?? 0) : 0}
                  onUnlock={onUnlockPack}
                />
              )}
            </View>
          ))}
        </ScrollView>
      </View>

      {slides.length > 1 ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.dots}>
          {slides.map((slide, index) => (
            <View key={slide.cell.state} style={[styles.dot, index === activeIndex ? styles.dotActive : null]} />
          ))}
        </View>
      ) : null}

      {purchasingPackMessage ? <Text style={styles.purchaseMessage}>{purchasingPackMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: spacing.xs
  },
  bannerLine: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    textAlign: "center",
    paddingHorizontal: spacing.md
  },
  stage: {
    width: SLIDE_SIZE,
    height: SLIDE_SIZE,
    alignItems: "center",
    justifyContent: "flex-end"
  },
  shadow: {
    position: "absolute",
    bottom: 8,
    width: 120,
    height: 24,
    borderRadius: 999,
    backgroundColor: "rgba(60,45,35,0.22)"
  },
  pager: {
    width: SLIDE_SIZE,
    height: SLIDE_SIZE
  },
  slide: {
    width: SLIDE_SIZE,
    height: SLIDE_SIZE,
    alignItems: "center",
    justifyContent: "flex-end"
  },
  spriteWrap: {
    width: SLIDE_SIZE,
    height: SLIDE_SIZE,
    alignItems: "center",
    justifyContent: "flex-end"
  },
  sprite: {
    width: SPRITE_SIZE,
    height: SPRITE_SIZE
  },
  spriteSilhouette: {
    opacity: 0.38,
    tintColor: colors.mutedInk
  },
  unlockOverlay: {
    position: "absolute",
    left: 6,
    right: 6,
    bottom: 2,
    alignItems: "center",
    gap: 3,
    borderRadius: radii.card,
    backgroundColor: "rgba(255,245,222,0.94)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.86)",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    ...shadows.tile
  },
  unlockPackName: {
    color: colors.mutedInk,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    textAlign: "center"
  },
  unlockLabel: {
    color: colors.ink,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    textAlign: "center"
  },
  unlockCaption: {
    color: colors.mutedInk,
    fontSize: 10,
    lineHeight: 13,
    textAlign: "center"
  },
  unlockButton: {
    marginTop: 2
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(122,110,102,0.32)"
  },
  dotActive: {
    width: 16,
    backgroundColor: colors.honey
  },
  purchaseMessage: {
    color: colors.mutedInk,
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center",
    paddingHorizontal: spacing.md
  }
});
