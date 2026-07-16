import type { ViewStyle } from "react-native";

// Geometry for MongchiShareCard's hidden, always-full-resolution capture
// host -- kept as a pure function so the "must equal the export size, never
// the caller's on-screen display size" invariant is unit-testable without
// mounting the RN component tree.
//
// Root cause this guards against: react-native-svg's toDataURL resizes the
// output PNG *canvas* to the {width, height} it's given, but the native
// implementation (RNSVGSvgView#drawRect: on iOS) renders content scaled to
// the SvgView's own on-screen layout bounds, not the requested export size.
// Capturing an Svg that was laid out at a small on-screen preview size (e.g.
// the friend page's customize sheet, or the reveal screen's default card
// size) produced a large, mostly blank/transparent PNG with the card
// content crammed into its top-left corner -- exactly the size of the
// on-screen preview. Laying the capture-only host out at the literal export
// size keeps the SvgView's bounds equal to what toDataURL requests, so the
// whole canvas gets filled with card content.
export interface ShareCardCaptureHostGeometry {
  readonly width: number;
  readonly height: number;
}

/**
 * Style for the hidden capture host: pinned to the given export geometry
 * (never the caller-supplied display `style`), taken out of layout flow, and
 * fully invisible -- it exists only so `toDataURL` has a same-size SvgView
 * to read from.
 */
export const getShareCardCaptureHostStyle = (geometry: ShareCardCaptureHostGeometry): ViewStyle => ({
  position: "absolute",
  top: 0,
  left: 0,
  width: geometry.width,
  height: geometry.height,
  opacity: 0
});
