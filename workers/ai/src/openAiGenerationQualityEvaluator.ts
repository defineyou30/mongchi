import type { PetSpecies } from "@mongchi/shared";

import type { OpenAiImageQualitySignalInput } from "./openAiImageProvider";
import type { OpenAiImageDetail, OpenAiResponsesFetch } from "./openAiSourcePhotoSafetyClassifier";
import type { ProviderGenerationQualitySignals } from "./qualityGate";
import type { WorkerRuntimeConfig } from "./workerRuntimeConfig";

export interface OpenAiGenerationQualityEvaluatorOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  fetch?: OpenAiResponsesFetch;
  imageDetail?: OpenAiImageDetail;
  maxOutputTokens?: number;
  instructions?: string;
}

export interface OpenAiGenerationQualityRuntimeOptions extends Omit<OpenAiGenerationQualityEvaluatorOptions, "apiKey" | "model"> {
  model?: string;
}

interface OpenAiResponseOutputContent {
  type?: unknown;
  text?: unknown;
  refusal?: unknown;
}

interface OpenAiResponseOutputItem {
  content?: unknown;
}

interface OpenAiResponsesJson {
  output_text?: unknown;
  output?: unknown;
}

interface ParsedOutput {
  text?: string;
  refusal?: string;
}

interface GenerationQualityClassification {
  detectedSpecies?: PetSpecies;
  petVisibilityConfidence: number;
  detectedPetCount: number;
  safetyApproved: boolean;
  styleMatchScore: number;
  providerConfidence: number;
  manualReviewRequired: boolean;
}

const defaultBaseUrl = "https://api.openai.com/v1";
const defaultQualityModel = "gpt-5.5";
const defaultImageDetail: OpenAiImageDetail = "low";
const defaultMaxOutputTokens = 400;

const defaultInstructions = [
  "You are a strict generated-pet quality evaluator for Mongchi.",
  "Compare the generated pet avatars against the source pet photo and requested species.",
  "Return structured JSON only.",
  "The generated assets should show one cute pet, match the requested dog/cat species, preserve visible pet identity cues, be safe for a family mobile game, avoid text/logos/watermarks, and match a high-resolution cozy pixel-art pet sprite style with crisp dark outline, intentional visible pixel clusters, soft 2D shading, and warm miniature-garden lighting.",
  "Treat the source photo identity as higher priority than generic cuteness. Penalize generic breed mascots, stock puppy/kitten faces, bundled fallback identity drift, and outputs that lose distinctive markings, face shape, ears, muzzle, body type, or eye feel.",
  "Reward assets that feel like polished high-resolution pixel-art pet sprites for a lush full-screen garden pet sim, with warm daylight, plush fur detail, expressive glossy eyes, natural paws, soft rim light, gentle ambient occlusion, and a consistent bottom-center paw/contact anchor.",
  "Reward assets that keep recognizable identity across states while changing pose/expression enough for the requested state.",
  "Penalize state sets where sleep, play, hungry, walk_return, treat_reaction, chat_portrait, garden_help, seasonal, sad, sick, or messy look like idle/base art with only tiny color or mouth changes.",
  "Penalize legacy room-sprite styling, low-resolution 8-bit or 16-bit sprites, noisy jagged artifacts, oversized square pixels, magenta key backgrounds, flat vector mascots, smoothed placeholder mascots, clay/plastic toy rendering, photorealistic cutouts, scenery, duplicate pets, detached props, floating feet, missing ground-contact cues, and repeated identical poses across different states.",
  "Use manualReviewRequired when species, pet count, safety, identity, state readability, or style is uncertain."
].join(" ");

const generationQualitySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    detectedSpecies: {
      type: "string",
      enum: ["dog", "cat", "unknown"]
    },
    petVisibilityConfidence: {
      type: "number",
      minimum: 0,
      maximum: 1
    },
    detectedPetCount: {
      type: "integer",
      minimum: 0
    },
    safetyApproved: {
      type: "boolean"
    },
    styleMatchScore: {
      type: "number",
      minimum: 0,
      maximum: 1
    },
    providerConfidence: {
      type: "number",
      minimum: 0,
      maximum: 1
    },
    manualReviewRequired: {
      type: "boolean"
    }
  },
  required: [
    "detectedSpecies",
    "petVisibilityConfidence",
    "detectedPetCount",
    "safetyApproved",
    "styleMatchScore",
    "providerConfidence",
    "manualReviewRequired"
  ]
} as const;

const getGlobalFetch = (): OpenAiResponsesFetch => {
  const globalFetch = (globalThis as { fetch?: OpenAiResponsesFetch }).fetch;

  if (!globalFetch) {
    throw new Error("Global fetch is not available for OpenAI generation quality evaluation.");
  }

  return globalFetch;
};

const normalizeBaseUrl = (baseUrl: string | undefined): string => (baseUrl ?? defaultBaseUrl).replace(/\/+$/g, "");

const clampScore = (value: number): number => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

const normalizeCount = (value: number): number => Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));

const sourcePhotoDataUrl = (sourcePhoto: OpenAiImageQualitySignalInput["sourcePhotos"][number]): string =>
  `data:${sourcePhoto.contentType};base64,${Buffer.from(sourcePhoto.providerSafeBytes).toString("base64")}`;

const assetDataUrl = (asset: OpenAiImageQualitySignalInput["assets"][number]): string =>
  `data:${asset.mimeType};base64,${Buffer.from(asset.bytes).toString("base64")}`;

const parseResponseJson = (value: unknown): OpenAiResponsesJson => {
  if (!value || typeof value !== "object") {
    throw new Error("OpenAI generation quality response was not valid JSON.");
  }

  return value as OpenAiResponsesJson;
};

const outputContentItems = (value: unknown): OpenAiResponseOutputContent[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is OpenAiResponseOutputContent => Boolean(item) && typeof item === "object");
};

const extractOutput = (response: OpenAiResponsesJson): ParsedOutput => {
  if (typeof response.output_text === "string" && response.output_text.trim().length > 0) {
    return {
      text: response.output_text
    };
  }

  if (!Array.isArray(response.output)) {
    return {};
  }

  const text: string[] = [];

  for (const rawItem of response.output) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }

    const item = rawItem as OpenAiResponseOutputItem;

    for (const content of outputContentItems(item.content)) {
      if (typeof content.refusal === "string" && content.refusal.trim().length > 0) {
        return {
          refusal: content.refusal
        };
      }

      if (content.type === "output_text" && typeof content.text === "string") {
        text.push(content.text);
      }
    }
  }

  return text.length > 0
    ? {
        text: text.join("")
      }
    : {};
};

const parseGenerationQualityClassification = (value: unknown): GenerationQualityClassification => {
  if (!value || typeof value !== "object") {
    throw new Error("OpenAI generation quality classification was not valid.");
  }

  const record = value as {
    detectedSpecies?: unknown;
    petVisibilityConfidence?: unknown;
    detectedPetCount?: unknown;
    safetyApproved?: unknown;
    styleMatchScore?: unknown;
    providerConfidence?: unknown;
    manualReviewRequired?: unknown;
  };

  if (
    typeof record.petVisibilityConfidence !== "number" ||
    typeof record.detectedPetCount !== "number" ||
    typeof record.safetyApproved !== "boolean" ||
    typeof record.styleMatchScore !== "number" ||
    typeof record.providerConfidence !== "number" ||
    typeof record.manualReviewRequired !== "boolean"
  ) {
    throw new Error("OpenAI generation quality classification was not valid.");
  }

  const detectedSpecies = record.detectedSpecies === "dog" || record.detectedSpecies === "cat" ? record.detectedSpecies : undefined;

  return {
    ...(detectedSpecies ? { detectedSpecies } : {}),
    petVisibilityConfidence: clampScore(record.petVisibilityConfidence),
    detectedPetCount: normalizeCount(record.detectedPetCount),
    safetyApproved: record.safetyApproved,
    styleMatchScore: clampScore(record.styleMatchScore),
    providerConfidence: clampScore(record.providerConfidence),
    manualReviewRequired: record.manualReviewRequired
  };
};

const parseClassificationText = (text: string): GenerationQualityClassification => {
  try {
    return parseGenerationQualityClassification(JSON.parse(text));
  } catch {
    throw new Error("OpenAI generation quality classification was not valid.");
  }
};

const assetSignalsFromInput = (input: OpenAiImageQualitySignalInput): ProviderGenerationQualitySignals["assets"] =>
  input.assets.map((asset) => ({
    state: asset.state,
    width: asset.width,
    height: asset.height,
    transparentBackground: asset.transparentBackground,
    contentHash: asset.contentHash
  }));

const manualReviewSignals = (input: OpenAiImageQualitySignalInput): ProviderGenerationQualitySignals => ({
  requestedSpecies: input.job.inputSnapshot.species,
  petVisibilityConfidence: 0,
  detectedPetCount: 0,
  safetyApproved: false,
  styleMatchScore: 0,
  providerConfidence: 0,
  manualReviewRequired: true,
  assets: assetSignalsFromInput(input)
});

const buildInputContent = (input: OpenAiImageQualitySignalInput, imageDetail: OpenAiImageDetail): Array<Record<string, string>> => {
  const content: Array<Record<string, string>> = [
    {
      type: "input_text",
      text: [
        "Evaluate generated Mongchi pet avatars.",
        `Requested species: ${input.job.inputSnapshot.species}.`,
        `Pet name: ${input.job.inputSnapshot.petName}.`,
        `Required states: ${input.requiredAssetStates.join(", ")}.`,
        "The source photo appears first. Generated assets follow with state labels.",
        "Score identity against the source photo before cuteness: distinctive markings, proportions, face shape, ears, muzzle, eye feel, and body type should survive the style transform.",
        "Score state readability: each requested state should have a distinct pose or expression while preserving the same pet identity.",
        "Score style against the app art direction: high-resolution cozy pixel-art garden pet sprite, not low-resolution 8-bit art, not a flat mascot, and not visually pasted onto the home scene."
      ].join(" ")
    }
  ];

  for (const sourcePhoto of input.sourcePhotos) {
    content.push({
      type: "input_text",
      text: `Source pet photo ${sourcePhoto.photoId}.`
    });
    content.push({
      type: "input_image",
      image_url: sourcePhotoDataUrl(sourcePhoto),
      detail: imageDetail
    });
  }

  for (const asset of input.assets) {
    content.push({
      type: "input_text",
      text: `Generated asset state ${asset.state}.`
    });
    content.push({
      type: "input_image",
      image_url: assetDataUrl(asset),
      detail: imageDetail
    });
  }

  return content;
};

const buildQualityRequestBody = (input: {
  qualityInput: OpenAiImageQualitySignalInput;
  model: string;
  imageDetail: OpenAiImageDetail;
  maxOutputTokens: number;
  instructions: string;
}): string =>
  JSON.stringify({
    model: input.model,
    instructions: input.instructions,
    input: [
      {
        role: "user",
        content: buildInputContent(input.qualityInput, input.imageDetail)
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "generated_pet_quality_classification",
        strict: true,
        schema: generationQualitySchema
      }
    },
    store: false,
    max_output_tokens: input.maxOutputTokens
  });

export const createOpenAiGenerationQualitySignalEvaluator = ({
  apiKey,
  model = defaultQualityModel,
  baseUrl,
  fetch,
  imageDetail = defaultImageDetail,
  maxOutputTokens = defaultMaxOutputTokens,
  instructions = defaultInstructions
}: OpenAiGenerationQualityEvaluatorOptions): ((input: OpenAiImageQualitySignalInput) => Promise<ProviderGenerationQualitySignals>) => {
  const trimmedApiKey = apiKey.trim();
  const fetchOpenAi = fetch ?? getGlobalFetch();
  const endpoint = `${normalizeBaseUrl(baseUrl)}/responses`;

  if (!trimmedApiKey) {
    throw new Error("OpenAI generation quality API key is missing.");
  }

  return async (input) => {
    if (input.assets.length === 0) {
      throw new Error("OpenAI generation quality evaluator requires at least one generated asset.");
    }

    const response = await fetchOpenAi(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${trimmedApiKey}`,
        "Content-Type": "application/json"
      },
      body: buildQualityRequestBody({
        qualityInput: input,
        model,
        imageDetail,
        maxOutputTokens,
        instructions
      })
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error("OpenAI generation quality request failed.");
    }

    const output = extractOutput(parseResponseJson(await response.json()));

    if (output.refusal) {
      return manualReviewSignals(input);
    }

    if (!output.text) {
      throw new Error("OpenAI generation quality response did not include classification JSON.");
    }

    const classification = parseClassificationText(output.text);

    return {
      requestedSpecies: input.job.inputSnapshot.species,
      ...(classification.detectedSpecies ? { detectedSpecies: classification.detectedSpecies } : {}),
      petVisibilityConfidence: classification.petVisibilityConfidence,
      detectedPetCount: classification.detectedPetCount,
      safetyApproved: classification.safetyApproved,
      styleMatchScore: classification.styleMatchScore,
      providerConfidence: classification.providerConfidence,
      manualReviewRequired: classification.manualReviewRequired,
      assets: assetSignalsFromInput(input)
    };
  };
};

export const createOpenAiGenerationQualitySignalEvaluatorFromRuntimeConfig = (
  config: WorkerRuntimeConfig,
  options: OpenAiGenerationQualityRuntimeOptions = {}
): ((input: OpenAiImageQualitySignalInput) => Promise<ProviderGenerationQualitySignals>) => {
  if (!config.provider || config.provider.provider !== "openai") {
    throw new Error("Worker runtime config is missing OpenAI provider settings.");
  }

  return createOpenAiGenerationQualitySignalEvaluator({
    ...options,
    apiKey: config.provider.apiKey,
    model: options.model ?? config.provider.safetyModel ?? config.provider.model ?? defaultQualityModel
  });
};
