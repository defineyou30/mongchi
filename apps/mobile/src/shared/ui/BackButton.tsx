import { Pressable, StyleSheet } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

import { shadows } from "../design/tokens";
import { MongchiIcon } from "./MongchiIcon";

interface BackButtonProps {
  accessibilityLabel?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Shared circular back button — same cream tile + Mongchi back artwork used by
 * GardenSceneFrame's built-in back button, extracted so screens that need
 * custom placement (spacing, in-flow layout) can render it themselves
 * instead of relying on GardenSceneFrame's absolute-positioned slot.
 */
export function BackButton({ accessibilityLabel = "Back", onPress, style }: BackButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={10}
      style={({ pressed }) => [styles.backButton, pressed ? styles.backButtonPressed : null, style]}
      onPress={onPress}
    >
      <MongchiIcon id="back" size={26} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,245,222,0.94)",
    borderWidth: 3,
    borderBottomWidth: 5,
    borderColor: "rgba(255,255,255,0.86)",
    alignItems: "center",
    justifyContent: "center",
    ...shadows.tile
  },
  backButtonPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 3
  }
});
