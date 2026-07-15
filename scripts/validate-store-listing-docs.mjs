import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const docPath = resolve(ROOT, "docs/release/store-listing-draft.md");
const content = readFileSync(docPath, "utf8");
const failures = [];

const requiredSections = [
  "# Store Listing Draft",
  "## App Store Connect",
  "### App Store Description",
  "### App Store Review Notes",
  "## Google Play Console",
  "### Google Play Full Description",
  "### Release Notes",
  "## Screenshot Captions",
  "## Final Listing Checklist"
];

const requiredPhrases = [
  "Welcome -> Photo upload -> Pet setup -> Hatching -> Pet reveal -> Main terrarium -> AI chat / premium bond -> Shop",
  "Mongchi",
  "dog or cat photo",
  "AI-generated",
  "Privacy controls",
  "original photo can be deleted",
  "payment or provider secrets",
  "development-client or production build without Expo Go overlays",
  "npm run validate:store-listing"
];

const screenshotPresets = [
  "welcome",
  "photo-upload",
  "pet-setup",
  "hatching",
  "pet-reveal",
  "terrarium",
  "chat",
  "shop"
];

const readField = (label) => {
  const match = content.match(new RegExp(`^- ${label}: (.+)$`, "m"));

  return match?.[1]?.trim() ?? null;
};

const requireText = (text, description = text) => {
  if (!content.includes(text)) {
    failures.push(`Missing ${description}.`);
  }
};

requiredSections.forEach((section) => requireText(section, section));
requiredPhrases.forEach((phrase) => requireText(phrase));
screenshotPresets.forEach((preset) => requireText(`| ${preset} |`, `screenshot caption for ${preset}`));

const constrainedFields = [
  { label: "Name", max: 30 },
  { label: "Subtitle", max: 30 },
  { label: "Promotional Text", max: 170 },
  { label: "Keywords", max: 100 },
  { label: "App Name", max: 30 },
  { label: "Short Description", max: 80 }
];

for (const field of constrainedFields) {
  const value = readField(field.label);

  if (!value) {
    failures.push(`Missing ${field.label} field.`);
    continue;
  }

  if (value.length > field.max) {
    failures.push(`${field.label} is ${value.length} chars; limit is ${field.max}.`);
  }
}

if (/\b(TODO|TBD|replace-me)\b/i.test(content)) {
  failures.push("Store listing draft must not contain TODO/TBD/replace-me placeholders.");
}

if (failures.length > 0) {
  console.error("Store listing documentation validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Store listing documentation validation passed.");
