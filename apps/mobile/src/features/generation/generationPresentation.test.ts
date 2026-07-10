import { describe, expect, it, vi } from "vitest";

const { playSfx } = vi.hoisted(() => ({ playSfx: vi.fn() }));

vi.mock("../../shared/audio", () => ({ playSfx }));

import {
  getGenerationPresentation,
  playGenerationStartCueOnce,
  resetGenerationPresentationForTests
} from "./generationPresentation";

describe("generation presentation", () => {
  it("keeps created and preprocessing in a preparing state instead of a paused-error state", () => {
    expect(getGenerationPresentation({ status: "created", activeGenerationJobId: undefined })).toMatchObject({
      isPreparing: true,
      showsPausedFailure: false,
      statusCopy: "Preparing the tiny studio.",
      guidance: "Keep a stable connection. If the app is interrupted, this same move-in resumes when you return."
    });

    expect(getGenerationPresentation({ status: "preprocessing", activeGenerationJobId: "job_001" })).toMatchObject({
      isPreparing: false,
      showsPausedFailure: false,
      guidance: "Keep a stable connection. If the app is interrupted, this same move-in resumes when you return."
    });
  });

  it("only shows paused copy for an actual failed job", () => {
    expect(getGenerationPresentation({ status: "failed", activeGenerationJobId: "job_001" })).toMatchObject({
      isPreparing: false,
      showsPausedFailure: true,
      guidance: null
    });
  });

  it("plays the licensed discovery cue once per generation job, not on repeated renders", () => {
    resetGenerationPresentationForTests();

    expect(playGenerationStartCueOnce("job_001")).toBe(true);
    expect(playGenerationStartCueOnce("job_001")).toBe(false);
    expect(playGenerationStartCueOnce("job_002")).toBe(true);

    expect(playSfx).toHaveBeenCalledTimes(2);
    expect(playSfx).toHaveBeenNthCalledWith(1, "jingle_discovery");
    expect(playSfx).toHaveBeenNthCalledWith(2, "jingle_discovery");
  });
});
