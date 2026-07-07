import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const manifest = JSON.parse(readFileSync(resolve(ROOT, "docs/store-screenshot-manifest.json"), "utf8"));
const outputDirectory = resolve(ROOT, manifest.outputDirectory ?? "docs/qa-screenshots");
const requestedDeviceSlug = process.env.TINY_PET_IOS_STORE_CONTACT_DEVICE?.trim() || null;
const labelPrefix = process.env.TINY_PET_IOS_STORE_CONTACT_LABEL_PREFIX?.trim() || "";
const thumbnailWidth = Number.parseInt(process.env.TINY_PET_IOS_STORE_CONTACT_THUMBNAIL_WIDTH ?? "220", 10);
const columns = Number.parseInt(process.env.TINY_PET_IOS_STORE_CONTACT_COLUMNS ?? "3", 10);
const gap = 14;
const border = 4;
const background = { red: 155, green: 218, blue: 246, alpha: 255 };
const frame = { red: 255, green: 252, blue: 240, alpha: 255 };

if (!Number.isInteger(thumbnailWidth) || thumbnailWidth < 120 || thumbnailWidth > 480) {
  console.error("TINY_PET_IOS_STORE_CONTACT_THUMBNAIL_WIDTH must be an integer between 120 and 480.");
  process.exit(1);
}

if (!Number.isInteger(columns) || columns < 1 || columns > 6) {
  console.error("TINY_PET_IOS_STORE_CONTACT_COLUMNS must be an integer between 1 and 6.");
  process.exit(1);
}

const screenshots = Array.isArray(manifest.screenshots) ? manifest.screenshots : [];
const outputFiles = existsSync(outputDirectory) ? readdirSync(outputDirectory) : [];
const escapeRegex = (value) => value.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
const devices = new Map();

for (const entry of screenshots) {
  const captureLabel = entry.captureLabel;
  const prefixedLabel = labelPrefix ? `${labelPrefix}-${captureLabel}` : captureLabel;
  const fileRegex = new RegExp(`^ios-(.+)-${escapeRegex(prefixedLabel)}\\.png$`);

  for (const fileName of outputFiles) {
    const match = fileName.match(fileRegex);

    if (!match) {
      continue;
    }

    const deviceSlug = match[1];

    if (!labelPrefix && deviceSlug.includes("-large-text")) {
      continue;
    }

    const entries = devices.get(deviceSlug) ?? new Map();
    entries.set(entry.preset, fileName);
    devices.set(deviceSlug, entries);
  }
}

const selectedDeviceSlug =
  requestedDeviceSlug ??
  [...devices.entries()].sort((left, right) => right[1].size - left[1].size || left[0].localeCompare(right[0]))[0]?.[0] ??
  null;

if (!selectedDeviceSlug) {
  console.error("No iOS store screenshots found for contact sheet generation.");
  process.exit(1);
}

const selectedFiles = devices.get(selectedDeviceSlug);

if (!selectedFiles) {
  console.error(`No iOS store screenshots found for device ${selectedDeviceSlug}.`);
  process.exit(1);
}

const missingPresets = screenshots.map((entry) => entry.preset).filter((preset) => !selectedFiles.has(preset));

if (missingPresets.length > 0) {
  console.error(`Cannot generate contact sheet for ${selectedDeviceSlug}; missing preset(s): ${missingPresets.join(", ")}.`);
  process.exit(1);
}

const readPng = (fileName) => PNG.sync.read(readFileSync(resolve(outputDirectory, fileName)));

const resizePng = (source, width) => {
  const height = Math.round((source.height * width) / source.width);
  const resized = new PNG({ width, height });

  for (let y = 0; y < height; y++) {
    const sourceY = Math.min(source.height - 1, Math.floor((y * source.height) / height));

    for (let x = 0; x < width; x++) {
      const sourceX = Math.min(source.width - 1, Math.floor((x * source.width) / width));
      const sourceIndex = (source.width * sourceY + sourceX) << 2;
      const targetIndex = (width * y + x) << 2;

      resized.data[targetIndex] = source.data[sourceIndex];
      resized.data[targetIndex + 1] = source.data[sourceIndex + 1];
      resized.data[targetIndex + 2] = source.data[sourceIndex + 2];
      resized.data[targetIndex + 3] = source.data[sourceIndex + 3];
    }
  }

  return resized;
};

const fillRect = (image, x, y, width, height, color) => {
  for (let row = y; row < y + height; row++) {
    for (let col = x; col < x + width; col++) {
      const index = (image.width * row + col) << 2;
      image.data[index] = color.red;
      image.data[index + 1] = color.green;
      image.data[index + 2] = color.blue;
      image.data[index + 3] = color.alpha;
    }
  }
};

const blit = (source, target, offsetX, offsetY) => {
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      const sourceIndex = (source.width * y + x) << 2;
      const targetIndex = (target.width * (offsetY + y) + offsetX + x) << 2;

      target.data[targetIndex] = source.data[sourceIndex];
      target.data[targetIndex + 1] = source.data[sourceIndex + 1];
      target.data[targetIndex + 2] = source.data[sourceIndex + 2];
      target.data[targetIndex + 3] = source.data[sourceIndex + 3];
    }
  }
};

const thumbnails = screenshots.map((entry) => {
  const fileName = selectedFiles.get(entry.preset);
  const original = readPng(fileName);

  return {
    preset: entry.preset,
    fileName,
    image: resizePng(original, thumbnailWidth)
  };
});

const rows = Math.ceil(thumbnails.length / columns);
const thumbnailHeight = Math.max(...thumbnails.map((thumbnail) => thumbnail.image.height));
const cellWidth = thumbnailWidth + border * 2;
const cellHeight = thumbnailHeight + border * 2;
const sheet = new PNG({
  width: columns * cellWidth + (columns + 1) * gap,
  height: rows * cellHeight + (rows + 1) * gap
});

fillRect(sheet, 0, 0, sheet.width, sheet.height, background);

for (const [index, thumbnail] of thumbnails.entries()) {
  const column = index % columns;
  const row = Math.floor(index / columns);
  const cellX = gap + column * (cellWidth + gap);
  const cellY = gap + row * (cellHeight + gap);
  const imageY = cellY + border + Math.floor((thumbnailHeight - thumbnail.image.height) / 2);

  fillRect(sheet, cellX, cellY, cellWidth, cellHeight, frame);
  blit(thumbnail.image, sheet, cellX + border, imageY);
}

const contactSheetPath = resolve(outputDirectory, `ios-${selectedDeviceSlug}-${labelPrefix ? `${labelPrefix}-` : ""}store-contact-sheet.png`);
writeFileSync(contactSheetPath, PNG.sync.write(sheet));

console.log(`Generated iOS store contact sheet: ${contactSheetPath}`);
