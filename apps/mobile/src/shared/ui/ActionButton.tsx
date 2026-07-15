import type { ComponentType } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Pressable, StyleSheet, Text } from "react-native";

import { colors, radii, shadows, spacing, useFontFamilies } from "../design/tokens";
import { MongchiIcon } from "./MongchiIcon";
import type { MongchiIconId } from "./mongchiIconAssets";

interface ActionButtonBaseProps {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  size?: "regular" | "compact";
  style?: StyleProp<ViewStyle>;
  variant?: "primary" | "secondary" | "danger";
}

type ActionButtonIconProps =
  | { Icon: ComponentType<{ color?: string; size?: number; strokeWidth?: number }>; iconId?: never }
  | { Icon?: never; iconId: MongchiIconId }
  | { Icon?: never; iconId?: never };

export type ActionButtonProps = ActionButtonBaseProps & ActionButtonIconProps;

export function ActionButton({
  label,
  onPress,
  accessibilityLabel,
  disabled = false,
  size = "regular",
  style,
  variant = "primary",
  Icon,
  iconId
}: ActionButtonProps) {
  const primary = variant === "primary";
  const danger = variant === "danger";
  const iconColor = disabled ? colors.mutedInk : primary ? colors.white : danger ? colors.white : colors.woodDark;
  const compact = size === "compact";
  const fontFamilies = useFontFamilies();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        compact ? styles.compactButton : null,
        primary ? styles.primary : danger ? styles.danger : styles.secondary,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style
      ]}
      onPress={onPress}
    >
      {iconId ? <MongchiIcon id={iconId} size={compact ? 20 : 24} /> : null}
      {Icon ? <Icon color={iconColor} size={compact ? 16 : 18} strokeWidth={2.5} /> : null}
      <Text
        style={[
          styles.label,
          { fontFamily: fontFamilies.button },
          compact ? styles.compactLabel : null,
          primary || danger ? styles.primaryLabel : styles.secondaryLabel,
          disabled ? styles.disabledLabel : null
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: 3,
    borderBottomWidth: 5,
    overflow: "visible"
  },
  compactButton: {
    minHeight: 46,
    paddingHorizontal: spacing.md
  },
  primary: {
    backgroundColor: "#8CCF3F",
    borderColor: colors.cream,
    ...shadows.button
  },
  secondary: {
    backgroundColor: "#FFE2B1",
    borderColor: colors.cream,
    ...shadows.tile
  },
  danger: {
    backgroundColor: colors.coral,
    borderColor: colors.cream,
    ...shadows.button
  },
  pressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 3
  },
  disabled: {
    opacity: 0.68
  },
  label: {
    fontSize: 16,
    fontWeight: "900",
    textShadowColor: "rgba(59,46,42,0.16)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0
  },
  compactLabel: {
    fontSize: 14
  },
  primaryLabel: {
    color: colors.white
  },
  secondaryLabel: {
    color: colors.ink
  },
  disabledLabel: {
    color: colors.mutedInk
  }
});
