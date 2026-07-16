import { beforeEach, describe, expect, it, vi } from "vitest";

const writeAsStringAsyncMock = vi.fn();

vi.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/",
  EncodingType: { Base64: "base64" },
  writeAsStringAsync: (...args: unknown[]) => writeAsStringAsyncMock(...args)
}));

import { captureBrandedPetShareCard, shareCardExportHeight, shareCardExportWidth } from "./captureBrandedPetShareCard";
import type { SvgDataUrlSource } from "./captureBrandedPetShareCard";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(123);
});

describe("captureBrandedPetShareCard", () => {
  it("exports the literal export-size PNG to the app cache", async () => {
    // Regression guard: toDataURL's requested output size must always be
    // the shared export constants MongchiShareCard's capture host is laid
    // out at -- a drift here reintroduces the bug where the requested
    // canvas size and the SvgView's actual on-screen bounds disagree.
    expect({ width: shareCardExportWidth, height: shareCardExportHeight }).toEqual({ width: 1080, height: 1350 });

    const source: SvgDataUrlSource = {
      toDataURL: (callback, options) => {
        expect(options).toEqual({ width: shareCardExportWidth, height: shareCardExportHeight });
        callback("png-base64");
      }
    };

    await expect(captureBrandedPetShareCard(source)).resolves.toBe(
      "file:///cache/mongchi-share-card-123.png"
    );
    expect(writeAsStringAsyncMock).toHaveBeenCalledWith(
      "file:///cache/mongchi-share-card-123.png",
      "png-base64",
      { encoding: "base64" }
    );
  });

  it("degrades to text-only when native export fails", async () => {
    const source: SvgDataUrlSource = {
      toDataURL: () => {
        throw new Error("capture unavailable");
      }
    };

    await expect(captureBrandedPetShareCard(source)).resolves.toBeNull();
  });

  it("degrades to text-only instead of hanging when native export never responds", async () => {
    vi.useFakeTimers();
    const source: SvgDataUrlSource = {
      toDataURL: () => undefined
    };
    const result = captureBrandedPetShareCard(source);

    await vi.advanceTimersByTimeAsync(2500);
    await expect(result).resolves.toBeNull();
    vi.useRealTimers();
  });
});
