import { describe, expect, it } from "vitest";

import type { Entitlement } from "@mongchi/shared";

import type { ApiDatabaseMigrationClient, ApiDatabaseQueryResult } from "../dbMigrations";
import { createPostgresCommerceRepository } from "../postgresCommerceRepository";
import type { PurchaseLedgerRecord } from "../service";

class QueueDatabaseClient implements ApiDatabaseMigrationClient {
  readonly queries: Array<{ sql: string; params?: readonly unknown[] }> = [];
  private readonly queuedRows: unknown[][];

  constructor(queuedRows: unknown[][]) {
    this.queuedRows = [...queuedRows];
  }

  async query<Row = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<ApiDatabaseQueryResult<Row>> {
    this.queries.push(params ? { sql, params } : { sql });

    return {
      rows: (this.queuedRows.shift() ?? []) as Row[]
    };
  }
}

const entitlement: Entitlement = {
  id: "ent_premium_chat_txn_001",
  userId: "user_demo_001",
  key: "premium_chat",
  status: "active",
  source: "purchase",
  productId: "premium_chat_monthly",
  startsAt: "2026-06-24T09:00:00.000Z",
  endsAt: "2026-07-24T09:00:00.000Z",
  ledgerEntryId: "ledger_txn_001",
  metadata: {
    serverVerified: true,
    transactionId: "txn_001",
    grantType: "subscription"
  },
  createdAt: "2026-06-24T09:00:00.000Z",
  updatedAt: "2026-06-24T09:00:00.000Z"
};

const entitlementRow = (currentEntitlement: Entitlement) => ({
  id: currentEntitlement.id,
  user_id: currentEntitlement.userId,
  key: currentEntitlement.key,
  status: currentEntitlement.status,
  source: currentEntitlement.source,
  product_id: currentEntitlement.productId ?? null,
  starts_at: currentEntitlement.startsAt,
  ends_at: currentEntitlement.endsAt ?? null,
  ledger_entry_id: currentEntitlement.ledgerEntryId,
  metadata: JSON.stringify(currentEntitlement.metadata),
  created_at: currentEntitlement.createdAt,
  updated_at: currentEntitlement.updatedAt
});

const ledgerRecord: PurchaseLedgerRecord = {
  ledgerEntryId: entitlement.ledgerEntryId,
  userId: entitlement.userId,
  platform: "ios",
  productId: entitlement.productId!,
  transactionId: "txn_001",
  receiptHash: `sha256:${"a".repeat(64)}`,
  entitlementId: entitlement.id,
  status: "verified",
  verifiedAt: entitlement.createdAt
};

const ledgerRow = (record: PurchaseLedgerRecord) => ({
  ledger_entry_id: record.ledgerEntryId,
  user_id: record.userId,
  platform: record.platform,
  product_id: record.productId,
  transaction_id: record.transactionId,
  receipt_hash: record.receiptHash,
  entitlement_id: record.entitlementId,
  status: record.status,
  verified_at: record.verifiedAt,
  restored_at: record.restoredAt ?? null,
  revoked_at: record.revokedAt ?? null,
  revocation_reason: record.revocationReason ?? null
});

describe("Postgres commerce repository", () => {
  it("upserts, reads, lists, and active-checks entitlements", async () => {
    const client = new QueueDatabaseClient([
      [entitlementRow(entitlement)],
      [entitlementRow(entitlement)],
      [entitlementRow(entitlement)],
      [{ active: true }]
    ]);
    const repository = createPostgresCommerceRepository(client);

    await expect(repository.upsertEntitlement(entitlement)).resolves.toEqual(entitlement);
    await expect(repository.findEntitlementById(entitlement.id)).resolves.toEqual(entitlement);
    await expect(repository.listEntitlementsForUser(entitlement.userId)).resolves.toEqual([entitlement]);
    await expect(repository.hasActiveEntitlement(entitlement.userId, entitlement.key, entitlement.startsAt)).resolves.toBe(true);

    expect(client.queries[0]?.sql).toContain("INSERT INTO public.entitlements");
    expect(client.queries[0]?.sql).not.toContain(entitlement.id);
    expect(client.queries[0]?.params).toEqual([
      entitlement.id,
      entitlement.userId,
      entitlement.key,
      entitlement.status,
      entitlement.source,
      entitlement.productId,
      entitlement.startsAt,
      entitlement.endsAt,
      entitlement.ledgerEntryId,
      JSON.stringify(entitlement.metadata),
      entitlement.createdAt,
      entitlement.updatedAt
    ]);
    expect(client.queries[3]?.sql).toContain("SELECT EXISTS");
    expect(client.queries[3]?.sql).toContain("starts_at <= $3");
  });

  it("upserts and reads purchase ledger records by transaction ownership boundaries", async () => {
    const client = new QueueDatabaseClient([[ledgerRow(ledgerRecord)], [ledgerRow(ledgerRecord)], [ledgerRow(ledgerRecord)]]);
    const repository = createPostgresCommerceRepository(client);

    await expect(repository.upsertPurchaseLedgerRecord(ledgerRecord)).resolves.toEqual(ledgerRecord);
    await expect(repository.findLedgerByTransactionId(ledgerRecord.transactionId)).resolves.toEqual(ledgerRecord);
    await expect(
      repository.findLedgerByUserPlatformTransaction(ledgerRecord.userId, ledgerRecord.platform, ledgerRecord.transactionId)
    ).resolves.toEqual(ledgerRecord);

    expect(client.queries[0]?.sql).toContain("INSERT INTO public.purchase_ledger");
    expect(client.queries[0]?.sql).not.toContain(ledgerRecord.receiptHash);
    expect(client.queries[0]?.params).toEqual([
      ledgerRecord.ledgerEntryId,
      ledgerRecord.userId,
      ledgerRecord.platform,
      ledgerRecord.productId,
      ledgerRecord.transactionId,
      ledgerRecord.receiptHash,
      ledgerRecord.entitlementId,
      ledgerRecord.status,
      ledgerRecord.verifiedAt,
      null,
      null,
      null
    ]);
    expect(client.queries[2]?.sql).toContain("user_id = $1 AND platform = $2 AND transaction_id = $3");
  });

  it("lists restorable ledger records with a deduped transaction array", async () => {
    const restoredRecord: PurchaseLedgerRecord = {
      ...ledgerRecord,
      status: "restored",
      restoredAt: "2026-06-24T09:10:00.000Z"
    };
    const client = new QueueDatabaseClient([[ledgerRow(restoredRecord)]]);
    const repository = createPostgresCommerceRepository(client);

    await expect(
      repository.listLedgerRecordsForRestore(ledgerRecord.userId, ledgerRecord.platform, [
        ledgerRecord.transactionId,
        ledgerRecord.transactionId
      ])
    ).resolves.toEqual([restoredRecord]);

    expect(client.queries[0]?.sql).toContain("transaction_id = ANY($3::text[])");
    expect(client.queries[0]?.sql).toContain("status <> 'revoked'");
    expect(client.queries[0]?.params).toEqual([ledgerRecord.userId, ledgerRecord.platform, [ledgerRecord.transactionId]]);
  });

  it("marks ledger and entitlement restore state", async () => {
    const restoredAt = "2026-06-24T09:10:00.000Z";
    const restoredRecord: PurchaseLedgerRecord = {
      ...ledgerRecord,
      status: "restored",
      restoredAt
    };
    const restoredEntitlement: Entitlement = {
      ...entitlement,
      source: "restore",
      status: "active",
      updatedAt: restoredAt,
      metadata: {
        ...entitlement.metadata,
        restored: true
      }
    };
    const client = new QueueDatabaseClient([[ledgerRow(restoredRecord)], [entitlementRow(restoredEntitlement)]]);
    const repository = createPostgresCommerceRepository(client);

    await expect(repository.markLedgerRestored(ledgerRecord.transactionId, restoredAt)).resolves.toEqual(restoredRecord);
    await expect(repository.markEntitlementRestored(entitlement.id, restoredAt)).resolves.toEqual(restoredEntitlement);

    expect(client.queries[0]?.sql).toContain("SET status = 'restored'");
    expect(client.queries[0]?.params).toEqual([ledgerRecord.transactionId, restoredAt]);
    expect(client.queries[1]?.sql).toContain("source = 'restore'");
    expect(client.queries[1]?.params).toEqual([entitlement.id, restoredAt, JSON.stringify({ restored: true })]);
  });

  it("marks ledger and entitlement revocation state", async () => {
    const revokedAt = "2026-06-24T09:20:00.000Z";
    const revokedRecord: PurchaseLedgerRecord = {
      ...ledgerRecord,
      status: "revoked",
      revokedAt,
      revocationReason: "refund"
    };
    const revokedEntitlement: Entitlement = {
      ...entitlement,
      status: "revoked",
      updatedAt: revokedAt,
      metadata: {
        ...entitlement.metadata,
        revoked: true,
        revocationReason: "refund"
      }
    };
    const client = new QueueDatabaseClient([[ledgerRow(revokedRecord)], [entitlementRow(revokedEntitlement)]]);
    const repository = createPostgresCommerceRepository(client);

    await expect(
      repository.markLedgerRevoked({
        transactionId: ledgerRecord.transactionId,
        platform: ledgerRecord.platform,
        reason: "refund",
        revokedAt
      })
    ).resolves.toEqual(revokedRecord);
    await expect(repository.markEntitlementRevoked(entitlement.id, revokedAt, "refund")).resolves.toEqual(revokedEntitlement);

    expect(client.queries[0]?.sql).toContain("SET status = 'revoked'");
    expect(client.queries[0]?.params).toEqual([ledgerRecord.transactionId, ledgerRecord.platform, revokedAt, "refund"]);
    expect(client.queries[1]?.sql).toContain("metadata = metadata || $3::jsonb");
    expect(client.queries[1]?.params).toEqual([
      entitlement.id,
      revokedAt,
      JSON.stringify({
        revoked: true,
        revocationReason: "refund"
      })
    ]);
  });

  it("marks ledger revocation by receipt hash for store notifications without raw token lookup", async () => {
    const revokedAt = "2026-06-24T09:25:00.000Z";
    const revokedRecord: PurchaseLedgerRecord = {
      ...ledgerRecord,
      platform: "android",
      transactionId: "gpa.1234-5678-9012",
      receiptHash: `sha256:${"d".repeat(64)}`,
      status: "revoked",
      revokedAt,
      revocationReason: "store_revoke"
    };
    const client = new QueueDatabaseClient([[ledgerRow(revokedRecord)]]);
    const repository = createPostgresCommerceRepository(client);

    await expect(
      repository.markLedgerRevokedByReceiptHash({
        platform: "android",
        productId: "premium_chat_monthly",
        receiptHash: revokedRecord.receiptHash,
        reason: "store_revoke",
        revokedAt
      })
    ).resolves.toEqual(revokedRecord);

    expect(client.queries[0]?.sql).toContain("receipt_hash = $1");
    expect(client.queries[0]?.sql).toContain("product_id = $3");
    expect(client.queries[0]?.sql).toContain("ORDER BY verified_at DESC");
    expect(client.queries[0]?.params).toEqual([
      revokedRecord.receiptHash,
      "android",
      "premium_chat_monthly",
      revokedAt,
      "store_revoke"
    ]);
  });
});
