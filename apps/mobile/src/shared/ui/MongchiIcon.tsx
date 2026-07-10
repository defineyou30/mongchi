import { Image } from "react-native";
import type { ImageStyle, StyleProp } from "react-native";

import { mongchiIconAssets } from "./mongchiIconAssets";
import type { MongchiIconId } from "./mongchiIconAssets";

type MongchiIconAccessibility =
  | { accessibilityLabel: string; decorative: false }
  | { accessibilityLabel?: never; decorative?: true };

export type MongchiIconProps = MongchiIconAccessibility & {
  id: MongchiIconId;
  size?: number;
  style?: StyleProp<ImageStyle>;
};

export function MongchiIcon({ accessibilityLabel, decorative = true, id, size = 24, style }: MongchiIconProps) {
  return (
    <Image
      accessible={!decorative}
      accessibilityElementsHidden={decorative}
      accessibilityIgnoresInvertColors
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={decorative ? "no-hide-descendants" : "yes"}
      resizeMode="contain"
      source={mongchiIconAssets[id]}
      style={[{ height: size, width: size }, style]}
    />
  );
}
