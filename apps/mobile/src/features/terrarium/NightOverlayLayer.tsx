import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import { useFontFamilies } from "../../shared/design/tokens";

/**
 * Tier 3 "world autonomy" night dressing (docs/gamefeel-sound-plan.md §1
 * Tier 3): a soft navy wash over the whole scene plus a few floating "zzz"
 * glyphs near the sleeping pet, active for the same 22:00-06:00 local window
 * TerrariumHomeScreen already put the pet into its `sleep` pose for (see
 * isNightTime in @mongchi/shared). Purely decorative -- pointerEvents="none"
 * throughout so it never intercepts taps meant for the pet, HUD, or care
 * tray underneath it.
 *
 * Split into two components rather than one because they belong at
 * different depths of TerrariumHomeScreen's render tree: NightWashLayer
 * renders right after the background ImageBackground (same depth as
 * WeatherSceneLayer) so it tints the whole scene *behind* the pet and HUD,
 * while NightZzzFloat needs to render *inside* stageLayer -- the same parent
 * as the pet sprite (see CareMomentLayer's heart-burst for the identical
 * reason) -- so its zIndex is actually compared against the pet's instead of
 * against a sibling subtree the pet lives deep inside of, which would have
 * silently painted the zzz float behind the pet.
 */
export function NightWashLayer() {
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={styles.wash} />;
}

interface NightZzzFloatProps {
  petStageBottomPx: number;
  reduceMotionEnabled: boolean;
}

/**
 * Kept as literal "Zzz" text rather than converted to an SVG glyph (unlike
 * CareMomentLayer's heart/bubble particles): "z" is already a legible,
 * universally-understood sleep symbol on its own -- there's no emoji or
 * platform-glyph-font mismatch here the way "❤"/"○" had, since these are
 * plain ASCII characters rendered in the app's own font. The pixel-tone gap
 * was purely typographic (the system default font), so the fix is to pull
 * the glyph onto the same pixel display face (fontFamilies.display,
 * "PixelifySans_700Bold" for the shipped pair) the rest of the game's
 * headers/titles already use, rather than reaching for a heavier SVG shape.
 */
export function NightZzzFloat({ petStageBottomPx, reduceMotionEnabled }: NightZzzFloatProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const fontFamilies = useFontFamilies();

  useEffect(() => {
    if (reduceMotionEnabled) {
      return;
    }

    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 3200,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true
      })
    );

    loop.start();

    return () => loop.stop();
  }, [progress, reduceMotionEnabled]);

  if (reduceMotionEnabled) {
    // Reduced motion: a single still "zzz" reads the sleeping state without
    // any looping float animation, matching the rest of this screen's
    // reduce-motion pattern of holding still instead of animating.
    return (
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={[styles.zzzAnchor, { bottom: petStageBottomPx + 150 }]}>
        <Text style={[styles.zzzGlyph, { fontFamily: fontFamilies.display }]}>{"z z z"}</Text>
      </View>
    );
  }

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -22] });
  const opacity = progress.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] });
  const scale = progress.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.7, 1, 1.15] });

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={[styles.zzzAnchor, { bottom: petStageBottomPx + 150 }]}>
      <Animated.Text style={[styles.zzzGlyph, { fontFamily: fontFamilies.display, opacity, transform: [{ translateY }, { scale }] }]}>{"Zzz"}</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(22,28,64,0.28)",
    zIndex: 12
  },
  zzzAnchor: {
    position: "absolute",
    alignSelf: "center",
    left: "50%",
    marginLeft: 34,
    zIndex: 57,
    width: 60,
    height: 30,
    alignItems: "center",
    justifyContent: "center"
  },
  zzzGlyph: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: "700",
    letterSpacing: 1,
    color: "rgba(255,255,255,0.88)",
    textShadowColor: "rgba(22,28,64,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2
  }
});
