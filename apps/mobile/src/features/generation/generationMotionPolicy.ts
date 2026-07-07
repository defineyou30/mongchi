import type { GenerationJobStatus } from "@mongchi/shared";

const terminalGenerationStatuses = new Set<GenerationJobStatus>(["completed", "failed", "cancelled", "expired"]);

interface GenerationMotionPolicyInput {
  reduceMotionEnabled: boolean;
  status: GenerationJobStatus;
}

export interface GenerationMotionPolicy {
  shouldScheduleAutomaticPoll: boolean;
  shouldShowManualContinue: boolean;
}

export const getGenerationMotionPolicy = ({ reduceMotionEnabled, status }: GenerationMotionPolicyInput): GenerationMotionPolicy => {
  const terminal = terminalGenerationStatuses.has(status);

  return {
    shouldScheduleAutomaticPoll: !reduceMotionEnabled && !terminal,
    shouldShowManualContinue: reduceMotionEnabled && !terminal
  };
};
