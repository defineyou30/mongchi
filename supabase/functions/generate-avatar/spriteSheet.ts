import { decode as decodePng, encode as encodePng } from "npm:fast-png@7";

import { applyChromaKey, type ChromaKeyOutcome } from "./chromakey.ts";

export interface PoseSheetPromptSlot {
  state: string;
  pose: string;
}

export interface PoseSheetPanel {
  state: string;
  bytes: Uint8Array;
  width: number;
  height: number;
}

// RGBA-native panel representation used by the CPU-optimized pipeline path
// (see index.ts's runPipeline): a source PNG is decoded into this shape
// exactly once per attempt, threaded through chroma-key removal, edge
// validation, and safe-area normalization as raw pixels, and only re-encoded
// to PNG once, immediately before upload. The PNG-bytes-based exports below
// (splitPoseSheet, validatePoseSheetPanels, validatePoseSheetSourceEdges,
// normalizePosePanelsForSafeArea) are kept as decode-then-delegate wrappers
// around the Rgba variants purely for call-site/test compatibility -- they
// are not on the hot path anymore.
export interface PoseSheetRgbaPanel {
  state: string;
  width: number;
  height: number;
  rgba: Uint8Array;
}

// A panel that has already been through exactly one chroma-key pass, with
// the outcome tag (applied/skipped/suspicious) carried alongside it so
// downstream pipeline steps (normalize, quality gate) never need to key
// again just to know the tag for chromaKeyTags diagnostics.
export interface PoseSheetKeyedRgbaPanel extends PoseSheetRgbaPanel {
  chromaKeyQuality: ChromaKeyOutcome["quality"];
}

export interface PoseSheetValidation {
  valid: boolean;
  failures: string[];
}

const slotNames = ["LEFT", "CENTER", "RIGHT"] as const;
export const POSE_SHEET_WIDTH = 1536;
export const POSE_SHEET_HEIGHT = 1024;
export const POSE_PANEL_SIZE = 512;
// Upper bound on how far normalizePosePanelsForSafeArea will enlarge an
// under-filled panel. Without a cap, a pet the model drew tiny (e.g. a
// couple hundred pixels tall) could get blown up into blocky, low-detail
// pixel art; 2x keeps upscaling within a range nearest-neighbor sampling
// still reads as crisp pixel art rather than mush.
export const POSE_PANEL_MAX_UPSCALE = 2;

export const buildPoseSheetLayoutPrompt = (
  slots: readonly PoseSheetPromptSlot[],
): string => {
  if (slots.length !== slotNames.length) {
    throw new Error(`Pose sheet requires exactly ${slotNames.length} slots.`);
  }

  return [
    `Create one coherent horizontal three-slot sprite sheet on a ${POSE_SHEET_WIDTH}x${POSE_SHEET_HEIGHT} canvas.`,
    `Treat the canvas as three equal ${POSE_PANEL_SIZE}px-wide slots with no dividers, borders, labels, text, or gutters.`,
    "Fill the entire canvas with one perfectly flat pure #00FF00 chroma-key color; no gradient, texture, lighting variation, scenery, floor, horizon, vignette, or transparency.",
    // Image models cannot reliably count pixels ("96 pixels above"), and they
    // follow a whole-canvas constraint far more consistently than a
    // per-slot one, so headroom is expressed as a global rule instead of a
    // per-slot pixel budget.
    "Global size limit: the top quarter of the entire canvas must remain completely empty flat green; every pet's tallest point, ears included, stays clearly below that line.",
    // Symmetric counterpart to the top-quarter rule, added after production
    // logs showed repeated source_edge_clipping failures on the bottom edge:
    // the old per-slot baseline wording ("near the bottom of the canvas")
    // pushed feet right up against the crop edge with no margin below them.
    // A global bottom-tenth rule gives the model the same clear, whole-canvas
    // constraint the top rule already gets, instead of a vaguer per-slot one.
    "Global footroom limit: the bottom tenth of the entire canvas must stay completely empty flat green below every paw; every pet's paws or lowest contact point stays clearly above that line, never touching or crossing it.",
    "Place exactly one complete pet in each slot, horizontally centered with pure green padding of at least one tenth of the slot width on the left and right; no body part may reach or cross the left or right slot boundary.",
    // Slot-boundary wording alone ("no body part may reach or cross the left
    // or right slot boundary") describes an invisible line the model cannot
    // reliably locate. This line instead asks for a concrete, visible gap
    // between subjects, which image models follow far more consistently --
    // added after production logs showed happy/sleep source_edge_clipping
    // failures at the center<->right slot boundary from pets drawn too close
    // together.
    "Leave a clear vertical corridor of completely empty flat green, at least one tenth of the canvas width wide, between neighboring pets; pets must never touch, overlap, or reach toward each other.",
    "Inside each slot, keep the complete pet silhouette at roughly 55-65% of the slot's height, small enough to leave clear green margin above it, with the paws or body contact point on one shared horizontal baseline set just above the bottom tenth margin, not at the canvas edge.",
    "Show the complete silhouette, including ears, fur, tail, and paws; no body part may touch or cross the crop safety zone.",
    "If the reference photo crops the top of the head, ears, tail, paws, or any other body part, reconstruct the missing outline naturally from the visible pet instead of copying the photo crop; every silhouette must be complete.",
    "Do not draw a cast shadow, ground patch, glow, particles, motion trail, speech mark, accessory floating away from the body, or any pixels outside the pet silhouette.",
    "Keep identity, scale, outline, palette, markings, and bottom contact anchor identical across all three slots; only pose and expression change.",
    ...slots.map((slot, index) =>
      `${slotNames[index]} SLOT: ${slot.state}. ${slot.pose}`
    ),
    "The three slots are one bundle and must all be usable; do not merge poses, repeat a pose, move a pet across slot boundaries, or add any divider.",
  ].join(" ");
};

const expandRgbToRgba = (
  rgb: Uint8Array,
  width: number,
  height: number,
): Uint8Array => {
  const rgba = new Uint8Array(width * height * 4);

  for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
    const sourceOffset = pixelIndex * 3;
    const targetOffset = pixelIndex * 4;
    rgba[targetOffset] = rgb[sourceOffset];
    rgba[targetOffset + 1] = rgb[sourceOffset + 1];
    rgba[targetOffset + 2] = rgb[sourceOffset + 2];
    rgba[targetOffset + 3] = 255;
  }

  return rgba;
};

// General PNG-bytes -> RGBA panel decode, independent of any pre-known
// width/height (the PNG header carries its own). Used both by the dry-run
// fixture path (index.ts) and by decodePanelRgba below (which additionally
// checks the decoded size against a caller-supplied expectation).
export const decodePosePanelToRgba = (
  state: string,
  bytes: Uint8Array,
): PoseSheetRgbaPanel => {
  const decoded = decodePng(bytes);

  if (!(decoded.data instanceof Uint8Array)) {
    throw new Error(`Pose panel ${state} has an invalid PNG payload.`);
  }

  if (decoded.channels === 4) {
    return { state, width: decoded.width, height: decoded.height, rgba: decoded.data };
  }

  if (decoded.channels === 3) {
    return {
      state,
      width: decoded.width,
      height: decoded.height,
      rgba: expandRgbToRgba(decoded.data, decoded.width, decoded.height),
    };
  }

  throw new Error(`Pose panel ${state} uses unsupported PNG channels.`);
};

const decodePanelRgba = (panel: PoseSheetPanel): Uint8Array => {
  const rgbaPanel = decodePosePanelToRgba(panel.state, panel.bytes);

  if (rgbaPanel.width !== panel.width || rgbaPanel.height !== panel.height) {
    throw new Error(`Pose panel ${panel.state} has an invalid PNG payload.`);
  }

  return rgbaPanel.rgba;
};

const toRgbaPanel = (panel: PoseSheetPanel): PoseSheetRgbaPanel => ({
  state: panel.state,
  width: panel.width,
  height: panel.height,
  rgba: decodePanelRgba(panel),
});

// Final PNG encode, used exactly once per panel per successful attempt, at
// the very end of the pipeline (see runPipeline's step d/e in index.ts) --
// everything upstream (split, chroma key, edge validation, normalization,
// quality gate) now stays entirely in RGBA. zlib level 3 (vs. the level 6
// used by splitPoseSheet/chromakey.ts elsewhere in this pipeline) trades a
// small amount of file size for meaningfully less CPU on this, the only PNG
// encode remaining in the hot path -- pixel-art sprites compress well even
// at a lower level, so the size cost is minor.
export const encodePosePanelToPng = (panel: PoseSheetRgbaPanel): PoseSheetPanel => ({
  state: panel.state,
  bytes: new Uint8Array(
    encodePng(
      { width: panel.width, height: panel.height, data: panel.rgba, channels: 4, depth: 8 },
      { zlib: { level: 3 } },
    ),
  ),
  width: panel.width,
  height: panel.height,
});

// RGBA-native equivalent of chromakey.ts's removeChromaKeyBackground
// (PNG-bytes-in/out). chromakey.ts is intentionally left unmodified; this
// wrapper only adapts its pure applyChromaKey() pixel function to the RGBA
// panel shape used by this pipeline, reproducing the same three-way outcome
// tagging (applied/skipped/suspicious) and "ship the original pixels
// unchanged on failure" fallback that removeChromaKeyBackground guarantees.
// Called exactly once per panel per attempt (see index.ts's runPipeline) --
// the resulting tagged panel is reused for edge validation, normalization,
// and the quality gate rather than being re-keyed at each step.
export const applyChromaKeyToRgbaPanel = (
  panel: PoseSheetRgbaPanel,
): PoseSheetKeyedRgbaPanel => {
  try {
    const result = applyChromaKey({ width: panel.width, height: panel.height, data: panel.rgba });

    if (!result.applied) {
      return { ...panel, chromaKeyQuality: result.suspicious ? "chromakey_suspicious" : "chromakey_skipped" };
    }

    return { ...panel, rgba: result.image.data, chromaKeyQuality: "chromakey_applied" };
  } catch {
    return { ...panel, chromaKeyQuality: "chromakey_skipped" };
  }
};

const isForegroundPixel = (rgba: Uint8Array, offset: number): boolean => {
  const red = rgba[offset] ?? 0;
  const green = rgba[offset + 1] ?? 0;
  const blue = rgba[offset + 2] ?? 0;
  const alpha = rgba[offset + 3] ?? 0;

  return alpha > 24 && !(green > 110 && green > red + 28 && green > blue + 28);
};

// Below what fraction of the largest foreground component's area a
// left/right-edge-touching component must fall to be treated as debris
// (a neighboring panel's chroma-keyed fragment leaking across a content-aware
// cut, or stray key noise) rather than part of the pet itself.
const EDGE_FRAGMENT_MAX_AREA_RATIO = 0.2;

// Post-chroma-key, pre-edge-validation cleanup: flood-fills the panel's
// foreground into 4-connected components (Int32Array ring queue, mirroring
// chromakey.ts's BFS shadow pass) and transparents out any component that
// both touches the panel's left or right edge and is smaller than
// EDGE_FRAGMENT_MAX_AREA_RATIO of the largest component. This targets the
// specific debris a content-aware slot cut can leave behind: a sliver of the
// *neighboring* pet that ended up on the wrong side of the cut. The largest
// component (the actual pet) is never touched -- it can never be smaller
// than EDGE_FRAGMENT_MAX_AREA_RATIO of itself -- and neither is any other
// component large enough to plausibly be part of the pet rather than noise.
// Generic over the panel shape so it can run on PoseSheetKeyedRgbaPanel
// (preserving chromaKeyQuality) without re-tagging.
export const removeSmallEdgeFragmentsRgba = <TPanel extends PoseSheetRgbaPanel>(
  panel: TPanel,
): TPanel => {
  const { rgba, width, height } = panel;
  const pixelCount = width * height;
  const labels = new Int32Array(pixelCount).fill(-1);
  const queue = new Int32Array(pixelCount);
  const componentSizes: number[] = [];
  const componentTouchesSideEdge: boolean[] = [];

  for (let start = 0; start < pixelCount; start += 1) {
    if (labels[start] !== -1 || !isForegroundPixel(rgba, start * 4)) {
      continue;
    }

    const label = componentSizes.length;
    let head = 0;
    let tail = 0;
    let size = 0;
    let touchesSideEdge = false;

    labels[start] = label;
    queue[tail] = start;
    tail += 1;

    while (head < tail) {
      const pixelIndex = queue[head];
      head += 1;
      size += 1;

      const x = pixelIndex % width;
      const y = (pixelIndex - x) / width;

      if (x === 0 || x === width - 1) {
        touchesSideEdge = true;
      }

      for (let direction = 0; direction < 4; direction += 1) {
        const nx = direction === 0 ? x - 1 : direction === 1 ? x + 1 : x;
        const ny = direction === 2 ? y - 1 : direction === 3 ? y + 1 : y;

        if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
          continue;
        }

        const neighborIndex = ny * width + nx;

        if (labels[neighborIndex] !== -1 || !isForegroundPixel(rgba, neighborIndex * 4)) {
          continue;
        }

        labels[neighborIndex] = label;
        queue[tail] = neighborIndex;
        tail += 1;
      }
    }

    componentSizes.push(size);
    componentTouchesSideEdge.push(touchesSideEdge);
  }

  if (componentSizes.length <= 1) {
    return panel;
  }

  const maxSize = Math.max(...componentSizes);
  let hasFragment = false;
  const suppressLabel = componentSizes.map((size, label) => {
    const suppress = componentTouchesSideEdge[label] === true && size < maxSize * EDGE_FRAGMENT_MAX_AREA_RATIO;
    hasFragment = hasFragment || suppress;
    return suppress;
  });

  if (!hasFragment) {
    return panel;
  }

  const filtered = new Uint8Array(rgba);

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    const label = labels[pixelIndex];

    if (label !== -1 && suppressLabel[label]) {
      filtered[pixelIndex * 4 + 3] = 0;
    }
  }

  return { ...panel, rgba: filtered };
};

export const validatePoseSheetPanelsRgba = (
  panels: readonly PoseSheetRgbaPanel[],
): PoseSheetValidation => {
  const failures: string[] = [];

  for (const panel of panels) {
    const { rgba, width, height, state } = panel;
    let foreground = 0;
    const borderSize = 24;
    let borderForeground = 0;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;

        if (!isForegroundPixel(rgba, offset)) {
          continue;
        }

        foreground += 1;
        if (
          x < borderSize || y < borderSize ||
          x >= width - borderSize || y >= height - borderSize
        ) {
          borderForeground += 1;
        }
      }
    }

    const occupancy = foreground / (width * height);
    const borderShare = foreground === 0 ? 0 : borderForeground / foreground;

    if (occupancy < 0.025 || occupancy > 0.72) {
      failures.push(`${state}:foreground_occupancy`);
    }

    if (borderShare > 0.02) {
      failures.push(`${state}:slot_containment`);
    }
  }

  for (let leftIndex = 0; leftIndex < panels.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < panels.length;
      rightIndex += 1
    ) {
      const left = panels[leftIndex]!;
      const right = panels[rightIndex]!;
      let compared = 0;
      let changed = 0;

      for (let offset = 0; offset < left.rgba.length; offset += 32) {
        const leftForeground = isForegroundPixel(left.rgba, offset);
        const rightForeground = isForegroundPixel(right.rgba, offset);

        if (!leftForeground && !rightForeground) {
          continue;
        }

        compared += 1;
        const colorDelta =
          Math.abs((left.rgba[offset] ?? 0) - (right.rgba[offset] ?? 0)) +
          Math.abs(
            (left.rgba[offset + 1] ?? 0) - (right.rgba[offset + 1] ?? 0),
          ) +
          Math.abs(
            (left.rgba[offset + 2] ?? 0) - (right.rgba[offset + 2] ?? 0),
          );

        if (leftForeground !== rightForeground || colorDelta > 54) {
          changed += 1;
        }
      }

      if (compared === 0 || changed / compared < 0.06) {
        failures.push(
          `${left.state}:${right.state}:pose_distinctness`,
        );
      }
    }
  }

  return { valid: failures.length === 0, failures };
};

export const validatePoseSheetPanels = (
  panels: readonly PoseSheetPanel[],
): PoseSheetValidation => validatePoseSheetPanelsRgba(panels.map(toRgbaPanel));

const EDGE_NAMES = ["top", "bottom", "left", "right"] as const;

export const validatePoseSheetSourceEdgesRgba = (
  panels: readonly PoseSheetRgbaPanel[],
): PoseSheetValidation => {
  const failures: string[] = [];
  const edgeBand = 2;

  for (const panel of panels) {
    const { rgba, width, height, state } = panel;
    const edgeSequences = [
      // top
      Array.from(
        { length: width },
        (_, x) =>
          Array.from(
            { length: edgeBand },
            (_, y) => isForegroundPixel(rgba, (y * width + x) * 4),
          ).some(Boolean),
      ),
      // bottom
      Array.from(
        { length: width },
        (_, x) =>
          Array.from({ length: edgeBand }, (_, inset) => {
            const y = height - 1 - inset;
            return isForegroundPixel(rgba, (y * width + x) * 4);
          }).some(Boolean),
      ),
      // left
      Array.from(
        { length: height },
        (_, y) =>
          Array.from(
            { length: edgeBand },
            (_, x) => isForegroundPixel(rgba, (y * width + x) * 4),
          ).some(Boolean),
      ),
      // right
      Array.from(
        { length: height },
        (_, y) =>
          Array.from({ length: edgeBand }, (_, inset) => {
            const x = width - 1 - inset;
            return isForegroundPixel(rgba, (y * width + x) * 4);
          }).some(Boolean),
      ),
    ];
    const meaningfulEdgeRun = Math.max(
      16,
      Math.floor(Math.min(width, height) * 0.04),
    );

    edgeSequences.forEach((sequence, edgeIndex) => {
      let current = 0;
      let longest = 0;

      for (const touchesEdge of sequence) {
        current = touchesEdge ? current + 1 : 0;
        longest = Math.max(longest, current);
      }

      // Per-edge diagnostic (rather than one flat "source_edge_clipping"
      // failure) so production failures can be triaged by which side of the
      // canvas is actually getting clipped -- see markJobFailed's
      // internalError in index.ts, which is the only consumer of this
      // string. A panel can clip on more than one edge at once, in which
      // case each touched edge gets its own failure entry.
      if (longest >= meaningfulEdgeRun) {
        failures.push(`${state}:source_edge_clipping:${EDGE_NAMES[edgeIndex]}`);
      }
    });
  }

  return { valid: failures.length === 0, failures };
};

export const validatePoseSheetSourceEdges = (
  panels: readonly PoseSheetPanel[],
): PoseSheetValidation => validatePoseSheetSourceEdgesRgba(panels.map(toRgbaPanel));

interface PoseSheetRgbaForegroundBounds {
  panel: PoseSheetRgbaPanel;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const findForegroundBoundsRgba = (
  panel: PoseSheetRgbaPanel,
): PoseSheetRgbaForegroundBounds | null => {
  const { rgba, width, height } = panel;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      if (!isForegroundPixel(rgba, offset)) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return { panel, minX, minY, maxX, maxY };
};

// Renders one panel's foreground onto a fresh POSE_PANEL_SIZE canvas at the
// given scale, horizontally centered and anchored to the shared bottom
// baseline (canvasHeight - safeInset). The nearest-neighbor sampling loop
// below is unchanged from the pre-batch implementation and already clamps
// source coordinates at maxX/maxY, so it behaves correctly for scale > 1
// (upscale) as well as scale < 1 (downscale).
const renderNormalizedPanelRgba = (
  foreground: PoseSheetRgbaForegroundBounds,
  scale: number,
  safeInset: number,
): PoseSheetRgbaPanel => {
  const canvasWidth = POSE_PANEL_SIZE;
  const canvasHeight = POSE_PANEL_SIZE;
  const { panel, minX, minY, maxX, maxY } = foreground;
  const sourceWidth = maxX - minX + 1;
  const sourceHeight = maxY - minY + 1;
  const scaledWidth = Math.max(
    1,
    Math.min(canvasWidth, Math.floor(sourceWidth * scale)),
  );
  const scaledHeight = Math.max(
    1,
    Math.min(canvasHeight, Math.floor(sourceHeight * scale)),
  );
  const targetX = Math.floor((canvasWidth - scaledWidth) / 2);
  const targetY = canvasHeight - safeInset - scaledHeight;
  const normalized = new Uint8Array(canvasWidth * canvasHeight * 4);

  for (let y = 0; y < scaledHeight; y += 1) {
    const sourceY = Math.min(maxY, minY + Math.floor(y / scale));
    for (let x = 0; x < scaledWidth; x += 1) {
      const sourceX = Math.min(maxX, minX + Math.floor(x / scale));
      const sourceOffset = (sourceY * panel.width + sourceX) * 4;
      const targetOffset = ((targetY + y) * canvasWidth + targetX + x) * 4;
      normalized.set(
        panel.rgba.subarray(sourceOffset, sourceOffset + 4),
        targetOffset,
      );
    }
  }

  return {
    state: panel.state,
    width: canvasWidth,
    height: canvasHeight,
    rgba: normalized,
  };
};

// Normalizes an entire pose-sheet bundle (all three panels) onto one shared
// scale instead of scaling each panel to its own independent best fit. A
// per-panel scale would let a naturally compact pose (e.g. a curled-up sleep
// panel) get blown up far more than a standing pose drawn in the same
// bundle, breaking the "same pet, same size" contract between states. Using
// the most space-constrained panel's fit as the scale for every panel keeps
// relative size consistent while still allowing the whole bundle to grow
// past a naive 1:1 mapping when the model drew everyone smaller than the
// safe area allows (capped at POSE_PANEL_MAX_UPSCALE to avoid blocky
// upscaling of a panel the model drew unusually tiny).
export const normalizePosePanelsForSafeAreaRgba = (
  panels: readonly PoseSheetRgbaPanel[],
  safeInset = 24,
): PoseSheetRgbaPanel[] => {
  const canvasWidth = POSE_PANEL_SIZE;
  const canvasHeight = POSE_PANEL_SIZE;

  if (
    !Number.isInteger(safeInset) || safeInset < 0 ||
    safeInset * 2 >= canvasWidth || safeInset * 2 >= canvasHeight
  ) {
    throw new Error("Pose panel safe inset is invalid.");
  }

  const availableWidth = canvasWidth - safeInset * 2;
  const availableHeight = canvasHeight - safeInset * 2;
  const foregrounds = panels.map((panel) => findForegroundBoundsRgba(panel));
  const perPanelMaxScales = foregrounds
    .filter((foreground): foreground is PoseSheetRgbaForegroundBounds =>
      foreground !== null
    )
    .map((foreground) => {
      const sourceWidth = foreground.maxX - foreground.minX + 1;
      const sourceHeight = foreground.maxY - foreground.minY + 1;

      return Math.min(
        availableWidth / sourceWidth,
        availableHeight / sourceHeight,
      );
    });
  const sharedScale = perPanelMaxScales.length === 0
    ? 1
    : Math.min(POSE_PANEL_MAX_UPSCALE, Math.min(...perPanelMaxScales));

  return panels.map((panel, index) => {
    const foreground = foregrounds[index];

    // No foreground detected (e.g. an all-green panel) -- nothing to
    // normalize, and it must not pull the shared scale down for its
    // (non-existent) bounding box, which is why it was already excluded
    // from perPanelMaxScales above.
    if (!foreground) {
      return panel;
    }

    return renderNormalizedPanelRgba(foreground, sharedScale, safeInset);
  });
};

export const normalizePosePanelsForSafeArea = (
  panels: readonly PoseSheetPanel[],
  safeInset = 24,
): PoseSheetPanel[] => {
  const rgbaPanels = panels.map(toRgbaPanel);
  const normalizedRgbaPanels = normalizePosePanelsForSafeAreaRgba(rgbaPanels, safeInset);

  return normalizedRgbaPanels.map((normalized, index) => {
    // normalizePosePanelsForSafeAreaRgba returns the exact same panel object
    // (by reference) when it found no foreground to normalize -- mirror that
    // by returning the original PNG-bytes panel unchanged rather than
    // re-encoding pixels that never changed.
    if (normalized === rgbaPanels[index]) {
      return panels[index]!;
    }

    return {
      state: normalized.state,
      bytes: new Uint8Array(encodePng({
        width: normalized.width,
        height: normalized.height,
        data: normalized.rgba,
        channels: 4,
        depth: 8,
      })),
      width: normalized.width,
      height: normalized.height,
    };
  });
};

export const normalizePosePanelForSafeArea = (
  panel: PoseSheetPanel,
  safeInset = 24,
): PoseSheetPanel => normalizePosePanelsForSafeArea([panel], safeInset)[0]!;

// Generic over the panel shape so the RGBA-first pipeline (index.ts) can run
// this retry loop directly over PoseSheetKeyedRgbaPanel[] instead of the
// PNG-bytes PoseSheetPanel[] the default validatePanels (validatePoseSheetPanels)
// expects. Existing callers that omit validatePanels are unaffected: TPanel
// is inferred from generatePanels' return type, and when that's
// PoseSheetPanel[] the cast default below is exactly validatePoseSheetPanels.
export const generateValidatedPosePanels = async <TPanel>(
  generatePanels: () => Promise<TPanel[]>,
  maxAttempts = 1,
  validatePanels: (panels: readonly TPanel[]) => PoseSheetValidation =
    validatePoseSheetPanels as unknown as (
      panels: readonly TPanel[],
    ) => PoseSheetValidation,
): Promise<TPanel[]> => {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("Pose sheet attempts must be a positive integer.");
  }

  let failures: string[] = [];

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const panels = await generatePanels();
    const validation = validatePanels(panels);

    if (validation.valid) {
      return panels;
    }

    failures = validation.failures;
  }

  throw new Error(`Pose sheet quality failed: ${failures.join(", ")}`);
};

// How far a slot cut may move away from its nominal position (512, 1024) to
// dodge a pet the model didn't draw in the exact thirds. Production logs
// showed happy/sleep source_edge_clipping failures where the model placed a
// pet a bit off-center, so the old fixed cut sliced straight through it --
// see NOMINAL_SLOT_BOUNDARIES below.
const SLOT_BOUNDARY_SEARCH_WINDOW = 96;
// How much further than +/-SLOT_BOUNDARY_SEARCH_WINDOW findValleyCut will
// look to recover the true edge of a valley that starts inside the search
// window but extends past it (see findValleyCut's doc comment). Deliberately
// much smaller than SLOT_BOUNDARY_SEARCH_WINDOW itself: production debug
// sheets that reproduced the source_edge_clipping false positive this fixes
// only ever needed a few pixels of extra lookahead to find a valley's true
// edge. A much larger allowance would instead let two independent, far-apart
// pets that happen to share one large green gap pull a cut that didn't need
// to move at all toward a point artificially centered between them -- see
// the "no boundary interaction" cases in spriteSheet_test.ts's valley tests.
const VALLEY_EDGE_LOOKAHEAD = 32;
const NOMINAL_SLOT_BOUNDARIES = [POSE_PANEL_SIZE, POSE_PANEL_SIZE * 2] as const;
// Defensive floor on panel width. Structurally unreachable given
// SLOT_BOUNDARY_SEARCH_WINDOW (worst case, both cuts move toward each other
// by the full window: 1536/3 - 2*96 = 320px, comfortably above this), but
// kept as a guard against a future constant change silently breaking it.
const MIN_SLOT_PANEL_WIDTH = 256;

// Column-wise foreground histogram over the whole sheet, computed on the raw
// (not yet chroma-keyed) sheet RGBA. isForegroundPixel already treats a flat
// chroma-key green background as background via its green-dominance check,
// so this is safe to run before applyChromaKeyToRgbaPanel -- no extra decode
// or key pass required, just one more read of the buffer already in hand.
const computeColumnForegroundCounts = (
  rgba: Uint8Array,
  width: number,
  height: number,
): Uint32Array => {
  const counts = new Uint32Array(width);

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * width;

    for (let x = 0; x < width; x += 1) {
      if (isForegroundPixel(rgba, (rowOffset + x) * 4)) {
        counts[x] += 1;
      }
    }
  }

  return counts;
};

// Picks a cut within +/-window of a nominal slot boundary by finding the
// widest run of least-occupied columns -- the "valley" between two pets, even
// when the model didn't center them on the exact thirds -- and cutting at
// that run's midpoint rather than at whichever end of it happens to sit
// closest to the nominal boundary.
//
// The previous version picked, among all minimum-count columns within the
// window, the one nearest the nominal boundary. Production debug sheets
// showed why that's wrong: a real valley is rarely centered on the nominal
// boundary (the two neighboring pets aren't drawn with perfectly even
// padding), so "nearest to nominal" routinely lands the cut on the valley's
// edge -- one pixel off the pet's actual outline -- rather than in its
// middle. That 1-2px margin is well within a chroma-keyed edge's
// anti-aliasing halo, so validatePoseSheetSourceEdgesRgba's 2px edge band
// flags the resulting panel as clipped even though the pet was never
// actually cut. Cutting at the valley's midpoint instead keeps a safety
// margin on both sides regardless of where the true boundary between the
// pets happens to fall.
//
// The minimum count itself doesn't have to be 0 (a hazy/noisy sheet may never
// have a perfectly empty column) -- the same "longest run of the window's
// minimum, cut at its midpoint" rule applies either way. Ties in run length
// resolve to whichever run's midpoint sits closest to the nominal boundary,
// so a cut only moves as far as the actual content requires instead of
// drifting to the edge of the search window.
//
// A valley found by this first, window-bounded pass can itself be clipped by
// the window (e.g. a valley that starts just outside +/-window but extends
// well inside it) -- taking that clipped run's midpoint would reintroduce the
// exact same one-sided-margin bug this function exists to fix, just shifted
// from the pet's edge to the window's edge instead. So a run that touches the
// window boundary gets extended past it, up to +/-VALLEY_EDGE_LOOKAHEAD
// further, to find where it actually ends; that widened bound is only used to
// locate the valley's true center -- the returned cut is still clamped back
// into +/-window so a cut can never move further from nominal than before. A
// run that doesn't touch either window edge (a valley found entirely inside
// the window) is already the valley's true extent and needs no extension.
//
// VALLEY_EDGE_LOOKAHEAD is deliberately small relative to window: if a sheet
// has no distinguishing minimum anywhere near the boundary (e.g. two pets far
// apart on either side of a uniform green gap, or fully uniform foreground
// with no green field at all), both ends hit the lookahead cap rather than a
// real edge, and since the cap is applied symmetrically around the window
// the resulting midpoint lands back on nominal exactly -- the same as the
// old fixed-cut fallback -- instead of drifting toward the middle of a gap
// neither pet is actually crowding.
const findValleyCut = (
  counts: Uint32Array,
  nominal: number,
  window: number,
): number => {
  const lo = Math.max(0, nominal - window);
  const hi = Math.min(counts.length - 1, nominal + window);

  let minCount = Infinity;
  for (let x = lo; x <= hi; x += 1) {
    const count = counts[x] ?? 0;
    if (count < minCount) {
      minCount = count;
    }
  }

  let bestRunStart = lo;
  let bestRunEnd = lo;
  let bestRunLength = 0;
  let bestRunDistance = Infinity;
  let runStart = -1;

  const considerRun = (start: number, end: number): void => {
    const length = end - start + 1;
    const midpoint = Math.floor((start + end) / 2);
    const distance = Math.abs(midpoint - nominal);

    if (
      length > bestRunLength ||
      (length === bestRunLength && distance < bestRunDistance)
    ) {
      bestRunStart = start;
      bestRunEnd = end;
      bestRunLength = length;
      bestRunDistance = distance;
    }
  };

  for (let x = lo; x <= hi; x += 1) {
    const count = counts[x] ?? 0;

    if (count === minCount) {
      if (runStart === -1) {
        runStart = x;
      }
    } else if (runStart !== -1) {
      considerRun(runStart, x - 1);
      runStart = -1;
    }
  }

  if (runStart !== -1) {
    considerRun(runStart, hi);
  }

  let trueStart = bestRunStart;
  if (bestRunStart === lo) {
    const extendedLo = Math.max(0, lo - VALLEY_EDGE_LOOKAHEAD);
    while (trueStart > extendedLo && (counts[trueStart - 1] ?? 0) === minCount) {
      trueStart -= 1;
    }
  }

  let trueEnd = bestRunEnd;
  if (bestRunEnd === hi) {
    const extendedHi = Math.min(counts.length - 1, hi + VALLEY_EDGE_LOOKAHEAD);
    while (trueEnd < extendedHi && (counts[trueEnd + 1] ?? 0) === minCount) {
      trueEnd += 1;
    }
  }

  const midpoint = Math.floor((trueStart + trueEnd) / 2);

  return Math.max(lo, Math.min(hi, midpoint));
};

// Falls back both cuts to the nominal 512/1024 boundaries if the content-aware
// pair would leave any panel narrower than MIN_SLOT_PANEL_WIDTH. Given
// findValleyCut's fixed +/-SLOT_BOUNDARY_SEARCH_WINDOW search range and the
// 512px spacing between NOMINAL_SLOT_BOUNDARIES, the narrowest panel two
// valley cuts can ever produce is 1536/3 - 2*96 = 320px -- comfortably above
// this floor -- so in production this branch is unreachable. It's exported
// and kept as a standalone, directly-testable guard anyway, both as a defense
// against a future constant change and because findValleyCut's own return
// range can't be violated from the outside to exercise this branch in a test.
export const clampSlotCutsToMinWidth = (
  firstCut: number,
  secondCut: number,
  sheetWidth: number,
): [number, number] => {
  if (
    firstCut < MIN_SLOT_PANEL_WIDTH ||
    secondCut - firstCut < MIN_SLOT_PANEL_WIDTH ||
    sheetWidth - secondCut < MIN_SLOT_PANEL_WIDTH
  ) {
    return [NOMINAL_SLOT_BOUNDARIES[0], NOMINAL_SLOT_BOUNDARIES[1]];
  }

  return [firstCut, secondCut];
};

// Decodes the sheet once and slices it into per-panel RGBA buffers with no
// per-panel PNG encode -- the CPU-optimized counterpart to splitPoseSheet
// below, which this function now backs. Used directly by index.ts's
// RGBA-first pipeline so a PNG encode never happens between generation and
// chroma-keying.
//
// Slot boundaries are content-aware rather than a fixed 512/1024 cut: each
// nominal boundary is nudged, within SLOT_BOUNDARY_SEARCH_WINDOW, to the
// least-occupied ("valley") column nearby (see findValleyCut). If a pet is
// genuinely straddling the boundary (no valley to find within the window),
// the cut falls back toward the nominal position and the resulting slice
// still clips it -- source-edge validation downstream is meant to catch that
// case and trigger a retry, so this is intentionally not "fixed" here.
// Resulting panels can be different widths from each other and from
// POSE_PANEL_SIZE; every downstream step (chroma key, edge validation,
// safe-area normalization) already operates on each panel's own bounding
// box, not a hardcoded 512px assumption.
export const splitPoseSheetToRgbaPanels = (
  pngBytes: Uint8Array,
  states: readonly string[],
): PoseSheetRgbaPanel[] => {
  if (states.length !== slotNames.length) {
    throw new Error(`Pose sheet requires exactly ${slotNames.length} states.`);
  }

  const decoded = decodePng(pngBytes);

  if (
    (decoded.channels !== 3 && decoded.channels !== 4) ||
    decoded.width !== POSE_SHEET_WIDTH ||
    decoded.height !== POSE_SHEET_HEIGHT
  ) {
    throw new Error("Pose sheet returned an unsupported PNG layout.");
  }

  const source = decoded.data;

  if (!(source instanceof Uint8Array)) {
    throw new Error("Pose sheet must use 8-bit PNG channels.");
  }

  const rgba = decoded.channels === 4
    ? source
    : expandRgbToRgba(source, decoded.width, decoded.height);
  const panelHeight = decoded.height;
  const columnCounts = computeColumnForegroundCounts(rgba, decoded.width, panelHeight);

  const [firstCut, secondCut] = clampSlotCutsToMinWidth(
    findValleyCut(columnCounts, NOMINAL_SLOT_BOUNDARIES[0], SLOT_BOUNDARY_SEARCH_WINDOW),
    findValleyCut(columnCounts, NOMINAL_SLOT_BOUNDARIES[1], SLOT_BOUNDARY_SEARCH_WINDOW),
    decoded.width,
  );

  const cuts = [0, firstCut, secondCut, decoded.width];

  return states.map((state, panelIndex) => {
    const panelStart = cuts[panelIndex]!;
    const panelEnd = cuts[panelIndex + 1]!;
    const panelWidth = panelEnd - panelStart;
    const data = new Uint8Array(panelWidth * panelHeight * 4);

    for (let row = 0; row < panelHeight; row += 1) {
      const sourceOffset = (row * decoded.width + panelStart) * 4;
      const targetOffset = row * panelWidth * 4;
      data.set(
        rgba.subarray(sourceOffset, sourceOffset + panelWidth * 4),
        targetOffset,
      );
    }

    return { state, width: panelWidth, height: panelHeight, rgba: data };
  });
};

export const splitPoseSheet = (
  pngBytes: Uint8Array,
  states: readonly string[],
): PoseSheetPanel[] =>
  splitPoseSheetToRgbaPanels(pngBytes, states).map((panel) => ({
    state: panel.state,
    bytes: new Uint8Array(encodePng({
      width: panel.width,
      height: panel.height,
      data: panel.rgba,
      channels: 4,
      depth: 8,
    }, { zlib: { level: 6 } })),
    width: panel.width,
    height: panel.height,
  }));
