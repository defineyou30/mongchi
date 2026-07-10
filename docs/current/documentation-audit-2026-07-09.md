# Documentation Audit - 2026-07-09

Basis: implemented app first, historical docs second. Code and simulator evidence were cross-checked against `apps/mobile`, `packages/shared/src`, `services/api`, `workers/ai`, `supabase`, and iPhone 16 Pro Simulator screenshots.

## New Structure

```text
docs/
  README.md
  current/
    integrated-review-2026-07-09.md
    documentation-audit-2026-07-09.md
  design/
  legal/
  product/
  qa-screenshots/
  archive/
```

The broader target taxonomy for future migration is:

```text
Product
Architecture
Game Design
Character System
UX
UI
Assets
API
Backend
Database
BM
Security
QA
Roadmap
Archive
```

For this pass, root documents were not mass-moved because existing validators and docs reference root paths such as `docs/app-shell.md`, `docs/release-readiness.md`, and `docs/security-boundaries.md`. The new SSoT layer is `docs/current/`; migration can proceed safely once path consumers are updated.

## Current / Valid

- `DESIGN.md` - top-level product and visual contract.
- `docs/app-shell.md` - active shell doc, now updated to include all current routes.
- `docs/design/*.md` and `docs/design/*.json` - active design/economy/asset contracts that map to current code.
- `docs/legal/privacy-policy.md`, `docs/legal/terms.md` - active legal copy.
- `docs/mobile-native-runbook.md`, `docs/ios-manual-qa-checklist.md`, `docs/qa-device-checks.md` - current operational QA references.
- `docs/release-readiness.md`, `docs/readiness-diagnosis.md`, `docs/store-listing-draft.md`, `docs/store-privacy-data-safety.md`, `docs/store-screenshot-manifest.json` - active launch/store references, though screenshot manifest should be refreshed if Friend/Settings/Legal screens become store-facing.
- `docs/security-boundaries.md`, `docs/worker-quality-calibration.md`, `docs/chat-live-design.md`, `docs/credit-phase1-design.md` - still useful, but the current review supersedes them where implementation has drifted.

## Deprecated / Archive

- `docs/dummy/**` - duplicate archive tree.
- `docs/product/placement-items-archive.md` - historical placeable-decor context only.
- `docs/multi-pet-slot-plan.md` - deferred future scope.
- `docs/retention-gap-analysis.md`, `docs/mvp-slice-status.md` - historical planning snapshots.
- Older screenshot archives under `docs/qa-screenshots/_archive/` and `docs/qa-screenshots/manual-tap-qa/` - evidence only, not current UI baseline.

## Duplicates

`docs/dummy/**` duplicates active root/design/legal/QA docs across concept, planning, frontend, backend, design, launch QA, and legal categories. Keep it separated as archive material; do not use it as an active source.

## Update Queue

Critical:
- Align validation scripts with current implementation or fix implementation drift:
  - `validate:mobile-assets`
  - `validate:mobile-flow`
  - `validate:mobile-secret-boundaries`
  - `validate:env-examples`
  - `validate:mobile-copy`

High:
- Keep `docs/app-shell.md` synchronized with the real Expo route tree.
- Decide whether `docs/store-screenshot-manifest.json` is only the conversion funnel or all user-visible screens.
- Add a current architecture diagram after choosing Supabase vs Node/Postgres as production SSOT.

Medium:
- Move historical strategy docs into `docs/archive/` after path consumers are updated.
- Split active docs into the full target taxonomy.
- Add one current QA index under `docs/qa-screenshots/README.md` if the deleted/archived README is restored.
