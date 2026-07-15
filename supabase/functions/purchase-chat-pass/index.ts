// Mongchi purchase-chat-pass Edge Function (Chat Live BM decision:
// subscription-free single credit economy + a one-off "chatty day pass").
//
// Lets a signed-in user spend a server-constant 5 credits (see
// supabase/migrations/0018_chat_day_pass.sql's purchase_chat_day_pass,
// repriced from 3 by 0020_chat_day_pass_price_increase.sql) for 24 rolling
// hours of day-pass-covered premium chat turns
// (reserve_chat_turn's judgment order: plus -> day_pass -> starter_free ->
// daily_free -> credit, same migration).
//
// Skeleton mirrors delete-account/index.ts and chat-turn/index.ts exactly:
// POST-only, JWT auth via a short-lived authClient identifies the caller,
// then a separate service_role admin client performs the privileged RPC
// call. No CORS handling -- only ever invoked via the Supabase JS client's
// functions.invoke from React Native, never a browser.
//
// CHAT_LIVE_ENABLED gate matches chat-turn/index.ts's fail-closed default:
// a day pass is a premium-chat add-on, so purchases stay unavailable
// whenever live chat itself is disabled. Unlike chat-turn, this function
// never calls OpenAI, so there is no DRY_RUN/CHAT_DRY_RUN concern here.
//
// Request/response validation and RPC-outcome -> HTTP mapping are pure and
// live in purchasePlan.ts (unit tested there, `deno test`, no network) --
// this file only owns the HTTP handler shell and the Supabase client wiring.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  mapPurchaseChatDayPassOutcome,
  parsePurchaseChatDayPassOutcome,
  validatePurchaseChatPassRequestBody
} from "./purchasePlan.ts";

const CHAT_LIVE_ENABLED = Deno.env.get("CHAT_LIVE_ENABLED") === "true";

// Safe failure messages (English, warm, no guilt-tripping -- matches
// chat-turn/index.ts's failureMessages tone).
const failureMessages = {
  chatDisabled: "Chat day passes are resting for now. Your tiny friend can still respond to care and quick talks.",
  insufficientCredits: "You need a few more credits to grab a chat day pass.",
  alreadyActive: "Your chat day pass is already active -- no need to buy another one just yet."
} as const;

const jsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  if (!CHAT_LIVE_ENABLED) {
    return jsonResponse({ error: "chat_disabled", message: failureMessages.chatDisabled }, 503);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "server_misconfigured" }, 500);
  }

  // 1. Identify the caller (including anonymous auth users) from their JWT.
  // Mirrors chat-turn/delete-account/generate-avatar's HTTP handler exactly.
  const authClient = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: userData, error: userError } = await authClient.auth.getUser();

  if (userError || !userData?.user) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const userId = userData.user.id;

  // 2. Parse and validate the request body.
  let rawBody: unknown;

  try {
    rawBody = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const body = validatePurchaseChatPassRequestBody(rawBody);

  if (!body) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // 3. purchase_chat_day_pass (0018_chat_day_pass.sql) owns the idempotent
  // credit debit + 24h-rolling day-pass activation atomically -- see that
  // RPC's doc comment for the already_active/insufficient_credits semantics.
  const { data: rpcData, error: rpcError } = await admin.rpc("purchase_chat_day_pass", {
    p_user: userId,
    p_request_id: body.requestId
  });

  const result = parsePurchaseChatDayPassOutcome(rpcData);

  if (rpcError || !result) {
    return jsonResponse({ error: "purchase_failed" }, 500);
  }

  const mapped = mapPurchaseChatDayPassOutcome(result, failureMessages);

  return jsonResponse(mapped.body, mapped.status);
});
