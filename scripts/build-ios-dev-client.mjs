import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const MOBILE_ROOT = resolve(ROOT, "apps/mobile");
const IOS_ROOT = resolve(MOBILE_ROOT, "ios");
const workspacePath = resolve(IOS_ROOT, "Mongchi.xcworkspace");
const podfileLockPath = resolve(IOS_ROOT, "Podfile.lock");
const appConfig = JSON.parse(readFileSync(resolve(MOBILE_ROOT, "app.json"), "utf8"));
const deviceName = process.env.TINY_PET_IOS_DEV_CLIENT_DEVICE ?? "iPhone 16 Pro";
const derivedDataPath = process.env.TINY_PET_IOS_DEV_CLIENT_DERIVED_DATA ?? "/tmp/mongchi-ios-dev-client-derived-data";
const scheme = process.env.TINY_PET_IOS_DEV_CLIENT_SCHEME ?? "Mongchi";
const configuration = process.env.TINY_PET_IOS_DEV_CLIENT_CONFIGURATION ?? "Debug";
const skipInstall = /^(true|1|yes)$/i.test(process.env.TINY_PET_IOS_DEV_CLIENT_SKIP_INSTALL ?? "");
const verbose = /^(true|1|yes)$/i.test(process.env.TINY_PET_IOS_DEV_CLIENT_VERBOSE ?? "");
const bundleIdentifier = appConfig.expo?.ios?.bundleIdentifier;

const runText = (command, args, options = {}) =>
  spawnSync(command, args, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024, ...options });

const runInherit = (command, args, options = {}) => spawnSync(command, args, { stdio: "inherit", ...options });

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

if (!existsSync(workspacePath)) {
  fail("apps/mobile/ios/Mongchi.xcworkspace is missing. Run npx expo prebuild --platform ios --npm and npm run ios:pods first.");
}

if (!existsSync(podfileLockPath)) {
  fail("apps/mobile/ios/Podfile.lock is missing. Run npm run ios:pods first.");
}

if (!bundleIdentifier) {
  fail("apps/mobile/app.json must define expo.ios.bundleIdentifier.");
}

const devicesResult = runText("xcrun", ["simctl", "list", "devices", "booted", "--json"]);

if (devicesResult.status !== 0) {
  fail(devicesResult.stderr.trim() || "Unable to list booted iOS simulators.");
}

const devices = Object.values(JSON.parse(devicesResult.stdout).devices ?? {})
  .flat()
  .filter((device) => device.state === "Booted");
const selectedDevice = devices.find((device) => device.name === deviceName) ?? devices[0];

if (!selectedDevice) {
  fail(`No booted iOS simulator found. Boot ${deviceName} or set TINY_PET_IOS_DEV_CLIENT_DEVICE.`);
}

const destination = `platform=iOS Simulator,id=${selectedDevice.udid}`;
const xcodebuildArgs = [
  "-workspace",
  workspacePath,
  "-scheme",
  scheme,
  "-configuration",
  configuration,
  "-destination",
  destination,
  "-derivedDataPath",
  derivedDataPath
];

if (!verbose) {
  xcodebuildArgs.push("-quiet");
}

xcodebuildArgs.push("build");

console.log(`Building ${scheme} (${configuration}) for ${selectedDevice.name} (${selectedDevice.udid})...`);
const buildResult = runInherit("xcodebuild", xcodebuildArgs);

if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

const appPath = resolve(derivedDataPath, `Build/Products/${configuration}-iphonesimulator/Mongchi.app`);

if (!existsSync(appPath)) {
  fail(`Built app not found at ${appPath}.`);
}

if (!skipInstall) {
  console.log(`Installing ${appPath} on ${selectedDevice.name}...`);
  const installResult = runInherit("xcrun", ["simctl", "install", selectedDevice.udid, appPath]);

  if (installResult.status !== 0) {
    process.exit(installResult.status ?? 1);
  }

  const containerResult = runText("xcrun", ["simctl", "get_app_container", selectedDevice.udid, bundleIdentifier]);

  if (containerResult.status !== 0) {
    fail(containerResult.stderr.trim() || `Unable to verify installed app container for ${bundleIdentifier}.`);
  }

  console.log(`Installed ${bundleIdentifier}: ${containerResult.stdout.trim()}`);
} else {
  console.log(`Skipped simulator install. Built app: ${appPath}`);
}
