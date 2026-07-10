export interface LatestNotificationSyncCoordinator<Input, Output> {
  request: (input: Input) => Promise<Output>;
}

interface PendingInput<Input> {
  input: Input;
}

interface Waiter<Output> {
  resolve: (value: Output) => void;
  reject: (reason: unknown) => void;
}

type DrainOutcome<Output> =
  | { status: "empty" }
  | { status: "failed"; error: unknown }
  | { status: "succeeded"; output: Output };

export const createLatestNotificationSyncCoordinator = <Input, Output>(
  runner: (input: Input) => Promise<Output>
): LatestNotificationSyncCoordinator<Input, Output> => {
  let pending: PendingInput<Input> | null = null;
  let isDraining = false;
  let waiters: Waiter<Output>[] = [];

  const drain = async (): Promise<void> => {
    let outcome: DrainOutcome<Output> = { status: "empty" };

    while (pending) {
      const current = pending;
      pending = null;

      try {
        outcome = { status: "succeeded", output: await runner(current.input) };
      } catch (error) {
        outcome = { status: "failed", error };

        if (pending) {
          continue;
        }
      }
    }

    const completedWaiters = waiters;
    waiters = [];
    isDraining = false;

    if (outcome.status !== "succeeded") {
      const error = outcome.status === "failed"
        ? outcome.error
        : new Error("Notification synchronization completed without a result.");

      for (const waiter of completedWaiters) {
        waiter.reject(error);
      }
      return;
    }

    for (const waiter of completedWaiters) {
      waiter.resolve(outcome.output);
    }
  };

  return {
    request: (input) => {
      pending = { input };

      const result = new Promise<Output>((resolve, reject) => {
        waiters.push({ resolve, reject });
      });

      if (!isDraining) {
        isDraining = true;
        void drain();
      }

      return result;
    }
  };
};
