import { createHash } from "node:crypto";

import sharp from "sharp";

import type { GeneratedAssetState, GenerationJob, GenerationProvider } from "@mongchi/shared";

import type {
  GenerationProviderAdapter,
  PreparedSourcePhoto,
  ProviderGeneratedAsset,
  ProviderGenerationResult
} from "./generationWorker";
import { readImageDimensions } from "./photoIntake";
import type { ProviderGenerationQualitySignals } from "./qualityGate";
import type { WorkerRuntimeConfig } from "./workerRuntimeConfig";

export type OpenAiImageProviderFetch = (
  url: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: FormData;
  }
) => Promise<{
  status: number;
  json: () => Promise<unknown>;
}>;

export type OpenAiImageOutputFormat = "png" | "webp";
export type OpenAiImageQuality = "auto" | "high" | "medium" | "low";
export type OpenAiImageBackground = "transparent" | "opaque" | "auto";

export interface OpenAiImageProviderPromptInput {
  job: GenerationJob;
  state: GeneratedAssetState;
  sourcePhotos: readonly PreparedSourcePhoto[];
}

export interface OpenAiImageQualitySignalInput {
  job: GenerationJob;
  sourcePhotos: readonly PreparedSourcePhoto[];
  requiredAssetStates: readonly GeneratedAssetState[];
  assets: readonly ProviderGeneratedAsset[];
}

export interface OpenAiImageProviderOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  size?: string;
  quality?: OpenAiImageQuality;
  background?: OpenAiImageBackground;
  outputFormat?: OpenAiImageOutputFormat;
  fetch?: OpenAiImageProviderFetch;
  promptBuilder?: (input: OpenAiImageProviderPromptInput) => string;
  qualitySignalEvaluator: (input: OpenAiImageQualitySignalInput) => Promise<ProviderGenerationQualitySignals> | ProviderGenerationQualitySignals;
  /**
   * When > 1, generates multi-state sprite sheets (2x2 for 4, 3x2 for 6) in a single
   * API call per sheet and slices the grid into per-state assets. Cuts both output-image
   * and input-token cost roughly by the sheet size. 1 = one API call per state.
   */
  statesPerSheet?: 1 | 4 | 6;
}

export interface OpenAiImageProviderRuntimeOptions extends Omit<OpenAiImageProviderOptions, "apiKey" | "model"> {
  model?: string;
}

interface OpenAiImagesResponse {
  data?: Array<{
    b64_json?: unknown;
  }>;
  usage?: {
    total_tokens?: unknown;
  };
}

const defaultOpenAiImageModel = "gpt-image-1.5";
const defaultBaseUrl = "https://api.openai.com/v1";
const defaultImageSize = "1024x1024";
// "low" keeps the pixel-art style readable while cutting output cost ~4x vs "medium".
const defaultImageQuality: OpenAiImageQuality = "low";
const defaultBackground: OpenAiImageBackground = "transparent";
const defaultOutputFormat: OpenAiImageOutputFormat = "png";

const getGlobalFetch = (): OpenAiImageProviderFetch => {
  const globalFetch = (globalThis as { fetch?: OpenAiImageProviderFetch }).fetch;

  if (!globalFetch) {
    throw new Error("Global fetch is not available for OpenAI image generation.");
  }

  return globalFetch;
};

const normalizeBaseUrl = (baseUrl: string | undefined): string => (baseUrl ?? defaultBaseUrl).replace(/\/+$/g, "");

const imageFileExtension = (contentType: PreparedSourcePhoto["contentType"]): string => {
  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/png":
    default:
      return "png";
  }
};

const outputMimeType = (format: OpenAiImageOutputFormat): ProviderGeneratedAsset["mimeType"] =>
  format === "webp" ? "image/webp" : "image/png";

const hashBytes = (bytes: Uint8Array): string => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

const copyToArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);

  return copy.buffer;
};

const decodeBase64Image = (value: unknown): Uint8Array => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("OpenAI image response did not include base64 image data.");
  }

  const bytes = new Uint8Array(Buffer.from(value, "base64"));

  if (bytes.byteLength === 0) {
    throw new Error("OpenAI image response included empty image data.");
  }

  return bytes;
};

const parseOpenAiImagesResponse = (value: unknown): OpenAiImagesResponse => {
  if (!value || typeof value !== "object") {
    throw new Error("OpenAI image response was not valid JSON.");
  }

  return value as OpenAiImagesResponse;
};

const statePosePrompts: Record<GeneratedAssetState, string> = {
  base: "Neutral reference pose: relaxed seated or standing three-quarter front view, calm face, paws visible, stable bottom-center contact anchor.",
  idle: "Idle home pose: quietly present, gentle smile or soft curious eyes, seated or standing naturally, ready to be placed in the garden home.",
  happy: "Happy care pose: bright eyes, perked ears or lifted tail, warm smile, small body bounce implied through posture only.",
  sleep: "Sleep/rest pose: curled or tucked resting pose, eyes closed, peaceful face, compact silhouette that still clearly preserves markings.",
  play: "Play pose: playful lean, lifted paw, tail/ears energized, looking at a toy just outside frame without drawing a separate loose toy.",
  hungry: "Hungry pose: attentive food-request expression, slightly expectant eyes, seated politely, no separate food bowl or UI.",
  walk_return: "Walk return pose: cheerful after-walk stance, tiny backpack-like energy optional only if naturally attached, paws grounded and face proud.",
  treat_reaction: "Treat reaction pose: delighted nibble or sparkle-eyed reaction, optional tiny treat held close to mouth or paw, no loose plate or scene prop.",
  chat_portrait: "Chat portrait pose: closer friendly bust-to-full-body framing, direct eye contact, expressive listening face, clean silhouette for a dialogue panel.",
  curious: "Curious pose: head tilt, one paw lifted or ears angled, inquisitive gentle expression, no question mark or speech bubble.",
  celebrate: "Celebrate pose: joyful small jump or proud sit, celebratory expression, no confetti, no text, no badge, no UI.",
  garden_help: "Garden helper pose: helpful stance as if watering or tending plants, optional tiny leaf tucked near paw only if attached, no separate garden tools.",
  seasonal: "Seasonal cozy pose: gentle festive charm through posture and expression, optional tiny wearable flower or scarf, no background, no holiday text.",
  sad: "Sad pose: gently drooped ears and lowered tail, softly downcast glossy eyes, small hunched sit, wistful but still lovable expression, no tears streaming, no rain cloud or UI symbols.",
  sick: "Under-the-weather pose: low-energy curled or slumped sit, half-closed tired eyes, slightly pale cheeks, optional tiny blanket draped on the back only if naturally attached, clearly unwell but cozy and never distressing.",
  messy: "Messy pose: ruffled fur tufts sticking out, small dust smudges on cheeks or paws, mildly sheepish expression as if just rolled somewhere dusty, no dirt pile, no separate props."
};

const identityPromptLines = (job: GenerationJob, sourcePhotos: readonly PreparedSourcePhoto[]): string[] => [
  "Use the provided dog or cat photo as the identity reference, but transform it into a Mongchi companion avatar.",
  "Only the main pet becomes the avatar. Ignore and remove the source photo background, furniture, scenery, lighting, people, duplicate animals, and loose props.",
  `Reference photo count: ${sourcePhotos.length}. Use all provided photos only to infer the same pet identity; never create multiple pets or average the pet into a generic breed mascot.`,
  `Pet species: ${job.inputSnapshot.species}.`,
  `Pet name for personality only, do not render text: ${job.inputSnapshot.petName}.`,
  `Personality tags: ${job.inputSnapshot.personalityTags.join(", ") || "gentle"}.`,
  `Talking style: ${job.inputSnapshot.talkingStyle}.`
];

const contractPromptLines: string[] = [
  "Identity contract: preserve recognizable fur color, markings, face shape, ear shape, muzzle/nose details, eye feel, body type, and visible personality from the photo.",
  "Photo identity priority: do not replace the pet with a generic cute dog/cat, breed stereotype, stock mascot, bundled fallback identity, or the earlier flat placeholder puppy look. Source-photo markings and proportions win over generic cuteness.",
  "Multi-state contract: this asset belongs to a reusable state set, so keep the same species, proportions, face identity, markings, scale, and bottom-center paw/contact anchor that would align with the other states.",
  "State uniqueness contract: the requested state must read through a distinct pose, facial expression, silhouette, or attached wearable cue; do not output idle/base art with only tiny color changes."
];

const stylePromptLines: string[] = [
  "Scene-fit contract: design the pet as if it will stand inside a lush full-screen miniature garden home with soft blue sky, warm grass, flowers, wooden props, glossy game buttons, and collectible 2D/2.5D item art. Match that warm daylight, rim light, ambient occlusion, and natural grass-contact shadow direction even though the output background must stay transparent.",
  "Style contract: high-resolution cozy pixel-art pet sprite for a premium mobile pet-care app, crisp dark outline, intentional visible pixel clusters, soft 2D shading, plush layered fur tufts, warm rounded silhouette, expressive glossy eyes, soft cheeks, readable paws, and clean readable shape at small phone sizes.",
  "Quality bar: the avatar should feel like a polished modern pixel pet sprite painted for the game scene, not like a flat mascot, generic sticker, smoothed placeholder, or photo cutout. Use pixel-cluster fur texture, clean stepped edges, and warm game lighting without becoming low-resolution.",
  "Avoid legacy room-sprite styling, low-resolution 8-bit or 16-bit output, noisy jagged artifacts, oversized square pixels, limited palette sprite sheets, magenta key backgrounds, flat vector mascot styling, clay/plastic toy rendering, photorealism, extra animals, floating feet, missing contact shadow cues, and glass-dome-only framing."
];

const defaultPromptBuilder = ({ job, state, sourcePhotos }: OpenAiImageProviderPromptInput): string =>
  [
    ...identityPromptLines(job, sourcePhotos).slice(0, 5),
    `Requested state: ${state}. ${statePosePrompts[state]}`,
    ...identityPromptLines(job, sourcePhotos).slice(5),
    ...contractPromptLines,
    "App integration contract: one complete pet only, centered, full body unless the requested state is chat_portrait, transparent background, generous padding, no text, no UI, no watermark, no frame, no scenery, no full floor, no detached props except a tiny attached state cue when explicitly allowed.",
    ...stylePromptLines
  ].join(" ");

interface SheetLayout {
  columns: number;
  rows: number;
  size: string;
}

// Supported OpenAI output sizes are 1024x1024, 1536x1024, and 1024x1536; layouts are
// chosen so every cell stays at least 512px per side (quality gate minimum is 128px).
const resolveSheetLayout = (stateCount: number): SheetLayout => {
  if (stateCount >= 6) {
    return { columns: 3, rows: 2, size: "1536x1024" };
  }

  if (stateCount >= 4) {
    return { columns: 2, rows: 2, size: "1024x1024" };
  }

  if (stateCount === 3) {
    return { columns: 3, rows: 1, size: "1536x1024" };
  }

  if (stateCount === 2) {
    return { columns: 2, rows: 1, size: "1536x1024" };
  }

  return { columns: 1, rows: 1, size: defaultImageSize };
};

const sheetPromptBuilder = (
  job: GenerationJob,
  states: readonly GeneratedAssetState[],
  sourcePhotos: readonly PreparedSourcePhoto[],
  layout: SheetLayout
): string => {
  const cellCount = layout.columns * layout.rows;
  const cellList = states.map((state, index) => `Cell ${index + 1} (${state}): ${statePosePrompts[state]}`).join(" ");

  return [
    ...identityPromptLines(job, sourcePhotos),
    `Create a ${layout.columns}x${layout.rows} character state sheet of the SAME single pet, one state per grid cell, reading order left to right then top to bottom.`,
    cellList,
    `Grid contract: divide the canvas into exactly ${cellCount} equal invisible cells (${layout.columns} columns x ${layout.rows} rows). Each pose must be fully contained inside its own cell, centered with generous padding, and must never touch or cross cell boundaries. Use the identical pet identity, scale, and bottom-center paw/contact anchor in every cell.`,
    ...(states.length < cellCount ? ["Leave all unused trailing cells completely empty and fully transparent."] : []),
    "No grid lines, no cell borders, no labels, no numbers, no text anywhere on the sheet. Transparent background across the entire canvas.",
    ...contractPromptLines,
    ...stylePromptLines
  ].join(" ");
};

const sliceSheetIntoCells = async (
  sheetBytes: Uint8Array,
  layout: SheetLayout,
  cellCount: number,
  outputFormat: OpenAiImageOutputFormat
): Promise<Array<{ bytes: Uint8Array; width: number; height: number }>> => {
  const sheet = sharp(Buffer.from(sheetBytes));
  const metadata = await sheet.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("OpenAI image provider returned a sheet with unreadable dimensions.");
  }

  const cellWidth = Math.floor(metadata.width / layout.columns);
  const cellHeight = Math.floor(metadata.height / layout.rows);

  if (cellWidth < 1 || cellHeight < 1) {
    throw new Error("OpenAI image provider sheet is too small to slice.");
  }

  const cells: Array<{ bytes: Uint8Array; width: number; height: number }> = [];

  for (let index = 0; index < cellCount; index += 1) {
    const column = index % layout.columns;
    const row = Math.floor(index / layout.columns);
    const extracted = sharp(Buffer.from(sheetBytes)).extract({
      left: column * cellWidth,
      top: row * cellHeight,
      width: cellWidth,
      height: cellHeight
    });
    const buffer = await (outputFormat === "webp" ? extracted.webp() : extracted.png()).toBuffer();

    cells.push({ bytes: new Uint8Array(buffer), width: cellWidth, height: cellHeight });
  }

  return cells;
};

const appendSourcePhotos = (formData: FormData, sourcePhotos: readonly PreparedSourcePhoto[]): void => {
  for (const sourcePhoto of sourcePhotos) {
    formData.append(
      "image",
      new Blob([copyToArrayBuffer(sourcePhoto.providerSafeBytes)], { type: sourcePhoto.contentType }),
      `${sourcePhoto.photoId}.${imageFileExtension(sourcePhoto.contentType)}`
    );
  }
};

const createRequestBody = (
  input: OpenAiImageProviderPromptInput,
  options: Required<Pick<OpenAiImageProviderOptions, "quality" | "background" | "outputFormat">> &
    Pick<OpenAiImageProviderOptions, "model" | "size" | "promptBuilder">
): FormData => {
  const formData = new FormData();

  appendSourcePhotos(formData, input.sourcePhotos);
  formData.append("model", options.model ?? defaultOpenAiImageModel);
  formData.append("prompt", (options.promptBuilder ?? defaultPromptBuilder)(input));
  formData.append("n", "1");
  formData.append("size", options.size ?? defaultImageSize);
  formData.append("quality", options.quality);
  formData.append("background", options.background);
  formData.append("output_format", options.outputFormat);

  return formData;
};

const chunkStates = (states: readonly GeneratedAssetState[], chunkSize: number): GeneratedAssetState[][] => {
  const chunks: GeneratedAssetState[][] = [];

  for (let index = 0; index < states.length; index += chunkSize) {
    chunks.push([...states.slice(index, index + chunkSize)]);
  }

  return chunks;
};

export const createOpenAiImageEditProvider = ({
  apiKey,
  model = defaultOpenAiImageModel,
  baseUrl,
  size = defaultImageSize,
  quality = defaultImageQuality,
  background = defaultBackground,
  outputFormat = defaultOutputFormat,
  fetch,
  promptBuilder,
  qualitySignalEvaluator,
  statesPerSheet = 1
}: OpenAiImageProviderOptions): GenerationProviderAdapter => {
  const trimmedApiKey = apiKey.trim();
  const fetchOpenAi = fetch ?? getGlobalFetch();
  const endpoint = `${normalizeBaseUrl(baseUrl)}/images/edits`;
  const mimeType = outputMimeType(outputFormat);
  const provider: Exclude<GenerationProvider, "mock"> = "openai";

  if (!trimmedApiKey) {
    throw new Error("OpenAI image provider API key is missing.");
  }

  const requestOpenAiImage = async (formData: FormData): Promise<{ bytes: Uint8Array; totalTokens: number }> => {
    const response = await fetchOpenAi(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${trimmedApiKey}`
      },
      body: formData
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error("OpenAI image provider request failed.");
    }

    const json = parseOpenAiImagesResponse(await response.json());
    const bytes = decodeBase64Image(json.data?.[0]?.b64_json);
    const totalTokens = json.usage?.total_tokens;

    return {
      bytes,
      totalTokens: typeof totalTokens === "number" && Number.isFinite(totalTokens) && totalTokens > 0 ? totalTokens : 0
    };
  };

  return {
    provider,
    generate: async ({ job, sourcePhotos, requiredAssetStates }): Promise<ProviderGenerationResult> => {
      if (sourcePhotos.length === 0) {
        throw new Error("OpenAI image provider requires at least one source photo.");
      }

      const assets: ProviderGeneratedAsset[] = [];
      let costUnits = 0;

      if (statesPerSheet > 1) {
        for (const chunk of chunkStates(requiredAssetStates, statesPerSheet)) {
          if (chunk.length === 1) {
            const state = chunk[0]!;
            const result = await requestOpenAiImage(
              createRequestBody(
                { job, state, sourcePhotos },
                { model, size, quality, background, outputFormat, ...(promptBuilder ? { promptBuilder } : {}) }
              )
            );
            const dimensions = readImageDimensions(result.bytes, mimeType);

            if (!dimensions) {
              throw new Error("OpenAI image provider returned unreadable image bytes.");
            }

            costUnits += result.totalTokens;
            assets.push({
              state,
              bytes: result.bytes,
              width: dimensions.width,
              height: dimensions.height,
              contentHash: hashBytes(result.bytes),
              mimeType,
              transparentBackground: background === "transparent",
              version: 1
            });
            continue;
          }

          const layout = resolveSheetLayout(chunk.length);
          const formData = new FormData();

          appendSourcePhotos(formData, sourcePhotos);
          formData.append("model", model);
          formData.append("prompt", sheetPromptBuilder(job, chunk, sourcePhotos, layout));
          formData.append("n", "1");
          formData.append("size", layout.size);
          formData.append("quality", quality);
          formData.append("background", background);
          formData.append("output_format", outputFormat);

          const result = await requestOpenAiImage(formData);
          const cells = await sliceSheetIntoCells(result.bytes, layout, chunk.length, outputFormat);

          costUnits += result.totalTokens;

          chunk.forEach((state, index) => {
            const cell = cells[index];

            if (!cell) {
              throw new Error("OpenAI image provider sheet slicing produced fewer cells than states.");
            }

            assets.push({
              state,
              bytes: cell.bytes,
              width: cell.width,
              height: cell.height,
              contentHash: hashBytes(cell.bytes),
              mimeType,
              transparentBackground: background === "transparent",
              version: 1
            });
          });
        }
      } else {
        for (const state of requiredAssetStates) {
          const result = await requestOpenAiImage(
            createRequestBody(
              { job, state, sourcePhotos },
              { model, size, quality, background, outputFormat, ...(promptBuilder ? { promptBuilder } : {}) }
            )
          );
          const dimensions = readImageDimensions(result.bytes, mimeType);

          if (!dimensions) {
            throw new Error("OpenAI image provider returned unreadable image bytes.");
          }

          costUnits += result.totalTokens;
          assets.push({
            state,
            bytes: result.bytes,
            width: dimensions.width,
            height: dimensions.height,
            contentHash: hashBytes(result.bytes),
            mimeType,
            transparentBackground: background === "transparent",
            version: 1
          });
        }
      }

      return {
        provider,
        costUnits: costUnits || assets.length,
        assets,
        qualitySignals: await qualitySignalEvaluator({
          job,
          sourcePhotos,
          requiredAssetStates,
          assets
        })
      };
    }
  };
};

const parseStatesPerSheetEnv = (value: string | undefined): 1 | 4 | 6 | undefined => {
  const trimmed = value?.trim();

  if (trimmed === "1" || trimmed === "4" || trimmed === "6") {
    return Number(trimmed) as 1 | 4 | 6;
  }

  return undefined;
};

const parseImageQualityEnv = (value: string | undefined): OpenAiImageQuality | undefined => {
  const trimmed = value?.trim().toLowerCase();

  return trimmed === "auto" || trimmed === "high" || trimmed === "medium" || trimmed === "low" ? trimmed : undefined;
};

export const createOpenAiImageEditProviderFromRuntimeConfig = (
  config: WorkerRuntimeConfig,
  options: OpenAiImageProviderRuntimeOptions
): GenerationProviderAdapter => {
  if (!config.provider || config.provider.provider !== "openai") {
    throw new Error("Worker runtime config is missing OpenAI provider settings.");
  }

  const envStatesPerSheet = parseStatesPerSheetEnv(process.env.TINY_PET_WORKER_IMAGE_STATES_PER_SHEET);
  const envQuality = parseImageQualityEnv(process.env.TINY_PET_WORKER_IMAGE_QUALITY);

  return createOpenAiImageEditProvider({
    ...options,
    apiKey: config.provider.apiKey,
    model: options.model ?? config.provider.model ?? defaultOpenAiImageModel,
    // Production default: 2x2 sheets (4 states per call) for ~4x cost/latency savings.
    statesPerSheet: options.statesPerSheet ?? envStatesPerSheet ?? 4,
    quality: options.quality ?? envQuality ?? defaultImageQuality
  });
};
