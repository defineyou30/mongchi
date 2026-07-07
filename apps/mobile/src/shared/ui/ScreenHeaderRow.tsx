import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

import { colors } from "../design/tokens";
import { BackButton } from "./BackButton";

const BALANCE_SPACER_WIDTH = 48;

interface ScreenHeaderRowProps {
  title: string;
  titleFontFamily?: string;
  onBack: () => void;
  backAccessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  /** Optional trailing slot (e.g. an icon button) instead of the plain balance spacer -- keeps the title centered as long as it's roughly BackButton-sized. */
  trailing?: ReactNode;
  /** Optional right-side slot (e.g. a wider balance pill). Unlike `trailing`, this is not constrained to BALANCE_SPACER_WIDTH -- the title is centered absolutely across the full row so it stays centered regardless of this slot's width. */
  right?: ReactNode;
}

/**
 * Shared header row for screens that want their title centered on the same
 * line as the back button. The title is positioned absolutely across the
 * full width of the row (behind the back button and right slot in z-order),
 * so it stays dead-center no matter how wide the left/right content is.
 * BackButton and the right slot stay in normal flow (space-between) so the
 * row's height is still driven by whichever is tallest.
 */
export function ScreenHeaderRow({ title, titleFontFamily, onBack, backAccessibilityLabel = "Back", style, trailing, right }: ScreenHeaderRowProps) {
  return (
    <View style={[styles.row, style]}>
      <Text accessibilityRole="header" numberOfLines={1} style={[styles.title, titleFontFamily ? { fontFamily: titleFontFamily } : null]}>
        {title}
      </Text>
      <BackButton accessibilityLabel={backAccessibilityLabel} onPress={onBack} />
      {right ?? <View style={styles.balanceSpacer}>{trailing}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  title: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: -1,
    paddingHorizontal: 58,
    color: colors.ink,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "900",
    textAlign: "center"
  },
  balanceSpacer: {
    width: BALANCE_SPACER_WIDTH,
    alignItems: "center",
    justifyContent: "center"
  }
});
