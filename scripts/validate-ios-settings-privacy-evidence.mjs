import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const screenshotDir = resolve(ROOT, "docs/qa-screenshots");
const qaDeviceChecksPath = resolve(ROOT, "docs/release/qa-device-checks.md");
const manualChecklistPath = resolve(ROOT, "docs/release/ios-manual-qa-checklist.md");
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const expectedEvidence = [
  {
    label: "settings-privacy-status",
    suffix: "-settings-privacy-status.png",
    noticeKind: "error"
  },
  {
    label: "settings-privacy-progress",
    suffix: "-settings-privacy-progress.png",
    noticeKind: "progress"
  }
];
const failures = [];

const sampleRegion = (decoded, region) => {
  const xStart = Math.floor(decoded.width * region.left);
  const xEnd = Math.floor(decoded.width * region.right);
  const yStart = Math.floor(decoded.height * region.top);
  const yEnd = Math.floor(decoded.height * region.bottom);
  let sampled = 0;
  let lightPixels = 0;
  let darkPixels = 0;
  let bluePixels = 0;
  let greyPixels = 0;
  let pinkNoticePixels = 0;
  let redAccentPixels = 0;
  let greenNoticePixels = 0;
  let greenAccentPixels = 0;

  for (let y = yStart; y < yEnd; y += 6) {
    for (let x = xStart; x < xEnd; x += 6) {
      const index = (decoded.width * y + x) << 2;
      const red = decoded.data[index];
      const green = decoded.data[index + 1];
      const blue = decoded.data[index + 2];
      const alpha = decoded.data[index + 3];

      if (alpha <= 200) {
        continue;
      }

      sampled += 1;

      if (red > 225 && green > 225 && blue > 220) {
        lightPixels += 1;
      }

      if (red < 70 && green < 70 && blue < 70) {
        darkPixels += 1;
      }

      if (red < 90 && green > 90 && blue > 170) {
        bluePixels += 1;
      }

      if (
        red >= 90 &&
        red <= 210 &&
        green >= 90 &&
        green <= 210 &&
        blue >= 90 &&
        blue <= 210 &&
        Math.max(red, green, blue) - Math.min(red, green, blue) <= 24
      ) {
        greyPixels += 1;
      }

      if (red > 235 && green > 220 && green < 250 && blue > 220 && blue < 250) {
        pinkNoticePixels += 1;
      }

      if (red > 210 && green < 145 && blue < 145) {
        redAccentPixels += 1;
      }

      if (red > 225 && red < 255 && green > 238 && blue > 225 && blue < 255) {
        greenNoticePixels += 1;
      }

      if (red > 55 && red < 135 && green > 130 && green < 190 && blue > 65 && blue < 130) {
        greenAccentPixels += 1;
      }
    }
  }

  return {
    blueRatio: sampled > 0 ? bluePixels / sampled : 0,
    darkRatio: sampled > 0 ? darkPixels / sampled : 0,
    greyRatio: sampled > 0 ? greyPixels / sampled : 0,
    lightRatio: sampled > 0 ? lightPixels / sampled : 0,
    greenAccentRatio: sampled > 0 ? greenAccentPixels / sampled : 0,
    greenNoticeRatio: sampled > 0 ? greenNoticePixels / sampled : 0,
    pinkNoticeRatio: sampled > 0 ? pinkNoticePixels / sampled : 0,
    redAccentRatio: sampled > 0 ? redAccentPixels / sampled : 0
  };
};

const appearsToBeIosOpenUrlPrompt = (decoded) => {
  const modal = sampleRegion(decoded, { left: 0.16, right: 0.84, top: 0.43, bottom: 0.58 });
  const buttonBand = sampleRegion(decoded, { left: 0.2, right: 0.8, top: 0.52, bottom: 0.57 });

  return (modal.lightRatio > 0.45 || modal.greyRatio > 0.25) && modal.darkRatio > 0.01 && buttonBand.blueRatio > 0.01;
};

const appearsToHaveDevClientFloatingToolButton = (decoded) => {
  const topRight = sampleRegion(decoded, { left: 0.86, right: 0.99, top: 0.09, bottom: 0.19 });

  return topRight.greyRatio > 0.08 && topRight.lightRatio < 0.12 && topRight.blueRatio < 0.04;
};

const appearsToHaveErrorPrivacyStatusNotice = (decoded) => {
  const notice = sampleRegion(decoded, { left: 0.04, right: 0.96, top: 0.27, bottom: 0.42 });

  return notice.pinkNoticeRatio > 0.35 && notice.redAccentRatio > 0.001 && notice.darkRatio > 0.01;
};

const appearsToHaveProgressPrivacyStatusNotice = (decoded) => {
  const notice = sampleRegion(decoded, { left: 0.04, right: 0.96, top: 0.27, bottom: 0.42 });

  return notice.greenNoticeRatio > 0.35 && notice.greenAccentRatio > 0.002 && notice.darkRatio > 0.01;
};

const readPngInfo = (filePath, noticeKind) => {
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

  if (appearsToBeIosOpenUrlPrompt(decoded)) {
    failures.push(`${filePath} appears to include an iOS "Open in app" confirmation prompt.`);
  }

  if (appearsToHaveDevClientFloatingToolButton(decoded)) {
    failures.push(`${filePath} appears to include the development-client tools button.`);
  }

  const hasStatusNotice =
    noticeKind === "progress" ? appearsToHaveProgressPrivacyStatusNotice(decoded) : appearsToHaveErrorPrivacyStatusNotice(decoded);

  if (!hasStatusNotice) {
    failures.push(`${filePath} does not appear to show the Settings privacy ${noticeKind} status notice.`);
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

  for (const expected of expectedEvidence) {
    const evidenceFiles = outputFiles
      .filter((fileName) => fileName.startsWith("ios-") && fileName.endsWith(expected.suffix))
      .sort();

    if (evidenceFiles.length === 0) {
      failures.push(`No iOS settings privacy screenshot matching ios-*${expected.suffix} was found.`);
    }

    for (const fileName of evidenceFiles) {
      const info = readPngInfo(resolve(screenshotDir, fileName), expected.noticeKind);

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

  for (const expected of expectedEvidence) {
    if (!qaDeviceChecks.includes(expected.label)) {
      failures.push(`docs/release/qa-device-checks.md must mention the iOS ${expected.label} screenshot evidence.`);
    }
  }

  if (!checklist.includes("capture:ios-settings-privacy-evidence")) {
    failures.push("docs/release/ios-manual-qa-checklist.md must document the iOS settings privacy evidence capture command.");
  }
}

if (failures.length > 0) {
  console.error("iOS settings privacy evidence validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("iOS settings privacy evidence is present.");
