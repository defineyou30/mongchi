import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, shadows, spacing, useFontFamilies } from "../design/tokens";

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export function Chip({ label, selected, onPress }: ChipProps) {
  const fontFamilies = useFontFamilies();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[styles.chip, selected ? styles.selected : null]}
      onPress={onPress}
    >
      <View pointerEvents="none" style={[styles.face, selected ? styles.selectedFace : null]} />
      <Text style={[styles.label, { fontFamily: fontFamilies.button }, selected ? styles.selectedLabel : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    borderRadius: radii.pill,
    borderWidth: 3,
    borderBottomWidth: 5,
    borderColor: colors.cream,
    backgroundColor: "#C47D35",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    overflow: "hidden",
    ...shadows.tile
  },
  selected: {
    borderColor: colors.white,
    backgroundColor: colors.gold
  },
  face: {
    ...StyleSheet.absoluteFill,
    top: 3,
    left: 4,
    right: 4,
    bottom: 5,
    borderRadius: radii.pill,
    backgroundColor: "#FFE3AE"
  },
  selectedFace: {
    backgroundColor: colors.honey
  },
  label: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900"
  },
  selectedLabel: {
    color: colors.woodDark
  }
});
