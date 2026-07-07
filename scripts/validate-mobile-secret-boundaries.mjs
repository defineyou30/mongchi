import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const failures = [];

const checkedRoots = [
  "apps/mobile/app",
  "apps/mobile/src",
  "apps/mobile/app.json",
  "apps/mobile/babel.config.js",
  "apps/mobile/metro.config.js",
  "apps/mobile/package.json",
  "apps/mobile/.env.example"
];

const textExtensions = new Set([".js", ".json", ".ts", ".tsx", ".example"]);
const allowedPublicEnvKeys = new Set([
  "EXPO_PUBLIC_TINY_PET_API_BASE_URL",
  "EXPO_PUBLIC_TINY_PET_ALLOW_DEVELOPMENT_AUTH_FALLBACK",
  "EXPO_PUBLIC_TINY_PET_MOCK_AUTH_TOKEN",
  "EXPO_PUBLIC_TINY_PET_PRIVACY_URL",
  "EXPO_PUBLIC_TINY_PET_TERMS_URL",
  "EXPO_PUBLIC_TINY_PET_SUPPORT_EMAIL",
  "EXPO_PUBLIC_TINY_PET_ENABLE_NATIVE_CHECKOUT",
  "EXPO_PUBLIC_TINY_PET_STORE_SCREENSHOT_PRESET",
  "EXPO_PUBLIC_TINY_PET_QA_SCREEN_PRESET"
]);
const explicitlyAllowedDevelopmentTokenKeys = new Set(["EXPO_PUBLIC_TINY_PET_MOCK_AUTH_TOKEN"]);
const serverOnlyEnvPattern = /\b(?<!EXPO_PUBLIC_)TINY_PET_[A-Z0-9_]+\b/g;
const publicEnvPattern = /\bEXPO_PUBLIC_TINY_PET_[A-Z0-9_]+\b/g;
const publicSecretKeyPattern = /(?:API[_-]?KEY|SECRET|PRIVATE[_-]?KEY|SERVICE[_-]?ACCOUNT|WEBHOOK|DATABASE|STORAGE|OPENAI|GOOGLE[_-]?PLAY|APP[_-]?STORE|COMMERCE|PROVIDER|JWKS|ISSUER|AUDIENCE|BEARER|RECEIPT|TOKEN)/i;
const realLookingSecretPattern = /(?:sk-[A-Za-z0-9_-]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{12,}|xox[baprs]-[A-Za-z0-9-]{16,})/;

const fileExtension = (filePath) => {
  if (filePath.endsWith(".env.example")) {
    return ".example";
  }

  const dotIndex = filePath.lastIndexOf(".");

  return dotIndex === -1 ? "" : filePath.slice(dotIndex);
};

const listFiles = (absolutePath) => {
  if (!existsSync(absolutePath)) {
    failures.push(`${relative(ROOT, absolutePath)} is missing.`);
    return [];
  }

  if (statSync(absolutePath).isFile()) {
    return [absolutePath];
  }

  return readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    const childPath = join(absolutePath, entry.name);

    if (entry.isDirectory()) {
      return listFiles(childPath);
    }

    return entry.isFile() ? [childPath] : [];
  });
};

const checkedFiles = checkedRoots
  .flatMap((rootPath) => listFiles(resolve(ROOT, rootPath)))
  .filter((filePath) => textExtensions.has(fileExtension(filePath)));

for (const filePath of checkedFiles) {
  const relativePath = relative(ROOT, filePath);
  const content = readFileSync(filePath, "utf8");
  const serverOnlyKeys = [...new Set(content.match(serverOnlyEnvPattern) ?? [])];
  const publicKeys = [...new Set(content.match(publicEnvPattern) ?? [])];

  for (const key of serverOnlyKeys) {
    failures.push(`${relativePath} must not reference server-only env key ${key}.`);
  }

  for (const key of publicKeys) {
    if (!allowedPublicEnvKeys.has(key)) {
      failures.push(`${relativePath} references unsupported mobile public env key ${key}.`);
    }

    if (!explicitlyAllowedDevelopmentTokenKeys.has(key) && publicSecretKeyPattern.test(key)) {
      failures.push(`${relativePath} exposes secret-shaped public env key ${key}.`);
    }
  }

  if (realLookingSecretPattern.test(content)) {
    failures.push(`${relativePath} contains a real-looking API key or private key.`);
  }
}

if (failures.length > 0) {
  console.error("Mobile secret boundary validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Mobile secret boundary validation passed.");
