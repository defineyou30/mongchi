import { describe, expect, it, vi } from "vitest";

const { duckBgmForMs, playSfx, playSuccessHaptic } = vi.hoisted(() => ({
  duckBgmForMs: vi.fn(),
  playSfx: vi.fn(),
  playSuccessHaptic: vi.fn()
}));

vi.mock("../../shared/audio", () => ({ duckBgmForMs, playSfx, playSuccessHaptic }));

import {
  getGenerationPresentation,
  playGenerationArrivalCueOnce,
  recordGenerationFailureCueOnce,
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

  it("plays the arrival jingle once per generation job, not on repeated renders", () => {
    resetGenerationPresentationForTests();
    playSfx.mockClear();
    playSuccessHaptic.mockClear();
    duckBgmForMs.mockClear();

    expect(playGenerationArrivalCueOnce("job_001")).toBe(true);
    expect(playGenerationArrivalCueOnce("job_001")).toBe(false);
    expect(playGenerationArrivalCueOnce("job_002")).toBe(true);

    expect(playSfx).toHaveBeenCalledTimes(2);
    expect(playSfx).toHaveBeenNthCalledWith(1, "jingle_arrival");
    expect(playSfx).toHaveBeenNthCalledWith(2, "jingle_arrival");
    expect(playSuccessHaptic).toHaveBeenCalledTimes(2);
    expect(duckBgmForMs).toHaveBeenCalledTimes(2);
  });

  it("does not play the arrival jingle for an undefined job id", () => {
    resetGenerationPresentationForTests();
    playSfx.mockClear();

    expect(playGenerationArrivalCueOnce(undefined)).toBe(false);
    expect(playSfx).not.toHaveBeenCalled();
  });

  it("reports a generation failure exactly once per failedAt occurrence", () => {
    resetGenerationPresentationForTests();

    expect(recordGenerationFailureCueOnce("2026-07-15T09:00:00.000Z")).toBe(true);
    expect(recordGenerationFailureCueOnce("2026-07-15T09:00:00.000Z")).toBe(false);
    expect(recordGenerationFailureCueOnce("2026-07-15T09:05:00.000Z")).toBe(true);
  });

  it("never reports a generation failure with no dedupe key", () => {
    resetGenerationPresentationForTests();

    expect(recordGenerationFailureCueOnce(undefined)).toBe(false);
  });
});
