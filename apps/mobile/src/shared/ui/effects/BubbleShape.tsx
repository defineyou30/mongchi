import Svg, { Circle } from "react-native-svg";

interface BubbleShapeProps {
  /** Overall width & height in px. Defaults to the larger of the old "○"/"◦" glyph sizes. */
  size?: number;
  /** Translucent pale-blue fill for the bubble body. */
  fillColor?: string;
  /** Rim color, a touch brighter than the fill so the bubble reads as round, not flat. */
  strokeColor?: string;
  /** Small upper-left highlight dot that sells the "soap bubble" gloss. */
  highlightColor?: string;
}

/**
 * A small soap bubble used by CareMomentLayer's Bath care moment (see
 * BubbleBurstMoment). Replaces the old "○"/"◦" unicode glyphs with a vector
 * circle so the shape matches the app's pixel/sticker illustration tone
 * instead of relying on the platform's default glyph rendering.
 */
export function BubbleShape({
  size = 18,
  fillColor = "rgba(201,240,255,0.55)",
  strokeColor = "rgba(255,255,255,0.85)",
  highlightColor = "#FFFFFF"
}: BubbleShapeProps) {
  return (
    <Svg height={size} viewBox="0 0 24 24" width={size}>
      <Circle cx="12" cy="12" fill={fillColor} r="10" stroke={strokeColor} strokeWidth={1.2} />
      <Circle cx="8.3" cy="8" fill={highlightColor} fillOpacity={0.9} r="2.3" />
    </Svg>
  );
}
