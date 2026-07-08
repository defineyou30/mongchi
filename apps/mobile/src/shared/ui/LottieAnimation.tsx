import type { ComponentProps } from "react";
import LottieView from "lottie-react-native";

export type LottieAnimationSource = ComponentProps<typeof LottieView>["source"];

interface LottieAnimationProps {
  readonly accessibilityLabel?: string;
  readonly autoPlay?: boolean;
  readonly loop?: boolean;
  /** Fires when a non-looping (loop=false) playthrough completes -- lets callers fade out / unmount a one-shot animation instead of holding its last frame forever. */
  readonly onAnimationFinish?: (isCancelled: boolean) => void;
  readonly resizeMode?: "cover" | "contain" | "center";
  readonly source: LottieAnimationSource;
  readonly style: ComponentProps<typeof LottieView>["style"];
}

export function LottieAnimation({
  autoPlay = true,
  loop = true,
  onAnimationFinish,
  resizeMode = "contain",
  source,
  style
}: LottieAnimationProps) {
  return (
    <LottieView
      autoPlay={autoPlay}
      loop={loop}
      onAnimationFinish={onAnimationFinish}
      resizeMode={resizeMode}
      source={source}
      style={style}
    />
  );
}
