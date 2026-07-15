import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from "react-native";

import type { WeatherOverlayKey } from "@mongchi/shared";

import { useReducedMotionPreference } from "../accessibility/useReducedMotionPreference";
import {
  STORM_LEAF_COUNT,
  WIND_LEAF_COUNT,
  buildSnowflakeParticles,
  buildWindLeafParticles
} from "./weatherParticleLayout";
import type { SnowflakeParticleSpec, WindLeafParticleSpec } from "./weatherParticleLayout";

interface WeatherSceneLayerProps {
  overlayKey: WeatherOverlayKey;
}

const rainDrops = Array.from({ length: 18 }, (_, index) => ({
  key: `rain-${index}`,
  left: `${(index * 17 + 9) % 100}%` as const,
  top: `${(index * 23 + 4) % 88}%` as const,
  opacity: 0.22 + (index % 4) * 0.08,
  height: 34 + (index % 5) * 8
}));

// Module-scope (not per-render): buildSnowflakeParticles/buildWindLeafParticles
// are pure functions of `count` alone (see weatherParticleLayout.ts), so
// there's nothing to recompute on re-render -- the same three arrays feed
// every mount of this component, exactly like the rainDrops table above.
const snowflakeParticles = buildSnowflakeParticles();
const windLeafParticles = buildWindLeafParticles(WIND_LEAF_COUNT);
const stormLeafParticles = buildWindLeafParticles(STORM_LEAF_COUNT);

export function WeatherSceneLayer({ overlayKey }: WeatherSceneLayerProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const reduceMotionEnabled = useReducedMotionPreference();

  if (overlayKey === "none") {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.root}>
      {overlayKey === "rain" || overlayKey === "storm" ? (
        <View style={[styles.weatherWash, overlayKey === "storm" ? styles.stormWash : styles.rainWash]}>
          {rainDrops.map((drop) => (
            <View
              key={drop.key}
              style={[
                styles.rainDrop,
                {
                  left: drop.left,
                  top: drop.top,
                  height: drop.height,
                  opacity: drop.opacity
                }
              ]}
            />
          ))}
          {/* A storm is windy rain -- a couple of the same wind-leaf particles
              (see the "leaves" branch below) ride along on top, just fewer of
              them than a plain windy day gets. */}
          {stormLeafParticles.map((leaf) => (
            <WindLeafSprite key={leaf.key} reduceMotionEnabled={reduceMotionEnabled} spec={leaf} windowWidth={windowWidth} />
          ))}
        </View>
      ) : null}

      {overlayKey === "snow" ? (
        <View style={[styles.weatherWash, styles.snowWash]}>
          {snowflakeParticles.map((flake) => (
            <SnowflakeSprite key={flake.key} reduceMotionEnabled={reduceMotionEnabled} spec={flake} windowHeight={windowHeight} />
          ))}
        </View>
      ) : null}

      {overlayKey === "fog" ? <View style={[styles.weatherWash, styles.fogWash]} /> : null}
      {overlayKey === "night" ? <View style={[styles.weatherWash, styles.nightWash]} /> : null}
      {overlayKey === "heat" ? <View style={[styles.weatherWash, styles.heatWash]} /> : null}

      {overlayKey === "leaves" ? (
        <View style={[styles.weatherWash, styles.leafWash]}>
          {windLeafParticles.map((leaf) => (
            <WindLeafSprite key={leaf.key} reduceMotionEnabled={reduceMotionEnabled} spec={leaf} windowWidth={windowWidth} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

interface SnowflakeSpriteProps {
  spec: SnowflakeParticleSpec;
  windowHeight: number;
  reduceMotionEnabled: boolean;
}

/**
 * One slowly-drifting snowflake: falls top-to-bottom on a loop with a gentle
 * side-to-side sway, each flake at its own speed/drift/rotation (see
 * buildSnowflakeParticles) so the layer reads as many individual flakes
 * rather than one sprite repeated. Both loop endpoints (fall=0 just above
 * the top edge, fall=1 just below the bottom edge) sit outside the visible
 * viewport, so Animated.loop's reset-to-start jump between falls is never
 * actually seen.
 */
function SnowflakeSprite({ spec, windowHeight, reduceMotionEnabled }: SnowflakeSpriteProps) {
  const fall = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotionEnabled) {
      return undefined;
    }

    let continuousFall: Animated.CompositeAnimation | null = null;

    // One-time delayed first fall staggers each flake's starting phase (so
    // they don't all begin bunched near the top edge on mount); afterward
    // the fall loops continuously with no further delay.
    const firstFall = Animated.sequence([
      Animated.delay(spec.startDelayMs),
      Animated.timing(fall, { toValue: 1, duration: spec.fallDurationMs, easing: Easing.linear, useNativeDriver: true })
    ]);

    firstFall.start(({ finished }) => {
      if (!finished) {
        return;
      }

      continuousFall = Animated.loop(
        Animated.timing(fall, { toValue: 1, duration: spec.fallDurationMs, easing: Easing.linear, useNativeDriver: true })
      );
      continuousFall.start();
    });

    return () => {
      firstFall.stop();
      continuousFall?.stop();
    };
  }, [fall, reduceMotionEnabled, spec.fallDurationMs, spec.startDelayMs]);

  if (reduceMotionEnabled) {
    // Reduced motion: a single still flake at a representative resting spot
    // reads the "it's snowing" state without any falling/drifting loop,
    // matching this screen's other reduce-motion fallbacks (see
    // NightZzzFloat in NightOverlayLayer.tsx).
    return (
      <View
        style={[
          styles.snowflakeAnchor,
          { left: `${spec.leftPercent}%`, top: `${spec.restTopPercent}%`, opacity: spec.baseOpacity }
        ]}
      >
        <View style={[styles.snowflakeDot, { width: spec.sizePx, height: spec.sizePx }]} />
      </View>
    );
  }

  const translateY = fall.interpolate({ inputRange: [0, 1], outputRange: [-20, windowHeight + 20] });
  const translateX = fall.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, spec.driftAmplitudePx, 0, -spec.driftAmplitudePx, 0]
  });
  const rotate = fall.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [`-${spec.rotateAmplitudeDeg}deg`, `${spec.rotateAmplitudeDeg}deg`, `-${spec.rotateAmplitudeDeg}deg`]
  });

  return (
    <Animated.View
      style={[
        styles.snowflakeAnchor,
        { left: `${spec.leftPercent}%`, opacity: spec.baseOpacity, transform: [{ translateX }, { translateY }, { rotate }] }
      ]}
    >
      <View style={[styles.snowflakeDot, { width: spec.sizePx, height: spec.sizePx }]} />
    </Animated.View>
  );
}

interface WindLeafSpriteProps {
  spec: WindLeafParticleSpec;
  windowWidth: number;
  reduceMotionEnabled: boolean;
}

/**
 * One leaf/petal drifting across the scene on a curved path, then parked
 * off-screen for a pause before crossing again (see buildWindLeafParticles'
 * pauseDurationMs) -- the "intermittent handful," not a constant stream.
 * Both loop endpoints (progress=0 and progress=1) map to off-screen
 * positions on the leaf's crossing axis, so the reset-to-start jump between
 * crossings is never actually seen.
 */
function WindLeafSprite({ spec, windowWidth, reduceMotionEnabled }: WindLeafSpriteProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotionEnabled) {
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: 1, duration: spec.crossDurationMs, easing: Easing.linear, useNativeDriver: true }),
        Animated.delay(spec.pauseDurationMs)
      ])
    );

    loop.start();

    return () => loop.stop();
  }, [progress, reduceMotionEnabled, spec.crossDurationMs, spec.pauseDurationMs]);

  if (reduceMotionEnabled) {
    // Reduced motion: a single still leaf at a representative resting spot,
    // same fallback shape as SnowflakeSprite above.
    return (
      <View style={[styles.leafAnchor, { left: `${spec.restLeftPercent}%`, top: `${spec.topPercent}%` }]}>
        <View style={[styles.leaf, { transform: [{ rotate: `${spec.rotateAmplitudeDeg}deg` }] }]} />
      </View>
    );
  }

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: spec.direction === 1 ? [-24, windowWidth + 24] : [windowWidth + 24, -24]
  });
  const translateY = progress.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, -spec.bobAmplitudePx, spec.bobAmplitudePx * 0.4, -spec.bobAmplitudePx * 0.6, 0]
  });
  const rotate = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [`-${spec.rotateAmplitudeDeg}deg`, `${spec.rotateAmplitudeDeg}deg`, `-${spec.rotateAmplitudeDeg}deg`]
  });
  const opacity = progress.interpolate({ inputRange: [0, 0.06, 0.94, 1], outputRange: [0, 1, 1, 0] });

  return (
    <Animated.View
      style={[styles.leafAnchor, { top: `${spec.topPercent}%`, opacity, transform: [{ translateX }, { translateY }, { rotate }] }]}
    >
      <View style={styles.leaf} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill
  },
  weatherWash: {
    ...StyleSheet.absoluteFill
  },
  rainWash: {
    backgroundColor: "rgba(91,139,178,0.16)"
  },
  stormWash: {
    backgroundColor: "rgba(47,62,96,0.24)"
  },
  snowWash: {
    backgroundColor: "rgba(222,244,255,0.2)"
  },
  fogWash: {
    backgroundColor: "rgba(237,246,237,0.34)"
  },
  nightWash: {
    backgroundColor: "rgba(25,35,82,0.26)"
  },
  heatWash: {
    backgroundColor: "rgba(255,203,111,0.16)"
  },
  leafWash: {
    backgroundColor: "rgba(255,235,188,0.08)"
  },
  rainDrop: {
    position: "absolute",
    width: 2,
    borderRadius: 2,
    backgroundColor: "rgba(238,251,255,0.96)",
    transform: [{ rotate: "14deg" }]
  },
  snowflakeAnchor: {
    position: "absolute",
    top: 0
  },
  snowflakeDot: {
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.96)"
  },
  leafAnchor: {
    position: "absolute",
    left: 0
  },
  leaf: {
    width: 9,
    height: 14,
    borderTopLeftRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: "rgba(255,202,92,0.7)"
  }
});
