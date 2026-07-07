import { describe, expect, it } from "vitest";

import { shouldAutoStartGeneration } from "./generationAutoStartPolicy";

describe("shouldAutoStartGeneration", () => {
  it("starts once for a brand-new session (no job yet, status created, not yet attempted)", () => {
    expect(
      shouldAutoStartGeneration({
        activeGenerationJobId: undefined,
        status: "created",
        alreadyAttempted: false
      })
    ).toBe(true);
  });

  it("does not start when activeGenerationJobId is already set, even if status reads created", () => {
    // Regression: the Supabase-backed job also reports "created" for the
    // first few seconds server-side, and a poll landing in that window maps
    // straight through to local generation.status === "created" -- looking
    // identical to a fresh, never-started session. activeGenerationJobId is
    // the signal that must gate the decision, not status alone.
    expect(
      shouldAutoStartGeneration({
        activeGenerationJobId: "gen_job_001",
        status: "created",
        alreadyAttempted: false
      })
    ).toBe(false);
  });

  it("does not start again once generation.status cycles back to created after a job exists", () => {
    // Mirrors the exact observed loop: start() sets local status to
    // "preprocessing" and activeGenerationJobId, then a poll response while
    // the server job is still between "created" and "safety_checking" resets
    // local status to "created" again. The job id staying put must block a
    // second start.
    const afterStart = {
      activeGenerationJobId: "gen_job_001",
      alreadyAttempted: true
    };

    expect(shouldAutoStartGeneration({ ...afterStart, status: "created" })).toBe(false);
    expect(shouldAutoStartGeneration({ ...afterStart, status: "preprocessing" })).toBe(false);
    expect(shouldAutoStartGeneration({ ...afterStart, status: "safety_checking" })).toBe(false);
  });

  it("does not start a second time within the same mount even if the job id is briefly missing", () => {
    // Defense in depth: alreadyAttempted alone must also block re-entry, in
    // case a future refactor produces a render where activeGenerationJobId
    // hasn't propagated yet.
    expect(
      shouldAutoStartGeneration({
        activeGenerationJobId: undefined,
        status: "created",
        alreadyAttempted: true
      })
    ).toBe(false);
  });

  it("does not start for any non-created status when no job exists yet", () => {
    expect(
      shouldAutoStartGeneration({
        activeGenerationJobId: undefined,
        status: "preprocessing",
        alreadyAttempted: false
      })
    ).toBe(false);
  });

  it("never auto-starts from a failed status, even with no job id and not yet attempted", () => {
    // Regression: recovering from a terminal failure must always be a
    // deliberate user action (PhotoUploadScreen's Continue after a new
    // photo, or GenerationScreen's "Try again" / retryMockGeneration) --
    // never something this mount effect decides on its own. Guarded
    // explicitly in addition to the status === "created" check so a future
    // loosening of that check can't silently reopen this path.
    expect(
      shouldAutoStartGeneration({
        activeGenerationJobId: undefined,
        status: "failed",
        alreadyAttempted: false
      })
    ).toBe(false);
  });

  it("never auto-starts from a failed status even when a stale job id is still present", () => {
    expect(
      shouldAutoStartGeneration({
        activeGenerationJobId: "gen_job_001",
        status: "failed",
        alreadyAttempted: false
      })
    ).toBe(false);
  });

  it("never auto-starts from cancelled or expired statuses", () => {
    expect(
      shouldAutoStartGeneration({
        activeGenerationJobId: undefined,
        status: "cancelled",
        alreadyAttempted: false
      })
    ).toBe(false);

    expect(
      shouldAutoStartGeneration({
        activeGenerationJobId: undefined,
        status: "expired",
        alreadyAttempted: false
      })
    ).toBe(false);
  });
});
