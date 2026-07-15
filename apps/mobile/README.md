# Mobile App

Expo + React Native + TypeScript app shell for Mongchi.

Current scope:

- Route scaffold for onboarding, pet setup, photo upload, hatching, reveal, terrarium, chat, inventory, shop, and settings.
- Local mock terrarium screen that updates care state and selects authored reactions without AI.
- Reference art is used only as direction. Runtime screens compose native React Native UI with separate bundled background, item, shop, and pet PNG assets; full reference/mockup screenshots must not be used as screen art.
- Production API fetch client boundary for auth-injected app requests, provider-neutral session-token resolution, safe error mapping, upload/generation/care/chat endpoints, and base URL validation.
- Optional API-backed daily loop runtime for local/integration builds: when `EXPO_PUBLIC_TINY_PET_API_BASE_URL` is set, terrarium care state, inventory, item catalog, walk start, and walk reward claim use the backend API boundary. Production release config requires this URL so release builds do not fall back to local prototype state.
- Optional API-backed first-session generation runtime for integration builds: configured API builds create pet profiles, issue signed upload metadata, upload source-photo bytes for HTTP(S) signed URLs, complete upload metadata, create/poll generation jobs, and accept generated assets through the API boundary.
- API-backed generated-pet rendering resolves app-private signed read URLs and renders HTTP(S) asset URLs for accepted generated states, falling back to bundled first-pass sample PNGs for local mock URLs.
- API-backed catalog and entitlement presentation uses server-owned state only; local mock catalog and mock entitlements are used only in local mode.
- The active direct-Supabase runtime uses anonymous Supabase auth, private `pet-media` storage, the deployed `generate-avatar`, `chat-turn`, `delete-account`, and RevenueCat credit-webhook boundaries, plus OpenAI provider calls from server-side functions. The 20/60/150 credit catalog, one-time 12-credit starter grant, credit store UI, and idempotent grant/refund webhook foundation are implemented. RevenueCat SDK identity mapping, App Store product configuration, remote crash reporting, and final public legal/support release values remain release work. The optional `services/api` integration path below is a separate prototype boundary, not the current production generation path.

Run from the repository root:

```sh
npm install
npm run start:mobile
```

API integration builds can set `EXPO_PUBLIC_TINY_PET_API_BASE_URL`. API requests resolve auth through the mobile session-token boundary, using Expo SecureStore on iOS/Android for provider session tokens and falling back to the development mock user id only when `EXPO_PUBLIC_TINY_PET_ALLOW_DEVELOPMENT_AUTH_FALLBACK` is not disabled. Local mock adapter builds may set `EXPO_PUBLIC_TINY_PET_MOCK_AUTH_TOKEN=user_demo_001`; this is public development metadata, not a production session token. Production builds must set `EXPO_PUBLIC_TINY_PET_API_BASE_URL`, set `EXPO_PUBLIC_TINY_PET_ALLOW_DEVELOPMENT_AUTH_FALLBACK=false`, leave `EXPO_PUBLIC_TINY_PET_MOCK_AUTH_TOKEN` unset, and deploy API mounts with `TINY_PET_API_ALLOW_MOCK_AUTH=false`, `TINY_PET_API_ALLOW_MOCK_PURCHASES=false`, `TINY_PET_API_ALLOW_MOCK_STORAGE=false`, server-side JWT/JWKS auth verification, server-side store purchase verification through either the HTTP verifier gateway env or `TINY_PET_STORE_VERIFIER_PROVIDER=direct` with Apple/Google server credentials, and `PrivateStorageSigner` implementations. Native checkout can be enabled in a custom development or production build with `EXPO_PUBLIC_TINY_PET_ENABLE_NATIVE_CHECKOUT=true`; it uses `expo-iap`, requires an HTTPS API base URL, sends raw store purchase tokens only as request-scoped `storeVerificationToken` values to the API verifier, and must not persist or emit them as analytics. Provider keys, service secrets, payment secrets, receipt secrets, storage credentials, and production auth secrets must never be placed in mobile env files.

Public release config values are `EXPO_PUBLIC_TINY_PET_PRIVACY_URL`, `EXPO_PUBLIC_TINY_PET_TERMS_URL`, and `EXPO_PUBLIC_TINY_PET_SUPPORT_EMAIL`. Production checks can run with:

```sh
TINY_PET_RELEASE_PROFILE=production npm run validate:release-config
```

QA-only screen presets such as `EXPO_PUBLIC_TINY_PET_QA_SCREEN_PRESET=settings-privacy-error` are for deterministic simulator evidence and are rejected by production release-config validation.

Static mobile accessibility checks can run from the repository root:

```sh
npm run validate:mobile-accessibility
```

Generated mobile asset checks can run from the repository root:

```sh
npm run validate:mobile-assets
```

First-session route and CTA checks can run from the repository root:

```sh
npm run validate:mobile-flow
```
