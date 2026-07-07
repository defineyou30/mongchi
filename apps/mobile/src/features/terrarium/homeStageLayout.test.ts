import { describe, expect, it } from "vitest";

import {
  HOME_STAGE_SMALLEST_SUPPORTED_SCREEN_HEIGHT_PX,
  HOME_THOUGHT_BUBBLE_MAX_LINES,
  clearsCareTray,
  estimateHomeThoughtBubbleLineCount,
  getHomePetStageBottomPx,
  getHomeStageHorizontalMarginLeftPx,
  getHomeThoughtBubbleBottomPx,
  getHomeThoughtBubbleHeightPx,
  getHomeThoughtBubbleVerticalPaddingPx
} from "./homeStageLayout";

const HUD_BOTTOM_PX_FROM_TOP = 100;

// Bubble art safe-zone fractions, independently re-derived here (not
// imported) from the same pixel sampling of
// assets/generated/ui/speech-bubble-v1.png (1748x899) described in
// homeStageLayout.ts, so these tests catch a regression in either the
// production constants or the geometry assumption itself.
const MEASURED_SAFE_TOP_FRACTION = 245 / 899; // ~0.2725
const MEASURED_SAFE_BOTTOM_FRACTION = 585 / 899; // ~0.6507

// Real lines pulled from petStatusEngine.ts / expandedReactionRules.ts (the
// actual pools starterReactionRules/selectPetStatusLine draw from) —
// including the exact line from the reported overflow screenshot and the
// longest lines found in each pool.
const reportedOverflowLine = "My tail has been quiet today. Play might wake it.";
const longestPetStatusEngineLine = "I am running on one crumb of energy. Food would help a lot.";
const longestReactionRuleLine = "I was curled up small. Now that you are here, I feel better already.";

describe("getHomeStageHorizontalMarginLeftPx", () => {
  it("centers a fixed-width element against the actual window width, regardless of screen size", () => {
    expect(getHomeStageHorizontalMarginLeftPx(390, 282)).toBeCloseTo(54, 5);
    expect(getHomeStageHorizontalMarginLeftPx(667, 282)).toBeCloseTo((667 - 282) / 2, 5);
  });
});

describe("getHomePetStageBottomPx", () => {
  it("stays within its clamped band on the smallest supported screen", () => {
    const bottom = getHomePetStageBottomPx(HOME_STAGE_SMALLEST_SUPPORTED_SCREEN_HEIGHT_PX);

    expect(bottom).toBeGreaterThanOrEqual(118);
    expect(bottom).toBeLessThanOrEqual(210);
  });

  it("clears the bottom care tray on the smallest supported screen", () => {
    const bottom = getHomePetStageBottomPx(HOME_STAGE_SMALLEST_SUPPORTED_SCREEN_HEIGHT_PX);

    expect(clearsCareTray(bottom)).toBe(true);
  });

  it("scales up (but stays clamped) on a taller screen", () => {
    const short = getHomePetStageBottomPx(667);
    const tall = getHomePetStageBottomPx(926);

    expect(tall).toBeGreaterThanOrEqual(short);
  });
});

describe("getHomeThoughtBubbleBottomPx", () => {
  const twoLineBubbleHeightPx = getHomeThoughtBubbleHeightPx(2);
  const threeLineBubbleHeightPx = getHomeThoughtBubbleHeightPx(HOME_THOUGHT_BUBBLE_MAX_LINES);

  it("keeps the bubble above the HUD on the smallest supported screen for a 2-line bubble", () => {
    const bottom = getHomeThoughtBubbleBottomPx(HOME_STAGE_SMALLEST_SUPPORTED_SCREEN_HEIGHT_PX, twoLineBubbleHeightPx);
    const topFromTop = HOME_STAGE_SMALLEST_SUPPORTED_SCREEN_HEIGHT_PX - (bottom + twoLineBubbleHeightPx);

    expect(topFromTop).toBeGreaterThanOrEqual(HUD_BOTTOM_PX_FROM_TOP);
  });

  it("keeps the bubble above the HUD on the smallest supported screen for a 3-line (taller) bubble", () => {
    const bottom = getHomeThoughtBubbleBottomPx(HOME_STAGE_SMALLEST_SUPPORTED_SCREEN_HEIGHT_PX, threeLineBubbleHeightPx);
    const topFromTop = HOME_STAGE_SMALLEST_SUPPORTED_SCREEN_HEIGHT_PX - (bottom + threeLineBubbleHeightPx);

    expect(topFromTop).toBeGreaterThanOrEqual(HUD_BOTTOM_PX_FROM_TOP);
  });

  it("never overlaps the pet stage on the smallest supported screen", () => {
    const petStageTopPx = getHomePetStageBottomPx(HOME_STAGE_SMALLEST_SUPPORTED_SCREEN_HEIGHT_PX) + 218;
    const bubbleBottom = getHomeThoughtBubbleBottomPx(HOME_STAGE_SMALLEST_SUPPORTED_SCREEN_HEIGHT_PX, twoLineBubbleHeightPx);

    expect(bubbleBottom).toBeGreaterThanOrEqual(petStageTopPx);
  });

  it("stays fully within the screen bounds (bubble top does not go negative)", () => {
    const bottom = getHomeThoughtBubbleBottomPx(HOME_STAGE_SMALLEST_SUPPORTED_SCREEN_HEIGHT_PX, threeLineBubbleHeightPx);

    expect(bottom + threeLineBubbleHeightPx).toBeLessThanOrEqual(HOME_STAGE_SMALLEST_SUPPORTED_SCREEN_HEIGHT_PX);
  });
});

describe("estimateHomeThoughtBubbleLineCount", () => {
  it("estimates 2 lines for the exact line from the reported bubble-overflow screenshot", () => {
    // "My tail has been quiet today. Play might wake it." (51 chars) is the
    // real petStatusEngine.ts line that was screenshotted overflowing the
    // bubble art. It should estimate as a short (1-2 line) bubble, not the
    // 3-line max — confirms the char-width constant isn't wildly off in
    // either direction for a typical line.
    const lines = estimateHomeThoughtBubbleLineCount(reportedOverflowLine);

    expect(lines).toBeGreaterThanOrEqual(1);
    expect(lines).toBeLessThanOrEqual(2);
  });

  it("never exceeds HOME_THOUGHT_BUBBLE_MAX_LINES even for the longest known pool lines", () => {
    expect(estimateHomeThoughtBubbleLineCount(longestPetStatusEngineLine)).toBeLessThanOrEqual(HOME_THOUGHT_BUBBLE_MAX_LINES);
    expect(estimateHomeThoughtBubbleLineCount(longestReactionRuleLine)).toBeLessThanOrEqual(HOME_THOUGHT_BUBBLE_MAX_LINES);
  });

  it("estimates more lines for longer text", () => {
    const short = estimateHomeThoughtBubbleLineCount("Hi.");
    const long = estimateHomeThoughtBubbleLineCount(longestReactionRuleLine);

    expect(long).toBeGreaterThanOrEqual(short);
  });
});

describe("getHomeThoughtBubbleHeightPx / getHomeThoughtBubbleVerticalPaddingPx (asset safe-zone fit)", () => {
  // Re-derive the "flat wall" pixel band for a candidate container height
  // using the independently-measured fractions above, and assert the text
  // block (padding + line count) actually lands inside it — this is the
  // direct regression test for the reported overflow: the old fixed
  // paddingTop:18/paddingBottom:30 crossed into the rounded corner because
  // it didn't scale with container height the way the art's curve does.
  const assertTextFitsSafeZone = (lineCount: number) => {
    const bubbleHeightPx = getHomeThoughtBubbleHeightPx(lineCount);
    const { top, bottom } = getHomeThoughtBubbleVerticalPaddingPx(bubbleHeightPx);

    const measuredSafeTopPx = bubbleHeightPx * MEASURED_SAFE_TOP_FRACTION;
    const measuredSafeBottomPx = bubbleHeightPx * MEASURED_SAFE_BOTTOM_FRACTION;
    const textTopPx = top;
    const textBottomPx = bubbleHeightPx - bottom;

    // Text's top edge must be at or below (i.e. further into the bubble
    // than) where the art's flat wall begins.
    expect(textTopPx).toBeGreaterThanOrEqual(measuredSafeTopPx);
    // Text's bottom edge must be at or above where the flat wall ends.
    expect(textBottomPx).toBeLessThanOrEqual(measuredSafeBottomPx);
    // And the padded text area must still be tall enough for the line count
    // it was sized for (no regression back into truncating). 18 is
    // BUBBLE_LINE_HEIGHT_PX (matches homeThoughtText's lineHeight).
    expect(textBottomPx - textTopPx).toBeGreaterThanOrEqual(lineCount * 18 - 0.5);
  };

  it("keeps 1-line text inside the art's flat-wall safe zone", () => {
    assertTextFitsSafeZone(1);
  });

  it("keeps 2-line text inside the art's flat-wall safe zone (the reported overflow case)", () => {
    assertTextFitsSafeZone(2);
  });

  it("keeps 3-line (max) text inside the art's flat-wall safe zone", () => {
    assertTextFitsSafeZone(HOME_THOUGHT_BUBBLE_MAX_LINES);
  });

  it("grows bubble height as line count grows", () => {
    const oneLine = getHomeThoughtBubbleHeightPx(1);
    const twoLines = getHomeThoughtBubbleHeightPx(2);
    const threeLines = getHomeThoughtBubbleHeightPx(HOME_THOUGHT_BUBBLE_MAX_LINES);

    expect(twoLines).toBeGreaterThan(oneLine);
    expect(threeLines).toBeGreaterThan(twoLines);
  });
});
