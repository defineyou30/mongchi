import { describe, expect, it } from "vitest";

import type { GenerationJob } from "@mongchi/shared";

import type { SourcePhotoSafetyClassifier, SourcePhotoSafetyInputPhoto } from "../sourcePhotoSafety";
import { createProviderSourcePhotoSafetyChecker, evaluateLocalSourcePhotoSafety } from "../sourcePhotoSafety";

const basePhoto: SourcePhotoSafetyInputPhoto = {
  photoId: "photo_safe_001",
  contentType: "image/jpeg",
  byteSize: 512,
  width: 800,
  height: 600,
  providerSafeBytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
  metadataRemoved: true,
  warnings: ["jpeg_app1_exif_removed"]
};

const job: GenerationJob = {
  id: "gen_safety_001",
  userId: "user_safety_001",
  petId: "pet_safety_001",
  sourcePhotoIds: ["photo_safe_001"],
  optionalPhotoIds: [],
  status: "safety_checking",
  inputSnapshot: {
    species: "dog",
    petName: "Miso",
    personalityTags: ["curious"],
    talkingStyle: "gentle"
  },
  provider: "mock",
  costUnits: 0,
  quality: {
    qualityStatus: "pending",
    failedChecks: [],
    manualReviewRequired: false,
    retryRecommended: false
  },
  createdAt: "2026-06-24T10:00:00.000Z",
  updatedAt: "2026-06-24T10:00:00.000Z"
};

describe("source photo safety precheck", () => {
  it("approves provider-safe source photos while preserving metadata warnings", () => {
    const result = evaluateLocalSourcePhotoSafety([basePhoto]);

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected local source photo safety approval.");
    }

    expect(result.warnings).toEqual(["jpeg_app1_exif_removed"]);
    expect(result.signals).toEqual([
      {
        photoId: "photo_safe_001",
        safetyApproved: true,
        manualReviewRequired: false,
        confidence: 0.72,
        failedChecks: []
      }
    ]);
  });

  it("fails closed when provider-safe source bytes are empty", () => {
    const result = evaluateLocalSourcePhotoSafety([
      {
        ...basePhoto,
        providerSafeBytes: new Uint8Array()
      }
    ]);

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("Expected local source photo safety failure.");
    }

    expect(result.failureCode).toBe("source_photo_safety_failed");
    expect(result.failureMessageSafe).toBe("Source photo could not pass safety checks. Choose another photo.");
    expect(result.retryable).toBe(true);
    expect(result.quality).toEqual({
      qualityStatus: "failed",
      qualityScore: 0,
      failedChecks: ["source_photo_empty_provider_input"],
      manualReviewRequired: false,
      retryRecommended: true
    });
    expect(result.signals[0]).toMatchObject({
      safetyApproved: false,
      confidence: 0,
      failedChecks: ["source_photo_empty_provider_input"]
    });
  });

  it("routes provider safety classifications into approved source-photo signals", async () => {
    const checker = createProviderSourcePhotoSafetyChecker({
      classifySourcePhoto: async ({ sourcePhoto }) => ({
        safetyApproved: true,
        confidence: 1.4,
        failedChecks: [],
        warnings: [`provider_checked_${sourcePhoto.contentType}`]
      })
    });
    const result = await checker.checkSourcePhotos({
      job,
      sourcePhotos: [basePhoto]
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected provider source photo safety approval.");
    }

    expect(result.warnings).toEqual(["jpeg_app1_exif_removed", "provider_checked_image/jpeg"]);
    expect(result.signals).toEqual([
      {
        photoId: "photo_safe_001",
        safetyApproved: true,
        manualReviewRequired: false,
        confidence: 1,
        failedChecks: []
      }
    ]);
  });

  it("normalizes unsafe provider classifications into retryable source-photo failures", async () => {
    const checker = createProviderSourcePhotoSafetyChecker({
      classifySourcePhoto: async () => ({
        safetyApproved: false,
        confidence: 0.18,
        failedChecks: [" source_photo_unsafe_content ", "source_photo_unsafe_content"]
      })
    });
    const result = await checker.checkSourcePhotos({
      job,
      sourcePhotos: [basePhoto]
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("Expected provider source photo safety failure.");
    }

    expect(result.failureCode).toBe("source_photo_safety_failed");
    expect(result.retryable).toBe(true);
    expect(result.quality).toEqual({
      qualityStatus: "failed",
      qualityScore: 0.18,
      failedChecks: ["source_photo_unsafe_content"],
      manualReviewRequired: false,
      retryRecommended: true
    });
    expect(result.signals).toEqual([
      {
        photoId: "photo_safe_001",
        safetyApproved: false,
        manualReviewRequired: false,
        confidence: 0.18,
        failedChecks: ["source_photo_unsafe_content"]
      }
    ]);
  });

  it("preserves provider manual-review requests without recommending automatic retry", async () => {
    const checker = createProviderSourcePhotoSafetyChecker({
      classifySourcePhoto: async () => ({
        safetyApproved: false,
        manualReviewRequired: true,
        confidence: 0.52,
        failedChecks: []
      })
    });
    const result = await checker.checkSourcePhotos({
      job,
      sourcePhotos: [basePhoto]
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("Expected provider source photo manual review.");
    }

    expect(result.failureCode).toBe("source_photo_manual_review_required");
    expect(result.failureMessageSafe).toBe("Source photo needs review before generation can continue.");
    expect(result.retryable).toBe(false);
    expect(result.quality).toEqual({
      qualityStatus: "manual_review",
      qualityScore: 0.52,
      failedChecks: ["source_photo_manual_review_required"],
      manualReviewRequired: true,
      retryRecommended: false
    });
  });

  it("fails closed when a provider safety classifier is unavailable", async () => {
    const checker = createProviderSourcePhotoSafetyChecker({
      classifySourcePhoto: async () => {
        throw new Error("provider unavailable");
      }
    });
    const result = await checker.checkSourcePhotos({
      job,
      sourcePhotos: [basePhoto]
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("Expected provider source photo classifier failure.");
    }

    expect(result.failureCode).toBe("source_photo_safety_failed");
    expect(result.failureMessageSafe).toBe("Source photo safety check is temporarily unavailable. Try again.");
    expect(result.quality.failedChecks).toEqual(["source_photo_safety_classifier_unavailable"]);
    expect(result.signals[0]).toMatchObject({
      safetyApproved: false,
      confidence: 0,
      failedChecks: ["source_photo_safety_classifier_unavailable"]
    });
  });

  it("does not call provider classification when local source-photo sanity fails", async () => {
    let calls = 0;
    const classifier: SourcePhotoSafetyClassifier = {
      classifySourcePhoto: async () => {
        calls += 1;

        return {
          safetyApproved: true,
          confidence: 1
        };
      }
    };
    const checker = createProviderSourcePhotoSafetyChecker(classifier);
    const result = await checker.checkSourcePhotos({
      job,
      sourcePhotos: [
        {
          ...basePhoto,
          providerSafeBytes: new Uint8Array()
        }
      ]
    });

    expect(result.ok).toBe(false);
    expect(calls).toBe(0);
  });
});
