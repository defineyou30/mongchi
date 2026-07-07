import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const manifest = JSON.parse(readFileSync(resolve(ROOT, "docs/store-screenshot-manifest.json"), "utf8"));
const outputDirectory = resolve(ROOT, manifest.outputDirectory ?? "docs/qa-screenshots");
const screenshots = Array.isArray(manifest.screenshots) ? manifest.screenshots : [];
const requiredPlatforms = Array.isArray(manifest.requiredPlatforms) ? manifest.requiredPlatforms : ["ios", "android"];
const failures = [];
const requestedPlatforms = (process.env.TINY_PET_FINAL_SCREENSHOT_FRESHNESS_PLATFORMS ?? "").trim().toLowerCase();

const visualSourceRoots = [
  "apps/mobile/assets/generated",
  "apps/mobile/assets/game-items",
  "apps/mobile/src/features/appShell",
  "apps/mobile/src/features/chat",
  "apps/mobile/src/features/firstSession",
  "apps/mobile/src/features/generation",
  "apps/mobile/src/features/inventory",
  "apps/mobile/src/features/onboarding",
  "apps/mobile/src/features/petReveal",
  "apps/mobile/src/features/petSetup",
  "apps/mobile/src/features/photoUpload",
  "apps/mobile/src/features/shop",
  "apps/mobile/src/features/terrarium",
  "apps/mobile/src/shared/assets",
  "apps/mobile/src/shared/design",
  "apps/mobile/src/shared/ui"
];

const visualSourceFiles = [
  "apps/mobile/src/features/session/runtimePresentationData.ts",
  "apps/mobile/src/features/session/storeScreenshotSession.ts",
  "docs/design/plant-stage-asset-manifest.json",
  "docs/store-screenshot-manifest.json"
];

const visualFilePattern = /\.(json|mjs|png|jpe?g|ts|tsx)$/;
const ignoredSourcePattern = /(\.test\.|__tests__|\.spec\.)/;

const escapeRegex = (value) => value.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");

const platformsToValidate = (() => {
  if (!requestedPlatforms || /^(true|1|yes|all)$/i.test(requestedPlatforms)) {
    return requiredPlatforms;
  }

  const platforms = requestedPlatforms
    .split(",")
    .map((platform) => platform.trim())
    .filter(Boolean);
  const unsupported = platforms.filter((platform) => !requiredPlatforms.includes(platform));

  if (unsupported.length > 0) {
    failures.push(
      `TINY_PET_FINAL_SCREENSHOT_FRESHNESS_PLATFORMS contains unsupported platform(s): ${unsupported.join(", ")}. Use ios, android, all, true, or leave it unset.`
    );
  }

  return platforms;
})();

const collectFiles = (absolutePath) => {
  if (!existsSync(absolutePath)) {
    failures.push(`Visual source path is missing: ${absolutePath}`);
    return [];
  }

  const stat = statSync(absolutePath);

  if (stat.isFile()) {
    return visualFilePattern.test(absolutePath) && !ignoredSourcePattern.test(absolutePath) ? [absolutePath] : [];
  }

  const files = [];

  for (const child of readdirSync(absolutePath)) {
    files.push(...collectFiles(resolve(absolutePath, child)));
  }

  return files;
};

const sourceFiles = [
  ...visualSourceRoots.flatMap((sourceRoot) => collectFiles(resolve(ROOT, sourceRoot))),
  ...visualSourceFiles.flatMap((sourceFile) => collectFiles(resolve(ROOT, sourceFile)))
];

if (sourceFiles.length === 0) {
  failures.push("No visual source files were found for final screenshot freshness validation.");
}

const latestSource = sourceFiles.reduce(
  (latest, filePath) => {
    const mtimeMs = statSync(filePath).mtimeMs;

    if (mtimeMs > latest.mtimeMs) {
      return { filePath, mtimeMs };
    }

    return latest;
  },
  { filePath: null, mtimeMs: 0 }
);

if (!existsSync(outputDirectory)) {
  failures.push(`Screenshot output directory is missing: ${outputDirectory}`);
}

const outputFiles = existsSync(outputDirectory) ? readdirSync(outputDirectory) : [];

for (const platform of platformsToValidate) {
  for (const entry of screenshots) {
    const captureLabel = entry?.captureLabel;
    const preset = entry?.preset;

    if (typeof captureLabel !== "string" || typeof preset !== "string") {
      failures.push("Store screenshot manifest entries must include preset and captureLabel.");
      continue;
    }

    const fileRegex = new RegExp(`^${escapeRegex(platform)}-(.+)-${escapeRegex(captureLabel)}\\.png$`);
    const matches = outputFiles.filter((fileName) => fileRegex.test(fileName) && !fileName.includes("-large-text"));

    if (matches.length === 0) {
      failures.push(`${platform} ${preset} is missing a final screenshot matching ${captureLabel}.`);
      continue;
    }

    const newestScreenshot = matches.reduce(
      (latest, fileName) => {
        const filePath = resolve(outputDirectory, fileName);
        const mtimeMs = statSync(filePath).mtimeMs;

        if (mtimeMs > latest.mtimeMs) {
          return { fileName, mtimeMs };
        }

        return latest;
      },
      { fileName: null, mtimeMs: 0 }
    );

    if (newestScreenshot.mtimeMs + 1000 < latestSource.mtimeMs) {
      failures.push(
        `${platform} ${preset} screenshot ${newestScreenshot.fileName} is older than visual source ${latestSource.filePath}. Recapture store screenshots after the latest UI/art change.`
      );
    }
  }
}

if (failures.length > 0) {
  console.error("Final screenshot freshness validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Final screenshot freshness validation passed for ${platformsToValidate.join("/")}. Latest visual source: ${latestSource.filePath ?? "(none)"}`
);
