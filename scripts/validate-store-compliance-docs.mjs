import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const docPath = resolve(ROOT, "docs/release/store-privacy-data-safety.md");
const content = readFileSync(docPath, "utf8");
const failures = [];

const requireText = (text, description = text) => {
  if (!content.includes(text)) {
    failures.push(`Missing ${description}.`);
  }
};

const requirePattern = (pattern, description) => {
  if (!pattern.test(content)) {
    failures.push(`Missing ${description}.`);
  }
};

[
  "# Store Privacy And Data Safety Draft",
  "## Evidence Scope",
  "## App Store Privacy Labels",
  "### Data Used To Track You",
  "### Data Linked To The User",
  "## Google Play Data Safety",
  "### Data Collection",
  "### Data Sharing",
  "### Security Practices",
  "## Final Submission Checklist"
].forEach((heading) => requireText(heading, heading));

[
  "apps/mobile/app.json",
  "packages/shared/src/api/mobileContracts.ts",
  "apps/mobile/src/shared/api/mobileApiClient.ts",
  "packages/shared/src/analytics/safeAnalytics.ts",
  "services/api/src/operationalLogger.ts",
  "docs/engineering/security-boundaries.md",
  "scripts/validate-privacy-sdk-boundaries.mjs"
].forEach((evidence) => requireText(evidence, `evidence link ${evidence}`));

[
  "None in the current implementation",
  "User Content - Photos or Videos",
  "User Content - Other User Content",
  "Purchases",
  "Identifiers - User ID",
  "Contact Info - Email Address",
  "Usage Data - Product Interaction",
  "Diagnostics - Crash Data",
  "Photos and videos",
  "App activity - In-app messages",
  "Financial info - Purchase history",
  "Encrypted in transit",
  "Encrypted at rest",
  "Deletion request path",
  "Data minimization",
  "privacy SDK boundary",
  "npm run validate:privacy-sdk-boundaries",
  "EXPO_PUBLIC_TINY_PET_PRIVACY_URL",
  "EXPO_PUBLIC_TINY_PET_TERMS_URL",
  "EXPO_PUBLIC_TINY_PET_SUPPORT_EMAIL"
].forEach((required) => requireText(required));

// Location gets its own real-time-processing-exception justification (it is read
// and used, just never retained), separate from the flat non-collection statement
// below for contacts/calendars/microphone -- keep both guardrails so neither claim
// can quietly regress to an unsupported blanket "not collected".
requirePattern(/does not request or collect contacts, calendars, or microphone\/audio/i, "explicit non-collected sensitive data statement (contacts/calendars/microphone)");
requirePattern(/real-time processing that is not retained/i, "location real-time-processing exception justification");
requirePattern(/weather-lookup/i, "location evidence reference to the weather-lookup Edge Function");
requirePattern(/no voice-input or audio-recording feature/i, "no voice-input/recording feature statement");
requirePattern(/Do not answer that data is shared for advertising/i, "advertising sharing guardrail");
requirePattern(/answer yes only after.+encryption at rest/i, "encryption-at-rest final-provider caveat");
requirePattern(/raw photo URIs.+raw message text.+receipt payloads/i, "raw sensitive payload minimization statement");

if (/\b(TODO|TBD|replace-me)\b/i.test(content)) {
  failures.push("Store privacy/data safety draft must not contain TODO/TBD/replace-me placeholders.");
}

if (failures.length > 0) {
  console.error("Store compliance documentation validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Store compliance documentation validation passed.");
