import { describe, expect, it } from "vitest";

import { getShareCardCaptureHostStyle } from "./shareCardCaptureHost";

describe("getShareCardCaptureHostStyle", () => {
  it("sizes the capture host at the literal export geometry", () => {
    const style = getShareCardCaptureHostStyle({ width: 1080, height: 1350 });

    expect(style.width).toBe(1080);
    expect(style.height).toBe(1350);
  });

  it("never inherits a smaller on-screen display size -- a mismatch is exactly the bug this guards against", () => {
    // A caller-supplied preview size (e.g. ShareCardCustomizeSheet's 232x290
    // or the reveal screen's 360x450 default) must never leak into the
    // capture host's geometry -- doing so is what produced a large,
    // mostly-blank exported PNG with the card crammed into its top-left
    // corner, sized like the small preview instead of the full export.
    const previewSize = { width: 232, height: 290 };
    const style = getShareCardCaptureHostStyle({ width: 1080, height: 1350 });

    expect(style.width).not.toBe(previewSize.width);
    expect(style.height).not.toBe(previewSize.height);
  });

  it("takes the host out of layout flow and makes it fully invisible", () => {
    const style = getShareCardCaptureHostStyle({ width: 1080, height: 1350 });

    expect(style.position).toBe("absolute");
    expect(style.top).toBe(0);
    expect(style.left).toBe(0);
    expect(style.opacity).toBe(0);
  });
});
