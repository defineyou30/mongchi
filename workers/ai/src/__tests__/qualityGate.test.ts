import { describe, expect, it } from "vitest";

import { firstPassAssetStates } from "../pipeline";
import { evaluateGenerationQualityGate } from "../qualityGate";
import type { GenerationQualityGateInput, ProviderGenerationQualitySignals } from "../qualityGate";

const inputSnapshot: GenerationQualityGateInput["inputSnapshot"] = {
  species: "dog",
  petName: "Miso",
  personalityTags: ["curious"],
  talkingStyle: "gentle"
};

const passingSignals: ProviderGenerationQualitySignals = {
  requestedSpecies: "dog",
  detectedSpecies: "dog",
  petVisibilityConfidence: 0.94,
  detectedPetCount: 1,
  safetyApproved: true,
  styleMatchScore: 0.9,
  providerConfidence: 0.91,
  assets: firstPassAssetStates.map((state) => ({
    state,
    width: 1024,
    height: 1024,
    transparentBackground: true,
    contentHash: `sha256:${state}`
  }))
};

describe("generation quality gate", () => {
  it("passes a complete safe one-pet generation result", () => {
    expect(
      evaluateGenerationQualityGate({
        inputSnapshot,
        requiredAssetStates: firstPassAssetStates,
        signals: passingSignals
      })
    ).toEqual({
      ok: true,
      quality: {
        qualityStatus: "passed",
        qualityScore: expect.closeTo(0.964, 3),
        failedChecks: [],
        manualReviewRequired: false,
        retryRecommended: false
      }
    });
  });

  it("fails when required generated asset states are missing or not renderable", () => {
    const result = evaluateGenerationQualityGate({
      inputSnapshot,
      requiredAssetStates: firstPassAssetStates,
      signals: {
        ...passingSignals,
        assets: passingSignals.assets.filter((asset) => asset.state !== "happy")
      }
    });

    expect(result).toMatchObject({
      ok: false,
      failureCode: "quality_gate_failed",
      failureMessageSafe: "Generated pet could not pass quality checks. Try again.",
      quality: {
        qualityStatus: "failed",
        failedChecks: ["required_asset_missing"],
        manualReviewRequired: false,
        retryRecommended: true
      }
    });
  });

  it("fails wrong-species, missing-pet, multiple-pet, unsafe, style, and confidence checks", () => {
    const result = evaluateGenerationQualityGate({
      inputSnapshot,
      requiredAssetStates: firstPassAssetStates,
      signals: {
        ...passingSignals,
        requestedSpecies: "cat",
        detectedSpecies: "cat",
        detectedPetCount: 2,
        petVisibilityConfidence: 0.3,
        safetyApproved: false,
        styleMatchScore: 0.4,
        providerConfidence: 0.5
      }
    });

    expect(result).toMatchObject({
      ok: false,
      quality: {
        qualityStatus: "failed",
        failedChecks: [
          "wrong_species",
          "no_pet_visible",
          "multiple_pets_visible",
          "unsafe_content",
          "style_mismatch",
          "low_confidence"
        ],
        manualReviewRequired: false,
        retryRecommended: true
      }
    });
  });

  it("routes explicit manual-review signals without recommending automatic retry", () => {
    const result = evaluateGenerationQualityGate({
      inputSnapshot,
      requiredAssetStates: firstPassAssetStates,
      signals: {
        ...passingSignals,
        manualReviewRequired: true
      }
    });

    expect(result).toMatchObject({
      ok: false,
      failureMessageSafe: "Generated pet needs review before it can be shown.",
      quality: {
        qualityStatus: "manual_review",
        failedChecks: ["manual_review_required"],
        manualReviewRequired: true,
        retryRecommended: false
      }
    });
  });
});
