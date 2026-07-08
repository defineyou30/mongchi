import Svg, { Ellipse, Path } from "react-native-svg";

interface HeartShapeProps {
  /** Overall width & height in px. Defaults to the size the old "❤" glyph rendered at. */
  size?: number;
  /** Main fill color -- defaults to the warm coral-rose used by the original glyph. */
  fillColor?: string;
  /** Small top-left gloss highlight, giving the heart a cozy sticker feel instead of a flat glyph. */
  highlightColor?: string;
}

/**
 * A small filled heart used by CareMomentLayer's affection burst (see
 * HeartBurstMoment). Replaces the old "❤" emoji glyph -- which renders via
 * the platform's emoji font and clashes with the app's pixel/sticker
 * illustration tone -- with a vector shape drawn from the same palette.
 */
export function HeartShape({ size = 20, fillColor = "#FF6B8A", highlightColor = "rgba(255,255,255,0.75)" }: HeartShapeProps) {
  return (
    <Svg height={size} viewBox="0 0 24 24" width={size}>
      <Path
        d="M12 20.6c-.35 0-.68-.13-.94-.36C7.15 16.9 3.4 13.4 3.4 9.35 3.4 6.4 5.75 4 8.7 4c1.5 0 2.93.68 3.3 1.98C12.37 4.68 13.8 4 15.3 4c2.95 0 5.3 2.4 5.3 5.35 0 4.05-3.75 7.55-7.66 10.89-.26.23-.59.36-.94.36z"
        fill={fillColor}
      />
      <Ellipse cx="8.6" cy="8.7" fill={highlightColor} rx="1.7" ry="1" transform="rotate(-28 8.6 8.7)" />
    </Svg>
  );
}
