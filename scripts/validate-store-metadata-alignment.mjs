import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const failures = [];

const readText = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), "utf8");
const readJson = (relativePath) => JSON.parse(readText(relativePath));

const appConfig = readJson("apps/mobile/app.json");
const packageJson = readJson("package.json");
const manifest = readJson("docs/store-screenshot-manifest.json");
const listing = readText("docs/release/store-listing-draft.md");
const privacy = readText("docs/release/store-privacy-data-safety.md");
const productDirection = readText("docs/product/product-direction.md");
const runbook = readText("docs/engineering/mobile-native-runbook.md");

const expo = appConfig.expo ?? {};

const requireIncludes = (content, text, label) => {
  if (!content.includes(text)) {
    failures.push(`${label} must include "${text}".`);
  }
};

const readListingField = (label) => {
  const match = listing.match(new RegExp(`^- ${label}: (.+)$`, "m"));
  return match?.[1]?.trim() ?? null;
};

const appStoreName = readListingField("Name");
const googlePlayName = readListingField("App Name");

if (appStoreName !== expo.name) {
  failures.push(`App Store listing name must match expo.name "${expo.name}".`);
}

if (googlePlayName !== expo.name) {
  failures.push(`Google Play listing name must match expo.name "${expo.name}".`);
}

requireIncludes(listing, manifest.sourceFlow, "Store listing");
requireIncludes(productDirection, manifest.sourceFlow, "Product direction");
requireIncludes(runbook, "npm run validate:final-release", "Mobile native runbook");
requireIncludes(runbook, "npm run capture:android-store-screenshots", "Mobile native runbook");
requireIncludes(runbook, "npm run validate:android-store-screenshots", "Mobile native runbook");
requireIncludes(runbook, "npm run generate:android-store-contact-sheet", "Mobile native runbook");
requireIncludes(runbook, "npm run validate:android-store-contact-sheet", "Mobile native runbook");

if (packageJson.scripts?.["capture:android-store-screenshots"] !== "node scripts/capture-android-store-screenshots.mjs") {
  failures.push("package.json must expose capture:android-store-screenshots.");
}

if (
  packageJson.scripts?.["validate:android-store-screenshots"] !==
  "TINY_PET_REQUIRE_STORE_SCREENSHOTS=android node scripts/validate-store-screenshots.mjs"
) {
  failures.push("package.json must expose validate:android-store-screenshots.");
}

if (packageJson.scripts?.["generate:android-store-contact-sheet"] !== "node scripts/generate-android-store-contact-sheet.mjs") {
  failures.push("package.json must expose generate:android-store-contact-sheet.");
}

if (packageJson.scripts?.["validate:android-store-contact-sheet"] !== "node scripts/validate-android-store-contact-sheet.mjs") {
  failures.push("package.json must expose validate:android-store-contact-sheet.");
}

for (const screenshot of manifest.screenshots ?? []) {
  requireIncludes(listing, `| ${screenshot.preset} | ${screenshot.caption} |`, `Store listing screenshot table for ${screenshot.preset}`);
}

const finalCapturePhrase = "development-client or production build without Expo Go overlays";
requireIncludes(listing, finalCapturePhrase, "Store listing");
requireIncludes(runbook, finalCapturePhrase, "Mobile native runbook");

const iosInfoPlist = expo.ios?.infoPlist ?? {};
const cameraCopy = iosInfoPlist.NSCameraUsageDescription ?? "";
const photoCopy = iosInfoPlist.NSPhotoLibraryUsageDescription ?? "";
const addPhotoCopy = iosInfoPlist.NSPhotoLibraryAddUsageDescription ?? "";

if (!/camera/i.test(cameraCopy) || !/pet photo|avatar/i.test(cameraCopy)) {
  failures.push("iOS camera permission copy must explain pet-photo avatar use.");
}

if (!/pet photo|avatar/i.test(photoCopy)) {
  failures.push("iOS photo library permission copy must explain pet-photo avatar use.");
}

if (!/save|share/i.test(addPhotoCopy)) {
  failures.push("iOS photo-library-add permission copy must explain user-requested saving/sharing.");
}

if (Array.isArray(expo.android?.permissions)) {
  for (const permission of expo.android.permissions) {
    requireIncludes(privacy, permission, `Privacy/data safety evidence for Android permission ${permission}`);
  }
}

if (expo.android?.blockedPermissions?.includes("android.permission.RECORD_AUDIO")) {
  requireIncludes(privacy, "android.permission.RECORD_AUDIO", "Privacy/data safety microphone block evidence");
  requireIncludes(listing, "Android microphone is explicitly blocked", "App Store review notes");
}

const pluginNames = (Array.isArray(expo.plugins) ? expo.plugins : []).map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin));

if (pluginNames.includes("expo-image-picker")) {
  requireIncludes(listing, "Native permissions are limited to still-image camera/photo selection", "App Store review notes");
  requireIncludes(privacy, "Photos and videos", "Google Play data safety photo category");
  requireIncludes(privacy, "Original-photo deletion route exists", "Google Play data deletion note");
}

if (pluginNames.includes("expo-iap")) {
  requireIncludes(listing, "Plus pass", "Store listing purchase copy");
  requireIncludes(privacy, "Financial info - Purchase history", "Google Play data safety purchase category");
  requireIncludes(privacy, "Raw store verification token is request-scoped", "App Store privacy purchase note");
}

if (pluginNames.includes("expo-secure-store")) {
  requireIncludes(privacy, "Authenticated user id", "App Store privacy identifier note");
  requireIncludes(runbook, "Provider keys and service secrets must stay out of the mobile app.", "Runbook mobile secret boundary");
}

if (!Array.isArray(expo.platforms) || !expo.platforms.includes("ios") || !expo.platforms.includes("android")) {
  failures.push("expo.platforms must still include both ios and android.");
}

requireIncludes(listing, "iOS and Android", "Store listing native platform wording");
requireIncludes(productDirection, "iOS/Android", "Product direction native platform wording");
requireIncludes(runbook, "Mongchi is an iOS/Android app.", "Runbook native platform wording");

if (!listing.includes("npm run validate:store-metadata-alignment")) {
  failures.push("Store listing final checklist must mention npm run validate:store-metadata-alignment.");
}

if (!privacy.includes("npm run validate:store-metadata-alignment")) {
  failures.push("Privacy/data safety final checklist must mention npm run validate:store-metadata-alignment.");
}

if (failures.length > 0) {
  console.error("Store metadata alignment validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Store metadata alignment validation passed.");
