// Mongchi purchase-chat-pass Edge Function -- pure request/response mapping
// (Chat Live BM decision: subscription-free single credit economy + a
// one-off "chatty day pass").
//
// Factored out of index.ts so the request validation and RPC-outcome ->
// HTTP mapping can be unit tested with `deno test` and no network/Supabase
// client involved -- mirrors chat-turn's split between index.ts
// (orchestration, untested directly) and locale.ts/moderation.ts/summary.ts
// (pure logic, each with its own _test.ts).
//
// RPC contract (supabase/migrations/0018_chat_day_pass.sql's
// purchase_chat_day_pass): returns exactly one row of
//   { outcome: 'purchased' | 'already_active' | 'insufficient_credits',
//     day_pass_expires_at: TIMESTAMPTZ | null,
//     balance: INTEGER }
// 'already_active' means the caller already holds an active day pass --
// a server-side backstop even though the mobile client is expected to hide
// the purchase entry point once a pass is active (see that RPC's own doc
// comment).

export interface PurchaseChatPassRequestBody {
  requestId: string;
}

export type PurchaseChatDayPassOutcome = "purchased" | "already_active" | "insufficient_credits";

export interface ParsedPurchaseChatDayPassResult {
  outcome: PurchaseChatDayPassOutcome;
  dayPassExpiresAt: string | null;
  balance: number;
}

export interface PurchaseChatPassMappedResponse {
  status: number;
  body: Record<string, unknown>;
}

export interface PurchaseChatPassFailureMessages {
  insufficientCredits: string;
  alreadyActive: string;
}

const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object";

// Request body is `{ request_id }` (snake_case), matching
// generate-avatar/index.ts's request body convention -- unlike chat-turn's
// camelCase ChatTurnRequest, this endpoint has no shared mobileContracts
// request shape of its own to mirror yet.
export const validatePurchaseChatPassRequestBody = (value: unknown): PurchaseChatPassRequestBody | null => {
  if (!isRecord(value)) {
    return null;
  }

  const requestId = value.request_id;

  if (!isNonEmptyString(requestId) || requestId.length > 128) {
    return null;
  }

  return { requestId: requestId.trim() };
};

export const parsePurchaseChatDayPassOutcome = (value: unknown): ParsedPurchaseChatDayPassResult | null => {
  if (!Array.isArray(value) || value.length !== 1 || !isRecord(value[0])) {
    return null;
  }

  const row = value[0];
  const outcome = row.outcome;

  if (outcome !== "purchased" && outcome !== "already_active" && outcome !== "insufficient_credits") {
    return null;
  }

  if (!isFiniteNumber(row.balance)) {
    return null;
  }

  const dayPassExpiresAt = typeof row.day_pass_expires_at === "string" ? row.day_pass_expires_at : null;

  return { outcome, dayPassExpiresAt, balance: row.balance };
};

export const mapPurchaseChatDayPassOutcome = (
  result: ParsedPurchaseChatDayPassResult,
  failureMessages: PurchaseChatPassFailureMessages
): PurchaseChatPassMappedResponse => {
  switch (result.outcome) {
    case "purchased":
      return {
        status: 200,
        body: { dayPassExpiresAt: result.dayPassExpiresAt, serverBalance: result.balance }
      };
    case "already_active":
      return {
        status: 409,
        body: {
          error: "already_active",
          message: failureMessages.alreadyActive,
          dayPassExpiresAt: result.dayPassExpiresAt,
          serverBalance: result.balance
        }
      };
    case "insufficient_credits":
      return {
        status: 402,
        body: { error: "insufficient_credits", message: failureMessages.insufficientCredits, serverBalance: result.balance }
      };
  }
};
