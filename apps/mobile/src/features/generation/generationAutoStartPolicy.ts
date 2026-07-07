import type { GenerationJobId, GenerationJobStatus } from "@mongchi/shared";

import { hasActiveGenerationJob } from "../session/generationJobGuards";

/**
 * Decides whether GenerationScreen's mount effect should call
 * startMockGeneration.
 *
 * Deliberately NOT keyed on generation.status === "created" alone: the
 * Supabase-backed flow's server job also reports status "created" for the
 * first few seconds after insert, before the generate-avatar edge
 * function's pipeline flips it to "safety_checking". Polling during that
 * window maps the server's "created" straight through to the local
 * generation.status (see toLocalGenerationState in
 * supabaseGenerationSession.ts), which looks identical to the pre-start
 * value. A start decision keyed only on status would re-fire on every such
 * poll, uploading a new photo and invoking generate-avatar again for a job
 * that is already in flight -- observed in practice as a new invoke roughly
 * every ~20s for as long as the screen stayed mounted before the job left
 * "created", producing hundreds of duplicate jobs.
 *
 * activeGenerationJobId is the real "has a job been started" signal: it is
 * set synchronously in the same state patch as the initial status write and
 * does not flicker back and forth the way generation.status can.
 *
 * Auto-start must never fire from a failed (or cancelled/expired) status.
 * Recovering from a terminal failure is only ever a deliberate user action
 * -- PhotoUploadScreen's "Continue" after picking a new photo, or
 * GenerationScreen's "Try again" (retryMockGeneration) -- never something
 * this mount effect decides on its own. The `status === "created"` check
 * below already excludes "failed", but the guard is kept explicit so a
 * future edit loosening that check can't silently reopen the auto-start
 * path for a failed job.
 */
export interface GenerationAutoStartPolicyInput {
  activeGenerationJobId: GenerationJobId | undefined;
  status: GenerationJobStatus;
  alreadyAttempted: boolean;
}

const terminalFailureStatuses = new Set<GenerationJobStatus>(["failed", "cancelled", "expired"]);

export const shouldAutoStartGeneration = ({
  activeGenerationJobId,
  status,
  alreadyAttempted
}: GenerationAutoStartPolicyInput): boolean => {
  if (alreadyAttempted) {
    return false;
  }

  if (terminalFailureStatuses.has(status)) {
    return false;
  }

  if (hasActiveGenerationJob(activeGenerationJobId, status)) {
    return false;
  }

  return status === "created";
};
