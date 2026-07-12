import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";

const butterflyAsset = require("../../../assets/game-fx/butterfly.png");

/**
 * Tier 3 "world autonomy" daytime visitor (docs/gamefeel-sound-plan.md §1
 * Tier 3): a small pixel butterfly drifts across the scene on a sine-ish
 * path, once per home-screen entry at most (see shouldSpawnButterflyVisit in
 * @mongchi/shared). Tapping it fires onCaught (the caller reacts with a
 * curious expression + a short tap line) and the butterfly disappears --
 * this layer only owns the flight path and the tap target, never the pet's
 * reaction.
 */
interface ButterflyVisitorLayerProps {
  windowWidth: number;
  windowHeight: number;
  reduceMotionEnabled: boolean;
  onCaught: () => void;
  onFlownOff: () => void;
}

const FLIGHT_DURATION_MS = 9000;

export function ButterflyVisitorLayer({ windowWidth, windowHeight, reduceMotionEnabled, onCaught, onFlownOff }: ButterflyVisitorLayerProps) {
  const { t } = useTranslation();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotionEnabled) {
      // No flight path to fly under reduced motion -- the visitor simply
      // doesn't appear this entry rather than popping in statically, since a
      // static butterfly with no way to notice or catch it isn't worth the
      // clutter.
      onFlownOff();
      return;
    }

    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: FLIGHT_DURATION_MS,
      easing: Easing.linear,
      useNativeDriver: true
    });

    animation.start(({ finished }) => {
      if (finished) {
        onFlownOff();
      }
    });

    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotionEnabled]);

  if (reduceMotionEnabled) {
    return null;
  }

  // Crosses left-to-right, with a gentle sine bob layered on top so the path
  // reads as fluttering rather than a straight slide.
  const startX = -40;
  const endX = windowWidth + 40;
  const baseY = windowHeight * 0.28;

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [startX, endX] });
  const translateY = progress.interpolate({
    inputRange: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1],
    outputRange: [0, -26, 6, -22, 10, -18, 4, -10].map((value) => baseY + value)
  });
  const opacity = progress.interpolate({ inputRange: [0, 0.06, 0.94, 1], outputRange: [0, 1, 1, 0] });
  const rotate = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["-8deg", "8deg", "-8deg"] });

  return (
    <Animated.View pointerEvents="box-none" style={[styles.flightAnchor, { opacity, transform: [{ translateX }, { translateY }] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("home.butterflyAccessibilityLabel")}
        hitSlop={16}
        style={styles.tapTarget}
        onPress={onCaught}
      >
        <Animated.Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={butterflyAsset}
          style={[styles.glyph, { transform: [{ rotate }] }]}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flightAnchor: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 58
  },
  tapTarget: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center"
  },
  glyph: {
    width: 28,
    height: 28
  }
});
