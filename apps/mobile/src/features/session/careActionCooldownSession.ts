import type { CareActionType } from "@mongchi/shared";

export interface CareActionCooldownStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export const CARE_ACTION_COOLDOWN_STORAGE_KEY = "mongchi/care-action-cooldowns-v1";

const careActions = ["feed", "talk", "walk", "play", "rest", "affection", "water_garden", "clean", "treat"] as const;
const careActionSet = new Set<string>(careActions);

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isCareActionType = (value: string): value is CareActionType => careActionSet.has(value);

export const pruneCareActionCooldowns = (
  cooldowns: Partial<Record<CareActionType, number>>,
  nowMs: number
): Partial<Record<CareActionType, number>> => {
  const next: Partial<Record<CareActionType, number>> = {};

  for (const [action, cooldownUntil] of Object.entries(cooldowns)) {
    if (isCareActionType(action) && Number.isFinite(cooldownUntil) && cooldownUntil > nowMs) {
      next[action] = cooldownUntil;
    }
  }

  return next;
};

export const parseCareActionCooldowns = (value: unknown, nowMs: number): Partial<Record<CareActionType, number>> => {
  if (!isObject(value)) {
    return {};
  }

  const parsed: Partial<Record<CareActionType, number>> = {};

  for (const [action, cooldownUntil] of Object.entries(value)) {
    if (!isCareActionType(action) || typeof cooldownUntil !== "number") {
      continue;
    }

    parsed[action] = cooldownUntil;
  }

  return pruneCareActionCooldowns(parsed, nowMs);
};

export const readCareActionCooldowns = async (
  storage: CareActionCooldownStorage,
  nowMs: number
): Promise<Partial<Record<CareActionType, number>>> => {
  try {
    const stored = await storage.getItem(CARE_ACTION_COOLDOWN_STORAGE_KEY);

    if (!stored) {
      return {};
    }

    const parsed = parseCareActionCooldowns(JSON.parse(stored), nowMs);

    if (Object.keys(parsed).length === 0) {
      await storage.removeItem(CARE_ACTION_COOLDOWN_STORAGE_KEY);
      return {};
    }

    return parsed;
  } catch {
    await storage.removeItem(CARE_ACTION_COOLDOWN_STORAGE_KEY);
    return {};
  }
};

export const writeCareActionCooldowns = async (
  storage: CareActionCooldownStorage,
  cooldowns: Partial<Record<CareActionType, number>>,
  nowMs: number
): Promise<void> => {
  const pruned = pruneCareActionCooldowns(cooldowns, nowMs);

  if (Object.keys(pruned).length === 0) {
    await storage.removeItem(CARE_ACTION_COOLDOWN_STORAGE_KEY);
    return;
  }

  await storage.setItem(CARE_ACTION_COOLDOWN_STORAGE_KEY, JSON.stringify(pruned));
};

export const clearCareActionCooldowns = (storage: CareActionCooldownStorage): Promise<void> =>
  storage.removeItem(CARE_ACTION_COOLDOWN_STORAGE_KEY);
