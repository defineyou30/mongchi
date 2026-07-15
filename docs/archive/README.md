# Docs Archive Policy

Last updated: 2026-07-15

This folder holds documents that no longer describe the implemented Mongchi app, or that only
have value as a historical record of a past decision or a past audit snapshot. Nothing here is
read by validator scripts. For the current implementation baseline, see
`docs/release/backend-release-audit.md` (release/security verdict) and
`docs/engineering/current/` (runtime and credit-store status).

## What's Here And Why

- `legacy/initial-goal/` - the original visual goal brief and reference images that kicked off the
  project.
- `legacy/new-concepts/` - a superseded concept/execution/UX/backend/AI/monetization planning pack
  from an earlier iteration of the product.
- `legacy/placement-items.md` - historical free-placement/decor design. The current shared domain
  marks placeable decor as retired from the live mobile UI (see the "garden props removal pivot"
  decision).
- `multi-pet-slot-plan.md` - the v1.1 multi-pet-slot roadmap. Slot W1 (session bundling) and W2
  (server namespace) already shipped; this plan covers the deferred W3+ (purchase, second-pet
  onboarding, multi-pet surfaces), intentionally held for a post-launch release.
- `app-store-references/moshi-kids-structure/` - a competitor screenshot-structure reference used
  while composing the App Store visual set. Reference-only, not an active design contract; the
  active contract lives in `docs/design/app-store/README.md`.
- `audits-2026-07/` - three dated, point-in-time audit snapshots from the 2026-07-09/07-10 review
  pass (`documentation-audit-2026-07-09.md`, `integrated-review-2026-07-09.md`,
  `mongchi-comprehensive-product-audit-2026-07-10.md`, plus the icon concept grid image the product
  audit references). Kept for history — many of their findings have since been fixed or superseded
  by later work — but they are not the current status. Current status lives in
  `docs/release/backend-release-audit.md`.

## Not Archived Here

QA screenshots, Instruments traces, test logs, and other generated/disposable outputs are not
archived — they should be regenerated when needed rather than accumulated.

## Current Source Of Truth

- Product/BM: `docs/product/product-direction.md`, `docs/product/launch-plan.md`,
  `docs/product/economy.md`.
- Release/security verdict: `docs/release/backend-release-audit.md`,
  `docs/release/release-readiness.md`.
- Runtime detail: `docs/engineering/current/supabase-runtime.md`,
  `docs/engineering/current/credit-store-foundation.md`.
- One-page orientation: `docs/README.md`.
