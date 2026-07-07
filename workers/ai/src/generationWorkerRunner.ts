import { runNextGenerationJob } from "./generationWorker";
import type { RunNextGenerationJobInput, RunNextGenerationJobResult } from "./generationWorker";

export interface RunGenerationWorkerBatchInput extends RunNextGenerationJobInput {
  maxJobs?: number;
  stopOnFailure?: boolean;
}

export interface RunGenerationWorkerBatchResult {
  completedJobs: number;
  failedJobs: number;
  idle: boolean;
  results: RunNextGenerationJobResult[];
}

const normalizeMaxJobs = (maxJobs: number | undefined): number => {
  if (maxJobs === undefined) {
    return 1;
  }

  if (!Number.isFinite(maxJobs)) {
    return 1;
  }

  return Math.max(1, Math.floor(maxJobs));
};

export const runGenerationWorkerBatch = async (
  input: RunGenerationWorkerBatchInput
): Promise<RunGenerationWorkerBatchResult> => {
  const { maxJobs, stopOnFailure = false, ...jobInput } = input;
  const limit = normalizeMaxJobs(maxJobs);
  const results: RunNextGenerationJobResult[] = [];
  let completedJobs = 0;
  let failedJobs = 0;
  let idle = false;

  for (let index = 0; index < limit; index += 1) {
    const result = await runNextGenerationJob(jobInput);
    results.push(result);

    if (result.status === "idle") {
      idle = true;
      break;
    }

    if (result.status === "completed") {
      completedJobs += 1;
    } else {
      failedJobs += 1;

      if (stopOnFailure) {
        break;
      }
    }
  }

  return {
    completedJobs,
    failedJobs,
    idle,
    results
  };
};
