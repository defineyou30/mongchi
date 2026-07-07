import type {
  Entitlement,
  EntitlementId,
  EntitlementKey,
  EntitlementSource,
  EntitlementStatus,
  ISODateTime,
  UserId
} from "@mongchi/shared";

import type { ApiDatabaseMigrationClient } from "./dbMigrations";
import type { PurchaseLedgerRecord } from "./service";

interface EntitlementRow {
  id: string;
  user_id: string;
  key: EntitlementKey;
  status: EntitlementStatus;
  source: EntitlementSource;
  product_id: string | null;
  starts_at: Date | string;
  ends_at: Date | string | null;
  ledger_entry_id: string;
  metadata: unknown;
  created_at: Date | string;
  updated_at: Date | string;
}

interface PurchaseLedgerRow {
  ledger_entry_id: string;
  user_id: string;
  platform: "ios" | "android";
  product_id: string;
  transaction_id: string;
  receipt_hash: string;
  entitlement_id: string;
  status: "verified" | "restored" | "revoked";
  verified_at: Date | string;
  restored_at: Date | string | null;
  revoked_at: Date | string | null;
  revocation_reason: PurchaseLedgerRecord["revocationReason"] | null;
}

interface ActiveEntitlementRow {
  active: boolean;
}

export interface RevokePurchaseLedgerInput {
  platform: "ios" | "android";
  reason: NonNullable<PurchaseLedgerRecord["revocationReason"]>;
  revokedAt: ISODateTime;
  transactionId: string;
}

export interface RevokePurchaseLedgerByReceiptHashInput {
  platform: "ios" | "android";
  reason: NonNullable<PurchaseLedgerRecord["revocationReason"]>;
  revokedAt: ISODateTime;
  receiptHash: string;
  productId?: string;
}

const toIso = (value: Date | string): ISODateTime => (value instanceof Date ? value.toISOString() : value);
const nullableIso = (value: Date | string | null): ISODateTime | undefined => (value ? toIso(value) : undefined);

const parseMetadata = (value: unknown): Entitlement["metadata"] => {
  if (value === null || value === undefined) {
    return {};
  }

  const parsed = typeof value === "string" ? (JSON.parse(value) as unknown) : value;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }

  const metadata: Entitlement["metadata"] = {};

  for (const [key, metadataValue] of Object.entries(parsed)) {
    if (
      typeof metadataValue === "string" ||
      typeof metadataValue === "number" ||
      typeof metadataValue === "boolean"
    ) {
      metadata[key] = metadataValue;
    }
  }

  return metadata;
};

const mapEntitlementRow = (row: EntitlementRow): Entitlement => {
  const endsAt = nullableIso(row.ends_at);

  return {
    id: row.id,
    userId: row.user_id,
    key: row.key,
    status: row.status,
    source: row.source,
    ...(row.product_id ? { productId: row.product_id } : {}),
    startsAt: toIso(row.starts_at),
    ...(endsAt ? { endsAt } : {}),
    ledgerEntryId: row.ledger_entry_id,
    metadata: parseMetadata(row.metadata),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
};

const mapPurchaseLedgerRow = (row: PurchaseLedgerRow): PurchaseLedgerRecord => {
  const restoredAt = nullableIso(row.restored_at);
  const revokedAt = nullableIso(row.revoked_at);

  return {
    ledgerEntryId: row.ledger_entry_id,
    userId: row.user_id,
    platform: row.platform,
    productId: row.product_id,
    transactionId: row.transaction_id,
    receiptHash: row.receipt_hash,
    entitlementId: row.entitlement_id,
    status: row.status,
    verifiedAt: toIso(row.verified_at),
    ...(restoredAt ? { restoredAt } : {}),
    ...(revokedAt ? { revokedAt } : {}),
    ...(row.revocation_reason ? { revocationReason: row.revocation_reason } : {})
  };
};

const entitlementSelectColumns = `
  id,
  user_id,
  key,
  status,
  source,
  product_id,
  starts_at,
  ends_at,
  ledger_entry_id,
  metadata,
  created_at,
  updated_at
`;

const purchaseLedgerSelectColumns = `
  ledger_entry_id,
  user_id,
  platform,
  product_id,
  transaction_id,
  receipt_hash,
  entitlement_id,
  status,
  verified_at,
  restored_at,
  revoked_at,
  revocation_reason
`;

export const createPostgresCommerceRepository = (client: ApiDatabaseMigrationClient) => ({
  upsertEntitlement: async (entitlement: Entitlement): Promise<Entitlement> => {
    const result = await client.query<EntitlementRow>(
      `
INSERT INTO public.entitlements (
  id,
  user_id,
  key,
  status,
  source,
  product_id,
  starts_at,
  ends_at,
  ledger_entry_id,
  metadata,
  created_at,
  updated_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12)
ON CONFLICT (id) DO UPDATE
SET key = EXCLUDED.key,
    status = EXCLUDED.status,
    source = EXCLUDED.source,
    product_id = EXCLUDED.product_id,
    starts_at = EXCLUDED.starts_at,
    ends_at = EXCLUDED.ends_at,
    ledger_entry_id = EXCLUDED.ledger_entry_id,
    metadata = EXCLUDED.metadata,
    updated_at = EXCLUDED.updated_at
RETURNING ${entitlementSelectColumns}
`,
      [
        entitlement.id,
        entitlement.userId,
        entitlement.key,
        entitlement.status,
        entitlement.source,
        entitlement.productId ?? null,
        entitlement.startsAt,
        entitlement.endsAt ?? null,
        entitlement.ledgerEntryId,
        JSON.stringify(entitlement.metadata),
        entitlement.createdAt,
        entitlement.updatedAt
      ]
    );
    const row = result.rows[0];

    if (!row) {
      throw new Error("Failed to upsert entitlement.");
    }

    return mapEntitlementRow(row);
  },

  findEntitlementById: async (entitlementId: EntitlementId): Promise<Entitlement | null> => {
    const result = await client.query<EntitlementRow>(
      `
SELECT ${entitlementSelectColumns}
FROM public.entitlements
WHERE id = $1
`,
      [entitlementId]
    );

    return result.rows[0] ? mapEntitlementRow(result.rows[0]) : null;
  },

  listEntitlementsForUser: async (userId: UserId): Promise<Entitlement[]> => {
    const result = await client.query<EntitlementRow>(
      `
SELECT ${entitlementSelectColumns}
FROM public.entitlements
WHERE user_id = $1
ORDER BY created_at DESC, id DESC
`,
      [userId]
    );

    return result.rows.map(mapEntitlementRow);
  },

  hasActiveEntitlement: async (
    userId: UserId,
    key: EntitlementKey,
    checkedAt: ISODateTime
  ): Promise<boolean> => {
    const result = await client.query<ActiveEntitlementRow>(
      `
SELECT EXISTS (
  SELECT 1
  FROM public.entitlements
  WHERE user_id = $1
    AND key = $2
    AND status = 'active'
    AND starts_at <= $3
    AND (ends_at IS NULL OR ends_at > $3)
) AS active
`,
      [userId, key, checkedAt]
    );

    return result.rows[0]?.active ?? false;
  },

  upsertPurchaseLedgerRecord: async (record: PurchaseLedgerRecord): Promise<PurchaseLedgerRecord> => {
    const result = await client.query<PurchaseLedgerRow>(
      `
INSERT INTO public.purchase_ledger (
  ledger_entry_id,
  user_id,
  platform,
  product_id,
  transaction_id,
  receipt_hash,
  entitlement_id,
  status,
  verified_at,
  restored_at,
  revoked_at,
  revocation_reason
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
ON CONFLICT (ledger_entry_id) DO UPDATE
SET status = EXCLUDED.status,
    receipt_hash = EXCLUDED.receipt_hash,
    restored_at = EXCLUDED.restored_at,
    revoked_at = EXCLUDED.revoked_at,
    revocation_reason = EXCLUDED.revocation_reason
RETURNING ${purchaseLedgerSelectColumns}
`,
      [
        record.ledgerEntryId,
        record.userId,
        record.platform,
        record.productId,
        record.transactionId,
        record.receiptHash,
        record.entitlementId,
        record.status,
        record.verifiedAt,
        record.restoredAt ?? null,
        record.revokedAt ?? null,
        record.revocationReason ?? null
      ]
    );
    const row = result.rows[0];

    if (!row) {
      throw new Error("Failed to upsert purchase ledger record.");
    }

    return mapPurchaseLedgerRow(row);
  },

  findLedgerByTransactionId: async (transactionId: string): Promise<PurchaseLedgerRecord | null> => {
    const result = await client.query<PurchaseLedgerRow>(
      `
SELECT ${purchaseLedgerSelectColumns}
FROM public.purchase_ledger
WHERE transaction_id = $1
`,
      [transactionId]
    );

    return result.rows[0] ? mapPurchaseLedgerRow(result.rows[0]) : null;
  },

  findLedgerByUserPlatformTransaction: async (
    userId: UserId,
    platform: "ios" | "android",
    transactionId: string
  ): Promise<PurchaseLedgerRecord | null> => {
    const result = await client.query<PurchaseLedgerRow>(
      `
SELECT ${purchaseLedgerSelectColumns}
FROM public.purchase_ledger
WHERE user_id = $1 AND platform = $2 AND transaction_id = $3
`,
      [userId, platform, transactionId]
    );

    return result.rows[0] ? mapPurchaseLedgerRow(result.rows[0]) : null;
  },

  listLedgerRecordsForRestore: async (
    userId: UserId,
    platform: "ios" | "android",
    transactionIds: readonly string[]
  ): Promise<PurchaseLedgerRecord[]> => {
    if (transactionIds.length === 0) {
      return [];
    }

    const result = await client.query<PurchaseLedgerRow>(
      `
SELECT ${purchaseLedgerSelectColumns}
FROM public.purchase_ledger
WHERE user_id = $1
  AND platform = $2
  AND transaction_id = ANY($3::text[])
  AND status <> 'revoked'
ORDER BY verified_at ASC, transaction_id ASC
`,
      [userId, platform, [...new Set(transactionIds)]]
    );

    return result.rows.map(mapPurchaseLedgerRow);
  },

  markLedgerRestored: async (
    transactionId: string,
    restoredAt: ISODateTime
  ): Promise<PurchaseLedgerRecord | null> => {
    const result = await client.query<PurchaseLedgerRow>(
      `
UPDATE public.purchase_ledger
SET status = 'restored',
    restored_at = $2
WHERE transaction_id = $1
  AND status <> 'revoked'
RETURNING ${purchaseLedgerSelectColumns}
`,
      [transactionId, restoredAt]
    );

    return result.rows[0] ? mapPurchaseLedgerRow(result.rows[0]) : null;
  },

  markLedgerRevoked: async (input: RevokePurchaseLedgerInput): Promise<PurchaseLedgerRecord | null> => {
    const result = await client.query<PurchaseLedgerRow>(
      `
UPDATE public.purchase_ledger
SET status = 'revoked',
    revoked_at = $3,
    revocation_reason = $4
WHERE transaction_id = $1 AND platform = $2
RETURNING ${purchaseLedgerSelectColumns}
`,
      [input.transactionId, input.platform, input.revokedAt, input.reason]
    );

    return result.rows[0] ? mapPurchaseLedgerRow(result.rows[0]) : null;
  },

  markLedgerRevokedByReceiptHash: async (input: RevokePurchaseLedgerByReceiptHashInput): Promise<PurchaseLedgerRecord | null> => {
    const result = await client.query<PurchaseLedgerRow>(
      `
UPDATE public.purchase_ledger
SET status = 'revoked',
    revoked_at = $4,
    revocation_reason = $5
WHERE ledger_entry_id = (
  SELECT ledger_entry_id
  FROM public.purchase_ledger
  WHERE receipt_hash = $1
    AND platform = $2
    AND ($3::text IS NULL OR product_id = $3)
  ORDER BY verified_at DESC, ledger_entry_id DESC
  LIMIT 1
)
RETURNING ${purchaseLedgerSelectColumns}
`,
      [input.receiptHash, input.platform, input.productId ?? null, input.revokedAt, input.reason]
    );

    return result.rows[0] ? mapPurchaseLedgerRow(result.rows[0]) : null;
  },

  markEntitlementRestored: async (
    entitlementId: EntitlementId,
    restoredAt: ISODateTime,
    metadata: Entitlement["metadata"] = { restored: true }
  ): Promise<Entitlement | null> => {
    const result = await client.query<EntitlementRow>(
      `
UPDATE public.entitlements
SET source = 'restore',
    status = 'active',
    metadata = metadata || $3::jsonb,
    updated_at = $2
WHERE id = $1 AND status <> 'revoked'
RETURNING ${entitlementSelectColumns}
`,
      [entitlementId, restoredAt, JSON.stringify(metadata)]
    );

    return result.rows[0] ? mapEntitlementRow(result.rows[0]) : null;
  },

  markEntitlementRevoked: async (
    entitlementId: EntitlementId,
    revokedAt: ISODateTime,
    reason: NonNullable<PurchaseLedgerRecord["revocationReason"]>
  ): Promise<Entitlement | null> => {
    const result = await client.query<EntitlementRow>(
      `
UPDATE public.entitlements
SET status = 'revoked',
    metadata = metadata || $3::jsonb,
    updated_at = $2
WHERE id = $1
RETURNING ${entitlementSelectColumns}
`,
      [
        entitlementId,
        revokedAt,
        JSON.stringify({
          revoked: true,
          revocationReason: reason
        })
      ]
    );

    return result.rows[0] ? mapEntitlementRow(result.rows[0]) : null;
  }
});
