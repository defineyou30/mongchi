import { describe, expect, it } from "vitest";

import { classifyGenerationFailureReason } from "./generationFailureReason";

describe("classifyGenerationFailureReason", () => {
  it("buckets quota-exhaustion codes", () => {
    expect(classifyGenerationFailureReason("generation_quota_exceeded")).toBe("quota_exceeded");
    expect(classifyGenerationFailureReason("generation_attempts_exhausted")).toBe("quota_exceeded");
  });

  it("buckets safety-rejection codes", () => {
    expect(classifyGenerationFailureReason("source_photo_safety_failed")).toBe("safety_rejected");
    expect(classifyGenerationFailureReason("source_photo_safety_unavailable")).toBe("safety_rejected");
    expect(classifyGenerationFailureReason("source_photo_manual_review_required")).toBe("safety_rejected");
  });

  it("buckets missing/unreadable source photo codes", () => {
    expect(classifyGenerationFailureReason("original_photo_missing")).toBe("photo_invalid");
    expect(classifyGenerationFailureReason("source_asset_missing")).toBe("photo_invalid");
    expect(classifyGenerationFailureReason("source_photo_required")).toBe("photo_invalid");
    expect(classifyGenerationFailureReason("source_photo_unreadable")).toBe("photo_invalid");
  });

  it("buckets quality-gate codes", () => {
    expect(classifyGenerationFailureReason("generated_asset_quality_failed")).toBe("quality_check_failed");
    expect(classifyGenerationFailureReason("mock_quality_gate_failed")).toBe("quality_check_failed");
  });

  it("buckets generic server/pipeline codes", () => {
    expect(classifyGenerationFailureReason("generation_failed")).toBe("server_error");
    expect(classifyGenerationFailureReason("asset_upload_failed")).toBe("server_error");
    expect(classifyGenerationFailureReason("unexpected_pipeline_error")).toBe("server_error");
    expect(classifyGenerationFailureReason("generation_job_missing")).toBe("server_error");
  });

  it("falls back to unknown for an unrecognized or missing code", () => {
    expect(classifyGenerationFailureReason("some_brand_new_server_code")).toBe("unknown");
    expect(classifyGenerationFailureReason(undefined)).toBe("unknown");
    expect(classifyGenerationFailureReason(null)).toBe("unknown");
    expect(classifyGenerationFailureReason("")).toBe("unknown");
  });
});
