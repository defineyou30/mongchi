import { beforeEach, describe, expect, it, vi } from "vitest";

const { isAvailableAsyncMock, signInAsyncMock } = vi.hoisted(() => ({
  isAvailableAsyncMock: vi.fn(),
  signInAsyncMock: vi.fn()
}));

vi.mock("expo-apple-authentication", () => ({
  isAvailableAsync: isAvailableAsyncMock,
  signInAsync: signInAsyncMock,
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 }
}));

vi.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  randomUUID: vi.fn(() => "raw-nonce-uuid"),
  digestStringAsync: vi.fn(async (_algorithm: string, value: string) => `hashed-${value}`)
}));

import { requestAppleCredential } from "./appleAuthSession";

beforeEach(() => {
  isAvailableAsyncMock.mockReset();
  signInAsyncMock.mockReset();
});

describe("requestAppleCredential", () => {
  it("returns the identity token and raw nonce on a successful sign-in", async () => {
    isAvailableAsyncMock.mockResolvedValue(true);
    signInAsyncMock.mockResolvedValue({ identityToken: "id-token-1" });

    const result = await requestAppleCredential();

    expect(result).toEqual({ ok: true, identityToken: "id-token-1", rawNonce: "raw-nonce-uuid" });
    expect(signInAsyncMock).toHaveBeenCalledWith({
      requestedScopes: [0, 1],
      nonce: "hashed-raw-nonce-uuid"
    });
  });

  it("reports unavailable without attempting sign-in when the OS does not support Apple auth", async () => {
    isAvailableAsyncMock.mockResolvedValue(false);

    const result = await requestAppleCredential();

    expect(result).toEqual({ ok: false, reason: "unavailable" });
    expect(signInAsyncMock).not.toHaveBeenCalled();
  });

  it("maps a user cancellation to a canceled outcome", async () => {
    isAvailableAsyncMock.mockResolvedValue(true);
    signInAsyncMock.mockRejectedValue(Object.assign(new Error("canceled"), { code: "ERR_REQUEST_CANCELED" }));

    const result = await requestAppleCredential();

    expect(result).toEqual({ ok: false, reason: "canceled" });
  });

  it("maps any other thrown error to a failed outcome instead of letting it escape", async () => {
    isAvailableAsyncMock.mockResolvedValue(true);
    signInAsyncMock.mockRejectedValue(new Error("network hiccup"));

    const result = await requestAppleCredential();

    expect(result).toEqual({ ok: false, reason: "failed" });
  });

  it("treats a missing identityToken in the resolved credential as a failed outcome", async () => {
    isAvailableAsyncMock.mockResolvedValue(true);
    signInAsyncMock.mockResolvedValue({ identityToken: null });

    const result = await requestAppleCredential();

    expect(result).toEqual({ ok: false, reason: "failed" });
  });
});
