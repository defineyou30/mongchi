# Mongchi

Mongchi is a standalone cross-platform iOS/Android pet-life game. Users upload a real dog or cat photo, create a tiny digital avatar, and care for that avatar inside a cozy miniature garden.

The current source of truth for product, UX, design, backend, AI, content,
security, commerce, and QA decisions is:

- [Mongchi Docs](docs/README.md)
- [Mongchi Design System](DESIGN.md)
- [Current Backend And Release Audit](docs/current/backend-release-audit-2026-07-12.md)

## Product Direction

North star:

```text
My pet has a tiny world in my phone, and it knows me.
```

The repository currently includes:

- React Native + Expo + TypeScript mobile app shell.
- Shared TypeScript domain contracts for iOS, Android, API, and workers.
- Native first-session flow for onboarding, photo upload, pet setup, generation, pet reveal, and the home garden.
- Persistent local session/care/inventory/walk state for the native MVP slice.
- Local authored reaction engine for unlimited free pet reactions without AI calls.
- Bundled sample generated-pet PNG assets rendered through a mobile asset-id registry.
- A live Supabase path with anonymous auth, private pet storage, migrations
  `0001`-`0013`, OpenAI-backed avatar generation, premium chat, account
  deletion, server credit ledger, expression packs, and generation durability.
- A separate Node API/worker path retained as a tested architecture and
  deployment reference.

## Repository Layout

```text
apps/mobile/        Expo app shell and mobile feature modules.
packages/shared/   Shared domain types, API mappers, mock data, and local reaction/care logic.
services/api/      Tested Node API/reference runtime and deployment boundaries.
workers/ai/        Tested AI worker/reference pipeline.
supabase/          Active Edge Functions, migrations, and database tests.
docs/              Product direction, implementation plan, and security boundaries.
docs/archive/      Superseded goal, concept, and planning references.
```

## Scripts

```sh
npm install
npm run generate:mobile-assets
npm run typecheck
npm run typecheck:shared
```

Run the app after installing dependencies:

```sh
npm run start:mobile
```

Native bundle checks:

```sh
npm run validate:ios
npm run validate:android
```

## Release Status

- Real OpenAI avatar generation is active through Supabase Edge Functions.
- Provider and service-role secrets remain server-side and are not bundled in
  the mobile app.
- Public live chat is not release-safe yet; see the current backend audit.
- Store products, production legal/support URLs, EAS project linkage,
  monitoring, and final release configuration remain launch work.
