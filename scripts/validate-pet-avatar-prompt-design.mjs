import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const failures = [];

const readText = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), "utf8");

const requireIncludes = (relativePath, fragments, label) => {
  const content = readText(relativePath);

  for (const fragment of fragments) {
    if (!content.includes(fragment)) {
      failures.push(`${label}: ${relativePath} must include ${JSON.stringify(fragment)}.`);
    }
  }
};

const requireExcludes = (relativePath, fragments, label) => {
  const content = readText(relativePath);

  for (const fragment of fragments) {
    if (content.includes(fragment)) {
      failures.push(`${label}: ${relativePath} must not include ${JSON.stringify(fragment)}.`);
    }
  }
};

const requiredStates = [
  "idle",
  "base",
  "happy",
  "sleep",
  "play",
  "hungry",
  "walk_return",
  "treat_reaction",
  "chat_portrait",
  "curious",
  "celebrate",
  "garden_help",
  "seasonal"
];

requireIncludes(
  "docs/design/pet-asset-generation-prompts.md",
  [
    "source-photo identity wins over generic cuteness",
    "do not replace the pet with a generic breed mascot",
    "when more than one source photo is provided",
    "Each state must read through a distinct pose, expression, silhouette, or tiny attached wearable cue.",
    "the result looks like a generic cute puppy/cat rather than the user's actual pet",
    "Bundled dog/cat fallback PNGs are only for local QA"
  ],
  "Pet avatar prompt pack"
);

requireIncludes(
  "packages/shared/src/domain/assets.ts",
  requiredStates.map((state) => `"${state}"`),
  "Generated asset state contract"
);

requireIncludes(
  "workers/ai/src/pipeline.ts",
  [
    "productionGeneratedAssetStates",
    "firstPassAssetStates",
    "requiredAssetStates: firstPassAssetStates"
  ],
  "Worker generation state request"
);

requireIncludes(
  "workers/ai/src/openAiImageProvider.ts",
  [
    "Reference photo count",
    "never create multiple pets or average the pet into a generic breed mascot",
    "Photo identity priority",
    "do not replace the pet with a generic cute dog/cat",
    "bundled fallback identity",
    "earlier flat placeholder puppy look",
    "Source-photo markings and proportions win over generic cuteness.",
    "State uniqueness contract",
    "do not output idle/base art with only tiny color changes.",
    "natural grass-contact shadow direction",
    "high-resolution cozy pixel-art pet sprite",
    "intentional visible pixel clusters",
    "Avoid legacy room-sprite styling"
  ],
  "OpenAI pet image prompt"
);

requireIncludes(
  "workers/ai/src/openAiGenerationQualityEvaluator.ts",
  [
    "source photo identity as higher priority than generic cuteness",
    "generic breed mascots",
    "bundled fallback identity drift",
    "distinctive markings, face shape, ears, muzzle, body type, or eye feel",
    "look like idle/base art with only tiny color or mouth changes",
    "Score identity against the source photo before cuteness",
    "Score state readability"
  ],
  "OpenAI generation quality evaluator"
);

requireIncludes(
  "workers/ai/src/__tests__/openAiImageProvider.test.ts",
  [
    "Reference photo count: 1",
    "do not replace the pet with a generic cute dog/cat",
    "State uniqueness contract",
    "Source-photo markings and proportions win over generic cuteness.",
    "do not output idle/base art with only tiny color changes."
  ],
  "OpenAI image provider prompt tests"
);

requireIncludes(
  "workers/ai/src/__tests__/openAiGenerationQualityEvaluator.test.ts",
  [
    "source photo identity as higher priority than generic cuteness",
    "look like idle/base art with only tiny color or mouth changes"
  ],
  "OpenAI generation quality evaluator tests"
);

requireExcludes(
  "workers/ai/src/openAiImageProvider.ts",
  ["Pikibit", "magenta key background only", "full-screen mockup crop"],
  "OpenAI pet image prompt stale source"
);

if (failures.length > 0) {
  console.error("Pet avatar prompt design validation failed:");

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log("Pet avatar prompt design validation passed.");
