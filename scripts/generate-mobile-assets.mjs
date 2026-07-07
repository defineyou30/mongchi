import { deflateSync } from "node:zlib";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PNG } from "pngjs";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const regenerateGameItems = /^(true|1|yes)$/i.test(process.env.TINY_PET_REGENERATE_GAME_ITEMS ?? "");
const regenerateGeneratedPets = /^(true|1|yes)$/i.test(process.env.TINY_PET_REGENERATE_GENERATED_PETS ?? "");

const colors = {
  transparent: [0, 0, 0, 0],
  cream: [255, 248, 232, 255],
  sky: [141, 211, 240, 255],
  skyDeep: [74, 169, 217, 255],
  mint: [142, 215, 198, 255],
  leaf: [69, 166, 105, 255],
  apple: [91, 196, 116, 255],
  coral: [255, 126, 112, 255],
  rose: [255, 157, 196, 255],
  yellow: [255, 214, 104, 255],
  ink: [33, 48, 58, 255],
  glass: [244, 254, 255, 170],
  white: [255, 255, 255, 255]
};

const generatedPetStates = [
  "idle",
  "base",
  "happy",
  "sleep",
  "play",
  "hungry",
  "walk_return",
  "treat_reaction",
  "chat_portrait",
  "curious",
  "celebrate",
  "garden_help",
  "seasonal"
];

const happyLikePetStates = new Set(["happy", "play", "treat_reaction", "walk_return", "chat_portrait", "celebrate", "seasonal"]);

const makeCanvas = (width, height, background = colors.transparent) => ({
  width,
  height,
  data: new Uint8ClampedArray(width * height * 4).fill(0).map((_, index) => background[index % 4])
});

const setPixel = (canvas, x, y, color) => {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
    return;
  }

  const target = (Math.floor(y) * canvas.width + Math.floor(x)) * 4;
  const alpha = color[3] / 255;
  const inverseAlpha = 1 - alpha;

  canvas.data[target] = Math.round(color[0] * alpha + canvas.data[target] * inverseAlpha);
  canvas.data[target + 1] = Math.round(color[1] * alpha + canvas.data[target + 1] * inverseAlpha);
  canvas.data[target + 2] = Math.round(color[2] * alpha + canvas.data[target + 2] * inverseAlpha);
  canvas.data[target + 3] = Math.min(255, Math.round(color[3] + canvas.data[target + 3] * inverseAlpha));
};

const rect = (canvas, x, y, width, height, color) => {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      setPixel(canvas, xx, yy, color);
    }
  }
};

const circle = (canvas, centerX, centerY, radius, color) => {
  const startX = Math.floor(centerX - radius);
  const endX = Math.ceil(centerX + radius);
  const startY = Math.floor(centerY - radius);
  const endY = Math.ceil(centerY + radius);
  const radiusSquared = radius * radius;

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const distanceSquared = (x - centerX) ** 2 + (y - centerY) ** 2;

      if (distanceSquared <= radiusSquared) {
        setPixel(canvas, x, y, color);
      }
    }
  }
};

const roundedRect = (canvas, x, y, width, height, radius, color) => {
  rect(canvas, x + radius, y, width - radius * 2, height, color);
  rect(canvas, x, y + radius, width, height - radius * 2, color);
  circle(canvas, x + radius, y + radius, radius, color);
  circle(canvas, x + width - radius - 1, y + radius, radius, color);
  circle(canvas, x + radius, y + height - radius - 1, radius, color);
  circle(canvas, x + width - radius - 1, y + height - radius - 1, radius, color);
};

const strokeCircle = (canvas, centerX, centerY, radius, thickness, color, minY = -Infinity) => {
  const outer = radius * radius;
  const inner = (radius - thickness) * (radius - thickness);

  for (let y = Math.floor(centerY - radius); y <= Math.ceil(centerY + radius); y += 1) {
    for (let x = Math.floor(centerX - radius); x <= Math.ceil(centerX + radius); x += 1) {
      const distanceSquared = (x - centerX) ** 2 + (y - centerY) ** 2;

      if (y >= minY && distanceSquared <= outer && distanceSquared >= inner) {
        setPixel(canvas, x, y, color);
      }
    }
  }
};

const scalePoint = (size, value) => Math.round((value / 1024) * size);

const drawTerrariumMark = (canvas, bounds, options = {}) => {
  const { x, y, size } = bounds;
  const s = (value) => x + scalePoint(size, value);
  const t = (value) => y + scalePoint(size, value);
  const l = (value) => scalePoint(size, value);
  const groundY = t(640);

  roundedRect(canvas, s(122), t(142), l(780), l(780), l(120), colors.sky);
  circle(canvas, s(780), t(232), l(76), colors.yellow);
  circle(canvas, s(284), t(320), l(34), colors.white);
  circle(canvas, s(338), t(322), l(26), colors.white);
  rect(canvas, s(286), t(298), l(92), l(46), colors.white);
  circle(canvas, s(512), t(540), l(310), colors.glass);
  strokeCircle(canvas, s(512), t(540), l(314), l(10), [255, 255, 255, 210], t(205));
  roundedRect(canvas, s(240), groundY, l(544), l(180), l(46), colors.mint);
  rect(canvas, s(240), t(746), l(544), l(44), colors.apple);
  circle(canvas, s(338), t(724), l(54), colors.yellow);
  roundedRect(canvas, s(618), t(620), l(112), l(112), l(22), [255, 179, 107, 255]);
  rect(canvas, s(618), t(604), l(112), l(32), colors.coral);
  circle(canvas, s(512), t(576), l(104), colors.white);
  circle(canvas, s(512), t(576), l(82), colors.coral);
  circle(canvas, s(462), t(500), l(28), colors.coral);
  circle(canvas, s(562), t(500), l(28), colors.coral);
  roundedRect(canvas, s(472), t(560), l(80), l(48), l(24), [255, 240, 220, 225]);
  circle(canvas, s(650), t(724), l(34), colors.skyDeep);

  if (options.badge) {
    circle(canvas, s(778), t(778), l(90), colors.white);
    circle(canvas, s(778), t(778), l(68), colors.leaf);
    circle(canvas, s(778), t(778), l(26), colors.yellow);
  }
};

const makeAppIcon = () => {
  const canvas = makeCanvas(1024, 1024, colors.cream);
  drawTerrariumMark(canvas, { x: 0, y: 0, size: 1024 }, { badge: true });
  return canvas;
};

const makeAdaptiveIcon = () => {
  const canvas = makeCanvas(1024, 1024, colors.transparent);
  drawTerrariumMark(canvas, { x: 96, y: 96, size: 832 });
  return canvas;
};

const makeSplash = () => {
  const canvas = makeCanvas(1290, 2796, colors.cream);
  drawTerrariumMark(canvas, { x: 228, y: 912, size: 834 });
  return canvas;
};

const spriteBlock = (canvas, x, y, width, height, color) => {
  rect(canvas, Math.round(x / 2) * 2, Math.round(y / 2) * 2, Math.max(2, Math.round(width / 2) * 2), Math.max(2, Math.round(height / 2) * 2), color);
};

const spriteBlocks = (canvas, blocks, color) => {
  for (const [x, y, width, height] of blocks) {
    spriteBlock(canvas, x, y, width, height, color);
  }
};

const pixelEllipse = (canvas, centerX, centerY, radiusX, radiusY, color, step = 4) => {
  for (let y = Math.floor((centerY - radiusY) / step) * step; y <= centerY + radiusY; y += step) {
    for (let x = Math.floor((centerX - radiusX) / step) * step; x <= centerX + radiusX; x += step) {
      const middleX = x + step / 2;
      const middleY = y + step / 2;
      const distance = ((middleX - centerX) / radiusX) ** 2 + ((middleY - centerY) / radiusY) ** 2;

      if (distance <= 1) {
        rect(canvas, x, y, step, step, color);
      }
    }
  }
};

const pixelLine = (canvas, startX, startY, endX, endY, thickness, color, step = 4) => {
  const steps = Math.ceil(Math.max(Math.abs(endX - startX), Math.abs(endY - startY)) / step);

  for (let index = 0; index <= steps; index += 1) {
    const amount = steps === 0 ? 0 : index / steps;
    spriteBlock(canvas, startX + (endX - startX) * amount, startY + (endY - startY) * amount, thickness, thickness, color);
  }
};

const pixelSparkle = (canvas, x, y, color = [255, 248, 206, 220]) => {
  spriteBlock(canvas, x, y - 10, 4, 8, color);
  spriteBlock(canvas, x, y + 6, 4, 8, color);
  spriteBlock(canvas, x - 10, y, 8, 4, color);
  spriteBlock(canvas, x + 6, y, 8, 4, color);
  spriteBlock(canvas, x - 2, y - 2, 8, 8, [255, 255, 255, Math.min(255, color[3] + 18)]);
};

const drawPixelBall = (canvas, centerX, centerY, radius = 24) => {
  pixelEllipse(canvas, centerX, centerY, radius + 4, radius + 4, [70, 62, 55, 170], 4);
  pixelEllipse(canvas, centerX, centerY, radius, radius, [66, 151, 206, 255], 4);
  spriteBlocks(canvas, [
    [centerX - radius, centerY - 8, radius * 2, 16],
    [centerX - radius + 4, centerY + 8, radius * 2 - 8, 10]
  ], [255, 211, 88, 255]);
  spriteBlocks(canvas, [
    [centerX - 4, centerY - radius, 16, radius * 2],
    [centerX + 12, centerY - radius + 8, 8, radius * 2 - 16]
  ], [245, 103, 94, 255]);
  spriteBlocks(canvas, [
    [centerX - radius + 10, centerY - radius + 8, 14, 10],
    [centerX + radius - 14, centerY + radius - 18, 8, 8]
  ], [255, 255, 255, 128]);
  pixelLine(canvas, centerX - radius, centerY + radius - 4, centerX + radius - 4, centerY + radius - 8, 5, [42, 103, 142, 120], 4);
};

const drawPixelFurClusters = (canvas, clusters, palette) => {
  for (const [x, y, width, height, tone = 0] of clusters) {
    spriteBlock(canvas, x, y, width, height, palette[tone]);
  }
};

const drawSoftHighlight = (canvas, x, y, radiusX, radiusY, alpha = 105) => {
  softEllipse(canvas, x, y, radiusX, radiusY, [255, 255, 246, alpha], 6);
};

const drawSoftHeart = (canvas, x, y, scale = 1, color = colors.rose) => {
  circle(canvas, x - 7 * scale, y - 3 * scale, 7 * scale, color);
  circle(canvas, x + 7 * scale, y - 3 * scale, 7 * scale, color);
  triangle(canvas, x - 15 * scale, y, x + 15 * scale, y, x, y + 18 * scale, color);
  drawSoftHighlight(canvas, x - 5 * scale, y - 6 * scale, 4 * scale, 3 * scale, 92);
};

const drawSoftToyBall = (canvas, centerX, centerY, radius = 24) => {
  softEllipse(canvas, centerX + 5, centerY + radius * 0.74, radius * 0.95, radius * 0.28, [35, 70, 58, 70], 7);
  circle(canvas, centerX, centerY, radius + 2, [84, 98, 108, 190]);
  circle(canvas, centerX, centerY, radius, [88, 174, 222, 255]);
  ellipse(canvas, centerX - radius * 0.34, centerY, radius * 0.5, radius * 0.96, [255, 213, 94, 255]);
  ellipse(canvas, centerX + radius * 0.46, centerY, radius * 0.36, radius * 0.94, [244, 104, 100, 255]);
  line(canvas, centerX - radius * 0.92, centerY + radius * 0.12, centerX + radius * 0.86, centerY - radius * 0.08, 3, [62, 105, 126, 150]);
  drawSoftHighlight(canvas, centerX - radius * 0.35, centerY - radius * 0.42, radius * 0.28, radius * 0.18, 130);
};

const drawSoftSmallBone = (canvas, centerX, centerY, scale = 1) => {
  const fill = [255, 246, 224, 255];
  const shade = [206, 143, 78, 150];
  const outline = [146, 92, 52, 145];

  line(canvas, centerX - 23 * scale, centerY, centerX + 23 * scale, centerY, 15 * scale, outline);
  line(canvas, centerX - 22 * scale, centerY, centerX + 22 * scale, centerY, 12 * scale, fill);
  for (const side of [-1, 1]) {
    circle(canvas, centerX + side * 28 * scale, centerY - 9 * scale, 10 * scale, outline);
    circle(canvas, centerX + side * 28 * scale, centerY + 9 * scale, 10 * scale, outline);
    circle(canvas, centerX + side * 28 * scale, centerY - 9 * scale, 8 * scale, fill);
    circle(canvas, centerX + side * 28 * scale, centerY + 9 * scale, 8 * scale, fill);
  }
  line(canvas, centerX - 14 * scale, centerY + 7 * scale, centerX + 16 * scale, centerY + 5 * scale, 2 * scale, shade);
  drawSoftHighlight(canvas, centerX - 8 * scale, centerY - 7 * scale, 12 * scale, 4 * scale, 120);
};

const drawSoftSmallBowl = (canvas, x, y, scale = 1) => {
  softEllipse(canvas, x + 30 * scale, y + 34 * scale, 34 * scale, 9 * scale, [35, 70, 58, 64], 6);
  ellipse(canvas, x + 30 * scale, y + 19 * scale, 34 * scale, 11 * scale, [116, 69, 48, 210]);
  roundedRect(canvas, x, y + 18 * scale, 60 * scale, 28 * scale, 14 * scale, [218, 92, 76, 255]);
  ellipse(canvas, x + 30 * scale, y + 18 * scale, 34 * scale, 11 * scale, [255, 179, 147, 255]);
  ellipse(canvas, x + 30 * scale, y + 17 * scale, 23 * scale, 7 * scale, [105, 70, 50, 240]);
  circle(canvas, x + 20 * scale, y + 12 * scale, 5 * scale, [255, 234, 202, 255]);
  circle(canvas, x + 31 * scale, y + 10 * scale, 5 * scale, [255, 234, 202, 255]);
  circle(canvas, x + 42 * scale, y + 13 * scale, 4 * scale, [255, 234, 202, 255]);
  drawSoftHighlight(canvas, x + 20 * scale, y + 25 * scale, 18 * scale, 4 * scale, 105);
};

const drawSoftSmallWateringCan = (canvas, x, y, scale = 1) => {
  const body = [96, 191, 203, 255];
  const shade = [52, 130, 151, 210];

  softEllipse(canvas, x + 23 * scale, y + 42 * scale, 38 * scale, 8 * scale, [35, 70, 58, 62], 6);
  roundedRect(canvas, x, y + 18 * scale, 46 * scale, 30 * scale, 14 * scale, body);
  ellipse(canvas, x + 25 * scale, y + 18 * scale, 24 * scale, 8 * scale, [161, 229, 226, 255]);
  strokeEllipse(canvas, x + 48 * scale, y + 31 * scale, 17 * scale, 16 * scale, 5 * scale, shade);
  line(canvas, x + 4 * scale, y + 27 * scale, x - 18 * scale, y + 16 * scale, 9 * scale, body);
  line(canvas, x - 18 * scale, y + 16 * scale, x - 28 * scale, y + 10 * scale, 6 * scale, [139, 221, 221, 255]);
  circle(canvas, x - 34 * scale, y + 5 * scale, 2.5 * scale, colors.skyDeep);
  circle(canvas, x - 44 * scale, y + 1 * scale, 2 * scale, colors.skyDeep);
  drawSoftHighlight(canvas, x + 18 * scale, y + 24 * scale, 17 * scale, 5 * scale, 110);
};

const drawSoftGiftSmall = (canvas, x, y, scale = 1) => {
  softEllipse(canvas, x + 30 * scale, y + 48 * scale, 34 * scale, 8 * scale, [35, 70, 58, 60], 5);
  roundedRect(canvas, x, y + 18 * scale, 60 * scale, 42 * scale, 10 * scale, colors.coral);
  roundedRect(canvas, x - 5 * scale, y + 8 * scale, 70 * scale, 18 * scale, 9 * scale, [255, 152, 130, 255]);
  rect(canvas, x + 27 * scale, y + 8 * scale, 10 * scale, 52 * scale, colors.yellow);
  rect(canvas, x, y + 32 * scale, 60 * scale, 9 * scale, colors.yellow);
  strokeEllipse(canvas, x + 22 * scale, y + 8 * scale, 12 * scale, 9 * scale, 4 * scale, colors.yellow);
  strokeEllipse(canvas, x + 42 * scale, y + 8 * scale, 12 * scale, 9 * scale, 4 * scale, colors.yellow);
  drawSoftHighlight(canvas, x + 18 * scale, y + 19 * scale, 18 * scale, 5 * scale, 115);
};

const drawMisoPet = (canvas, options = {}) => {
  const { state = "idle" } = options;
  const base = state === "base";
  const happy = happyLikePetStates.has(state);
  const sleep = state === "sleep";
  const play = state === "play";
  const outline = [112, 74, 52, 188];
  const outlineDeep = [82, 52, 40, 230];
  const fur = sleep ? [238, 221, 195, 255] : [248, 231, 201, 255];
  const furMid = [232, 190, 142, 190];
  const furLight = [255, 247, 225, 255];
  const furBright = [255, 253, 240, 255];
  const patch = [178, 113, 68, 255];
  const patchLight = [211, 147, 93, 210];
  const patchShade = [130, 78, 54, 178];
  const muzzle = [255, 229, 203, 255];
  const blush = happy ? [255, 145, 160, 135] : [245, 158, 144, 82];

  drawGroundedSpriteShadow(canvas, 128, 222, 70, 16);
  drawPetStateBackdrop(canvas, state, "dog");

  if (play) {
    drawSoftToyBall(canvas, 198, 194, 20);
  }

  line(canvas, 174, 154, 202, 136, 13, patchShade);
  line(canvas, 174, 154, 200, 138, 9, patch);
  circle(canvas, 202, 136, 7, patchLight);

  softEllipse(canvas, 128, 166, 64, 54, outline, 7);
  ellipse(canvas, 128, 164, 59, 51, fur);
  softEllipse(canvas, 111, 154, 28, 32, furBright, 5);
  softEllipse(canvas, 151, 169, 28, 34, furMid, 5);
  ellipse(canvas, 100, 170, 20, 32, furLight);
  ellipse(canvas, 156, 170, 20, 32, [234, 190, 139, 230]);
  drawSoftHighlight(canvas, 112, 143, 34, 18, 105);

  ellipse(canvas, 94, 204, 20, 15, outline);
  ellipse(canvas, 162, 204, 20, 15, outline);
  ellipse(canvas, 94, 201, 18, 14, furLight);
  ellipse(canvas, 162, 201, 18, 14, furLight);
  circle(canvas, 88, 208, 2.5, [124, 83, 58, 210]);
  circle(canvas, 100, 209, 2.5, [124, 83, 58, 210]);
  circle(canvas, 156, 209, 2.5, [124, 83, 58, 210]);
  circle(canvas, 168, 208, 2.5, [124, 83, 58, 210]);

  softEllipse(canvas, 76, 105, 34, 53, outline, 6);
  softEllipse(canvas, 181, 105, 34, 53, outline, 6);
  ellipse(canvas, 77, 106, 27, 46, patch);
  ellipse(canvas, 181, 106, 27, 46, patch);
  softEllipse(canvas, 72, 82, 18, 20, patchLight, 4);
  softEllipse(canvas, 185, 82, 18, 20, patchLight, 4);
  ellipse(canvas, 67, 128, 18, 24, patchShade);
  ellipse(canvas, 189, 128, 18, 24, patchShade);

  softEllipse(canvas, 128, 108, 68, 58, outline, 7);
  ellipse(canvas, 128, 105, 60, 53, fur);
  softEllipse(canvas, 138, 94, 45, 35, furBright, 6);
  ellipse(canvas, 103, 105, 26, 32, patch);
  ellipse(canvas, 96, 91, 17, 24, patch);
  softEllipse(canvas, 105, 93, 17, 17, patchLight, 4);
  ellipse(canvas, 116, 66, 15, 16, furBright);
  ellipse(canvas, 132, 63, 18, 17, furBright);
  ellipse(canvas, 148, 68, 15, 14, furBright);
  line(canvas, 92, 126, 82, 138, 3, [156, 99, 68, 100]);
  line(canvas, 163, 128, 174, 139, 3, [156, 99, 68, 92]);
  drawMisoFurDepth(canvas, { sleep, happy });

  if (sleep) {
    line(canvas, 94, 112, 114, 112, 4, outlineDeep);
    line(canvas, 144, 112, 164, 112, 4, outlineDeep);
  } else {
    circle(canvas, 104, 108, 8, outlineDeep);
    circle(canvas, 154, 108, 8, outlineDeep);
    circle(canvas, 107, 105, 2.5, colors.white);
    circle(canvas, 157, 105, 2.5, colors.white);
  }

  ellipse(canvas, 128, 139, 31, 22, muzzle);
  ellipse(canvas, 128, 130, 17, 10, [255, 237, 214, 255]);
  ellipse(canvas, 128, 130, 10, 6, outlineDeep);
  line(canvas, 128, 135, 128, 145, 3, outlineDeep);

  if (sleep) {
    line(canvas, 112, 149, 128, 155, 3, outlineDeep);
    line(canvas, 128, 155, 144, 149, 3, outlineDeep);
  } else if (happy) {
    line(canvas, 112, 148, 128, 156, 4, outlineDeep);
    line(canvas, 128, 156, 144, 148, 4, outlineDeep);
    ellipse(canvas, 128, 154, 12, 5, [255, 155, 150, 220]);
  } else {
    line(canvas, 114, 148, 128, 154, 3, outlineDeep);
    line(canvas, 128, 154, 142, 148, 3, outlineDeep);
  }

  softEllipse(canvas, 88, 131, 11, 7, blush, 4);
  softEllipse(canvas, 168, 131, 11, 7, blush, 4);

  if (base) {
    roundedRect(canvas, 99, 174, 58, 17, 9, [78, 177, 211, 250]);
    roundedRect(canvas, 109, 187, 38, 10, 5, [62, 147, 189, 215]);
    circle(canvas, 128, 188, 6, colors.yellow);
    drawSoftHighlight(canvas, 113, 178, 18, 4, 96);
  }

  if (sleep) {
    roundedRect(canvas, 82, 62, 86, 14, 7, [116, 184, 225, 235]);
    roundedRect(canvas, 92, 76, 66, 8, 4, [170, 216, 238, 210]);
    circle(canvas, 88, 58, 7, [255, 242, 152, 245]);
    line(canvas, 178, 84, 198, 70, 3, colors.skyDeep);
    line(canvas, 198, 70, 186, 96, 3, colors.skyDeep);
    line(canvas, 198, 98, 216, 84, 3, colors.skyDeep);
  }

  if (happy) {
    drawSparkle(canvas, 48, 88, 8, [255, 245, 190, 210]);
    drawSparkle(canvas, 206, 100, 7, [255, 255, 255, 205]);
  }

  drawPetStateOverlay(canvas, state, "dog");
  drawPetGroundPixels(canvas, 128, 220, "dog");
};

const makeMisoPetAsset = (options = {}) => {
  const canvas = makeCanvas(256, 256, colors.transparent);
  drawMisoPet(canvas, options);
  return finishPetSpriteCanvas(canvas);
};

const drawLunaCat = (canvas, options = {}) => {
  const { state = "idle" } = options;
  const base = state === "base";
  const happy = happyLikePetStates.has(state);
  const sleep = state === "sleep";
  const play = state === "play";
  const outline = [84, 68, 104, 190];
  const outlineDeep = [63, 52, 76, 232];
  const fur = sleep ? [220, 210, 230, 255] : [231, 222, 240, 255];
  const furMid = [190, 168, 220, 210];
  const furLight = [255, 245, 238, 255];
  const furBright = [255, 252, 244, 255];
  const lavender = [158, 132, 201, 245];
  const lavenderDark = [105, 82, 146, 210];
  const muzzle = [255, 228, 218, 255];
  const blush = happy ? [255, 140, 186, 135] : [245, 170, 202, 82];

  drawGroundedSpriteShadow(canvas, 128, 222, 68, 16);
  drawPetStateBackdrop(canvas, state, "cat");

  if (play) {
    drawSoftToyBall(canvas, 198, 194, 20);
  }

  line(canvas, 76, 158, 47, 126, 13, outline);
  line(canvas, 47, 126, 38, 101, 8, lavenderDark);
  line(canvas, 74, 160, 54, 190, 9, lavenderDark);
  circle(canvas, 39, 101, 5, furMid);
  circle(canvas, 54, 190, 6, furMid);

  softEllipse(canvas, 128, 166, 62, 52, outline, 7);
  ellipse(canvas, 126, 160, 56, 48, fur);
  softEllipse(canvas, 108, 156, 26, 31, furLight, 5);
  softEllipse(canvas, 153, 168, 26, 34, furMid, 5);
  ellipse(canvas, 100, 171, 19, 31, furLight);
  ellipse(canvas, 155, 171, 19, 31, [197, 172, 222, 230]);
  drawSoftHighlight(canvas, 113, 144, 32, 18, 98);

  ellipse(canvas, 94, 204, 19, 15, outline);
  ellipse(canvas, 162, 204, 19, 15, outline);
  ellipse(canvas, 94, 201, 17, 14, furLight);
  ellipse(canvas, 162, 201, 17, 14, furLight);
  circle(canvas, 88, 209, 2.4, lavenderDark);
  circle(canvas, 100, 210, 2.4, lavenderDark);
  circle(canvas, 156, 210, 2.4, lavenderDark);
  circle(canvas, 168, 209, 2.4, lavenderDark);

  triangle(canvas, 70, 98, 91, 38, 108, 101, outline);
  triangle(canvas, 148, 101, 165, 38, 187, 98, outline);
  triangle(canvas, 77, 93, 91, 52, 101, 96, lavender);
  triangle(canvas, 155, 96, 165, 52, 180, 93, lavender);
  triangle(canvas, 84, 86, 91, 62, 96, 88, [255, 198, 216, 225]);
  triangle(canvas, 160, 88, 165, 62, 173, 86, [255, 198, 216, 225]);

  softEllipse(canvas, 128, 108, 66, 56, outline, 7);
  ellipse(canvas, 128, 106, 58, 51, fur);
  softEllipse(canvas, 137, 96, 44, 35, furBright, 6);
  ellipse(canvas, 103, 107, 27, 32, lavender);
  ellipse(canvas, 100, 125, 23, 20, [174, 147, 207, 210]);
  ellipse(canvas, 154, 112, 23, 27, furMid);
  ellipse(canvas, 116, 66, 14, 15, furBright);
  ellipse(canvas, 132, 62, 17, 16, furBright);
  ellipse(canvas, 149, 68, 14, 14, furBright);
  line(canvas, 92, 128, 82, 138, 3, [126, 94, 160, 100]);
  line(canvas, 164, 128, 174, 139, 3, [126, 94, 160, 92]);
  drawLunaFurDepth(canvas, { sleep, happy });

  if (sleep) {
    line(canvas, 92, 112, 114, 112, 4, outlineDeep);
    line(canvas, 144, 112, 166, 112, 4, outlineDeep);
  } else {
    circle(canvas, 104, 108, 8, outlineDeep);
    circle(canvas, 154, 108, 8, outlineDeep);
    circle(canvas, 107, 105, 2.5, colors.white);
    circle(canvas, 157, 105, 2.5, colors.white);
  }

  ellipse(canvas, 128, 140, 29, 21, muzzle);
  ellipse(canvas, 128, 131, 14, 8, [255, 237, 220, 255]);
  ellipse(canvas, 128, 130, 9, 5, [255, 126, 156, 245]);
  line(canvas, 128, 137, 128, 146, 3, outlineDeep);
  line(canvas, 112, 146, 84, 138, 2.5, outlineDeep);
  line(canvas, 112, 152, 86, 154, 2.5, outlineDeep);
  line(canvas, 144, 146, 172, 138, 2.5, outlineDeep);
  line(canvas, 144, 152, 170, 154, 2.5, outlineDeep);

  if (happy) {
    line(canvas, 112, 150, 128, 157, 4, outlineDeep);
    line(canvas, 128, 157, 144, 150, 4, outlineDeep);
    ellipse(canvas, 128, 155, 12, 5, [255, 162, 190, 230]);
  } else if (sleep) {
    line(canvas, 112, 150, 128, 156, 3, outlineDeep);
    line(canvas, 128, 156, 144, 150, 3, outlineDeep);
  } else {
    line(canvas, 114, 150, 128, 156, 3, outlineDeep);
    line(canvas, 128, 156, 142, 150, 3, outlineDeep);
  }

  softEllipse(canvas, 88, 132, 11, 7, blush, 4);
  softEllipse(canvas, 168, 132, 11, 7, blush, 4);

  if (base) {
    roundedRect(canvas, 99, 174, 58, 17, 9, [78, 177, 211, 250]);
    roundedRect(canvas, 109, 187, 38, 10, 5, [62, 147, 189, 215]);
    circle(canvas, 128, 188, 6, colors.yellow);
    drawSoftHighlight(canvas, 113, 178, 18, 4, 96);
  }

  if (sleep) {
    roundedRect(canvas, 82, 62, 86, 14, 7, [116, 184, 225, 235]);
    roundedRect(canvas, 92, 76, 66, 8, 4, [170, 216, 238, 210]);
    circle(canvas, 88, 58, 7, [255, 242, 152, 245]);
    line(canvas, 178, 84, 198, 70, 3, colors.skyDeep);
    line(canvas, 198, 70, 186, 96, 3, colors.skyDeep);
    line(canvas, 198, 98, 216, 84, 3, colors.skyDeep);
  }

  if (happy) {
    drawSparkle(canvas, 48, 90, 8, [255, 245, 190, 210]);
    drawSparkle(canvas, 206, 102, 7, [255, 255, 255, 205]);
  }

  drawPetStateOverlay(canvas, state, "cat");
  drawPetGroundPixels(canvas, 128, 220, "cat");
};

const makeLunaCatAsset = (options = {}) => {
  const canvas = makeCanvas(256, 256, colors.transparent);
  drawLunaCat(canvas, options);
  return finishPetSpriteCanvas(canvas);
};

const drawSmallBone = (canvas, centerX, centerY, scale = 1) => {
  const fill = [255, 245, 222, 255];
  const outline = [180, 123, 65, 255];
  line(canvas, centerX - 18 * scale, centerY, centerX + 18 * scale, centerY, 11 * scale, outline);
  line(canvas, centerX - 18 * scale, centerY, centerX + 18 * scale, centerY, 7 * scale, fill);
  circle(canvas, centerX - 22 * scale, centerY - 8 * scale, 8 * scale, outline);
  circle(canvas, centerX - 22 * scale, centerY + 8 * scale, 8 * scale, outline);
  circle(canvas, centerX + 22 * scale, centerY - 8 * scale, 8 * scale, outline);
  circle(canvas, centerX + 22 * scale, centerY + 8 * scale, 8 * scale, outline);
  circle(canvas, centerX - 22 * scale, centerY - 8 * scale, 5 * scale, fill);
  circle(canvas, centerX - 22 * scale, centerY + 8 * scale, 5 * scale, fill);
  circle(canvas, centerX + 22 * scale, centerY - 8 * scale, 5 * scale, fill);
  circle(canvas, centerX + 22 * scale, centerY + 8 * scale, 5 * scale, fill);
};

const drawPixelSmallBone = (canvas, centerX, centerY, scale = 1) => {
  const fill = [255, 245, 222, 255];
  const outline = [180, 123, 65, 255];
  const highlight = [255, 255, 246, 150];
  const block = (x, y, width, height, color) =>
    spriteBlock(canvas, centerX + x * scale, centerY + y * scale, width * scale, height * scale, color);

  block(-26, -8, 52, 16, outline);
  block(-18, -6, 36, 12, fill);
  block(-36, -20, 18, 18, outline);
  block(-36, 2, 18, 18, outline);
  block(18, -20, 18, 18, outline);
  block(18, 2, 18, 18, outline);
  block(-32, -16, 10, 10, fill);
  block(-32, 6, 10, 10, fill);
  block(22, -16, 10, 10, fill);
  block(22, 6, 10, 10, fill);
  block(-10, -12, 22, 4, highlight);
};

const drawMiniWateringCan = (canvas, x, y, scale = 1) => {
  roundedRect(canvas, x, y + 12 * scale, 40 * scale, 28 * scale, 10 * scale, [91, 187, 197, 255]);
  ellipse(canvas, x + 25 * scale, y + 11 * scale, 16 * scale, 7 * scale, [130, 218, 220, 255]);
  strokeEllipse(canvas, x + 42 * scale, y + 23 * scale, 15 * scale, 16 * scale, 5 * scale, [70, 151, 164, 255]);
  line(canvas, x + 2 * scale, y + 20 * scale, x - 16 * scale, y + 12 * scale, 7 * scale, [91, 187, 197, 255]);
  circle(canvas, x - 20 * scale, y + 5 * scale, 3 * scale, colors.skyDeep);
  circle(canvas, x - 30 * scale, y, 2 * scale, colors.skyDeep);
};

const drawPixelMiniWateringCan = (canvas, x, y, scale = 1) => {
  const body = [91, 187, 197, 255];
  const light = [130, 218, 220, 255];
  const shade = [62, 138, 154, 255];
  const rim = [48, 105, 122, 255];
  const block = (dx, dy, width, height, color) =>
    spriteBlock(canvas, x + dx * scale, y + dy * scale, width * scale, height * scale, color);

  block(0, 18, 44, 26, rim);
  block(4, 14, 36, 8, light);
  block(4, 20, 36, 20, body);
  block(10, 22, 20, 6, [194, 241, 237, 170]);
  block(30, 30, 10, 10, shade);
  block(38, 22, 18, 8, rim);
  block(48, 16, 10, 16, shade);
  block(-14, 16, 18, 8, rim);
  block(-24, 10, 14, 8, body);
  block(-30, 6, 6, 6, colors.skyDeep);
  block(-40, 0, 4, 4, colors.skyDeep);
  block(18, 6, 10, 10, shade);
};

const drawPetStateBackdrop = (canvas, state, species) => {
  if (state === "chat_portrait") {
    roundedRect(canvas, 154, 48, 64, 36, 17, [255, 255, 255, 230]);
    ellipse(canvas, 166, 88, 15, 8, [255, 255, 255, 224]);
    circle(canvas, 178, 66, 4, species === "cat" ? colors.rose : colors.skyDeep);
    circle(canvas, 193, 66, 4, species === "cat" ? colors.rose : colors.skyDeep);
    circle(canvas, 208, 66, 4, species === "cat" ? colors.rose : colors.skyDeep);
  }

  if (state === "celebrate") {
    for (let index = 0; index < 10; index += 1) {
      const x = 42 + index * 18;
      const y = 54 + (index % 3) * 18;
      circle(canvas, x, y, 3.5, index % 2 === 0 ? colors.coral : colors.yellow);
      ellipse(canvas, x + 8, y + 5, 4, 7, index % 2 === 0 ? colors.skyDeep : colors.rose);
    }
  }

  if (state === "seasonal") {
    softEllipse(canvas, 64, 70, 17, 12, [255, 245, 250, 160], 5);
    softEllipse(canvas, 192, 72, 17, 12, [255, 245, 250, 160], 5);
    drawSparkle(canvas, 64, 70, 6, colors.white);
    drawSparkle(canvas, 192, 72, 6, colors.white);
  }
};

const drawPetStateOverlay = (canvas, state, species) => {
  switch (state) {
    case "hungry":
      drawSoftSmallBowl(canvas, 34, 170, 0.82);
      break;
    case "walk_return":
      roundedRect(canvas, 174, 166, 42, 42, 12, [95, 154, 88, 255]);
      roundedRect(canvas, 182, 154, 28, 18, 9, [255, 196, 92, 255]);
      circle(canvas, 198, 191, 7, colors.yellow);
      drawSoftHighlight(canvas, 188, 172, 16, 5, 96);
      drawLeaf(canvas, 214, 154, 0.74, colors.leaf);
      break;
    case "treat_reaction":
      drawSoftSmallBone(canvas, 198, 164, 0.74);
      drawSoftHeart(canvas, 200, 136, 0.7, colors.rose);
      break;
    case "chat_portrait":
      drawSoftHeart(canvas, 206, 112, 0.7, colors.rose);
      break;
    case "curious":
      ellipse(canvas, 192, 82, 14, 9, colors.skyDeep);
      ellipse(canvas, 216, 82, 14, 9, colors.rose);
      ellipse(canvas, 204, 84, 7, 5, colors.yellow);
      line(canvas, 204, 80, 198, 70, 2, [80, 70, 55, 220]);
      line(canvas, 204, 80, 212, 70, 2, [80, 70, 55, 220]);
      break;
    case "celebrate":
      drawSparkle(canvas, 58, 72, 8, [255, 245, 190, 225]);
      drawSparkle(canvas, 206, 84, 7, [255, 255, 255, 225]);
      drawSoftGiftSmall(canvas, 108, 166, 0.64);
      break;
    case "garden_help":
      drawSoftSmallWateringCan(canvas, 40, 166, 0.76);
      drawLeaf(canvas, 196, 166, 0.8, colors.apple);
      drawFlower(canvas, 210, 150, 0.58, species === "cat" ? colors.rose : colors.white);
      break;
    case "seasonal":
      drawFlower(canvas, 102, 58, 0.54, colors.rose);
      drawFlower(canvas, 128, 52, 0.58, colors.white);
      drawFlower(canvas, 154, 58, 0.54, colors.yellow);
      break;
    default:
      break;
  }
};

const mix = (from, to, amount) => Math.round(from + (to - from) * amount);

const mixColor = (from, to, amount) => [
  mix(from[0], to[0], amount),
  mix(from[1], to[1], amount),
  mix(from[2], to[2], amount),
  mix(from[3], to[3], amount)
];

const verticalGradient = (canvas, topColor, bottomColor) => {
  for (let y = 0; y < canvas.height; y += 1) {
    rect(canvas, 0, y, canvas.width, 1, mixColor(topColor, bottomColor, y / Math.max(1, canvas.height - 1)));
  }
};

const ellipse = (canvas, centerX, centerY, radiusX, radiusY, color) => {
  const startX = Math.floor(centerX - radiusX);
  const endX = Math.ceil(centerX + radiusX);
  const startY = Math.floor(centerY - radiusY);
  const endY = Math.ceil(centerY + radiusY);

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const distance = ((x - centerX) / radiusX) ** 2 + ((y - centerY) / radiusY) ** 2;

      if (distance <= 1) {
        setPixel(canvas, x, y, color);
      }
    }
  }
};

const strokeEllipse = (canvas, centerX, centerY, radiusX, radiusY, thickness, color) => {
  const startX = Math.floor(centerX - radiusX);
  const endX = Math.ceil(centerX + radiusX);
  const startY = Math.floor(centerY - radiusY);
  const endY = Math.ceil(centerY + radiusY);
  const innerX = Math.max(1, radiusX - thickness);
  const innerY = Math.max(1, radiusY - thickness);

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const outerDistance = ((x - centerX) / radiusX) ** 2 + ((y - centerY) / radiusY) ** 2;
      const innerDistance = ((x - centerX) / innerX) ** 2 + ((y - centerY) / innerY) ** 2;

      if (outerDistance <= 1 && innerDistance >= 1) {
        setPixel(canvas, x, y, color);
      }
    }
  }
};

const line = (canvas, startX, startY, endX, endY, thickness, color) => {
  const steps = Math.ceil(Math.max(Math.abs(endX - startX), Math.abs(endY - startY)));

  for (let index = 0; index <= steps; index += 1) {
    const amount = steps === 0 ? 0 : index / steps;
    circle(canvas, startX + (endX - startX) * amount, startY + (endY - startY) * amount, thickness / 2, color);
  }
};

const triangle = (canvas, x1, y1, x2, y2, x3, y3, color) => {
  const minX = Math.floor(Math.min(x1, x2, x3));
  const maxX = Math.ceil(Math.max(x1, x2, x3));
  const minY = Math.floor(Math.min(y1, y2, y3));
  const maxY = Math.ceil(Math.max(y1, y2, y3));
  const area = (x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1);

  if (area === 0) {
    return;
  }

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const edgeA = (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1);
      const edgeB = (x3 - x2) * (y - y2) - (y3 - y2) * (x - x2);
      const edgeC = (x1 - x3) * (y - y3) - (y1 - y3) * (x - x3);

      if ((edgeA >= 0 && edgeB >= 0 && edgeC >= 0) || (edgeA <= 0 && edgeB <= 0 && edgeC <= 0)) {
        setPixel(canvas, x, y, color);
      }
    }
  }
};

const drawCloud = (canvas, x, y, scale = 1, alpha = 190) => {
  const cloud = [255, 255, 255, alpha];
  ellipse(canvas, x + 40 * scale, y + 28 * scale, 44 * scale, 24 * scale, cloud);
  ellipse(canvas, x + 88 * scale, y + 22 * scale, 58 * scale, 28 * scale, cloud);
  ellipse(canvas, x + 142 * scale, y + 30 * scale, 46 * scale, 22 * scale, cloud);
  roundedRect(canvas, x + 28 * scale, y + 24 * scale, 140 * scale, 30 * scale, 16 * scale, cloud);
};

const drawFlower = (canvas, x, y, scale = 1, petalColor = colors.rose) => {
  const stem = [67, 151, 72, 255];
  line(canvas, x, y + 10 * scale, x, y + 24 * scale, 3 * scale, stem);
  circle(canvas, x - 7 * scale, y, 6 * scale, petalColor);
  circle(canvas, x + 7 * scale, y, 6 * scale, petalColor);
  circle(canvas, x, y - 7 * scale, 6 * scale, petalColor);
  circle(canvas, x, y + 7 * scale, 6 * scale, petalColor);
  circle(canvas, x, y, 5 * scale, colors.yellow);
};

const drawSparkle = (canvas, x, y, size, color = colors.white) => {
  triangle(canvas, x, y - size, x - size / 3, y, x, y + size, color);
  triangle(canvas, x, y - size, x + size / 3, y, x, y + size, color);
  triangle(canvas, x - size, y, x, y - size / 3, x + size, y, color);
  triangle(canvas, x - size, y, x, y + size / 3, x + size, y, color);
};

const softCircle = (canvas, x, y, radius, color, layers = 8) => {
  for (let layer = layers; layer >= 1; layer -= 1) {
    const amount = layer / layers;
    circle(canvas, x, y, radius * amount, [color[0], color[1], color[2], Math.round(color[3] * (1 - amount * 0.72))]);
  }
};

const softEllipse = (canvas, x, y, radiusX, radiusY, color, layers = 8) => {
  for (let layer = layers; layer >= 1; layer -= 1) {
    const amount = layer / layers;
    ellipse(canvas, x, y, radiusX * amount, radiusY * amount, [
      color[0],
      color[1],
      color[2],
      Math.round(color[3] * (1 - amount * 0.68))
    ]);
  }
};

const drawTinyStarfield = (canvas, points) => {
  for (const [x, y, size, alpha = 190] of points) {
    drawSparkle(canvas, x, y, size, [255, 248, 206, alpha]);
  }
};

const pixelRect = (canvas, x, y, width, height, color) => {
  rect(canvas, Math.round(x), Math.round(y), Math.max(1, Math.round(width)), Math.max(1, Math.round(height)), color);
};

const drawGroundedSpriteShadow = (canvas, centerX, centerY, radiusX, radiusY) => {
  softEllipse(canvas, centerX, centerY, radiusX, radiusY, [30, 65, 58, 82], 9);
  ellipse(canvas, centerX, centerY + 2, radiusX * 0.58, radiusY * 0.44, [45, 83, 58, 54]);
  pixelRect(canvas, centerX - radiusX * 0.52, centerY + radiusY * 0.12, 9, 3, [255, 245, 197, 58]);
  pixelRect(canvas, centerX + radiusX * 0.26, centerY - radiusY * 0.18, 7, 2, [31, 69, 54, 42]);
};

const drawPetGroundPixels = (canvas, centerX, groundY, species) => {
  const warm = species === "cat" ? [196, 177, 218, 146] : [214, 168, 104, 144];
  const moss = [76, 155, 88, 150];
  pixelRect(canvas, centerX - 52, groundY - 2, 14, 3, moss);
  pixelRect(canvas, centerX + 38, groundY - 3, 12, 3, moss);
  pixelRect(canvas, centerX - 24, groundY + 2, 11, 2, warm);
  pixelRect(canvas, centerX + 12, groundY + 1, 10, 2, warm);
  drawLeaf(canvas, centerX - 58, groundY - 4, 0.44, colors.leaf);
  drawLeaf(canvas, centerX + 54, groundY - 5, 0.4, colors.apple);
};

const drawFurSpeckles = (canvas, points, color) => {
  for (const [x, y, width = 3, height = 2] of points) {
    pixelRect(canvas, x, y, width, height, color);
  }
};

const drawMisoFurDepth = (canvas, { sleep, happy }) => {
  const shade = sleep ? [169, 121, 82, 58] : [168, 111, 70, 66];
  const light = [255, 255, 244, happy ? 118 : 92];
  const warm = [227, 163, 102, 82];

  softEllipse(canvas, 106, 94, 42, 30, [255, 255, 244, 50], 5);
  softEllipse(canvas, 148, 132, 48, 44, [158, 93, 58, 36], 5);
  line(canvas, 88, 140, 100, 132, 2, shade);
  line(canvas, 158, 142, 170, 132, 2, shade);
  line(canvas, 88, 176, 104, 170, 2, warm);
  line(canvas, 153, 176, 170, 170, 2, warm);
  drawFurSpeckles(canvas, [
    [96, 78, 5, 2],
    [112, 68, 4, 2],
    [142, 72, 5, 2],
    [166, 94, 4, 3],
    [82, 116, 4, 2],
    [174, 118, 4, 2],
    [104, 158, 3, 2],
    [148, 160, 3, 2],
    [118, 190, 4, 2],
    [138, 190, 4, 2]
  ], shade);
  drawFurSpeckles(canvas, [
    [96, 88, 6, 2],
    [118, 82, 5, 2],
    [138, 92, 5, 2],
    [104, 132, 5, 2],
    [148, 128, 5, 2],
    [100, 182, 4, 2],
    [154, 182, 4, 2]
  ], light);
};

const drawLunaFurDepth = (canvas, { sleep, happy }) => {
  const shade = sleep ? [119, 96, 142, 56] : [126, 94, 160, 64];
  const light = [255, 255, 246, happy ? 116 : 90];
  const lavenderTint = [190, 167, 222, 76];

  softEllipse(canvas, 106, 96, 40, 30, [255, 255, 246, 48], 5);
  softEllipse(canvas, 154, 130, 44, 42, [114, 85, 145, 34], 5);
  line(canvas, 88, 142, 103, 134, 2, shade);
  line(canvas, 156, 142, 172, 134, 2, shade);
  line(canvas, 88, 176, 104, 170, 2, lavenderTint);
  line(canvas, 154, 176, 172, 168, 2, lavenderTint);
  drawFurSpeckles(canvas, [
    [92, 78, 5, 2],
    [112, 68, 4, 2],
    [144, 72, 5, 2],
    [166, 96, 4, 2],
    [86, 116, 4, 2],
    [174, 118, 4, 2],
    [104, 158, 3, 2],
    [150, 160, 3, 2],
    [118, 190, 4, 2],
    [138, 190, 4, 2]
  ], shade);
  drawFurSpeckles(canvas, [
    [100, 88, 6, 2],
    [121, 82, 5, 2],
    [139, 92, 5, 2],
    [106, 132, 5, 2],
    [148, 128, 5, 2],
    [100, 182, 4, 2],
    [154, 182, 4, 2]
  ], light);
};

const makeTerrariumSkyBackground = () => {
  const canvas = makeCanvas(720, 960, colors.sky);
  verticalGradient(canvas, [115, 204, 244, 255], [219, 246, 248, 255]);
  circle(canvas, 612, 116, 56, [255, 222, 116, 230]);
  drawCloud(canvas, -30, 96, 1.25, 178);
  drawCloud(canvas, 430, 172, 0.9, 168);
  drawCloud(canvas, 84, 282, 0.64, 138);
  ellipse(canvas, 576, 678, 118, 48, [132, 208, 178, 108]);
  ellipse(canvas, 592, 652, 96, 32, [139, 209, 70, 120]);
  ellipse(canvas, 118, 708, 86, 36, [132, 208, 178, 94]);
  ellipse(canvas, 126, 690, 72, 24, [139, 209, 70, 108]);
  drawSparkle(canvas, 130, 164, 10, [255, 255, 255, 190]);
  drawSparkle(canvas, 514, 262, 8, [255, 244, 188, 190]);
  drawSparkle(canvas, 274, 214, 7, [255, 255, 255, 170]);
  return canvas;
};

const makeShopGardenBackground = () => {
  const canvas = makeCanvas(720, 720, colors.sky);
  verticalGradient(canvas, [128, 207, 241, 255], [244, 250, 220, 255]);
  drawCloud(canvas, -24, 58, 0.82, 178);
  drawCloud(canvas, 446, 92, 0.76, 154);
  rect(canvas, 0, 390, 720, 330, [132, 210, 130, 255]);
  ellipse(canvas, 360, 500, 560, 148, [175, 223, 135, 255]);
  ellipse(canvas, 360, 694, 230, 228, [233, 199, 139, 255]);
  ellipse(canvas, 360, 684, 190, 192, [248, 222, 171, 255]);

  for (let x = 34; x <= 684; x += 78) {
    roundedRect(canvas, x, 330, 34, 118, 10, [255, 248, 232, 245]);
    triangle(canvas, x, 330, x + 17, 302, x + 34, 330, [255, 248, 232, 245]);
  }

  rect(canvas, 0, 354, 720, 18, [255, 248, 232, 230]);
  rect(canvas, 0, 420, 720, 18, [255, 248, 232, 230]);

  for (let x = 56; x <= 650; x += 72) {
    drawFlower(canvas, x, 438 + ((x / 72) % 2) * 26, 1.1, colors.rose);
    drawFlower(canvas, x + 32, 488 + ((x / 72) % 2) * 18, 0.86, colors.white);
  }

  roundedRect(canvas, 94, 108, 168, 80, 18, [255, 245, 222, 225]);
  rect(canvas, 94, 108, 168, 34, [255, 127, 123, 235]);
  for (let x = 102; x < 250; x += 38) {
    rect(canvas, x, 108, 18, 34, [255, 248, 232, 235]);
  }
  roundedRect(canvas, 560, 250, 84, 118, 18, [255, 245, 222, 210]);
  ellipse(canvas, 602, 246, 60, 18, [255, 211, 106, 220]);
  return canvas;
};

const drawLeaf = (canvas, x, y, scale = 1, color = colors.leaf) => {
  ellipse(canvas, x, y, 11 * scale, 5 * scale, color);
  ellipse(canvas, x + 6 * scale, y + 1 * scale, 7 * scale, 3 * scale, [255, 255, 255, 54]);
};

const drawVine = (canvas, x, y, height, scale = 1) => {
  line(canvas, x, y, x - 18 * scale, y + height * 0.42, 6 * scale, [72, 129, 54, 255]);
  line(canvas, x - 18 * scale, y + height * 0.42, x + 8 * scale, y + height, 6 * scale, [72, 129, 54, 255]);

  for (let index = 0; index < 8; index += 1) {
    const offsetY = y + 20 * scale + index * 32 * scale;
    const side = index % 2 === 0 ? -1 : 1;
    drawLeaf(canvas, x + side * 18 * scale, offsetY, scale, index % 3 === 0 ? colors.apple : colors.leaf);
  }
};

const drawPebblePath = (canvas, centerX, centerY) => {
  for (let index = 0; index < 12; index += 1) {
    const amount = index / 11;
    const x = centerX - 170 + amount * 340;
    const y = centerY + Math.sin(amount * Math.PI) * 22;
    ellipse(canvas, x, y, 18 - index * 0.4, 9, [221, 196, 145, 180]);
  }
};

const drawTerrariumDomeScene = () => {
  const canvas = makeCanvas(720, 960, colors.sky);
  verticalGradient(canvas, [100, 193, 241, 255], [224, 248, 249, 255]);
  circle(canvas, 606, 112, 58, [255, 225, 116, 238]);
  drawCloud(canvas, -28, 84, 1.18, 184);
  drawCloud(canvas, 456, 180, 0.88, 172);
  drawCloud(canvas, 84, 280, 0.64, 142);

  ellipse(canvas, 360, 770, 292, 84, [51, 91, 86, 42]);
  ellipse(canvas, 360, 736, 272, 70, [69, 126, 92, 116]);
  ellipse(canvas, 360, 704, 282, 64, [133, 215, 162, 255]);
  roundedRect(canvas, 112, 652, 496, 92, 44, [145, 220, 190, 255]);
  rect(canvas, 138, 730, 444, 34, [71, 157, 84, 255]);
  ellipse(canvas, 360, 646, 252, 42, [170, 232, 176, 190]);

  ellipse(canvas, 256, 690, 70, 30, [93, 188, 222, 220]);
  line(canvas, 214, 690, 296, 676, 8, [171, 125, 74, 255]);
  line(canvas, 218, 704, 298, 690, 6, [128, 86, 56, 255]);
  drawPebblePath(canvas, 386, 674);

  roundedRect(canvas, 438, 554, 42, 138, 20, [117, 171, 103, 255]);
  circle(canvas, 354, 548, 86, [130, 202, 70, 255]);
  circle(canvas, 410, 572, 58, [112, 183, 75, 255]);
  circle(canvas, 300, 584, 52, [143, 210, 92, 255]);
  for (let x = 210; x <= 512; x += 42) {
    drawFlower(canvas, x, 620 + ((x / 42) % 2) * 16, 0.72, x % 84 === 0 ? colors.rose : [255, 171, 107, 255]);
  }

  ellipse(canvas, 360, 548, 286, 350, [241, 254, 255, 76]);
  strokeEllipse(canvas, 360, 548, 288, 352, 8, [255, 255, 255, 205]);
  strokeEllipse(canvas, 360, 548, 268, 332, 2, [196, 240, 252, 120]);
  roundedRect(canvas, 202, 296, 76, 250, 38, [255, 255, 255, 54]);
  roundedRect(canvas, 238, 290, 20, 256, 10, [255, 255, 255, 34]);

  ellipse(canvas, 360, 332, 160, 22, [198, 134, 66, 255]);
  ellipse(canvas, 360, 320, 132, 18, [246, 201, 120, 255]);
  roundedRect(canvas, 318, 264, 84, 58, 20, [159, 104, 58, 255]);
  ellipse(canvas, 360, 262, 76, 18, [237, 187, 104, 255]);
  rect(canvas, 350, 216, 20, 52, [118, 81, 54, 255]);
  ellipse(canvas, 360, 214, 64, 14, [210, 155, 84, 255]);

  drawVine(canvas, 516, 254, 270, 1.02);
  drawVine(canvas, 558, 286, 210, 0.82);
  drawSparkle(canvas, 164, 246, 9, [255, 255, 255, 206]);
  drawSparkle(canvas, 534, 422, 7, [255, 244, 188, 210]);
  drawSparkle(canvas, 464, 314, 5, [255, 255, 255, 180]);
  drawSparkle(canvas, 226, 570, 6, [255, 244, 188, 180]);
  return canvas;
};

const drawTerrariumDomeSceneV4 = () => {
  const canvas = makeCanvas(720, 960, colors.sky);
  verticalGradient(canvas, [91, 196, 242, 255], [232, 250, 247, 255]);
  softCircle(canvas, 606, 104, 112, [255, 223, 116, 110], 10);
  circle(canvas, 606, 104, 54, [255, 225, 116, 242]);
  drawCloud(canvas, -36, 72, 1.22, 184);
  drawCloud(canvas, 430, 158, 0.94, 174);
  drawCloud(canvas, 96, 276, 0.62, 138);
  drawCloud(canvas, 500, 566, 0.42, 84);

  softEllipse(canvas, 360, 804, 292, 72, [38, 75, 82, 82], 9);
  triangle(canvas, 146, 704, 574, 704, 468, 840, [102, 115, 91, 220]);
  triangle(canvas, 182, 706, 532, 706, 386, 842, [129, 143, 102, 210]);
  ellipse(canvas, 360, 730, 286, 70, [77, 139, 95, 130]);
  ellipse(canvas, 360, 694, 300, 62, [151, 219, 165, 255]);
  roundedRect(canvas, 118, 638, 484, 104, 48, [164, 229, 184, 255]);
  rect(canvas, 138, 726, 444, 34, [80, 163, 92, 255]);
  ellipse(canvas, 360, 622, 236, 48, [190, 238, 184, 214]);

  softCircle(canvas, 356, 604, 108, [255, 215, 112, 118], 10);
  ellipse(canvas, 356, 626, 120, 32, [255, 223, 126, 188]);
  ellipse(canvas, 356, 620, 82, 18, [255, 249, 214, 210]);
  strokeEllipse(canvas, 356, 620, 92, 24, 3, [230, 160, 72, 210]);

  roundedRect(canvas, 488, 548, 38, 122, 19, [106, 168, 103, 255]);
  circle(canvas, 354, 520, 78, [139, 209, 81, 255]);
  circle(canvas, 415, 548, 56, [119, 190, 77, 255]);
  circle(canvas, 292, 562, 50, [154, 220, 98, 255]);
  for (let x = 194; x <= 518; x += 38) {
    drawFlower(canvas, x, 626 + ((x / 38) % 2) * 18, 0.76, x % 76 === 0 ? colors.rose : [255, 176, 112, 255]);
  }

  ellipse(canvas, 246, 680, 70, 28, [103, 190, 224, 226]);
  line(canvas, 206, 684, 292, 670, 8, [166, 119, 74, 255]);
  line(canvas, 210, 698, 296, 684, 6, [124, 82, 55, 255]);
  drawPebblePath(canvas, 430, 672);

  ellipse(canvas, 360, 548, 306, 364, [242, 255, 255, 84]);
  strokeEllipse(canvas, 360, 548, 306, 364, 9, [255, 255, 255, 216]);
  strokeEllipse(canvas, 360, 548, 284, 340, 2, [187, 234, 252, 138]);
  strokeEllipse(canvas, 360, 548, 248, 304, 1, [255, 255, 255, 72]);
  roundedRect(canvas, 188, 292, 80, 266, 40, [255, 255, 255, 58]);
  roundedRect(canvas, 226, 286, 22, 272, 11, [255, 255, 255, 36]);
  roundedRect(canvas, 506, 316, 18, 234, 9, [255, 255, 255, 28]);

  ellipse(canvas, 360, 328, 170, 24, [184, 119, 62, 255]);
  ellipse(canvas, 360, 316, 140, 19, [247, 203, 126, 255]);
  roundedRect(canvas, 316, 258, 88, 60, 20, [154, 98, 56, 255]);
  ellipse(canvas, 360, 256, 78, 18, [235, 184, 102, 255]);
  rect(canvas, 350, 210, 20, 54, [114, 78, 54, 255]);
  ellipse(canvas, 360, 208, 66, 14, [211, 151, 82, 255]);

  drawVine(canvas, 518, 238, 292, 1.04);
  drawVine(canvas, 564, 276, 226, 0.84);
  line(canvas, 604, 240, 604, 384, 3, [96, 71, 50, 210]);
  softCircle(canvas, 604, 398, 58, [255, 208, 88, 92], 8);
  roundedRect(canvas, 584, 362, 40, 62, 12, [116, 82, 54, 240]);
  roundedRect(canvas, 590, 372, 28, 40, 9, [255, 211, 106, 245]);
  strokeEllipse(canvas, 604, 360, 26, 18, 4, [95, 71, 50, 235]);

  drawTinyStarfield(canvas, [
    [166, 240, 9, 210],
    [534, 420, 7, 214],
    [468, 306, 5, 186],
    [226, 570, 6, 190],
    [402, 594, 5, 220],
    [308, 616, 4, 194],
    [570, 512, 4, 172]
  ]);

  for (let index = 0; index < 18; index += 1) {
    const angle = (index / 18) * Math.PI * 2;
    const x = 356 + Math.cos(angle) * (66 + (index % 3) * 8);
    const y = 606 + Math.sin(angle) * (30 + (index % 2) * 10);
    circle(canvas, x, y, index % 2 === 0 ? 3 : 2, [255, 245, 190, 170]);
  }

  return canvas;
};

const drawShopShelfScene = () => {
  const canvas = makeCanvas(720, 720, colors.sky);
  verticalGradient(canvas, [118, 203, 241, 255], [247, 248, 222, 255]);
  drawCloud(canvas, -28, 62, 0.88, 176);
  drawCloud(canvas, 446, 100, 0.82, 160);
  rect(canvas, 0, 336, 720, 384, [128, 210, 126, 255]);
  ellipse(canvas, 360, 444, 560, 120, [173, 224, 134, 255]);

  for (let x = 34; x <= 684; x += 76) {
    roundedRect(canvas, x, 286, 32, 124, 10, [255, 249, 235, 245]);
    triangle(canvas, x - 3, 286, x + 16, 256, x + 35, 286, [255, 249, 235, 245]);
  }
  rect(canvas, 0, 314, 720, 18, [255, 249, 235, 230]);
  rect(canvas, 0, 382, 720, 18, [255, 249, 235, 230]);

  roundedRect(canvas, 92, 92, 190, 78, 18, [255, 246, 224, 225]);
  rect(canvas, 92, 92, 190, 34, [255, 127, 123, 236]);
  for (let x = 102; x < 270; x += 38) {
    rect(canvas, x, 92, 18, 34, [255, 248, 232, 238]);
  }
  roundedRect(canvas, 552, 218, 78, 126, 18, [255, 244, 218, 218]);
  ellipse(canvas, 591, 216, 58, 18, [255, 211, 106, 224]);

  for (let x = 58; x <= 650; x += 72) {
    drawFlower(canvas, x, 408 + ((x / 72) % 2) * 24, 1, colors.rose);
    drawFlower(canvas, x + 34, 456 + ((x / 72) % 2) * 16, 0.78, colors.white);
  }

  roundedRect(canvas, 74, 346, 572, 308, 24, [136, 87, 51, 255]);
  roundedRect(canvas, 88, 360, 544, 280, 18, [186, 127, 74, 255]);
  rect(canvas, 90, 492, 540, 16, [122, 79, 50, 255]);
  for (let x = 224; x <= 500; x += 138) {
    rect(canvas, x, 360, 14, 280, [122, 79, 50, 255]);
  }
  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      const x = 104 + column * 132;
      const y = 380 + row * 134;
      roundedRect(canvas, x, y, 104, 98, 14, [255, 238, 202, 238]);
      ellipse(canvas, x + 52, y + 78, 42, 10, [116, 73, 45, 52]);
    }
  }
  roundedRect(canvas, 58, 642, 604, 44, 18, [255, 190, 63, 255]);
  roundedRect(canvas, 78, 652, 124, 26, 12, [255, 238, 188, 190]);
  roundedRect(canvas, 520, 652, 124, 26, 12, [255, 238, 188, 190]);
  return canvas;
};

const makeItemIcon = (draw, options = {}) => {
  const { grounded = true, hardAlpha = false } = options;
  const canvas = makeCanvas(160, 160, colors.transparent);

  if (grounded) {
    drawItemBaseShadow(canvas);
  }

  draw(canvas);

  if (grounded) {
    drawItemCollectibleFinish(canvas);
    drawItemGroundPixels(canvas);
  }

  const pixelated = pixelateCanvas(canvas, 2);
  return hardAlpha ? hardenAlphaCanvas(pixelated, 96) : pixelated;
};

const drawItemBaseShadow = (canvas) => {
  softEllipse(canvas, 80, 129, 66, 14, [23, 52, 46, 86], 10);
  softEllipse(canvas, 84, 124, 46, 10, [255, 238, 188, 30], 5);
  ellipse(canvas, 80, 131, 42, 7, [42, 82, 64, 52]);
};

const drawItemCollectibleFinish = (canvas) => {
  softEllipse(canvas, 88, 120, 48, 5, [255, 245, 202, 32], 5);
};

const drawItemGroundPixels = (canvas) => {
  ellipse(canvas, 56, 132, 8, 2.5, [83, 153, 85, 82]);
  ellipse(canvas, 101, 131, 7, 2.5, [83, 153, 85, 76]);
  ellipse(canvas, 74, 134, 5, 2, [225, 188, 120, 58]);
};

const drawToyBallIcon = (canvas) => {
  drawSoftToyBall(canvas, 80, 78, 43);
};

const drawBoneIcon = (canvas) => {
  drawSoftSmallBone(canvas, 80, 82, 1.18);
};

const drawFoodBowlIcon = (canvas) => {
  drawSoftSmallBowl(canvas, 48, 58, 1.08);
};

const drawCoinIcon = (canvas) => {
  softEllipse(canvas, 82, 82, 48, 50, [112, 73, 40, 70], 7);
  ellipse(canvas, 80, 78, 45, 48, [180, 111, 31, 255]);
  ellipse(canvas, 78, 76, 37, 41, [255, 205, 78, 255]);
  strokeEllipse(canvas, 78, 76, 27, 31, 4, [222, 142, 43, 210]);
  line(canvas, 80, 44, 80, 106, 5, [255, 239, 152, 150]);
  drawSoftHighlight(canvas, 66, 56, 16, 9, 135);
};

const drawCushionIcon = (canvas) => {
  softEllipse(canvas, 80, 98, 52, 20, [132, 70, 88, 96], 6);
  roundedRect(canvas, 36, 58, 88, 64, 24, [217, 84, 122, 255]);
  roundedRect(canvas, 43, 65, 74, 48, 19, [255, 154, 196, 255]);
  line(canvas, 50, 70, 112, 106, 3, [255, 241, 218, 130]);
  line(canvas, 112, 70, 50, 106, 3, [255, 241, 218, 120]);
  circle(canvas, 80, 86, 7, colors.yellow);
  drawSoftHighlight(canvas, 68, 66, 32, 6, 116);
};

const drawDoghouseIcon = (canvas) => {
  softEllipse(canvas, 80, 126, 48, 10, [116, 71, 44, 74], 6);
  roundedRect(canvas, 45, 70, 70, 56, 13, [255, 211, 142, 255]);
  triangle(canvas, 34, 74, 80, 34, 126, 74, [206, 83, 64, 255]);
  line(canvas, 38, 74, 122, 74, 9, [170, 72, 56, 220]);
  ellipse(canvas, 80, 106, 17, 24, [82, 55, 42, 255]);
  roundedRect(canvas, 51, 84, 12, 30, 6, [230, 162, 89, 145]);
  roundedRect(canvas, 98, 84, 10, 30, 5, [230, 162, 89, 120]);
  drawSoftHighlight(canvas, 64, 79, 25, 7, 105);
};

const drawFlowerPotIcon = (canvas) => {
  line(canvas, 80, 84, 80, 43, 6, [63, 137, 68, 255]);
  line(canvas, 78, 73, 54, 52, 6, [63, 137, 68, 255]);
  line(canvas, 82, 70, 108, 50, 6, [63, 137, 68, 255]);
  ellipse(canvas, 58, 47, 18, 8, colors.leaf);
  ellipse(canvas, 104, 47, 18, 8, colors.leaf);
  ellipse(canvas, 80, 38, 15, 12, colors.leaf);
  drawFlower(canvas, 80, 36, 0.9, colors.rose);
  ellipse(canvas, 80, 84, 34, 10, [82, 56, 42, 188]);
  roundedRect(canvas, 50, 78, 60, 18, 8, [218, 123, 64, 255]);
  roundedRect(canvas, 56, 94, 48, 30, 9, [190, 103, 55, 255]);
  ellipse(canvas, 80, 124, 26, 7, [143, 79, 49, 210]);
  drawSoftHighlight(canvas, 70, 88, 22, 4, 110);
};

const drawGemIcon = (canvas) => {
  softEllipse(canvas, 80, 122, 34, 8, [103, 59, 148, 75], 5);
  triangle(canvas, 50, 68, 110, 68, 80, 126, [169, 83, 221, 255]);
  triangle(canvas, 50, 68, 65, 46, 80, 68, [244, 153, 229, 255]);
  triangle(canvas, 80, 68, 95, 46, 110, 68, [210, 104, 230, 255]);
  triangle(canvas, 65, 46, 95, 46, 80, 68, [255, 191, 239, 255]);
  triangle(canvas, 64, 70, 80, 124, 80, 70, [121, 64, 190, 150]);
  triangle(canvas, 80, 70, 80, 124, 104, 70, [255, 220, 245, 135]);
  drawSparkle(canvas, 61, 51, 6, [255, 255, 255, 210]);
};

const drawGiftIcon = (canvas) => {
  drawSoftGiftSmall(canvas, 42, 48, 1.18);
};

const drawLanternIcon = (canvas) => {
  line(canvas, 80, 26, 80, 50, 5, [88, 65, 47, 255]);
  softEllipse(canvas, 80, 88, 50, 44, [255, 217, 112, 52], 7);
  roundedRect(canvas, 56, 52, 48, 76, 16, [88, 65, 47, 255]);
  roundedRect(canvas, 63, 61, 34, 58, 13, [255, 205, 94, 255]);
  line(canvas, 80, 58, 80, 121, 5, [116, 79, 52, 220]);
  line(canvas, 61, 80, 99, 80, 5, [116, 79, 52, 190]);
  roundedRect(canvas, 62, 44, 36, 10, 5, [102, 75, 53, 255]);
  roundedRect(canvas, 62, 120, 36, 10, 5, [102, 75, 53, 255]);
  drawSoftHighlight(canvas, 70, 72, 9, 18, 120);
};

const drawWateringCanIcon = (canvas) => {
  drawSoftSmallWateringCan(canvas, 48, 58, 1.15);
};

const drawDrinkWaterBowlIcon = (canvas) => {
  softEllipse(canvas, 80, 121, 54, 12, [36, 77, 83, 76], 7);
  ellipse(canvas, 80, 86, 50, 18, [91, 183, 207, 255]);
  roundedRect(canvas, 34, 82, 92, 38, 19, [86, 190, 212, 255]);
  ellipse(canvas, 80, 82, 50, 17, [218, 251, 255, 255]);
  ellipse(canvas, 80, 80, 38, 11, [82, 175, 216, 255]);
  softEllipse(canvas, 66, 76, 16, 6, [255, 255, 255, 126], 4);
  circle(canvas, 104, 73, 5, [169, 228, 250, 210]);
  circle(canvas, 112, 62, 3, [169, 228, 250, 180]);
  circle(canvas, 99, 55, 3, [169, 228, 250, 170]);
  drawSoftHighlight(canvas, 62, 91, 28, 6, 122);
};

const drawTreatPlateIcon = (canvas) => {
  softEllipse(canvas, 80, 106, 45, 13, [92, 58, 40, 86], 6);
  ellipse(canvas, 80, 86, 43, 18, [255, 226, 196, 255]);
  ellipse(canvas, 80, 82, 38, 13, [255, 247, 232, 255]);
  drawSoftSmallBone(canvas, 72, 72, 0.62);
  circle(canvas, 96, 74, 8, [180, 113, 68, 255]);
  circle(canvas, 98, 72, 3, [255, 246, 224, 170]);
  drawSoftHighlight(canvas, 64, 78, 18, 4, 105);
};

const drawSalmonBitesIcon = (canvas) => {
  softEllipse(canvas, 80, 112, 50, 13, [87, 56, 44, 76], 6);
  ellipse(canvas, 80, 91, 47, 17, [255, 238, 212, 255]);
  ellipse(canvas, 80, 87, 40, 12, [255, 252, 236, 255]);
  for (const [x, y, rotate] of [
    [60, 78, -0.18],
    [80, 72, 0.04],
    [99, 80, 0.14]
  ]) {
    roundedRect(canvas, x - 11, y - 8, 22, 16, 5, [248, 126, 104, 255]);
    line(canvas, x - 8, y - 2, x + 8, y - 5 + rotate * 10, 2, [255, 218, 191, 190]);
  }
  drawSoftHighlight(canvas, 60, 83, 13, 4, 112);
};

const drawChickenJerkyIcon = (canvas) => {
  softEllipse(canvas, 80, 116, 46, 10, [92, 58, 40, 70], 6);
  for (const [x, y, height] of [
    [61, 70, 48],
    [80, 62, 55],
    [99, 72, 43]
  ]) {
    roundedRect(canvas, x - 8, y, 16, height, 8, [207, 112, 62, 255]);
    line(canvas, x - 2, y + 7, x - 2, y + height - 9, 2, [255, 184, 107, 150]);
    line(canvas, x + 5, y + 9, x + 5, y + height - 10, 2, [134, 73, 48, 105]);
  }
  drawSoftHighlight(canvas, 72, 70, 9, 18, 94);
};

const drawPumpkinCookieIcon = (canvas) => {
  softEllipse(canvas, 80, 118, 43, 9, [92, 58, 40, 70], 6);
  ellipse(canvas, 80, 87, 40, 34, [237, 145, 58, 255]);
  ellipse(canvas, 64, 88, 14, 31, [255, 171, 76, 230]);
  ellipse(canvas, 96, 88, 14, 31, [205, 115, 50, 190]);
  line(canvas, 80, 58, 87, 49, 5, [70, 145, 75, 255]);
  circle(canvas, 70, 84, 4, [255, 232, 150, 255]);
  circle(canvas, 91, 94, 4, [255, 232, 150, 255]);
  drawSoftHighlight(canvas, 68, 73, 13, 7, 118);
};

const drawBerryYogurtIcon = (canvas) => {
  softEllipse(canvas, 80, 119, 46, 10, [69, 76, 83, 66], 6);
  roundedRect(canvas, 42, 76, 76, 42, 20, [176, 221, 255, 255]);
  ellipse(canvas, 80, 75, 40, 14, [246, 253, 255, 255]);
  ellipse(canvas, 80, 73, 32, 9, [247, 222, 244, 255]);
  circle(canvas, 68, 70, 7, [143, 91, 205, 255]);
  circle(canvas, 83, 68, 6, [239, 101, 151, 255]);
  circle(canvas, 95, 73, 5, [143, 91, 205, 255]);
  drawSoftHighlight(canvas, 58, 84, 17, 6, 120);
};

const drawSweetPotatoChewIcon = (canvas) => {
  softEllipse(canvas, 80, 120, 48, 10, [83, 57, 39, 72], 6);
  roundedRect(canvas, 47, 74, 66, 28, 14, [198, 109, 45, 255]);
  roundedRect(canvas, 54, 80, 52, 17, 9, [255, 177, 80, 255]);
  circle(canvas, 50, 86, 10, [132, 73, 45, 155]);
  circle(canvas, 111, 88, 9, [132, 73, 45, 140]);
  line(canvas, 60, 94, 102, 80, 3, [255, 229, 159, 150]);
  drawSoftHighlight(canvas, 65, 79, 18, 5, 118);
};

const drawTunaCrunchIcon = (canvas) => {
  softEllipse(canvas, 80, 116, 48, 10, [47, 74, 80, 70], 6);
  for (const [x, y, tone] of [
    [61, 82, 0],
    [84, 72, 1],
    [101, 91, 0]
  ]) {
    ellipse(canvas, x, y, 19, 12, tone ? [91, 174, 199, 255] : [113, 197, 218, 255]);
    triangle(canvas, x + 14, y, x + 29, y - 8, x + 29, y + 8, tone ? [73, 143, 174, 255] : [76, 166, 196, 255]);
    circle(canvas, x - 9, y - 2, 2, [39, 62, 73, 220]);
  }
  drawSoftHighlight(canvas, 58, 77, 8, 3, 115);
};

const drawDuckBiscuitIcon = (canvas) => {
  softEllipse(canvas, 80, 119, 46, 10, [83, 57, 39, 70], 6);
  ellipse(canvas, 80, 92, 39, 28, [245, 195, 88, 255]);
  circle(canvas, 59, 78, 16, [255, 210, 104, 255]);
  triangle(canvas, 43, 79, 28, 74, 28, 86, [248, 138, 64, 255]);
  circle(canvas, 63, 74, 3, [71, 49, 40, 230]);
  ellipse(canvas, 84, 92, 18, 12, [255, 226, 128, 185]);
  drawSoftHighlight(canvas, 69, 82, 15, 6, 118);
};

const drawCheesePuffIcon = (canvas) => {
  softEllipse(canvas, 80, 119, 45, 9, [83, 57, 39, 70], 6);
  triangle(canvas, 47, 104, 112, 57, 112, 113, [255, 209, 85, 255]);
  triangle(canvas, 56, 101, 105, 66, 105, 106, [255, 229, 122, 255]);
  circle(canvas, 91, 84, 6, [222, 162, 55, 220]);
  circle(canvas, 101, 100, 5, [222, 162, 55, 205]);
  circle(canvas, 75, 97, 4, [222, 162, 55, 190]);
  drawSoftHighlight(canvas, 75, 81, 16, 5, 120);
};

const drawAppleBiscuitIcon = (canvas) => {
  softEllipse(canvas, 80, 119, 46, 10, [83, 57, 39, 70], 6);
  circle(canvas, 72, 89, 24, [238, 94, 82, 255]);
  circle(canvas, 90, 89, 24, [238, 94, 82, 255]);
  triangle(canvas, 51, 94, 111, 94, 81, 119, [229, 84, 76, 255]);
  line(canvas, 80, 62, 85, 48, 5, [92, 63, 42, 255]);
  ellipse(canvas, 96, 55, 16, 8, [79, 162, 82, 255]);
  circle(canvas, 72, 88, 5, [255, 217, 125, 255]);
  circle(canvas, 91, 98, 4, [255, 217, 125, 255]);
  drawSoftHighlight(canvas, 65, 74, 11, 6, 120);
};

const drawMilkPupCupIcon = (canvas) => {
  softEllipse(canvas, 80, 120, 42, 9, [68, 68, 88, 68], 6);
  roundedRect(canvas, 50, 62, 60, 58, 14, [115, 198, 226, 255]);
  roundedRect(canvas, 56, 67, 48, 47, 10, [211, 244, 255, 255]);
  ellipse(canvas, 80, 62, 32, 11, [255, 255, 255, 255]);
  circle(canvas, 66, 56, 8, [255, 255, 255, 255]);
  circle(canvas, 80, 52, 10, [255, 255, 255, 255]);
  circle(canvas, 94, 56, 8, [255, 255, 255, 255]);
  drawSoftSmallBone(canvas, 80, 91, 0.42);
  drawSoftHighlight(canvas, 63, 75, 13, 19, 106);
};

const drawPlushToyIcon = (canvas) => {
  softEllipse(canvas, 80, 122, 44, 10, [74, 55, 54, 64], 6);
  circle(canvas, 80, 72, 28, [206, 145, 91, 255]);
  circle(canvas, 56, 58, 12, [190, 124, 76, 255]);
  circle(canvas, 104, 58, 12, [190, 124, 76, 255]);
  ellipse(canvas, 80, 104, 34, 31, [225, 164, 105, 255]);
  ellipse(canvas, 80, 78, 15, 11, [255, 221, 188, 255]);
  circle(canvas, 70, 70, 4, [65, 45, 38, 255]);
  circle(canvas, 90, 70, 4, [65, 45, 38, 255]);
  ellipse(canvas, 80, 80, 5, 3, [65, 45, 38, 255]);
  line(canvas, 80, 84, 80, 91, 2, [65, 45, 38, 190]);
  line(canvas, 72, 92, 80, 96, 2, [65, 45, 38, 160]);
  line(canvas, 80, 96, 88, 92, 2, [65, 45, 38, 160]);
  drawSoftHighlight(canvas, 70, 53, 14, 8, 92);
};

const drawLeafyPlantIcon = (canvas) => {
  line(canvas, 80, 92, 80, 42, 6, [65, 145, 78, 255]);
  ellipse(canvas, 64, 58, 22, 10, colors.leaf);
  ellipse(canvas, 96, 56, 24, 11, colors.apple);
  ellipse(canvas, 78, 38, 18, 12, [95, 190, 103, 255]);
  ellipse(canvas, 72, 74, 26, 10, [72, 157, 82, 255]);
  ellipse(canvas, 100, 76, 24, 10, [92, 184, 96, 255]);
  ellipse(canvas, 80, 91, 34, 10, [82, 56, 42, 188]);
  roundedRect(canvas, 52, 84, 56, 18, 8, [218, 123, 64, 255]);
  roundedRect(canvas, 58, 100, 44, 26, 9, [190, 103, 55, 255]);
  drawSoftHighlight(canvas, 68, 91, 18, 4, 105);
};

const drawSmallLampIcon = (canvas) => {
  softEllipse(canvas, 80, 124, 38, 9, [88, 65, 47, 68], 6);
  roundedRect(canvas, 68, 82, 24, 42, 10, [95, 66, 47, 255]);
  ellipse(canvas, 80, 78, 34, 15, [255, 222, 122, 255]);
  ellipse(canvas, 80, 76, 26, 10, [255, 244, 184, 255]);
  line(canvas, 80, 38, 80, 66, 5, [89, 65, 47, 255]);
  roundedRect(canvas, 62, 36, 36, 14, 7, [128, 88, 55, 255]);
  softEllipse(canvas, 80, 86, 52, 36, [255, 220, 120, 58], 7);
  drawSoftHighlight(canvas, 69, 72, 12, 6, 112);
};

const drawPondTileIcon = (canvas) => {
  softEllipse(canvas, 80, 116, 58, 12, [54, 86, 66, 68], 7);
  ellipse(canvas, 80, 86, 56, 31, [96, 195, 222, 255]);
  ellipse(canvas, 80, 82, 48, 24, [126, 224, 232, 230]);
  for (let index = 0; index < 9; index += 1) {
    const angle = (Math.PI * 2 * index) / 9;
    ellipse(canvas, 80 + Math.cos(angle) * 49, 87 + Math.sin(angle) * 27, 9, 6, [142, 126, 90, 230]);
  }
  ellipse(canvas, 69, 81, 12, 6, colors.leaf);
  ellipse(canvas, 93, 91, 11, 5, colors.apple);
  drawFlower(canvas, 79, 76, 0.54, colors.rose);
  drawSoftHighlight(canvas, 62, 74, 22, 6, 100);
};

const drawSteppingStoneIcon = (canvas) => {
  softEllipse(canvas, 80, 126, 52, 10, [74, 58, 46, 62], 6);
  ellipse(canvas, 54, 92, 23, 13, [191, 177, 145, 255]);
  ellipse(canvas, 86, 78, 26, 15, [216, 201, 166, 255]);
  ellipse(canvas, 108, 102, 24, 14, [176, 160, 130, 255]);
  ellipse(canvas, 76, 112, 24, 13, [205, 190, 154, 255]);
  drawSoftHighlight(canvas, 78, 70, 15, 4, 92);
};

const drawRewardPouchIcon = (canvas) => {
  softEllipse(canvas, 80, 126, 42, 10, [74, 58, 46, 66], 6);
  ellipse(canvas, 80, 86, 41, 45, [214, 145, 78, 255]);
  roundedRect(canvas, 48, 70, 64, 22, 11, [160, 95, 58, 255]);
  line(canvas, 54, 76, 106, 76, 4, [255, 222, 130, 220]);
  circle(canvas, 80, 98, 13, colors.yellow);
  line(canvas, 74, 98, 86, 98, 3, [168, 105, 43, 180]);
  drawSoftHighlight(canvas, 65, 78, 18, 8, 98);
};

const drawSeasonalFlowersIcon = (canvas) => {
  softEllipse(canvas, 80, 125, 44, 10, [54, 86, 66, 62], 6);
  for (const [x, y, color] of [
    [58, 88, colors.rose],
    [80, 72, colors.white],
    [102, 90, colors.yellow],
    [74, 104, [255, 171, 107, 255]],
    [94, 108, colors.lavender]
  ]) {
    drawFlower(canvas, x, y, 0.9, color);
  }
  line(canvas, 60, 116, 106, 116, 7, [73, 151, 76, 255]);
  ellipse(canvas, 80, 116, 42, 9, colors.leaf);
};

const drawPlantStageBaseShadow = (canvas, centerX, y, radiusX, radiusY) => {
  softEllipse(canvas, centerX, y, radiusX, radiusY, [31, 69, 58, 66], 8);
  ellipse(canvas, centerX, y + radiusY * 0.18, radiusX * 0.52, radiusY * 0.38, [48, 86, 70, 36]);
};

const drawTerracottaPotStage = (canvas, centerX, baseY, scale, options = {}) => {
  const { stage = "sprout" } = options;
  const rimY = baseY - 34 * scale;
  const potColor = [210, 112, 65, 255];
  const potShade = [160, 81, 50, 238];
  const potLight = [246, 163, 105, 235];
  const soil = [94, 64, 45, 230];
  const leafDark = [65, 145, 78, 255];
  const leaf = [82, 174, 92, 255];
  const leafLight = [128, 211, 118, 235];

  drawPlantStageBaseShadow(canvas, centerX, baseY - 1 * scale, 33 * scale, 8 * scale);
  ellipse(canvas, centerX, rimY, 31 * scale, 9 * scale, [118, 74, 46, 160]);
  roundedRect(canvas, centerX - 30 * scale, rimY - 2 * scale, 60 * scale, 17 * scale, 8 * scale, potColor);
  roundedRect(canvas, centerX - 24 * scale, rimY + 13 * scale, 48 * scale, 29 * scale, 9 * scale, [188, 97, 55, 255]);
  ellipse(canvas, centerX, rimY + 42 * scale, 25 * scale, 7 * scale, potShade);
  ellipse(canvas, centerX, rimY - 1 * scale, 28 * scale, 7 * scale, soil);
  drawSoftHighlight(canvas, centerX - 11 * scale, rimY + 8 * scale, 18 * scale, 4 * scale, 108);
  line(canvas, centerX + 19 * scale, rimY + 12 * scale, centerX + 15 * scale, rimY + 36 * scale, 4 * scale, potShade);
  line(canvas, centerX - 22 * scale, rimY + 6 * scale, centerX - 13 * scale, rimY + 35 * scale, 3 * scale, potLight);

  if (stage === "seed") {
    ellipse(canvas, centerX - 6 * scale, rimY - 5 * scale, 6 * scale, 3 * scale, [132, 95, 58, 230]);
    line(canvas, centerX + 3 * scale, rimY - 6 * scale, centerX + 5 * scale, rimY - 16 * scale, 3 * scale, leafDark);
    ellipse(canvas, centerX + 10 * scale, rimY - 15 * scale, 8 * scale, 4 * scale, leafLight);
    return;
  }

  line(canvas, centerX, rimY - 3 * scale, centerX, rimY - 38 * scale, 5 * scale, leafDark);
  line(canvas, centerX - 2 * scale, rimY - 14 * scale, centerX - 22 * scale, rimY - 30 * scale, 5 * scale, leafDark);
  line(canvas, centerX + 2 * scale, rimY - 19 * scale, centerX + 24 * scale, rimY - 34 * scale, 5 * scale, leafDark);
  ellipse(canvas, centerX - 23 * scale, rimY - 31 * scale, 17 * scale, 8 * scale, leaf);
  ellipse(canvas, centerX + 25 * scale, rimY - 35 * scale, 18 * scale, 8 * scale, leafLight);

  if (stage === "sprout") {
    ellipse(canvas, centerX, rimY - 42 * scale, 13 * scale, 8 * scale, leafLight);
    return;
  }

  line(canvas, centerX + 1 * scale, rimY - 26 * scale, centerX - 14 * scale, rimY - 53 * scale, 4 * scale, leafDark);
  line(canvas, centerX + 2 * scale, rimY - 29 * scale, centerX + 17 * scale, rimY - 55 * scale, 4 * scale, leafDark);
  ellipse(canvas, centerX - 17 * scale, rimY - 54 * scale, 17 * scale, 9 * scale, [92, 184, 96, 255]);
  ellipse(canvas, centerX + 18 * scale, rimY - 56 * scale, 16 * scale, 9 * scale, [115, 205, 111, 245]);
  ellipse(canvas, centerX, rimY - 44 * scale, 20 * scale, 11 * scale, leafLight);

  if (stage === "bloom") {
    drawFlower(canvas, centerX - 12 * scale, rimY - 62 * scale, 0.55 * scale, colors.rose);
    drawFlower(canvas, centerX + 15 * scale, rimY - 60 * scale, 0.48 * scale, colors.white);
    drawSparkle(canvas, centerX + 31 * scale, rimY - 52 * scale, 4 * scale, [255, 248, 206, 205]);
    drawSparkle(canvas, centerX - 31 * scale, rimY - 41 * scale, 3 * scale, [255, 255, 255, 190]);
  }
};

const drawCloverPlantStage = (canvas, centerX, baseY, scale, options = {}) => {
  const { stage = "leafy" } = options;
  const leafDark = [58, 139, 79, 255];
  const leaf = [87, 183, 96, 255];
  const leafLight = [139, 220, 116, 238];
  const potScale = scale * 0.88;

  drawTerracottaPotStage(canvas, centerX, baseY, potScale, { stage: "seed" });

  if (stage === "sprout") {
    line(canvas, centerX, baseY - 40 * scale, centerX - 8 * scale, baseY - 69 * scale, 4 * scale, leafDark);
    ellipse(canvas, centerX - 14 * scale, baseY - 70 * scale, 14 * scale, 8 * scale, leafLight);
    ellipse(canvas, centerX + 8 * scale, baseY - 66 * scale, 13 * scale, 8 * scale, leaf);
    return;
  }

  const leaves = [
    [-22, -72, 22, 12, leaf],
    [0, -83, 24, 13, leafLight],
    [24, -72, 22, 12, leaf],
    [-14, -55, 22, 11, [76, 166, 88, 255]],
    [16, -54, 22, 11, [112, 202, 102, 245]]
  ];
  line(canvas, centerX, baseY - 38 * scale, centerX, baseY - 82 * scale, 6 * scale, leafDark);
  line(canvas, centerX, baseY - 55 * scale, centerX - 23 * scale, baseY - 74 * scale, 5 * scale, leafDark);
  line(canvas, centerX, baseY - 56 * scale, centerX + 24 * scale, baseY - 74 * scale, 5 * scale, leafDark);

  for (const [dx, dy, rx, ry, color] of leaves) {
    ellipse(canvas, centerX + dx * scale, baseY + dy * scale, rx * scale, ry * scale, color);
  }

  drawSoftHighlight(canvas, centerX - 10 * scale, baseY - 87 * scale, 18 * scale, 6 * scale, 78);

  if (stage === "bloom") {
    drawFlower(canvas, centerX - 23 * scale, baseY - 88 * scale, 0.42 * scale, colors.white);
    drawFlower(canvas, centerX + 22 * scale, baseY - 84 * scale, 0.42 * scale, colors.rose);
    drawSparkle(canvas, centerX + 37 * scale, baseY - 70 * scale, 4 * scale, [255, 248, 206, 190]);
  }
};

const drawSpringPatchStage = (canvas, centerX, baseY, scale, options = {}) => {
  const { stage = "leafy" } = options;
  const mound = [89, 177, 90, 255];
  const moundLight = [140, 218, 116, 235];
  const moundShade = [58, 130, 75, 210];

  drawPlantStageBaseShadow(canvas, centerX, baseY, 55 * scale, 11 * scale);
  ellipse(canvas, centerX, baseY - 13 * scale, 54 * scale, 20 * scale, moundShade);
  ellipse(canvas, centerX, baseY - 20 * scale, 46 * scale, 24 * scale, mound);
  ellipse(canvas, centerX - 18 * scale, baseY - 29 * scale, 26 * scale, 18 * scale, moundLight);
  ellipse(canvas, centerX + 17 * scale, baseY - 31 * scale, 27 * scale, 17 * scale, [113, 202, 104, 238]);
  ellipse(canvas, centerX + 1 * scale, baseY - 43 * scale, 24 * scale, 18 * scale, moundLight);
  drawSoftHighlight(canvas, centerX - 18 * scale, baseY - 41 * scale, 22 * scale, 6 * scale, 70);

  if (stage === "sprout") {
    for (const [dx, dy] of [
      [-24, -43],
      [2, -52],
      [25, -40]
    ]) {
      line(canvas, centerX + dx * scale, baseY + (dy + 12) * scale, centerX + dx * scale, baseY + dy * scale, 3 * scale, moundShade);
      ellipse(canvas, centerX + (dx - 5) * scale, baseY + dy * scale, 8 * scale, 4 * scale, moundLight);
      ellipse(canvas, centerX + (dx + 5) * scale, baseY + (dy - 1) * scale, 8 * scale, 4 * scale, mound);
    }
    return;
  }

  for (const [dx, dy, color] of [
    [-31, -43, colors.rose],
    [-9, -59, colors.white],
    [18, -56, colors.yellow],
    [36, -39, [255, 174, 108, 255]]
  ]) {
    line(canvas, centerX + dx * scale, baseY - 33 * scale, centerX + dx * scale, baseY + dy * scale, 3 * scale, moundShade);
    if (stage === "bloom") {
      drawFlower(canvas, centerX + dx * scale, baseY + dy * scale, 0.45 * scale, color);
    } else {
      circle(canvas, centerX + dx * scale, baseY + dy * scale, 4 * scale, [255, 218, 154, 220]);
    }
  }

  if (stage === "bloom") {
    drawSparkle(canvas, centerX + 46 * scale, baseY - 58 * scale, 5 * scale, [255, 248, 206, 200]);
    drawSparkle(canvas, centerX - 44 * scale, baseY - 48 * scale, 4 * scale, [255, 255, 255, 178]);
  }
};

const makePlantStageAsset = ({ width, height, draw }) => {
  const canvas = makeCanvas(width, height, colors.transparent);
  draw(canvas, width / 2, height - 14, Math.min(width, height) / 96);
  return canvas;
};

const sampleBilinear = (source, x, y, channel) => {
  const x0 = Math.max(0, Math.min(source.width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(source.height - 1, Math.floor(y)));
  const x1 = Math.max(0, Math.min(source.width - 1, x0 + 1));
  const y1 = Math.max(0, Math.min(source.height - 1, y0 + 1));
  const tx = Math.max(0, Math.min(1, x - x0));
  const ty = Math.max(0, Math.min(1, y - y0));
  const topLeft = source.data[(y0 * source.width + x0) * 4 + channel];
  const topRight = source.data[(y0 * source.width + x1) * 4 + channel];
  const bottomLeft = source.data[(y1 * source.width + x0) * 4 + channel];
  const bottomRight = source.data[(y1 * source.width + x1) * 4 + channel];
  const top = topLeft * (1 - tx) + topRight * tx;
  const bottom = bottomLeft * (1 - tx) + bottomRight * tx;

  return Math.round(top * (1 - ty) + bottom * ty);
};

const resizeCanvasSmooth = (source, width, height) => {
  const canvas = makeCanvas(width, height, colors.transparent);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX = (x + 0.5) * (source.width / width) - 0.5;
      const sourceY = (y + 0.5) * (source.height / height) - 0.5;
      setPixel(canvas, x, y, [
        sampleBilinear(source, sourceX, sourceY, 0),
        sampleBilinear(source, sourceX, sourceY, 1),
        sampleBilinear(source, sourceX, sourceY, 2),
        sampleBilinear(source, sourceX, sourceY, 3)
      ]);
    }
  }

  return canvas;
};

const resizeCanvasNearest = (source, width, height) => {
  const canvas = makeCanvas(width, height, colors.transparent);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.max(0, Math.min(source.width - 1, Math.floor((x / width) * source.width)));
      const sourceY = Math.max(0, Math.min(source.height - 1, Math.floor((y / height) * source.height)));
      const sourceIndex = (sourceY * source.width + sourceX) * 4;
      setPixel(canvas, x, y, [
        source.data[sourceIndex],
        source.data[sourceIndex + 1],
        source.data[sourceIndex + 2],
        source.data[sourceIndex + 3]
      ]);
    }
  }

  return canvas;
};

const pixelateCanvas = (source, blockSize = 2) => {
  const canvas = makeCanvas(source.width, source.height, colors.transparent);

  for (let y = 0; y < source.height; y += blockSize) {
    for (let x = 0; x < source.width; x += blockSize) {
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;
      let count = 0;

      for (let yy = y; yy < Math.min(source.height, y + blockSize); yy += 1) {
        for (let xx = x; xx < Math.min(source.width, x + blockSize); xx += 1) {
          const sourceIndex = (yy * source.width + xx) * 4;
          red += source.data[sourceIndex];
          green += source.data[sourceIndex + 1];
          blue += source.data[sourceIndex + 2];
          alpha += source.data[sourceIndex + 3];
          count += 1;
        }
      }

      const color = [
        Math.round(red / count),
        Math.round(green / count),
        Math.round(blue / count),
        Math.round(alpha / count)
      ];

      rect(canvas, x, y, Math.min(blockSize, source.width - x), Math.min(blockSize, source.height - y), color);
    }
  }

  return canvas;
};

const hardenAlphaCanvas = (source, threshold = 84) => {
  const canvas = makeCanvas(source.width, source.height, colors.transparent);

  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const sourceIndex = (y * source.width + x) * 4;
      const alpha = source.data[sourceIndex + 3];

      if (alpha < threshold) {
        continue;
      }

      setPixel(canvas, x, y, [
        Math.round(source.data[sourceIndex] / 8) * 8,
        Math.round(source.data[sourceIndex + 1] / 8) * 8,
        Math.round(source.data[sourceIndex + 2] / 8) * 8,
        255
      ]);
    }
  }

  return canvas;
};

const addSpriteOutline = (source, outlineColor = [48, 38, 34, 210], radius = 2) => {
  const canvas = makeCanvas(source.width, source.height, colors.transparent);

  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const sourceIndex = (y * source.width + x) * 4;

      if (source.data[sourceIndex + 3] > 118) {
        for (let yy = y - radius; yy <= y + radius; yy += 1) {
          for (let xx = x - radius; xx <= x + radius; xx += 1) {
            if (xx < 0 || yy < 0 || xx >= source.width || yy >= source.height) {
              continue;
            }

            const distance = Math.abs(xx - x) + Math.abs(yy - y);

            if (distance <= radius) {
              setPixel(canvas, xx, yy, outlineColor);
            }
          }
        }
      }
    }
  }

  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const sourceIndex = (y * source.width + x) * 4;

      if (source.data[sourceIndex + 3] > 0) {
        setPixel(canvas, x, y, [
          source.data[sourceIndex],
          source.data[sourceIndex + 1],
          source.data[sourceIndex + 2],
          source.data[sourceIndex + 3]
        ]);
      }
    }
  }

  return canvas;
};

const finishPetSpriteCanvas = (source) => addSpriteOutline(hardenAlphaCanvas(pixelateCanvas(source, 2), 48), [52, 39, 35, 220], 2);

const gameItemVariantSpecs = [
  { key: "food-bowl", sceneSize: 96, draw: drawFoodBowlIcon },
  { key: "treat-plate", sceneSize: 96, draw: drawTreatPlateIcon },
  { key: "bone", sceneSize: 96, draw: drawBoneIcon },
  { key: "salmon-bites", sceneSize: 96, draw: drawSalmonBitesIcon },
  { key: "chicken-jerky", sceneSize: 96, draw: drawChickenJerkyIcon },
  { key: "pumpkin-cookie", sceneSize: 96, draw: drawPumpkinCookieIcon },
  { key: "berry-yogurt", sceneSize: 96, draw: drawBerryYogurtIcon },
  { key: "sweet-potato-chew", sceneSize: 96, draw: drawSweetPotatoChewIcon },
  { key: "tuna-crunch", sceneSize: 96, draw: drawTunaCrunchIcon },
  { key: "duck-biscuit", sceneSize: 96, draw: drawDuckBiscuitIcon },
  { key: "cheese-puff", sceneSize: 96, draw: drawCheesePuffIcon },
  { key: "apple-biscuit", sceneSize: 96, draw: drawAppleBiscuitIcon },
  { key: "milk-pup-cup", sceneSize: 96, draw: drawMilkPupCupIcon },
  { key: "toy-ball", sceneSize: 96, draw: drawToyBallIcon },
  { key: "plush-toy", sceneSize: 128, draw: drawPlushToyIcon },
  { key: "pet-bed", sceneSize: 128, draw: drawCushionIcon },
  { key: "tiny-house", sceneSize: 192, draw: drawDoghouseIcon },
  { key: "flower-pot", sceneSize: 96, draw: drawFlowerPotIcon },
  { key: "leafy-plant", sceneSize: 128, draw: drawLeafyPlantIcon },
  { key: "hanging-lantern", sceneSize: 128, draw: drawLanternIcon },
  { key: "small-lamp", sceneSize: 96, draw: drawSmallLampIcon },
  { key: "watering-can", sceneSize: 96, draw: drawWateringCanIcon },
  { key: "pond-tile", sceneSize: 160, draw: drawPondTileIcon },
  { key: "stepping-stone", sceneSize: 128, draw: drawSteppingStoneIcon },
  { key: "reward-pouch", sceneSize: 96, draw: drawRewardPouchIcon },
  { key: "gift-box", sceneSize: 96, draw: drawGiftIcon },
  { key: "coin", sceneSize: 96, draw: drawCoinIcon },
  { key: "gem", sceneSize: 96, draw: drawGemIcon },
  { key: "seasonal-flowers", sceneSize: 128, draw: drawSeasonalFlowersIcon },
  { key: "drink-water-bowl", sceneSize: 96, draw: drawDrinkWaterBowlIcon }
];

const hasCompleteGameItemVariantSet = () =>
  gameItemVariantSpecs.every((spec) =>
    ["scene", "ui", "hud", "action"].every((variant) => existsSync(resolve(ROOT, `apps/mobile/assets/game-items/${variant}/${spec.key}.png`)))
  );

const writeGameItemVariants = () => {
  if (hasCompleteGameItemVariantSet() && !regenerateGameItems) {
    console.log("apps/mobile/assets/game-items preserved");
    return;
  }

  if (regenerateGameItems) {
    console.log("apps/mobile/assets/game-items regenerating because TINY_PET_REGENERATE_GAME_ITEMS is enabled");
  }

  for (const spec of gameItemVariantSpecs) {
    const sceneBase = makeItemIcon(spec.draw, { grounded: true });
    const buttonBase = makeItemIcon(spec.draw, { grounded: false });
    writePng(`apps/mobile/assets/game-items/scene/${spec.key}.png`, resizeCanvasNearest(sceneBase, spec.sceneSize, spec.sceneSize));
    writePng(`apps/mobile/assets/game-items/ui/${spec.key}.png`, resizeCanvasNearest(buttonBase, 128, 128));
    writePng(`apps/mobile/assets/game-items/hud/${spec.key}.png`, resizeCanvasNearest(buttonBase, 64, 64));
    writePng(`apps/mobile/assets/game-items/action/${spec.key}.png`, resizeCanvasNearest(buttonBase, 96, 96));
  }
};

const makeCareButtonAsset = (draw, options = {}) => {
  const {
    base = [98, 200, 106, 255],
    baseDark = [56, 140, 82, 255],
    baseLight = [174, 236, 148, 255],
    iconScale = 1
  } = options;
  const canvas = makeCanvas(256, 256, colors.transparent);

  roundedRect(canvas, 28, 28, 200, 200, 38, [82, 58, 43, 160]);
  roundedRect(canvas, 23, 20, 204, 204, 38, colors.cream);
  roundedRect(canvas, 31, 27, 188, 188, 34, baseDark);
  roundedRect(canvas, 36, 31, 178, 174, 30, base);
  roundedRect(canvas, 48, 38, 132, 24, 12, [255, 255, 255, 80]);
  line(canvas, 42, 196, 198, 196, 6, [42, 69, 54, 62]);
  pixelSparkle(canvas, 204, 66, [255, 255, 255, 200]);
  pixelSparkle(canvas, 54, 198, [255, 255, 255, 150]);

  const icon = makeCanvas(160, 160, colors.transparent);
  draw(icon);
  const iconCanvas = iconScale === 1 ? icon : resizeCanvasSmooth(icon, Math.round(160 * iconScale), Math.round(160 * iconScale));
  const drawX = Math.round((256 - iconCanvas.width) / 2);
  const drawY = Math.round((256 - iconCanvas.height) / 2 + 5);
  drawCanvasImage(canvas, iconCanvas, drawX, drawY);

  roundedRect(canvas, 39, 31, 72, 16, 8, [255, 255, 255, 118]);
  line(canvas, 39, 48, 32, 68, 6, [255, 255, 255, 95]);
  roundedRect(canvas, 42, 206, 160, 5, 3, baseLight);
  return hardenAlphaCanvas(pixelateCanvas(canvas, 2), 40);
};

const plantStageAssetSpecs = [
  {
    path: "apps/mobile/assets/game-items/plant-stages/scene/flower-pot-seed.png",
    width: 96,
    height: 96,
    draw: (canvas, centerX, baseY, scale) => drawTerracottaPotStage(canvas, centerX, baseY, scale, { stage: "seed" })
  },
  {
    path: "apps/mobile/assets/game-items/plant-stages/scene/flower-pot-sprout.png",
    width: 96,
    height: 96,
    draw: (canvas, centerX, baseY, scale) => drawTerracottaPotStage(canvas, centerX, baseY, scale, { stage: "sprout" })
  },
  {
    path: "apps/mobile/assets/game-items/plant-stages/scene/flower-pot-leafy.png",
    width: 96,
    height: 96,
    draw: (canvas, centerX, baseY, scale) => drawTerracottaPotStage(canvas, centerX, baseY, scale, { stage: "leafy" })
  },
  {
    path: "apps/mobile/assets/game-items/plant-stages/scene/flower-pot-bloom.png",
    width: 96,
    height: 96,
    draw: (canvas, centerX, baseY, scale) => drawTerracottaPotStage(canvas, centerX, baseY, scale, { stage: "bloom" })
  },
  {
    path: "apps/mobile/assets/game-items/plant-stages/scene/clover-sprout.png",
    width: 128,
    height: 128,
    draw: (canvas, centerX, baseY, scale) => drawCloverPlantStage(canvas, centerX, baseY, scale, { stage: "sprout" })
  },
  {
    path: "apps/mobile/assets/game-items/plant-stages/scene/clover-leafy.png",
    width: 128,
    height: 128,
    draw: (canvas, centerX, baseY, scale) => drawCloverPlantStage(canvas, centerX, baseY, scale, { stage: "leafy" })
  },
  {
    path: "apps/mobile/assets/game-items/plant-stages/scene/clover-bloom.png",
    width: 128,
    height: 128,
    draw: (canvas, centerX, baseY, scale) => drawCloverPlantStage(canvas, centerX, baseY, scale, { stage: "bloom" })
  },
  {
    path: "apps/mobile/assets/game-items/plant-stages/scene/spring-patch-sprout.png",
    width: 160,
    height: 160,
    draw: (canvas, centerX, baseY, scale) => drawSpringPatchStage(canvas, centerX, baseY, scale, { stage: "sprout" })
  },
  {
    path: "apps/mobile/assets/game-items/plant-stages/scene/spring-patch-leafy.png",
    width: 160,
    height: 160,
    draw: (canvas, centerX, baseY, scale) => drawSpringPatchStage(canvas, centerX, baseY, scale, { stage: "leafy" })
  },
  {
    path: "apps/mobile/assets/game-items/plant-stages/scene/spring-patch-bloom.png",
    width: 160,
    height: 160,
    draw: (canvas, centerX, baseY, scale) => drawSpringPatchStage(canvas, centerX, baseY, scale, { stage: "bloom" })
  }
];

const hasCompletePlantStageAssetSet = () => plantStageAssetSpecs.every((spec) => existsSync(resolve(ROOT, spec.path)));

const writePlantStageAssets = () => {
  if (hasCompletePlantStageAssetSet()) {
    console.log("apps/mobile/assets/game-items/plant-stages preserved");
    return;
  }

  for (const spec of plantStageAssetSpecs) {
    writePng(spec.path, makePlantStageAsset(spec));
  }
};

const crcTable = new Uint32Array(256).map((_, tableIndex) => {
  let current = tableIndex;

  for (let bit = 0; bit < 8; bit += 1) {
    current = current & 1 ? 0xedb88320 ^ (current >>> 1) : current >>> 1;
  }

  return current >>> 0;
});

const crc32 = (buffer) => {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);

  length.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));

  return Buffer.concat([length, typeBuffer, data, crc]);
};

const encodePng = (canvas) => {
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  const stride = canvas.width * 4 + 1;
  const raw = Buffer.alloc(stride * canvas.height);

  ihdr.writeUInt32BE(canvas.width, 0);
  ihdr.writeUInt32BE(canvas.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  for (let y = 0; y < canvas.height; y += 1) {
    const rowStart = y * stride;
    raw[rowStart] = 0;
    Buffer.from(canvas.data.slice(y * canvas.width * 4, (y + 1) * canvas.width * 4)).copy(raw, rowStart + 1);
  }

  return Buffer.concat([
    header,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
};

const writePng = (relativePath, canvas) => {
  const outputPath = resolve(ROOT, relativePath);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, encodePng(canvas));
  console.log(`${relativePath} ${canvas.width}x${canvas.height}`);
};

const readPngCanvas = (relativePath) => {
  const png = PNG.sync.read(readFileSync(resolve(ROOT, relativePath)));

  return {
    width: png.width,
    height: png.height,
    data: new Uint8ClampedArray(png.data)
  };
};

const cloneCanvas = (canvas) => ({
  width: canvas.width,
  height: canvas.height,
  data: new Uint8ClampedArray(canvas.data)
});

const drawCanvasImage = (target, source, x = 0, y = 0, scale = 1) => {
  const outputWidth = Math.max(1, Math.round(source.width * scale));
  const outputHeight = Math.max(1, Math.round(source.height * scale));

  for (let targetY = 0; targetY < outputHeight; targetY += 1) {
    for (let targetX = 0; targetX < outputWidth; targetX += 1) {
      const sourceX = Math.max(0, Math.min(source.width - 1, Math.floor(targetX / scale)));
      const sourceY = Math.max(0, Math.min(source.height - 1, Math.floor(targetY / scale)));
      const sourceIndex = (sourceY * source.width + sourceX) * 4;
      const alpha = source.data[sourceIndex + 3];

      if (alpha === 0) {
        continue;
      }

      setPixel(target, x + targetX, y + targetY, [
        source.data[sourceIndex],
        source.data[sourceIndex + 1],
        source.data[sourceIndex + 2],
        alpha
      ]);
    }
  }
};

const fileHash = (relativePath) => createHash("sha256").update(readFileSync(resolve(ROOT, relativePath))).digest("hex");

const copyPng = (fromRelativePath, toRelativePath) => {
  const sourcePath = resolve(ROOT, fromRelativePath);
  const outputPath = resolve(ROOT, toRelativePath);

  mkdirSync(dirname(outputPath), { recursive: true });
  copyFileSync(sourcePath, outputPath);
  console.log(`${toRelativePath} copied`);
};

const petStateAssetPaths = (petKey) => generatedPetStates.map((state) => `apps/mobile/assets/generated/pets/${petKey}/${state}.png`);

const hasDistinctCuratedPetStateSet = (petKey) => {
  const paths = petStateAssetPaths(petKey);

  if (!paths.every((path) => existsSync(resolve(ROOT, path)))) {
    return false;
  }

  const uniqueHashes = new Set(paths.map(fileHash));
  const stateHash = new Map(generatedPetStates.map((state) => [state, fileHash(`apps/mobile/assets/generated/pets/${petKey}/${state}.png`)]));
  const idleHash = stateHash.get("idle");
  const requiredDistinctFromIdle = [
    "happy",
    "sleep",
    "play",
    "hungry",
    "walk_return",
    "treat_reaction",
    "chat_portrait",
    "curious",
    "celebrate",
    "garden_help",
    "seasonal"
  ];

  return uniqueHashes.size >= Math.min(generatedPetStates.length, 8) && requiredDistinctFromIdle.every((state) => stateHash.get(state) !== idleHash);
};

const makePremiumPetFallbackAsset = (source, state, petKey) => {
  const sourceCanvas = source.width === 256 && source.height === 256 ? source : resizeCanvasSmooth(source, 256, 256);
  const canvas = makeCanvas(256, 256, colors.transparent);
  const species = petKey === "luna" ? "cat" : "dog";

  drawGroundedSpriteShadow(canvas, 128, state === "chat_portrait" ? 226 : 222, state === "sleep" ? 84 : 72, 16);
  drawPetStateBackdrop(canvas, state, species);

  if (state === "chat_portrait") {
    drawCanvasImage(canvas, sourceCanvas, -18, 12, 1.14);
  } else if (state === "sleep") {
    drawCanvasImage(canvas, sourceCanvas, 6, 18, 0.95);
  } else if (state === "play") {
    drawCanvasImage(canvas, sourceCanvas, -2, 0, 1);
  } else if (state === "walk_return") {
    drawCanvasImage(canvas, sourceCanvas, 0, -4, 1);
  } else {
    drawCanvasImage(canvas, sourceCanvas);
  }

  if (state === "happy") {
    drawSoftHeart(canvas, 198, 112, 0.78, colors.rose);
    drawSparkle(canvas, 58, 92, 8, [255, 245, 190, 225]);
  }

  drawPetStateOverlay(canvas, state, species);
  drawPetGroundPixels(canvas, 128, 220, species);

  return finishPetSpriteCanvas(canvas);
};

const writePremiumPetFallbackSet = (petKey) => {
  const sourcePath = `apps/mobile/assets/art-sources/pets/${petKey}-premium-source.png`;

  if (!existsSync(resolve(ROOT, sourcePath))) {
    return false;
  }

  if (!regenerateGeneratedPets && hasDistinctCuratedPetStateSet(petKey)) {
    console.log(`apps/mobile/assets/generated/pets/${petKey} preserved`);
    return true;
  }

  const source = readPngCanvas(sourcePath);

  for (const state of generatedPetStates) {
    writePng(`apps/mobile/assets/generated/pets/${petKey}/${state}.png`, makePremiumPetFallbackAsset(source, state, petKey));
  }

  return true;
};

writePng("apps/mobile/assets/icon.png", makeAppIcon());
writePng("apps/mobile/assets/adaptive-icon.png", makeAdaptiveIcon());
writePng("apps/mobile/assets/splash.png", makeSplash());
if (!writePremiumPetFallbackSet("miso")) {
  for (const state of generatedPetStates) {
    writePng(`apps/mobile/assets/generated/pets/miso/${state}.png`, makeMisoPetAsset({ state }));
  }
}
if (!writePremiumPetFallbackSet("luna")) {
  for (const state of generatedPetStates) {
    writePng(`apps/mobile/assets/generated/pets/luna/${state}.png`, makeLunaCatAsset({ state }));
  }
}
writePng("apps/mobile/assets/generated/backgrounds/terrarium-sky-v2.png", makeTerrariumSkyBackground());
writePng("apps/mobile/assets/generated/backgrounds/terrarium-dome-v4.png", drawTerrariumDomeSceneV4());
writePng("apps/mobile/assets/generated/items/bone-v3.png", makeItemIcon(drawBoneIcon));
writePng("apps/mobile/assets/generated/items/coin-v3.png", makeItemIcon(drawCoinIcon));
writePng("apps/mobile/assets/generated/items/cushion-v3.png", makeItemIcon(drawCushionIcon));
writePng("apps/mobile/assets/generated/items/doghouse-v3.png", makeItemIcon(drawDoghouseIcon));
writePng("apps/mobile/assets/generated/items/food-bowl-v3.png", makeItemIcon(drawFoodBowlIcon));
writePng("apps/mobile/assets/generated/items/flower-pot-v3.png", makeItemIcon(drawFlowerPotIcon));
writePng("apps/mobile/assets/generated/items/gem-v3.png", makeItemIcon(drawGemIcon));
writePng("apps/mobile/assets/generated/items/gift-v3.png", makeItemIcon(drawGiftIcon));
writePng("apps/mobile/assets/generated/items/lantern-v3.png", makeItemIcon(drawLanternIcon));
writePng("apps/mobile/assets/generated/items/toy-ball-v3.png", makeItemIcon(drawToyBallIcon));
writePng("apps/mobile/assets/generated/items/watering-can-v3.png", makeItemIcon(drawWateringCanIcon));
writePng("apps/mobile/assets/game-buttons/water.png", makeCareButtonAsset(drawDrinkWaterBowlIcon, { iconScale: 1.02 }));
writePng("apps/mobile/assets/game-buttons/water-hud.png", makeCareButtonAsset(drawDrinkWaterBowlIcon, { iconScale: 0.98 }));
writeGameItemVariants();
writePlantStageAssets();
