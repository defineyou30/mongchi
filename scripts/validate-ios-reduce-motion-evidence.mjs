import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const screenshotDir = resolve(ROOT, "docs/qa-screenshots");
const qaDeviceChecksPath = resolve(ROOT, "docs/release/qa-device-checks.md");
const manualChecklistPath = resolve(ROOT, "docs/release/ios-manual-qa-checklist.md");
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const expectedLabels = [
  "reduce-motion-hatching",
  "reduce-motion-pet-reveal",
  "reduce-motion-terrarium",
  "reduce-motion-chat",
  "reduce-motion-shop"
];
const failures = [];

const readPngInfo = (filePath) => {
  if (!existsSync(filePath) || statSync(filePath).size === 0) {
    failures.push(`${filePath} is missing or empty.`);
    return null;
  }

  const bytes = readFileSync(filePath);

  if (bytes.length < 33 || !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    failures.push(`${filePath} is not a PNG screenshot.`);
    return null;
  }

  const decoded = PNG.sync.read(bytes);
  let sampled = 0;
  let redErrorPixels = 0;

  for (let y = 0; y < decoded.height; y += 8) {
    for (let x = 0; x < decoded.width; x += 8) {
      const index = (decoded.width * y + x) << 2;
      const red = decoded.data[index];
      const green = decoded.data[index + 1];
      const blue = decoded.data[index + 2];
      const alpha = decoded.data[index + 3];

      if (alpha > 200) {
        sampled += 1;

        if (red > 180 && green < 80 && blue < 80) {
          redErrorPixels += 1;
        }
      }
    }
  }

  if (sampled > 0 && redErrorPixels / sampled > 0.08) {
    failures.push(`${filePath} appears to be a React Native red error screen.`);
  }

  return {
    width: decoded.width,
    height: decoded.height
  };
};

if (!existsSync(screenshotDir)) {
  failures.push("docs/qa-screenshots is missing.");
} else {
  const outputFiles = readdirSync(screenshotDir);

  for (const label of expectedLabels) {
    const expectedSuffix = `-${label}.png`;
    const evidenceFiles = outputFiles
      .filter((fileName) => fileName.startsWith("ios-") && fileName.endsWith(expectedSuffix))
      .sort();

    if (evidenceFiles.length === 0) {
      failures.push(`No iOS reduced-motion screenshot matching ios-*${expectedSuffix} was found.`);
    }

    for (const fileName of evidenceFiles) {
      const info = readPngInfo(resolve(screenshotDir, fileName));

      if (!info) {
        continue;
      }

      if (info.width < 1000 || info.height < 1800) {
        failures.push(`${fileName} is ${info.width}x${info.height}; expected an iPhone-sized portrait screenshot.`);
      }
    }
  }

  const qaDeviceChecks = existsSync(qaDeviceChecksPath) ? readFileSync(qaDeviceChecksPath, "utf8") : "";
  const checklist = existsSync(manualChecklistPath) ? readFileSync(manualChecklistPath, "utf8") : "";

  for (const label of expectedLabels) {
    if (!qaDeviceChecks.includes(label)) {
      failures.push(`docs/release/qa-device-checks.md must mention the iOS ${label} screenshot evidence.`);
    }
  }

  if (!checklist.includes("capture:ios-reduce-motion-hatching")) {
    failures.push("docs/release/ios-manual-qa-checklist.md must document the iOS reduced-motion hatching capture command.");
  }

  if (!checklist.includes("capture:ios-reduce-motion-core-evidence")) {
    failures.push("docs/release/ios-manual-qa-checklist.md must document the iOS reduced-motion core evidence capture command.");
  }
}

if (failures.length > 0) {
  console.error("iOS reduced-motion evidence validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("iOS reduced-motion evidence is present.");
