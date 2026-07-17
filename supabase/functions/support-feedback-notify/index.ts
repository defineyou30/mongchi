// Mongchi support-feedback-notify Edge Function.
//
// Closes the "support/feedback submissions are silent" gap: before this
// function existed, 0024_support_feedback.sql's submit_support_feedback RPC
// wrote rows into support_feedback and nothing else -- no operator was ever
// notified that a new report/feedback/support submission had arrived. This
// function is the notification sink: 0028_support_feedback_notify.sql adds
// an AFTER INSERT trigger on support_feedback that POSTs the new row's
// non-identifying columns here (via pg_net, fire-and-forget), and this
// function forwards a short summary to a Slack Incoming Webhook.
//
// Deliberately a dedicated Edge Function rather than Supabase's built-in
// Database Webhooks dashboard feature, so the HTTP call, payload shape, and
// secret verification are reviewable source rather than dashboard-only
// config -- see 0028_support_feedback_notify.sql's header comment for the
// trigger side of this design.
//
// Auth: POST only, and the caller must present the exact SUPPORT_NOTIFY_SECRET
// value (Edge Function secret) in the X-Support-Notify-Secret header. This is
// an internal, trigger-to-function call, not a public webhook receiver --
// unlike revenuecat-credit-webhook's third-party Authorization header, this
// header name is one this project controls end to end. Comparison mirrors
// revenuecat-credit-webhook/index.ts's constantTimeEqual exactly (same
// XOR-accumulate idiom, so a mismatched length or byte never short-circuits
// early and leaks timing information).
//
// Env-gated no-op: if SLACK_SUPPORT_WEBHOOK_URL is not set, this function
// still verifies the secret (so unauthorized callers never get a free signal
// either way) but returns 200 without attempting any Slack call. That makes
// deploying this function harmless before the Slack webhook URL exists --
// the trigger can be wired up first, Slack notifications simply stay
// dormant until the env var is added.
//
// Privacy: only category/subcategory/message/locale/platform are ever read
// from the request body and forwarded to Slack. support_feedback.user_id and
// support_feedback.contact are NEVER read here -- 0028's trigger does not
// even include them in the outgoing payload, and this function does not
// look for a contact/user_id field even if a caller sent one. message is
// truncated to 500 characters before it reaches Slack.

const SUPPORT_NOTIFY_SECRET_HEADER = "X-Support-Notify-Secret";
const SLACK_REQUEST_TIMEOUT_MS = 8_000;
const MAX_SLACK_MESSAGE_LENGTH = 500;

const CATEGORY_EMOJI: Record<string, string> = {
  generation_issue: "🐛",
  feedback: "💬",
  support: "🆘"
};

type SupportFeedbackNotifyPayload = {
  readonly category: string | null;
  readonly subcategory: string | null;
  readonly message: string | null;
  readonly locale: string | null;
  readonly platform: string | null;
};

const jsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// Mirrors revenuecat-credit-webhook/index.ts's constantTimeEqual exactly --
// same XOR-accumulate idiom over both byte lengths, so a mismatch never
// short-circuits early.
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

// Only these five fields are ever read from the request body -- deliberately
// does not look for `contact` or `user_id` even if the caller included them,
// so there is no code path in this function that could ever forward either
// to Slack. See this file's module doc comment.
const parsePayload = (value: unknown): SupportFeedbackNotifyPayload | null => {
  if (!isRecord(value)) return null;

  return {
    category: typeof value.category === "string" ? value.category : null,
    subcategory: typeof value.subcategory === "string" ? value.subcategory : null,
    message: typeof value.message === "string" ? value.message : null,
    locale: typeof value.locale === "string" ? value.locale : null,
    platform: typeof value.platform === "string" ? value.platform : null
  };
};

const truncateMessage = (message: string | null): string | null => {
  if (message === null) return null;
  return message.length > MAX_SLACK_MESSAGE_LENGTH ? `${message.slice(0, MAX_SLACK_MESSAGE_LENGTH)}…` : message;
};

const buildSlackText = (payload: SupportFeedbackNotifyPayload): string => {
  const category = payload.category ?? "support";
  const emoji = CATEGORY_EMOJI[category] ?? "📝";
  const subcategorySuffix = payload.subcategory ? ` (${payload.subcategory})` : "";
  const truncatedMessage = truncateMessage(payload.message);
  const messageLine = truncatedMessage ? `\n${truncatedMessage}` : "";
  const localeLabel = payload.locale ?? "unknown";
  const platformLabel = payload.platform ?? "unknown";

  return `${emoji} New ${category}${subcategorySuffix}${messageLine}\nlocale: ${localeLabel} · platform: ${platformLabel}`;
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const notifySecret = Deno.env.get("SUPPORT_NOTIFY_SECRET");

  if (!notifySecret) {
    return jsonResponse({ error: "server_misconfigured" }, 500);
  }

  const receivedSecret = req.headers.get(SUPPORT_NOTIFY_SECRET_HEADER) ?? "";

  if (!constantTimeEqual(receivedSecret, notifySecret)) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  let rawBody: unknown;

  try {
    rawBody = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const payload = parsePayload(rawBody);

  if (!payload || !payload.category) {
    return jsonResponse({ error: "invalid_payload" }, 422);
  }

  const slackWebhookUrl = Deno.env.get("SLACK_SUPPORT_WEBHOOK_URL");

  if (!slackWebhookUrl) {
    // Env-gated no-op -- see this file's module doc comment.
    return jsonResponse({ ok: true, ignored: "slack_not_configured" }, 200);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SLACK_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(slackWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: buildSlackText(payload) }),
      signal: controller.signal
    });

    if (!response.ok) return jsonResponse({ ok: false, error: "slack_request_failed" }, 502);

    return jsonResponse({ ok: true }, 200);
  } catch {
    // Network failure or timeout (AbortError) -- never logs the payload
    // that triggered this call.
    return jsonResponse({ ok: false, error: "slack_request_failed" }, 502);
  } finally {
    clearTimeout(timeout);
  }
});
