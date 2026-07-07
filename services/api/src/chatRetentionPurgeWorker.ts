import type { ISODateTime } from "@mongchi/shared";

import { defaultPremiumChatPolicy } from "./premiumChatPolicy";

export interface ChatRetentionPurgeRepository {
  purgeExpiredMessages: (
    deletedBefore: ISODateTime,
    batchSize: number
  ) => Promise<{
    deletedMessageIds: string[];
    deletedBefore: ISODateTime;
  }>;
}

export interface RunNextChatRetentionPurgeOptions {
  repository: ChatRetentionPurgeRepository;
  retentionWindowMs?: number;
  batchSize?: number;
  now?: () => ISODateTime;
}

export interface ChatRetentionPurgeRunResult {
  status: "purged" | "idle";
  deletedBefore: ISODateTime;
  deletedMessageIds: string[];
  deletedCount: number;
}

export const defaultChatRetentionPurgeBatchSize = 500;

const normalizePositiveInteger = (value: number | undefined, fallback: number, max: number): number => {
  if (value === undefined) {
    return fallback;
  }

  return Number.isInteger(value) && value > 0 && value <= max ? value : fallback;
};

export const resolveChatRetentionPurgeBatchSize = (batchSize: number | undefined): number =>
  normalizePositiveInteger(batchSize, defaultChatRetentionPurgeBatchSize, 10_000);

export const resolveChatRetentionWindowMs = (retentionWindowMs: number | undefined): number =>
  normalizePositiveInteger(retentionWindowMs, defaultPremiumChatPolicy.retentionWindowMs, 31_536_000_000);

const defaultNow = (): ISODateTime => new Date().toISOString();

export const computeChatRetentionPurgeCutoff = (
  requestedAt: ISODateTime,
  retentionWindowMs: number
): ISODateTime => {
  const requestedAtMs = new Date(requestedAt).getTime();

  if (!Number.isFinite(requestedAtMs)) {
    throw new Error("Invalid chat retention purge timestamp.");
  }

  return new Date(requestedAtMs - retentionWindowMs).toISOString();
};

export const runNextChatRetentionPurge = async ({
  repository,
  retentionWindowMs,
  batchSize,
  now = defaultNow
}: RunNextChatRetentionPurgeOptions): Promise<ChatRetentionPurgeRunResult> => {
  const resolvedRetentionWindowMs = resolveChatRetentionWindowMs(retentionWindowMs);
  const resolvedBatchSize = resolveChatRetentionPurgeBatchSize(batchSize);
  const deletedBefore = computeChatRetentionPurgeCutoff(now(), resolvedRetentionWindowMs);
  const result = await repository.purgeExpiredMessages(deletedBefore, resolvedBatchSize);
  const deletedMessageIds = result.deletedMessageIds;

  return {
    status: deletedMessageIds.length > 0 ? "purged" : "idle",
    deletedBefore: result.deletedBefore,
    deletedMessageIds,
    deletedCount: deletedMessageIds.length
  };
};
