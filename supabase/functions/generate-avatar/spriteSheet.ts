import { decode as decodePng, encode as encodePng } from "npm:fast-png@7";

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

export interface PoseSheetValidation {
  valid: boolean;
  failures: string[];
}

const slotNames = ["LEFT", "CENTER", "RIGHT"] as const;
export const POSE_SHEET_WIDTH = 1536;
export const POSE_SHEET_HEIGHT = 1024;
export const POSE_PANEL_SIZE = 512;

export const buildPoseSheetLayoutPrompt = (
  slots: readonly PoseSheetPromptSlot[],
): string => {
  if (slots.length !== slotNames.length) {
    throw new Error(`Pose sheet requires exactly ${slotNames.length} slots.`);
  }

  return [
    `Create one coherent horizontal three-slot sprite sheet on a ${POSE_SHEET_WIDTH}x${POSE_SHEET_HEIGHT} canvas.`,
    `Treat the canvas as three equal ${POSE_PANEL_SIZE}px-wide slots with no dividers, borders, labels, text, or gutters.`,
    `Place exactly one complete pet in each slot, centered inside the middle ${POSE_PANEL_SIZE}x${POSE_PANEL_SIZE} square of that slot with generous green padding above and below.`,
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

const decodePanelRgba = (panel: PoseSheetPanel): Uint8Array => {
  const decoded = decodePng(panel.bytes);

  if (
    decoded.width !== panel.width || decoded.height !== panel.height ||
    !(decoded.data instanceof Uint8Array)
  ) {
    throw new Error(`Pose panel ${panel.state} has an invalid PNG payload.`);
  }

  if (decoded.channels === 4) {
    return decoded.data;
  }

  if (decoded.channels === 3) {
    return expandRgbToRgba(decoded.data, decoded.width, decoded.height);
  }

  throw new Error(`Pose panel ${panel.state} uses unsupported PNG channels.`);
};

const isForegroundPixel = (rgba: Uint8Array, offset: number): boolean => {
  const red = rgba[offset] ?? 0;
  const green = rgba[offset + 1] ?? 0;
  const blue = rgba[offset + 2] ?? 0;
  const alpha = rgba[offset + 3] ?? 0;

  return alpha > 24 && !(green > 110 && green > red + 28 && green > blue + 28);
};

export const validatePoseSheetPanels = (
  panels: readonly PoseSheetPanel[],
): PoseSheetValidation => {
  const failures: string[] = [];
  const decodedPanels = panels.map((panel) => ({
    panel,
    rgba: decodePanelRgba(panel),
  }));

  for (const { panel, rgba } of decodedPanels) {
    let foreground = 0;
    let borderForeground = 0;
    const borderSize = 10;

    for (let y = 0; y < panel.height; y += 1) {
      for (let x = 0; x < panel.width; x += 1) {
        const offset = (y * panel.width + x) * 4;

        if (!isForegroundPixel(rgba, offset)) {
          continue;
        }

        foreground += 1;
        if (
          x < borderSize || y < borderSize || x >= panel.width - borderSize ||
          y >= panel.height - borderSize
        ) {
          borderForeground += 1;
        }
      }
    }

    const occupancy = foreground / (panel.width * panel.height);
    const borderShare = foreground === 0 ? 1 : borderForeground / foreground;

    if (occupancy < 0.025 || occupancy > 0.72) {
      failures.push(`${panel.state}:foreground_occupancy`);
    }

    if (borderShare > 0.02) {
      failures.push(`${panel.state}:slot_containment`);
    }
  }

  for (let leftIndex = 0; leftIndex < decodedPanels.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < decodedPanels.length;
      rightIndex += 1
    ) {
      const left = decodedPanels[leftIndex]!;
      const right = decodedPanels[rightIndex]!;
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
          `${left.panel.state}:${right.panel.state}:pose_distinctness`,
        );
      }
    }
  }

  return { valid: failures.length === 0, failures };
};

export const splitPoseSheet = (
  pngBytes: Uint8Array,
  states: readonly string[],
): PoseSheetPanel[] => {
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
  const panelWidth = POSE_PANEL_SIZE;
  const cropSize = POSE_PANEL_SIZE;
  const cropY = Math.floor((decoded.height - cropSize) / 2);

  return states.map((state, panelIndex) => {
    const data = new Uint8Array(cropSize * cropSize * 4);
    const sourceX = panelIndex * panelWidth +
      Math.floor((panelWidth - cropSize) / 2);

    for (let row = 0; row < cropSize; row += 1) {
      const sourceOffset = ((cropY + row) * decoded.width + sourceX) * 4;
      const targetOffset = row * cropSize * 4;
      data.set(
        rgba.subarray(sourceOffset, sourceOffset + cropSize * 4),
        targetOffset,
      );
    }

    const encoded = encodePng({
      width: cropSize,
      height: cropSize,
      data,
      channels: 4,
      depth: 8,
    }, { zlib: { level: 6 } });

    return {
      state,
      bytes: new Uint8Array(encoded),
      width: cropSize,
      height: cropSize,
    };
  });
};
