import { assert, assertEquals, assertMatch, assertThrows } from "jsr:@std/assert@1";
import { decode, encode } from "npm:fast-png@7";

import { removeChromaKeyBackground } from "./chromakey.ts";
import {
  applyChromaKeyToRgbaPanel,
  buildPoseSheetLayoutPrompt,
  clampSlotCutsToMinWidth,
  decodePosePanelToRgba,
  encodePosePanelToPng,
  generateValidatedPosePanels,
  normalizePosePanelForSafeArea,
  normalizePosePanelsForSafeArea,
  normalizePosePanelsForSafeAreaRgba,
  POSE_PANEL_MAX_UPSCALE,
  type PoseSheetPanel,
  type PoseSheetRgbaPanel,
  removeSmallEdgeFragmentsRgba,
  splitPoseSheet,
  splitPoseSheetToRgbaPanels,
  validatePoseSheetPanels,
  validatePoseSheetPanelsRgba,
  validatePoseSheetSourceEdges,
  validatePoseSheetSourceEdgesRgba,
} from "./spriteSheet.ts";

const WIDTH = 1536;
const HEIGHT = 1024;
// None of these three colors is green-dominant (see isForegroundPixel in
// spriteSheet.ts) -- makeThreePanelPng fills every column full-height with
// one of them, so the whole canvas reads as uniform foreground and the
// content-aware slot cuts in splitPoseSheetToRgbaPanels have no valley to
// find, falling back to the nominal 512/1024 boundaries these tests assert
// on. (The original middle color, (80,180,110), was accidentally
// green-dominant and shifted the second cut off nominal by one pixel.)
const PANEL_COLORS = [
  [220, 80, 90, 255],
  [90, 140, 200, 255],
  [80, 120, 220, 255],
] as const;

const makeThreePanelPng = (): Uint8Array => {
  const data = new Uint8Array(WIDTH * HEIGHT * 4);

  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const panelIndex = Math.min(2, Math.floor(x / 512));
      const color = PANEL_COLORS[panelIndex];
      const offset = (y * WIDTH + x) * 4;
      data.set(color, offset);
    }
  }

  return new Uint8Array(
    encode({ width: WIDTH, height: HEIGHT, data, channels: 4, depth: 8 }),
  );
};

const makePosePanel = (
  state: string,
  color: readonly [number, number, number, number],
  horizontalOffset = 0,
  verticalStart = 130,
): PoseSheetPanel => {
  const size = 512;
  const data = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      data.set([0, 255, 0, 255], offset);
    }
  }

  for (let y = verticalStart; y < 400; y += 1) {
    for (let x = 140 + horizontalOffset; x < 370 + horizontalOffset; x += 1) {
      const offset = (y * size + x) * 4;
      data.set(color, offset);
    }
  }

  return {
    state,
    bytes: new Uint8Array(
      encode({ width: size, height: size, data, channels: 4, depth: 8 }),
    ),
    width: size,
    height: size,
  };
};

// Builds a panel whose entire foreground is exactly the given rectangle
// (on an otherwise pure chroma-key green canvas), so the resulting bbox
// dimensions are known precisely -- useful for asserting exact scale math
// rather than the fuzzier ear/tail silhouettes from makePosePanel.
const makeForegroundPanel = (
  state: string,
  color: readonly [number, number, number, number],
  rect: { x0: number; x1: number; y0: number; y1: number },
  size = 512,
): PoseSheetPanel => {
  const data = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      data.set([0, 255, 0, 255], (y * size + x) * 4);
    }
  }

  for (let y = rect.y0; y < rect.y1; y += 1) {
    for (let x = rect.x0; x < rect.x1; x += 1) {
      data.set(color, (y * size + x) * 4);
    }
  }

  return {
    state,
    bytes: new Uint8Array(
      encode({ width: size, height: size, data, channels: 4, depth: 8 }),
    ),
    width: size,
    height: size,
  };
};

const emptyGreenPanel = (state: string, size = 512): PoseSheetPanel => {
  const data = new Uint8Array(size * size * 4);

  for (let offset = 0; offset < data.length; offset += 4) {
    data.set([0, 255, 0, 255], offset);
  }

  return {
    state,
    bytes: new Uint8Array(
      encode({ width: size, height: size, data, channels: 4, depth: 8 }),
    ),
    width: size,
    height: size,
  };
};

// Decodes a normalized panel and returns its foreground bounding box, for
// asserting exact post-scale dimensions/position.
const foregroundBoundsOf = (
  panel: PoseSheetPanel,
): { minX: number; minY: number; maxX: number; maxY: number } | null => {
  const decoded = decode(panel.bytes);
  let minX = panel.width;
  let minY = panel.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < panel.height; y += 1) {
    for (let x = 0; x < panel.width; x += 1) {
      const offset = (y * panel.width + x) * 4;
      const red = decoded.data[offset] ?? 0;
      const green = decoded.data[offset + 1] ?? 0;
      const blue = decoded.data[offset + 2] ?? 0;
      const alpha = decoded.data[offset + 3] ?? 0;
      const isForeground = alpha > 24 &&
        !(green > 110 && green > red + 28 && green > blue + 28);

      if (!isForeground) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  return maxX < minX || maxY < minY ? null : { minX, minY, maxX, maxY };
};

const addForegroundPatch = (
  panel: PoseSheetPanel,
  color: readonly [number, number, number, number],
  xStart: number,
  xEnd: number,
  yStart: number,
  yEnd: number,
): PoseSheetPanel => {
  const decoded = decode(panel.bytes);

  for (let y = yStart; y < yEnd; y += 1) {
    for (let x = xStart; x < xEnd; x += 1) {
      decoded.data.set(color, (y * panel.width + x) * 4);
    }
  }

  return {
    ...panel,
    bytes: new Uint8Array(encode(decoded)),
  };
};

Deno.test("splitPoseSheet preserves one full-height column per ordered state", () => {
  const states = ["idle", "happy", "sleep"] as const;
  const panels = splitPoseSheet(makeThreePanelPng(), states);

  assertEquals(panels.map((panel) => panel.state), [...states]);
  assertEquals(panels.map((panel) => [panel.width, panel.height]), [
    [512, 1024],
    [512, 1024],
    [512, 1024],
  ]);

  panels.forEach((panel, index) => {
    const decoded = decode(panel.bytes);
    assertEquals(Array.from(decoded.data.slice(0, 4)), [
      ...PANEL_COLORS[index],
    ]);
  });
});

Deno.test("buildPoseSheetLayoutPrompt fixes slot order and bundle semantics", () => {
  const prompt = buildPoseSheetLayoutPrompt([
    { state: "curious", pose: "ears perked, curious face" },
    { state: "play", pose: "play bow" },
    { state: "hungry", pose: "hopeful hungry look" },
  ]);

  assertMatch(prompt, /LEFT SLOT: curious/);
  assertMatch(prompt, /CENTER SLOT: play/);
  assertMatch(prompt, /RIGHT SLOT: hungry/);
  assertMatch(prompt, /one coherent horizontal three-slot sprite sheet/i);
  assertMatch(prompt, /no dividers/i);
  assertMatch(prompt, /top quarter of the entire canvas must remain completely empty flat green/i);
  assertMatch(prompt, /tallest point, ears included, stays clearly below that line/i);
  assertMatch(prompt, /bottom tenth of the entire canvas must stay completely empty flat green/i);
  assertMatch(prompt, /paws or lowest contact point stays clearly above that line/i);
  assertMatch(prompt, /pure green padding of at least one tenth of the slot width/i);
  assertMatch(prompt, /no body part may reach or cross the left or right slot boundary/i);
  assertMatch(prompt, /clear vertical corridor of completely empty flat green/i);
  assertMatch(prompt, /at least one tenth of the canvas width wide, between neighboring pets/i);
  assertMatch(prompt, /pets must never touch, overlap, or reach toward each other/i);
  assertMatch(prompt, /roughly 55-65% of the slot's height/i);
  assertMatch(prompt, /shared horizontal baseline set just above the bottom tenth margin/i);
  assertMatch(prompt, /ears, fur, tail, and paws/i);
  assertMatch(prompt, /pure #00ff00/i);
  assertMatch(prompt, /cast shadow/i);
  assertMatch(prompt, /reconstruct the missing outline/i);
});

Deno.test("validatePoseSheetSourceEdges rejects a visibly clipped pet before normalization", () => {
  const clipped = makePosePanel("idle", [220, 80, 90, 255], 0, 0);
  const validation = validatePoseSheetSourceEdges([
    clipped,
    makePosePanel("happy", [80, 120, 220, 255], 0),
    makePosePanel("sleep", [180, 90, 210, 255], 16),
  ]);

  assertEquals(validation.valid, false);
  assertEquals(validation.failures, ["idle:source_edge_clipping:top"]);
});

Deno.test("validatePoseSheetSourceEdges ignores scattered chroma-key edge noise", () => {
  let noisy = makePosePanel("idle", [220, 80, 90, 255]);

  for (let x = 0; x < noisy.width; x += 8) {
    noisy = addForegroundPatch(
      noisy,
      [220, 80, 90, 255],
      x,
      Math.min(noisy.width, x + 1),
      0,
      1,
    );
  }

  const validation = validatePoseSheetSourceEdges([
    noisy,
    makePosePanel("happy", [80, 120, 220, 255]),
    makePosePanel("sleep", [180, 90, 210, 255], 16),
  ]);

  assertEquals(validation, { valid: true, failures: [] });
});

Deno.test("validatePoseSheetPanels rejects a pet that enters the 24px crop safety zone", () => {
  const validation = validatePoseSheetPanels([
    makePosePanel("idle", [220, 80, 90, 255], -16, 12),
    makePosePanel("happy", [80, 120, 220, 255], 0),
    makePosePanel("sleep", [180, 90, 210, 255], 16),
  ]);

  assertEquals(validation.valid, false);
  assertEquals(validation.failures.includes("idle:slot_containment"), true);
});

Deno.test("validatePoseSheetPanels ignores tiny chroma-key noise inside the crop safety zone", () => {
  const idle = makePosePanel("idle", [220, 80, 90, 255], -16);
  const validation = validatePoseSheetPanels([
    addForegroundPatch(idle, [220, 80, 90, 255], 22, 24, 220, 228),
    makePosePanel("happy", [80, 120, 220, 255], 0),
    makePosePanel("sleep", [180, 90, 210, 255], 16),
  ]);

  assertEquals(validation.valid, true);
  assertEquals(validation.failures.includes("idle:slot_containment"), false);
});

Deno.test("validatePoseSheetPanels rejects meaningful foreground entering the crop safety zone", () => {
  const idle = makePosePanel("idle", [220, 80, 90, 255], -16);
  const validation = validatePoseSheetPanels([
    addForegroundPatch(idle, [220, 80, 90, 255], 0, 24, 160, 390),
    makePosePanel("happy", [80, 120, 220, 255], 0),
    makePosePanel("sleep", [180, 90, 210, 255], 16),
  ]);

  assertEquals(validation.valid, false);
  assertEquals(validation.failures.includes("idle:slot_containment"), true);
});

Deno.test("normalizePosePanelForSafeArea insets and bottom-aligns edge-touching art", () => {
  const edgeTouching = makePosePanel("idle", [220, 80, 90, 255], -140, 8);
  const normalized = normalizePosePanelForSafeArea(edgeTouching);
  const validation = validatePoseSheetPanels([
    normalized,
    makePosePanel("happy", [80, 120, 220, 255], 0),
    makePosePanel("sleep", [180, 90, 210, 255], 16),
  ]);
  const decoded = decode(normalized.bytes);
  let bottomForegroundY = -1;

  for (let y = 0; y < normalized.height; y += 1) {
    for (let x = 0; x < normalized.width; x += 1) {
      const offset = (y * normalized.width + x) * 4;
      if ((decoded.data[offset + 3] ?? 0) > 24) {
        bottomForegroundY = y;
      }
    }
  }

  assertEquals(validation.failures.includes("idle:slot_containment"), false);
  assertEquals(bottomForegroundY, 487);
});

Deno.test("normalizePosePanelForSafeArea upscales a panel that was already inside the safe zone but under-filled", () => {
  // makePosePanel's default rectangle (230x270) already sits inside the
  // 24px safe inset, so the old "already safe -> return unchanged" early
  // return used to bail out here. That early return is gone: a panel this
  // much smaller than the 464x464 available area should now grow toward
  // filling it (bounded by POSE_PANEL_MAX_UPSCALE), not stay artificially
  // tiny just because it was technically contained.
  const safe = makePosePanel("idle", [220, 80, 90, 255]);
  const originalBounds = foregroundBoundsOf(safe)!;
  const normalized = normalizePosePanelForSafeArea(safe);
  const normalizedBounds = foregroundBoundsOf(normalized)!;
  const validation = validatePoseSheetPanels([
    normalized,
    makePosePanel("happy", [80, 120, 220, 255], 0),
    makePosePanel("sleep", [180, 90, 210, 255], 16),
  ]);

  const originalHeight = originalBounds.maxY - originalBounds.minY + 1;
  const normalizedHeight = normalizedBounds.maxY - normalizedBounds.minY + 1;

  assertEquals(validation.failures.includes("idle:slot_containment"), false);
  // Bottom contact point stays anchored to the shared baseline regardless
  // of scale (canvasHeight(512) - safeInset(24) - 1).
  assertEquals(normalizedBounds.maxY, 487);
  // Height-constrained (270 tall vs. 230 wide against a 464x464 area), so
  // it should have grown well past its original size while staying under
  // the 2x upscale cap.
  assertEquals(normalizedHeight > originalHeight, true);
  assertEquals(normalizedHeight <= Math.floor(originalHeight * POSE_PANEL_MAX_UPSCALE), true);
});

Deno.test("normalizePosePanelForSafeArea fits a tall source column into a square asset", () => {
  const data = new Uint8Array(512 * 1024 * 4);

  for (let offset = 0; offset < data.length; offset += 4) {
    data.set([0, 255, 0, 255], offset);
  }

  for (let y = 80; y < 940; y += 1) {
    for (let x = 140; x < 370; x += 1) {
      data.set([220, 80, 90, 255], (y * 512 + x) * 4);
    }
  }

  const normalized = normalizePosePanelForSafeArea({
    state: "idle",
    bytes: new Uint8Array(encode({
      width: 512,
      height: 1024,
      data,
      channels: 4,
      depth: 8,
    })),
    width: 512,
    height: 1024,
  });

  assertEquals([normalized.width, normalized.height], [512, 512]);
  assertEquals(
    validatePoseSheetPanels([
      normalized,
      makePosePanel("happy", [80, 120, 220, 255]),
      makePosePanel("sleep", [180, 90, 210, 255], 16),
    ]).failures.includes("idle:slot_containment"),
    false,
  );
});

Deno.test("normalizePosePanelsForSafeArea upscales a tiny panel up to the 2x cap, not further", () => {
  // A 40x40 foreground against a 464x464 available area could in principle
  // scale up ~11.6x to fill it; POSE_PANEL_MAX_UPSCALE caps that at 2x so a
  // panel the model drew unusually tiny doesn't get blown up into mush.
  const tiny = makeForegroundPanel(
    "idle",
    [220, 80, 90, 255],
    { x0: 236, x1: 276, y0: 200, y1: 240 },
  );

  const [normalized] = normalizePosePanelsForSafeArea([tiny]);
  const bounds = foregroundBoundsOf(normalized!)!;

  assertEquals(bounds.maxX - bounds.minX + 1, 80);
  assertEquals(bounds.maxY - bounds.minY + 1, 80);
  // Bottom-anchored to the shared baseline.
  assertEquals(bounds.maxY, 487);
});

Deno.test("normalizePosePanelsForSafeArea shares one scale across a bundle instead of scaling panels independently", () => {
  // "big" already exactly fills the 464x464 available area (its own max
  // scale is 1.0). "small" is tiny (its own max scale would be ~11.6x, or
  // 2x once capped) but must not grow past what "big" allows, otherwise a
  // compact pose like a curled-up sleep sprite could end up visually
  // larger than a standing pose from the same bundle.
  const big = makeForegroundPanel(
    "idle",
    [220, 80, 90, 255],
    { x0: 24, x1: 488, y0: 24, y1: 488 },
  );
  const small = makeForegroundPanel(
    "sleep",
    [180, 90, 210, 255],
    { x0: 236, x1: 276, y0: 444, y1: 484 },
  );

  const [normalizedBig, normalizedSmall] = normalizePosePanelsForSafeArea([
    big,
    small,
  ]);
  const bigBounds = foregroundBoundsOf(normalizedBig!)!;
  const smallBounds = foregroundBoundsOf(normalizedSmall!)!;

  assertEquals(bigBounds.maxX - bigBounds.minX + 1, 464);
  assertEquals(bigBounds.maxY - bigBounds.minY + 1, 464);
  // Shared scale is pinned to 1.0 by "big", so "small" keeps its original
  // 40x40 size instead of growing toward the 2x cap it could reach alone.
  assertEquals(smallBounds.maxX - smallBounds.minX + 1, 40);
  assertEquals(smallBounds.maxY - smallBounds.minY + 1, 40);
});

Deno.test("normalizePosePanelsForSafeArea returns a foreground-less panel untouched and excludes it from the shared scale", () => {
  const empty = emptyGreenPanel("idle");
  const tiny = makeForegroundPanel(
    "happy",
    [80, 120, 220, 255],
    { x0: 236, x1: 276, y0: 200, y1: 240 },
  );

  const [normalizedEmpty, normalizedTiny] = normalizePosePanelsForSafeArea([
    empty,
    tiny,
  ]);

  assertEquals(normalizedEmpty!.bytes, empty.bytes);

  // The empty panel must not have been folded into the shared-scale
  // computation -- "tiny" should still reach the same 2x cap it would hit
  // normalizing alone.
  const tinyBounds = foregroundBoundsOf(normalizedTiny!)!;
  assertEquals(tinyBounds.maxX - tinyBounds.minX + 1, 80);
  assertEquals(tinyBounds.maxY - tinyBounds.minY + 1, 80);
});

Deno.test("generateValidatedPosePanels retries one rejected sheet and returns the next valid one", async () => {
  let attempts = 0;

  const panels = await generateValidatedPosePanels(async () => {
    attempts += 1;
    const idle = makePosePanel("idle", [220, 80, 90, 255], -16);

    return [
      attempts === 1
        ? addForegroundPatch(idle, [220, 80, 90, 255], 0, 24, 160, 390)
        : idle,
      makePosePanel("happy", [80, 120, 220, 255], 0),
      makePosePanel("sleep", [180, 90, 210, 255], 16),
    ];
  }, 2);

  assertEquals(attempts, 2);
  assertEquals(panels.map((panel) => panel.state), ["idle", "happy", "sleep"]);
});

Deno.test("splitPoseSheet rejects output that does not match the requested sheet size", () => {
  const data = new Uint8Array(768 * 512 * 4);
  const invalidSheet = new Uint8Array(
    encode({ width: 768, height: 512, data, channels: 4, depth: 8 }),
  );

  assertThrows(
    () => splitPoseSheet(invalidSheet, ["idle", "happy", "sleep"]),
    Error,
    "unsupported PNG layout",
  );
});

Deno.test("pose sheet helpers reject bundles that do not contain exactly three states", () => {
  assertThrows(
    () => buildPoseSheetLayoutPrompt([{ state: "idle", pose: "neutral" }]),
    Error,
    "requires exactly 3 slots",
  );
  assertThrows(
    () => splitPoseSheet(makeThreePanelPng(), ["idle"]),
    Error,
    "requires exactly 3 states",
  );
});

Deno.test("validatePoseSheetPanels accepts occupied contained and distinct poses", () => {
  const validation = validatePoseSheetPanels([
    makePosePanel("idle", [220, 80, 90, 255], -16),
    makePosePanel("happy", [80, 120, 220, 255], 0),
    makePosePanel("sleep", [180, 90, 210, 255], 16),
  ]);

  assertEquals(validation, { valid: true, failures: [] });
});

Deno.test("validatePoseSheetPanels rejects empty and repeated pose slots", () => {
  const repeated = makePosePanel("idle", [220, 80, 90, 255]);
  const emptyData = new Uint8Array(512 * 512 * 4);

  for (let offset = 0; offset < emptyData.length; offset += 4) {
    emptyData.set([0, 255, 0, 255], offset);
  }

  const validation = validatePoseSheetPanels([
    repeated,
    { ...repeated, state: "happy" },
    {
      state: "sleep",
      bytes: new Uint8Array(
        encode({
          width: 512,
          height: 512,
          data: emptyData,
          channels: 4,
          depth: 8,
        }),
      ),
      width: 512,
      height: 512,
    },
  ]);

  assertEquals(validation.valid, false);
  assertEquals(
    validation.failures.includes("sleep:foreground_occupancy"),
    true,
  );
  assertEquals(
    validation.failures.includes("idle:happy:pose_distinctness"),
    true,
  );
});

// ---------------------------------------------------------------------------
// RGBA-first pipeline (decode sheet once, chroma-key once per panel, encode
// once at the end) -- see generate-avatar's CLAUDE.md fix notes for the CPU
// budget problem this replaces. The tests below cover the new Rgba-suffixed
// exports directly and confirm the PNG-bytes wrappers above still delegate
// to them with identical outcomes.
// ---------------------------------------------------------------------------

// Builds a full 1536x1024 sheet (all three 512-wide slots) on a pure green
// background with one solid-color pet block per slot, analogous to
// makePosePanel but assembled as a whole sheet -- used to exercise
// splitPoseSheetToRgbaPanels + applyChromaKeyToRgbaPanel together, which
// makeThreePanelPng (solid flat panels, no green field) cannot.
const makeGreenPetSheet = (
  colors: readonly [
    readonly [number, number, number, number],
    readonly [number, number, number, number],
    readonly [number, number, number, number],
  ],
): Uint8Array => {
  const data = new Uint8Array(WIDTH * HEIGHT * 4);

  for (let offset = 0; offset < data.length; offset += 4) {
    data.set([0, 255, 0, 255], offset);
  }

  colors.forEach((color, panelIndex) => {
    const xOffset = panelIndex * 512;

    for (let y = 130; y < 400; y += 1) {
      for (let x = xOffset + 140; x < xOffset + 370; x += 1) {
        data.set(color, (y * WIDTH + x) * 4);
      }
    }
  });

  return new Uint8Array(
    encode({ width: WIDTH, height: HEIGHT, data, channels: 4, depth: 8 }),
  );
};

Deno.test("splitPoseSheetToRgbaPanels backs splitPoseSheet with identical pixel data, no extra encode", () => {
  const states = ["idle", "happy", "sleep"] as const;
  const sheet = makeThreePanelPng();

  const rgbaPanels = splitPoseSheetToRgbaPanels(sheet, states);
  const pngPanels = splitPoseSheet(sheet, states);

  assertEquals(rgbaPanels.map((panel) => panel.state), [...states]);
  assertEquals(rgbaPanels.map((panel) => [panel.width, panel.height]), [
    [512, 1024],
    [512, 1024],
    [512, 1024],
  ]);

  pngPanels.forEach((panel, index) => {
    const decoded = decode(panel.bytes);
    const rgbaPanel = rgbaPanels[index]!;

    assertEquals(
      Array.from(decoded.data.slice(0, 4)),
      Array.from(rgbaPanel.rgba.slice(0, 4)),
    );
    assertEquals(
      Array.from(decoded.data.slice(decoded.data.length - 4)),
      Array.from(rgbaPanel.rgba.slice(rgbaPanel.rgba.length - 4)),
    );
  });
});

Deno.test("decodePosePanelToRgba expands 3-channel (no-alpha) PNGs to opaque RGBA", () => {
  const width = 4;
  const height = 4;
  const rgb = new Uint8Array(width * height * 3);

  for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
    rgb.set([10, 20, 30], pixelIndex * 3);
  }

  const bytes = new Uint8Array(
    encode({ width, height, data: rgb, channels: 3, depth: 8 }),
  );

  const panel = decodePosePanelToRgba("idle", bytes);

  assertEquals(panel.width, width);
  assertEquals(panel.height, height);
  assertEquals(Array.from(panel.rgba.slice(0, 4)), [10, 20, 30, 255]);
});

Deno.test("applyChromaKeyToRgbaPanel reproduces removeChromaKeyBackground's tagging and pixel output for a normal key", () => {
  const panel = makePosePanel("idle", [150, 90, 60, 255]);

  const rgbaResult = applyChromaKeyToRgbaPanel({
    state: panel.state,
    width: panel.width,
    height: panel.height,
    rgba: decode(panel.bytes).data as Uint8Array,
  });
  const pngResult = removeChromaKeyBackground(panel.bytes);
  const decodedPngResult = decode(pngResult.bytes);

  assertEquals(rgbaResult.chromaKeyQuality, "chromakey_applied");
  assertEquals(rgbaResult.chromaKeyQuality, pngResult.quality);

  // Background corner: transparent in both.
  assertEquals(rgbaResult.rgba[3], 0);
  assertEquals(decodedPngResult.data[3], 0);

  // Pet-colored pixel: opaque and untouched in both.
  const petOffset = (200 * panel.width + 200) * 4;
  assertEquals(
    Array.from(rgbaResult.rgba.slice(petOffset, petOffset + 4)),
    Array.from(decodedPngResult.data.slice(petOffset, petOffset + 4)),
  );
  assertEquals(rgbaResult.rgba[petOffset + 3], 255);
});

Deno.test("applyChromaKeyToRgbaPanel skips keying (matching removeChromaKeyBackground) when the background is not green-dominant", () => {
  const size = 16;
  const data = new Uint8Array(size * size * 4);

  for (let offset = 0; offset < data.length; offset += 4) {
    data.set([200, 40, 40, 255], offset); // flat red -- not green-dominant
  }

  const bytes = new Uint8Array(
    encode({ width: size, height: size, data, channels: 4, depth: 8 }),
  );

  const rgbaResult = applyChromaKeyToRgbaPanel({
    state: "idle",
    width: size,
    height: size,
    rgba: decode(bytes).data as Uint8Array,
  });
  const pngResult = removeChromaKeyBackground(bytes);

  assertEquals(rgbaResult.chromaKeyQuality, "chromakey_skipped");
  assertEquals(pngResult.quality, "chromakey_skipped");
  assertEquals(Array.from(rgbaResult.rgba.slice(0, 4)), [200, 40, 40, 255]);
});

Deno.test("validatePoseSheetSourceEdges reports every side a pet clips, not just one", () => {
  // horizontalOffset -140 shifts the block to x in [0, 230) (touches left);
  // verticalStart 0 keeps y in [0, 400) (touches top). Neither the right nor
  // bottom edge is reached.
  const clipped = makePosePanel("idle", [220, 80, 90, 255], -140, 0);
  const validation = validatePoseSheetSourceEdges([
    clipped,
    makePosePanel("happy", [80, 120, 220, 255], 0),
    makePosePanel("sleep", [180, 90, 210, 255], 16),
  ]);

  assertEquals(validation.valid, false);
  assertEquals(validation.failures, [
    "idle:source_edge_clipping:top",
    "idle:source_edge_clipping:left",
  ]);
});

Deno.test("generateValidatedPosePanels is generic over any panel shape, not just PoseSheetPanel", async () => {
  let attempts = 0;

  const panels = await generateValidatedPosePanels<{ state: string; ok: boolean }>(
    async () => {
      attempts += 1;

      return [
        { state: "idle", ok: attempts === 2 },
        { state: "happy", ok: true },
        { state: "sleep", ok: true },
      ];
    },
    2,
    (candidatePanels) => {
      const failures = candidatePanels
        .filter((panel) => !panel.ok)
        .map((panel) => `${panel.state}:not_ok`);

      return { valid: failures.length === 0, failures };
    },
  );

  assertEquals(attempts, 2);
  assertEquals(panels.map((panel) => panel.state), ["idle", "happy", "sleep"]);
});

Deno.test("RGBA-first flow composes end to end: split, key once, validate edges, normalize, validate panels, encode", () => {
  const states = ["idle", "happy", "sleep"] as const;
  const sheet = makeGreenPetSheet([
    [220, 80, 90, 255],
    [80, 120, 220, 255],
    [180, 90, 210, 255],
  ]);

  const keyedPanels = splitPoseSheetToRgbaPanels(sheet, states).map(applyChromaKeyToRgbaPanel);

  assertEquals(
    keyedPanels.map((panel) => panel.chromaKeyQuality),
    ["chromakey_applied", "chromakey_applied", "chromakey_applied"],
  );

  const edgeValidation = validatePoseSheetSourceEdgesRgba(keyedPanels);
  assertEquals(edgeValidation, { valid: true, failures: [] });

  const normalizedPanels = normalizePosePanelsForSafeAreaRgba(keyedPanels);
  const poseValidation = validatePoseSheetPanelsRgba(normalizedPanels);
  assertEquals(poseValidation, { valid: true, failures: [] });

  const finalPanels = normalizedPanels.map(encodePosePanelToPng);

  finalPanels.forEach((panel) => {
    const decoded = decode(panel.bytes);
    // Top-left corner is background and must still read as keyed
    // (transparent) after passing through edge validation and
    // normalization without ever being re-keyed.
    assertEquals(decoded.data[3], 0);
  });
});

Deno.test("chroma-keying runs exactly once per panel through the full RGBA-first flow", () => {
  const states = ["idle", "happy", "sleep"] as const;
  const sheet = makeGreenPetSheet([
    [220, 80, 90, 255],
    [80, 120, 220, 255],
    [180, 90, 210, 255],
  ]);

  let callCount = 0;
  const countingApplyChromaKeyToRgbaPanel = (panel: PoseSheetRgbaPanel) => {
    callCount += 1;
    return applyChromaKeyToRgbaPanel(panel);
  };

  const keyedPanels = splitPoseSheetToRgbaPanels(sheet, states).map(
    countingApplyChromaKeyToRgbaPanel,
  );

  // Mirrors the exact call order runPipeline uses in index.ts: edge
  // validation, then normalization, then the final panel quality gate, all
  // reusing the same keyedPanels array.
  validatePoseSheetSourceEdgesRgba(keyedPanels);
  const normalizedPanels = normalizePosePanelsForSafeAreaRgba(keyedPanels);
  validatePoseSheetPanelsRgba(normalizedPanels);

  assertEquals(callCount, states.length);
});

Deno.test("encodePosePanelToPng round-trips RGBA pixel data losslessly", () => {
  const width = 64;
  const height = 64;
  const rgba = new Uint8Array(width * height * 4);

  for (let offset = 0; offset < rgba.length; offset += 4) {
    rgba.set([0, 255, 0, 255], offset);
  }

  for (let y = 16; y < 48; y += 1) {
    for (let x = 16; x < 48; x += 1) {
      rgba.set([220, 80, 90, 255], (y * width + x) * 4);
    }
  }

  const encoded = encodePosePanelToPng({ state: "idle", width, height, rgba });
  const decoded = decode(encoded.bytes);

  assert(decoded.width === width && decoded.height === height);
  assertEquals(Array.from(decoded.data.slice(0, 4)), [0, 255, 0, 255]);

  const petOffset = (32 * width + 32) * 4;
  assertEquals(
    Array.from(decoded.data.slice(petOffset, petOffset + 4)),
    [220, 80, 90, 255],
  );
});

// ---------------------------------------------------------------------------
// Content-aware slot cuts (splitPoseSheetToRgbaPanels) and post-key edge
// fragment filtering (removeSmallEdgeFragmentsRgba) -- these replace the old
// fixed 512/1024 slot split, which sliced through pets the model drew
// slightly off the exact thirds. Production failures looked like
// "happy:source_edge_clipping:right, sleep:source_edge_clipping:left" (the
// center<->right slot boundary cutting through a pet); the tests below
// reproduce that exact failure signature against the old fixed-cut behavior,
// then confirm the new content-aware cut avoids it when a real valley
// exists, and still (correctly) rejects the sheet when it doesn't.
// ---------------------------------------------------------------------------

const makeGreenCanvasData = (): Uint8Array => {
  const data = new Uint8Array(WIDTH * HEIGHT * 4);

  for (let offset = 0; offset < data.length; offset += 4) {
    data.set([0, 255, 0, 255], offset);
  }

  return data;
};

const paintRect = (
  data: Uint8Array,
  color: readonly [number, number, number, number],
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): void => {
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      data.set(color, (y * WIDTH + x) * 4);
    }
  }
};

// Tapering wedge (full height at x0, narrowing to a thin tip just before
// x1), unlike paintRect's uniform-width block. A real pet silhouette's
// widest point is rarely at its very last column -- it tapers off at an
// extremity (tail, ear, paw) -- so a valley cut landing flush against a
// wedge's tip only grazes a few rows, while the same flush cut against a
// paintRect block would touch for the block's entire height. Used below to
// distinguish "cut lands right at the silhouette's true edge, no real
// clipping" from "cut slices through the body," which a uniform block can't
// tell apart on its own.
const paintWedge = (
  data: Uint8Array,
  color: readonly [number, number, number, number],
  x0: number,
  x1: number,
  yFull0: number,
  yFull1: number,
  maxShrink: number,
): void => {
  const span = Math.max(1, x1 - 1 - x0);

  for (let x = x0; x < x1; x += 1) {
    const shrink = Math.floor(((x - x0) / span) * maxShrink);
    const y0 = yFull0 + shrink;
    const y1 = yFull1 - shrink;

    for (let y = y0; y < y1; y += 1) {
      data.set(color, (y * WIDTH + x) * 4);
    }
  }
};

const encodeSheetData = (data: Uint8Array): Uint8Array =>
  new Uint8Array(encode({ width: WIDTH, height: HEIGHT, data, channels: 4, depth: 8 }));

// Mirrors splitPoseSheetToRgbaPanels' pre-fix behavior exactly (fixed
// 512px-wide columns, no valley search) so the "before" side of the
// before/after comparison below is pinned to the literal old algorithm
// rather than to an assumption about what it used to do.
const naiveFixedWidthSplit = (
  sheetBytes: Uint8Array,
  states: readonly string[],
): PoseSheetRgbaPanel[] => {
  const decoded = decode(sheetBytes);
  const source = decoded.data as Uint8Array;
  const panelWidth = 512;
  const panelHeight = decoded.height;

  return states.map((state, panelIndex) => {
    const data = new Uint8Array(panelWidth * panelHeight * 4);
    const sourceX = panelIndex * panelWidth;

    for (let row = 0; row < panelHeight; row += 1) {
      const sourceOffset = (row * decoded.width + sourceX) * 4;
      const targetOffset = row * panelWidth * 4;
      data.set(source.subarray(sourceOffset, sourceOffset + panelWidth * 4), targetOffset);
    }

    return { state, width: panelWidth, height: panelHeight, rgba: data };
  });
};

Deno.test("splitPoseSheetToRgbaPanels nudges a cut to a nearby valley instead of slicing a pet drawn off the exact thirds", () => {
  const states = ["idle", "happy", "sleep"] as const;
  const data = makeGreenCanvasData();

  // idle sits safely inside its own third -- no boundary interaction.
  paintRect(data, [220, 80, 90, 255], 140, 370, 200, 400);
  // happy is drawn wide, tapering to a tip at x=1099 -- 75px past the
  // nominal 1024 center<->right boundary, but still within the +/-96 search
  // window, with a genuine green valley (x=1100 onward) before sleep's pet
  // starts. Wedge-shaped (not a uniform block) so a cut landing flush
  // against its tip only grazes a few rows, matching a real silhouette
  // instead of an unrealistic full-height wall at the boundary.
  paintWedge(data, [80, 120, 220, 255], 700, 1100, 130, 400, 130);
  // sleep sits safely inside its own third, clear of the valley.
  paintRect(data, [180, 90, 210, 255], 1150, 1400, 200, 400);

  const sheet = encodeSheetData(data);

  // The old fixed 512/1024 cut slices straight through happy's pet,
  // reproducing the exact production failure signature this fix addresses.
  const naiveValidation = validatePoseSheetSourceEdgesRgba(
    naiveFixedWidthSplit(sheet, states).map(applyChromaKeyToRgbaPanel),
  );
  assertEquals(naiveValidation.valid, false);
  assertEquals(naiveValidation.failures.includes("happy:source_edge_clipping:right"), true);
  assertEquals(naiveValidation.failures.includes("sleep:source_edge_clipping:left"), true);

  // The content-aware split finds the valley beginning at x=1100 (nothing
  // green again until sleep starts at 1150). The run findValleyCut sees
  // within the +/-96 window is only [1100, 1120] (truncated by the window's
  // hi bound), but 1120 sits on that boundary, so findValleyCut looks up to
  // VALLEY_EDGE_LOOKAHEAD (32) further and finds the valley's true end at
  // 1149 -- well within that lookahead. The midpoint of the recovered
  // [1100, 1149] run is 1124.5, which gets clamped back to the window's hi
  // bound (1120) since a cut can never move further than +/-96 from nominal.
  // The nominal 512 cut is untouched: its whole window is one uniform-count
  // run touching both edges, and both sides' lookahead expansions hit their
  // own cap without finding a real edge (happy's tip at x=1099 is 91px past
  // the window's hi bound, well past the 32px lookahead), so the symmetric
  // caps land the midpoint right back on nominal.
  const panels = splitPoseSheetToRgbaPanels(sheet, states);
  assertEquals(panels.map((panel) => panel.width), [512, 1120 - 512, WIDTH - 1120]);

  const validation = validatePoseSheetSourceEdgesRgba(panels.map(applyChromaKeyToRgbaPanel));
  assertEquals(validation, { valid: true, failures: [] });
});

Deno.test("splitPoseSheetToRgbaPanels cannot invent a valley when pets are drawn touching across a boundary, and edge validation still rejects it", () => {
  const states = ["idle", "happy", "sleep"] as const;
  const data = makeGreenCanvasData();

  paintRect(data, [220, 80, 90, 255], 140, 370, 200, 400);
  // happy and sleep are drawn touching, with no green gap anywhere near the
  // center<->right boundary's +/-96 search window -- there is no valley to
  // find, so the cut falls back to the nominal boundary (same as the old
  // fixed cut) and correctly still clips the combined blob.
  paintRect(data, [80, 120, 220, 255], 850, 1200, 200, 400);

  const sheet = encodeSheetData(data);
  const panels = splitPoseSheetToRgbaPanels(sheet, states);

  assertEquals(panels[1]!.width, 512);
  assertEquals(panels[2]!.width, WIDTH - 1024);

  const validation = validatePoseSheetSourceEdgesRgba(panels.map(applyChromaKeyToRgbaPanel));
  assertEquals(validation.valid, false);
  assertEquals(validation.failures.includes("happy:source_edge_clipping:right"), true);
  assertEquals(validation.failures.includes("sleep:source_edge_clipping:left"), true);
});

// Reproduces the exact column-foreground geometry measured on two production
// debug sheets that false-positived on sleep:source_edge_clipping:left even
// though the sleeping pet was never actually clipped (see generate-avatar's
// CLAUDE.md fix notes). Both sheets had a wide, genuinely empty valley
// straddling the center<->right boundary whose left edge sat outside the
// +/-96 search window -- the old "closest column to nominal" rule picked the
// valley's right edge (1-2px from the next pet's outline), and the window's
// own hi bound alone (without VALLEY_EDGE_LOOKAHEAD) would have picked the
// valley's midpoint truncated at that same edge. This fixture pins the
// specific asymmetry that made both bugs visible: a valley from x=905 to
// x=1021, truncated to [928, 1021] by the window's own hi=1024+96=1120/
// lo=1024-96=928 bound (a 94px run), whose true midpoint (963) only becomes
// reachable once the run is allowed to look past the window boundary toward
// the valley's real start.
Deno.test("splitPoseSheetToRgbaPanels centers the nominal 1024 cut in a valley whose left edge sits outside the search window", () => {
  const states = ["idle", "happy", "sleep"] as const;
  const data = makeGreenCanvasData();

  // Foreground columns [0, 904] and [1022, 1300], empty (pure green) columns
  // [905, 1021] in between -- the measured shape of both failing sheets.
  paintRect(data, [220, 80, 90, 255], 0, 905, 200, 400);
  paintRect(data, [180, 90, 210, 255], 1022, 1301, 200, 400);

  const sheet = encodeSheetData(data);
  const panels = splitPoseSheetToRgbaPanels(sheet, states);
  const secondCut = panels[0]!.width + panels[1]!.width;

  // The valley's true midpoint is (905 + 1021) / 2 = 963. Allow a couple of
  // pixels of slack for the floor/rounding in findValleyCut's midpoint math
  // rather than pinning the exact integer.
  assert(Math.abs(secondCut - 963) <= 2);

  // The one giant [0, 904] block straddles the nominal 512 boundary with no
  // valley of its own, so idle/happy get an (expected, unrelated) fixed cut
  // there -- this fixture only cares about the center<->right boundary, so
  // assert the specific false-positive signature from the bug report is gone
  // rather than requiring the whole sheet to validate clean.
  const validation = validatePoseSheetSourceEdgesRgba(panels.map(applyChromaKeyToRgbaPanel));
  assertEquals(validation.failures.includes("sleep:source_edge_clipping:left"), false);
  assertEquals(validation.failures.includes("happy:source_edge_clipping:right"), false);
});

Deno.test("clampSlotCutsToMinWidth passes cuts through unchanged when every resulting panel is wide enough", () => {
  assertEquals(clampSlotCutsToMinWidth(600, 1100, 1536), [600, 1100]);
});

Deno.test("clampSlotCutsToMinWidth falls back to the nominal 512/1024 boundaries when any panel would be too narrow", () => {
  // This directly exercises the defensive floor with a synthetic cut pair --
  // findValleyCut's own +/-96 search window can never actually produce cuts
  // this close together (see clampSlotCutsToMinWidth's doc comment in
  // spriteSheet.ts), so there is no way to reach this branch through
  // splitPoseSheetToRgbaPanels itself.
  assertEquals(clampSlotCutsToMinWidth(600, 620, 1536), [512, 1024]); // middle panel too narrow
  assertEquals(clampSlotCutsToMinWidth(200, 1024, 1536), [512, 1024]); // first panel too narrow
  assertEquals(clampSlotCutsToMinWidth(512, 1400, 1536), [512, 1024]); // last panel too narrow
});

// Builds a single post-chroma-key panel (fully transparent background, as
// applyChromaKeyToRgbaPanel would have already produced) containing four
// disjoint foreground blobs, sized and positioned to exercise every branch
// of removeSmallEdgeFragmentsRgba's suppression rule at once.
const makeFragmentTestPanel = (): PoseSheetRgbaPanel => {
  const size = 300;
  const rgba = new Uint8Array(size * size * 4);
  const color: readonly [number, number, number, number] = [200, 90, 80, 255];

  const paint = (x0: number, x1: number, y0: number, y1: number): void => {
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        rgba.set(color, (y * size + x) * 4);
      }
    }
  };

  paint(100, 250, 100, 250); // main pet: 150x150=22500, touches no edge
  paint(0, 5, 0, 5); // tiny left-edge sliver: 5x5=25, well under the 20% floor -- removed
  paint(260, 300, 0, 150); // large right-edge component: 40x150=6000, over the 20% floor -- kept
  paint(10, 15, 10, 15); // isolated interior speck: 5x5=25, touches no edge -- kept regardless of size

  return { state: "happy", width: size, height: size, rgba };
};

Deno.test("removeSmallEdgeFragmentsRgba drops only small components touching a side edge, keeping the main pet, large edge components, and interior specks", () => {
  const panel = makeFragmentTestPanel();
  const filtered = removeSmallEdgeFragmentsRgba(panel);

  const alphaAt = (x: number, y: number): number => filtered.rgba[(y * panel.width + x) * 4 + 3] ?? 0;

  // Tiny left-edge sliver: suppressed (transparent).
  assertEquals(alphaAt(2, 2), 0);
  // Main pet: untouched.
  assertEquals(alphaAt(150, 150), 255);
  // Large right-edge component: untouched (well over the 20% floor).
  assertEquals(alphaAt(290, 50), 255);
  // Interior speck: untouched (doesn't touch a side edge, however small).
  assertEquals(alphaAt(12, 12), 255);

  assertEquals(filtered.width, panel.width);
  assertEquals(filtered.height, panel.height);
  assertEquals(filtered.state, panel.state);
});

Deno.test("removeSmallEdgeFragmentsRgba returns the panel unchanged when there is nothing to suppress", () => {
  const size = 64;
  const rgba = new Uint8Array(size * size * 4);

  for (let y = 20; y < 44; y += 1) {
    for (let x = 20; x < 44; x += 1) {
      rgba.set([200, 90, 80, 255], (y * size + x) * 4);
    }
  }

  const panel: PoseSheetRgbaPanel = { state: "idle", width: size, height: size, rgba };
  const filtered = removeSmallEdgeFragmentsRgba(panel);

  assertEquals(filtered, panel);
});

Deno.test("removeSmallEdgeFragmentsRgba preserves chromaKeyQuality on a keyed panel while filtering its rgba", () => {
  const size = 300;
  const rgba = new Uint8Array(size * size * 4);
  const color: readonly [number, number, number, number] = [200, 90, 80, 255];

  for (let y = 100; y < 250; y += 1) {
    for (let x = 100; x < 250; x += 1) {
      rgba.set(color, (y * size + x) * 4);
    }
  }

  for (let y = 0; y < 5; y += 1) {
    for (let x = 0; x < 5; x += 1) {
      rgba.set(color, (y * size + x) * 4);
    }
  }

  const keyedPanel = {
    state: "happy",
    width: size,
    height: size,
    rgba,
    chromaKeyQuality: "chromakey_applied" as const,
  };

  const filtered = removeSmallEdgeFragmentsRgba(keyedPanel);

  assertEquals(filtered.chromaKeyQuality, "chromakey_applied");
  assertEquals(filtered.rgba[(2 * size + 2) * 4 + 3], 0);
  assertEquals(filtered.rgba[(150 * size + 150) * 4 + 3], 255);
});
