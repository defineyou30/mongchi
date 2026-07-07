import { describe, expect, it } from "vitest";

import { hasActiveGenerationJob } from "./generationJobGuards";

describe("hasActiveGenerationJob", () => {
  it("is false when there is no job id", () => {
    expect(hasActiveGenerationJob(undefined)).toBe(false);
    expect(hasActiveGenerationJob(null)).toBe(false);
    expect(hasActiveGenerationJob("")).toBe(false);
  });

  it("is true when a job id exists and no status is supplied (back-compat default)", () => {
    expect(hasActiveGenerationJob("gen_job_001")).toBe(true);
  });

  it("is true for a job id paired with any in-flight (non-terminal) status", () => {
    // This is the crux of the auto-start-loop regression: the Supabase job's
    // server-side status can read "created" again well after a job was
    // started (see generationAutoStartPolicy.ts for the full mechanism), and
    // that must still count as active.
    for (const status of [
      "created",
      "queued",
      "claimed",
      "validating",
      "preprocessing",
      "safety_checking",
      "generating",
      "postprocessing",
      "quality_checking",
      "uploading_assets"
    ] as const) {
      expect(hasActiveGenerationJob("gen_job_001", status)).toBe(true);
    }
  });

  it("is true when the job has completed, since it is pending accept/reveal", () => {
    expect(hasActiveGenerationJob("gen_job_001", "completed")).toBe(true);
  });

  it("is false once the job has terminally failed, even though the id is still set", () => {
    // Regression: a failed job's id lingers on petProfile.activeGenerationJobId
    // until retry/accept runs. Treating that lingering id as "still active"
    // permanently blocked starting over from a freshly picked photo --
    // PhotoUploadScreen's Continue (which calls startMockGeneration, not
    // retryMockGeneration) silently no-op'd forever after a single failure.
    expect(hasActiveGenerationJob("gen_job_001", "failed")).toBe(false);
  });

  it("is false for the other non-success terminal statuses (cancelled, expired)", () => {
    expect(hasActiveGenerationJob("gen_job_001", "cancelled")).toBe(false);
    expect(hasActiveGenerationJob("gen_job_001", "expired")).toBe(false);
  });
});
