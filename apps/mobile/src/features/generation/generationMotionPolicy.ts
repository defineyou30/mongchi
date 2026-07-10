import type { GenerationJobStatus } from "@mongchi/shared";

const terminalGenerationStatuses = new Set<GenerationJobStatus>(["completed", "failed", "cancelled", "expired"]);

interface GenerationMotionPolicyInput {
  reduceMotionEnabled: boolean;
  status: GenerationJobStatus;
}

export interface GenerationMotionPolicy {
  readonly shouldAnimateHatching: boolean;
  readonly shouldScheduleAutomaticPoll: boolean;
  readonly shouldShowManualContinue: boolean;
}

export const getGenerationMotionPolicy = ({ reduceMotionEnabled, status }: GenerationMotionPolicyInput): GenerationMotionPolicy => {
  const terminal = terminalGenerationStatuses.has(status);

  return {
    shouldAnimateHatching: !reduceMotionEnabled && !terminal,
    shouldScheduleAutomaticPoll: !terminal,
    shouldShowManualContinue: false
  };
};
