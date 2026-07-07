import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const failures = [];

const readJson = (relativePath) => {
  const absolutePath = resolve(ROOT, relativePath);

  if (!existsSync(absolutePath)) {
    failures.push(`${relativePath} is missing.`);
    return null;
  }

  try {
    return JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch (error) {
    failures.push(`${relativePath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
};

const rootPackage = readJson("package.json");
const mobilePackage = readJson("apps/mobile/package.json");
const appConfig = readJson("apps/mobile/app.json");
const easConfig = readJson("eas.json");
const screenshotManifest = readJson("docs/store-screenshot-manifest.json");
const iosStoreCaptureScriptPath = resolve(ROOT, "scripts/capture-ios-store-screenshots.mjs");
const mobileQaCaptureScriptPath = resolve(ROOT, "scripts/capture-mobile-qa-screenshots.mjs");
const iosDevClientBuildScriptPath = resolve(ROOT, "scripts/build-ios-dev-client.mjs");
const iosWorkspacePath = resolve(ROOT, "apps/mobile/ios/Mongchi.xcworkspace");
const iosPodfileLockPath = resolve(ROOT, "apps/mobile/ios/Podfile.lock");

const developmentProfile = easConfig?.build?.development;
const mobileDependencies = {
  ...(mobilePackage?.dependencies ?? {}),
  ...(mobilePackage?.devDependencies ?? {})
};

if (developmentProfile?.developmentClient !== true) {
  failures.push("eas.json build.development.developmentClient must be true for Expo Go-free iOS QA builds.");
}

if (developmentProfile?.ios?.simulator !== true) {
  failures.push("eas.json build.development.ios.simulator must be true so local iOS simulator QA can install a development client.");
}

if (!mobileDependencies["expo-dev-client"]) {
  failures.push("apps/mobile/package.json must depend on expo-dev-client when the EAS development profile uses developmentClient.");
}

if (!appConfig?.expo?.scheme || typeof appConfig.expo.scheme !== "string") {
  failures.push("apps/mobile/app.json expo.scheme must be set so development-client deep links can open Metro bundles.");
}

if (screenshotManifest?.finalCaptureRequirement !== "Capture in a development-client or production build without Expo Go overlays.") {
  failures.push("docs/store-screenshot-manifest.json must keep the final development-client/production screenshot requirement.");
}

if (!rootPackage?.scripts?.["validate:ios-dev-client-readiness"]) {
  failures.push("package.json must expose validate:ios-dev-client-readiness.");
}

if (!rootPackage?.scripts?.["ios:dev-client:build"]) {
  failures.push("package.json must expose ios:dev-client:build.");
}

if (!existsSync(iosWorkspacePath)) {
  failures.push("apps/mobile/ios/Mongchi.xcworkspace must exist after iOS prebuild and pod install.");
}

if (!existsSync(iosPodfileLockPath)) {
  failures.push("apps/mobile/ios/Podfile.lock must exist after iOS pod install.");
} else {
  const podfileLock = readFileSync(iosPodfileLockPath, "utf8");

  if (!podfileLock.includes("expo-dev-client")) {
    failures.push("apps/mobile/ios/Podfile.lock must include expo-dev-client pods.");
  }
}

const iosStoreCaptureScript = existsSync(iosStoreCaptureScriptPath) ? readFileSync(iosStoreCaptureScriptPath, "utf8") : "";
const mobileQaCaptureScript = existsSync(mobileQaCaptureScriptPath) ? readFileSync(mobileQaCaptureScriptPath, "utf8") : "";

if (!iosStoreCaptureScript.includes("TINY_PET_IOS_STORE_SCREENSHOT_CLIENT")) {
  failures.push("scripts/capture-ios-store-screenshots.mjs must expose the iOS screenshot client selector.");
}

if (
  !iosStoreCaptureScript.includes("TINY_PET_IOS_STORE_SCREENSHOT_DEVICE_UDID") ||
  !mobileQaCaptureScript.includes("TINY_PET_QA_IOS_UDID")
) {
  failures.push("iOS screenshot capture scripts must support targeting a specific booted simulator UDID.");
}

if (!iosStoreCaptureScript.includes("expo-development-client/?url=")) {
  failures.push("scripts/capture-ios-store-screenshots.mjs must support opening a development-client update URL.");
}

if (
  !iosStoreCaptureScript.includes("EXDevMenuIsOnboardingFinished") ||
  !iosStoreCaptureScript.includes("EXDevMenuShowFloatingActionButton") ||
  !iosStoreCaptureScript.includes("EXDevMenuShowsAtLaunch") ||
  !iosStoreCaptureScript.includes("disableOnboarding")
) {
  failures.push("scripts/capture-ios-store-screenshots.mjs must suppress the development-client onboarding overlay for clean store captures.");
}

const iosDevClientBuildScript = existsSync(iosDevClientBuildScriptPath) ? readFileSync(iosDevClientBuildScriptPath, "utf8") : "";

if (!iosDevClientBuildScript.includes("xcodebuild")) {
  failures.push("scripts/build-ios-dev-client.mjs must build the iOS development client with xcodebuild.");
}

if (!iosDevClientBuildScript.includes("simctl") || !iosDevClientBuildScript.includes("install")) {
  failures.push("scripts/build-ios-dev-client.mjs must install the iOS development client through simctl.");
}

if (!iosDevClientBuildScript.includes("-quiet") || !iosDevClientBuildScript.includes("TINY_PET_IOS_DEV_CLIENT_VERBOSE")) {
  failures.push("scripts/build-ios-dev-client.mjs must keep xcodebuild quiet by default with a verbose override.");
}

if (failures.length > 0) {
  console.error("iOS development-client readiness validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("iOS development-client readiness validation passed.");
