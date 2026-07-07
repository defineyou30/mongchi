# Mongchi

Mongchi is a new standalone cross-platform iOS/Android pet-life game. Users upload a real dog or cat photo, create a tiny digital avatar, and care for that avatar inside a cozy glass-dome terrarium.

The source of truth for product, UX, design, backend, AI, content, security, commerce, and QA decisions is:

- [Mongchi Guide](new-concepts/mongchi-guide/README.md)

## Product Direction

North star:

```text
My pet has a tiny world in my phone, and it knows me.
```

This first scaffold targets the prototype stage from the guide:

- React Native + Expo + TypeScript mobile app shell.
- Shared TypeScript domain contracts for iOS, Android, API, and workers.
- Mock first-session flow for onboarding, pet setup, photo upload, hatching, pet reveal, and terrarium.
- Persistent local session/care/inventory/walk state for the native MVP slice.
- Local authored reaction engine for unlimited free pet reactions without AI calls.
- Bundled sample generated-pet PNG assets rendered through a mobile asset-id registry.
- Shared mobile API mapper contracts for future signed photo upload, generation, and care integration.
- Backend/API and AI worker placeholders with no real providers, payments, production services, or migrations connected.

## Repository Layout

```text
apps/mobile/        Expo app shell and mobile feature modules.
packages/shared/   Shared domain types, API mappers, mock data, and local reaction/care logic.
services/api/      Backend/API placeholder and typed endpoint contract notes.
workers/ai/        AI generation worker placeholder with mock-only pipeline notes.
docs/              Product direction, implementation plan, and security boundaries.
new-concepts/      Original guide and concept documents.
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

## Non-Goals In This Pass

- No real AI provider calls.
- No real payments or purchase verification.
- No production database, storage bucket, migrations, or service credentials.
- No provider keys or service role secrets in the mobile app.
