import type { GenerationJobStatus } from "@mongchi/shared";

import { playSfx } from "../../shared/audio";

const generationStartGuidance = "Keep a stable connection. If the app is interrupted, this same move-in resumes when you return.";

export interface GenerationPresentation {
  readonly guidance: string | null;
  readonly isPreparing: boolean;
  readonly showsPausedFailure: boolean;
  readonly statusCopy: string | null;
}

export interface GenerationPresentationInput {
  readonly activeGenerationJobId: string | undefined;
  readonly status: GenerationJobStatus;
}

const generationStartCueJobIds = new Set<string>();

export const getGenerationPresentation = ({
  activeGenerationJobId,
  status
}: GenerationPresentationInput): GenerationPresentation => {
  const isPreparing = status === "created" && !activeGenerationJobId;
  const showsPausedFailure = status === "failed";
  const isInFlight = !showsPausedFailure && status !== "completed" && status !== "cancelled" && status !== "expired";

  return {
    isPreparing,
    showsPausedFailure,
    statusCopy: isPreparing ? "Preparing the tiny studio." : null,
    guidance: isInFlight ? generationStartGuidance : null
  };
};

export const playGenerationStartCueOnce = (generationJobId: string | undefined): boolean => {
  if (!generationJobId || generationStartCueJobIds.has(generationJobId)) {
    return false;
  }

  generationStartCueJobIds.add(generationJobId);
  playSfx("jingle_discovery");
  return true;
};

export const resetGenerationPresentationForTests = (): void => {
  generationStartCueJobIds.clear();
};
