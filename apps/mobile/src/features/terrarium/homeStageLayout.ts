/**
 * Pure layout math for the home pet stage and its speech bubble.
 *
 * These two elements used to be pinned at fixed pixel offsets from the
 * screen bottom (`homePetStage.bottom: 170`, `homeThoughtBubble.bottom:
 * 386`). That reads fine on a tall device but not on the smallest supported
 * screens: on an iPhone SE-class window (667pt tall) the thought bubble's
 * bottom edge lands almost exactly at the pet stage's top edge, so a 3-line
 * bubble (see getHomeThoughtBubbleHeightPx) would overlap the pet. Both
 * elements are now placed as a ratio of the actual window height (via
 * useWindowDimensions in TerrariumHomeScreen), clamped so they never crowd
 * the top HUD or the bottom care tray.
 *
 * Horizontal centering is computed from the actual window width rather than
 * a parent-relative `left: "50%"`, so it can't be thrown off by an
 * unexpected offset or padding anywhere up the view tree.
 */

/** Bottom care tray footprint (careGrid: bottom 72 + button height 70). */
const CARE_TRAY_TOP_PX_FROM_BOTTOM = 72 + 70;
/** Roughly where the top HUD (resource bar + care feedback toast) ends. */
const HUD_BOTTOM_PX_FROM_TOP = 100;
/** Smallest screen height this app targets (iPhone SE-class). */
export const HOME_STAGE_SMALLEST_SUPPORTED_SCREEN_HEIGHT_PX = 667;

const PET_STAGE_HEIGHT_PX = 218;
const PET_STAGE_BOTTOM_RATIO = 170 / 844; // authored against a common ~844pt reference screen
// Never sit lower than clear of the care tray (CARE_TRAY_TOP_PX_FROM_BOTTOM) with a small safety margin.
const PET_STAGE_MIN_BOTTOM_PX = CARE_TRAY_TOP_PX_FROM_BOTTOM + 16;
const PET_STAGE_MAX_BOTTOM_PX = 210;

const BUBBLE_GAP_ABOVE_PET_PX = 18;
const BUBBLE_MIN_BOTTOM_PX = 214; // keeps clear of the walk panel / first-care guide band

/**
 * Thought bubble container width (homeThoughtBubble.width in
 * TerrariumHomeScreen styles). Widened from 282 to 310 alongside the
 * fontSize 11->14 bump (see BUBBLE_APPROX_CHAR_WIDTH_PX below): at the old
 * 282px width, a typical ~32-char line (the pool's median length) would now
 * wrap to 2 lines instead of fitting on 1, noticeably shrinking how much of
 * a thought reads at a glance. 310px keeps that median line on one line
 * while still comfortably fitting the smallest supported screen width
 * (iPhone SE-class, 375pt) with room either side.
 */
export const HOME_THOUGHT_BUBBLE_WIDTH_PX = 310;
/** Horizontal padding inside the bubble image (homeThoughtBubbleInner.paddingHorizontal, both sides). */
const BUBBLE_TEXT_HORIZONTAL_PADDING_PX = 32;

// --- Bubble art safe-zone geometry (measured from assets/generated/ui/speech-bubble-v1.png, 1748x899) ---
//
// The bubble is rendered with resizeMode:"stretch", so its rounded top/
// bottom walls occupy a *fraction* of the container height, not a fixed px
// amount — a short container has a proportionally short (but not smaller in
// px terms alone) curved band too. Sampling opacity rows across the source
// PNG found the fully-flat (non-curved) interior wall spans:
//   y = 245..585 of 899px tall  ->  27.3%..65.1% of image height
//   x = 128..1619 of 1748px wide -> 7.3%..92.6% of image width (curve-safe)
// A fixed `paddingTop: 18 / paddingBottom: 30` (the old values) does NOT
// scale with these fractions, so at the container heights a 2-3 line bubble
// actually needs, the text's top edge sits above the flat band and visibly
// crosses into (and beyond) the rounded corner — the bug this module now
// fixes. Padding is now derived as a fraction of the container height
// instead, with a small safety margin on top of the measured fractions.
const BUBBLE_SAFE_TOP_FRACTION = 0.2725; // where the flat wall begins, top
const BUBBLE_SAFE_BOTTOM_FRACTION = 0.6507; // where the flat wall ends, bottom
const BUBBLE_VERTICAL_SAFETY_MARGIN_FRACTION = 0.015; // extra cushion beyond the measured flat band, each side
const BUBBLE_TOP_PADDING_FRACTION = BUBBLE_SAFE_TOP_FRACTION + BUBBLE_VERTICAL_SAFETY_MARGIN_FRACTION;
const BUBBLE_BOTTOM_PADDING_FRACTION = 1 - BUBBLE_SAFE_BOTTOM_FRACTION + BUBBLE_VERTICAL_SAFETY_MARGIN_FRACTION;
/** Fraction of container height actually available for text between the top/bottom safe paddings. */
const BUBBLE_TEXT_AREA_FRACTION = 1 - BUBBLE_TOP_PADDING_FRACTION - BUBBLE_BOTTOM_PADDING_FRACTION;

/**
 * Average glyph advance width for Pixelify Sans Bold (PixelifySans_700Bold,
 * the font homeThoughtText renders with — fontFamilies.bubble -> "display").
 * Originally measured from the TTF's hmtx table at fontSize 11 against
 * representative pet-copy sentences (petStatusEngine.ts /
 * expandedReactionRules.ts lines): averages landed 5.16-5.51px/char, rounded
 * up to 5.7 for a small over-prediction margin. homeThoughtText was bumped
 * from fontSize 11/lineHeight 16 to 14/18 to match the chat bubble's
 * petThoughtText (ChatGateScreen) exactly, so both advance width and line
 * height scale linearly by the same 14/11 ratio: 5.7 * 14/11 = 7.2545,
 * rounded up to 7.3 (measured range scales to 6.57-7.01px/char) keeping the
 * same "over-predict slightly" margin as the original. This is only used to
 * size the bubble ahead of layout, never to render text.
 */
const BUBBLE_APPROX_CHAR_WIDTH_PX = 7.3;
const BUBBLE_LINE_HEIGHT_PX = 18;
export const HOME_THOUGHT_BUBBLE_MAX_LINES = 3;

/**
 * Estimates how many lines `text` will wrap to inside the bubble at its
 * current width, capped at HOME_THOUGHT_BUBBLE_MAX_LINES. Used only to size
 * the bubble container ahead of layout (RN has no sync text-measurement);
 * the Text itself still uses numberOfLines as the real wrap/clamp.
 */
export function estimateHomeThoughtBubbleLineCount(text: string): number {
  const contentWidthPx = HOME_THOUGHT_BUBBLE_WIDTH_PX - BUBBLE_TEXT_HORIZONTAL_PADDING_PX * 2;
  const charsPerLine = Math.max(1, Math.floor(contentWidthPx / BUBBLE_APPROX_CHAR_WIDTH_PX));
  const estimatedLines = Math.max(1, Math.ceil(text.length / charsPerLine));

  return Math.min(HOME_THOUGHT_BUBBLE_MAX_LINES, estimatedLines);
}

/**
 * Rendered bubble container height for a given line count, sized so the
 * text block (lineCount * line height) fits entirely inside the art's
 * flat-wall safe zone (see the geometry note above) — not just "tall enough
 * for the text", which is what let text bleed past the curved top/bottom
 * walls before.
 */
export function getHomeThoughtBubbleHeightPx(lineCount: number): number {
  const textAreaHeightPx = lineCount * BUBBLE_LINE_HEIGHT_PX;

  return textAreaHeightPx / BUBBLE_TEXT_AREA_FRACTION;
}

/** Top/bottom padding (px) for the bubble's inner content at a given container height, derived from the same safe-zone fractions as getHomeThoughtBubbleHeightPx. */
export function getHomeThoughtBubbleVerticalPaddingPx(containerHeightPx: number): { top: number; bottom: number } {
  return {
    top: containerHeightPx * BUBBLE_TOP_PADDING_FRACTION,
    bottom: containerHeightPx * BUBBLE_BOTTOM_PADDING_FRACTION
  };
}

/**
 * Bottom offset (px, from screen bottom) for the pet stage container.
 * Scales with window height but is clamped so it never sinks into the care
 * tray on a short screen or floats unreasonably high on a tall one.
 */
export function getHomePetStageBottomPx(windowHeight: number): number {
  const scaled = windowHeight * PET_STAGE_BOTTOM_RATIO;

  return Math.min(PET_STAGE_MAX_BOTTOM_PX, Math.max(PET_STAGE_MIN_BOTTOM_PX, scaled));
}

/**
 * Bottom offset (px, from screen bottom) for the thought bubble container.
 * Anchored just above the pet stage's top edge instead of an independent
 * fixed pixel value, so the two can never drift apart or overlap as screen
 * height changes. `bubbleHeightPx` is the bubble's current rendered height
 * (varies with line count) so a taller (3-line) bubble is pushed up instead
 * of overlapping the pet.
 */
export function getHomeThoughtBubbleBottomPx(windowHeight: number, bubbleHeightPx: number): number {
  const petStageTopPx = getHomePetStageBottomPx(windowHeight) + PET_STAGE_HEIGHT_PX;
  const anchored = petStageTopPx + BUBBLE_GAP_ABOVE_PET_PX;
  const bottom = Math.max(BUBBLE_MIN_BOTTOM_PX, anchored);
  const topPxFromTop = windowHeight - (bottom + bubbleHeightPx);

  // Never let the bubble's top edge crowd the HUD — if it would, hold it at
  // the lowest position that still clears the HUD.
  if (topPxFromTop < HUD_BOTTOM_PX_FROM_TOP) {
    return Math.max(BUBBLE_MIN_BOTTOM_PX, windowHeight - HUD_BOTTOM_PX_FROM_TOP - bubbleHeightPx);
  }

  return bottom;
}

/** Horizontal center offset (px marginLeft) to center a fixed-width element against the actual window width. */
export function getHomeStageHorizontalMarginLeftPx(windowWidth: number, elementWidthPx: number): number {
  return windowWidth / 2 - elementWidthPx / 2;
}

/**
 * True when the given bottom offset + element height still clears the
 * bottom care tray, given the actual window height. Used by tests to assert
 * the smallest supported screen never overlaps the tray.
 */
export function clearsCareTray(bottomPx: number): boolean {
  return bottomPx >= CARE_TRAY_TOP_PX_FROM_BOTTOM;
}

/**
 * Walk paw-trail Lottie (walkPawsLayer in TerrariumHomeScreen): shown
 * centered and enlarged while a walk is in progress, replacing the pet
 * sprite entirely for that window. User feedback on the 3-minute wait was
 * that the small, off-center trail (132px, left 18%/bottom 64) read as
 * "nothing is happening" -- this scales it up toward 2x and centers it in
 * the garden, but only as far as the screen actually has room for, so it
 * never crowds the side-rail icons (shop/chat/settings/friend) above it or
 * the walk status panel below it.
 */
const WALK_PAWS_BASE_SIZE_PX = 132;
/** Roughly 2x the original trail -- the target size on any screen tall enough to fit it. */
const WALK_PAWS_TARGET_SIZE_PX = WALK_PAWS_BASE_SIZE_PX * 2;
/** Side-rail icon stack's bottom edge (sceneSideRailLeft/Right: top 126 + 2 * 58 buttons + 16 gap), from the top of the screen. */
const WALK_PAWS_RAIL_CLEARANCE_PX_FROM_TOP = 258;
/** Walk status panel's top edge (walkPanel: bottom 118 + ~78px of title/subcopy/button content), from the bottom of the screen. */
const WALK_PAWS_PANEL_CLEARANCE_PX_FROM_BOTTOM = 200;
/** Minimum breathing room kept clear of both clearance lines above, on top of the lines themselves. */
const WALK_PAWS_SAFETY_MARGIN_PX = 16;

/**
 * The paw layer's square size for a given window height: as close to 2x the
 * original trail as the vertical gap between the side rails and the walk
 * panel allows, never smaller than the original size. Reaches the full 2x
 * target on ordinary/tall screens; only shrinks (gracefully, never
 * disappears) on the smallest supported screen where that gap is tight.
 */
export function getWalkPawsLayerSizePx(windowHeight: number): number {
  const availableBandPx = windowHeight - WALK_PAWS_RAIL_CLEARANCE_PX_FROM_TOP - WALK_PAWS_PANEL_CLEARANCE_PX_FROM_BOTTOM;

  return Math.max(WALK_PAWS_BASE_SIZE_PX, Math.min(WALK_PAWS_TARGET_SIZE_PX, availableBandPx - WALK_PAWS_SAFETY_MARGIN_PX));
}

/**
 * Bottom offset (px, from screen bottom) that centers a `sizePx`-tall paw
 * layer within the same safe vertical band `getWalkPawsLayerSizePx` sized
 * against, so the two always agree on where the layer sits.
 */
export function getWalkPawsLayerBottomPx(windowHeight: number, sizePx: number): number {
  const availableBandPx = windowHeight - WALK_PAWS_RAIL_CLEARANCE_PX_FROM_TOP - WALK_PAWS_PANEL_CLEARANCE_PX_FROM_BOTTOM;

  return WALK_PAWS_PANEL_CLEARANCE_PX_FROM_BOTTOM + Math.max(0, (availableBandPx - sizePx) / 2);
}
