import { createClient } from "npm:@supabase/supabase-js@2";

const CREDIT_AMOUNT_BY_PRODUCT_ID = {
  credit_pack_20: 20,
  credit_pack_60: 60,
  credit_pack_150: 150
} as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RevenueCatEvent = {
  readonly app_id?: string;
  readonly app_user_id?: string;
  readonly environment?: string;
  readonly id?: string;
  readonly original_app_user_id?: string;
  readonly product_id?: string;
  readonly transaction_id?: string;
  readonly type?: string;
};

const jsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseEvent = (value: unknown): RevenueCatEvent | null => {
  if (!isRecord(value) || !isRecord(value.event)) return null;
  const event = value.event;

  return {
    ...(typeof event.app_id === "string" ? { app_id: event.app_id } : {}),
    ...(typeof event.app_user_id === "string" ? { app_user_id: event.app_user_id } : {}),
    ...(typeof event.environment === "string" ? { environment: event.environment } : {}),
    ...(typeof event.id === "string" ? { id: event.id } : {}),
    ...(typeof event.original_app_user_id === "string" ? { original_app_user_id: event.original_app_user_id } : {}),
    ...(typeof event.product_id === "string" ? { product_id: event.product_id } : {}),
    ...(typeof event.transaction_id === "string" ? { transaction_id: event.transaction_id } : {}),
    ...(typeof event.type === "string" ? { type: event.type } : {})
  };
};

const constantTimeEqual = (left: string, right: string): boolean => {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  let mismatch = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);

  for (let index = 0; index < length; index += 1) {
    mismatch |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return mismatch === 0;
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const webhookAuthorization = Deno.env.get("REVENUECAT_WEBHOOK_AUTHORIZATION");
  const expectedAppId = Deno.env.get("REVENUECAT_APP_ID");

  if (!supabaseUrl || !serviceRoleKey || !webhookAuthorization) {
    return jsonResponse({ error: "server_misconfigured" }, 500);
  }

  const receivedAuthorization = req.headers.get("Authorization") ?? "";

  if (!constantTimeEqual(receivedAuthorization, webhookAuthorization)) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  let payload: unknown;

  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const event = parseEvent(payload);

  if (!event || !event.type) return jsonResponse({ error: "invalid_event" }, 422);
  if (expectedAppId && event.app_id !== expectedAppId) return jsonResponse({ error: "app_mismatch" }, 403);

  const creditAmount = event.product_id
    ? CREDIT_AMOUNT_BY_PRODUCT_ID[event.product_id as keyof typeof CREDIT_AMOUNT_BY_PRODUCT_ID]
    : undefined;

  if (!creditAmount) return jsonResponse({ ok: true, ignored: "unmapped_product" }, 200);

  const userId = event.app_user_id ?? event.original_app_user_id ?? "";

  if (!UUID_PATTERN.test(userId) || !event.transaction_id) {
    return jsonResponse({ error: "invalid_purchase_identity" }, 422);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const metadata = {
    provider: "revenuecat",
    product_id: event.product_id,
    environment: event.environment ?? "unknown",
    event_id: event.id ?? "unknown"
  };

  if (event.type === "NON_RENEWING_PURCHASE") {
    const { data, error } = await admin.rpc("grant_credits", {
      p_user: userId,
      p_amount: creditAmount,
      p_reason: "grant_purchase",
      p_ref_type: "iap_transaction",
      p_ref_id: event.transaction_id,
      p_metadata: metadata
    });

    if (error) return jsonResponse({ error: "credit_grant_failed" }, 500);
    return jsonResponse({ ok: true, balance: data }, 200);
  }

  if (event.type === "CANCELLATION") {
    const { data, error } = await admin.rpc("revoke_credit_purchase", {
      p_user: userId,
      p_transaction_id: event.transaction_id,
      p_metadata: metadata
    });

    if (error) return jsonResponse({ error: "credit_revoke_failed" }, 500);
    return jsonResponse({ ok: true, balance: data }, 200);
  }

  return jsonResponse({ ok: true, ignored: "event_type" }, 200);
});
