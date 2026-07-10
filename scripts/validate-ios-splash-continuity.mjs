import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PNG } from "pngjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const mobileRoot = resolve(root, "apps/mobile");
const appConfig = JSON.parse(readFileSync(resolve(mobileRoot, "app.json"), "utf8"));
const iconPath = resolve(mobileRoot, "assets/icon.png");
const nativeIconPath = resolve(
  mobileRoot,
  "ios/Mongchi/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png"
);
const nativeIconContents = JSON.parse(
  readFileSync(resolve(mobileRoot, "ios/Mongchi/Images.xcassets/AppIcon.appiconset/Contents.json"), "utf8")
);
const onboardingArtPath = resolve(
  mobileRoot,
  "assets/generated/onboarding/onboarding-photo-picker-v1.png"
);
const nativeSplashPath = resolve(mobileRoot, "ios/Mongchi/Images.xcassets/SplashScreen.imageset/SplashScreen.png");
const nativeSplashContents = JSON.parse(
  readFileSync(resolve(mobileRoot, "ios/Mongchi/Images.xcassets/SplashScreen.imageset/Contents.json"), "utf8")
);
const sourceSplashPath = resolve(mobileRoot, "assets/splash.png");
const storyboard = readFileSync(resolve(mobileRoot, "ios/Mongchi/SplashScreen.storyboard"), "utf8");
const reactSplash = readFileSync(resolve(mobileRoot, "src/features/onboarding/SplashScreen.tsx"), "utf8");
const failures = [];

const hash = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const iconPng = PNG.sync.read(readFileSync(iconPath));
const nativeIconPng = PNG.sync.read(readFileSync(nativeIconPath));
const onboardingArtPng = PNG.sync.read(readFileSync(onboardingArtPath));
const sourcePng = PNG.sync.read(readFileSync(sourceSplashPath));
const nativePng = PNG.sync.read(readFileSync(nativeSplashPath));

if (appConfig.expo?.icon !== "./assets/icon.png") {
  failures.push("app.json must point to ./assets/icon.png");
}
if (iconPng.width !== 1024 || iconPng.height !== 1024) {
  failures.push(`app icon must be 1024x1024, got ${iconPng.width}x${iconPng.height}`);
}
if (nativeIconPng.width !== iconPng.width || nativeIconPng.height !== iconPng.height || hash(nativeIconPath) !== hash(iconPath)) {
  failures.push("native AppIcon PNG must be byte-identical to assets/icon.png");
}
const nativeIconEntry = nativeIconContents.images?.find(
  (entry) => entry.filename === "App-Icon-1024x1024@1x.png"
);
if (nativeIconEntry?.idiom !== "universal" || nativeIconEntry?.platform !== "ios" || nativeIconEntry?.size !== "1024x1024") {
  failures.push("native AppIcon must remain a universal iOS 1024x1024 asset");
}
if (onboardingArtPng.width !== 1122 || onboardingArtPng.height !== 1402) {
  failures.push("onboarding-photo-picker-v1.png must remain preserved at 1122x1402");
}
if (appConfig.expo?.splash?.image !== "./assets/splash.png") {
  failures.push("app.json must point to ./assets/splash.png");
}
if (appConfig.expo?.splash?.resizeMode !== "cover") {
  failures.push("app.json splash resizeMode must be cover");
}
if (appConfig.expo?.splash?.backgroundColor !== "#9FDBFF") {
  failures.push("app.json splash fallback must remain #9FDBFF");
}
if (sourcePng.width !== 1290 || sourcePng.height !== 2796) {
  failures.push(`source splash must remain 1290x2796, got ${sourcePng.width}x${sourcePng.height}`);
}
if (nativePng.width !== sourcePng.width / 3 || nativePng.height !== sourcePng.height / 3) {
  failures.push("native SplashScreen.png must be the launch-optimized 430x932 derivative of assets/splash.png");
}
const nativeSplashEntry = nativeSplashContents.images?.find((entry) => entry.filename === "SplashScreen.png");
if (nativeSplashEntry?.idiom !== "universal" || nativeSplashEntry?.scale !== "1x") {
  failures.push("native SplashScreen.png must be registered as a universal 1x launch image");
}
if (!storyboard.includes('contentMode="scaleAspectFill"')) {
  failures.push("native splash image view must use scaleAspectFill");
}
for (const attribute of ["top", "bottom", "leading", "trailing"]) {
  const constraint = new RegExp(`firstItem="EXPO-SplashScreen" firstAttribute="${attribute}" secondItem="EXPO-ContainerView" secondAttribute="${attribute}"`);
  if (!constraint.test(storyboard)) failures.push(`native splash image must be constrained to the container ${attribute} edge`);
}
if (!storyboard.includes(`<image name="SplashScreen" width="${sourcePng.width / 3}" height="${sourcePng.height / 3}"/>`)) {
  failures.push("storyboard resource dimensions must match the portrait splash master at 3x scale");
}
if (!reactSplash.includes('require("../../../assets/splash.png")')) {
  failures.push("React splash must reuse assets/splash.png for native-to-React continuity");
}
if (!reactSplash.includes('require("../../../assets/icon.png")')) {
  failures.push("React splash must reuse assets/icon.png for app-icon continuity");
}
if (!reactSplash.includes('justifyContent: "flex-end"')) {
  failures.push("React splash loading card must stay below the centered Shiba artwork");
}
if (reactSplash.includes("loading-screen-v2.png")) {
  failures.push("React splash must not switch to the alternate loading-screen-v2 background");
}

if (failures.length > 0) {
  console.error(`iOS splash continuity validation failed (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`iOS splash continuity validation passed: ${sourcePng.width}x${sourcePng.height}, ${hash(sourceSplashPath)}.`);
}
