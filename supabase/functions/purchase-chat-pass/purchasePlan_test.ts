import { assertEquals } from "jsr:@std/assert@1";

import {
  mapPurchaseChatDayPassOutcome,
  parsePurchaseChatDayPassOutcome,
  validatePurchaseChatPassRequestBody
} from "./purchasePlan.ts";

const failureMessages = {
  insufficientCredits: "need more credits",
  alreadyActive: "already active"
};

Deno.test("validatePurchaseChatPassRequestBody accepts and trims a valid request id", () => {
  assertEquals(validatePurchaseChatPassRequestBody({ request_id: "  abc-123  " }), { requestId: "abc-123" });
});

Deno.test("validatePurchaseChatPassRequestBody rejects missing/blank/oversized/non-string request ids", () => {
  assertEquals(validatePurchaseChatPassRequestBody({}), null);
  assertEquals(validatePurchaseChatPassRequestBody({ request_id: "" }), null);
  assertEquals(validatePurchaseChatPassRequestBody({ request_id: "   " }), null);
  assertEquals(validatePurchaseChatPassRequestBody({ request_id: 42 }), null);
  assertEquals(validatePurchaseChatPassRequestBody({ request_id: "x".repeat(129) }), null);
  assertEquals(validatePurchaseChatPassRequestBody(null), null);
  assertEquals(validatePurchaseChatPassRequestBody("not an object"), null);
  assertEquals(validatePurchaseChatPassRequestBody([]), null);
});

Deno.test("validatePurchaseChatPassRequestBody accepts a request id at exactly the length ceiling", () => {
  const requestId = "x".repeat(128);
  assertEquals(validatePurchaseChatPassRequestBody({ request_id: requestId }), { requestId });
});

Deno.test("parsePurchaseChatDayPassOutcome parses a valid purchased row", () => {
  assertEquals(
    parsePurchaseChatDayPassOutcome([{ outcome: "purchased", day_pass_expires_at: "2026-07-14T00:00:00Z", balance: 7 }]),
    { outcome: "purchased", dayPassExpiresAt: "2026-07-14T00:00:00Z", balance: 7 }
  );
});

Deno.test("parsePurchaseChatDayPassOutcome parses already_active and insufficient_credits rows", () => {
  assertEquals(
    parsePurchaseChatDayPassOutcome([{ outcome: "already_active", day_pass_expires_at: "2026-07-13T12:00:00Z", balance: 10 }]),
    { outcome: "already_active", dayPassExpiresAt: "2026-07-13T12:00:00Z", balance: 10 }
  );
  assertEquals(
    parsePurchaseChatDayPassOutcome([{ outcome: "insufficient_credits", day_pass_expires_at: null, balance: 1 }]),
    { outcome: "insufficient_credits", dayPassExpiresAt: null, balance: 1 }
  );
});

Deno.test("parsePurchaseChatDayPassOutcome rejects malformed shapes", () => {
  assertEquals(parsePurchaseChatDayPassOutcome(null), null);
  assertEquals(parsePurchaseChatDayPassOutcome([]), null);
  assertEquals(parsePurchaseChatDayPassOutcome([{ outcome: "unknown_outcome", balance: 1 }]), null);
  assertEquals(parsePurchaseChatDayPassOutcome([{ outcome: "purchased", balance: "seven" }]), null);
  assertEquals(
    parsePurchaseChatDayPassOutcome([
      { outcome: "purchased", balance: 1 },
      { outcome: "purchased", balance: 1 }
    ]),
    null
  );
  assertEquals(parsePurchaseChatDayPassOutcome({ outcome: "purchased", balance: 1 }), null);
});

Deno.test("mapPurchaseChatDayPassOutcome maps purchased to 200 with expiry and balance, no error field", () => {
  const mapped = mapPurchaseChatDayPassOutcome(
    { outcome: "purchased", dayPassExpiresAt: "2026-07-14T00:00:00Z", balance: 4 },
    failureMessages
  );
  assertEquals(mapped, { status: 200, body: { dayPassExpiresAt: "2026-07-14T00:00:00Z", serverBalance: 4 } });
});

Deno.test("mapPurchaseChatDayPassOutcome maps already_active to 409 with the active expiry", () => {
  const mapped = mapPurchaseChatDayPassOutcome(
    { outcome: "already_active", dayPassExpiresAt: "2026-07-13T18:00:00Z", balance: 10 },
    failureMessages
  );
  assertEquals(mapped, {
    status: 409,
    body: {
      error: "already_active",
      message: failureMessages.alreadyActive,
      dayPassExpiresAt: "2026-07-13T18:00:00Z",
      serverBalance: 10
    }
  });
});

Deno.test("mapPurchaseChatDayPassOutcome maps insufficient_credits to 402", () => {
  const mapped = mapPurchaseChatDayPassOutcome(
    { outcome: "insufficient_credits", dayPassExpiresAt: null, balance: 1 },
    failureMessages
  );
  assertEquals(mapped, {
    status: 402,
    body: { error: "insufficient_credits", message: failureMessages.insufficientCredits, serverBalance: 1 }
  });
});
