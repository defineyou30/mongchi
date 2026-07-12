export type ExpressionPackStartFinishReason = "completed" | "definitive_failure" | "retryable_failure";

type ExpressionPackStartResult =
  | { readonly ok: true; readonly requestId: string }
  | { readonly ok: false; readonly reason: "start_in_flight" };

export interface ExpressionPackPurchaseCoordinator {
  readonly begin: (packId: string, requestId?: string) => ExpressionPackStartResult;
  readonly finish: (packId: string, reason: ExpressionPackStartFinishReason) => void;
}

export const createExpressionPackPurchaseCoordinator = (
  createRequestId: () => string
): ExpressionPackPurchaseCoordinator => {
  const requestIdByPackId = new Map<string, string>();
  let activePackId: string | null = null;

  return {
    begin: (packId, persistedRequestId) => {
      if (activePackId !== null) {
        return { ok: false, reason: "start_in_flight" };
      }

      activePackId = packId;
      const requestId = requestIdByPackId.get(packId) ?? persistedRequestId ?? createRequestId();
      requestIdByPackId.set(packId, requestId);

      return { ok: true, requestId };
    },
    finish: (packId, reason) => {
      if (activePackId === packId) {
        activePackId = null;
      }

      if (reason !== "retryable_failure") {
        requestIdByPackId.delete(packId);
      }
    }
  };
};
