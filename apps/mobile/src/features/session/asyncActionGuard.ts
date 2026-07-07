/**
 * Wraps an async action so that overlapping calls while one is already in
 * flight are ignored instead of firing the underlying action again. Used to
 * protect generation start/poll/retry flows from duplicate network calls
 * (e.g. a user rapid-tapping "Try again", or a poll effect firing while a
 * retry is still resolving) without needing component state, which only
 * updates on the next render and can't prevent calls made in the same tick.
 */
export const createAsyncActionGuard = () => {
  let inFlight = false;

  const run = (action: () => Promise<unknown>): void => {
    if (inFlight) {
      return;
    }

    inFlight = true;

    // Callers in this codebase resolve to a { ok: false, ... } result rather
    // than rejecting (see startSupabaseGenerationFlow et al.), so a rejection
    // here would be unexpected. Still guard against it: the flag must clear
    // either way, and swallowing here (rather than leaving an unhandled
    // rejection) keeps a stray throw from crashing an unrelated call site.
    // A previously-uncaught throw from one of these flows used to disappear
    // here with zero trace (no log, no job, no error state) -- the retry
    // button just looked like it did nothing. Always warn so a stray
    // rejection is at least visible in the console.
    void action()
      .catch((cause) => {
        console.warn(
          "[asyncActionGuard] action rejected:",
          cause instanceof Error ? cause.message : String(cause)
        );
      })
      .finally(() => {
        inFlight = false;
      });
  };

  return {
    run,
    get isInFlight() {
      return inFlight;
    }
  };
};

export type AsyncActionGuard = ReturnType<typeof createAsyncActionGuard>;
