import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useTranslation } from "react-i18next";

import type { GeneratedAssetId, PetSpecies } from "@mongchi/shared";

import { normalizeAppLocale } from "../../localization/localeNormalization";
import { getFallbackGeneratedPetAssetId, GeneratedPetAssetImage } from "../../shared/assets/generatedPetAssets";
import { colors, spacing } from "../../shared/design/tokens";
import { ActionButton } from "../../shared/ui/ActionButton";
import { buildHeroPoseSlides, getHeroPoseLabel } from "./friendHeroPosePresentation";
import type { FriendPoseCell } from "./friendProfilePresentation";

const SLIDE_SIZE = 200;
const SPRITE_SIZE = 196;
const POSE_REVEAL_STAGGER_MS = 200;
const POSE_REVEAL_MAX_STAGGER_INDEX = 8;

interface HeroPoseSliderProps {
  cells: FriendPoseCell[];
  petName: string;
  petSpecies: PetSpecies;
  generatedAssetUriById: Partial<Record<GeneratedAssetId, string>>;
  newlyRevealedPoseStates: readonly string[];
  reduceMotionEnabled: boolean;
  bannerLine: string | null;
  showPoseShopButton: boolean;
  onOpenPoseShop: () => void;
}

interface OwnedPoseSlideProps {
  cell: FriendPoseCell;
  petName: string;
  assetUri: string | null;
  isNewlyRevealed: boolean;
  staggerIndex: number;
  reduceMotionEnabled: boolean;
}

function OwnedPoseSlide({ cell, petName, assetUri, isNewlyRevealed, staggerIndex, reduceMotionEnabled }: OwnedPoseSlideProps) {
  const { i18n, t } = useTranslation();
  const locale = normalizeAppLocale(i18n.resolvedLanguage);
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
  }, [isNewlyRevealed, reduceMotionEnabled, reveal, staggerIndex]);

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
        accessibilityLabel={t("friend.pose.accessibilityLabel", { petName, pose: getHeroPoseLabel(cell.state, locale) })}
        assetId={cell.assetId}
        remoteUri={assetUri}
        style={styles.sprite}
      />
    </Animated.View>
  );
}

export function HeroPoseSlider({
  cells,
  petName,
  petSpecies,
  generatedAssetUriById,
  newlyRevealedPoseStates,
  reduceMotionEnabled,
  bannerLine,
  showPoseShopButton,
  onOpenPoseShop
}: HeroPoseSliderProps) {
  const { i18n, t } = useTranslation();
  const locale = normalizeAppLocale(i18n.resolvedLanguage);
  const slides = useMemo(() => buildHeroPoseSlides(cells), [cells]);
  const pagerRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeState = slides[activeIndex]?.cell.state ?? "idle";
  const activeLabel = getHeroPoseLabel(activeState, locale);

  const setPagerIndex = (index: number) => {
    const nextIndex = Math.max(0, Math.min(slides.length - 1, index));
    pagerRef.current?.scrollTo({ x: nextIndex * SLIDE_SIZE, animated: !reduceMotionEnabled });
    setActiveIndex(nextIndex);
  };

  const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPagerIndex(Math.round(event.nativeEvent.contentOffset.x / SLIDE_SIZE));
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
          ref={pagerRef}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          accessibilityLabel={t("friend.pose.collectionAccessibilityLabel", { petName })}
          accessibilityRole="adjustable"
          accessibilityValue={{ text: t("friend.pose.position", { current: activeIndex + 1, total: slides.length, pose: activeLabel }) }}
          horizontal
          bounces={false}
          decelerationRate="fast"
          disableIntervalMomentum
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          snapToInterval={SLIDE_SIZE}
          style={styles.pager}
          onAccessibilityAction={(event) => setPagerIndex(activeIndex + (event.nativeEvent.actionName === "increment" ? 1 : -1))}
          onMomentumScrollEnd={handleMomentumScrollEnd}
        >
          {slides.map((slide, index) => {
            const assetId = slide.cell.assetId ?? getFallbackGeneratedPetAssetId(petSpecies, slide.cell.state);

            return (
              <View key={slide.cell.state} style={styles.slide}>
                <OwnedPoseSlide
                  assetUri={slide.cell.assetId ? (generatedAssetUriById[slide.cell.assetId] ?? null) : null}
                  cell={{ ...slide.cell, assetId }}
                  isNewlyRevealed={newlyRevealedPoseStates.includes(slide.cell.state)}
                  petName={petName}
                  reduceMotionEnabled={reduceMotionEnabled}
                  staggerIndex={index}
                />
              </View>
            );
          })}
        </ScrollView>
      </View>

      <Text accessibilityLiveRegion="polite" style={styles.posePositionLabel}>
        {t("friend.pose.position", { current: activeIndex + 1, total: slides.length, pose: activeLabel })}
      </Text>

      {slides.length > 1 ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.dots}>
          {slides.map((slide, index) => (
            <View key={slide.cell.state} style={[styles.dot, index === activeIndex ? styles.dotActive : null]} />
          ))}
        </View>
      ) : null}

      {showPoseShopButton ? (
        <ActionButton
          accessibilityLabel={t("friend.pose.moreAccessibilityLabel")}
          label={t("friend.pose.more")}
          iconId="sparkles"
          size="compact"
          style={styles.poseShopButton}
          onPress={onOpenPoseShop}
        />
      ) : null}
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
  posePositionLabel: {
    color: colors.mutedInk,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    textAlign: "center",
    paddingHorizontal: spacing.md
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
  poseShopButton: {
    minWidth: 156,
    marginTop: spacing.xs
  }
});
