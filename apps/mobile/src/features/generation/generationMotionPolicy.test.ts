import { describe, expect, it } from "vitest";

import type { GenerationJobStatus } from "@mongchi/shared";

import { getGenerationMotionPolicy } from "./generationMotionPolicy";

const inProgressStatuses: GenerationJobStatus[] = [
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
];

const terminalStatuses: GenerationJobStatus[] = ["completed", "failed", "cancelled", "expired"];

describe("getGenerationMotionPolicy", () => {
  it("keeps polling decisions identical when Reduce Motion changes", () => {
    for (const status of inProgressStatuses) {
      const motionAllowed = getGenerationMotionPolicy({ reduceMotionEnabled: false, status });
      const motionReduced = getGenerationMotionPolicy({ reduceMotionEnabled: true, status });

      expect(motionAllowed.shouldScheduleAutomaticPoll).toBe(true);
      expect(motionReduced.shouldScheduleAutomaticPoll).toBe(true);
      expect(motionReduced.shouldScheduleAutomaticPoll).toBe(motionAllowed.shouldScheduleAutomaticPoll);
      expect(motionAllowed.shouldShowManualContinue).toBe(false);
      expect(motionReduced.shouldShowManualContinue).toBe(false);
      expect(motionAllowed.shouldAnimateHatching).toBe(true);
      expect(motionReduced.shouldAnimateHatching).toBe(false);
    }

    for (const status of terminalStatuses) {
      const motionAllowed = getGenerationMotionPolicy({ reduceMotionEnabled: false, status });
      const motionReduced = getGenerationMotionPolicy({ reduceMotionEnabled: true, status });

      expect(motionAllowed.shouldScheduleAutomaticPoll).toBe(false);
      expect(motionReduced.shouldScheduleAutomaticPoll).toBe(false);
      expect(motionReduced.shouldScheduleAutomaticPoll).toBe(motionAllowed.shouldScheduleAutomaticPoll);
      expect(motionAllowed.shouldShowManualContinue).toBe(false);
      expect(motionReduced.shouldShowManualContinue).toBe(false);
      expect(motionAllowed.shouldAnimateHatching).toBe(false);
      expect(motionReduced.shouldAnimateHatching).toBe(false);
    }
  });
});
