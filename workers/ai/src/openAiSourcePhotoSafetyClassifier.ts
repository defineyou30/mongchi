import type { GenerationJob } from "@mongchi/shared";

import {
  createProviderSourcePhotoSafetyChecker,
  type SourcePhotoSafetyChecker,
  type SourcePhotoSafetyClassification,
  type SourcePhotoSafetyClassifier,
  type SourcePhotoSafetyInputPhoto
} from "./sourcePhotoSafety";
import type { WorkerRuntimeConfig } from "./workerRuntimeConfig";

export type OpenAiResponsesFetch = (
  url: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
  }
) => Promise<{
  status: number;
  json: () => Promise<unknown>;
}>;

export type OpenAiImageDetail = "low" | "high" | "original" | "auto";

export interface OpenAiSourcePhotoSafetyClassifierOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  fetch?: OpenAiResponsesFetch;
  imageDetail?: OpenAiImageDetail;
  maxOutputTokens?: number;
  instructions?: string;
}

export interface OpenAiSourcePhotoSafetyRuntimeOptions extends Omit<OpenAiSourcePhotoSafetyClassifierOptions, "apiKey" | "model"> {
  model?: string;
}

interface OpenAiResponseOutputContent {
  type?: unknown;
  text?: unknown;
  refusal?: unknown;
}

interface OpenAiResponseOutputItem {
  type?: unknown;
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

const defaultBaseUrl = "https://api.openai.com/v1";
const defaultSafetyModel = "gpt-5.5";
const defaultImageDetail: OpenAiImageDetail = "low";
const defaultMaxOutputTokens = 300;
const fallbackUnsafeCheck = "source_photo_unsafe_content";
const modelRefusalCheck = "source_photo_safety_model_refusal";

const defaultInstructions = [
  "You are a strict source-photo safety classifier for Mongchi.",
  "Classify whether the image is safe to use as a pet avatar source photo.",
  "Approve only ordinary, non-graphic pet photos that are clear enough to identify the pet.",
  "Return manual review for uncertainty, possible people/minors as the subject, unclear content, or ambiguous policy risk.",
  "Reject explicit sexual content, nudity, violence, gore, animal abuse, hate symbols, illegal activity, captchas, watermarks, logos, or text-dominant images.",
  "Use concise failedChecks identifiers such as source_photo_unsafe_content, source_photo_no_pet_visible, source_photo_multiple_pets_visible, source_photo_person_visible, source_photo_minor_visible, source_photo_text_or_logo, source_photo_watermark, source_photo_low_quality, source_photo_wrong_species, or source_photo_manual_review_required."
].join(" ");

const safetyClassificationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    safetyApproved: {
      type: "boolean"
    },
    manualReviewRequired: {
      type: "boolean"
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1
    },
    failedChecks: {
      type: "array",
      items: {
        type: "string"
      }
    },
    warnings: {
      type: "array",
      items: {
        type: "string"
      }
    }
  },
  required: ["safetyApproved", "manualReviewRequired", "confidence", "failedChecks", "warnings"]
} as const;

const getGlobalFetch = (): OpenAiResponsesFetch => {
  const globalFetch = (globalThis as { fetch?: OpenAiResponsesFetch }).fetch;

  if (!globalFetch) {
    throw new Error("Global fetch is not available for OpenAI source photo safety classification.");
  }

  return globalFetch;
};

const normalizeBaseUrl = (baseUrl: string | undefined): string => (baseUrl ?? defaultBaseUrl).replace(/\/+$/g, "");

const clampConfidence = (confidence: number): number => Math.max(0, Math.min(1, Number.isFinite(confidence) ? confidence : 0));

const dataUrlForSourcePhoto = (sourcePhoto: SourcePhotoSafetyInputPhoto): string =>
  `data:${sourcePhoto.contentType};base64,${Buffer.from(sourcePhoto.providerSafeBytes).toString("base64")}`;

const normalizeCheckId = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_:-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 96);

  return normalized.length > 0 ? normalized : null;
};

const normalizeCheckIds = (values: unknown): string[] => {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(new Set(values.map(normalizeCheckId).filter((value): value is string => value !== null)));
};

const parseResponseJson = (value: unknown): OpenAiResponsesJson => {
  if (!value || typeof value !== "object") {
    throw new Error("OpenAI source photo safety response was not valid JSON.");
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

const parseClassification = (value: unknown): SourcePhotoSafetyClassification => {
  if (!value || typeof value !== "object") {
    throw new Error("OpenAI source photo safety classification was not valid.");
  }

  const record = value as {
    safetyApproved?: unknown;
    manualReviewRequired?: unknown;
    confidence?: unknown;
    failedChecks?: unknown;
    warnings?: unknown;
  };

  if (typeof record.safetyApproved !== "boolean" || typeof record.confidence !== "number") {
    throw new Error("OpenAI source photo safety classification was not valid.");
  }

  const failedChecks = normalizeCheckIds(record.failedChecks);
  const manualReviewRequired = record.manualReviewRequired === true;

  if (!record.safetyApproved && !manualReviewRequired && failedChecks.length === 0) {
    failedChecks.push(fallbackUnsafeCheck);
  }

  return {
    safetyApproved: record.safetyApproved,
    manualReviewRequired,
    confidence: clampConfidence(record.confidence),
    failedChecks,
    warnings: normalizeCheckIds(record.warnings)
  };
};

const parseClassificationText = (text: string): SourcePhotoSafetyClassification => {
  try {
    return parseClassification(JSON.parse(text));
  } catch {
    throw new Error("OpenAI source photo safety classification was not valid.");
  }
};

const buildClassificationRequestBody = (input: {
  job: GenerationJob;
  sourcePhoto: SourcePhotoSafetyInputPhoto;
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
        content: [
          {
            type: "input_text",
            text: [
              "Classify this uploaded image as a source photo for generating a cute mobile-game pet avatar.",
              `Expected pet species: ${input.job.inputSnapshot.species}.`,
              `Pet name: ${input.job.inputSnapshot.petName}.`,
              "Return JSON only according to the schema."
            ].join(" ")
          },
          {
            type: "input_image",
            image_url: dataUrlForSourcePhoto(input.sourcePhoto),
            detail: input.imageDetail
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "source_photo_safety_classification",
        strict: true,
        schema: safetyClassificationSchema
      }
    },
    store: false,
    max_output_tokens: input.maxOutputTokens
  });

export const createOpenAiSourcePhotoSafetyClassifier = ({
  apiKey,
  model = defaultSafetyModel,
  baseUrl,
  fetch,
  imageDetail = defaultImageDetail,
  maxOutputTokens = defaultMaxOutputTokens,
  instructions = defaultInstructions
}: OpenAiSourcePhotoSafetyClassifierOptions): SourcePhotoSafetyClassifier => {
  const trimmedApiKey = apiKey.trim();
  const fetchOpenAi = fetch ?? getGlobalFetch();
  const endpoint = `${normalizeBaseUrl(baseUrl)}/responses`;

  if (!trimmedApiKey) {
    throw new Error("OpenAI source photo safety API key is missing.");
  }

  return {
    classifySourcePhoto: async ({ job, sourcePhoto }) => {
      const response = await fetchOpenAi(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${trimmedApiKey}`,
          "Content-Type": "application/json"
        },
        body: buildClassificationRequestBody({
          job,
          sourcePhoto,
          model,
          imageDetail,
          maxOutputTokens,
          instructions
        })
      });

      if (response.status < 200 || response.status >= 300) {
        throw new Error("OpenAI source photo safety request failed.");
      }

      const output = extractOutput(parseResponseJson(await response.json()));

      if (output.refusal) {
        return {
          safetyApproved: false,
          manualReviewRequired: true,
          confidence: 0,
          failedChecks: [modelRefusalCheck],
          warnings: []
        };
      }

      if (!output.text) {
        throw new Error("OpenAI source photo safety response did not include classification JSON.");
      }

      return parseClassificationText(output.text);
    }
  };
};

export const createOpenAiSourcePhotoSafetyClassifierFromRuntimeConfig = (
  config: WorkerRuntimeConfig,
  options: OpenAiSourcePhotoSafetyRuntimeOptions = {}
): SourcePhotoSafetyClassifier => {
  if (!config.provider || config.provider.provider !== "openai") {
    throw new Error("Worker runtime config is missing OpenAI provider settings.");
  }

  return createOpenAiSourcePhotoSafetyClassifier({
    ...options,
    apiKey: config.provider.apiKey,
    model: options.model ?? config.provider.safetyModel ?? config.provider.model ?? defaultSafetyModel
  });
};

export const createOpenAiSourcePhotoSafetyCheckerFromRuntimeConfig = (
  config: WorkerRuntimeConfig,
  options: OpenAiSourcePhotoSafetyRuntimeOptions = {}
): SourcePhotoSafetyChecker =>
  createProviderSourcePhotoSafetyChecker(createOpenAiSourcePhotoSafetyClassifierFromRuntimeConfig(config, options));
