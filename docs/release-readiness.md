# Release Readiness

> **최종 갱신일: 2026-07-08.**
>
> **현재 상태 요약 (2026-07-08).** 아래 본문(“Implemented In This Pass” 이하)은 2026-07-03 mock 서버 프로토타입(`services/api`·`workers/ai`) 시점의 상세 준비 로그로, 과정 보존을 위해 그대로 둔다. 그 이후 실제 백엔드는 **Supabase**로 정착했다(`supabase/functions`·`supabase/migrations` 0001–0005 배포). 아래 프로토타입 계약의 상당수는 Supabase 배선으로 대체되었으므로, 실제 출시 게이팅은 이 상단 섹션과 문서 하단 "출시 전 남은 체크리스트"를 기준으로 판단한다.
>
> **출시 전까지 해결된 것**(2026-07-04 retention-gap·2026-07-07 readiness 분석 이후):
> - 버전관리(최상위 리스크) → git 도입 + 원격 push(2026-07-07). vitest 1252 그린.
> - 관측성 → ErrorBoundary + 로컬 에러 리포터(Sentry 실연동은 후속 네이티브 재빌드).
> - 법적 → 실제 Privacy/Terms/Support 내용 + `docs/legal`.
> - 데이터 백업 → 세션 내보내기/가져오기.
> - 보안 → 표정팩 rate-limit 봉합, 크레딧 서버 원장(`credit_wallets`/`credit_ledger` 0004) + 표정팩 서버 선차감(로컬 변조 무한 무료생성 봉합).
> - 알림 파이프라인 데드코드 → 복구(첫 케어 후 퍼미션 + 복귀 사다리 + 산책 귀가 알림).
> - 게임필/사운드 → Tier 2·3·4 + 사운드 Phase 1·2.
> - 산책 도감 날씨 시드 고정 버그 → 수정(무과금 축 복구).
> - 케어 밸런스("다 해줬는데 게이지 안 오름") → 캐치업 배수 + 감쇠 바닥 + 에너지 회복.
> - 웰컴 온보딩 + 산책 대기 경험 + Bath 액션 데드엔드 수리.
>
> 출시 전 남은 것은 문서 하단 "출시 전 남은 체크리스트" 참조.

---

This project is moving from mock MVP slice toward pre-release iOS/Android readiness. The guide remains the source of truth.

## Implemented In This Pass (2026-07-03 mock 서버 프로토타입 시점, 과정 보존)

- Native photo picker path with Expo Image Picker.
- Camera/photo permission request handling before native prompts.
- Local-only selected photo URI stored in the prototype session.
- Delete original photo clears the local source photo reference while preserving the generated mock pet.
- In-app Privacy, Terms, and Support screens reachable from Settings.
- Destructive privacy actions now require native confirmation dialogs before clearing local photo, chat, or pet data.
- Settings now surfaces privacy-action progress and safe failure copy for original-photo, chat-history, pet-data, restore, and checkout actions.
- Optional API-backed privacy deletion mode now routes original-photo deletion, chat-history deletion, and pet-data deletion through tested server ownership boundaries before local state is cleared in integration builds.
- Restore purchases is wired to the API restore contract in API-backed builds and remains a safe local no-op when store checkout is not enabled.
- Icon-only and shared pressable controls have accessibility roles, labels, and disabled/selected state where applicable.
- Hatching progress respects the OS reduce-motion setting by switching from automatic timed progress to manual step advancement.
- Expo app icon, Android adaptive icon foreground, and splash image are generated and wired into `apps/mobile/app.json`.
- Mobile app asset generation is reproducible through `npm run generate:mobile-assets`.
- Static mobile generated-asset validation now checks app icon/splash, background, item, and dog/cat pet PNG dimensions, PNG format, species mapping, runtime registry coverage, and rejects stale unregistered generated PNGs through `npm run validate:mobile-assets`.
- Static mobile visual-asset quality validation now checks generated backgrounds, item icons, and pet sprites for color richness, alpha/cutout structure, coverage, and centering so placeholder-like PNGs cannot silently replace the reference-driven assets.
- Static mobile visual-direction validation is guarded by `npm run validate:mobile-visual-direction`, keeping raster-backed scene framing, glossy/tactile game controls, garden/reveal/hatching scene modes, and dome-as-optional copy contracts aligned with the cozy casual game direction.
- Generated mobile art review is backed by `docs/qa-screenshots/mobile-generated-assets-contact-sheet.png`, generated with `npm run generate:mobile-asset-contact-sheet` and kept current by `npm run validate:mobile-asset-contact-sheet`.
- Static mobile flow validation now checks route files and core CTA contracts for Welcome -> Photo upload -> Pet setup -> Hatching -> Reveal -> Terrarium -> Chat/Shop/Walk reward through `npm run validate:mobile-flow`.
- Static mobile copy validation now keeps developer-facing implementation, build, configuration, and release-process terms out of user-visible screen strings through `npm run validate:mobile-copy`.
- Bundled sample generated-pet PNG assets are generated for idle, base, happy, sleep, play, hungry, walk-return, treat-reaction, chat-portrait, curious, celebrate, garden-help, and seasonal states, registered by asset id, and used as fallback art when no renderable remote asset URL is available.
- Bundled generated-pet PNG assets now include species-aware dog and cat fallback sprite sets for the core first-pass and later reaction/seasonal states.
- Terrarium and premium chat art now select the pet asset that best matches the current reaction category/animation, and API-backed generation keeps the accepted asset set plus signed-read URL cache for those states.
- Android microphone permission is explicitly blocked because the camera flow captures still pet photos only.
- Large iOS simulator terrarium screenshot with bundled generated-pet asset captured at `docs/qa-screenshots/ios-iphone-16-pro-terrarium-generated-asset.png`.
- Shared mobile API mapper contracts prepare create-pet, source-photo validation, signed upload URL, upload method/header, generation job, accept-job, and care-action request payloads without introducing service secrets.
- Mobile app now has a provider-neutral production API fetch client boundary with public base URL validation, session-token resolution, auth-token injection, JSON serialization, safe retryable error mapping, and typed upload/generation/care/chat endpoint methods.
- Mobile runtime now has an optional API-backed daily loop mode for local/integration builds: configured API base URLs load pet/care/inventory/catalog state and route care actions, walk start, reward claim, and inventory placement through the API client while local prototype remains the default non-production fallback.
- Mobile runtime now has an optional API-backed first-session generation mode for local/integration builds: configured API base URLs create pet profiles, issue signed upload metadata, upload source-photo bytes to HTTP(S) signed URLs, complete upload metadata, create/poll generation jobs, and accept generated assets through the API boundary. Production release-config validation now requires `EXPO_PUBLIC_TINY_PET_API_BASE_URL` so release builds cannot silently ship in local prototype mode.
- Mobile premium chat now uses a tested API session boundary in integration builds when a server-owned `premium_chat` entitlement is active, creating a disclosure-accepted conversation and sending moderated messages to the backend-only provider path.
- Mobile shop now renders the server-owned commerce product catalog and active entitlement state in API-backed integration builds, and has a native `expo-iap` checkout gateway that is disabled unless `EXPO_PUBLIC_TINY_PET_ENABLE_NATIVE_CHECKOUT=true`.
- Mobile API-backed presentation now fails closed for catalog and entitlement display: if the server catalog or entitlement read has not loaded, the app shows empty API-backed lists instead of falling back to local mock items or mock entitlements.
- Mobile API integration now resolves tokens through a tested session-token boundary instead of wiring the mock token directly into API client factories; the development fallback remains non-production metadata.
- Mobile API session tokens now default to Expo SecureStore on iOS/Android, using a non-migrating device keychain accessibility setting and a tested legacy AsyncStorage migration path.
- Mobile API session tokens now support a tested provider-neutral expiry/refresh hook, so API-backed builds can refresh expiring provider tokens before private upload/generation requests and clear stale tokens when refresh fails.
- Production release-config validation now rejects development auth fallback and public mock auth tokens so provider-less API builds cannot accidentally ship with `user_demo_001`.
- API router and Node server mounts can disable default mock auth headers with `allowMockAuth: false`, and production release-config validation requires `TINY_PET_API_ALLOW_MOCK_AUTH=false`.
- API Node runtime now exposes a tested async `ApiSessionVerifier` injection point so real provider/JWKS token verification can be mounted server-side without putting auth secrets in the mobile app.
- API server now includes a tested RS256 JWT/JWKS session verifier adapter and runtime-config path with issuer, audience, expiry, not-before, key id, and signature checks for production auth provider wiring.
- API service, router, and Node server mounts can disable mock purchase verification with `allowMockPurchaseVerification: false`, and production release-config validation requires `TINY_PET_API_ALLOW_MOCK_PURCHASES=false`.
- API server now exposes a server-only async `StorePurchaseVerifier` injection point, a tested HTTP store verification adapter, and tested direct App Store Server API / Google Play Developer API adapters with runtime-config paths, so purchase verification can be mounted without putting payment secrets or raw provider responses in mobile code; direct App Store runtime config verifies `signedTransactionInfo` JWS payloads with the trusted x5c/ES256 verifier before trusting purchase responses, and purchase/restore requests can carry request-scoped `storeVerificationToken` values that are passed to the verifier but excluded from ledgers, analytics, and verifier telemetry.
- Production release-config validation now requires either `TINY_PET_STORE_VERIFIER_ENDPOINT` plus `TINY_PET_STORE_VERIFIER_API_KEY`, or `TINY_PET_STORE_VERIFIER_PROVIDER=direct` with `TINY_PET_APP_STORE_BUNDLE_ID`, `TINY_PET_APP_STORE_ISSUER_ID`, `TINY_PET_APP_STORE_KEY_ID`, `TINY_PET_APP_STORE_PRIVATE_KEY`, `TINY_PET_APP_STORE_NOTIFICATION_ROOT_CERT_SHA256`, `TINY_PET_GOOGLE_PLAY_PACKAGE_NAME`, `TINY_PET_GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL`, `TINY_PET_GOOGLE_PLAY_PRIVATE_KEY`, and `TINY_PET_GOOGLE_PLAY_SUBSCRIPTION_PRODUCT_IDS` for server-side purchase verification. Direct verifier bundle/package env must match `expo.ios.bundleIdentifier` and `expo.android.package`.
- API service, router, and Node server mounts can disable mock storage signing with `allowMockStorageSigning: false`, and production release-config validation requires `TINY_PET_API_ALLOW_MOCK_STORAGE=false`.
- Postgres API generation polling can now disable mock auto-progression with `allowMockGenerationPolling: false`, and production release-config validation requires `TINY_PET_API_ALLOW_MOCK_GENERATION_POLLING=false` so hatching polls wait for worker-owned status/completion.
- API server now exposes a server-only async `PrivateStorageSigner` injection point for original-photo upload URLs and generated-asset read URLs without putting storage credentials in mobile code.
- API now includes a tested S3-compatible private storage signer and runtime-config parser for short-lived original-photo upload URLs, generated-asset read URLs, and internal `s3://` storage URI persistence.
- API mock service now exports/imports tested full-state snapshots, with a JSON file snapshot store for local/runtime restoration during integration QA.
- API now includes Postgres SQL migrations and a tested migration runner boundary for API-owned users, pets, photos, generation jobs, generated assets, category-only generation issue reports, care state, reaction catalog versions, inventory, walks, conversations, entitlements, purchase ledger, privacy deletion jobs, and outbox events.
- API now includes a tested snapshot-to-Postgres repository boundary that writes mock-service snapshots through ordered, parameterized SQL; request-scoped repositories are now bundled for production request-service wiring before replacing the mock service.
- Production release-config validation now also requires `TINY_PET_AUTH_ISSUER`, `TINY_PET_AUTH_AUDIENCE`, and `TINY_PET_AUTH_JWKS_URL`, requires `TINY_PET_DATABASE_URL` to point at a non-placeholder Postgres URL, and rejects disabled DB SSL mode.
- API now includes a tested `pg` Pool-backed database client adapter for the shared migration/bootstrap `query()` boundary.
- API now includes the first request-scoped Postgres repository slice for API users, current-user onboarding state, and pet profile list/read/upsert/soft-delete.
- API now includes a request-scoped Postgres repository slice for original-photo metadata, generation jobs, worker-safe generation job claiming/status transitions, generated asset metadata with ownership-filtered reads, and category-only generation issue reports.
- API now includes a request-scoped Postgres repository slice for care state, item catalog rows, active reaction catalog versions, inventory items/placements, walk sessions, and recent reaction history.
- API now includes a request-scoped Postgres repository slice for premium chat conversations, message thread reads/writes, conversation soft-delete, and full chat-history deletion.
- API now includes a request-scoped Postgres repository slice for commerce entitlements, active entitlement checks, purchase ledger upserts, restore lookups, and revocation state.
- API now includes a request-scoped Postgres repository slice for privacy deletion job queueing, claiming, completion, failure, retry, and user-scoped reads.
- API now includes a request-scoped Postgres outbox repository for sanitized audit/operational events.
- API now includes a tested Postgres repository bundle that composes user/pet, generation, daily-loop, chat, commerce, privacy, and outbox repositories on the shared database client.
- API now includes a tested async-only Postgres-backed API service slice for current-user, pet profile, source-photo upload metadata, upload completion, generation job create/read/poll, durable mock generation completion/failure/retry, production blocking for mock poll auto-completion, worker-supplied private generated asset completion metadata, generated asset listing/read URL, generation accept/activate, category-only generation issue reports, item catalog, active versioned reaction catalog, inventory and inventory placement, care state/action, walk start/reward claim, commerce product/entitlement/purchase verification/restore, premium chat conversation/message/thread/delete, and privacy original-photo/chat-history/pet deletion request HTTP routes; unmounted database-backed routes fail closed with 503 instead of falling back to mock state.
- API now includes a tested Postgres Node server factory that mounts the async Postgres API service on the Node HTTP adapter instead of the default mock service, plus a runtime-config composer for database client, JWT verifier, S3 signer, store verifier, OpenAI premium chat provider, and operational logger mounting.
- API now includes a tested privacy deletion worker runner, scheduler-friendly privacy deletion process runner, Postgres deletion processor, S3-compatible object deleter, privacy deletion outbox audit sink, and runtime-env deployment composer that wires API DB/storage config, parses `TINY_PET_PRIVACY_WORKER_PROCESS_MODE`, `TINY_PET_PRIVACY_WORKER_POLL_INTERVAL_MS`, `TINY_PET_PRIVACY_WORKER_MAX_RUNS`, and stop flags, records completed/failed deletion audit events without blocking deletion state, runs the process, and closes owned database resources.
- API now includes a tested outbox worker runner, scheduler-friendly process runner, operational-logger sink, and runtime-env deployment composer that wires the Postgres outbox repository, parses `TINY_PET_OUTBOX_WORKER_PROCESS_MODE`, `TINY_PET_OUTBOX_WORKER_POLL_INTERVAL_MS`, `TINY_PET_OUTBOX_WORKER_MAX_RUNS`, and stop flags, emits sanitized domain audit events, and marks processed/failed delivery state.
- Mobile source-photo upload now has a tested signed upload transport with SHA-256 content hashing, upload method/header support, local byte-size mismatch checks, and a mock-signed-upload skip path for local adapters.
- Mobile generated-pet rendering now resolves app-private signed read URLs in API-backed builds, caches renderable HTTP(S) asset URLs for accepted generated asset states, selects reaction-appropriate pet art, and falls back to bundled sample PNGs for local mock-signed-read URLs.
- Privacy, Terms, and Support screens now read public release config for final URLs/email, and production release config validation fails if those values are missing or placeholder.
- API service boundary now has tested auth checks, current-user onboarding state, pet list/create/update/delete, pet/photo/job ownership guards, private mock signed upload URL issuance, source-photo type/size validation, upload completion hash validation, generation-job creation preconditions, and original-photo metadata deletion.
- API service boundary now has tested premium chat entitlement enforcement, AI disclosure requirement, input moderation, provider-output moderation with localized crisis/professional-advice fallback copy, conversation thread read/delete ownership checks, backend-only provider injection with retention-filtered capped recent conversation history, local provider fallback, configurable server-side turn rate and retention-window policy, OpenAI Responses structured output parsing, and safe history/provider/output failure handling before message storage.
- API service boundary now has tested privacy deletion flows for original photo metadata, premium chat conversations/messages, and pet records without exposing private assets to mobile.
- API service boundary now has tested commerce entitlement ledger behavior for mock server-verified purchases, idempotent grants, restore purchases, transaction reuse protection, and refund/revocation handling, with a server-only purchase revocation webhook route guarded by a commerce webhook secret.
- API service and mobile client now expose tested server-owned commerce product, current-user entitlement, purchase verification, and restore contracts before store account/product rollout; server-side commerce webhook revocation is intentionally not exposed to mobile.
- API service boundary now has tested generation job read, mock poll/progression, mock completion, generated asset listing, accept/activate, quality failure, and retry behavior without exposing provider calls to mobile.
- API service and mobile client now have a tested app-private generated asset signed-read URL contract with ownership checks, short mock expiry, and mobile renderability filtering.
- API service now exposes a tested framework-neutral HTTP router for `/v1` mobile routes, including default bearer/mock auth resolution, a production-style mock-auth disable option, and safe 404/422 error shapes.
- API service and mobile client now cover tested daily loop contracts for item catalog, active versioned reaction catalog, inventory, inventory placement, care state, care actions, walk start, walk return gating, and one-time reward claim.
- API router is now mounted by a tested Node HTTP adapter with JSON parsing, body-size limits, method allowlisting, optional CORS allowlisting, optional per-client rate limiting with a default in-memory store or an injected shared production store, a tested Postgres shared rate-limit store that runtime deployments mount automatically when API rate-limit env is set, hashed default rate-limit keys that avoid raw bearer-token storage, unauthenticated `/healthz` and `/readyz` probes, safe structured request logging without headers/query/body, safe operational logger adapters, and loopback integration coverage.
- AI worker boundary now has tested JPEG/PNG/WebP magic-byte validation, header dimension parsing/limits, container integrity checks for JPEG EOI and scan payload structure, PNG chunk CRC/IDAT/IEND structure, PNG IDAT raster inflate/scanline validation, WebP RIFF bounds and image chunk presence, declared content-type mismatch rejection, safe unreadable-file errors, size checks, and JPEG APP1 EXIF stripping before provider-safe bytes are prepared.
- AI worker source-photo intake now runs Sharp-backed full pixel decode validation for JPEG, PNG, and WebP bytes in the async worker path, so structurally plausible but undecodable payloads fail before provider input.
- AI worker boundary now has a tested source-photo safety precheck contract that runs before provider generation, preserves unsafe/manual-review quality metadata, can wrap an injected provider classifier, fails closed if that classifier is unavailable, defaults to a local provider-safe-byte sanity checker, and now includes a tested OpenAI Responses vision classifier with structured JSON parsing and manual-review refusal handling for production mounting.
- AI worker boundary now has a tested structured generation quality gate for required asset states, species match, one-pet visibility signals, safety approval, style match, provider confidence, runtime-configurable thresholds, and manual review routing.
- AI worker boundary now has a tested OpenAI generation quality signal evaluator for generated assets, using Responses vision input, structured JSON output, source-photo comparison prompts, refusal-to-manual-review mapping, and trusted worker asset metadata passthrough into the quality gate.
- AI worker runtime now normalizes generated-asset metadata before persistence, validating provider/storage asset id, state, dimensions, MIME type, version, hash format, and internal `s3://` storage URI so unsafe provider or storage metadata fails before database writes.
- AI worker runtime now has a tested one-job execution path, a batch runner that can process up to `maxJobs` per scheduled run, and runtime composition helpers that build S3 worker storage plus OpenAI image edit/source-photo safety/generation quality adapters from validated config while injected repository dependencies stay outside the mobile app; the runner stops on idle queue drain, can optionally stop after a failed job, validates source photos, calls the provider adapter, applies runtime-configured quality thresholds, writes generated assets through storage, and persists completed/failed job state through the repository contract.
- AI worker runtime config now requires an explicit production worker batch cap, explicit worker model, calibrated quality threshold env vars, and a quality calibration id for production generation, and release-config validation rejects missing or invalid production batch/model/threshold/calibration values.
- AI worker now has a tested scheduler-friendly process runner for single-run or interval-polling deployments, and the API package exposes a tested OpenAI/Postgres generation worker runtime-env composer that validates worker env, wires the Postgres generation repository bundle, parses `TINY_PET_WORKER_PROCESS_MODE`, `TINY_PET_WORKER_POLL_INTERVAL_MS`, `TINY_PET_WORKER_MAX_RUNS`, and stop flags, runs the process, and closes owned database resources.
- AI worker now includes a tested S3-compatible private storage adapter for reading internal original-photo `s3://` URIs, writing generated asset bytes by state, and returning internal `s3://` asset URIs with `sha256:` hashes.
- AI worker now includes a tested OpenAI image edit provider adapter for `/images/edits`, using worker-only API keys, multipart source-photo uploads, base64 image response decoding, generated-asset dimension/hash recording, and injected quality-signal evaluation.
- AI worker now includes a tested OpenAI source-photo safety classifier adapter for `/responses`, using data-URL vision input, worker-only API keys, runtime `safetyModel` selection, structured JSON output, and safe refusal/provider-error handling before generation starts.
- AI worker now includes a tested OpenAI generation quality evaluator adapter for `/responses`, using source and generated asset data-URL vision inputs, runtime model selection, structured species/pet-count/style/safety/confidence signals, and safe provider-error handling after image generation.
- API premium chat now has a tested backend-only OpenAI Responses provider adapter with structured JSON output, refusal fallback, safe provider-unavailable errors, runtime config parsing, production release validation for `TINY_PET_PREMIUM_CHAT_OPENAI_API_KEY` or `OPENAI_API_KEY`, explicit `TINY_PET_PREMIUM_CHAT_OPENAI_MODEL`, and explicit production `TINY_PET_PREMIUM_CHAT_RATE_LIMIT_MAX_MESSAGES`, `TINY_PET_PREMIUM_CHAT_RATE_LIMIT_WINDOW_MS`, `TINY_PET_PREMIUM_CHAT_CONTEXT_MESSAGE_LIMIT`, and `TINY_PET_PREMIUM_CHAT_RETENTION_WINDOW_MS`.
- API runtime now has a tested JSON-line operational logger that redacts secrets, tokens, receipt data, storage/photo URIs, raw prompts, and message text, plus adapters for API request logs, premium-chat provider monitor events, store verifier logs, and generation/privacy/chat-retention worker telemetry.
- API runtime now has a tested Postgres server process starter that reads `TINY_PET_API_*` listen/CORS/body/rate-limit env, starts the runtime-configured Postgres Node server, emits safe start/stop/request logs, and closes owned database resources on shutdown.
- API runtime now exposes tested `start:*` commands for the Postgres API server, generation worker, privacy deletion worker, outbox worker, and chat-retention worker, with runtime env parsing, safe operational logging, worker failure exit codes, and shutdown signal wiring.
- API commerce webhooks now include a tested `/v1/commerce/store-webhooks` ingress for raw App Store Server Notification v2 and Google Play RTDN payloads. The router still requires `TINY_PET_COMMERCE_WEBHOOK_SECRET`, structurally validates App Store compact JWS payloads by requiring supported ES256 protected headers plus payload/signature segments before decoding, cryptographically verifies direct App Store notification/transaction JWS payloads with the `x5c certificate chain` and trusted SHA-256 root certificate fingerprint when direct runtime config is mounted, maps App Store refund/revoke notifications to transaction revokes, maps Google Play revocations to receipt-hash revokes by hashing the purchase token, ignores non-revocation store events with 202, emits safe `commerce_store_webhook_processed`, `commerce_store_webhook_ignored`, and `commerce_store_webhook_rejected` operational events without transaction ids, receipt hashes, purchase tokens, or raw payloads, enqueues sanitized `commerce.purchase_revoked` outbox audit events with hashed `commerce_purchase` aggregate ids, and `createPostgresApiNodeServerFromRuntimeConfig` now passes the commerce webhook secret plus direct App Store bundle / Google Play package checks into the async router.
- Hatching screen now advances through a tested generation-job polling boundary with scheduled polling, manual reduce-motion polling, terminal state handling, and progress snapshots.
- Hatching screen no longer exposes the developer-only failure preview CTA in production-facing UI; generation failures still render the retry path when the session/API status is failed.
- Pet reveal Try again now calls the generation retry action before routing back to hatching, so the retry CTA restarts generation instead of reopening a completed job.
- Pet reveal now routes Report issue to Support, and Support saves safe category-only generation issue reports locally plus through the API/Postgres path in API-backed builds without attaching raw photos or chat text.
- Mobile generation UI now has a tested reduced-motion policy that disables scheduled hatching polling, shows manual continue only during active generation, and hides progression controls for terminal generation states.
- Reference-driven art direction is implemented as decomposed React Native scene composition plus bundled background/item PNG assets; reference/mockup screen crops are not used as UI.
- First-session screens now share a native progress HUD for Welcome, Photo, Setup, Hatch, and Reveal, with unit coverage for the ordered step presentation and static route/CTA validation for screen coverage.
- Store screenshot QA builds can use `EXPO_PUBLIC_TINY_PET_STORE_SCREENSHOT_PRESET` to boot into deterministic Welcome, Photo upload, Pet setup, Hatching, Pet reveal, Terrarium, Chat, Shop, and Walk reward states without overwriting the user's stored local session; production release-config validation rejects the env var.
- QA-only screen presets can use `EXPO_PUBLIC_TINY_PET_QA_SCREEN_PRESET=settings-privacy-error` or `settings-privacy-progress` to capture Settings privacy error/progress evidence without mixing those states into store screenshots; production release-config validation rejects the env var.
- iOS development-client readiness is now guarded by `npm run validate:ios-dev-client-readiness`, with the EAS development profile set for simulator builds, `expo-dev-client` installed, generated iOS workspace and Pod lock present, and the iOS store capture script able to open the development-client URL so final iOS screenshots can move off Expo Go.
- The iOS development-client local build/install path has run successfully on the iPhone 16 Pro simulator through `npm run ios:dev-client:build` after `npx expo prebuild --platform ios --npm` and `npm run ios:pods`; iPhone 16 Pro store screenshots have been recaptured from the installed development client without Expo Go or dev tools overlays.
- Decorative scene image fragments are hidden from screen-reader traversal while meaningful product, inventory, pet, and CTA images keep labels, reducing VoiceOver/TalkBack noise before the required manual pass.
- Primary screen titles now expose `accessibilityRole="header"` across the native flow so VoiceOver users can orient before main content.
- App Store privacy label and Google Play Data safety draft now exists in `docs/store-privacy-data-safety.md`, based on current mobile permissions, API contracts, safe analytics, operational log redaction, and server-side provider boundaries.
- Privacy SDK boundary coverage is guarded by `npm run validate:privacy-sdk-boundaries`, which scans package manifests, `package-lock.json`, and app/server source entry points for unapproved crash, diagnostics, tracking, advertising, and third-party analytics SDKs before store privacy answers drift.
- App Store and Google Play listing copy now exists in `docs/store-listing-draft.md`, including listing fields, review notes, release notes, and screenshot captions for the first native store package.
- Store screenshot submission manifest now exists in `docs/store-screenshot-manifest.json`, binding each deterministic preset to its native route, capture label, and store caption.
- Photo upload fallback and sample states now render bundled generated-pet PNG art instead of shape-only placeholder portraits.
- Pet setup art now includes a compact profile summary ribbon for the current name, species, trait count, and talking style, backed by unit-tested presentation labels.
- Pet setup now places the Continue CTA immediately after the required name/species controls, keeping the primary next step visible in the iPhone 16 Pro store screenshot without overlaying optional setup controls.
- Local prototype reactions and reveal copy now default to English for the English mobile/store surface; Korean reaction catalog entries remain available for locale-specific API/shared paths.
- Inventory rows now render decomposed bundled item PNGs from the same asset set used by the terrarium/shop scene instead of placeholder shape blocks.
- Inventory rows now expose API-backed/local Place/Remove controls for owned items, with shared session and API/Postgres coverage for updating the terrarium `placedItems` layout.
- Home, premium chat, shared screen framing, inventory, settings, legal/support, and shop pages now use the imagegen-derived `pixel-garden-premium-v1.png` scene as the page background, while `ShopShelfArt` uses `shop-room-square-premium-v1.png` only for the collectible shelf illustration.
- Local shop preview now renders shared catalog items instead of separate hardcoded preview packs, with catalog ids mapped to bundled item PNG assets and guarded by `npm run validate:mobile-assets`.
- Local shop preview now differentiates inventory-owned catalog items from locked reward/shop items, with unit coverage for the presentation state.
- Local shop preview now includes a Plus pass destination card above the catalog rows, using server product/entitlement state in API-backed builds and a user-facing Plus locked state in local builds.
- Local shop preview now includes an icon-led summary HUD for owned items, locked catalog entries, and Plus pass state, with unit coverage for local and server catalog summary data.
- Walk reward claim now leaves a first-viewport reward summary card driven by the claimed walk `rewardItemIds`, with the claimed item PNG, owned quantity, and direct Inventory/Shop CTAs; the route/CTA contract is covered by `npm run validate:mobile-flow`.
- Locked premium chat now exposes a native Plus pass CTA that routes directly to the shop, and the route/CTA contract is covered by `npm run validate:mobile-flow`.
- iOS simulator design QA screenshots are captured for the refreshed terrarium, chat, and shop screens:
  - `docs/qa-screenshots/ios-iphone-16-pro-terrarium-design-ref.png`
  - `docs/qa-screenshots/ios-iphone-16-pro-chat-design-ref.png`
  - `docs/qa-screenshots/ios-iphone-16-pro-shop-design-ref.png`
- iOS simulator photo-upload screenshot confirms the upload guide art and sample card use bundled generated-pet PNG assets:
  - `docs/qa-screenshots/ios-iphone-16-pro-photo-upload-pet-asset.png`
- iOS simulator screenshots confirm the refined generated-pet sprite renders in photo upload and terrarium scenes:
  - `docs/qa-screenshots/ios-iphone-16-pro-photo-upload-refined-pet.png`
  - `docs/qa-screenshots/ios-iphone-16-pro-terrarium-refined-pet.png`
- iOS simulator pet-setup screenshot confirms the native setup preview uses bundled generated-pet PNG art:
  - `docs/qa-screenshots/ios-iphone-16-pro-pet-setup-species-preview.png`
- iOS simulator pet-setup screenshot confirms the profile summary ribbon renders without text overflow:
  - `docs/qa-screenshots/ios-iphone-16-pro-pet-setup-profile-ribbon.png`
- iOS simulator hatching screenshot confirms the production-facing hatching UI no longer shows the old developer failure-preview CTA:
  - `docs/qa-screenshots/ios-iphone-16-pro-generation-no-dev-failure-cta.png`
- iOS simulator hatching screenshot confirms generation status copy is user-facing instead of worker/job terminology:
  - `docs/qa-screenshots/ios-iphone-16-pro-hatching-friendly-status-final.png`
- iOS simulator first-session screenshots confirm the progress HUD renders on Photo, Hatching, and Reveal without hiding primary CTAs:
  - `docs/qa-screenshots/ios-iphone-16-pro-photo-first-session-progress.png`
  - `docs/qa-screenshots/ios-iphone-16-pro-hatching-first-session-progress.png`
  - `docs/qa-screenshots/ios-iphone-16-pro-reveal-first-session-progress.png`
- iOS simulator photo-upload screenshot confirms the visual layout is unchanged after decorative scene image accessibility cleanup:
  - `docs/qa-screenshots/ios-iphone-16-pro-photo-decorative-a11y.png`
- iOS simulator pet reveal screenshot confirms Enter terrarium and Try again stay visible after the retry action pass:
  - `docs/qa-screenshots/ios-iphone-16-pro-reveal-retry-action.png`
- iOS simulator pet reveal screenshot confirms the generated cozy garden scene renders in the actual app instead of the older flatter placeholder scene:
  - `docs/qa-screenshots/ios-iphone-16-pro-store-pet-reveal.png`
- iOS simulator screenshots confirm Pet reveal exposes the Report issue CTA and Support renders safe generation issue report controls:
  - `docs/qa-screenshots/ios-iphone-16-pro-reveal-report-issue-cta.png`
  - `docs/qa-screenshots/ios-iphone-16-pro-support-report-controls-final.png`
- iOS simulator inventory screenshot confirms owned item Place/Remove controls render alongside decomposed item PNGs:
  - `docs/qa-screenshots/ios-iphone-16-pro-inventory-placement-actions.png`
- iOS simulator shop screenshot confirms local shop rows render shared catalog items with bundled item PNG icons:
  - `docs/qa-screenshots/ios-iphone-16-pro-shop-expanded-catalog.png`
- iOS simulator shop screenshot confirms local shop owned-state rendering:
  - `docs/qa-screenshots/ios-iphone-16-pro-shop-owned-catalog.png`
- iOS simulator chat screenshot confirms the locked premium chat state exposes a visible Plus pass CTA that routes to shop:
  - `docs/qa-screenshots/ios-iphone-16-pro-chat-plus-shop-cta.png`
- iOS simulator chat screenshot confirms the refined premium bond art renders decomposed garden/pet/gift/item/bond-meter assets without a full-screen mockup crop:
  - `docs/qa-screenshots/ios-iphone-16-pro-chat-premium-bond-art.png`
- iOS simulator shop screenshot confirms the Plus pass destination card renders in the local Plus locked state:
  - `docs/qa-screenshots/ios-iphone-16-pro-shop-plus-pass-destination.png`
- iOS simulator shop screenshot confirms the summary HUD renders owned, locked, and Plus pass state without text overflow:
  - `docs/qa-screenshots/ios-iphone-16-pro-shop-summary-hud.png`
- iOS simulator terrarium screenshot confirms the claimed walk reward summary stays visible before the care controls:
  - `docs/qa-screenshots/ios-iphone-16-pro-walk-reward-claimed-summary.png`
- Mobile device screenshot QA can now be captured through `npm run qa:mobile-screenshots`, which saves validated PNG evidence for booted iOS simulators and connected Android emulator/device screens.
- Android large and small-viewport onboarding QA screenshots are captured, and the onboarding layout now uses a compact mode so the primary CTA remains visible on 720x1280 Android viewports.
- iPhone 16e small-device development-client welcome screenshot is captured without Expo Go/dev tools overlays, with the primary CTA visible in the first viewport.
- Safe analytics event contract that rejects sensitive payload keys such as photo URI, raw message text, secrets, tokens, payment data, and receipt data.
- Privacy SDK boundary validation for unapproved crash, diagnostics, tracking, advertising, and third-party analytics SDK additions.
- EAS build profiles for development, preview, and production.

## 출시 전 남은 체크리스트 (2026-07-08)

핵심 훅("한 마리라도 되는가")은 검증 가능한 상태. 실제 출시를 막는 급소는 아래로 좁혀졌다. (하단의 "Still Required Before Closed Test / Public Launch"는 2026-07-03 mock 서버 프로토타입 시점 목록으로 과정 보존용이며, 현 백엔드 Supabase 정착으로 상당수 대체됨.)

- **크레딧 IAP SKU (매출 급소)** — 현 코드에 크레딧 구매 SKU 없음(구독 `premium_chat_monthly`만). 소비처(표정팩·재생성)는 있는데 버는 곳·사는 곳이 없어 크레딧 경제 데드엔드. RevenueCat으로 배선(영수증 검증·환불 웹훅·크로스플랫폼 대행 → 직접 verify-purchase 불필요). 팩 카탈로그·상점 UI·grant 웹훅 Edge 선구축, RC 연결이 "결제 켜기" 최종 단계.
- **데일리 크레딧 파우셋** — 반복 크레딧 획득 경로 부재(무료 채팅 티켓만 하루 1회 리필). 검토 대상.
- **delete-account Edge Function** — `supabase/functions/delete-account` 진행 중. 서버 데이터 완전 삭제(스토리지+DB행+익명계정), Apple 계정삭제 요건·GDPR 삭제권 → 출시 필수. 완결 확인 필요.
- **Sentry 실연동** — ErrorBoundary + 로컬 리포터는 랜드, 실 연동은 후속 네이티브 재빌드 묶음.
- **세이프티 에스컬레이션 별도 검수** — 위기/전문 상담 폴백 카피는 있으나 자해 신호 전용 흐름·검수는 출시 전 필수.
- **산책 도감 아이콘** — 9종 OS 이모지 → 픽셀 아이콘 미착수.
- **cleanliness 상시 HUD** — Bath 액션·delta 칩·표정 연동은 됨, 상단 상시 게이지 미노출.
- **스토어/RevenueCat 셋업 (사장 액션)** — 스토어 상품 생성 + RC 대시보드 매핑.
- **인프라 마무리** — dev/prod Supabase 분리, free_limit 복원, 익명 로그인 rate-limit/CAPTCHA(사장 대시보드).

## Current Release Gates

Passing:

- Shared tests.
- Shared/API/worker typecheck.
- Mobile typecheck.
- Static mobile generated-asset validation for app icon/splash, background, item, expanded dog/cat pet PNG coverage, and stale unregistered generated PNG rejection.
- Static mobile visual-asset quality validation for generated PNG richness, cutout alpha, and subject centering.
- Static mobile visual-direction validation for raster-backed scene framing, glossy/tactile controls, garden/reveal/hatching scene modes, and dome-as-optional copy.
- Static mobile flow validation for the first-session route/CTA contract and terrarium chat/shop/walk reward paths.
- Static mobile accessibility validation for Pressable, TextInput, Image, ImageBackground, progressbar, checkbox, hidden decorative image usage, and primary screen title header roles.
- Static mobile copy validation for user-visible screen strings.
- Static product-direction validation keeps the current native iOS/Android flow, decomposed reference-art rule, production external dependency boundary, Android evidence boundary, and final release gates documented.
- Static iOS manual QA checklist validation for intermediate VoiceOver, Reduce Motion, text/layout, photo consent, privacy, first-session, terrarium, chat, walk reward, shop, and store screenshot evidence tracking.
- Static iOS reduced-motion evidence validation for captured simulator PNGs covering hatching, pet reveal, terrarium, chat, and shop.
- Static iOS settings privacy evidence validation for captured simulator PNGs covering both privacy failure and in-progress status notices.
- Static iOS development-client readiness validation for the Expo Go-free simulator QA path.
- Static store compliance documentation validation for privacy-label and data-safety coverage.
- Static store listing documentation validation for required store fields, short-field limits, and screenshot-caption coverage.
- Static store metadata alignment validation for app config name/permissions/plugins, screenshot manifest captions, platform wording, privacy/data-safety claims, and listing copy.
- Static native store config validation for Expo app identity, iOS permission/encryption declarations, Android still-photo permissions, generated native assets, and EAS development/preview/production profile shape.
- Static store screenshot manifest validation for preset/route/caption alignment, with iOS-only screenshot coverage available through `npm run validate:ios-store-screenshots` and strict final PNG coverage available through `TINY_PET_REQUIRE_STORE_SCREENSHOTS=true`.
- iOS store screenshot capture automation now restarts Expo per preset, clears Metro transform cache, rejects React Native red error screenshots, rejects stale visually duplicated same-device preset captures, captures all deterministic iPhone 16 Pro `store-*` PNGs, and passes `npm run validate:ios-store-screenshots`.
- iOS store screenshot contact sheet generation now creates `docs/qa-screenshots/ios-iphone-16-pro-store-contact-sheet.png`, and preflight validates that it is present, valid, and current with the source screenshots.
- iOS-only screenshot freshness is guarded by `npm run validate:ios-final-screenshot-freshness` during intermediate passes, while final submission still uses `npm run validate:final-screenshot-freshness` after iOS/Android recapture.
- Reduced-motion hatching policy unit coverage through `npm test`.
- iOS reduced-motion simulator capture now creates `docs/qa-screenshots/ios-iphone-16-pro-reduce-motion-hatching.png`, `docs/qa-screenshots/ios-iphone-16-pro-reduce-motion-pet-reveal.png`, `docs/qa-screenshots/ios-iphone-16-pro-reduce-motion-terrarium.png`, `docs/qa-screenshots/ios-iphone-16-pro-reduce-motion-chat.png`, and `docs/qa-screenshots/ios-iphone-16-pro-reduce-motion-shop.png` after temporarily enabling the simulator Reduce Motion setting.
- iOS large-text simulator capture now creates a complete iPhone 16e `large-text-*` preset set plus `docs/qa-screenshots/ios-iphone-16e-large-text-store-contact-sheet.png` after temporarily setting iOS content size to `extra-large`.
- iOS development-client readiness, the AppleScript-free local simulator build/install script, and Expo Go-free iPhone 16 Pro development-client store screenshot capture pass.
- iPhone 16e small-device iOS visual QA without Expo Go overlays is captured for the welcome screen, with the primary CTA visible in the first viewport.
- Expo dependency compatibility check.
- Intermediate iOS preflight through `npm run validate:ios-preflight`, including iOS export validation.
- Android export validation currently passes via `npm run validate:android`; it remains a final release or Android-specific-change gate, not an intermediate-loop gate.
- Development release-config validation.
- Production release-config validation is runnable through `npm run validate:production-release-config`; without real production legal URL, auth/JWKS, Postgres, S3, store verifier, commerce webhook, OpenAI/provider, and worker values, this gate is expected to fail closed.
- Final cross-platform release validation is wired through `TINY_PET_FINAL_RELEASE_ALLOW_ANDROID=true npm run validate:final-release`, which runs iOS preflight, production release-config validation, strict iOS/Android store screenshot coverage, `npm run validate:final-screenshot-freshness`, Android store contact sheet validation, and Android export validation; intermediate iOS preflight only dry-runs this plan.
- Final Android store screenshot capture automation is wired through `npm run capture:android-store-screenshots`; current Android store PNGs and the contact sheet pass `npm run validate:android-store-contact-sheet`, and the capture should be rerun before the final Android pass when UI, art, build, or device inputs change.
- Final release runbook validation is wired through `npm run validate:final-release-runbook`; it statically checks the production handoff commands, required production env keys, VoiceOver/TalkBack evidence boundaries, and the rule that Android work stays out of the intermediate iOS loop.
- Production release-config validation now includes final legal/support config, required mobile API base URL, disabled mobile/API development auth, store screenshot preset blocking, storage, purchase, and generation-poll fallback checks, native checkout flag validation, production JWT/JWKS auth settings, production alert routing mode plus webhook sink validation when selected, production API/worker Postgres settings, required API rate-limit window/max-request env for the Postgres shared throttling path, optional API process listen/CORS/body env validation, optional auth/cache/pool/connect-timeout/storage-prefix/model env validation, S3-compatible private storage signing/worker settings, commerce webhook secret presence, direct store verifier bundle/package alignment with native app config, premium chat OpenAI secret/model plus explicit turn-limit/context/retention policy presence, worker generation provider secret/model presence, required worker max-jobs batch-cap validation, required production worker quality threshold plus calibration-id validation, required generation/privacy/outbox/chat-retention worker process modes, and optional worker scheduler interval/stop env validation.
- Production env example coverage is guarded by `npm run validate:env-examples`, keeping mobile public env keys and server-only API/worker/store/premium-chat env keys documented without embedding real secrets; the validator now scans the mobile/API/worker runtime config sources so newly read `TINY_PET_*` and `EXPO_PUBLIC_TINY_PET_*` env keys must be documented.
- Mobile secret-boundary coverage is guarded by `npm run validate:mobile-secret-boundaries`, which scans mobile app/config/env-example text for server-only `TINY_PET_*` env keys, unsupported `EXPO_PUBLIC_TINY_PET_*` keys, secret-shaped public env names, and real-looking API/private keys so provider keys remain backend/worker-only.
- API Node runtime now exposes tested liveness/readiness endpoints, and the Postgres Node server factory wires `/readyz` to a database ping without touching mock route state.
- API Postgres runtime now has a tested `createPostgresApiNodeServerFromRuntimeConfig` composer for runtime-config DB/JWT/S3/store/premium-chat/operational-logger mounting with injection overrides.
- API runtime commands now wrap the default JSON-line operational logger with a tested alerting policy that emits sanitized `operational_alert_triggered` events for API 5xx responses, generation worker failures/failed batches, store purchase verifier failures, commerce store webhook rejections, privacy deletion failures, outbox delivery failures, premium chat provider failures, runtime command failures, and cost spikes. Runtime alert routing can stay on `TINY_PET_OPERATIONAL_ALERT_ROUTING=json_logs` for infrastructure log sinks or use `webhook` with `TINY_PET_OPERATIONAL_ALERT_WEBHOOK_URL` and `TINY_PET_OPERATIONAL_ALERT_WEBHOOK_BEARER_TOKEN`; webhook delivery posts sanitized alert payloads and logs `operational_alert_delivery_failed` without blocking runtime work.
- API runtime command tests cover the deployable server/worker command boundary.
- Static DB migration validation.

Still Required Before Closed Test (2026-07-03 mock 서버 프로토타입 시점, 과정 보존 — 현 백엔드 Supabase 정착으로 상당수 대체. 실제 출시 기준은 상단 "출시 전 남은 체크리스트"):

- Replace bundled sample generated-pet assets with approved final generated art if needed; the dog/cat fallback set already includes later reaction/seasonal states, while production provider output expansion remains tied to calibrated generation quality thresholds.
- Replace local v1 plant stage art with approved final transparent PNGs from `docs/design/plant-stage-asset-manifest.json` if art direction changes, then pass `TINY_PET_REQUIRE_FINAL_PLANT_STAGE_ASSETS=true npm run validate:plant-stage-assets` before store screenshot recapture. After recapture, run `npm run validate:final-screenshot-freshness` so final screenshots are newer than the latest visual UI/art source.
- Provide final production env values for `EXPO_PUBLIC_TINY_PET_API_BASE_URL`, `EXPO_PUBLIC_TINY_PET_PRIVACY_URL`, `EXPO_PUBLIC_TINY_PET_TERMS_URL`, `EXPO_PUBLIC_TINY_PET_SUPPORT_EMAIL`, `TINY_PET_API_ALLOWED_ORIGINS`, `TINY_PET_API_MAX_BODY_BYTES`, `TINY_PET_API_RATE_LIMIT_WINDOW_MS`, `TINY_PET_API_RATE_LIMIT_MAX_REQUESTS`, `TINY_PET_API_SERVICE_NAME`, `TINY_PET_OPERATIONAL_ALERT_ROUTING`, webhook alert sink env when routing is `webhook` (`TINY_PET_OPERATIONAL_ALERT_WEBHOOK_URL`, `TINY_PET_OPERATIONAL_ALERT_WEBHOOK_BEARER_TOKEN`), `TINY_PET_AUTH_ISSUER`, `TINY_PET_AUTH_AUDIENCE`, `TINY_PET_AUTH_JWKS_URL`, `TINY_PET_DATABASE_URL`, `TINY_PET_STORAGE_BUCKET`, `TINY_PET_STORE_VERIFIER_PROVIDER`, `TINY_PET_STORE_VERIFIER_ENDPOINT`, `TINY_PET_STORE_VERIFIER_API_KEY`, direct verifier keys when using `direct` (`TINY_PET_APP_STORE_BUNDLE_ID`, `TINY_PET_APP_STORE_ISSUER_ID`, `TINY_PET_APP_STORE_KEY_ID`, `TINY_PET_APP_STORE_PRIVATE_KEY`, `TINY_PET_APP_STORE_NOTIFICATION_ROOT_CERT_SHA256`, `TINY_PET_GOOGLE_PLAY_PACKAGE_NAME`, `TINY_PET_GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL`, `TINY_PET_GOOGLE_PLAY_PRIVATE_KEY`, `TINY_PET_GOOGLE_PLAY_SUBSCRIPTION_PRODUCT_IDS`), `TINY_PET_COMMERCE_WEBHOOK_SECRET`, `TINY_PET_PREMIUM_CHAT_OPENAI_API_KEY`, `TINY_PET_PREMIUM_CHAT_OPENAI_MODEL`, `TINY_PET_PREMIUM_CHAT_RATE_LIMIT_MAX_MESSAGES`, `TINY_PET_PREMIUM_CHAT_RATE_LIMIT_WINDOW_MS`, `TINY_PET_PREMIUM_CHAT_CONTEXT_MESSAGE_LIMIT`, `TINY_PET_PREMIUM_CHAT_RETENTION_WINDOW_MS`, `TINY_PET_WORKER_PROVIDER_API_KEY`, `TINY_PET_WORKER_PROVIDER_MODEL`, `TINY_PET_WORKER_PROVIDER_SAFETY_MODEL`, `TINY_PET_WORKER_PROCESS_MODE`, `TINY_PET_WORKER_MAX_JOBS_PER_RUN`, `TINY_PET_WORKER_QUALITY_MIN_PET_VISIBILITY_CONFIDENCE`, `TINY_PET_WORKER_QUALITY_MIN_STYLE_MATCH_SCORE`, `TINY_PET_WORKER_QUALITY_MIN_PROVIDER_CONFIDENCE`, `TINY_PET_WORKER_QUALITY_CALIBRATION_ID`, `TINY_PET_PRIVACY_WORKER_PROCESS_MODE`, `TINY_PET_OUTBOX_WORKER_PROCESS_MODE`, and `TINY_PET_CHAT_RETENTION_WORKER_PROCESS_MODE`.
- Choose the production auth provider account and provide real `TINY_PET_AUTH_ISSUER`, `TINY_PET_AUTH_AUDIENCE`, and `TINY_PET_AUTH_JWKS_URL` values for the tested JWT/JWKS verifier; deploy the tested generation worker runtime-env composition with production worker DB/storage/provider/model env, `TINY_PET_WORKER_MAX_JOBS_PER_RUN`, scheduler process env, calibrated runtime quality threshold values, and bucket-scoped S3 worker storage config. The JSON snapshot store and snapshot-to-Postgres repository are local/integration bridges only.
- Deploy the tested Postgres API server process behind production infrastructure using `npm run start:api`, with probe wiring, operational logger shipping/retention, production auth settings, premium chat provider runtime config, secret management, and either edge-level distributed limits or the built-in Postgres shared API rate-limit store for multi-instance deployments.
- Provide real production S3-compatible bucket credentials, endpoint policy, and secret management for the tested API storage signer and worker storage adapter so API-backed builds render generated pet art from private storage instead of bundled fallback assets.
- Add deployed OpenAI source-photo safety and generation quality configuration plus production quality threshold value calibration, then set `TINY_PET_WORKER_QUALITY_CALIBRATION_ID` to the approved calibration record id.
- Mount the tested generation worker deployment in production scheduler infrastructure using `npm run start:generation-worker`, real provider/S3 credentials, and calibrated threshold values; production API config now blocks mock poll auto-completion, so worker status/completion must drive API-backed hatching.
- Mount the tested privacy deletion, outbox, and chat-retention worker runtime-env deployments in production scheduler infrastructure with `npm run start:privacy-worker`, `npm run start:outbox-worker`, `npm run start:chat-retention-worker`, worker process env, deployed alert routing for deletion audit/failure events, plus bucket lifecycle policy checks.
- Connect real production auth provider wiring to the tested mobile session refresh hook after persistence is mounted; production config and API router options already block the development fallback path.
- Wire either the production store verification gateway behind `TINY_PET_STORE_VERIFIER_ENDPOINT` or the direct Apple/Google verifier credentials behind `TINY_PET_STORE_VERIFIER_PROVIDER=direct` (`TINY_PET_APP_STORE_PRIVATE_KEY`, `TINY_PET_APP_STORE_NOTIFICATION_ROOT_CERT_SHA256`, `TINY_PET_GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL`, `TINY_PET_GOOGLE_PLAY_PRIVATE_KEY`, and explicit `TINY_PET_GOOGLE_PLAY_SUBSCRIPTION_PRODUCT_IDS`) before enabling checkout; also register App Store / Google Play refund and revocation notifications against the tested `/v1/commerce/store-webhooks` route and configure production monitoring for webhook failures plus `commerce.purchase_revoked` outbox delivery. Production config and API router options already block the mock purchase grant path, and the API contract already separates raw store verification tokens from stored receipt metadata.
- Run manual VoiceOver and any deeper iOS Reduce Motion edge-case checks through `docs/ios-manual-qa-checklist.md` after the static accessibility-label pass; hatching, pet reveal, terrarium, chat, and shop Reduce Motion paths now have automated iOS simulator evidence, while TalkBack and Android Reduce Motion evidence remain final Android manual completion checks.
- Set final `EXPO_PUBLIC_TINY_PET_PRIVACY_URL`, `EXPO_PUBLIC_TINY_PET_TERMS_URL`, and `EXPO_PUBLIC_TINY_PET_SUPPORT_EMAIL` for production release config validation.
- Replace generated placeholder icon/splash/item art with approved final brand/store art if needed; final plant stage PNG coverage is guarded by `TINY_PET_REQUIRE_FINAL_PLANT_STAGE_ASSETS=true npm run validate:plant-stage-assets`, and iPhone 16 Pro iOS development-client store preset screenshots plus the current Android store screenshot set must be recaptured when final art changes.

Still Required Before Public Launch (2026-07-03 mock 서버 프로토타입 시점, 과정 보존 — 실제 출시 기준은 상단 "출시 전 남은 체크리스트"):

- Production threshold calibration for provider-backed generation quality signals, including an approved `TINY_PET_WORKER_QUALITY_CALIBRATION_ID`.
- Provider keys only in backend/worker secrets; mobile secret-boundary validation now fails if server-only env keys or real-looking provider/storage/payment secrets appear in the mobile app surface.
- Deploy premium chat log/alert sinks and the chat retention purge scheduler; backend-only OpenAI gateway, operational-logger-backed safe provider monitor hook, output moderation fallback, context cap, server turn-rate policy, retention-window filtering, and bounded retention purge boundaries are already tested.
- Connect commerce ledger to real store account/product configuration, refund/revocation webhooks, and monitoring.
- Final App Store privacy labels and Google Play data safety form submission after provider/account/crash-analytics/encryption-at-rest choices are confirmed against `docs/store-privacy-data-safety.md` and `npm run validate:privacy-sdk-boundaries`.
- Deploy the selected `TINY_PET_OPERATIONAL_ALERT_ROUTING` path for tested `operational_alert_triggered` events covering generation failure rate, purchase verification, store webhook rejection, deletion failures, API errors, and cost spikes; webhook routing is implemented and validates the endpoint plus bearer token, while `json_logs` requires external log alert rules.
