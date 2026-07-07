import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

const checkedFiles = [
  "apps/mobile/src/features/onboarding/OnboardingScreen.tsx",
  "apps/mobile/src/features/onboarding/SplashScreen.tsx",
  "apps/mobile/src/features/petSetup/PetSetupScreen.tsx",
  "apps/mobile/src/features/photoUpload/PhotoUploadScreen.tsx",
  "apps/mobile/src/features/generation/GenerationScreen.tsx",
  "apps/mobile/src/features/petReveal/PetRevealScreen.tsx",
  "apps/mobile/src/features/terrarium/TerrariumHomeScreen.tsx",
  "apps/mobile/src/features/chat/ChatGateScreen.tsx",
  "apps/mobile/src/features/inventory/InventoryScreen.tsx",
  "apps/mobile/src/features/shop/ShopPreviewScreen.tsx",
  "apps/mobile/src/features/settings/SettingsScreen.tsx",
  "apps/mobile/src/features/legal/PrivacyScreen.tsx",
  "apps/mobile/src/features/legal/TermsScreen.tsx",
  "apps/mobile/src/features/legal/SupportScreen.tsx",
  "apps/mobile/src/features/session/nativeStorePurchases.ts"
];

const forbiddenCopy = [
  { pattern: /\bbackend\b/i, reason: "backend implementation detail" },
  { pattern: /\bmock\b/i, reason: "mock implementation detail" },
  { pattern: /\bprototype\b/i, reason: "prototype implementation detail" },
  { pattern: /\bAPI-backed\b/i, reason: "API integration detail" },
  { pattern: /Store setup required/i, reason: "store setup implementation state" },
  { pattern: /Local preview only/i, reason: "local implementation state" },
  { pattern: /Native checkout/i, reason: "native implementation detail" },
  { pattern: /receipt verification/i, reason: "payment implementation detail" },
  { pattern: /entitlement verification/i, reason: "commerce implementation detail" },
  { pattern: /Active entitlements/i, reason: "commerce implementation detail" },
  { pattern: /before store submission/i, reason: "release process detail" },
  { pattern: /before release/i, reason: "release process detail" },
  { pattern: /this build/i, reason: "build implementation detail" },
  { pattern: /not configured/i, reason: "configuration implementation detail" },
  { pattern: /provider secrets/i, reason: "provider implementation detail" },
  { pattern: /\bjob\b/i, reason: "worker implementation detail" }
];

const stringLiteralPattern = /(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/g;
const hangulPattern = /[가-힣]/;
const failures = [];

const lineNumberAt = (content, index) => content.slice(0, index).split("\n").length;

for (const relativePath of checkedFiles) {
  const absolutePath = resolve(ROOT, relativePath);

  if (!existsSync(absolutePath)) {
    failures.push(`${relativePath} is missing`);
    continue;
  }

  const source = readFileSync(absolutePath, "utf8");
  let match;

  while ((match = stringLiteralPattern.exec(source)) !== null) {
    const literal = match[0];

    if (hangulPattern.test(literal)) {
      failures.push(`${relativePath}:${lineNumberAt(source, match.index)} contains Korean copy in the English mobile UI: ${literal}`);
    }

    for (const forbidden of forbiddenCopy) {
      if (forbidden.pattern.test(literal)) {
        failures.push(`${relativePath}:${lineNumberAt(source, match.index)} contains ${forbidden.reason}: ${literal}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error("Mobile copy validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Mobile copy validation passed for user-facing screen strings.");
