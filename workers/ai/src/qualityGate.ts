import type {
  GeneratedAssetState,
  GenerationJobInputSnapshot,
  GenerationQualityMetadata,
  PetSpecies
} from "@mongchi/shared";

export type GenerationQualityCheckId =
  | "required_asset_missing"
  | "wrong_species"
  | "no_pet_visible"
  | "multiple_pets_visible"
  | "unsafe_content"
  | "style_mismatch"
  | "low_confidence"
  | "manual_review_required";

export interface ProviderAssetQualitySignal {
  state: GeneratedAssetState;
  width: number;
  height: number;
  transparentBackground: boolean;
  contentHash?: string;
}

export interface ProviderGenerationQualitySignals {
  requestedSpecies: PetSpecies;
  detectedSpecies?: PetSpecies;
  petVisibilityConfidence: number;
  detectedPetCount: number;
  safetyApproved: boolean;
  styleMatchScore: number;
  providerConfidence: number;
  manualReviewRequired?: boolean;
  assets: ProviderAssetQualitySignal[];
}

export interface GenerationQualityThresholds {
  minimumPetVisibilityConfidence?: number;
  minimumStyleMatchScore?: number;
  minimumProviderConfidence?: number;
}

export interface GenerationQualityGateInput extends GenerationQualityThresholds {
  inputSnapshot: GenerationJobInputSnapshot;
  requiredAssetStates: readonly GeneratedAssetState[];
  signals: ProviderGenerationQualitySignals;
}

export type GenerationQualityGateResult =
  | {
      ok: true;
      quality: GenerationQualityMetadata;
    }
  | {
      ok: false;
      quality: GenerationQualityMetadata;
      failureCode: "quality_gate_failed";
      failureMessageSafe: string;
    };

export const defaultGenerationQualityThresholds: Required<GenerationQualityThresholds> = {
  minimumPetVisibilityConfidence: 0.72,
  minimumStyleMatchScore: 0.7,
  minimumProviderConfidence: 0.68
};
const minGeneratedAssetSidePx = 128;
const maxGeneratedAssetSidePx = 2048;

const clampScore = (value: number): number => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

const average = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const hasRenderableAssetShape = (asset: ProviderAssetQualitySignal): boolean =>
  Number.isInteger(asset.width) &&
  Number.isInteger(asset.height) &&
  asset.width >= minGeneratedAssetSidePx &&
  asset.height >= minGeneratedAssetSidePx &&
  asset.width <= maxGeneratedAssetSidePx &&
  asset.height <= maxGeneratedAssetSidePx &&
  asset.transparentBackground;

const unique = <T>(values: readonly T[]): T[] => Array.from(new Set(values));

export const evaluateGenerationQualityGate = ({
  inputSnapshot,
  requiredAssetStates,
  signals,
  minimumPetVisibilityConfidence = defaultGenerationQualityThresholds.minimumPetVisibilityConfidence,
  minimumStyleMatchScore = defaultGenerationQualityThresholds.minimumStyleMatchScore,
  minimumProviderConfidence = defaultGenerationQualityThresholds.minimumProviderConfidence
}: GenerationQualityGateInput): GenerationQualityGateResult => {
  const failedChecks: GenerationQualityCheckId[] = [];
  const producedStates = new Set(signals.assets.filter(hasRenderableAssetShape).map((asset) => asset.state));
  const missingStates = requiredAssetStates.filter((state) => !producedStates.has(state));

  if (missingStates.length > 0) {
    failedChecks.push("required_asset_missing");
  }

  if (signals.requestedSpecies !== inputSnapshot.species || signals.detectedSpecies !== inputSnapshot.species) {
    failedChecks.push("wrong_species");
  }

  if (signals.detectedPetCount < 1 || signals.petVisibilityConfidence < minimumPetVisibilityConfidence) {
    failedChecks.push("no_pet_visible");
  }

  if (signals.detectedPetCount > 1) {
    failedChecks.push("multiple_pets_visible");
  }

  if (!signals.safetyApproved) {
    failedChecks.push("unsafe_content");
  }

  if (signals.styleMatchScore < minimumStyleMatchScore) {
    failedChecks.push("style_mismatch");
  }

  if (signals.providerConfidence < minimumProviderConfidence) {
    failedChecks.push("low_confidence");
  }

  if (signals.manualReviewRequired) {
    failedChecks.push("manual_review_required");
  }

  const dedupedFailedChecks = unique(failedChecks);
  const manualReviewRequired = signals.manualReviewRequired === true || dedupedFailedChecks.includes("manual_review_required");
  const qualityScore = clampScore(
    average([
      signals.petVisibilityConfidence,
      signals.styleMatchScore,
      signals.providerConfidence,
      signals.safetyApproved ? 1 : 0,
      missingStates.length === 0 ? 1 : 0,
      signals.detectedPetCount === 1 ? 1 : 0,
      signals.detectedSpecies === inputSnapshot.species ? 1 : 0
    ])
  );
  const failed = dedupedFailedChecks.length > 0;
  const quality: GenerationQualityMetadata = {
    qualityStatus: failed ? (manualReviewRequired ? "manual_review" : "failed") : "passed",
    qualityScore,
    failedChecks: dedupedFailedChecks,
    manualReviewRequired,
    retryRecommended: failed && !manualReviewRequired
  };

  if (!failed) {
    return {
      ok: true,
      quality
    };
  }

  return {
    ok: false,
    quality,
    failureCode: "quality_gate_failed",
    failureMessageSafe: manualReviewRequired
      ? "Generated pet needs review before it can be shown."
      : "Generated pet could not pass quality checks. Try again."
  };
};
