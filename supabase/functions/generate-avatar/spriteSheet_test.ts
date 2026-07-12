import { assertEquals, assertMatch, assertThrows } from "jsr:@std/assert@1";
import { decode, encode } from "npm:fast-png@7";

import {
  buildPoseSheetLayoutPrompt,
  type PoseSheetPanel,
  splitPoseSheet,
  validatePoseSheetPanels,
} from "./spriteSheet.ts";

const WIDTH = 1536;
const HEIGHT = 1024;
const PANEL_COLORS = [
  [220, 80, 90, 255],
  [80, 180, 110, 255],
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
): PoseSheetPanel => {
  const size = 512;
  const data = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      data.set([0, 255, 0, 255], offset);
    }
  }

  for (let y = 130; y < 400; y += 1) {
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

Deno.test("splitPoseSheet crops one centered square asset per ordered state", () => {
  const states = ["idle", "happy", "sleep"] as const;
  const panels = splitPoseSheet(makeThreePanelPng(), states);

  assertEquals(panels.map((panel) => panel.state), [...states]);
  assertEquals(panels.map((panel) => [panel.width, panel.height]), [
    [512, 512],
    [512, 512],
    [512, 512],
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
