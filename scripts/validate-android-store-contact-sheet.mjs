import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const manifest = JSON.parse(readFileSync(resolve(ROOT, "docs/store-screenshot-manifest.json"), "utf8"));
const outputDirectory = resolve(ROOT, manifest.outputDirectory ?? "docs/qa-screenshots");
const screenshots = Array.isArray(manifest.screenshots) ? manifest.screenshots : [];
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const failures = [];

const escapeRegex = (value) => value.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
const outputFiles = existsSync(outputDirectory) ? readdirSync(outputDirectory) : [];
const devices = new Map();

for (const entry of screenshots) {
  const fileRegex = new RegExp(`^android-(.+)-${escapeRegex(entry.captureLabel)}\\.png$`);

  for (const fileName of outputFiles) {
    const match = fileName.match(fileRegex);

    if (!match) {
      continue;
    }

    const deviceSlug = match[1];
    const entries = devices.get(deviceSlug) ?? new Map();
    entries.set(entry.preset, fileName);
    devices.set(deviceSlug, entries);
  }
}

const fullDevices = [...devices.entries()].filter(([, entries]) => screenshots.every((entry) => entries.has(entry.preset)));

if (fullDevices.length === 0) {
  failures.push("No Android device has a complete store screenshot preset set.");
}

const readPngInfo = (filePath) => {
  if (!existsSync(filePath) || statSync(filePath).size === 0) {
    throw new Error(`${filePath} is missing or empty.`);
  }

  const bytes = readFileSync(filePath);

  if (bytes.length < 33 || !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error(`${filePath} is not a PNG file.`);
  }

  return {
    height: bytes.readUInt32BE(20),
    width: bytes.readUInt32BE(16)
  };
};

for (const [deviceSlug, entries] of fullDevices) {
  const contactSheetPath = resolve(outputDirectory, `android-${deviceSlug}-store-contact-sheet.png`);

  try {
    const info = readPngInfo(contactSheetPath);

    if (info.width < 600 || info.height < 1200) {
      failures.push(`${contactSheetPath} is ${info.width}x${info.height}; expected a multi-screen contact sheet.`);
    }
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
    continue;
  }

  const contactSheetMtime = statSync(contactSheetPath).mtimeMs;
  const latestScreenshotMtime = Math.max(
    ...screenshots.map((entry) => statSync(resolve(outputDirectory, entries.get(entry.preset))).mtimeMs)
  );

  if (contactSheetMtime + 1000 < latestScreenshotMtime) {
    failures.push(`${contactSheetPath} is older than at least one source store screenshot. Run npm run generate:android-store-contact-sheet.`);
  }
}

if (failures.length > 0) {
  console.error("Android store contact sheet validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Android store contact sheet validation passed.");
