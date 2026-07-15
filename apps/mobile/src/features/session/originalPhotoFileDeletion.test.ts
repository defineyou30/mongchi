import { describe, expect, it, vi } from "vitest";

vi.mock("expo-file-system/legacy", () => ({
  deleteAsync: vi.fn(async () => undefined)
}));

vi.mock("../../shared/errors/reporter", () => ({
  reporter: { captureMessage: vi.fn() }
}));

import { deleteOriginalPhotoFile } from "./originalPhotoFileDeletion";
import { reporter } from "../../shared/errors/reporter";

describe("deleteOriginalPhotoFile", () => {
  it("idempotently deletes a local file:// photo", async () => {
    const deleteAsync = vi.fn(async () => undefined);

    await deleteOriginalPhotoFile("file:///var/mobile/tmp/photo.jpg", deleteAsync);

    expect(deleteAsync).toHaveBeenCalledWith("file:///var/mobile/tmp/photo.jpg", { idempotent: true });
  });

  it("skips deletion when there is no uri", async () => {
    const deleteAsync = vi.fn(async () => undefined);

    await deleteOriginalPhotoFile(null, deleteAsync);

    expect(deleteAsync).not.toHaveBeenCalled();
  });

  it("skips deletion for a non-file uri, such as the sample mock photo", async () => {
    const deleteAsync = vi.fn(async () => undefined);

    await deleteOriginalPhotoFile("sample://mongchi/pet-photo.png", deleteAsync);

    expect(deleteAsync).not.toHaveBeenCalled();
  });

  it("swallows a delete failure instead of throwing, and reports it", async () => {
    const deleteAsync = vi.fn(async () => {
      throw new Error("ENOENT: no such file");
    });

    await expect(deleteOriginalPhotoFile("file:///var/mobile/tmp/photo.jpg", deleteAsync)).resolves.toBeUndefined();
    expect(reporter.captureMessage).toHaveBeenCalledWith(
      "photo: original photo file delete failed",
      expect.objectContaining({ cause: expect.stringContaining("ENOENT") })
    );
  });
});
