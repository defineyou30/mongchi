import { beforeEach, describe, expect, it, vi } from "vitest";

const shareMock = vi.fn();
const downloadAsyncMock = vi.fn();

vi.mock("react-native", () => ({
  Share: {
    share: (...args: unknown[]) => shareMock(...args),
    sharedAction: "sharedAction",
    dismissedAction: "dismissedAction"
  }
}));

vi.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/",
  downloadAsync: (...args: unknown[]) => downloadAsyncMock(...args)
}));

import {
  buildFriendShareMessage,
  buildPetRevealShareMessage,
  resolveShareableImageUri,
  sharePetCard
} from "./petShare";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildPetRevealShareMessage", () => {
  it("substitutes the pet name and mentions Mongchi", () => {
    const message = buildPetRevealShareMessage("Miso");

    expect(message).toContain("Miso");
    expect(message).toContain("Mongchi");
  });

  it("only ever returns one of the known template variants", () => {
    const seen = new Set<string>();

    for (let i = 0; i < 50; i += 1) {
      seen.add(buildPetRevealShareMessage("Miso").replace("Miso", "{name}"));
    }

    expect(seen.size).toBeGreaterThan(0);
    for (const variant of seen) {
      expect(variant).toContain("{name}");
      expect(variant).toContain("Mongchi");
    }
  });
});

describe("buildFriendShareMessage", () => {
  it("includes the day count when daysTogether is positive", () => {
    const message = buildFriendShareMessage({ petName: "Luna", daysTogether: 12 });

    expect(message).toBe("Luna has been living in my pocket garden for 12 days. 🐾 (via Mongchi)");
  });

  it("uses singular day wording for exactly 1 day", () => {
    const message = buildFriendShareMessage({ petName: "Luna", daysTogether: 1 });

    expect(message).toBe("Luna has been living in my pocket garden for 1 day. 🐾 (via Mongchi)");
  });

  it("falls back to a dayless line when daysTogether is 0", () => {
    const message = buildFriendShareMessage({ petName: "Luna", daysTogether: 0 });

    expect(message).toBe("Luna lives in my pocket garden. 🐾 (via Mongchi)");
  });

  it("falls back to a dayless line when daysTogether is missing", () => {
    const message = buildFriendShareMessage({ petName: "Luna" });

    expect(message).toBe("Luna lives in my pocket garden. 🐾 (via Mongchi)");
  });
});

describe("resolveShareableImageUri", () => {
  it("returns null when there is no asset uri", async () => {
    const result = await resolveShareableImageUri(null);

    expect(result).toBeNull();
    expect(downloadAsyncMock).not.toHaveBeenCalled();
  });

  it("returns the uri unchanged when it is already a local file uri", async () => {
    const result = await resolveShareableImageUri("file:///documents/pet.png");

    expect(result).toBe("file:///documents/pet.png");
    expect(downloadAsyncMock).not.toHaveBeenCalled();
  });

  it("downloads a remote uri into the cache directory and returns the local path", async () => {
    downloadAsyncMock.mockResolvedValue({ status: 200, uri: "file:///cache/pet-share-123.png", headers: {} });

    const result = await resolveShareableImageUri("https://cdn.example.com/pet.png");

    expect(downloadAsyncMock).toHaveBeenCalledTimes(1);
    expect(downloadAsyncMock.mock.calls[0]![0]).toBe("https://cdn.example.com/pet.png");
    expect(result).toBe("file:///cache/pet-share-123.png");
  });

  it("returns null when the download fails with a non-2xx status", async () => {
    downloadAsyncMock.mockResolvedValue({ status: 404, uri: "file:///cache/pet-share-123.png", headers: {} });

    const result = await resolveShareableImageUri("https://cdn.example.com/pet.png");

    expect(result).toBeNull();
  });

  it("returns null when the download throws", async () => {
    downloadAsyncMock.mockRejectedValue(new Error("network down"));

    const result = await resolveShareableImageUri("https://cdn.example.com/pet.png");

    expect(result).toBeNull();
  });

  it("returns null for a non-http, non-file uri (opaque bundled asset reference)", async () => {
    const result = await resolveShareableImageUri("asset:some-bundled-id");

    expect(result).toBeNull();
    expect(downloadAsyncMock).not.toHaveBeenCalled();
  });
});

describe("sharePetCard", () => {
  it("shares with an image url when the asset uri resolves to a local file", async () => {
    shareMock.mockResolvedValue({ action: "sharedAction" });

    const result = await sharePetCard({
      petName: "Miso",
      assetUri: "file:///documents/pet.png",
      message: "Meet Miso!"
    });

    expect(shareMock).toHaveBeenCalledWith({ url: "file:///documents/pet.png", message: "Meet Miso!" });
    expect(result).toEqual({ ok: true, sharedWithImage: true, dismissed: false });
  });

  it("downloads a remote asset before sharing", async () => {
    downloadAsyncMock.mockResolvedValue({ status: 200, uri: "file:///cache/pet-share-123.png", headers: {} });
    shareMock.mockResolvedValue({ action: "sharedAction" });

    const result = await sharePetCard({
      petName: "Miso",
      assetUri: "https://cdn.example.com/pet.png",
      message: "Meet Miso!"
    });

    expect(shareMock).toHaveBeenCalledWith({ url: "file:///cache/pet-share-123.png", message: "Meet Miso!" });
    expect(result.sharedWithImage).toBe(true);
  });

  it("falls back to a text-only share when there is no resolvable image", async () => {
    shareMock.mockResolvedValue({ action: "sharedAction" });

    const result = await sharePetCard({
      petName: "Miso",
      assetUri: null,
      message: "Meet Miso!"
    });

    expect(shareMock).toHaveBeenCalledWith({ message: "Meet Miso!" });
    expect(result).toEqual({ ok: true, sharedWithImage: false, dismissed: false });
  });

  it("falls back to a text-only share when the remote download fails", async () => {
    downloadAsyncMock.mockResolvedValue({ status: 500, uri: "file:///cache/pet-share-123.png", headers: {} });
    shareMock.mockResolvedValue({ action: "sharedAction" });

    const result = await sharePetCard({
      petName: "Miso",
      assetUri: "https://cdn.example.com/pet.png",
      message: "Meet Miso!"
    });

    expect(shareMock).toHaveBeenCalledWith({ message: "Meet Miso!" });
    expect(result.sharedWithImage).toBe(false);
  });

  it("treats a dismissed share sheet as a quiet, non-error outcome", async () => {
    shareMock.mockResolvedValue({ action: "dismissedAction" });

    const result = await sharePetCard({
      petName: "Miso",
      assetUri: null,
      message: "Meet Miso!"
    });

    expect(result).toEqual({ ok: true, sharedWithImage: false, dismissed: true });
  });

  it("treats a rejected Share.share call as a quiet, non-error outcome", async () => {
    shareMock.mockRejectedValue(new Error("user cancelled"));

    const result = await sharePetCard({
      petName: "Miso",
      assetUri: null,
      message: "Meet Miso!"
    });

    expect(result).toEqual({ ok: false, sharedWithImage: false, dismissed: true });
  });
});
