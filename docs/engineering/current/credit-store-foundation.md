# Credit Store Foundation - 2026-07-13

## Phase 1 Implementation History (absorbed from credit-phase1-design.md)

Implementation status as of 2026-07-08, when the original Phase 1 design
document (`credit-phase1-design.md`) was retired: P1a+1b landed and deployed
in commit `1114ff9` (server ledger `credit_wallets`/`credit_ledger` plus four
RPCs, and server-side pre-debit gating for expression packs). P1c landed in
commit `f881743` (client server-balance hydration; expression packs switched
from local deduction to server pre-debit; `bonusCredits` stayed the local
source of truth). The credit-safety commit `c5d405c` added a start-flow throw
shield and `request_id`-idempotent retries so double-charging is not
possible. **P1d (IAP) pivoted to RevenueCat** — direct receipt verification is
unnecessary because RevenueCat verifies purchases, handles refund webhooks,
and covers both platforms; store product creation and RevenueCat dashboard
mapping are an operator action, and the setup-independent code groundwork
(credit pack catalog, shop UI, grant webhook Edge Function) was built as a
follow-up. The original design record is retired; the section below
("Current Source Of Truth") is the current status.

## Current Source Of Truth

- Visible gem balances in server-backed builds come from Supabase `credit_wallets` only.
- The first completed photo-generation job grants 12 gems once through both the completion transaction's DB trigger and the Edge Function retry path, using `(grant_starter, user, starter_v1)` as the shared idempotency key. This exactly funds one three-pose expression pack.
- Migration `0016_credit_store_foundation.sql` records the historical 25-gem test grant and is kept immutable for environments where it already ran.
- Migration `0017_adjust_starter_credit_grant.sql` changes future grants to 12 without clawing back balances already granted at the earlier test value. On a fresh migration chain, `0017` is active before any user generation completes.
- Credit packs are `credit_pack_20`, `credit_pack_60`, and `credit_pack_150`.
- The mobile credit store is reachable from the Garden Shop balance HUD. Checkout remains disabled until RevenueCat products and the SDK identity mapping are configured.

## Photo Remake Boundary

- The reveal screen keeps issue reporting but does not offer an unbounded generic retry. The previous retry reused the initial-generation path without a server-owned remake entitlement.
- The legacy `regeneration_credit_1` catalog entry remains hidden from the mobile shop until it funds a real remake transaction.
- The launch remake product should accept a newly selected photo, cost 12 gems, create a distinct `photo_remake` job, preserve the current accepted pet until replacement succeeds, and refund the debit automatically when generation fails.
- A remake must use one server-side atomic operation for debit plus job creation. A mobile-only balance check is not sufficient.

## RevenueCat Webhook

Deploy `revenuecat-credit-webhook` without Supabase JWT verification. RevenueCat authenticates with the exact configured `Authorization` header instead.

```bash
supabase db push --linked
supabase secrets set REVENUECAT_WEBHOOK_AUTHORIZATION='Bearer <long-random-secret>'
supabase secrets set REVENUECAT_APP_ID='<revenuecat-app-id>'
supabase functions deploy revenuecat-credit-webhook --no-verify-jwt
supabase functions deploy generate-avatar
```

RevenueCat dashboard configuration:

1. Register `https://cxusiexdwgpfcpirefro.supabase.co/functions/v1/revenuecat-credit-webhook`.
2. Set the same `Authorization` value as `REVENUECAT_WEBHOOK_AUTHORIZATION`.
3. Map the three non-renewing products exactly to the product IDs above.
4. Configure the RevenueCat SDK with the authenticated Supabase user UUID as `app_user_id` before enabling checkout.

The webhook grants only `NON_RENEWING_PURCHASE` events for mapped products. Retries are idempotent on the store transaction ID. `CANCELLATION` removes up to the remaining granted balance through `revoke_credit_purchase`; balances never become negative.

## Review And QA Evidence

- Goal review: dog/cat selection, hatching aura, onboarding contrast, shop iconography, numeric gem prices, buy copy, starter grant, and the credit-store route are all represented in the current mobile implementation.
- Code review: the 20/60/150 pack amounts are shared by the mobile catalog and mock API, and the webhook contract is pinned by `supabase/tests/credit-store-foundation.static.mjs`.
- Security review: starter and purchase grants are server-side, starter grant durability is tied to the generation completion transition, transaction IDs are idempotency keys, webhook Authorization is compared in constant time, and grant/revoke RPCs are service-role only.
- Localization review: the new credit-store and shop copy is present in all eight supported locale resources.
- iPhone 16 Pro visual evidence:
  - `docs/qa-screenshots/ios-iphone-16-pro-pet-species-selector.png`
  - `docs/qa-screenshots/ios-iphone-16-pro-pet-setup-cat-selected.png`
  - `docs/qa-screenshots/ios-iphone-16-pro-generation-no-question.png`
  - `docs/qa-screenshots/ios-iphone-16-pro-pet-reveal-readable-copy.png`
  - `docs/qa-screenshots/ios-iphone-16-pro-shop-copy-icons.png`
  - `docs/qa-screenshots/ios-iphone-16-pro-shop-pose-packs.png`
  - `docs/qa-screenshots/ios-iphone-16-pro-credit-store.png`

Debugging hypotheses resolved with runtime evidence:

1. The 25/0 mismatch came from the general shop reading local bonus credits while pose generation read the server wallet. Server-backed presentation now uses only `credit_wallets`, and the starter grant/backfill populates that same wallet.
2. The first species-selection UI test failure came from its stale normalized screen coordinate, not the selector state. Tapping the named accessibility elements passed the iPhone 16 Pro XCTest in both cat and dog directions.
3. The missing question badge and improved onboarding contrast were not stale-source assumptions: fresh simulator screenshots from the IPv4 Metro bundle show the new rendered surfaces without the badge and with parchment-backed text.
