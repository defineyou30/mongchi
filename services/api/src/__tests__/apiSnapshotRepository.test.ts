import { describe, expect, it } from "vitest";

import { mockConversation, mockConversationMessages, mockPetProfile } from "@mongchi/shared";

import {
  collectMockApiServiceSnapshotUserIds,
  createMockApiServiceSnapshotPersistencePlan,
  persistMockApiServiceSnapshot
} from "../apiSnapshotRepository";
import type { ApiSnapshotRepositoryClient } from "../apiSnapshotRepository";
import { createMockApiService } from "../service";
import type { ApiResult, PurchaseLedgerRecord } from "../service";
import type { Entitlement } from "@mongchi/shared";

const userContext = { userId: "user_demo_001" };
const validHash = `sha256:${"a".repeat(64)}`;

const activePremiumChatEntitlement: Entitlement = {
  id: "ent_premium_chat_snapshot_001",
  userId: "user_demo_001",
  key: "premium_chat",
  status: "active",
  source: "purchase",
  productId: "premium_chat_monthly",
  startsAt: "2026-06-24T08:00:00.000Z",
  ledgerEntryId: "ledger_premium_chat_snapshot_001",
  metadata: {
    serverVerified: true
  },
  createdAt: "2026-06-24T08:00:00.000Z",
  updatedAt: "2026-06-24T08:00:00.000Z"
};

const purchaseLedgerRecord: PurchaseLedgerRecord = {
  ledgerEntryId: activePremiumChatEntitlement.ledgerEntryId,
  userId: "user_demo_001",
  platform: "ios",
  productId: "premium_chat_monthly",
  transactionId: "txn_snapshot_001",
  receiptHash: `sha256:${"b".repeat(64)}`,
  entitlementId: activePremiumChatEntitlement.id,
  status: "verified",
  verifiedAt: "2026-06-24T08:00:00.000Z"
};

const unwrap = <T>(result: ApiResult<T>): T => {
  if (!result.ok) {
    throw new Error(`${result.error.status} ${result.error.code}`);
  }

  return result.data;
};

const createSnapshot = () => {
  const service = createMockApiService({
    seed: {
      entitlements: [activePremiumChatEntitlement],
      purchaseLedger: [purchaseLedgerRecord],
      conversations: [mockConversation],
      conversationMessages: mockConversationMessages
    }
  });

  const upload = unwrap(
    service.issuePhotoUploadUrl(userContext, {
      petId: mockPetProfile.id,
      contentType: "image/jpeg",
      byteSize: 4096
    })
  );

  unwrap(service.completePhotoUpload(userContext, { photoId: upload.photoId, contentHash: validHash }));
  unwrap(service.startWalk(userContext, mockPetProfile.id));

  return service.snapshot();
};

const findStatementIndex = (statements: ReturnType<typeof createMockApiServiceSnapshotPersistencePlan>, fragment: string) => {
  const index = statements.findIndex((statement) => statement.sql.includes(fragment));

  if (index === -1) {
    throw new Error(`Missing SQL fragment: ${fragment}`);
  }

  return index;
};

const createRecordingClient = (options: { failOnSqlFragment?: string } = {}) => {
  const queries: Array<{ sql: string; params?: readonly unknown[] }> = [];
  const client: ApiSnapshotRepositoryClient = {
    query: async (sql, params) => {
      queries.push(params ? { sql, params } : { sql });

      if (options.failOnSqlFragment && sql.includes(options.failOnSqlFragment)) {
        throw new Error("forced query failure");
      }

      return { rows: [] };
    }
  };

  return { client, queries };
};

describe("API snapshot repository", () => {
  it("creates a parameterized Postgres persistence plan in foreign-key-safe order", () => {
    const snapshot = createSnapshot();
    const statements = createMockApiServiceSnapshotPersistencePlan(snapshot, {
      persistedAt: "2026-06-24T09:00:00.000Z"
    });

    expect(collectMockApiServiceSnapshotUserIds(snapshot)).toEqual(["user_demo_001"]);
    expect(snapshot.generationJobs.map((job) => job.id)).toContain(mockPetProfile.activeGenerationJobId);
    expect(statements[0]?.sql).toBe("DELETE FROM public.purchase_ledger");

    const userIndex = findStatementIndex(statements, "INSERT INTO public.api_users");
    const itemIndex = findStatementIndex(statements, "INSERT INTO public.items");
    const petIndex = findStatementIndex(statements, "INSERT INTO public.pets");
    const photoIndex = findStatementIndex(statements, "INSERT INTO public.original_photos");
    const generationJobIndex = findStatementIndex(statements, "INSERT INTO public.generation_jobs");
    const generatedAssetIndex = findStatementIndex(statements, "INSERT INTO public.generated_assets");
    const activePetReferenceIndex = findStatementIndex(statements, "UPDATE public.pets");
    const walkIndex = findStatementIndex(statements, "INSERT INTO public.walk_sessions");
    const careIndex = findStatementIndex(statements, "INSERT INTO public.care_states");
    const inventoryIndex = findStatementIndex(statements, "INSERT INTO public.inventories");
    const inventoryItemIndex = findStatementIndex(statements, "INSERT INTO public.inventory_items");
    const placedItemIndex = findStatementIndex(statements, "INSERT INTO public.placed_items");
    const conversationIndex = findStatementIndex(statements, "INSERT INTO public.conversations");
    const messageIndex = findStatementIndex(statements, "INSERT INTO public.conversation_messages");
    const entitlementIndex = findStatementIndex(statements, "INSERT INTO public.entitlements");
    const purchaseLedgerIndex = findStatementIndex(statements, "INSERT INTO public.purchase_ledger");

    expect(userIndex).toBeLessThan(petIndex);
    expect(itemIndex).toBeLessThan(inventoryIndex);
    expect(petIndex).toBeLessThan(photoIndex);
    expect(petIndex).toBeLessThan(generationJobIndex);
    expect(generationJobIndex).toBeLessThan(generatedAssetIndex);
    expect(generatedAssetIndex).toBeLessThan(activePetReferenceIndex);
    expect(walkIndex).toBeLessThan(careIndex);
    expect(inventoryIndex).toBeLessThan(inventoryItemIndex);
    expect(inventoryIndex).toBeLessThan(placedItemIndex);
    expect(conversationIndex).toBeLessThan(messageIndex);
    expect(entitlementIndex).toBeLessThan(purchaseLedgerIndex);
    expect(statements.some((statement) => statement.sql.includes("user_demo_001"))).toBe(false);
  });

  it("persists snapshot statements in a transaction", async () => {
    const snapshot = createSnapshot();
    const { client, queries } = createRecordingClient();

    await persistMockApiServiceSnapshot(client, snapshot, {
      persistedAt: "2026-06-24T09:00:00.000Z"
    });

    expect(queries[0]?.sql).toBe("BEGIN");
    expect(queries.at(-1)?.sql).toBe("COMMIT");
    expect(queries.some((query) => query.sql === "ROLLBACK")).toBe(false);
    expect(queries.some((query) => query.sql.includes("INSERT INTO public.generated_assets"))).toBe(true);
    expect(queries.some((query) => query.sql.includes("UPDATE public.pets"))).toBe(true);
  });

  it("rolls back when a snapshot statement fails", async () => {
    const snapshot = createSnapshot();
    const { client, queries } = createRecordingClient({ failOnSqlFragment: "INSERT INTO public.pets" });

    await expect(
      persistMockApiServiceSnapshot(client, snapshot, {
        persistedAt: "2026-06-24T09:00:00.000Z"
      })
    ).rejects.toThrow("forced query failure");

    expect(queries[0]?.sql).toBe("BEGIN");
    expect(queries.at(-1)?.sql).toBe("ROLLBACK");
    expect(queries.some((query) => query.sql === "COMMIT")).toBe(false);
  });
});
