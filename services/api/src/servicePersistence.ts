import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { createMockApiService } from "./service";
import type { MockApiServiceOptions, MockApiServiceSnapshot } from "./service";

export interface ApiServiceSnapshotStore {
  load: () => Promise<MockApiServiceSnapshot | null>;
  save: (snapshot: MockApiServiceSnapshot) => Promise<void>;
}

export interface ApiServiceSnapshotSource {
  snapshot: () => MockApiServiceSnapshot;
}

export interface PersistedMockApiService {
  service: ReturnType<typeof createMockApiService>;
  save: () => Promise<void>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isMissingFileError = (error: unknown): boolean => isRecord(error) && error.code === "ENOENT";

export const parseMockApiServiceSnapshot = (value: unknown): MockApiServiceSnapshot | null => {
  if (!isRecord(value)) {
    return null;
  }

  const sequence = value.sequence;

  if (typeof sequence !== "number" || !Number.isSafeInteger(sequence) || sequence <= 0) {
    return null;
  }

  const {
    pets,
    photos,
    generationJobs,
    generationIssueReports,
    generatedAssets,
    careStates,
    relationshipStates,
    wallets,
    inventories,
    itemCatalog,
    walkSessions,
    recentReactions,
    entitlements,
    purchaseLedger,
    conversations,
    conversationMessages
  } = value;

  if (
    !Array.isArray(pets) ||
    !Array.isArray(photos) ||
    !Array.isArray(generationJobs) ||
    !Array.isArray(generatedAssets) ||
    (generationIssueReports !== undefined && !Array.isArray(generationIssueReports)) ||
    !Array.isArray(careStates) ||
    (relationshipStates !== undefined && !Array.isArray(relationshipStates)) ||
    (wallets !== undefined && !Array.isArray(wallets)) ||
    !Array.isArray(inventories) ||
    !Array.isArray(itemCatalog) ||
    !Array.isArray(walkSessions) ||
    !Array.isArray(recentReactions) ||
    !Array.isArray(entitlements) ||
    !Array.isArray(purchaseLedger) ||
    !Array.isArray(conversations) ||
    !Array.isArray(conversationMessages)
  ) {
    return null;
  }

  return {
    sequence,
    pets: pets as MockApiServiceSnapshot["pets"],
    photos: photos as MockApiServiceSnapshot["photos"],
    generationJobs: generationJobs as MockApiServiceSnapshot["generationJobs"],
    generationIssueReports: (generationIssueReports ?? []) as MockApiServiceSnapshot["generationIssueReports"],
    generatedAssets: generatedAssets as MockApiServiceSnapshot["generatedAssets"],
    careStates: careStates as MockApiServiceSnapshot["careStates"],
    relationshipStates: (relationshipStates ?? []) as MockApiServiceSnapshot["relationshipStates"],
    wallets: (wallets ?? []) as MockApiServiceSnapshot["wallets"],
    inventories: inventories as MockApiServiceSnapshot["inventories"],
    itemCatalog: itemCatalog as MockApiServiceSnapshot["itemCatalog"],
    walkSessions: walkSessions as MockApiServiceSnapshot["walkSessions"],
    recentReactions: recentReactions as MockApiServiceSnapshot["recentReactions"],
    entitlements: entitlements as MockApiServiceSnapshot["entitlements"],
    purchaseLedger: purchaseLedger as MockApiServiceSnapshot["purchaseLedger"],
    conversations: conversations as MockApiServiceSnapshot["conversations"],
    conversationMessages: conversationMessages as MockApiServiceSnapshot["conversationMessages"]
  };
};

export const createJsonFileApiServiceSnapshotStore = (filePath: string): ApiServiceSnapshotStore => ({
  load: async () => {
    let text: string;

    try {
      text = await readFile(filePath, "utf8");
    } catch (error) {
      if (isMissingFileError(error)) {
        return null;
      }

      throw error;
    }

    try {
      return parseMockApiServiceSnapshot(JSON.parse(text));
    } catch {
      return null;
    }
  },
  save: async (snapshot) => {
    await mkdir(dirname(filePath), { recursive: true });

    const temporaryPath = `${filePath}.${randomUUID()}.tmp`;

    await writeFile(temporaryPath, JSON.stringify(snapshot, null, 2), "utf8");
    await rename(temporaryPath, filePath);
  }
});

export const saveMockApiServiceSnapshot = (
  source: ApiServiceSnapshotSource,
  store: ApiServiceSnapshotStore
): Promise<void> => store.save(source.snapshot());

export const createPersistedMockApiService = async (
  store: ApiServiceSnapshotStore,
  options: MockApiServiceOptions = {}
): Promise<PersistedMockApiService> => {
  const persistedSnapshot = await store.load();
  const service = createMockApiService(persistedSnapshot ? { ...options, seed: persistedSnapshot } : options);

  return {
    service,
    save: () => saveMockApiServiceSnapshot(service, store)
  };
};
