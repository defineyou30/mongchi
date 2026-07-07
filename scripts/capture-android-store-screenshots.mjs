import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { connect } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const MOBILE_ROOT = resolve(ROOT, "apps/mobile");
const manifest = JSON.parse(readFileSync(resolve(ROOT, "docs/store-screenshot-manifest.json"), "utf8"));
const appConfig = JSON.parse(readFileSync(resolve(ROOT, "apps/mobile/app.json"), "utf8"));
const requestedPresets = (process.env.TINY_PET_ANDROID_STORE_SCREENSHOT_PRESETS ?? "")
  .split(",")
  .map((preset) => preset.trim())
  .filter(Boolean);
const clientMode = (process.env.TINY_PET_ANDROID_STORE_SCREENSHOT_CLIENT ?? "development-client").trim().toLowerCase();
const port = Number.parseInt(process.env.TINY_PET_ANDROID_STORE_SCREENSHOT_PORT ?? "8093", 10);
const androidHost = (process.env.TINY_PET_ANDROID_STORE_SCREENSHOT_HOST ?? "10.0.2.2").trim();
const startupTimeoutMs = Number.parseInt(process.env.TINY_PET_ANDROID_STORE_SCREENSHOT_STARTUP_TIMEOUT_MS ?? "90000", 10);
const settleMs = Number.parseInt(process.env.TINY_PET_ANDROID_STORE_SCREENSHOT_SETTLE_MS ?? "10000", 10);
const captureRetryCount = Number.parseInt(process.env.TINY_PET_ANDROID_STORE_SCREENSHOT_CAPTURE_RETRY_COUNT ?? "10", 10);
const captureRetryDelayMs = Number.parseInt(process.env.TINY_PET_ANDROID_STORE_SCREENSHOT_CAPTURE_RETRY_DELAY_MS ?? "7500", 10);
const skipValidate = /^(true|1|yes)$/i.test(process.env.TINY_PET_ANDROID_STORE_SCREENSHOT_SKIP_VALIDATE ?? "");
const requestedDeviceSerial = (process.env.TINY_PET_ANDROID_STORE_SCREENSHOT_SERIAL ?? "").trim();
const labelPrefix = (process.env.TINY_PET_ANDROID_STORE_SCREENSHOT_LABEL_PREFIX ?? "").trim();
const screenshots = Array.isArray(manifest.screenshots) ? manifest.screenshots : [];
const validClientModes = new Set(["expo-go", "development-client"]);
const appScheme = appConfig.expo?.scheme;
const androidPackage = appConfig.expo?.android?.package;

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

assertPositiveInteger(port, "TINY_PET_ANDROID_STORE_SCREENSHOT_PORT");
assertPositiveInteger(startupTimeoutMs, "TINY_PET_ANDROID_STORE_SCREENSHOT_STARTUP_TIMEOUT_MS");
assertPositiveInteger(settleMs, "TINY_PET_ANDROID_STORE_SCREENSHOT_SETTLE_MS");
assertPositiveInteger(captureRetryCount, "TINY_PET_ANDROID_STORE_SCREENSHOT_CAPTURE_RETRY_COUNT");
assertPositiveInteger(captureRetryDelayMs, "TINY_PET_ANDROID_STORE_SCREENSHOT_CAPTURE_RETRY_DELAY_MS");

if (!androidHost || /[\u0000-\u001f\s]/.test(androidHost)) {
  console.error("TINY_PET_ANDROID_STORE_SCREENSHOT_HOST must be a host name or IP address without whitespace.");
  process.exit(1);
}

if (!validClientModes.has(clientMode)) {
  console.error('TINY_PET_ANDROID_STORE_SCREENSHOT_CLIENT must be "expo-go" or "development-client".');
  process.exit(1);
}

if (clientMode === "development-client" && (!appScheme || !androidPackage)) {
  console.error("apps/mobile/app.json must define expo.scheme and expo.android.package for development-client capture.");
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

if (!commandExists("adb")) {
  console.error("adb is required to launch and capture Android emulator/device screenshots.");
  process.exit(1);
}

const connectedDevices = (() => {
  const result = runText("adb", ["devices"]);

  if (result.status !== 0) {
    console.error(result.stderr.trim() || "Unable to list Android emulator/devices.");
    process.exit(1);
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
      const name = modelResult.status === 0 ? modelResult.stdout.trim() : "";

      return {
        name: name || serial,
        serial
      };
    });
})();

if (connectedDevices.length === 0) {
  console.error("No connected Android emulator/device found. Run this only during the final Android pass.");
  process.exit(1);
}

const selectedDevice = requestedDeviceSerial
  ? connectedDevices.find((device) => device.serial === requestedDeviceSerial)
  : connectedDevices[0];

if (!selectedDevice) {
  console.error(`No connected Android emulator/device matched serial ${requestedDeviceSerial}.`);
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

const runAdb = (args) => runText("adb", ["-s", selectedDevice.serial, ...args]);
const shellQuote = (value) => `'${String(value).replace(/'/g, "'\\''")}'`;

const primeDevelopmentClientPreferences = () => {
  if (clientMode !== "development-client") {
    return;
  }

  const preferencesXml = [
    '<?xml version="1.0" encoding="utf-8" standalone="yes" ?>',
    "<map>",
    '  <boolean name="isOnboardingFinished" value="true" />',
    '  <boolean name="showFab" value="false" />',
    '  <boolean name="showsAtLaunch" value="false" />',
    "</map>"
  ].join("\n");
  const encodedPreferences = Buffer.from(preferencesXml, "utf8").toString("base64");
  const command = [
    "mkdir -p shared_prefs",
    `echo ${shellQuote(encodedPreferences)} | base64 -d > shared_prefs/expo.modules.devmenu.sharedpreferences.xml`
  ].join(" && ");

  runAdb(["shell", `run-as ${shellQuote(androidPackage)} sh -c ${shellQuote(command)}`]);
};

const openPresetOnAndroid = (preset) => {
  const manifestUrl = new URL(`http://${androidHost}:${port}`);

  if (clientMode === "development-client") {
    manifestUrl.searchParams.set("disableOnboarding", "1");
  }

  const launchUrl =
    clientMode === "development-client"
      ? `${appScheme}://expo-development-client/?url=${encodeURIComponent(manifestUrl.toString())}&disableOnboarding=1`
      : `exp://${androidHost}:${port}`;
  const packageName = clientMode === "development-client" ? androidPackage : "host.exp.exponent";

  runAdb(["shell", `am force-stop ${shellQuote(packageName)}`]);
  primeDevelopmentClientPreferences();
  const result = runAdb([
    "shell",
    `am start -a android.intent.action.VIEW -d ${shellQuote(launchUrl)} -p ${shellQuote(packageName)}`
  ]);

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `Unable to open ${clientMode} URL for preset ${preset}.`);
  }
};

const capturePreset = async (entry) => {
  const captureLabel = labelPrefix ? `${labelPrefix}-${entry.captureLabel}` : entry.captureLabel;

  for (let attempt = 1; attempt <= captureRetryCount; attempt++) {
    const result = runText("node", ["scripts/capture-mobile-qa-screenshots.mjs"], {
      cwd: ROOT,
      env: {
        ...process.env,
        TINY_PET_QA_PLATFORM: "android",
        TINY_PET_QA_ANDROID_SERIAL: selectedDevice.serial,
        TINY_PET_QA_ANDROID_EXPECT_PACKAGE: clientMode === "development-client" ? androidPackage : "host.exp.exponent",
        TINY_PET_QA_LABEL: captureLabel
      }
    });

    if (result.status === 0) {
      process.stdout.write(result.stdout);
      return;
    }

    const message = result.stderr.trim() || result.stdout.trim() || `Unable to capture ${entry.preset}.`;

    if (
      attempt < captureRetryCount &&
      (message.includes("blank loading screen") || message.includes("flat splash screen"))
    ) {
      await sleep(captureRetryDelayMs);
      continue;
    }

    throw new Error(message);
  }
};

const validateAndroidCoverage = () => {
  const result = runText("npm", ["run", "validate:android-store-screenshots"], { cwd: ROOT });

  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const generateContactSheet = () => {
  const result = runText("npm", ["run", "generate:android-store-contact-sheet"], { cwd: ROOT });

  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

for (const entry of selectedScreenshots) {
  console.log(`\n> Capturing Android store preset: ${entry.preset} (${clientMode})`);
  const { metroProcess, metroOutput } = startMetro(entry.preset);

  try {
    await waitForMetro(metroProcess, metroOutput, entry.preset);
    openPresetOnAndroid(entry.preset);
    await sleep(settleMs);
    await capturePreset(entry);
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
  validateAndroidCoverage();
  generateContactSheet();
} else {
  console.log(
    `\nSkipped full Android store screenshot coverage validation because ${
      labelPrefix ? "a custom screenshot label prefix was used" : "only a subset was captured"
    }.`
  );
}
