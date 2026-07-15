/**
 * Buckets the wide, ever-growing set of raw generation failureCode strings
 * (supabase/functions/generate-avatar/index.ts's markJobFailed call sites,
 * plus the mobile-local pre-checks in supabaseGenerationSession.ts and
 * packages/shared's prototypeSession.ts) into a small, closed set of
 * analytics-safe reasons. Analytics properties must never carry free-form
 * text (see mobileAnalyticsWhitelist.ts) -- raw failureCode strings are an
 * open, server-evolvable vocabulary (plain `string`, not a union), so this is
 * the one seam that keeps generation_failed's `reason` property a fixed enum
 * no matter how many new failureCode strings the server introduces later.
 * An unrecognized code safely falls back to "unknown" rather than being
 * rejected outright, so a future server-side code addition never breaks
 * instrumentation here -- it just under-buckets until this list is updated.
 */
export type GenerationFailureReason =
  | "quota_exceeded"
  | "safety_rejected"
  | "photo_invalid"
  | "quality_check_failed"
  | "server_error"
  | "unknown";

const quotaExceededCodes = new Set(["generation_quota_exceeded", "generation_attempts_exhausted"]);

const safetyRejectedCodes = new Set([
  "source_photo_safety_failed",
  "source_photo_safety_unavailable",
  "source_photo_manual_review_required"
]);

const photoInvalidCodes = new Set([
  "original_photo_missing",
  "source_asset_missing",
  "source_photo_required",
  "source_photo_unreadable"
]);

const qualityCheckFailedCodes = new Set(["generated_asset_quality_failed", "mock_quality_gate_failed"]);

const serverErrorCodes = new Set([
  "generation_failed",
  "asset_upload_failed",
  "unexpected_pipeline_error",
  "generation_job_missing"
]);

export const classifyGenerationFailureReason = (failureCode: string | null | undefined): GenerationFailureReason => {
  if (!failureCode) {
    return "unknown";
  }

  if (quotaExceededCodes.has(failureCode)) {
    return "quota_exceeded";
  }

  if (safetyRejectedCodes.has(failureCode)) {
    return "safety_rejected";
  }

  if (photoInvalidCodes.has(failureCode)) {
    return "photo_invalid";
  }

  if (qualityCheckFailedCodes.has(failureCode)) {
    return "quality_check_failed";
  }

  if (serverErrorCodes.has(failureCode)) {
    return "server_error";
  }

  return "unknown";
};
