# Mongchi Economy — Confirmed Prices And Faucets

> Absorbed from `game-economy-bm-proposal.md` (2026-07-02 proposal, superseded and deleted). This
> document keeps only the confirmed, currently-implemented numbers; the original file's game-design
> rationale (buffs, walk rework, bond reward track, socket placement) is already shipped and is not
> reproduced here — see `docs/release/CHANGELOG.md` for the commit history of that work.

## 1. Confirmed Credit Price Table (2 / 5 / 5 / 12 / 18)

Single, easy-to-remember per-category pricing (2026-07 pricing pass). Source of truth is code, not
this document — see the referenced files if the numbers ever need to move.

| Item / feature | Credits | Source |
| --- | --- | --- |
| Treat or drink consumable | 2 | `packages/shared/src/domain/wallet.ts` (`TREAT_OR_DRINK_CREDIT_COST`) |
| Toy or bed/rest consumable | 5 | `packages/shared/src/domain/wallet.ts` (`TOY_OR_BED_CREDIT_COST`) |
| Premium chat day pass | 5 | `packages/shared/src/domain/wallet.ts` (`chatDayPassCreditCost`) |
| Expression pack | 12 | `packages/shared/src/domain/expressionPacks.ts` |
| Theme bundle | 18 | `packages/shared/src/domain/themeBundles.ts` |

`item_stepping_stone_path` is a retired-from-shop exception kept at 3 credits only because
`services/api`'s purchase tests still exercise it; it is not part of the standard ladder above.

Credit packs (IAP, consumable): `credit_pack_20`, `credit_pack_60`, `credit_pack_150`
(`packages/shared/src/domain/creditPacks.ts`). Starter grant is 12 credits — exactly one
three-pose expression pack (see `docs/engineering/current/credit-store-foundation.md`).

## 2. Faucet Budget — "Daily = Treat, Credits = Milestone"

**Principle:** day-to-day care (feeding, playing, saying hello) pays out in a common treat item,
granted locally with no server round trip. Credits are reserved for milestones that do not repeat
often — settling in, streaks, letters, the walk collection, and bond level — so there is never a
daily credit-farming loop.

Confirmed reward table (server hard-coded whitelist; `claim_credit_reward` RPC is the only source of
truth, `supabase/migrations/0023_credit_reward_claims.sql`):

| Reward key | Credits | Trigger | Notes |
| --- | --- | --- | --- |
| `settle_first_feed` | +1 | First feeding | One-time |
| `settle_first_play` | +1 | First play | One-time |
| `settle_first_chat_hello` | +1 | First visit to chat (free hello) | One-time |
| `settle_first_walk` | +1 | First walk claimed | One-time |
| `settle_first_photo` | +1 | First share-card view | One-time |
| `streak_3` | +2 | 3-day care streak | One-time milestone |
| `streak_7` | +3 | 7-day care streak | One-time milestone |
| `streak_14` | +5 | 14-day care streak | One-time milestone |
| `streak_30` | +8 | 30-day care streak | One-time milestone |
| `letter_month_{N}` | +5 | Month-N letter opened | Once per month, idempotent on N |
| `collection_complete` | +10 | Walk collection completed | Replaces/lowers the old local +20 (offline fallback keeps 20) |
| `bond_5` | +5 | Bond level 5 | Same amount as the old local grant, moved to the server ledger |
| `bond_10` | +10 | Bond level 10 | Same amount as the old local grant, moved to the server ledger |

Condition checks (first feed, streak day count, collection completion, etc.) are all client-local
domain state and cannot be server-verified — the server only enforces the amount and a one-time-per-
key claim via the `(user, reason, ref_type, ref_id=reward_key)` unique index. A manipulated client can
still only claim each real key once, for its fixed amount, so the risk is low.

Claim presentation: every reward above (plus the daily-care treat) passes through the shared
`RewardClaimOverlay` queue (`apps/mobile/src/features/rewards/RewardClaimOverlay.tsx`) rather than a
silent toast — dimmed background, bounce-in card, "Claim" tap (credits call `claim_credit_reward` at
that moment; treats confirm an already-locally-granted item), sparkle/pulse, then the next queued
item. Respects reduce-motion; multiple rewards display sequentially.

Daily play-earn defaults to treat/toy items, not credits — see `docs/product/launch-plan.md` §3.3 for
the day-to-day drop table (attendance streak treats, walk-return weather items). `bonusCredits` is
granted only at the milestones in the table above, kept fully separate from the paid `credits` bucket.
