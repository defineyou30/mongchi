import { spawn, spawnSync } from "node:child_process";
import { connect } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const MOBILE_ROOT = resolve(ROOT, "apps/mobile");
const port = Number.parseInt(process.env.TINY_PET_IOS_SETTINGS_PRIVACY_PORT ?? "8096", 10);
const startupTimeoutMs = Number.parseInt(process.env.TINY_PET_IOS_SETTINGS_PRIVACY_STARTUP_TIMEOUT_MS ?? "90000", 10);
const settleMs = Number.parseInt(process.env.TINY_PET_IOS_SETTINGS_PRIVACY_SETTLE_MS ?? "10000", 10);
const supportedPresets = new Set(["settings-privacy-error", "settings-privacy-progress"]);
const preset = process.env.TINY_PET_IOS_SETTINGS_PRIVACY_PRESET?.trim() || "settings-privacy-error";
const defaultLabel = preset === "settings-privacy-progress" ? "settings-privacy-progress" : "settings-privacy-status";
const label = process.env.TINY_PET_IOS_SETTINGS_PRIVACY_LABEL ?? defaultLabel;

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

assertPositiveInteger(port, "TINY_PET_IOS_SETTINGS_PRIVACY_PORT");
assertPositiveInteger(startupTimeoutMs, "TINY_PET_IOS_SETTINGS_PRIVACY_STARTUP_TIMEOUT_MS");
assertPositiveInteger(settleMs, "TINY_PET_IOS_SETTINGS_PRIVACY_SETTLE_MS");

if (!supportedPresets.has(preset)) {
  console.error("TINY_PET_IOS_SETTINGS_PRIVACY_PRESET must be settings-privacy-error or settings-privacy-progress.");
  process.exit(1);
}

if (!commandExists("xcrun")) {
  console.error("xcrun is required to launch and capture iOS simulator screenshots.");
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

const requestedUdid = process.env.TINY_PET_QA_IOS_UDID?.trim() ?? "";
const targetDevice = requestedUdid
  ? bootedDevices.find((device) => device.udid === requestedUdid)
  : bootedDevices[0];

if (!targetDevice) {
  console.error(`No booted iOS simulator matched TINY_PET_QA_IOS_UDID=${requestedUdid}.`);
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

const waitForMetro = async (metroProcess, metroOutput) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < startupTimeoutMs) {
    if (metroProcess.exitCode !== null) {
      throw new Error("Expo Metro exited before the settings privacy QA screen was ready.");
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

  throw new Error(`Timed out waiting for Expo Metro on port ${port}.`);
};

const startMetro = () => {
  const metroOutput = [];
  const metroProcess = spawn("npx", ["expo", "start", "--clear", "--port", String(port)], {
    cwd: MOBILE_ROOT,
    env: {
      ...process.env,
      BROWSER: "none",
      EXPO_NO_TELEMETRY: "1",
      EXPO_PUBLIC_TINY_PET_QA_SCREEN_PRESET: preset
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
  if (!metroProcess || metroProcess.exitCode !== null) {
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

const openSettingsInSimulator = () => {
  runText("xcrun", ["simctl", "terminate", targetDevice.udid, "host.exp.Exponent"]);
  const result = runText("xcrun", ["simctl", "openurl", targetDevice.udid, `exp://127.0.0.1:${port}`]);

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "Unable to open Expo URL for settings privacy evidence.");
  }
};

const captureSettings = () => {
  const result = runText("node", ["scripts/capture-mobile-qa-screenshots.mjs"], {
    cwd: ROOT,
    env: {
      ...process.env,
      TINY_PET_QA_IOS_UDID: targetDevice.udid,
      TINY_PET_QA_PLATFORM: "ios",
      TINY_PET_QA_LABEL: label
    }
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || "Unable to capture settings privacy evidence.");
  }

  process.stdout.write(result.stdout);
};

let metroProcess = null;
let failed = false;

try {
  const started = startMetro();
  metroProcess = started.metroProcess;
  await waitForMetro(started.metroProcess, started.metroOutput);
  openSettingsInSimulator();
  await sleep(settleMs);
  captureSettings();
} catch (error) {
  failed = true;
  console.error(error instanceof Error ? error.message : String(error));
} finally {
  await stopMetro(metroProcess);
}

if (failed) {
  process.exit(1);
}

console.log(`iOS settings privacy evidence captured for ${preset}.`);
