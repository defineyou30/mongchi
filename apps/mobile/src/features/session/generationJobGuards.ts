import type { GenerationJobId, GenerationJobStatus } from "@mongchi/shared";

/**
 * "Has a generation job already been started for this pet, and is it still
 * live (or awaiting acceptance)" check, used both as
 * TerrariumSessionProvider.startMockGeneration's authoritative,
 * caller-independent guard (never start a new job while one already exists
 * -- only polling or an explicit retry-after-failure may proceed) and by
 * GenerationScreen's auto-start decision (see
 * features/generation/generationAutoStartPolicy.ts). Shared here so the two
 * call sites can't drift apart on what "already started" means.
 *
 * A job id alone is NOT enough: once a job has terminally failed (or was
 * cancelled/expired), its id lingers on petProfile.activeGenerationJobId
 * (retry/accept haven't run yet), and treating that id as "still active"
 * permanently blocks starting over from a freshly picked photo -- the
 * generation screen never gets a chance to retry, and PhotoUploadScreen's
 * Continue silently no-ops forever. Non-success terminal statuses are
 * therefore treated as no-longer-active (mirrors the terminal-status set in
 * generationMotionPolicy.ts, minus "completed"). "completed" stays active on
 * purpose: a completed job is pending accept/reveal, and a new start must
 * not stomp on it.
 */
const terminalNonActiveStatuses = new Set<GenerationJobStatus>(["failed", "cancelled", "expired"]);

export const hasActiveGenerationJob = (
  activeGenerationJobId: GenerationJobId | null | undefined,
  generationStatus?: GenerationJobStatus
): boolean => {
  if (!activeGenerationJobId) {
    return false;
  }

  if (generationStatus && terminalNonActiveStatuses.has(generationStatus)) {
    return false;
  }

  return true;
};
