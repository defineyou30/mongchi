import type {
  GenerationJob,
  GenerationQualityMetadata,
  PhotoId,
  SourcePhotoContentType
} from "@mongchi/shared";

export type SourcePhotoSafetyFailureCode = "source_photo_safety_failed" | "source_photo_manual_review_required";

export interface SourcePhotoSafetyInputPhoto {
  photoId: PhotoId;
  contentType: SourcePhotoContentType;
  byteSize: number;
  width: number;
  height: number;
  providerSafeBytes: Uint8Array;
  metadataRemoved: boolean;
  warnings: string[];
}

export interface SourcePhotoSafetySignal {
  photoId: PhotoId;
  safetyApproved: boolean;
  manualReviewRequired: boolean;
  confidence: number;
  failedChecks: string[];
}

export type SourcePhotoSafetyCheckResult =
  | {
      ok: true;
      signals: SourcePhotoSafetySignal[];
      warnings: string[];
    }
  | {
      ok: false;
      failureCode: SourcePhotoSafetyFailureCode;
      failureMessageSafe: string;
      retryable: boolean;
      quality: GenerationQualityMetadata;
      signals: SourcePhotoSafetySignal[];
    };

export interface SourcePhotoSafetyChecker {
  checkSourcePhotos: (input: {
    job: GenerationJob;
    sourcePhotos: readonly SourcePhotoSafetyInputPhoto[];
  }) => Promise<SourcePhotoSafetyCheckResult>;
}

export interface SourcePhotoSafetyClassification {
  safetyApproved: boolean;
  manualReviewRequired?: boolean;
  confidence: number;
  failedChecks?: string[];
  warnings?: string[];
}

export interface SourcePhotoSafetyClassifier {
  classifySourcePhoto: (input: {
    job: GenerationJob;
    sourcePhoto: SourcePhotoSafetyInputPhoto;
  }) => Promise<SourcePhotoSafetyClassification>;
}

const localSafetyConfidence = 0.72;
const classifierUnavailableCheck = "source_photo_safety_classifier_unavailable";
const unsafeContentCheck = "source_photo_unsafe_content";
const manualReviewCheck = "source_photo_manual_review_required";

const createQuality = (input: {
  qualityStatus: GenerationQualityMetadata["qualityStatus"];
  failedChecks: string[];
  manualReviewRequired: boolean;
  retryRecommended: boolean;
  qualityScore?: number;
}): GenerationQualityMetadata => ({
  qualityStatus: input.qualityStatus,
  ...(input.qualityScore === undefined ? {} : { qualityScore: input.qualityScore }),
  failedChecks: input.failedChecks,
  manualReviewRequired: input.manualReviewRequired,
  retryRecommended: input.retryRecommended
});

const clampConfidence = (confidence: number): number => Math.max(0, Math.min(1, Number.isFinite(confidence) ? confidence : 0));

const unique = (values: readonly string[]): string[] => Array.from(new Set(values));

const normalizeCheckIds = (values: readonly string[] | undefined): string[] =>
  unique((values ?? []).map((value) => value.trim()).filter(Boolean));

const averageConfidence = (signals: readonly SourcePhotoSafetySignal[]): number =>
  signals.length === 0 ? 0 : signals.reduce((sum, signal) => sum + signal.confidence, 0) / signals.length;

export const evaluateLocalSourcePhotoSafety = (
  sourcePhotos: readonly SourcePhotoSafetyInputPhoto[]
): SourcePhotoSafetyCheckResult => {
  const signals = sourcePhotos.map<SourcePhotoSafetySignal>((photo) => {
    const failedChecks: string[] = [];

    if (photo.providerSafeBytes.byteLength === 0) {
      failedChecks.push("source_photo_empty_provider_input");
    }

    if (!Number.isInteger(photo.width) || !Number.isInteger(photo.height) || photo.width <= 0 || photo.height <= 0) {
      failedChecks.push("source_photo_invalid_dimensions");
    }

    return {
      photoId: photo.photoId,
      safetyApproved: failedChecks.length === 0,
      manualReviewRequired: false,
      confidence: failedChecks.length === 0 ? localSafetyConfidence : 0,
      failedChecks
    };
  });
  const failedChecks = signals.flatMap((signal) => signal.failedChecks);

  if (failedChecks.length > 0) {
    return {
      ok: false,
      failureCode: "source_photo_safety_failed",
      failureMessageSafe: "Source photo could not pass safety checks. Choose another photo.",
      retryable: true,
      quality: createQuality({
        qualityStatus: "failed",
        qualityScore: 0,
        failedChecks: Array.from(new Set(failedChecks)),
        manualReviewRequired: false,
        retryRecommended: true
      }),
      signals
    };
  }

  return {
    ok: true,
    signals,
    warnings: Array.from(new Set(sourcePhotos.flatMap((photo) => photo.warnings)))
  };
};

export const createLocalSourcePhotoSafetyChecker = (): SourcePhotoSafetyChecker => ({
  checkSourcePhotos: async ({ sourcePhotos }) => evaluateLocalSourcePhotoSafety(sourcePhotos)
});

const createClassifierUnavailableResult = (
  sourcePhotos: readonly SourcePhotoSafetyInputPhoto[]
): SourcePhotoSafetyCheckResult => {
  const signals = sourcePhotos.map<SourcePhotoSafetySignal>((photo) => ({
    photoId: photo.photoId,
    safetyApproved: false,
    manualReviewRequired: false,
    confidence: 0,
    failedChecks: [classifierUnavailableCheck]
  }));

  return {
    ok: false,
    failureCode: "source_photo_safety_failed",
    failureMessageSafe: "Source photo safety check is temporarily unavailable. Try again.",
    retryable: true,
    quality: createQuality({
      qualityStatus: "failed",
      qualityScore: 0,
      failedChecks: [classifierUnavailableCheck],
      manualReviewRequired: false,
      retryRecommended: true
    }),
    signals
  };
};

export const createProviderSourcePhotoSafetyChecker = (classifier: SourcePhotoSafetyClassifier): SourcePhotoSafetyChecker => ({
  checkSourcePhotos: async ({ job, sourcePhotos }) => {
    const localResult = evaluateLocalSourcePhotoSafety(sourcePhotos);

    if (!localResult.ok) {
      return localResult;
    }

    const signals: SourcePhotoSafetySignal[] = [];
    const warnings = [...localResult.warnings];

    try {
      for (const sourcePhoto of sourcePhotos) {
        const classification = await classifier.classifySourcePhoto({
          job,
          sourcePhoto
        });
        const manualReviewRequired = classification.manualReviewRequired === true;
        const failedChecks = normalizeCheckIds(classification.failedChecks);

        if (!classification.safetyApproved && !manualReviewRequired && failedChecks.length === 0) {
          failedChecks.push(unsafeContentCheck);
        }

        if (manualReviewRequired && !failedChecks.includes(manualReviewCheck)) {
          failedChecks.push(manualReviewCheck);
        }

        signals.push({
          photoId: sourcePhoto.photoId,
          safetyApproved: classification.safetyApproved && !manualReviewRequired && failedChecks.length === 0,
          manualReviewRequired,
          confidence: clampConfidence(classification.confidence),
          failedChecks
        });
        warnings.push(...normalizeCheckIds(classification.warnings));
      }
    } catch {
      return createClassifierUnavailableResult(sourcePhotos);
    }

    const allFailedChecks = unique(signals.flatMap((signal) => signal.failedChecks));
    const manualReviewRequired = signals.some((signal) => signal.manualReviewRequired);

    if (manualReviewRequired) {
      return {
        ok: false,
        failureCode: "source_photo_manual_review_required",
        failureMessageSafe: "Source photo needs review before generation can continue.",
        retryable: false,
        quality: createQuality({
          qualityStatus: "manual_review",
          qualityScore: averageConfidence(signals),
          failedChecks: allFailedChecks.length > 0 ? allFailedChecks : [manualReviewCheck],
          manualReviewRequired: true,
          retryRecommended: false
        }),
        signals
      };
    }

    if (allFailedChecks.length > 0 || signals.some((signal) => !signal.safetyApproved)) {
      return {
        ok: false,
        failureCode: "source_photo_safety_failed",
        failureMessageSafe: "Source photo could not pass safety checks. Choose another photo.",
        retryable: true,
        quality: createQuality({
          qualityStatus: "failed",
          qualityScore: averageConfidence(signals),
          failedChecks: allFailedChecks.length > 0 ? allFailedChecks : [unsafeContentCheck],
          manualReviewRequired: false,
          retryRecommended: true
        }),
        signals
      };
    }

    return {
      ok: true,
      signals,
      warnings: unique(warnings)
    };
  }
});
