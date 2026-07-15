import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const docPath = resolve(ROOT, "docs/release/ios-manual-qa-checklist.md");
const preflightPath = resolve(ROOT, "scripts/validate-ios-preflight.mjs");
const content = readFileSync(docPath, "utf8");
const preflightContent = readFileSync(preflightPath, "utf8");
const failures = [];

const requireText = (text, description = text) => {
  if (!content.includes(text)) {
    failures.push(`Missing ${description}.`);
  }
};

[
  "# iOS Manual QA Checklist",
  "## Scope And Evidence",
  "## First Session Flow",
  "## Main Terrarium Loop",
  "## VoiceOver Checklist",
  "## Reduced Motion Checklist",
  "## Text And Layout Checklist",
  "## Photo Privacy And Consent Checklist",
  "## Store Screenshot QA Notes",
  "## Signoff Template"
].forEach((heading) => requireText(heading, heading));

[
  "Android validation and TalkBack are final completion checks",
  "Welcome -> Photo upload -> Pet setup -> Hatching -> Pet reveal",
  "Main terrarium",
  "AI chat / premium bond",
  "Shop",
  "EXPO_PUBLIC_TINY_PET_STORE_SCREENSHOT_PRESET",
  "TINY_PET_QA_PLATFORM=ios",
  "development-client or production build without Expo Go overlays",
  "VoiceOver",
  "VoiceOver header",
  "Reduce Motion",
  "progressbar",
  "Decorative images",
  "Meaningful images",
  "permission/consent copy",
  "delete original photo",
  "Privacy controls",
  "npm run validate:ios-preflight",
  "npm run validate:ios-manual-qa"
].forEach((required) => requireText(required));

[
  "welcome",
  "photo-upload",
  "pet-setup",
  "hatching",
  "pet-reveal",
  "terrarium",
  "chat",
  "shop"
].forEach((preset) => requireText(`\`${preset}\``, `store screenshot preset ${preset}`));

if (/\bnpm run validate:android\b/.test(content)) {
  failures.push("iOS manual QA checklist must not require Android validation in the intermediate loop.");
}

if (/\bvalidate:android\b|TINY_PET_QA_PLATFORM=android|--platform android\b/.test(preflightContent)) {
  failures.push("iOS preflight must not run Android validation or Android screenshot capture.");
}

if (/\b(TODO|TBD|replace-me)\b/i.test(content)) {
  failures.push("iOS manual QA checklist must not contain TODO/TBD/replace-me placeholders.");
}

if (failures.length > 0) {
  console.error("iOS manual QA documentation validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("iOS manual QA documentation validation passed.");
