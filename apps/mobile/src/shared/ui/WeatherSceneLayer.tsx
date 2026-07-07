import { StyleSheet, View } from "react-native";

import type { WeatherOverlayKey } from "@mongchi/shared";

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

const snowDots = Array.from({ length: 16 }, (_, index) => ({
  key: `snow-${index}`,
  left: `${(index * 19 + 6) % 100}%` as const,
  top: `${(index * 29 + 8) % 90}%` as const,
  size: 4 + (index % 4) * 2,
  opacity: 0.34 + (index % 3) * 0.12
}));

const leafDots = Array.from({ length: 10 }, (_, index) => ({
  key: `leaf-${index}`,
  left: `${(index * 23 + 5) % 96}%` as const,
  top: `${(index * 31 + 12) % 88}%` as const,
  rotate: `${-28 + index * 11}deg` as const
}));

export function WeatherSceneLayer({ overlayKey }: WeatherSceneLayerProps) {
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
        </View>
      ) : null}

      {overlayKey === "snow" ? (
        <View style={[styles.weatherWash, styles.snowWash]}>
          {snowDots.map((dot) => (
            <View
              key={dot.key}
              style={[
                styles.snowDot,
                {
                  left: dot.left,
                  top: dot.top,
                  width: dot.size,
                  height: dot.size,
                  opacity: dot.opacity
                }
              ]}
            />
          ))}
        </View>
      ) : null}

      {overlayKey === "fog" ? <View style={[styles.weatherWash, styles.fogWash]} /> : null}
      {overlayKey === "night" ? <View style={[styles.weatherWash, styles.nightWash]} /> : null}
      {overlayKey === "heat" ? <View style={[styles.weatherWash, styles.heatWash]} /> : null}

      {overlayKey === "leaves" ? (
        <View style={[styles.weatherWash, styles.leafWash]}>
          {leafDots.map((leaf) => (
            <View
              key={leaf.key}
              style={[
                styles.leaf,
                {
                  left: leaf.left,
                  top: leaf.top,
                  transform: [{ rotate: leaf.rotate }]
                }
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
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
  snowDot: {
    position: "absolute",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.96)"
  },
  leaf: {
    position: "absolute",
    width: 9,
    height: 14,
    borderTopLeftRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: "rgba(255,202,92,0.7)"
  }
});
