export type SafeAnalyticsEventName =
  | "first_session_started"
  | "pet_setup_completed"
  | "photo_selected"
  | "photo_deleted"
  | "onboarding_started"
  | "generation_started"
  | "generation_failed"
  | "generation_completed"
  | "generation_issue_reported"
  | "pet_revealed"
  | "care_action_used"
  | "first_care_action"
  | "session_opened"
  | "walk_started"
  | "walk_returned"
  | "walk_reward_claimed"
  | "reward_claimed"
  | "premium_chat_gate_viewed"
  | "purchase_restore_tapped"
  | "day_pass_purchased"
  | "credit_item_purchased"
  | "theme_purchased"
  | "expression_pack_purchased"
  | "chat_turn_sent"
  | "privacy_screen_viewed"
  | "support_screen_viewed";

export type SafeAnalyticsValue = string | number | boolean | null;
export type SafeAnalyticsProperties = Record<string, SafeAnalyticsValue>;

export interface SafeAnalyticsEvent {
  name: SafeAnalyticsEventName;
  properties: SafeAnalyticsProperties;
  createdAt: string;
}

const forbiddenKeyPatterns = [
  /photo/i,
  /image/i,
  /uri/i,
  /url/i,
  /chat.*text/i,
  /message/i,
  /secret/i,
  /token/i,
  /provider.*key/i,
  /payment/i,
  /receipt/i
];

export const assertSafeAnalyticsProperties = (properties: SafeAnalyticsProperties): void => {
  for (const key of Object.keys(properties)) {
    if (forbiddenKeyPatterns.some((pattern) => pattern.test(key))) {
      throw new Error(`Unsafe analytics property key: ${key}`);
    }
  }
};

export const createSafeAnalyticsEvent = (
  name: SafeAnalyticsEventName,
  properties: SafeAnalyticsProperties = {},
  createdAt: string = new Date().toISOString()
): SafeAnalyticsEvent => {
  assertSafeAnalyticsProperties(properties);

  return {
    name,
    properties,
    createdAt
  };
};
