# Store Privacy And Data Safety Draft

> 최신 대조: 2026-07-08 (커밋 8e8fd0c 기준). 계정 삭제는 `supabase/functions/delete-account`(진행 중)로 서버 데이터 완전 삭제 경로가 구축 중이며, 원본 사진은 아바타 생성 후 별도 삭제 경로가 있고, OpenAI가 사진 안전성/아바타 생성·프리미엄 챗을 처리하는 서드파티 처리자로 반영되어 있다.

This draft maps the current Mongchi iOS/Android implementation to App Store privacy labels and Google Play Data safety answers. It is not a final legal review. Re-check it after choosing the production auth provider, hosting, storage, AI provider config, commerce verifier, analytics, crash reporting, and privacy-policy text.

## Evidence Scope

- Native permissions are declared in `apps/mobile/app.json`: iOS camera/photo descriptions, Android `CAMERA` and `READ_MEDIA_IMAGES`, and Android microphone blocked through `android.permission.RECORD_AUDIO`.
- Mobile source-photo selection lives in `apps/mobile/src/features/photoUpload/PhotoUploadScreen.tsx` and validates local JPEG, PNG, or WebP candidates before generation.
- API-backed photo, generation, chat, purchase, restore, and privacy deletion request contracts live in `packages/shared/src/api/mobileContracts.ts` and `apps/mobile/src/shared/api/mobileApiClient.ts`.
- API/worker provider secrets remain server-side by boundary in `docs/engineering/security-boundaries.md`; mobile code does not contain AI provider keys, storage credentials, payment verification secrets, or raw provider responses.
- Safe analytics code in `packages/shared/src/analytics/safeAnalytics.ts` rejects property keys for raw photo, image URI, URL, message text, secrets, tokens, payment data, and receipt data.
- Operational logging in `services/api/src/operationalLogger.ts` redacts tokens, receipts, store verification values, source-photo keys, signed URLs, raw text, provider output, and prompts.
- The privacy SDK boundary in `scripts/validate-privacy-sdk-boundaries.mjs` scans package manifests, `package-lock.json`, and app/server source entry points for unapproved crash, diagnostics, tracking, advertising, and third-party analytics SDKs.

## App Store Privacy Labels

### Data Used To Track You

None in the current implementation. The app has no advertising SDK, ATT prompt, IDFA flow, cross-app tracking identifier, or third-party ad measurement integration.

### Data Linked To The User

Use these labels when the production API-backed build is enabled:

| App Store category | Data in this app | Purpose | Notes |
| --- | --- | --- | --- |
| User Content - Photos or Videos | User-selected pet source photo, generated pet avatar assets | App Functionality | Photo is optional, user-selected, and used to create the pet avatar. Production source photos use private upload/read boundaries and deletion routes. |
| User Content - Other User Content | Pet name, species, personality tags, favorite thing, generation issue category, premium chat messages | App Functionality | Free reactions are local/authored. Premium chat is AI-generated, entitlement-gated, moderated, and retention-limited by backend policy. |
| Purchases | Product id, transaction id, receipt hash, entitlement records, restore records | App Functionality, Fraud Prevention | Raw store verification token is request-scoped for verifier use and must not be stored in ledgers or analytics. |
| Identifiers - User ID | Authenticated user id, pet ownership id, entitlement owner id | App Functionality | Final auth provider may add account identifiers; update labels if email or phone is collected. |
| Usage Data - Product Interaction | Care actions, walk status, reward claim state, inventory placement, screen/event names | App Functionality, Analytics | Safe analytics permits only non-sensitive event metadata. Do not include raw photos, raw chat text, receipts, or tokens. |

### Data Not Linked To The User

None required by the current repo. If production hosting, crash reporting, or analytics adds diagnostics that are not linked to account identity, update this section before submission. `npm run validate:privacy-sdk-boundaries` now fails if packages or source references for Sentry, Crashlytics, Firebase analytics, tracking transparency, advertising, EAS Insights, or common third-party analytics SDKs are added before this draft and the store answers are updated.

### Data Not Collected

The current app does not request or collect location, contacts, calendars, microphone/audio, health/fitness, browsing history, search history, financial account details, payment card numbers, government IDs, or advertising identifiers.

## Google Play Data Safety

### Data Collection

| Google Play category | Collected? | Required or optional | Purpose | User deletion |
| --- | --- | --- | --- | --- |
| Photos and videos | Yes in API-backed builds | Optional user action | App functionality: create the pet avatar | Original-photo deletion route exists; pet deletion also removes owned photo/generated-asset storage through the privacy worker. |
| App activity - In-app messages | Yes when premium chat is used | Optional paid feature | App functionality: AI-generated pet conversation | Chat-history deletion route exists; retention purge worker boundary exists. |
| App activity - App interactions | Yes | Required for app functionality after onboarding | App functionality and safe product analytics | Pet-data deletion route exists. |
| Financial info - Purchase history | Yes when checkout/restore is enabled | Optional user purchase | App functionality and fraud prevention | Store entitlement/revocation state is retained as needed for purchase integrity; raw verification token is not stored. |
| Device or other IDs / User IDs | User ID yes, device advertising ID no | Required for account-backed API mode | Auth, ownership, entitlement, privacy deletion | Pet/account deletion path must be finalized with the production auth provider. |
| App info and performance | Not in this repo by default | Not collected unless a crash/diagnostics SDK is added | N/A | Update before submission if adding Sentry, Crashlytics, EAS Insights, or host-level linked diagnostics. |

### Data Sharing

The app should answer "shared" only for service-provider processing required to run the app, not advertising or sale of data:

- Auth provider: verifies the user identity for API ownership.
- Private storage provider: stores original photos and generated assets.
- AI provider: processes source photos for safety/avatar generation and premium chat messages when configured server-side.
- App Store / Google Play or store verifier gateway: verifies purchase and restore tokens server-side.
- Hosting/logging providers: process redacted operational events.

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
- Keep the in-app Privacy screen copy aligned with the final hosted privacy policy.
- Re-run `npm run validate:store-metadata-alignment` after changing native permissions, store listing copy, screenshot captions, purchase copy, or privacy/data-safety answers.
