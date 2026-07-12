import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import type { CareActionType } from "@mongchi/shared";

import { GameItemImage } from "../../shared/ui/GameIllustrations";
import { BubbleShape } from "../../shared/ui/effects/BubbleShape";
import { LottieAnimation } from "../../shared/ui/LottieAnimation";
import { useReducedMotionPreference } from "../../shared/accessibility/useReducedMotionPreference";
import { getCareMomentStaging } from "./terrariumHomeCareMoment";
import type {
  CareMomentBallStaging,
  CareMomentBowlStaging,
  CareMomentBubbleBurstStaging
} from "./terrariumHomeCareMoment";

// The affection care moment's one-shot burst (see HeartBurstMoment below) --
// required at module scope like TerrariumHomeScreen's paws-animation so the
// asset is bundled once, not re-required on every remount.
const heartBurstAnimation = require("../../../assets/lottie/heart-burst.json");

interface CareMomentLayerProps {
  /** The most recent care action, or null when nothing has fired yet this session. */
  action: CareActionType | null;
  /** Timestamp of that action -- used as the remount key so the same action fired twice in a row replays its moment. */
  actedAtMs: number | null;
  /** Bottom offset (px) of the pet stage, so props anchor relative to where the pet actually stands (see homeStageLayout.ts). */
  petStageBottomPx: number;
}

/**
 * Tier 2 "care moment" context staging (docs/gamefeel-sound-plan.md §1 Tier
 * 2): a prop appears only for the beat of the care action itself, then
 * disappears. This is a pointerEvents="none" overlay so it never intercepts
 * taps meant for the pet or the care dock underneath it. Sound is already
 * wired at the call site (TerrariumHomeScreen plays careActionSfxById on
 * every press) -- this layer is visual-only, no new audio.
 */
export function CareMomentLayer({ action, actedAtMs, petStageBottomPx }: CareMomentLayerProps) {
  const reduceMotionEnabled = useReducedMotionPreference();

  if (action === null || actedAtMs === null) {
    return null;
  }

  const staging = getCareMomentStaging(action);

  if (!staging) {
    return null;
  }

  // Keying by actedAtMs (not just staging.kind) guarantees a fresh mount --
  // and therefore a fresh animation run -- every time the same action fires
  // again, even back to back.
  const key = actedAtMs;

  if (staging.kind === "bowl") {
    return (
      <BowlMoment key={key} petStageBottomPx={petStageBottomPx} reduceMotionEnabled={reduceMotionEnabled} staging={staging} />
    );
  }

  if (staging.kind === "ball") {
    return <BallMoment key={key} petStageBottomPx={petStageBottomPx} reduceMotionEnabled={reduceMotionEnabled} staging={staging} />;
  }

  if (staging.kind === "bubbleBurst") {
    return <BubbleBurstMoment key={key} petStageBottomPx={petStageBottomPx} reduceMotionEnabled={reduceMotionEnabled} staging={staging} />;
  }

  return <HeartBurstMoment key={key} petStageBottomPx={petStageBottomPx} reduceMotionEnabled={reduceMotionEnabled} />;
}

function BowlMoment({
  staging,
  petStageBottomPx,
  reduceMotionEnabled
}: {
  staging: CareMomentBowlStaging;
  petStageBottomPx: number;
  reduceMotionEnabled: boolean;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotionEnabled) {
      // Reduced motion: skip the scale/fade choreography but still show the
      // bowl briefly (an instant appear/disappear reads better than nothing
      // for "what just happened"), matching the screen's existing
      // reduce-motion pattern of holding still instead of animating.
      progress.setValue(1);
      const timeout = setTimeout(() => progress.setValue(0), staging.holdMs);

      return () => clearTimeout(timeout);
    }

    const sequence = Animated.sequence([
      Animated.timing(progress, {
        toValue: 1,
        duration: staging.appearMs,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true
      }),
      Animated.delay(staging.holdMs),
      Animated.timing(progress, {
        toValue: 0,
        duration: staging.disappearMs,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true
      })
    ]);

    sequence.start();

    return () => sequence.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[
        styles.bowlAnchor,
        {
          bottom: petStageBottomPx + 6,
          opacity: progress,
          transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }]
        }
      ]}
    >
      <GameItemImage accessibilityLabel={staging.accessibilityLabel} decorative item={staging.item} style={styles.bowlImage} variant="action" />
    </Animated.View>
  );
}

function BallMoment({
  staging,
  petStageBottomPx,
  reduceMotionEnabled
}: {
  staging: CareMomentBallStaging;
  petStageBottomPx: number;
  reduceMotionEnabled: boolean;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotionEnabled) {
      // No arc under reduced motion -- the ball simply isn't shown mid-flight;
      // handleCareAction's existing SFX/haptic still confirms the press landed.
      return;
    }

    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: staging.totalMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    });

    animation.start();

    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (reduceMotionEnabled) {
    return null;
  }

  // Rolls from just beside the pet out to the right and back down, with a
  // bounce-ish arc (translateY dips then rises) and a spin (rotate) so it
  // reads as a thrown ball rather than a sliding icon. No fail state -- the
  // ball always completes its little trip and fades near the end.
  const translateX = progress.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, 96, 132] });
  const translateY = progress.interpolate({ inputRange: [0, 0.35, 0.7, 1], outputRange: [0, -46, -6, 0] });
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "540deg"] });
  const opacity = progress.interpolate({ inputRange: [0, 0.08, 0.82, 1], outputRange: [0, 1, 1, 0] });
  const scale = progress.interpolate({ inputRange: [0, 0.08, 1], outputRange: [0.6, 1, 0.9] });

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[
        styles.ballAnchor,
        {
          bottom: petStageBottomPx + 30,
          opacity,
          transform: [{ translateX }, { translateY }, { rotate }, { scale }]
        }
      ]}
    >
      <GameItemImage accessibilityLabel={staging.accessibilityLabel} decorative item={staging.item} style={styles.ballImage} variant="action" />
    </Animated.View>
  );
}

// How long the burst's opacity takes to fade to nothing once the Lottie
// playthrough finishes, so the last frame never just sits there frozen.
const HEART_BURST_FADE_OUT_MS = 280;

function HeartBurstMoment({
  petStageBottomPx,
  reduceMotionEnabled
}: {
  petStageBottomPx: number;
  reduceMotionEnabled: boolean;
}) {
  const opacity = useRef(new Animated.Value(1)).current;
  const [hasFinishedPlaying, setHasFinishedPlaying] = useState(false);

  useEffect(() => {
    if (!hasFinishedPlaying) {
      return;
    }

    const animation = Animated.timing(opacity, {
      toValue: 0,
      duration: HEART_BURST_FADE_OUT_MS,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true
    });

    animation.start();

    return () => animation.stop();
  }, [hasFinishedPlaying, opacity]);

  if (reduceMotionEnabled) {
    return null;
  }

  // A single heart-burst Lottie plays once over the pet, then fades out --
  // replacing the old 2-3 drifting SVG hearts (BubbleBurstMoment below keeps
  // its SVG bubbles; only affection's moment moved to Lottie).
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.heartBurstAnchor, { bottom: petStageBottomPx + 30, opacity }]}
    >
      <LottieAnimation
        autoPlay
        decorative
        loop={false}
        source={heartBurstAnimation}
        style={styles.heartBurstAnimation}
        onAnimationFinish={() => setHasFinishedPlaying(true)}
      />
    </Animated.View>
  );
}

function BubbleBurstMoment({
  staging,
  petStageBottomPx,
  reduceMotionEnabled
}: {
  staging: CareMomentBubbleBurstStaging;
  petStageBottomPx: number;
  reduceMotionEnabled: boolean;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotionEnabled) {
      return;
    }

    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: staging.totalMs,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true
    });

    animation.start();

    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (reduceMotionEnabled) {
    return null;
  }

  // 2-3 small soap bubbles drift up from just above the pet's body, each
  // offset slightly in x with a small stagger, same choreography as
  // HeartBurstMoment -- but instead of a steady shrink-and-fade, each bubble
  // scales up past 1x right at the end of its life so it reads as "popping"
  // rather than just drifting off screen.
  const bubbleOffsets = bubbleOffsetsByCount[staging.bubbleCount] ?? defaultBubbleOffsets;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.bubbleAnchor, { bottom: petStageBottomPx + 140 }]}
    >
      {bubbleOffsets.map((offsetX, index) => {
        const staggerStart = index * 0.12;
        const localProgress = progress.interpolate({
          inputRange: [0, Math.min(0.999, staggerStart), 1],
          outputRange: [0, 0, 1],
          extrapolate: "clamp"
        });
        // Alternating sizes read as a small cluster of bubbles rather than
        // one repeated shape (previously alternating "○"/"◦" glyphs).
        const bubbleSize = index % 2 === 0 ? 18 : 13;

        return (
          <Animated.View
            key={offsetX}
            style={[
              styles.bubbleParticle,
              {
                left: offsetX,
                opacity: localProgress.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] }),
                transform: [
                  { translateY: localProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -54] }) },
                  { scale: localProgress.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0.4, 1, 1.05, 1.4] }) }
                ]
              }
            ]}
          >
            <BubbleShape size={bubbleSize} />
          </Animated.View>
        );
      })}
    </View>
  );
}

const defaultBubbleOffsets = [-22, 0, 22];

const bubbleOffsetsByCount: Record<number, number[]> = {
  2: [-16, 16],
  3: defaultBubbleOffsets
};

const styles = StyleSheet.create({
  bowlAnchor: {
    position: "absolute",
    alignSelf: "center",
    left: "50%",
    marginLeft: 46,
    zIndex: 54,
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center"
  },
  bowlImage: {
    width: 60,
    height: 60
  },
  ballAnchor: {
    position: "absolute",
    alignSelf: "center",
    left: "50%",
    marginLeft: -20,
    zIndex: 54,
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center"
  },
  ballImage: {
    width: 44,
    height: 44
  },
  heartBurstAnchor: {
    position: "absolute",
    alignSelf: "center",
    left: "50%",
    marginLeft: -80,
    zIndex: 56,
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center"
  },
  heartBurstAnimation: {
    width: 160,
    height: 160
  },
  bubbleAnchor: {
    position: "absolute",
    alignSelf: "center",
    left: "50%",
    marginLeft: -30,
    zIndex: 56,
    width: 60,
    height: 20
  },
  bubbleParticle: {
    position: "absolute"
  }
});
