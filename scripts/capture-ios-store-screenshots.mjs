import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { connect } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const MOBILE_ROOT = resolve(ROOT, "apps/mobile");
const manifest = JSON.parse(readFileSync(resolve(ROOT, "docs/store-screenshot-manifest.json"), "utf8"));
const appConfig = JSON.parse(readFileSync(resolve(ROOT, "apps/mobile/app.json"), "utf8"));
const requestedPresets = (process.env.TINY_PET_IOS_STORE_SCREENSHOT_PRESETS ?? "")
  .split(",")
  .map((preset) => preset.trim())
  .filter(Boolean);
const clientMode = (process.env.TINY_PET_IOS_STORE_SCREENSHOT_CLIENT ?? "expo-go").trim().toLowerCase();
const port = Number.parseInt(process.env.TINY_PET_IOS_STORE_SCREENSHOT_PORT ?? "8091", 10);
const startupTimeoutMs = Number.parseInt(process.env.TINY_PET_IOS_STORE_SCREENSHOT_STARTUP_TIMEOUT_MS ?? "90000", 10);
const settleMs = Number.parseInt(process.env.TINY_PET_IOS_STORE_SCREENSHOT_SETTLE_MS ?? "10000", 10);
const skipValidate = /^(true|1|yes)$/i.test(process.env.TINY_PET_IOS_STORE_SCREENSHOT_SKIP_VALIDATE ?? "");
const requestedDeviceUdid = (process.env.TINY_PET_IOS_STORE_SCREENSHOT_DEVICE_UDID ?? "").trim();
const requestedDeviceName = (process.env.TINY_PET_IOS_STORE_SCREENSHOT_DEVICE_NAME ?? "").trim();
const labelPrefix = (process.env.TINY_PET_IOS_STORE_SCREENSHOT_LABEL_PREFIX ?? "").trim();
const weatherCondition = (process.env.EXPO_PUBLIC_TINY_PET_STORE_SCREENSHOT_WEATHER_CONDITION ?? "").trim();
const screenshots = Array.isArray(manifest.screenshots) ? manifest.screenshots : [];
const validClientModes = new Set(["expo-go", "development-client"]);
const appScheme = appConfig.expo?.scheme;
const iosBundleIdentifier = appConfig.expo?.ios?.bundleIdentifier;

const runText = (command, args, options = {}) =>
  spawnSync(command, args, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024, ...options });

const commandExists = (command) => runText("sh", ["-lc", `command -v ${command} >/dev/null 2>&1`]).status === 0;

const sleep = (durationMs) => new Promise((resolveSleep) => setTimeout(resolveSleep, durationMs));

const assertPositiveInteger = (value, name) => {
  if (!Number.isInteger(value) || value <= 0) {
    console.error(`${name} must be a positive integer.`);
    process.exit(1);
  }
};

assertPositiveInteger(port, "TINY_PET_IOS_STORE_SCREENSHOT_PORT");
assertPositiveInteger(startupTimeoutMs, "TINY_PET_IOS_STORE_SCREENSHOT_STARTUP_TIMEOUT_MS");
assertPositiveInteger(settleMs, "TINY_PET_IOS_STORE_SCREENSHOT_SETTLE_MS");

if (!commandExists("xcrun")) {
  console.error("xcrun is required to launch and capture iOS simulator screenshots.");
  process.exit(1);
}

if (!validClientModes.has(clientMode)) {
  console.error('TINY_PET_IOS_STORE_SCREENSHOT_CLIENT must be "expo-go" or "development-client".');
  process.exit(1);
}

if (clientMode === "development-client" && (!appScheme || !iosBundleIdentifier)) {
  console.error("apps/mobile/app.json must define expo.scheme and expo.ios.bundleIdentifier for development-client capture.");
  process.exit(1);
}

const availablePresets = new Set(screenshots.map((entry) => entry.preset));
const unsupportedPresets = requestedPresets.filter((preset) => !availablePresets.has(preset));

if (unsupportedPresets.length > 0) {
  console.error(`Unsupported store screenshot preset(s): ${unsupportedPresets.join(", ")}.`);
  console.error(`Supported presets: ${[...availablePresets].join(", ")}`);
  process.exit(1);
}

const selectedScreenshots =
  requestedPresets.length > 0 ? screenshots.filter((entry) => requestedPresets.includes(entry.preset)) : screenshots;

if (selectedScreenshots.length === 0) {
  console.error("No store screenshot presets selected.");
  process.exit(1);
}

const bootedDevices = (() => {
  const result = runText("xcrun", ["simctl", "list", "devices", "booted", "--json"]);

  if (result.status !== 0) {
    console.error(result.stderr.trim() || "Unable to list booted iOS simulators.");
    process.exit(1);
  }

  const parsed = JSON.parse(result.stdout);

  return Object.values(parsed.devices ?? {})
    .flat()
    .filter((device) => device.state === "Booted");
})();

if (bootedDevices.length === 0) {
  console.error("No booted iOS simulator found. Boot an iOS simulator before running this script.");
  process.exit(1);
}

const selectedDevice = requestedDeviceUdid
  ? bootedDevices.find((device) => device.udid === requestedDeviceUdid)
  : requestedDeviceName
    ? bootedDevices.find((device) => device.name === requestedDeviceName)
    : bootedDevices[0];

if (!selectedDevice) {
  console.error(
    `No matching booted iOS simulator found for ${
      requestedDeviceUdid ? `UDID ${requestedDeviceUdid}` : `name ${requestedDeviceName}`
    }.`
  );
  process.exit(1);
}

const isMetroPortOpen = () =>
  new Promise((resolveOpen) => {
    const socket = connect({ host: "127.0.0.1", port });
    const done = (open) => {
      socket.destroy();
      resolveOpen(open);
    };

    socket.setTimeout(1000);
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.once("timeout", () => done(false));
  });

const waitForMetro = async (metroProcess, metroOutput, preset) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < startupTimeoutMs) {
    if (metroProcess.exitCode !== null) {
      throw new Error(`Expo Metro exited before ${preset} was ready.`);
    }

    if (await isMetroPortOpen()) {
      return;
    }

    if (metroOutput.join("").includes(`Waiting on http://localhost:${port}`)) {
      await sleep(2000);
      return;
    }

    await sleep(1000);
  }

  throw new Error(`Timed out waiting for Expo Metro on port ${port} for preset ${preset}.`);
};

const startMetro = (preset) => {
  const metroOutput = [];
  const metroProcess = spawn("npx", ["expo", "start", "--clear", "--port", String(port)], {
    cwd: MOBILE_ROOT,
    env: {
      ...process.env,
      BROWSER: "none",
      EXPO_NO_TELEMETRY: "1",
      EXPO_PUBLIC_TINY_PET_STORE_SCREENSHOT_PRESET: preset
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  const collectOutput = (chunk) => {
    metroOutput.push(chunk.toString("utf8"));

    if (metroOutput.length > 40) {
      metroOutput.shift();
    }
  };

  metroProcess.stdout.on("data", collectOutput);
  metroProcess.stderr.on("data", collectOutput);

  return { metroProcess, metroOutput };
};

const stopMetro = async (metroProcess) => {
  if (metroProcess.exitCode !== null) {
    return;
  }

  metroProcess.kill("SIGTERM");

  for (let attempt = 0; attempt < 20; attempt++) {
    if (metroProcess.exitCode !== null) {
      return;
    }

    await sleep(250);
  }

  metroProcess.kill("SIGKILL");
};

const primeDevelopmentClient = (device) => {
  if (clientMode !== "development-client") {
    return;
  }

  const result = runText("xcrun", [
    "simctl",
    "spawn",
    device.udid,
    "defaults",
    "write",
    iosBundleIdentifier,
    "EXDevMenuIsOnboardingFinished",
    "-bool",
    "true"
  ]);

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "Unable to prime the development-client onboarding preference.");
  }

  const floatingButtonResult = runText("xcrun", [
    "simctl",
    "spawn",
    device.udid,
    "defaults",
    "write",
    iosBundleIdentifier,
    "EXDevMenuShowFloatingActionButton",
    "-bool",
    "false"
  ]);

  if (floatingButtonResult.status !== 0) {
    throw new Error(floatingButtonResult.stderr.trim() || "Unable to hide the development-client tools button.");
  }

  const launchMenuResult = runText("xcrun", [
    "simctl",
    "spawn",
    device.udid,
    "defaults",
    "write",
    iosBundleIdentifier,
    "EXDevMenuShowsAtLaunch",
    "-bool",
    "false"
  ]);

  if (launchMenuResult.status !== 0) {
    throw new Error(launchMenuResult.stderr.trim() || "Unable to disable the development-client launch menu.");
  }
};

const openPresetInSimulator = (preset) => {
  const manifestUrl = new URL(`http://127.0.0.1:${port}`);

  if (clientMode === "development-client") {
    manifestUrl.searchParams.set("disableOnboarding", "1");
  }

  if (weatherCondition) {
    manifestUrl.searchParams.set("weatherCondition", weatherCondition);
  }

  const launchUrl =
    clientMode === "development-client"
      ? `${appScheme}://expo-development-client/?url=${encodeURIComponent(manifestUrl.toString())}&disableOnboarding=1`
      : `exp://127.0.0.1:${port}`;
  const bundleIdentifier = clientMode === "development-client" ? iosBundleIdentifier : "host.exp.Exponent";

  primeDevelopmentClient(selectedDevice);
  runText("xcrun", ["simctl", "terminate", selectedDevice.udid, bundleIdentifier]);
  const result = runText("xcrun", ["simctl", "openurl", selectedDevice.udid, launchUrl]);

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `Unable to open ${clientMode} URL for preset ${preset}.`);
  }
};

const capturePreset = (entry) => {
  const captureLabel = labelPrefix ? `${labelPrefix}-${entry.captureLabel}` : entry.captureLabel;
  const result = runText("node", ["scripts/capture-mobile-qa-screenshots.mjs"], {
    cwd: ROOT,
    env: {
      ...process.env,
      TINY_PET_QA_PLATFORM: "ios",
      TINY_PET_QA_IOS_UDID: selectedDevice.udid,
      TINY_PET_QA_LABEL: captureLabel
    }
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `Unable to capture ${entry.preset}.`);
  }

  process.stdout.write(result.stdout);
};

const validateIosCoverage = () => {
  const result = runText("npm", ["run", "validate:ios-store-screenshots"], { cwd: ROOT });

  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const generateContactSheet = () => {
  const result = runText("npm", ["run", "generate:ios-store-contact-sheet"], { cwd: ROOT });

  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

for (const entry of selectedScreenshots) {
  console.log(`\n> Capturing iOS store preset: ${entry.preset} (${clientMode})`);
  const { metroProcess, metroOutput } = startMetro(entry.preset);

  try {
    await waitForMetro(metroProcess, metroOutput, entry.preset);
    openPresetInSimulator(entry.preset);
    await sleep(settleMs);
    capturePreset(entry);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));

    if (metroOutput.length > 0) {
      console.error("\nRecent Expo Metro output:");
      console.error(metroOutput.join("").trim());
    }

    await stopMetro(metroProcess);
    process.exit(1);
  }

  await stopMetro(metroProcess);
}

if (selectedScreenshots.length === screenshots.length && !skipValidate && !labelPrefix) {
  validateIosCoverage();
  generateContactSheet();
} else {
  console.log(
    `\nSkipped full iOS store screenshot coverage validation because ${
      labelPrefix ? "a custom screenshot label prefix was used" : "only a subset was captured"
    }.`
  );
}
