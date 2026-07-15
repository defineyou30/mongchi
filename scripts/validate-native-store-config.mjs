import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const failures = [];

const readJson = (relativePath) => {
  const filePath = resolve(ROOT, relativePath);

  if (!existsSync(filePath)) {
    failures.push(`${relativePath} is missing.`);
    return null;
  }

  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    failures.push(`${relativePath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
};

const appConfig = readJson("apps/mobile/app.json");
const easConfig = readJson("eas.json");
const expo = appConfig?.expo;

const isNonPlaceholderIdentifier = (value) =>
  typeof value === "string" &&
  /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$/i.test(value) &&
  !/(example|placeholder|todo|test)/i.test(value);

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

const requireAsset = (relativePath, description) => {
  if (!isNonEmptyString(relativePath)) {
    failures.push(`${description} must be configured.`);
    return;
  }

  const normalized = relativePath.replace(/^\.\//, "");
  const filePath = resolve(ROOT, "apps/mobile", normalized);

  if (!existsSync(filePath)) {
    failures.push(`${description} does not exist at apps/mobile/${normalized}.`);
  }
};

if (!expo) {
  failures.push("apps/mobile/app.json must define expo config.");
} else {
  if (expo.name !== "Mongchi") {
    failures.push('expo.name must be "Mongchi".');
  }

  if (expo.slug !== "mongchi") {
    failures.push('expo.slug must be "mongchi".');
  }

  if (!Array.isArray(expo.platforms) || !expo.platforms.includes("ios") || !expo.platforms.includes("android")) {
    failures.push("expo.platforms must include both ios and android.");
  }

  if (expo.orientation !== "portrait") {
    failures.push("expo.orientation must remain portrait for the current store screenshot set.");
  }

  if (!isNonEmptyString(expo.scheme)) {
    failures.push("expo.scheme must be set for development-client and deep-link QA.");
  }

  if (!/^\d+\.\d+\.\d+$/.test(expo.version ?? "")) {
    failures.push("expo.version must be a semantic version string.");
  }

  requireAsset(expo.icon, "Expo app icon");
  requireAsset(expo.splash?.image, "Expo splash image");
  requireAsset(expo.android?.adaptiveIcon?.foregroundImage, "Android adaptive icon foreground");

  if (!isNonPlaceholderIdentifier(expo.ios?.bundleIdentifier)) {
    failures.push("expo.ios.bundleIdentifier must be a real reverse-DNS identifier.");
  }

  if (expo.ios?.supportsTablet !== false) {
    failures.push("expo.ios.supportsTablet must remain false until tablet screenshots/layouts are prepared.");
  }

  if (expo.ios?.config?.usesNonExemptEncryption !== false) {
    failures.push("expo.ios.config.usesNonExemptEncryption must be false unless encryption usage changes.");
  }

  for (const key of ["NSCameraUsageDescription", "NSPhotoLibraryUsageDescription"]) {
    const value = expo.ios?.infoPlist?.[key];

    if (!isNonEmptyString(value) || !/pet photo|avatar/i.test(value)) {
      failures.push(`expo.ios.infoPlist.${key} must explain pet-photo avatar use.`);
    }
  }

  if (!isNonPlaceholderIdentifier(expo.android?.package)) {
    failures.push("expo.android.package must be a real reverse-DNS identifier.");
  }

  const hasAndroidPermission = (permissions, shortName) =>
    Array.isArray(permissions) && (permissions.includes(shortName) || permissions.includes(`android.permission.${shortName}`));

  if (!hasAndroidPermission(expo.android?.permissions, "CAMERA") || !hasAndroidPermission(expo.android?.permissions, "READ_MEDIA_IMAGES")) {
    failures.push("expo.android.permissions must include CAMERA and READ_MEDIA_IMAGES for still pet photo capture.");
  }

  if (expo.android?.permissions?.includes("RECORD_AUDIO")) {
    failures.push("expo.android.permissions must not include RECORD_AUDIO.");
  }

  if (!Array.isArray(expo.android?.blockedPermissions) || !expo.android.blockedPermissions.includes("android.permission.RECORD_AUDIO")) {
    failures.push("expo.android.blockedPermissions must keep android.permission.RECORD_AUDIO blocked.");
  }

  const plugins = Array.isArray(expo.plugins) ? expo.plugins.map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin)) : [];

  for (const plugin of ["expo-router", "expo-image-picker", "expo-secure-store"]) {
    if (!plugins.includes(plugin)) {
      failures.push(`expo.plugins must include ${plugin}.`);
    }
  }
}

const developmentProfile = easConfig?.build?.development;
const previewProfile = easConfig?.build?.preview;
const productionProfile = easConfig?.build?.production;

if (easConfig?.cli?.version !== ">= 16.0.0") {
  failures.push('eas.cli.version must stay at ">= 16.0.0".');
}

if (developmentProfile?.developmentClient !== true || developmentProfile?.distribution !== "internal") {
  failures.push("eas build.development must be an internal development-client build.");
}

if (developmentProfile?.ios?.simulator !== true) {
  failures.push("eas build.development.ios.simulator must be true for local iOS development-client QA.");
}

if (previewProfile?.distribution !== "internal") {
  failures.push("eas build.preview must use internal distribution.");
}

if (previewProfile?.android?.buildType !== "apk") {
  failures.push("eas build.preview.android.buildType must be apk for installable tester builds.");
}

if (productionProfile?.autoIncrement !== true) {
  failures.push("eas build.production.autoIncrement must be true for store build numbering.");
}

if (!easConfig?.submit?.production) {
  failures.push("eas submit.production must exist for store submission configuration.");
}

if (failures.length > 0) {
  console.error("Native store config validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Native store config validation passed.");
