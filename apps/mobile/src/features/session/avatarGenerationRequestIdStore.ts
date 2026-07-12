export interface AvatarGenerationRequestIdStorage {
  readonly getItem: (key: string) => Promise<string | null>;
  readonly setItem: (key: string, value: string) => Promise<void>;
  readonly removeItem: (key: string) => Promise<void>;
}

interface StoredAvatarGenerationRequest {
  readonly requestId: string;
  readonly photoFingerprint: string;
}

type AvatarGenerationRequestIdResult =
  | { readonly ok: true; readonly requestId: string }
  | { readonly ok: false; readonly reason: "storage_unavailable" };

const requestKey = (petId: string): string => `mongchi/avatar-generation-request-v1/${petId}`;

const parseStoredRequest = (value: string | null): StoredAvatarGenerationRequest | null => {
  if (!value) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "requestId" in parsed &&
      "photoFingerprint" in parsed &&
      typeof parsed.requestId === "string" &&
      typeof parsed.photoFingerprint === "string" &&
      parsed.requestId.trim().length > 0
    ) {
      return { requestId: parsed.requestId, photoFingerprint: parsed.photoFingerprint };
    }
  } catch {
    return null;
  }

  return null;
};

export const getOrCreateAvatarGenerationRequestId = async (
  storage: AvatarGenerationRequestIdStorage,
  petId: string,
  photoFingerprint: string,
  createRequestId: () => string
): Promise<AvatarGenerationRequestIdResult> => {
  try {
    const key = requestKey(petId);
    const existing = parseStoredRequest(await storage.getItem(key));

    if (existing?.photoFingerprint === photoFingerprint) {
      return { ok: true, requestId: existing.requestId };
    }

    const requestId = createRequestId();
    await storage.setItem(key, JSON.stringify({ requestId, photoFingerprint } satisfies StoredAvatarGenerationRequest));
    return { ok: true, requestId };
  } catch {
    return { ok: false, reason: "storage_unavailable" };
  }
};

export const clearAvatarGenerationRequestId = async (
  storage: AvatarGenerationRequestIdStorage,
  petId: string
): Promise<boolean> => {
  try {
    await storage.removeItem(requestKey(petId));
    return true;
  } catch {
    return false;
  }
};

export const rotateAvatarGenerationRequestId = async (
  storage: AvatarGenerationRequestIdStorage,
  petId: string,
  photoFingerprint: string,
  requestId: string
): Promise<boolean> => {
  try {
    await storage.setItem(requestKey(petId), JSON.stringify({ requestId, photoFingerprint } satisfies StoredAvatarGenerationRequest));
    return true;
  } catch {
    return false;
  }
};
