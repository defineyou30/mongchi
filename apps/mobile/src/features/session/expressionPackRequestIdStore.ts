export interface ExpressionPackRequestIdStorage {
  readonly getItem: (key: string) => Promise<string | null>;
  readonly setItem: (key: string, value: string) => Promise<void>;
  readonly removeItem: (key: string) => Promise<void>;
}

type ExpressionPackRequestIdResult =
  | { readonly ok: true; readonly requestId: string }
  | { readonly ok: false; readonly reason: "storage_unavailable" };

const requestIdKey = (petId: string, packId: string): string =>
  `mongchi/expression-pack-request-v1/${petId}/${packId}`;

export const getOrCreateExpressionPackRequestId = async (
  storage: ExpressionPackRequestIdStorage,
  petId: string,
  packId: string,
  createRequestId: () => string
): Promise<ExpressionPackRequestIdResult> => {
  try {
    const key = requestIdKey(petId, packId);
    const existing = await storage.getItem(key);

    if (existing?.trim()) {
      return { ok: true, requestId: existing };
    }

    const requestId = createRequestId();
    await storage.setItem(key, requestId);
    return { ok: true, requestId };
  } catch {
    return { ok: false, reason: "storage_unavailable" };
  }
};

export const clearExpressionPackRequestId = async (
  storage: ExpressionPackRequestIdStorage,
  petId: string,
  packId: string
): Promise<boolean> => {
  try {
    await storage.removeItem(requestIdKey(petId, packId));
    return true;
  } catch {
    return false;
  }
};

export const rotateExpressionPackRequestId = async (
  storage: ExpressionPackRequestIdStorage,
  petId: string,
  packId: string,
  requestId: string
): Promise<boolean> => {
  try {
    await storage.setItem(requestIdKey(petId, packId), requestId);
    return true;
  } catch {
    return false;
  }
};
