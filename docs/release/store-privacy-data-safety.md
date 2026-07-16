# Store Privacy And Data Safety Draft

> 최신 대조: 2026-07-16 (커밋 b937dc10 기준). 계정 삭제는 `supabase/functions/delete-account`(진행 중)로 서버 데이터 완전 삭제 경로가 구축 중이며, 원본 사진은 아바타 생성 후 별도 삭제 경로가 있고, OpenAI가 사진 안전성/아바타 생성·프리미엄 챗을 처리하는 서드파티 처리자로 반영되어 있다. Sentry 크래시 리포팅(스크러빙 + 익명 id 8자 절단)과 PostHog 사용 이벤트(익명, `identify()` 미호출)가 실제로 연동되었고, RevenueCat 기반 IAP(계정 귀속), 채팅 메시지 서버 저장, 익명 사용자 uuid, 선택적 Apple 로그인 이메일 연결까지 반영해 App Store Privacy Labels 표를 실제 수집 현황과 일치시켰다.

This draft maps the current Mongchi iOS/Android implementation to App Store privacy labels and Google Play Data safety answers. It is not a final legal review. Re-check it after choosing the production auth provider, hosting, storage, AI provider config, commerce verifier, analytics, crash reporting, and privacy-policy text.

## Evidence Scope

- Native permissions are declared in `apps/mobile/app.json`: iOS camera/photo descriptions, Android `android.permission.CAMERA` and `android.permission.READ_MEDIA_IMAGES`, Android `android.permission.ACCESS_COARSE_LOCATION` and `android.permission.ACCESS_FINE_LOCATION` (declared for the garden weather scene; see "Android Runtime Permission Rationale" under Google Play Data Safety for the per-permission justification), and Android microphone blocked through `android.permission.RECORD_AUDIO` in `blockedPermissions`.
- Mobile source-photo selection lives in `apps/mobile/src/features/photoUpload/PhotoUploadScreen.tsx` and validates local JPEG, PNG, or WebP candidates before generation.
- API-backed photo, generation, chat, purchase, restore, and privacy deletion request contracts live in `packages/shared/src/api/mobileContracts.ts` and `apps/mobile/src/shared/api/mobileApiClient.ts`.
- API/worker provider secrets remain server-side by boundary in `docs/engineering/security-boundaries.md`; mobile code does not contain AI provider keys, storage credentials, payment verification secrets, or raw provider responses.
- Safe analytics code in `packages/shared/src/analytics/safeAnalytics.ts` rejects property keys for raw photo, image URI, URL, message text, secrets, tokens, payment data, and receipt data.
- Operational logging in `services/api/src/operationalLogger.ts` redacts tokens, receipts, store verification values, source-photo keys, signed URLs, raw text, provider output, and prompts.
- The privacy SDK boundary in `scripts/validate-privacy-sdk-boundaries.mjs` scans package manifests, `package-lock.json`, and app/server source entry points for unapproved crash, diagnostics, tracking, advertising, and third-party analytics SDKs. Sentry and PostHog are now approved integrations reflected in this draft; the boundary continues to gate any *further* SDK addition until this document and the store answers are updated again.
- Crash reporting lives in `apps/mobile/src/shared/monitoring/sentry.ts` (crash-only `Sentry.init`: `tracesSampleRate: 0`, no session replay, `sendDefaultPii: false`, disabled under `__DEV__`) and `apps/mobile/src/shared/monitoring/sentryScrubbing.ts` (redacts any `uri`/`photo`/`message`/`text` keyed value and `file://` paths, and truncates the event's user id to the first 8 characters as a non-reversible de-dup hint).
- Usage analytics lives in `apps/mobile/src/shared/monitoring/analytics.ts` (manual PostHog client, autocapture and session replay off, `disableGeoip: true`, `identify()` never called so only PostHog's own anonymous device id is used) with events constrained to the enum-only whitelist in `apps/mobile/src/shared/analytics/mobileAnalyticsWhitelist.ts`.
- Purchases go through RevenueCat in `apps/mobile/src/features/session/nativeStorePurchases.ts` and `apps/mobile/src/features/session/creditPackCheckout.ts`, tied to the account's anonymous Supabase user id.
- The garden weather lookup in `apps/mobile/src/features/session/locationWeatherSession.ts` requests only approximate accuracy (`Location.Accuracy.Lowest`) and rounds coordinates to one decimal degree before sending them to `supabase/functions/weather-lookup/index.ts`, which never logs, stores, or persists the coordinates (read-only upstream call, no database write).
- Optional Apple identity linking/recovery lives in `apps/mobile/src/features/session/supabaseAccountLinkSession.ts`; it is only invoked when the user chooses to link or recover with Sign in with Apple.
- There is no voice-input or audio-recording feature anywhere in the mobile app: `expo-audio` usage under `apps/mobile/src/shared/audio/` (`ambiencePlayer.ts`, `bgmPlayer.ts`, `sfxPlayer.ts`, `soundManager.ts`) is playback-only, and the microphone glyph in `apps/mobile/src/features/chat/ChatGateScreen.tsx`'s chat input bar is a static `decorative` icon with no recording or speech-to-text wired to it.

## App Store Privacy Labels

### Data Used To Track You

None in the current implementation. The app has no advertising SDK, ATT prompt, IDFA flow, cross-app tracking identifier, or third-party ad measurement integration.

### Data Linked To The User

Confirmed matrix for the current production build. Every row here is tied to the account's anonymous Supabase user id (or, for the optional Apple-linked email, to that same account once linking happens):

| App Store category | Data in this app | Purpose | Tracking | Notes |
| --- | --- | --- | --- | --- |
| Purchases | Product id, transaction id, receipt hash, entitlement records, restore records | App Functionality, Fraud Prevention | No | RevenueCat-verified purchase/entitlement records tied to the account. Raw store verification token is request-scoped for verifier use and must not be stored in ledgers or analytics. See `apps/mobile/src/features/session/nativeStorePurchases.ts` and `apps/mobile/src/features/session/creditPackCheckout.ts`. |
| User Content - Photos or Videos | User-selected pet source photo, generated pet avatar assets | App Functionality | No | Photo is optional, user-selected, and used to create the pet avatar. The original source photo is deleted from the server immediately after generation completes (Original-photo deletion route exists); the generated avatar stays tied to the pet/account. See `apps/mobile/src/features/photoUpload/PhotoUploadScreen.tsx`. |
| User Content - Other User Content | Pet name, species, personality tags, favorite thing, generation issue category, premium chat messages | App Functionality | No | Free reactions are local/authored. Premium chat messages are AI-generated, entitlement-gated, moderated, retention-limited by backend policy, and stored server-side (`services/api/src/premiumChatProvider.ts`, `supabase/functions/chat-turn/index.ts`). |
| Identifiers - User ID | Authenticated user id (anonymous Supabase auth uuid), pet ownership id, entitlement owner id | App Functionality | No | Every account starts anonymous; the same uuid links purchases, photos, and chat to the account without requiring sign-in. |
| Contact Info - Email Address | Apple-provided email address (including Apple's private-relay address if the user picks "Hide My Email") | App Functionality | No | Collected only if the user chooses to link or recover their account with Sign in with Apple; this is optional and off by default. See `apps/mobile/src/features/session/supabaseAccountLinkSession.ts`. |
| Usage Data - Product Interaction | Care actions, walk status, reward claim state, inventory placement, screen/event names | App Functionality | No | Safe analytics permits only non-sensitive event metadata used to run the app's own daily-loop/reward logic. Do not include raw photos, raw chat text, receipts, or tokens. Distinct from the not-linked PostHog product-interaction row below. |

### Data Not Linked To The User

| App Store category | Data in this app | Purpose | Tracking | Notes |
| --- | --- | --- | --- | --- |
| Diagnostics - Crash Data | Stack trace, breadcrumb trail, first 8 characters of the local anonymous id | App Functionality | No | Sentry crash reporting. `beforeSend`/`beforeBreadcrumb` scrub any photo uri, chat/message/text body, or `file://` path, and truncate the user id to a non-reversible 8-character de-dup hint (never a real account id or lookup key). No PII (`sendDefaultPii: false`), no session replay, no performance tracing. See `apps/mobile/src/shared/monitoring/sentry.ts` and `apps/mobile/src/shared/monitoring/sentryScrubbing.ts`. |
| Usage Data - Product Interaction | Screen/event names, care actions, walk status, reward claim state (same enum-only whitelist as the linked row above) | Analytics | No | PostHog product analytics. Uses PostHog's own anonymous device id; `identify()` is never called, so no Supabase account id ever reaches PostHog. `disableGeoip: true` drops location-from-IP enrichment; autocapture and session replay are off. See `apps/mobile/src/shared/monitoring/analytics.ts`. |

`npm run validate:privacy-sdk-boundaries` continues to fail the build if packages or source references for any *additional* crash, diagnostics, tracking, advertising, or third-party analytics SDK (beyond the Sentry/PostHog integrations captured above) are added before this draft and the store answers are updated again.

### Data Not Collected

- **Location**: Not collected under App Store's real-time-processing exception. The garden weather scene performs a single on-demand approximate-location lookup (`Location.Accuracy.Lowest`, coordinates rounded to one decimal degree before use) to fetch a live weather condition from `supabase/functions/weather-lookup`. That Edge Function makes a read-only upstream call and never logs, stores, or writes the coordinates to any table or account record (see `supabase/functions/weather-lookup/index.ts` and `apps/mobile/src/features/session/locationWeatherSession.ts`). This is real-time processing that is not retained, matching Apple's exception for data used only in the moment and never stored, so it is answered as not collected.
- The app does not request or collect contacts, calendars, or microphone/audio: there is no voice-input or audio-recording feature in the codebase (`expo-audio` under `apps/mobile/src/shared/audio/` is playback-only for background music/sound effects/ambience, and the chat input bar's microphone glyph in `apps/mobile/src/features/chat/ChatGateScreen.tsx` is a static decorative icon, not wired to recording or speech-to-text), and `android.permission.RECORD_AUDIO` is explicitly blocked via `expo.android.blockedPermissions` in `apps/mobile/app.json`, so the installed app can never request microphone access.
- Also not collected: health/fitness data, browsing history, search history, financial account details, payment card numbers, government IDs, or advertising identifiers.

## Google Play Data Safety

### Android Runtime Permission Rationale

Google Play review asks for a plain-language reason for each sensitive runtime permission declared in `apps/mobile/app.json`. Current answers:

| Android permission | Rationale |
| --- | --- |
| `android.permission.CAMERA` | Captures a single pet source photo the user actively chooses to take, for avatar generation during onboarding or remake. |
| `android.permission.READ_MEDIA_IMAGES` | Lets the user pick one existing pet photo from their gallery for onboarding or avatar remake. The uploaded photo is deleted from the server immediately after generation completes; the on-device copy stays under the user's own control and can be deleted by them at any time. |
| `android.permission.RECORD_AUDIO` | Not used by the app; declared only because a dependency's manifest requests it. Blocked at build time via `expo.android.blockedPermissions`, so the installed app can never request microphone access. |
| `android.permission.ACCESS_COARSE_LOCATION` | Used for a single approximate-location lookup to show local weather in the pet garden. Coordinates are rounded to one decimal place before use and are never stored or logged. |
| `android.permission.ACCESS_FINE_LOCATION` | Declared automatically by the `expo-location` plugin's manifest merge, but the app's runtime request always asks for approximate accuracy only (`Location.Accuracy.Lowest`); precise location is never requested or used. Footnote: revisit whether this permission should be added to `expo.android.blockedPermissions` before the Android store submission. |

### Data Collection

| Google Play category | Collected? | Required or optional | Purpose | User deletion |
| --- | --- | --- | --- | --- |
| Photos and videos | Yes in API-backed builds | Optional user action | App functionality: create the pet avatar | Original-photo deletion route exists; pet deletion also removes owned photo/generated-asset storage through the privacy worker. |
| App activity - In-app messages | Yes when premium chat is used | Optional paid feature | App functionality: AI-generated pet conversation | Chat-history deletion route exists; retention purge worker boundary exists. |
| App activity - App interactions | Yes | Required for app functionality after onboarding | App functionality and safe product analytics | Pet-data deletion route exists. |
| Financial info - Purchase history | Yes when checkout/restore is enabled | Optional user purchase | App functionality and fraud prevention | Store entitlement/revocation state is retained as needed for purchase integrity; raw verification token is not stored. |
| Device or other IDs / User IDs | User ID yes, device advertising ID no | Required for account-backed API mode | Auth, ownership, entitlement, privacy deletion | Pet/account deletion path must be finalized with the production auth provider. |
| App info and performance | Yes: crash logs (Sentry) and product-interaction diagnostics (PostHog) | Not required; used for stability monitoring and product analytics | Analytics: crash diagnostics and anonymous product-interaction events | Not linked to user identity (Sentry keeps only an 8-character, non-reversible id de-dup hint; PostHog uses its own anonymous device id and `identify()` is never called), so no per-user deletion route is needed. Mirrors the App Store "Data Not Linked To The User" rows above. |

### Data Sharing

The app should answer "shared" only for service-provider processing required to run the app, not advertising or sale of data:

- Auth provider: verifies the user identity for API ownership.
- Private storage provider: stores original photos and generated assets.
- AI provider: processes source photos for safety/avatar generation and premium chat messages when configured server-side.
- App Store / Google Play or store verifier gateway: verifies purchase and restore tokens server-side.
- RevenueCat: processes purchase/entitlement records tied to the account for checkout and restore.
- Hosting/logging providers: process redacted operational events.
- Sentry: receives scrubbed crash reports (no photo/message/text bodies, no full account id) for stability monitoring.
- PostHog: receives anonymous, whitelisted product-interaction events (no `identify()` call, no account id) for product analytics.

Do not answer that data is shared for advertising, third-party marketing, or cross-app tracking unless a new integration is added.

### Security Practices

- Encrypted in transit: yes for production API, storage signer URLs, provider calls, and store verification endpoints. Production release config should use HTTPS endpoints.
- Encrypted at rest: answer yes only after the selected production database, object storage, log sink, and backup systems have encryption at rest enabled and documented.
- Deletion request path: yes for original photos, premium chat history, and pet data. Production deployment still needs scheduled privacy/outbox workers and alert routing mounted.
- Data minimization: mobile and operational analytics must not include raw photo URIs, image URLs, raw message text, secrets, tokens, payment payloads, receipt payloads, or provider prompts. The privacy SDK boundary blocks unapproved external diagnostics, tracking, advertising, and analytics SDKs so the current "not collected"/"not tracked" answers stay aligned with the installed app.

## Final Submission Checklist

- Set final `EXPO_PUBLIC_TINY_PET_PRIVACY_URL`, `EXPO_PUBLIC_TINY_PET_TERMS_URL`, and `EXPO_PUBLIC_TINY_PET_SUPPORT_EMAIL`.
- Confirm whether the production auth provider collects email, phone, name, or social profile data; update App Store and Google Play categories if it does.
- Confirm whether crash reporting, analytics, or host logs collect diagnostics linked to user identity.
- Run `npm run validate:privacy-sdk-boundaries` after dependency, native config, analytics, diagnostics, tracking, or advertising changes.
- Confirm provider processing terms for auth, storage, AI, store verification, hosting, and logging.
- Confirm production database/object storage/log/backups encryption at rest before answering yes to Google Play encryption-at-rest wording.
- Confirm privacy deletion workers, outbox delivery, retention purge, and alerting are deployed before public launch.
- Revisit whether `android.permission.ACCESS_FINE_LOCATION` should be added to `expo.android.blockedPermissions` (see "Android Runtime Permission Rationale") before the Android store submission.
- Keep the in-app Privacy screen copy aligned with the final hosted privacy policy.
- Re-run `npm run validate:store-metadata-alignment` after changing native permissions, store listing copy, screenshot captions, purchase copy, or privacy/data-safety answers.
