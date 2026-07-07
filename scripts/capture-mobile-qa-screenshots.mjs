import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const OUTPUT_DIR = resolve(ROOT, process.env.TINY_PET_QA_OUTPUT_DIR ?? "docs/qa-screenshots");
const PLATFORM = (process.env.TINY_PET_QA_PLATFORM ?? "auto").trim().toLowerCase();
const LABEL = process.env.TINY_PET_QA_LABEL ?? "current";
const IOS_UDID = (process.env.TINY_PET_QA_IOS_UDID ?? "").trim();
const ANDROID_SERIAL = (process.env.TINY_PET_QA_ANDROID_SERIAL ?? "").trim();
const ANDROID_EXPECT_PACKAGE = (process.env.TINY_PET_QA_ANDROID_EXPECT_PACKAGE ?? "").trim();
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const VALID_PLATFORMS = new Set(["auto", "all", "ios", "android"]);

if (!VALID_PLATFORMS.has(PLATFORM)) {
  console.error(`Unsupported TINY_PET_QA_PLATFORM "${PLATFORM}". Use auto, all, ios, or android.`);
  process.exit(1);
}

const runText = (command, args) => spawnSync(command, args, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
const runBinary = (command, args) => spawnSync(command, args, { encoding: "buffer", maxBuffer: 30 * 1024 * 1024 });

const commandExists = (command) => runText("sh", ["-lc", `command -v ${command} >/dev/null 2>&1`]).status === 0;

const slug = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "device";

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
  let creamPixels = 0;

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

      if (red > 220 && green > 185 && blue > 135) {
        creamPixels += 1;
      }
    }
  }

  return {
    blueRatio: sampled > 0 ? bluePixels / sampled : 0,
    creamRatio: sampled > 0 ? creamPixels / sampled : 0,
    darkRatio: sampled > 0 ? darkPixels / sampled : 0,
    greyRatio: sampled > 0 ? greyPixels / sampled : 0,
    lightRatio: sampled > 0 ? lightPixels / sampled : 0
  };
};

const sampleVisualComplexity = (decoded, region) => {
  const xStart = Math.floor(decoded.width * region.left);
  const xEnd = Math.floor(decoded.width * region.right);
  const yStart = Math.floor(decoded.height * region.top);
  const yEnd = Math.floor(decoded.height * region.bottom);
  const buckets = new Set();
  let previous = null;
  let totalDelta = 0;
  let transitions = 0;
  let sampled = 0;

  for (let y = yStart; y < yEnd; y += 12) {
    for (let x = xStart; x < xEnd; x += 12) {
      const index = (decoded.width * y + x) << 2;
      const red = decoded.data[index];
      const green = decoded.data[index + 1];
      const blue = decoded.data[index + 2];
      const alpha = decoded.data[index + 3];

      if (alpha <= 200) {
        continue;
      }

      const bucket = `${Math.floor(red / 32)}:${Math.floor(green / 32)}:${Math.floor(blue / 32)}`;
      buckets.add(bucket);
      sampled += 1;

      if (previous) {
        totalDelta +=
          Math.abs(red - previous.red) + Math.abs(green - previous.green) + Math.abs(blue - previous.blue);
        transitions += 1;
      }

      previous = { blue, green, red };
    }
  }

  return {
    averageDelta: transitions > 0 ? totalDelta / transitions : 0,
    bucketCount: buckets.size,
    sampled
  };
};

const appearsToBeIosOpenUrlPrompt = (decoded) => {
  const modal = sampleRegion(decoded, { left: 0.16, right: 0.84, top: 0.43, bottom: 0.58 });
  const buttonBand = sampleRegion(decoded, { left: 0.2, right: 0.8, top: 0.52, bottom: 0.57 });

  return (modal.lightRatio > 0.45 || modal.greyRatio > 0.25) && modal.darkRatio > 0.01 && buttonBand.blueRatio > 0.01;
};

const appearsToHaveDevClientFloatingToolButton = (decoded) => {
  const topRight = sampleRegion(decoded, { left: 0.86, right: 0.99, top: 0.09, bottom: 0.19 });
  const topLeft = sampleRegion(decoded, { left: 0.04, right: 0.17, top: 0.09, bottom: 0.19 });
  const topMiddle = sampleRegion(decoded, { left: 0.67, right: 0.8, top: 0.09, bottom: 0.19 });
  const localGreyLift = topRight.greyRatio - Math.max(topLeft.greyRatio, topMiddle.greyRatio);

  return (
    localGreyLift > 0.12 &&
    topRight.greyRatio > 0.18 &&
    topRight.lightRatio < 0.12 &&
    topRight.blueRatio < 0.04 &&
    topRight.creamRatio < 0.18
  );
};

const readPngInfo = (filePath, options = {}) => {
  const rejectIosOpenUrlPrompt = options.rejectIosOpenUrlPrompt ?? true;

  if (!existsSync(filePath) || statSync(filePath).size === 0) {
    throw new Error(`${filePath} was not created or is empty`);
  }

  const bytes = readFileSync(filePath);

  if (bytes.length < 33 || !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error(`${filePath} is not a PNG screenshot`);
  }

  const decoded = PNG.sync.read(bytes);
  const fullScreen = sampleRegion(decoded, { left: 0.04, right: 0.96, top: 0.08, bottom: 0.92 });
  const centralComplexity = sampleVisualComplexity(decoded, { left: 0.12, right: 0.88, top: 0.18, bottom: 0.82 });
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
    throw new Error(`${filePath} appears to be a React Native red error screen, not a valid app screenshot`);
  }

  if (fullScreen.lightRatio > 0.92 && fullScreen.darkRatio < 0.02 && fullScreen.blueRatio < 0.02) {
    throw new Error(`${filePath} appears to be a blank loading screen, not a rendered app screenshot`);
  }

  if (centralComplexity.sampled > 0 && centralComplexity.bucketCount <= 3 && centralComplexity.averageDelta < 3) {
    throw new Error(`${filePath} appears to be a flat splash screen, not a rendered app screenshot`);
  }

  if (rejectIosOpenUrlPrompt && appearsToBeIosOpenUrlPrompt(decoded)) {
    throw new Error(`${filePath} appears to include an iOS "Open in app" confirmation prompt, not a clean app screenshot`);
  }

  if (appearsToHaveDevClientFloatingToolButton(decoded)) {
    throw new Error(`${filePath} appears to include the development-client tools button, not a clean app screenshot`);
  }

  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    size: bytes.length
  };
};

const findBootedIosDevices = () => {
  if (!commandExists("xcrun")) {
    return [];
  }

  const result = runText("xcrun", ["simctl", "list", "devices", "booted", "--json"]);

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "Unable to list booted iOS simulators");
  }

  const parsed = JSON.parse(result.stdout);
  const devicesByRuntime = parsed.devices ?? {};

  return Object.entries(devicesByRuntime).flatMap(([runtime, devices]) =>
    devices
      .filter((device) => device.state === "Booted")
      .map((device) => ({
        name: device.name,
        runtime,
        udid: device.udid
      }))
  );
};

const findConnectedAndroidDevices = () => {
  if (!commandExists("adb")) {
    return [];
  }

  const result = runText("adb", ["devices"]);

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "Unable to list Android devices");
  }

  return result.stdout
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/))
    .filter(([, state]) => state === "device")
    .map(([serial]) => {
      const modelResult = runText("adb", ["-s", serial, "shell", "getprop", "ro.product.model"]);
      const model = modelResult.status === 0 ? modelResult.stdout.trim() : "";
      return {
        name: model || serial,
        serial
      };
    });
};

const captureIos = (device) => {
  const fileName = `ios-${slug(device.name)}-${slug(LABEL)}.png`;
  const filePath = resolve(OUTPUT_DIR, fileName);
  const result = runText("xcrun", ["simctl", "io", device.udid, "screenshot", filePath]);

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `Unable to capture ${device.name}`);
  }

  return {
    platform: "ios",
    deviceName: device.name,
    filePath,
    ...readPngInfo(filePath)
  };
};

const captureAndroid = (device) => {
  const fileName = `android-${slug(device.name)}-${slug(LABEL)}.png`;
  const filePath = resolve(OUTPUT_DIR, fileName);

  if (ANDROID_EXPECT_PACKAGE) {
    const focusResult = runText("adb", ["-s", device.serial, "shell", "dumpsys", "window"]);

    if (focusResult.status !== 0) {
      throw new Error(focusResult.stderr.trim() || `Unable to inspect foreground Android window for ${device.name}`);
    }

    const focusLines = focusResult.stdout
      .split(/\r?\n/)
      .filter((line) => line.includes("mCurrentFocus=") || line.includes("mFocusedApp="));
    const systemFailureLine = focusLines.find(
      (line) => line.includes("Application Not Responding") || line.includes("Application Error")
    );
    const focusedAppLine = focusLines.find((line) => line.includes(`${ANDROID_EXPECT_PACKAGE}/`));

    if (systemFailureLine) {
      throw new Error(`${device.name} is showing a system app failure dialog: ${systemFailureLine.trim()}`);
    }

    if (!focusedAppLine) {
      throw new Error(
        `${device.name} foreground is not ${ANDROID_EXPECT_PACKAGE}; focused window was: ${
          focusLines.map((line) => line.trim()).join(" / ") || "unknown"
        }`
      );
    }
  }

  const result = runBinary("adb", ["-s", device.serial, "exec-out", "screencap", "-p"]);

  if (result.status !== 0) {
    throw new Error(result.stderr?.toString("utf8").trim() || `Unable to capture ${device.name}`);
  }

  writeFileSync(filePath, result.stdout);

  return {
    platform: "android",
    deviceName: device.name,
    filePath,
    ...readPngInfo(filePath, { rejectIosOpenUrlPrompt: false })
  };
};

const shouldCaptureIos = PLATFORM === "auto" || PLATFORM === "all" || PLATFORM === "ios";
const shouldCaptureAndroid = PLATFORM === "auto" || PLATFORM === "all" || PLATFORM === "android";
const captures = [];
const failures = [];

mkdirSync(OUTPUT_DIR, { recursive: true });

if (shouldCaptureIos) {
  const devices = findBootedIosDevices().filter((device) => !IOS_UDID || device.udid === IOS_UDID);

  if (devices.length === 0 && PLATFORM !== "auto") {
    failures.push(IOS_UDID ? `No booted iOS simulator found for UDID ${IOS_UDID}.` : "No booted iOS simulator found.");
  }

  for (const device of devices) {
    try {
      captures.push(captureIos(device));
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
}

if (shouldCaptureAndroid) {
  const devices = findConnectedAndroidDevices().filter((device) => !ANDROID_SERIAL || device.serial === ANDROID_SERIAL);

  if (devices.length === 0 && PLATFORM !== "auto") {
    failures.push(ANDROID_SERIAL ? `No connected Android emulator/device found for serial ${ANDROID_SERIAL}.` : "No connected Android emulator/device found.");
  }

  for (const device of devices) {
    try {
      captures.push(captureAndroid(device));
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
}

if (captures.length === 0) {
  failures.push("No mobile QA screenshots were captured.");
}

if (failures.length > 0) {
  console.error("Mobile QA screenshot capture failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Captured mobile QA screenshots:");
for (const capture of captures) {
  console.log(`- ${capture.platform} ${capture.deviceName}: ${capture.filePath} (${capture.width}x${capture.height}, ${capture.size} bytes)`);
}
