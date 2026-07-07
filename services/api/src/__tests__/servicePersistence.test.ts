import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { ApiResult } from "../service";
import {
  createJsonFileApiServiceSnapshotStore,
  createPersistedMockApiService,
  parseMockApiServiceSnapshot
} from "../servicePersistence";

const userContext = { userId: "user_demo_001" };

const unwrap = <T>(result: ApiResult<T>): T => {
  if (!result.ok) {
    throw new Error(`${result.error.status} ${result.error.code}`);
  }

  return result.data;
};

const withTemporaryDirectory = async (testBody: (directory: string) => Promise<void>) => {
  const directory = await mkdtemp(join(tmpdir(), "tiny-pet-api-"));

  try {
    await testBody(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

describe("mock API service snapshot persistence", () => {
  it("persists and restores service state from a JSON snapshot file", async () => {
    await withTemporaryDirectory(async (directory) => {
      const store = createJsonFileApiServiceSnapshotStore(join(directory, "snapshot.json"));

      await expect(store.load()).resolves.toBeNull();

      const persisted = await createPersistedMockApiService(store, { seed: { pets: [], generatedAssets: [] } });
      const firstPet = unwrap(
        persisted.service.createPet(userContext, {
          name: "Nori",
          species: "dog",
          personalityTags: ["curious"],
          talkingStyle: "gentle"
        })
      );

      await persisted.save();

      const reloaded = await createPersistedMockApiService(store);
      const secondPet = unwrap(
        reloaded.service.createPet(userContext, {
          name: "Dubu",
          species: "cat",
          personalityTags: ["sleepy"],
          talkingStyle: "comforting"
        })
      );

      expect(unwrap(reloaded.service.listPets(userContext)).pets.map((pet) => pet.id)).toEqual([
        firstPet.id,
        secondPet.id
      ]);
      expect(secondPet.id).not.toBe(firstPet.id);
    });
  });

  it("ignores malformed or incomplete snapshot documents", async () => {
    await withTemporaryDirectory(async (directory) => {
      const snapshotPath = join(directory, "snapshot.json");
      const store = createJsonFileApiServiceSnapshotStore(snapshotPath);

      await writeFile(snapshotPath, JSON.stringify({ sequence: 1, pets: [] }), "utf8");

      await expect(store.load()).resolves.toBeNull();
      expect(parseMockApiServiceSnapshot({ sequence: 0 })).toBeNull();
    });
  });
});
