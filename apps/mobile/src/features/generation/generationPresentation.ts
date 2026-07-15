import type { GenerationJobStatus } from "@mongchi/shared";

import { duckBgmForMs, playSfx, playSuccessHaptic } from "../../shared/audio";

const generationStartGuidance = "Keep a stable connection. If the app is interrupted, this same move-in resumes when you return.";

// jingle_arrival runs ~1.8s (see scripts/audio/synth_sfx.py) -- duck BGM for
// its full length plus a little room so the chime reads clearly over the
// garden loop instead of the two blending together.
const ARRIVAL_JINGLE_DUCK_MS = 2000;

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

const generationArrivalCueJobIds = new Set<string>();

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

/**
 * Plays the "your friend has arrived" jingle exactly once per generation
 * job, the moment its status flips to completed -- not on GenerationScreen
 * entry. It used to be the reverse (jingle_discovery fired on mount, while
 * the pet was still "moving in"), which read like an entrance/battle sting
 * rather than a completion chime. Dedup is keyed by job id (not just a
 * boolean) so a later retry's fresh job still gets its own arrival moment.
 */
export const playGenerationArrivalCueOnce = (generationJobId: string | undefined): boolean => {
  if (!generationJobId || generationArrivalCueJobIds.has(generationJobId)) {
    return false;
  }

  generationArrivalCueJobIds.add(generationJobId);
  duckBgmForMs(ARRIVAL_JINGLE_DUCK_MS);
  playSfx("jingle_arrival");
  playSuccessHaptic();
  return true;
};

export const resetGenerationPresentationForTests = (): void => {
  generationArrivalCueJobIds.clear();
};
