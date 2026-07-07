import type { ComponentProps } from "react";
import LottieView from "lottie-react-native";

export type LottieAnimationSource = ComponentProps<typeof LottieView>["source"];

interface LottieAnimationProps {
  readonly accessibilityLabel?: string;
  readonly autoPlay?: boolean;
  readonly loop?: boolean;
  readonly resizeMode?: "cover" | "contain" | "center";
  readonly source: LottieAnimationSource;
  readonly style: ComponentProps<typeof LottieView>["style"];
}

export function LottieAnimation({
  autoPlay = true,
  loop = true,
  resizeMode = "contain",
  source,
  style
}: LottieAnimationProps) {
  return (
    <LottieView
      autoPlay={autoPlay}
      loop={loop}
      resizeMode={resizeMode}
      source={source}
      style={style}
    />
  );
}
