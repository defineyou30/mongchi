# Supabase Runtime

Last code verification: 2026-07-12

This is the operational map for the direct-Supabase mobile runtime. Repository
state describes what must be deployed; it does not claim remote deployment
without a linked-project verification.

## Runtime Topology

| Boundary | Owner | Current rule |
| --- | --- | --- |
| Identity | Supabase anonymous auth | A session is created only when a server-backed action begins |
| Pet generation | `generate-avatar` Edge Function | Server quota/credit reservation, durable jobs, private storage |
| Premium chat | `chat-turn` Edge Function | Disabled by default; server reserves access before OpenAI |
| AI response reports | `report_chat_message` Postgres RPC | Authenticated owner can report only a `pet_ai` message |
| Account deletion | `delete-account` Edge Function | Private objects and the owned anonymous account are deleted |
| Generated reads | private `pet-media` bucket | Mobile requests one-hour signed URLs |

Provider keys and the Supabase service-role key remain Edge Function secrets.
The mobile bundle contains only the public project URL and anon key.

## Migration Inventory

| Version | Purpose | Remote status known in this audit |
| --- | --- | --- |
| `0001` | Base users, pets, generation jobs/assets/storage policies | Operator-confirmed |
| `0002` | Generation rate limits | Operator-confirmed |
| `0003` | Expression-pack source asset | Operator-confirmed |
| `0004` | Credit wallet and ledger | Operator-confirmed |
| `0005` | Pet namespace/slots | Operator-confirmed |
| `0006` | Conversations and messages | Operator-confirmed |
| `0007` | Credit RPC security | Operator-confirmed |
| `0008` | Conversation RPC security | Operator-confirmed |
| `0009` | Generated-asset unlock timestamp | Operator-confirmed |
| `0010` | Enforce unlocked generated-asset reads | Operator-confirmed |
| `0011` | Harden starter-pose unlocks | Operator-confirmed |
| `0012` | Atomic expression-pack jobs | Operator-confirmed |
| `0013` | Generation-job durability | Operator-confirmed |
| `0014` | Chat access, global rate limit, request reservation/replay/refund | Deploy and verify |
| `0015` | AI-message report table and ownership-checked RPC | Deploy and verify |

Apply migrations in numeric order. For the linked project:

```bash
supabase db push --linked
supabase migration list --linked
```

If the SQL editor was used manually, reconcile migration history before another
`db push`; do not rerun a migration body blindly.

## Chat Cost Boundary

`reserve_chat_turn` holds a per-user advisory lock and performs these actions
before a provider call:

1. Reject or replay a duplicate `(user_id, request_id)`.
2. Apply the user-global rolling rate limit.
3. Select server-owned access: starter free, daily free, Plus, or credit.
4. Debit the selected allowance or credit.
5. Persist the reservation.

`complete_chat_turn` inserts both messages and marks the request completed with
its replayable response in one transaction. `fail_chat_turn` restores the
reservation when provider or output processing fails. The client cannot submit
a charge mode.

Live chat requires all of the following:

- migration `0014` deployed;
- current `chat-turn` deployed;
- `CHAT_LIVE_ENABLED=true` on the Edge Function;
- `EXPO_PUBLIC_TINY_PET_LIVE_CHAT_ENABLED=true` in the mobile build;
- professional crisis-flow review recorded as
  `TINY_PET_CHAT_SAFETY_REVIEWED=true` during production validation.

Until then, leave both live flags false. Authored quick pet speech stays
available without OpenAI.

## Reports

Migration `0015` accepts only the bounded reasons `harmful`, `inappropriate`,
`inaccurate`, and `other`. The RPC derives user and conversation ownership from
the authenticated message row. The mobile dialog sends a message id and reason
only; it does not duplicate raw chat text into a client-controlled report body.

Before enabling live chat, assign an operator and response SLA for rows in
`chat_message_reports`.

## Mobile Network Limits

| Call family | Bound |
| --- | --- |
| Common REST API | 30 seconds with `AbortController` |
| Supabase auth | 20 seconds |
| Supabase chat/history/report query | 30 seconds |
| Avatar/chat Edge Function invocation | 180 seconds |
| Account deletion | 60 seconds |
| Signed URL creation | 20 seconds |

The UI timeout does not cancel an already accepted generation job. Retrying or
polling remains safe because generation and chat request ids are idempotent.

## Deployment And Verification

```bash
supabase functions deploy chat-turn --project-ref cxusiexdwgpfcpirefro
node supabase/tests/chat-guardrails.static.mjs
node supabase/tests/chat-reporting.static.mjs
deno check supabase/functions/chat-turn/index.ts
npm run validate:production-release-config
```

After deployment, exercise one free turn, one duplicate request id, one global
rate-limit rejection, one insufficient-credit request, one forced provider
failure/refund, and one AI-message report. Confirm that duplicate and rejected
requests do not create a second provider call.

## External Gates

- Professional review of crisis detection and all eight localized referral texts.
- Stable Privacy/Terms URLs and a working support email in the production build.
- OpenAI monthly hard budget and alert thresholds in the provider account.
- Supabase anonymous-sign-in abuse controls and production `free_limit=1`.
- Remote crash/error collection and an operator review path for reports.
