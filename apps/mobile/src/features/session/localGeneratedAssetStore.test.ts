import { describe, expect, it, vi, beforeEach } from "vitest";

import type { GeneratedAsset } from "@mongchi/shared";

const {
  documentDirectoryValue,
  filesOnDisk,
  getInfoAsyncMock,
  makeDirectoryAsyncMock,
  downloadAsyncMock,
  deleteAsyncMock
} = vi.hoisted(() => {
  const filesOnDisk = new Set<string>();

  return {
    documentDirectoryValue: "file:///document-directory/",
    filesOnDisk,
    getInfoAsyncMock: vi.fn(async (fileUri: string) => ({
      exists: filesOnDisk.has(fileUri),
      uri: fileUri,
      isDirectory: fileUri.endsWith("/"),
      size: 0,
      modificationTime: 0
    })),
    makeDirectoryAsyncMock: vi.fn(async (_dirUri: string, _options?: Record<string, unknown>) => undefined),
    downloadAsyncMock: vi.fn(async (_remoteUri: string, localFileUri: string): Promise<{
      status: number;
      uri: string;
      headers: Record<string, string>;
      mimeType: string | null;
    }> => {
      filesOnDisk.add(localFileUri);
      return { status: 200, uri: localFileUri, headers: {}, mimeType: "image/png" };
    }),
    deleteAsyncMock: vi.fn(async (fileUri: string, _options?: Record<string, unknown>) => {
      filesOnDisk.delete(fileUri);
    })
  };
});

vi.mock("expo-file-system/legacy", () => ({
  get documentDirectory() {
    return documentDirectoryValue;
  },
  getInfoAsync: getInfoAsyncMock,
  makeDirectoryAsync: makeDirectoryAsyncMock,
  downloadAsync: downloadAsyncMock,
  deleteAsync: deleteAsyncMock
}));

vi.mock("./supabaseGenerationSession", () => ({
  petMediaBucket: "pet-media"
}));

import { ensureLocalGeneratedAssets } from "./localGeneratedAssetStore";

const makeAsset = (overrides: Partial<GeneratedAsset> & { id: string; uri: string }): GeneratedAsset => ({
  petId: "pet_001",
  generationJobId: "job_001",
  state: "idle",
  width: 512,
  height: 512,
  contentHash: `avatars/user_001/job_001/${overrides.id}.png`,
  mimeType: "image/png",
  storageClass: "private_app_asset",
  version: 1,
  qualityStatus: "passed",
  createdAt: "2026-07-14T09:00:00.000Z",
  updatedAt: "2026-07-14T09:00:00.000Z",
  ...overrides
});

const createFakeSupabaseClient = (options: { signedUrl?: string | null; signedUrlError?: { message: string } | null } = {}) => {
  const signedUrlCalls: string[] = [];

  return {
    client: {
      storage: {
        from: vi.fn((_bucket: string) => ({
          createSignedUrl: vi.fn(async (path: string, _expiresIn: number) => {
            signedUrlCalls.push(path);

            if (options.signedUrlError) {
              return { data: null, error: options.signedUrlError };
            }

            return { data: { signedUrl: options.signedUrl ?? `https://resigned.example.com/${path}` }, error: null };
          })
        }))
      }
    },
    signedUrlCalls
  };
};

describe("ensureLocalGeneratedAssets", () => {
  beforeEach(() => {
    filesOnDisk.clear();
    getInfoAsyncMock.mockClear();
    makeDirectoryAsyncMock.mockClear();
    downloadAsyncMock.mockClear();
    deleteAsyncMock.mockClear();
  });

  it("downloads a new asset to a permanent local file and returns its uri", async () => {
    const asset = makeAsset({ id: "asset_idle_001", uri: "https://signed.example.com/idle.png" });

    const result = await ensureLocalGeneratedAssets(null, [asset]);

    expect(downloadAsyncMock).toHaveBeenCalledTimes(1);
    const [remoteUri, localFileUri] = downloadAsyncMock.mock.calls[0]!;
    expect(remoteUri).toBe("https://signed.example.com/idle.png");
    expect(localFileUri).toContain("pet-assets/");
    expect(result.asset_idle_001).toBe(localFileUri);
  });

  it("skips downloading an asset that already has a local file", async () => {
    const asset = makeAsset({ id: "asset_idle_001", uri: "https://signed.example.com/idle.png" });

    const first = await ensureLocalGeneratedAssets(null, [asset]);
    downloadAsyncMock.mockClear();

    const second = await ensureLocalGeneratedAssets(null, [asset]);

    expect(downloadAsyncMock).not.toHaveBeenCalled();
    expect(second.asset_idle_001).toBe(first.asset_idle_001);
  });

  it("re-signs and retries once when the initial download fails, using contentHash as the storage path", async () => {
    downloadAsyncMock.mockImplementationOnce(async () => ({
      status: 400,
      uri: "",
      headers: {},
      mimeType: null
    }));

    const asset = makeAsset({
      id: "asset_happy_001",
      uri: "https://signed.example.com/happy.png",
      contentHash: "avatars/user_001/job_001/happy.png"
    });

    const { client, signedUrlCalls } = createFakeSupabaseClient();

    const result = await ensureLocalGeneratedAssets(client as never, [asset]);

    expect(signedUrlCalls).toEqual(["avatars/user_001/job_001/happy.png"]);
    expect(downloadAsyncMock).toHaveBeenCalledTimes(2);
    expect(downloadAsyncMock.mock.calls[1]![0]).toBe("https://resigned.example.com/avatars/user_001/job_001/happy.png");
    expect(result.asset_happy_001).toBeDefined();
  });

  it("isolates a failed asset (initial and re-signed download both fail) without affecting the others", async () => {
    downloadAsyncMock.mockImplementation(async (remoteUri: string, localFileUri: string) => {
      if (remoteUri.includes("broken")) {
        return { status: 400, uri: "", headers: {}, mimeType: null };
      }

      filesOnDisk.add(localFileUri);
      return { status: 200, uri: localFileUri, headers: {}, mimeType: "image/png" };
    });

    const brokenAsset = makeAsset({
      id: "asset_sleep_001",
      uri: "https://signed.example.com/broken.png",
      contentHash: "avatars/user_001/job_001/sleep.png"
    });
    const healthyAsset = makeAsset({ id: "asset_play_001", uri: "https://signed.example.com/play.png" });

    const { client } = createFakeSupabaseClient({ signedUrlError: { message: "expired" } });

    const result = await ensureLocalGeneratedAssets(client as never, [brokenAsset, healthyAsset]);

    expect(result.asset_sleep_001).toBeUndefined();
    expect(result.asset_play_001).toBeDefined();
    expect(deleteAsyncMock).toHaveBeenCalled();
  });

  it("skips the re-sign retry (but still attempts the initial download) when no client is supplied", async () => {
    downloadAsyncMock.mockImplementationOnce(async () => ({
      status: 400,
      uri: "",
      headers: {},
      mimeType: null
    }));

    const asset = makeAsset({ id: "asset_idle_001", uri: "https://signed.example.com/idle.png" });

    const result = await ensureLocalGeneratedAssets(null, [asset]);

    expect(downloadAsyncMock).toHaveBeenCalledTimes(1);
    expect(result.asset_idle_001).toBeUndefined();
  });

  it("returns an empty map for an empty asset list without touching the filesystem", async () => {
    const result = await ensureLocalGeneratedAssets(null, []);

    expect(result).toEqual({});
    expect(getInfoAsyncMock).not.toHaveBeenCalled();
    expect(downloadAsyncMock).not.toHaveBeenCalled();
  });
});
