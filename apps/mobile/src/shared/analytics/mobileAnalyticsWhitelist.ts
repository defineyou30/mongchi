import type { SafeAnalyticsEventName, SafeAnalyticsProperties } from "@mongchi/shared";

/**
 * Enum-only guardrail for the mobile analytics adapter (mobileAnalytics.ts).
 * safeAnalytics.ts's assertSafeAnalyticsProperties only blocks known-unsafe
 * *key names* (photo/message/token/etc.) -- it never restricts a property's
 * *value*, so a careless call site could still pass through raw free text
 * (a chat draft, a file:// uri, a support message) under an innocuous-looking
 * key. This module is the second gate: every property this app actually
 * instruments must be pre-declared here as either "number" or a closed set of
 * known string literals, mirroring the real domain union it comes from (see
 * each Set's comment) -- never widened to `string`. Anything not declared for
 * an event, or a string outside its declared set, is rejected.
 *
 * Deliberately has zero PostHog/Sentry/react-native imports so it stays a
 * plain function vitest can import and test directly -- posthog-react-native
 * (and react-native itself) fail to parse under vitest's transform (Flow
 * syntax / non-standard tokens), so anything reachable from a test file must
 * stay free of those imports. See analytics.ts's header comment for the full
 * story.
 */

// ChatTurnResponse["chargeKind"] -- packages/shared/src/api/mobileContracts.ts.
const chargeKindValues = new Set(["plus", "day_pass", "starter_free", "daily_free", "credit", "crisis"]);

// RewardClaimCopyCategory -- packages/shared/src/domain/creditRewards.ts.
const rewardKindValues = new Set(["settlement", "streak", "letter", "collection", "bond", "daily_treat"]);

// ItemCategory -- packages/shared/src/domain/inventory.ts.
const itemCategoryValues = new Set([
  "food",
  "drink",
  "toy",
  "bed",
  "house",
  "plant",
  "light",
  "water",
  "path",
  "reward",
  "premiumDecor",
  "seasonalDecor",
  "lantern",
  "treat",
  "terrain",
  "terrarium_shell",
  "theme"
]);

// GenerationFailureReason -- apps/mobile/src/features/generation/generationFailureReason.ts.
const generationFailureReasonValues = new Set([
  "quota_exceeded",
  "safety_rejected",
  "photo_invalid",
  "quality_check_failed",
  "server_error",
  "unknown"
]);

// GenerationIssueCategory -- packages/shared/src/session/prototypeSession.ts.
const generationIssueCategoryValues = new Set(["wrong_pet", "unsafe_or_scary", "poor_quality"]);

type AnalyticsPropertyRule = "number" | ReadonlySet<string>;

const eventPropertyAllowList: Partial<Record<SafeAnalyticsEventName, Readonly<Record<string, AnalyticsPropertyRule>>>> = {
  session_opened: { days_together: "number" },
  credit_item_purchased: { category: itemCategoryValues },
  chat_turn_sent: { charge_kind: chargeKindValues },
  reward_claimed: { reward_kind: rewardKindValues },
  generation_failed: { reason: generationFailureReasonValues },
  generation_issue_reported: { category: generationIssueCategoryValues }
};

/**
 * Throws on the first violation: an undeclared property key for this event,
 * or a value outside that key's declared closed set/type. Events with no
 * entry in eventPropertyAllowList must be called with an empty properties
 * object (no ad hoc properties invented at the call site).
 */
export const assertWhitelistedAnalyticsProperties = (
  name: SafeAnalyticsEventName,
  properties: SafeAnalyticsProperties
): void => {
  const allowedKeys = eventPropertyAllowList[name] ?? {};

  for (const [key, value] of Object.entries(properties)) {
    const rule = allowedKeys[key];

    if (!rule) {
      throw new Error(`Analytics property "${key}" is not whitelisted for event "${name}"`);
    }

    if (rule === "number") {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`Analytics property "${key}" for event "${name}" must be a finite number`);
      }
      continue;
    }

    if (typeof value !== "string" || !rule.has(value)) {
      throw new Error(`Analytics property "${key}" for event "${name}" is not a whitelisted value: ${String(value)}`);
    }
  }
};
