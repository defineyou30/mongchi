import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import sharp from "sharp";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sourceRoot = resolve(ROOT, "docs/design/source-sheets");
const backupRoot = resolve(ROOT, "apps/mobile/assets/_dummy/20260628-category-regen-before");

// Legacy sheets may still be sliced below, but new imagegen source sheets should
// use only 2x2, 2x3, or 3x2 layouts so each asset stays large and clean.
const maxNewSourceSheetCells = 6;

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

const gameItemSpecs = [
  { key: "food-bowl", source: "food-treats-v1.png", cols: 3, rows: 3, cell: 0, sceneSize: 96 },
  { key: "treat-plate", source: "treats-premium-b-v2.png", cols: 3, rows: 2, cell: 5, sceneSize: 96 },
  { key: "bone", source: "treats-premium-b-v2.png", cols: 3, rows: 2, cell: 4, sceneSize: 96 },
  { key: "salmon-bites", source: "treats-premium-a-v2.png", cols: 3, rows: 2, cell: 0, sceneSize: 96 },
  { key: "chicken-jerky", source: "treats-premium-a-v2.png", cols: 3, rows: 2, cell: 1, sceneSize: 96 },
  { key: "pumpkin-cookie", source: "treats-premium-a-v2.png", cols: 3, rows: 2, cell: 2, sceneSize: 96 },
  { key: "berry-yogurt", source: "treats-premium-a-v2.png", cols: 3, rows: 2, cell: 3, sceneSize: 96 },
  { key: "sweet-potato-chew", source: "treats-premium-a-v2.png", cols: 3, rows: 2, cell: 4, sceneSize: 96 },
  { key: "tuna-crunch", source: "treats-premium-a-v2.png", cols: 3, rows: 2, cell: 5, sceneSize: 96 },
  { key: "duck-biscuit", source: "treats-premium-b-v2.png", cols: 3, rows: 2, cell: 0, sceneSize: 96 },
  { key: "cheese-puff", source: "treats-premium-b-v2.png", cols: 3, rows: 2, cell: 1, sceneSize: 96 },
  { key: "apple-biscuit", source: "treats-premium-b-v2.png", cols: 3, rows: 2, cell: 2, sceneSize: 96 },
  { key: "milk-pup-cup", source: "treats-premium-b-v2.png", cols: 3, rows: 2, cell: 3, sceneSize: 96 },
  { key: "toy-ball", source: "toy-comfort-v2.png", cols: 3, rows: 2, cell: 0, sceneSize: 96 },
  { key: "plush-toy", source: "toy-comfort-v2.png", cols: 3, rows: 2, cell: 1, sceneSize: 128 },
  { key: "pet-bed", source: "toy-comfort-v2.png", cols: 3, rows: 2, cell: 2, sceneSize: 128 },
  { key: "tiny-house", source: "garden-decor-v2.png", cols: 3, rows: 2, cell: 0, sceneSize: 192 },
  { key: "flower-pot", source: "garden-decor-v2.png", cols: 3, rows: 2, cell: 1, sceneSize: 96 },
  { key: "leafy-plant", source: "garden-decor-v2.png", cols: 3, rows: 2, cell: 2, sceneSize: 128 },
  { key: "hanging-lantern", source: "garden-decor-v2.png", cols: 3, rows: 2, cell: 3, sceneSize: 128 },
  { key: "small-lamp", source: "garden-decor-v2.png", cols: 3, rows: 2, cell: 4, sceneSize: 96 },
  { key: "watering-can", source: "water-path-reward-v2.png", cols: 3, rows: 2, cell: 0, sceneSize: 96 },
  { key: "drink-water-bowl", source: "water-path-reward-v2.png", cols: 3, rows: 2, cell: 0, sceneSize: 96 },
  { key: "pond-tile", source: "water-path-reward-v2.png", cols: 3, rows: 2, cell: 1, sceneSize: 160 },
  { key: "stepping-stone", source: "water-path-reward-v2.png", cols: 3, rows: 2, cell: 2, sceneSize: 128 },
  { key: "reward-pouch", source: "water-path-reward-v2.png", cols: 3, rows: 2, cell: 3, sceneSize: 96 },
  { key: "gift-box", source: "water-path-reward-v2.png", cols: 3, rows: 2, cell: 4, sceneSize: 96 },
  { key: "coin", source: "hud-meter-icons-v2.png", cols: 3, rows: 2, cell: 5, sceneSize: 96 },
  { key: "gem", source: "water-path-reward-v2.png", cols: 3, rows: 2, cell: 5, sceneSize: 96 },
  { key: "seasonal-flowers", source: "garden-decor-v2.png", cols: 3, rows: 2, cell: 5, sceneSize: 128 }
];

const generatedItemMap = [
  { name: "bone-v3", key: "bone" },
  { name: "coin-v3", key: "coin" },
  { name: "cushion-v3", source: "toy-comfort-v2.png", cols: 3, rows: 2, cell: 4 },
  { name: "doghouse-v3", key: "tiny-house" },
  { name: "flower-pot-v3", key: "flower-pot" },
  { name: "food-bowl-v3", key: "food-bowl" },
  { name: "gem-v3", key: "gem" },
  { name: "gift-v3", key: "gift-box" },
  { name: "lantern-v3", key: "hanging-lantern" },
  { name: "toy-ball-v3", key: "toy-ball" },
  { name: "watering-can-v3", key: "drink-water-bowl" }
];

const buttonSpecs = [
  { name: "feed", source: "button-actions-v2.png", cols: 3, rows: 2, cell: 0 },
  { name: "water", source: "button-actions-v2.png", cols: 3, rows: 2, cell: 1 },
  { name: "play", source: "button-actions-v2.png", cols: 3, rows: 2, cell: 2 },
  { name: "affection", source: "button-actions-v2.png", cols: 3, rows: 2, cell: 3 },
  { name: "path", source: "button-actions-v2.png", cols: 3, rows: 2, cell: 4 },
  { name: "rest", source: "button-actions-v2.png", cols: 3, rows: 2, cell: 5 },
  { name: "energy", source: "hud-meter-icons-v2.png", cols: 3, rows: 2, cell: 3 },
  { name: "water-hud", source: "hud-meter-icons-v2.png", cols: 3, rows: 2, cell: 1 },
  { name: "shop", source: "button-utility-v2.png", cols: 3, rows: 2, cell: 0 },
  { name: "chat", source: "button-utility-v2.png", cols: 3, rows: 2, cell: 1 },
  { name: "inventory", source: "button-utility-v2.png", cols: 3, rows: 2, cell: 2 },
  { name: "settings", source: "button-utility-v2.png", cols: 3, rows: 2, cell: 3 }
];

const sideNavButtonSpecs = [
  { name: "shop", source: "button-utility-v2.png", cols: 3, rows: 2, cell: 0 },
  { name: "chat", source: "button-utility-v2.png", cols: 3, rows: 2, cell: 1 },
  { name: "inventory", source: "button-utility-v2.png", cols: 3, rows: 2, cell: 2 },
  { name: "settings", source: "button-utility-v2.png", cols: 3, rows: 2, cell: 3 }
];

const statusIconSpecs = [
  { name: "hungry", source: "status-mood-icons-v2.png", cols: 3, rows: 2, cell: 0 },
  { name: "thirsty", source: "status-mood-icons-v2.png", cols: 3, rows: 2, cell: 1 },
  { name: "bored", source: "status-mood-icons-v2.png", cols: 3, rows: 2, cell: 2 },
  { name: "sleepy", source: "status-mood-icons-v2.png", cols: 3, rows: 2, cell: 3 },
  { name: "cozy", source: "status-mood-icons-v2.png", cols: 3, rows: 2, cell: 4 },
  { name: "needsCare", source: "status-mood-icons-v2.png", cols: 3, rows: 2, cell: 5 }
];

const petStateMap = {
  idle: { cell: 0 },
  base: { cell: 0, scale: 0.96, y: 4 },
  happy: { cell: 5 },
  sleep: { cell: 4 },
  play: { cell: 2 },
  hungry: { cell: 1 },
  walk_return: { cell: 3 },
  treat_reaction: { cell: 1, scale: 1.03, sparkle: true },
  chat_portrait: { cell: 0, scale: 1.24, y: 18 },
  curious: { cell: 0, scale: 0.98, x: -6, badge: "question" },
  celebrate: { cell: 5, scale: 1.04, sparkle: true },
  garden_help: { cell: 3, scale: 1, badge: "leaf" },
  seasonal: { cell: 5, scale: 0.98, badge: "flower" }
};

const ensureDir = (path) => mkdirSync(dirname(path), { recursive: true });

const relative = (absolutePath) => absolutePath.replace(`${ROOT}/`, "");

const copyIfExists = (from, to) => {
  if (!existsSync(from)) {
    return;
  }

  ensureDir(to);
  copyFileSync(from, to);
};

const backupPath = (relativePath) => resolve(backupRoot, relativePath);

const backupExistingAsset = (relativePath) => {
  const absolutePath = resolve(ROOT, relativePath);
  const targetBackupPath = backupPath(relativePath);

  if (!existsSync(absolutePath)) {
    return;
  }

  if (existsSync(targetBackupPath)) {
    return;
  }

  copyIfExists(absolutePath, targetBackupPath);
};

const readRgba = async (path) => sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

const pngFromRaw = (data, width, height) => {
  const png = new PNG({ width, height });
  png.data = Buffer.from(data);
  return PNG.sync.write(png);
};

const averageCornerColor = (data, width, height) => {
  const samples = [];
  const sampleSize = Math.max(8, Math.round(Math.min(width, height) * 0.04));
  const corners = [
    [0, 0],
    [width - sampleSize, 0],
    [0, height - sampleSize],
    [width - sampleSize, height - sampleSize]
  ];

  for (const [startX, startY] of corners) {
    for (let y = startY; y < startY + sampleSize; y += 1) {
      for (let x = startX; x < startX + sampleSize; x += 1) {
        const index = (y * width + x) * 4;
        samples.push([data[index], data[index + 1], data[index + 2]]);
      }
    }
  }

  const sum = samples.reduce(
    (total, [red, green, blue]) => [total[0] + red, total[1] + green, total[2] + blue],
    [0, 0, 0]
  );

  return sum.map((value) => value / samples.length);
};

const colorDistance = (data, index, color) => {
  const red = data[index] - color[0];
  const green = data[index + 1] - color[1];
  const blue = data[index + 2] - color[2];
  return Math.sqrt(red * red + green * green + blue * blue);
};

const isRemovableBackground = (data, index, color) => {
  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lowSaturation = max - min < 30;
  const brightWarm = red > 224 && green > 214 && blue > 190;

  return colorDistance(data, index, color) < 42 || (brightWarm && lowSaturation);
};

const removeConnectedBackground = ({ data, info }) => {
  const width = info.width;
  const height = info.height;
  const bg = averageCornerColor(data, width, height);
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const tryEnqueue = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return;
    }

    const point = y * width + x;

    if (visited[point]) {
      return;
    }

    const index = point * 4;

    if (!isRemovableBackground(data, index, bg)) {
      return;
    }

    visited[point] = 1;
    queue[tail] = point;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    tryEnqueue(x, 0);
    tryEnqueue(x, height - 1);
  }

  for (let y = 0; y < height; y += 1) {
    tryEnqueue(0, y);
    tryEnqueue(width - 1, y);
  }

  while (head < tail) {
    const point = queue[head];
    head += 1;
    const x = point % width;
    const y = Math.floor(point / width);
    const index = point * 4;
    data[index + 3] = 0;
    tryEnqueue(x + 1, y);
    tryEnqueue(x - 1, y);
    tryEnqueue(x, y + 1);
    tryEnqueue(x, y - 1);
  }

  return { data, width, height };
};

const keepLargestAlphaComponent = ({ data, width, height }) => {
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let largestComponent = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x;

      if (visited[start] || data[start * 4 + 3] <= 12) {
        continue;
      }

      const component = [];
      let head = 0;
      let tail = 0;
      visited[start] = 1;
      queue[tail] = start;
      tail += 1;

      while (head < tail) {
        const point = queue[head];
        head += 1;
        component.push(point);
        const pointX = point % width;
        const pointY = Math.floor(point / width);

        for (const [nextX, nextY] of [
          [pointX + 1, pointY],
          [pointX - 1, pointY],
          [pointX, pointY + 1],
          [pointX, pointY - 1]
        ]) {
          if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) {
            continue;
          }

          const nextPoint = nextY * width + nextX;

          if (visited[nextPoint] || data[nextPoint * 4 + 3] <= 12) {
            continue;
          }

          visited[nextPoint] = 1;
          queue[tail] = nextPoint;
          tail += 1;
        }
      }

      if (component.length > largestComponent.length) {
        largestComponent = component;
      }
    }
  }

  const kept = new Uint8Array(width * height);

  for (const point of largestComponent) {
    kept[point] = 1;
  }

  for (let point = 0; point < width * height; point += 1) {
    if (!kept[point]) {
      data[point * 4 + 3] = 0;
    }
  }

  return { data, width, height };
};

const trimTransparent = ({ data, width, height }, padding = 18) => {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      if (data[index + 3] > 12) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (minX > maxX || minY > maxY) {
    return { data, width, height };
  }

  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(width - 1, maxX + padding);
  maxY = Math.min(height - 1, maxY + padding);

  const trimmedWidth = maxX - minX + 1;
  const trimmedHeight = maxY - minY + 1;
  const trimmed = Buffer.alloc(trimmedWidth * trimmedHeight * 4);

  for (let y = 0; y < trimmedHeight; y += 1) {
    for (let x = 0; x < trimmedWidth; x += 1) {
      const sourceIndex = ((minY + y) * width + (minX + x)) * 4;
      const targetIndex = (y * trimmedWidth + x) * 4;
      data.copy(trimmed, targetIndex, sourceIndex, sourceIndex + 4);
    }
  }

  return { data: trimmed, width: trimmedWidth, height: trimmedHeight };
};

const renderSquare = async (rawAsset, size, options = {}) => {
  const { scale = 1, x = 0, y = 0, kernel = "lanczos3" } = options;
  const targetFit = Math.max(1, Math.min(size, Math.round(size * 0.86 * scale)));
  const input = pngFromRaw(rawAsset.data, rawAsset.width, rawAsset.height);
  const resized = await sharp(input)
    .resize({ width: targetFit, height: targetFit, fit: "inside", kernel })
    .png()
    .toBuffer({ resolveWithObject: true });
  const unclampedLeft = Math.round((size - resized.info.width) / 2 + x);
  const unclampedTop = Math.round((size - resized.info.height) / 2 + y);
  const left = Math.max(0, Math.min(size - resized.info.width, unclampedLeft));
  const top = Math.max(0, Math.min(size - resized.info.height, unclampedTop));
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: resized.data, left, top }])
    .png()
    .toBuffer();
};

const cropCell = async ({ source, cols, rows, cell }) => {
  const sourcePath = resolve(sourceRoot, source);
  const metadata = await sharp(sourcePath).metadata();
  if (!cols || !rows) {
    const raw = await sharp(sourcePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const backgroundRemoved = keepLargestAlphaComponent(removeConnectedBackground(raw));
    return trimTransparent(backgroundRemoved, 28);
  }
  const cellWidth = Math.floor(metadata.width / cols);
  const cellHeight = Math.floor(metadata.height / rows);
  const col = cell % cols;
  const row = Math.floor(cell / cols);
  const inset = 3;
  const extracted = await sharp(sourcePath)
    .ensureAlpha()
    .extract({
      left: col * cellWidth + inset,
      top: row * cellHeight + inset,
      width: cellWidth - inset * 2,
      height: cellHeight - inset * 2
    })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const backgroundRemoved = keepLargestAlphaComponent(removeConnectedBackground(extracted));
  return trimTransparent(backgroundRemoved);
};

const writeAsset = (relativePath, buffer) => {
  const absolutePath = resolve(ROOT, relativePath);
  ensureDir(absolutePath);
  backupExistingAsset(relativePath);
  writeFileSync(absolutePath, buffer);
  console.log(`${relativePath} regenerated`);
};

const writeReadme = () => {
  mkdirSync(backupRoot, { recursive: true });
  writeFileSync(
    resolve(backupRoot, "README.md"),
    [
      "# 2026-06-28 Category Regen Backup",
      "",
      "These PNGs were copied here before regenerating app assets from docs/design/source-sheets.",
      "They are not referenced by the app runtime and can be deleted after the new art direction is approved.",
      "",
      "Regenerated by scripts/apply-category-source-sheets.mjs.",
      ""
    ].join("\n")
  );
};

const gameItemSourceByKey = new Map(gameItemSpecs.map((spec) => [spec.key, spec]));
const cachedCrops = new Map();

const getCrop = async (spec) => {
  const id = `${spec.source}:${spec.cols}x${spec.rows}:${spec.cell}`;

  if (!cachedCrops.has(id)) {
    cachedCrops.set(id, cropCell(spec));
  }

  return cachedCrops.get(id);
};

const writeGameItems = async () => {
  for (const spec of gameItemSpecs) {
    const crop = await getCrop(spec);
    const variants = [
      ["scene", spec.sceneSize, { scale: 0.96 }],
      ["ui", 128, { scale: 0.88 }],
      ["hud", 64, { scale: 0.9 }],
      ["action", 96, { scale: 0.86 }]
    ];

    for (const [variant, size, options] of variants) {
      const buffer = await renderSquare(crop, size, options);
      writeAsset(`apps/mobile/assets/game-items/${variant}/${spec.key}.png`, buffer);
    }
  }
};

const writeGeneratedItems = async () => {
  for (const item of generatedItemMap) {
    const spec = item.key ? gameItemSourceByKey.get(item.key) : item;
    const crop = await getCrop(spec);
    const buffer = await renderSquare(crop, 160, { scale: 0.88 });
    writeAsset(`apps/mobile/assets/generated/items/${item.name}.png`, buffer);
  }
};

const writeButtons = async () => {
  for (const spec of buttonSpecs) {
    const crop = await getCrop(spec);
    const rendered = await renderSquare(crop, 256, { scale: 1.05, kernel: "nearest" });
    const buffer = spec.name === "settings" ? recolorPurpleButtonToStoneGray(rendered) : rendered;
    writeAsset(`apps/mobile/assets/game-buttons/${spec.name}.png`, buffer);
  }
};

const writeSideNavButtons = async () => {
  for (const spec of sideNavButtonSpecs) {
    const crop = await getCrop(spec);
    const rendered = await renderSquare(crop, 256, { scale: 1.05, kernel: "nearest" });
    const buffer = spec.name === "settings" ? recolorPurpleButtonToStoneGray(rendered) : rendered;
    writeAsset(`apps/mobile/assets/game-buttons/side-nav/${spec.name}.png`, buffer);
  }
};

const writeStatusIcons = async () => {
  for (const spec of statusIconSpecs) {
    const crop = await getCrop(spec);
    const buffer = await renderSquare(crop, 96, { scale: 0.92, kernel: "nearest" });
    writeAsset(`apps/mobile/assets/status-icons/${spec.name}.png`, buffer);
  }
};

const drawBadge = async (inputBuffer, size, kind) => {
  if (!kind) {
    return inputBuffer;
  }

  const svgByKind = {
    question: `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><text x="${size - 44}" y="54" font-size="38" font-family="Arial" font-weight="700" fill="#d99b34">?</text></svg>`,
    leaf: `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><path d="M205 42c20 7 30 21 29 42-22 0-38-10-47-30 5-6 11-10 18-12z" fill="#69b96a" stroke="#4a7e45" stroke-width="4"/></svg>`,
    flower: `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="212" cy="54" r="8" fill="#f3cf5c"/><circle cx="212" cy="40" r="10" fill="#f291b1"/><circle cx="226" cy="54" r="10" fill="#f291b1"/><circle cx="212" cy="68" r="10" fill="#f291b1"/><circle cx="198" cy="54" r="10" fill="#f291b1"/></svg>`
  };

  return sharp(inputBuffer).composite([{ input: Buffer.from(svgByKind[kind]) }]).png().toBuffer();
};

const drawSparkle = async (inputBuffer, size) => {
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <path d="M44 64l9 23 23 9-23 9-9 23-9-23-23-9 23-9z" fill="#fff2a8" stroke="#d99b34" stroke-width="3"/>
    <path d="M205 102l7 17 17 7-17 7-7 17-7-17-17-7 17-7z" fill="#fff2a8" stroke="#d99b34" stroke-width="3"/>
  </svg>`;
  return sharp(inputBuffer).composite([{ input: Buffer.from(svg) }]).png().toBuffer();
};

const recolorPurpleButtonToStoneGray = (inputBuffer) => {
  const png = PNG.sync.read(inputBuffer);

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const index = (y * png.width + x) * 4;
      const alpha = png.data[index + 3];

      if (alpha === 0) {
        continue;
      }

      const red = png.data[index];
      const green = png.data[index + 1];
      const blue = png.data[index + 2];
      const isPurpleButtonSurface = blue > 120 && red > 100 && green < 170 && blue >= green + 12;

      if (!isPurpleButtonSurface) {
        continue;
      }

      const luminance = 0.35 * red + 0.45 * green + 0.2 * blue;
      png.data[index] = Math.max(70, Math.min(245, Math.round(luminance * 0.93 + 22)));
      png.data[index + 1] = Math.max(70, Math.min(245, Math.round(luminance * 0.98 + 22)));
      png.data[index + 2] = Math.max(70, Math.min(245, Math.round(luminance * 1.05 + 26)));
    }
  }

  return PNG.sync.write(png);
};

const writePets = async () => {
  const sets = [
    { key: "miso", source: "dog-actions-v1.png" },
    { key: "luna", source: "cat-actions-v1.png" }
  ];

  for (const set of sets) {
    for (const state of generatedPetStates) {
      const options = petStateMap[state];
      const crop = await getCrop({ source: set.source, cols: 3, rows: 2, cell: options.cell });
      let buffer = await renderSquare(crop, 256, options);

      if (options.sparkle) {
        buffer = await drawSparkle(buffer, 256);
      }

      if (options.badge) {
        buffer = await drawBadge(buffer, 256, options.badge);
      }

      writeAsset(`apps/mobile/assets/generated/pets/${set.key}/${state}.png`, buffer);
    }
  }
};

const writeShopHelper = async () => {
  const raw = await readRgba(resolve(sourceRoot, "shop-helper-v1.png"));
  const backgroundRemoved = trimTransparent(removeConnectedBackground(raw), 28);
  const buffer = await renderSquare(backgroundRemoved, 320, { scale: 0.95 });
  writeAsset("apps/mobile/assets/shop/shop-helper.png", buffer);
};

const main = async () => {
  writeReadme();
  await writeGameItems();
  await writeGeneratedItems();
  await writeButtons();
  await writeSideNavButtons();
  await writeStatusIcons();
  await writePets();
  await writeShopHelper();

  const sourceSheets = readdirSync(sourceRoot).filter((file) => file.endsWith(".png")).sort();
  writeFileSync(
    resolve(sourceRoot, "README.md"),
    [
      "# Category Source Sheets",
      "",
      "Generated source sheets for the current Mongchi art direction.",
      "These sheets are split by category to avoid the broken mixed-asset results from large all-in-one generations.",
      "",
      "## New Generation Rule",
      "",
      `New imagegen source sheets must use only 4 to ${maxNewSourceSheetCells} assets per image.`,
      "",
      "- Preferred layouts: `2x2`, `2x3`, or `3x2`.",
      `- Maximum: ${maxNewSourceSheetCells} assets per image.`,
      "- Do not create new `3x3`, 9-item, complete-set, or mixed-category sheets.",
      "- Generate backgrounds, loading screens, logos, and real-photo pet avatars one image at a time.",
      "- Keep every cell large, centered, evenly padded, and easy to crop.",
      "",
      "Some current source sheets are legacy `3x3` extraction inputs. Keep them only until the matching category is regenerated with the new 4-to-6 asset rule.",
      "",
      "## Current Files",
      "",
      ...sourceSheets.map((file) => `- ${file}`),
      "",
      "## App Export",
      "",
      "Run `node scripts/apply-category-source-sheets.mjs` to slice approved cells into app PNG assets.",
      "The script keeps existing runtime paths stable and backs up previous PNGs under `apps/mobile/assets/_dummy/20260628-category-regen-before`.",
      ""
    ].join("\n")
  );

  console.log("category source sheets applied");
};

await main();
