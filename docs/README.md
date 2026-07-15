# Mongchi Docs

Last updated: 2026-07-13

This docs tree is now organized around the implemented app as the source of truth. Historical planning docs remain useful as reference, but product, UX, technical, BM, and QA decisions should start from the current app code and the current audit below.

## Source of Truth

- Product and visual contract: `DESIGN.md`
- Current mobile app: `apps/mobile`
- Shared game/session domain: `packages/shared/src`
- Node API and worker path: `services/api`, `workers/ai`
- Supabase path: `supabase/functions`, `supabase/migrations`
- Current audit baseline: `docs/current/mongchi-comprehensive-product-audit-2026-07-10.md`

## Current Docs

- `docs/current/integrated-review-2026-07-09.md` - full audit across documentation, simulator QA, product, UX/UI, retention, game design, technical, security, AI pipeline, BM, benchmark, priorities, and roadmap.
- `docs/current/documentation-audit-2026-07-09.md` - document classification, deprecated docs, update queue, and target taxonomy.
- `docs/current/mongchi-comprehensive-product-audit-2026-07-10.md` - latest implementation, simulator, security, and release audit.
- `docs/current/backend-release-audit-2026-07-12.md` - current Supabase deployments, verified launch blockers, release configuration, medium-risk findings, and dog/cat backend status.
- `docs/current/supabase-runtime-2026-07-12.md` - current Edge Functions, migration inventory through `0015`, chat cost/report boundaries, deployment order, and runtime flags.
- `docs/current/credit-store-foundation-2026-07-13.md` - current 12-gem starter grant, credit packs, RevenueCat webhook boundary, and the deferred paid photo-remake contract.

## Active Reference Areas

- `docs/design/` - active design, assets, interaction, economy, and generation contracts that still map to the implemented app.
- `docs/legal/` - current privacy and terms copy.
- `docs/product/` - narrow product references; archive-only files are called out in the documentation audit.
- `docs/product/cat-expansion.md` - implementation-backed plan for opening the already-modeled cat path.

## Archive Policy

- `docs/archive/legacy/initial-goal/` contains the original visual goal brief.
- `docs/archive/legacy/new-concepts/` contains the superseded concept and execution pack.
- Temporary QA screenshots, traces, and generated previews are not retained in the repository.
- `docs/archive/README.md` records the archive/deprecation policy.
- Root-level legacy docs are kept for compatibility with existing scripts and references until those scripts are updated. Prefer linking new work through `docs/current/`.
