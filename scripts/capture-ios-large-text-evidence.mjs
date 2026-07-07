import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const manifest = JSON.parse(readFileSync(resolve(ROOT, "docs/store-screenshot-manifest.json"), "utf8"));
const screenshots = Array.isArray(manifest.screenshots) ? manifest.screenshots : [];
const requestedDeviceUdid = (process.env.TINY_PET_IOS_LARGE_TEXT_DEVICE_UDID ?? "").trim();
const requestedDeviceName = (process.env.TINY_PET_IOS_LARGE_TEXT_DEVICE_NAME ?? "iPhone 16e").trim();
const requestedPresets = (process.env.TINY_PET_IOS_LARGE_TEXT_PRESETS ?? "")
  .split(",")
  .map((preset) => preset.trim())
  .filter(Boolean);
const contentSize = (process.env.TINY_PET_IOS_LARGE_TEXT_CONTENT_SIZE ?? "extra-large").trim();
const port = process.env.TINY_PET_IOS_LARGE_TEXT_PORT ?? "8095";
const settleMs = process.env.TINY_PET_IOS_LARGE_TEXT_SETTLE_MS ?? "12000";

const runText = (command, args, options = {}) =>
  spawnSync(command, args, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024, ...options });

const runInherit = (command, args, options = {}) => spawnSync(command, args, { stdio: "inherit", ...options });

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const bootedDevicesResult = runText("xcrun", ["simctl", "list", "devices", "booted", "--json"]);

if (bootedDevicesResult.status !== 0) {
  fail(bootedDevicesResult.stderr.trim() || "Unable to list booted iOS simulators.");
}

const bootedDevices = Object.values(JSON.parse(bootedDevicesResult.stdout).devices ?? {})
  .flat()
  .filter((device) => device.state === "Booted");
const selectedDevice = requestedDeviceUdid
  ? bootedDevices.find((device) => device.udid === requestedDeviceUdid)
  : bootedDevices.find((device) => device.name === requestedDeviceName);

if (!selectedDevice) {
  fail(
    `No matching booted iOS simulator found for ${
      requestedDeviceUdid ? `UDID ${requestedDeviceUdid}` : `name ${requestedDeviceName}`
    }. Boot the small iOS simulator or set TINY_PET_IOS_LARGE_TEXT_DEVICE_UDID.`
  );
}

const selectedPresets =
  requestedPresets.length > 0
    ? requestedPresets
    : screenshots.map((entry) => entry.preset);
const unsupportedPresets = selectedPresets.filter((preset) => !screenshots.some((entry) => entry.preset === preset));

if (unsupportedPresets.length > 0) {
  fail(`Unsupported large-text preset(s): ${unsupportedPresets.join(", ")}.`);
}

const previousContentSizeResult = runText("xcrun", ["simctl", "ui", selectedDevice.udid, "content_size"]);

if (previousContentSizeResult.status !== 0) {
  fail(previousContentSizeResult.stderr.trim() || "Unable to read current iOS content size.");
}

const previousContentSize = previousContentSizeResult.stdout.trim();

const setContentSize = (value) => {
  const result = runText("xcrun", ["simctl", "ui", selectedDevice.udid, "content_size", value]);

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `Unable to set iOS content size to ${value}.`);
  }
};

let failureStatus = 0;

try {
  console.log(`Setting ${selectedDevice.name} content size to ${contentSize} for large-text evidence...`);
  setContentSize(contentSize);

  const captureResult = runInherit("npm", ["run", "capture:ios-store-screenshots"], {
    cwd: ROOT,
    env: {
      ...process.env,
      TINY_PET_IOS_STORE_SCREENSHOT_CLIENT: "development-client",
      TINY_PET_IOS_STORE_SCREENSHOT_DEVICE_UDID: selectedDevice.udid,
      TINY_PET_IOS_STORE_SCREENSHOT_LABEL_PREFIX: "large-text",
      TINY_PET_IOS_STORE_SCREENSHOT_PORT: port,
      TINY_PET_IOS_STORE_SCREENSHOT_PRESETS: selectedPresets.join(","),
      TINY_PET_IOS_STORE_SCREENSHOT_SETTLE_MS: settleMs
    }
  });

  if (captureResult.status !== 0) {
    failureStatus = captureResult.status ?? 1;
  } else {
    const generateResult = runInherit("npm", ["run", "generate:ios-large-text-contact-sheet"], { cwd: ROOT });
    failureStatus = generateResult.status ?? 0;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  failureStatus = 1;
} finally {
  if (previousContentSize && previousContentSize !== "unknown" && previousContentSize !== "unsupported") {
    console.log(`Restoring ${selectedDevice.name} content size to ${previousContentSize}...`);
    try {
      setContentSize(previousContentSize);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      failureStatus = failureStatus || 1;
    }
  }
}

if (failureStatus !== 0) {
  process.exit(failureStatus);
}
