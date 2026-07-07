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
  it("schedules automatic hatching polls only while motion is allowed and generation is active", () => {
    for (const status of inProgressStatuses) {
      expect(getGenerationMotionPolicy({ reduceMotionEnabled: false, status })).toEqual({
        shouldScheduleAutomaticPoll: true,
        shouldShowManualContinue: false
      });
    }

    for (const status of terminalStatuses) {
      expect(getGenerationMotionPolicy({ reduceMotionEnabled: false, status })).toEqual({
        shouldScheduleAutomaticPoll: false,
        shouldShowManualContinue: false
      });
    }
  });

  it("switches active hatching to manual continue when reduce motion is enabled", () => {
    for (const status of inProgressStatuses) {
      expect(getGenerationMotionPolicy({ reduceMotionEnabled: true, status })).toEqual({
        shouldScheduleAutomaticPoll: false,
        shouldShowManualContinue: true
      });
    }

    for (const status of terminalStatuses) {
      expect(getGenerationMotionPolicy({ reduceMotionEnabled: true, status })).toEqual({
        shouldScheduleAutomaticPoll: false,
        shouldShowManualContinue: false
      });
    }
  });
});
