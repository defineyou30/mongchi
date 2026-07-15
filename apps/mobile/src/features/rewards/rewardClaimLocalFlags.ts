import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Local, cross-session "have we already queued this reward key" guard --
 * server-side claim_credit_reward idempotency (0023_credit_reward_claims.sql)
 * is what actually prevents double-granting, so this is only about not
 * bothering the owner (or hammering the RPC) with a repeat claim card for a
 * mission whose trigger point can be revisited many times across a pet's
 * lifetime (settle_first_chat_hello: visiting the chat gate; settle_first_photo:
 * opening the share sheet) -- unlike settle_first_feed/settle_first_play/
 * settle_first_walk, which are naturally one-shot because they're gated by a
 * domain counter that only ever crosses 0 -> 1 once.
 *
 * A single JSON array under one storage key, same shape as
 * TerrariumHomeScreen's persistedEventToastKeysRef -- the set of reward keys
 * is small and fixed (a handful of settlement mission keys), so no pruning
 * is needed the way the toast keys (unbounded, date/id-scoped) require.
 */
const REWARD_CLAIM_QUEUED_KEYS_STORAGE_KEY = "mongchi.rewards.queuedKeys.v1";

const readQueuedKeys = async (): Promise<string[]> => {
  try {
    const raw = await AsyncStorage.getItem(REWARD_CLAIM_QUEUED_KEYS_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === "string") : [];
  } catch {
    // Silent: worst case a mission's claim card is offered again on a future visit.
    return [];
  }
};

/** True if `rewardKey` was already marked queued on this device. */
export const hasQueuedRewardLocally = async (rewardKey: string): Promise<boolean> => {
  const keys = await readQueuedKeys();

  return keys.includes(rewardKey);
};

/** Marks `rewardKey` as queued so a future call to hasQueuedRewardLocally for it returns true. Safe to call more than once for the same key. */
export const markRewardQueuedLocally = async (rewardKey: string): Promise<void> => {
  try {
    const keys = await readQueuedKeys();

    if (keys.includes(rewardKey)) {
      return;
    }

    await AsyncStorage.setItem(REWARD_CLAIM_QUEUED_KEYS_STORAGE_KEY, JSON.stringify([...keys, rewardKey]));
  } catch {
    // Silent: worst case the mission's claim card is offered again on a future visit.
  }
};
