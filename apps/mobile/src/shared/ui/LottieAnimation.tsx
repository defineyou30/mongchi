import type { ComponentProps, JSX, Ref } from "react";
import LottieView from "lottie-react-native";
import { StyleSheet, View } from "react-native";

import { useReducedMotionPreference } from "../accessibility/useReducedMotionPreference";

export type LottieAnimationSource = ComponentProps<typeof LottieView>["source"];

interface LottieAnimationBaseProps {
  readonly autoPlay?: boolean;
  readonly loop?: boolean;
  /** Fires when a non-looping (loop=false) playthrough completes -- lets callers fade out / unmount a one-shot animation instead of holding its last frame forever. */
  readonly onAnimationFinish?: (isCancelled: boolean) => void;
  readonly posterProgress?: number;
  /**
   * Imperative handle onto the underlying native LottieView (React 19 accepts
   * `ref` as a plain prop on function components, no forwardRef needed) --
   * lets a caller explicitly re-issue .play() after mount as a defensive
   * fallback for cases where the native autoPlay kick was dropped. See its
   * use on the walk paw-trail loop in TerrariumHomeScreen.
   */
  readonly ref?: Ref<LottieView>;
  readonly resizeMode?: "cover" | "contain" | "center";
  readonly source: LottieAnimationSource;
  readonly style: ComponentProps<typeof LottieView>["style"];
}

type NonEmptyLiteral<Label extends string> = Label extends "" ? never : Label;

interface LabeledLottieAnimationProps<Label extends string> extends LottieAnimationBaseProps {
  readonly accessibilityLabel: NonEmptyLiteral<Label>;
  readonly decorative?: never;
}

interface DecorativeLottieAnimationProps extends LottieAnimationBaseProps {
  readonly accessibilityLabel?: never;
  readonly decorative: true;
}

type LottieAnimationProps = LabeledLottieAnimationProps<string> | DecorativeLottieAnimationProps;

export function LottieAnimation<Label extends string>(props: LabeledLottieAnimationProps<Label>): JSX.Element;
export function LottieAnimation(props: DecorativeLottieAnimationProps): JSX.Element;
export function LottieAnimation({
  accessibilityLabel,
  autoPlay = true,
  decorative,
  loop = true,
  onAnimationFinish,
  posterProgress = 0.5,
  ref,
  resizeMode = "contain",
  source,
  style
}: LottieAnimationProps) {
  const reduceMotionEnabled = useReducedMotionPreference();
  const isDecorative = decorative === true;
  const normalizedLabel = accessibilityLabel?.trim();
  const normalizedPosterProgress = Number.isFinite(posterProgress)
    ? Math.min(1, Math.max(0, posterProgress))
    : 0.5;
  const hidesFromAccessibility = isDecorative || !normalizedLabel;

  return (
    <View
      accessibilityElementsHidden={hidesFromAccessibility}
      accessibilityLabel={hidesFromAccessibility ? undefined : normalizedLabel}
      accessibilityRole={hidesFromAccessibility ? undefined : "image"}
      accessible={!hidesFromAccessibility}
      importantForAccessibility={hidesFromAccessibility ? "no-hide-descendants" : "yes"}
      pointerEvents="none"
      style={style}
    >
      <LottieView
        autoPlay={reduceMotionEnabled ? false : autoPlay}
        loop={reduceMotionEnabled ? false : loop}
        onAnimationFinish={onAnimationFinish}
        progress={reduceMotionEnabled ? normalizedPosterProgress : undefined}
        ref={ref}
        resizeMode={resizeMode}
        source={source}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
