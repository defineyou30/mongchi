# Mongchi Docs

Last updated: 2026-07-15

This is the one-page entry point: what Mongchi is, how it's built, and where to find the rest of
the docs. Start here, then follow the links below into the folder you need.

## What Mongchi Is

Mongchi turns one pet photo into a tiny pixel-art companion who "moves in" and lives in a
phone-sized garden. The worldview is unified around **moving-in / garden** language — hatch,
avatar, "Pass," and raw numeric stats are never shown to the user (internal code names are fine;
user-facing copy is not). The user cares for their pet daily (feed, play, wash, walk), builds a
relationship over time (bond level, streaks, a memory album, episodic dialogue that references past
days together, and a 30-day letter), chats with their pet, and can dress up the garden with
background themes. Tone is warm, pet-like, and explicitly never guilt-tripping — the pet can always
be fully happy for free; paid content is about expression and convenience, not required care.
Target platform is native iOS/Android (Expo/React Native), English-first UI with seven additional
locales (ko-KR, ja-JP, zh-TW, de-DE, fr-FR, pt-BR, es-MX).

## Architecture At A Glance

- **Local-first + a small hosted backend for AI generation only.** Care, streaks, walks, inventory,
  and notifications run entirely on-device (AsyncStorage session, schema-versioned with migration
  and corrupt-session recovery). Only photo-to-pet generation, chat, and paid-credit accounting need
  a server.
- **Supabase is the live backend.** Anonymous auth upgrading to a real account, Postgres for
  jobs/quota/credit ledger (row-level security, phone reads its own rows only, all writes go through
  `service_role` or a `SECURITY DEFINER` RPC), private `pet-media` Storage (signed URLs only), and
  Edge Functions for anything that must run server-side: `generate-avatar` (photo to pixel-art pet),
  `chat-turn` (server-charged AI chat), `delete-account` (full account/data deletion).
  `supabase/migrations/` holds the SQL migration history; `supabase/functions/` holds the Edge
  Functions.
- **`services/api` (Node/Postgres) and `workers/ai` are retired from the live path** — they were the
  original server prototype. `workers/ai` is kept only as an internal batch-generation tool for
  producing default per-species fallback art, not as a production service.
  `packages/shared/src` is the shared TypeScript domain (care, inventory, wallet, relationship,
  memories, reaction engine, prototype session) used by the mobile app and, historically, by
  `services/api`.
- Full current runtime/release status: `docs/release/backend-release-audit.md` (start here for "is
  it actually deployed/safe to ship" questions) and `docs/engineering/current/` for the detailed
  Supabase runtime and credit-store status.

## Economy At A Glance

Single credit economy, no separate premium currency. Confirmed price ladder: treat/drink 2 credits,
toy/bed 5 credits, chat day pass 5 credits, expression pack 12 credits, theme bundle 18 credits.
Credit packs are 20/60/150 credits (IAP via RevenueCat); starter grant is 12 credits. Daily play
(feeding, playing, saying hello) pays out in treat items, not credits — credits are reserved for
milestones that don't repeat often (settling in, streaks, letters, walk collection, bond level). See
`docs/product/economy.md` for the full price table and faucet budget, and
`docs/engineering/current/credit-store-foundation.md` for the server-ledger implementation.

## Design System

- `DESIGN.md` (repo root) is the product and visual contract of record — palette, typography scale,
  component specs, motion, and layout rules. Start there for anything visual.
- Fonts: `PixelifySans` (display) + `Baloo 2` (body) for Latin locales; localized pixel-grid fonts
  for Korean/Japanese/Traditional Chinese (`Fusion Pixel 10px Proportional {KO,JA,ZH-HANT}`). See
  `DESIGN.md` §3 for the full scale and stack.
   UI icons come from the `MongChi Utility Icon Pack` (`docs/design/mongchi-utility-icon-pack-v1.md`,
  48 hand-authored pixel icons replacing the earlier Lucide set) plus per-category item/background
  art generated through the prompt contracts in `docs/design/` (see below).
- `docs/design/` holds every current, implementation-mapped design contract: home UI interaction,
  care-economy/BM guide, commerce/credit wallet flow, consumable treat loop, state/episode/weather
  engine, category and item asset generation prompts, pet-asset generation prompts, plant growth
  system, and the App Store screenshot pipeline (`docs/design/app-store/`).

## Store Screenshots

The shipped App Store/Google Play marketing screenshot set is **v4-pixel**: real simulator captures
composited into pixel-art phone frames with localized copy rendered in the app's real pixel font.
Build it with `python3 scripts/store-screenshots/render_v4_pixel.py` (see
`docs/design/app-store/README.md` for the full pipeline and `docs/release/store-assets/v4-pixel/README.md`
for the visual rules and locale set). Final, tracked exports live under
`docs/release/store-assets/v4-pixel/final/` — that's release evidence, not a design contract, which
is why it lives under `docs/release/` rather than `docs/design/`.

## Folder Guide

- **`docs/product/`** — product-facing plans and decisions: `product-direction.md` (source-of-truth
  product contract), `launch-plan.md` (full launch plan and BM), `economy.md` (confirmed prices and
  faucets), `improvement-backlog.md`, `cat-expansion.md`, `mobile-localization-plan.md`,
  `push-notification-state-strategy.md`.
- **`docs/engineering/`** — architecture and operational contracts: `app-shell.md` (route tree),
  `security-boundaries.md`, `worker-quality-calibration.md`, `mobile-native-runbook.md`, and
  `current/` (dated but still-active runtime status: `supabase-runtime.md`,
  `credit-store-foundation.md`).
- **`docs/design/`** — active design/asset/economy contracts that map 1:1 to implemented code (see
  Design System above), plus `docs/design/app-store/` (screenshot pipeline reference) and
  `docs/design/source-sheets/` / `docs/design/background-assets/` (generated art source sheets).
- **`docs/release/`** — everything about shipping: `backend-release-audit.md` (current release
  verdict — read this first for launch-readiness questions), `release-readiness.md`,
  `store-listing-draft.md`, `store-privacy-data-safety.md`, `ios-manual-qa-checklist.md`,
  `qa-device-checks.md`, `CHANGELOG.md` (dev-journal style change history), `legal/` (privacy policy,
  terms, audio asset licensing), and `store-assets/v4-pixel/` (approved screenshot exports).
- **`docs/archive/`** — historical material kept for context only: superseded concept packs, old
  dated audits, the deferred multi-pet-slot plan, and App Store composition references. See
  `docs/archive/README.md` for what's there and why. Nothing in `docs/archive/` is current guidance.
- **`docs/store-screenshot-manifest.json`** — kept at the docs root rather than moved, since it's a
  hub read by roughly a dozen `scripts/*.mjs` capture/validate scripts; moving it would have required
  updating every one of those path constants in the same pass as this reorganization.
- **`docs/qa-screenshots/`** — disposable QA capture output (git-ignored except for a small curated
  set); regenerate rather than hand-maintain.

## Validation

Whole-repo checks: `npx vitest run`, `npm run typecheck`. Mobile-only type check:
`npx tsc -p apps/mobile --noEmit`. Docs-adjacent gates are the many `npm run validate:*` scripts in
`package.json` (store metadata, release config, plant/pet asset contracts, mobile QA evidence, etc.)
— each one reads specific files under this tree, so if you move or rename a doc, grep
`scripts/*.mjs` for its old path first.
