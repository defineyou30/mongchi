# Native MVP Slice Status

Implemented from the current scaffold using the guide docs as source of truth:

- `02-ux-flow.md`: mocked first-session path now runs through splash, onboarding, pet setup, photo review/consent, hatching, reveal, terrarium, first care action, and first walk reward.
- `03-design-and-assets.md`: reference-driven art direction is implemented as decomposed React Native scene composition plus separate bundled v3 background/item PNG assets. Welcome, Photo upload, Pet setup, AI generation/hatching, Pet reveal, Main terrarium, AI chat/premium bond, Inventory, and Walk reward/shop now avoid full-screen reference/mockup crops.
- `07-content-and-reactions.md`: authored local reaction catalog now covers reveal, greetings, hungry, fed, garden, affection, play, treat, walk start, walk return, reward claim, and premium-chat teaser states.

## Product Behavior

- Session state persists locally with AsyncStorage.
- Native photo selection is available through Expo Image Picker; local prototype mode keeps selected images on device, while configured integration mode can use the signed upload boundary.
- First-session state, generation state, care state, inventory, walk status, deletion flags, and recent reactions are restored after app restart.
- Mock generation can complete, fail with safe copy, retry, or choose another photo.
- Walk starts as an idle send-and-return loop.
- A returned walk grants a starter reward item once claimed.
- All free reactions are authored/local. No AI call is made.
- Shop remains checkout-gated by default, but API-backed integration builds now render the server-owned commerce product catalog and active entitlement state, and custom builds can enable a native `expo-iap` checkout gateway with `EXPO_PUBLIC_TINY_PET_ENABLE_NATIVE_CHECKOUT=true`. Premium chat remains entitlement-gated; locked longer chat now routes to the shop Plus pass CTA, and API-backed integration builds can start a mock backend conversation and send moderated messages after a server-owned `premium_chat` entitlement is active.
- Privacy, terms, and support screens are reachable from settings.
- Support now includes safe generation issue report controls that store only a coarse category locally and through the API/Postgres path in API-backed builds, and Pet reveal links directly to that report path.
- Local delete-photo, delete-chat, and delete-pet-data actions require native confirmation.
- API-backed integration builds route original-photo, chat-history, and pet-data deletion through server ownership checks before clearing local state.
- Settings now surfaces privacy-action progress and safe failure copy for original-photo, chat-history, pet-data, restore, and checkout actions instead of exposing build/configuration wording to users.
- Restore purchases calls the API restore contract in API-backed builds and is a safe local no-op when store checkout is not enabled.
- Shared mobile API contract mappers are in place for future backend upload/generation/care integration.
- Mobile API client boundary is in place for future production routing, with public base URL validation, provider-neutral session-token resolution, injected auth token support, typed endpoint methods, and safe API/network error mapping.
- Mobile daily loop can run in an API-backed local/integration mode when a public API base URL is configured, syncing pet/care/inventory/catalog state and routing care, walk, reward, and inventory placement actions through the API client; default runtime remains local prototype mode outside production release config.
- Mobile first-session generation can run in an API-backed local/integration mode when a public API base URL is configured, creating pet/upload/generation records, uploading source-photo bytes for HTTP(S) signed URLs, polling mock generation, and accepting generated assets through the API client; default runtime remains local prototype mode outside production release config.
- API and AI worker boundaries have tested current-user/pet profile, upload metadata, ownership, generation lifecycle, premium chat OpenAI Responses provider injection, S3-compatible storage signing, worker storage read/write, generated-asset metadata normalization before persistence, magic-byte, header dimension, image container integrity, PNG IDAT raster scanline validation, JPEG/WebP encoded raster payload structure checks, Sharp-backed full source-photo pixel decode, size, JPEG EXIF stripping, source-photo safety precheck with provider classifier injection, structured generation quality-gate safeguards, tested OpenAI image edit, source-photo safety, and generation quality adapters, repository-backed one-job plus batch worker runtimes with OpenAI runtime adapter composition, a scheduler-friendly process runner, and an OpenAI/Postgres runtime-env deployment composer, without deployed provider credentials.
- API generation lifecycle now supports tested job read, mock poll/progression, mock completion, generated asset listing, generated asset signed-read URL issuance, accept/activate, quality failure, and retry behavior, with the Postgres-backed service persisting mock completion/failure/retry state, worker-supplied private generated asset metadata, and a production config path that disables mock poll auto-completion.
- API mobile route contracts now pass through a tested framework-neutral HTTP router and Node HTTP adapter for `/v1` requests, with safe auth, route, method, JSON, body-size, optional rate-limit error responses, an injected shared rate-limit store boundary for multi-instance deployments, a tested Postgres shared rate-limit store mounted by runtime deployments when API rate-limit env is set, hashed default rate-limit keys, and safe structured request log events.
- API Node runtime now exposes tested unauthenticated `/healthz` and `/readyz` probes, and the Postgres Node server factory maps readiness to a database ping rather than mock route state.
- API mock service state can now be exported/imported through a tested full-state snapshot, with a JSON file store available for local/runtime restoration during integration QA.
- API now has Postgres SQL migrations, a tested migration runner boundary, tested `pg` client adapter, tested current-user/pet profile Postgres repository, tested photo/generation/asset metadata and category-only generation issue report Postgres repository with worker-safe job claiming/status transitions, tested daily-loop Postgres repository for care/inventory/walk/active reaction catalog versions/recent reactions, tested premium chat conversation/message Postgres repository, tested commerce entitlement/purchase-ledger Postgres repository, tested privacy deletion job Postgres repository, tested sanitized outbox event repository, tested Postgres repository bundle, tested async-only current-user/pet-profile/source-photo/generation-job/generated-asset-read/accept/generation-issue-report/daily-loop/chat/commerce/privacy-deletion Postgres API service slice, tested Postgres Node server factory, tested runtime-config Postgres Node composer for DB/JWT/S3/store/premium-chat/operational-logger mounting, tested sanitized `operational_alert_triggered` policy and webhook fan-out sink for API/generation/purchase/deletion/outbox/premium-chat/cost alert categories, tested API server process env/listen/shutdown boundary, tested `start:*` runtime commands for the API server and worker processes, tested privacy deletion worker runner/process runner/runtime-env deployment composer with outbox-backed completion/failure audit events, tested API outbox worker runner/process/runtime-env deployment composer for sanitized audit delivery, tested Postgres privacy deletion processor, tested S3-compatible object deleter, and tested snapshot-to-Postgres repository plan for production-owned app state, privacy deletion jobs, commerce ledger uniqueness, reaction catalog versions, and outbox events.
- API daily loop contracts now cover authored item catalog, active versioned reaction catalog, user inventory placement, owned care state, care actions, walk start, walk return gating, and one-time reward claim; mobile client methods exist for those endpoints.
- Premium chat remains gated in mobile, with a locked-state Plus pass shop CTA plus a tested mobile API session helper for disclosure-accepted conversation start/send behavior, tested API and Postgres-backed entitlement/disclosure/input-moderation/provider-output-moderation conversation start/send/thread read/delete boundaries, recent conversation history passed to the backend-only provider, local provider fallback, localized crisis/professional-advice fallback copy, and tested OpenAI Responses provider adapter ready for production secret injection.
- Privacy deletion contracts now include tested API routes for original photos, premium chat history, and pet data, mobile API client methods, and Postgres-backed request-service job enqueueing.
- Commerce remains mobile-store-secret-free in the API core, with the mobile shop and restore control reading/calling tested API and Postgres-backed product catalog, current-user entitlement, purchase verification, restore, idempotency, transaction ownership, revocation boundaries, a tested HTTP store verification gateway, and tested direct App Store / Google Play verifier adapters for production provider wiring.
- API-backed integration builds resolve request auth through a tested mobile session-token boundary, using Expo SecureStore on iOS/Android with legacy AsyncStorage migration and falling back to development mock metadata only when explicitly allowed for local adapter builds.
- API-backed mobile auth now has a tested provider-token expiry and refresh hook: valid provider tokens are reused, expired provider tokens can be refreshed and persisted before API calls, and stale tokens are cleared when refresh fails.
- API-backed first-session builds use a tested signed upload transport with SHA-256 content hashing, upload method/header support, byte-size mismatch checks, and local mock-signed-upload skipping for mock adapters.
- API-backed generated-pet rendering resolves signed read URLs, caches renderable HTTP(S) asset URLs for accepted generated states, selects reaction/category-appropriate pet art, and falls back to bundled sample PNGs for local mock-signed-read URLs.
- First-session screens share a compact native progress HUD for Welcome, Photo, Setup, Hatch, and Reveal, so users can see the active setup step before entering the terrarium.
- Store screenshot QA builds can boot into deterministic Welcome, Photo upload, Pet setup, Hatching, Pet reveal, Terrarium, Chat, Shop, and Walk reward local states through `EXPO_PUBLIC_TINY_PET_STORE_SCREENSHOT_PRESET`; this mode does not overwrite stored local sessions and is blocked by production release-config validation.
- QA-only screen presets can boot operational states such as Settings privacy error/progress copy through `EXPO_PUBLIC_TINY_PET_QA_SCREEN_PRESET=settings-privacy-error` or `settings-privacy-progress`; this is separate from store screenshot presets and is blocked by production release-config validation.
- Store privacy/data safety draft is documented in `docs/store-privacy-data-safety.md` with current App Store privacy label and Google Play Data safety answers, implementation evidence links, provider caveats, and final-submission checklist.
- Store listing draft is documented in `docs/store-listing-draft.md` with App Store and Google Play listing fields, review notes, release notes, and screenshot captions for the first native store package.
- Store screenshot manifest is documented in `docs/store-screenshot-manifest.json`, mapping each deterministic preset to the native route, capture label, and store caption.
- Decorative scene image fragments are hidden from screen-reader traversal while meaningful product, inventory, pet, and CTA images keep labels.
- Primary screen titles expose `accessibilityRole="header"` across the native flow, and the static accessibility gate now guards that VoiceOver navigation contract.
- Photo upload fallback and sample selection states render bundled generated-pet PNG art instead of shape-only placeholder portraits.
- Pet setup preview art includes a compact profile summary ribbon for the current name, species, trait count, and talking style.
- Pet setup keeps the Continue CTA visible after the required name/species controls in the first iPhone 16 Pro store viewport, with optional personality and talking-style controls continuing below.
- Local prototype reactions and reveal greeting now match the English app/store surface, avoiding mixed-language text in iOS store screenshots.
- Hatching progress is driven by a tested mock generation-job polling boundary instead of direct screen-owned step advancement.
- Hatching production-facing UI no longer exposes the developer-only failure preview CTA; failed generation states still render the retry path.
- Pet reveal Try again now calls generation retry before routing back to hatching, so completed jobs are not merely reopened.
- Pet reveal Report issue routes to Support, where users can save a safe category-only generation issue report locally and through the API/Postgres path when API-backed mode is configured.
- Pressable controls include accessibility roles, labels, and selected/disabled state where applicable.
- Hatching progress uses manual step advancement when the OS reduce-motion setting is enabled.
- Reduced-motion hatching UI policy is now unit-tested so active jobs auto-poll only when motion is allowed, use manual continue when reduce motion is enabled, and hide progression controls after terminal states.
- App icon, adaptive icon foreground, and splash PNGs are generated and referenced by Expo config.
- Bundled generated-pet PNG assets for idle, base, happy, sleep, play, hungry, walk-return, treat-reaction, chat-portrait, curious, celebrate, garden-help, and seasonal states are rendered as reaction-aware fallback pet art instead of CSS/View-only placeholders.
- Bundled generated-pet PNG assets now include species-aware dog and cat fallback sprite sets across core first-pass and later reaction/seasonal states.
- Photo-to-avatar generation prompts now guard source-photo identity, reject generic cute puppy/cat drift, and require distinct state poses for Home, Chat, Walk, Treat, Garden, and seasonal surfaces before a production provider set can pass quality review.
- Bundled fallback pet art now has a static completeness gate requiring dog/cat fallback registration, all generated states, centered transparent 256x256 sprites, and distinct screen-critical state PNGs so QA cannot silently fall back to repeated idle art.
- Generated mobile assets are covered by a static manifest gate that verifies PNG dimensions/format, runtime registry coverage, and rejects stale unregistered generated PNGs.
- Generated mobile visual assets are also covered by a static quality gate for color richness, alpha/cutout structure, coverage, and centering so future placeholder regressions fail preflight.
- Mobile visual direction is guarded by `npm run validate:mobile-visual-direction`, checking the premium cozy casual game UI contract, raster-backed scene frame, tactile HUD/buttons, reveal/home/hatching scene modes, and stale dome-first copy regressions.
- Generated mobile art now has a review contact sheet at `docs/qa-screenshots/mobile-generated-assets-contact-sheet.png`, with freshness guarded by `npm run validate:mobile-asset-contact-sheet`.
- Home, premium chat, shared screen framing, inventory, settings, legal/support, and shop pages now use the imagegen-derived `pixel-garden-premium-v1.png` raster scene instead of flat CSS scenery.
- Shop shelf art uses `shop-room-square-premium-v1.png` only as an in-page collectible shelf illustration, while stale `shop-garden-v2.png` and `shop-shelf-v3.png` assets live under `dummy/stale-generated-assets`.
- Terrarium/reveal art now uses the shared premium garden scene and layered game UI instead of the older dome-first placeholder direction, while still avoiding reference/mockup screen crops.
- Local shop preview renders shared catalog items with bundled item PNG icons instead of a separate hardcoded preview-pack list.
- Local shop preview marks inventory-owned catalog items as owned and leaves unowned reward/shop items locked in the local preview path.
- Local shop preview includes a Plus pass destination card that uses server product/entitlement state in API-backed builds and a user-facing Plus locked state in local builds.
- Local shop preview includes a compact summary HUD for owned item count, locked catalog count, and Plus pass state, backed by shared local/server shop summary presentation helpers.
- Inventory rows now expose API-backed/local Place/Remove controls for owned items, updating the terrarium `placedItems` layout that the home scene renders.
- Plant decor keeps a guarded fixed-preset growth contract for optional inventory surfaces, but the default Home `Water` action is pet hydration rather than a plant reward loop.
- Inventory plant cards can still expose preset plant stage, condition, growth progress, and thirsty/blooming badges when plant decor is revisited outside the core pet-care loop.
- Plant stage art now has local final-stage PNG coverage: `docs/design/plant-stage-asset-manifest.json` and `docs/design/plant-stage-asset-prompts.md` define the `seed/sprout/leafy/bloom` PNG contract, Home and Inventory select stage visuals through `getGameItemAssetKeyForPlantStage`, and final PNG plus catalog mapping coverage is guarded by `TINY_PET_REQUIRE_FINAL_PLANT_STAGE_ASSETS=true npm run validate:plant-stage-assets`.
- Care economy now has a guarded product contract: satisfaction/heart is not spendable, bond XP is relationship growth, credits/free chat tickets/Plus pass are the monetized surfaces, and treats stay optional repeatable consumables rather than baseline-care requirements.
- Home care actions now render an immediate action-result chip with care-meter deltas, cozy tradeoffs, and bond XP while keeping satisfaction, bond, and credits visibly separate.
- Claimed walk rewards now leave a first-viewport terrarium summary card based on the claimed walk reward item id, with the claimed item art, owned quantity, and Inventory/Shop CTAs.
- Locked premium chat now leaves a visible Plus pass CTA in the first iPhone 16 Pro viewport and routes that CTA to the shop preview.
- Premium chat art now uses decomposed garden, pet, gift, doghouse, toy, and bond-meter elements instead of a flat placeholder panel.
- Premium chat access copy now distinguishes ready long chat, local long-chat preview with saved tickets/credits, and locked Plus chat so free authored hellos are not confused with spendable chat balance.
- First-session and terrarium hub flow is covered by a static route/CTA gate for Welcome, Photo upload, Pet setup, Hatching, Reveal, Terrarium, Chat, Shop, and Walk reward paths.
- User-visible mobile copy is covered by `npm run validate:mobile-copy` to keep implementation, build, configuration, and release-process terminology out of screen strings.
- Large iOS simulator terrarium, chat, and shop design screenshots are captured under `docs/qa-screenshots`.
- iOS simulator reveal screenshot confirms the generated cozy garden scene background renders in-app:
  - `docs/qa-screenshots/ios-iphone-16-pro-store-pet-reveal.png`
- iOS simulator pet setup screenshot confirms the profile summary ribbon renders in-app:
  - `docs/qa-screenshots/ios-iphone-16-pro-pet-setup-profile-ribbon.png`
- iOS simulator first-session screenshots confirm the progress HUD renders on Photo, Hatching, and Reveal without hiding primary CTAs:
  - `docs/qa-screenshots/ios-iphone-16-pro-photo-first-session-progress.png`
  - `docs/qa-screenshots/ios-iphone-16-pro-hatching-first-session-progress.png`
  - `docs/qa-screenshots/ios-iphone-16-pro-reveal-first-session-progress.png`
- iOS simulator photo-upload screenshot confirms the visual layout is unchanged after decorative scene image accessibility cleanup:
  - `docs/qa-screenshots/ios-iphone-16-pro-photo-decorative-a11y.png`
- iOS simulator chat screenshot confirms refined premium bond art renders in-app:
  - `docs/qa-screenshots/ios-iphone-16-pro-chat-premium-bond-art.png`
- iOS simulator shop screenshot confirms the compact summary HUD renders without text overflow:
  - `docs/qa-screenshots/ios-iphone-16-pro-shop-summary-hud.png`
- iOS simulator terrarium screenshot confirms the claimed walk reward summary renders before the care controls:
  - `docs/qa-screenshots/ios-iphone-16-pro-walk-reward-claimed-summary.png`
- Large iOS simulator inventory screenshot confirms item rows render separate bundled v2 item PNG assets instead of placeholder blocks.
- Booted iOS simulator and connected Android emulator/device screenshots can now be captured into `docs/qa-screenshots` with `npm run qa:mobile-screenshots`.
- Store screenshot preset states are unit-tested for route mapping and local session contents, giving the final iOS/Android screenshot pass stable screen setup points.
- Store privacy/data safety documentation is covered by `npm run validate:store-compliance`.
- Store listing documentation is covered by `npm run validate:store-listing`.
- Store metadata alignment across native config, listing copy, privacy/data-safety claims, and screenshot captions is covered by `npm run validate:store-metadata-alignment`.
- Expo native store config is covered by `npm run validate:native-store-config`, guarding app identity, native permissions, generated native assets, and EAS build profile shape for iOS/Android without running Android builds mid-pass.
- Store screenshot preset/route/caption mapping is covered by `npm run validate:store-screenshots`; intermediate iOS screenshot coverage can be enforced with `npm run validate:ios-store-screenshots`, and final iOS/Android PNG coverage can be enforced with `TINY_PET_REQUIRE_STORE_SCREENSHOTS=true`.
- iPhone 16 Pro development-client store screenshot PNGs are captured for Welcome, Photo upload, Pet setup, Hatching, Pet reveal, Main terrarium, AI chat / premium bond, Walk reward, and Shop through `TINY_PET_IOS_STORE_SCREENSHOT_CLIENT=development-client npm run capture:ios-store-screenshots`, with iOS-only strict coverage passing through `npm run validate:ios-store-screenshots`.
- A generated iOS store contact sheet at `docs/qa-screenshots/ios-iphone-16-pro-store-contact-sheet.png` summarizes the nine preset screenshots and is guarded by `npm run validate:ios-store-contact-sheet`.
- iPhone 16e large-text development-client evidence is captured for all nine deterministic presets with `large-text-*` labels and summarized at `docs/qa-screenshots/ios-iphone-16e-large-text-store-contact-sheet.png`; `npm run validate:ios-large-text-evidence` guards the PNG set and contact sheet.
- iPhone 16 Pro Reduce Motion evidence is captured for hatching, pet reveal, terrarium, chat, and shop through `npm run capture:ios-reduce-motion-hatching` plus `npm run capture:ios-reduce-motion-core-evidence`; `npm run validate:ios-reduce-motion-evidence` guards the PNG set.
- iOS development-client readiness is guarded by `npm run validate:ios-dev-client-readiness`, with `expo-dev-client` installed, generated iOS workspace and Pod lock present, the EAS development profile configured for iOS simulator builds, and the iOS store capture script able to open the development-client URL while suppressing dev menu overlays.
- The iOS development-client build/install path has succeeded through `npm run ios:dev-client:build` on the booted iPhone 16 Pro simulator; screenshot validators now reject iOS `Open in app` confirmation prompts and development-client tools overlays.
- Android large and 720x1280 small-viewport onboarding screenshots are captured, with compact onboarding layout keeping the primary CTA visible on the small viewport.
- iPhone 16e small-device development-client welcome screenshot is captured without Expo Go/dev tools overlays, with the primary CTA visible in the first viewport.
- Safe analytics contracts reject sensitive event payload keys.
- Production release-config validation rejects development mock auth fallback and public mock auth tokens.
- Production release-config validation rejects missing/placeholder JWT/JWKS auth settings, API database URLs, disabled database SSL mode, and missing S3-compatible private storage signing settings.
- Production env example coverage is guarded by `npm run validate:env-examples`, keeping mobile public release config and server-only API/worker/store/premium-chat env keys documented without real secrets.
- Mobile secret-boundary coverage is guarded by `npm run validate:mobile-secret-boundaries`, keeping server-only `TINY_PET_*` env keys, unsupported public env keys, secret-shaped public names, and real-looking provider/storage/payment secrets out of the mobile app surface.
- Privacy SDK boundary coverage is guarded by `npm run validate:privacy-sdk-boundaries`, keeping unapproved crash, diagnostics, tracking, advertising, and third-party analytics SDKs out of package manifests, `package-lock.json`, and app/server source entry points until store privacy answers are updated.
- Release-config validation rejects invalid optional API process host, port, allowed-origin, body-size, and service-name env values, and requires production API rate-limit window/max-request env so the shared throttling store is mounted for production API traffic.
- Production release-config validation also rejects missing production worker DB/storage settings, missing worker generation provider secrets/model selection, missing or invalid production worker quality thresholds/calibration id, missing worker max-jobs batch caps, missing generation/privacy/outbox/chat-retention worker process modes, enabled API mock generation polling, and invalid optional worker scheduler env values.
- Production release-config validation rejects direct store verifier bundle/package env that does not match `expo.ios.bundleIdentifier` and `expo.android.package`.
- API router and Node HTTP server can reject default mock auth headers for production-style mounts with `allowMockAuth: false`.
- API Node runtime now has a tested async `ApiSessionVerifier` injection point for auth provider/JWKS verification while keeping auth secrets server-only.
- API server now includes a tested RS256 JWT/JWKS session verifier adapter and runtime-config path for production auth providers that expose public signing keys.
- API Node runtime now has a tested async `PrivateStorageSigner` injection point for private storage upload/read signing while keeping storage credentials server-only.
- API now has a tested S3-compatible `PrivateStorageSigner` implementation and runtime-config path for short-lived original-photo upload URLs, generated-asset read URLs, and internal `s3://` storage URI persistence.
- AI worker now has a tested S3-compatible storage adapter for reading internal original-photo `s3://` URIs and writing generated assets back to private storage with `sha256:` hashes.
- API service, router, and Node HTTP server can reject mock purchase verification for production-style mounts with `allowMockPurchaseVerification: false`, and production release-config validation requires the matching env flag to be disabled.
- API router now includes a server-only purchase revocation webhook route guarded by `TINY_PET_COMMERCE_WEBHOOK_SECRET`; mobile has no revoke client method.
- API now includes tested HTTP and direct Apple/Google `StorePurchaseVerifier` adapters and runtime-config paths, with direct Google Play subscription product ids required in production config while raw store tokens remain request-scoped and excluded from ledgers.
- API service, router, and Node HTTP server can reject mock storage signing for production-style mounts with `allowMockStorageSigning: false`, and production release-config validation requires the matching env flag to be disabled.
- API Node runtime now has a tested async `StorePurchaseVerifier` injection point plus HTTP and direct Apple/Google store verifier adapters, including verifier-only raw store token transport that stays out of entitlement ledgers and analytics.

## Validation

Current intermediate validation command:

```sh
npm run validate:ios-preflight
```

This includes the static iOS manual QA checklist gate for VoiceOver, iOS Reduce Motion, text/layout, photo consent, privacy, store screenshot evidence tracking, iOS hatching Reduce Motion screenshot evidence, iOS large-text evidence, iOS development-client readiness, iOS-only store screenshot coverage, and iOS-only screenshot freshness.
It also validates `docs/product-direction.md`, `npm run validate:mobile-visual-direction`, and `npm run validate:final-release-runbook` so the current iOS/Android product flow, decomposed reference-art rule, cozy casual visual direction, production external dependency boundary, production handoff commands, Android evidence boundary, and final release gates do not drift from implementation status.

Final completion validation should run `TINY_PET_FINAL_RELEASE_ALLOW_ANDROID=true npm run validate:final-release` after the Android build/device pass is ready. That final gate runs iOS preflight, production release-config validation, strict iOS/Android screenshot coverage, `npm run validate:final-screenshot-freshness`, Android store contact sheet validation, and `npm run validate:android`.
Current Android store screenshot coverage, Android store contact sheet validation, and Android export validation are green in local evidence. Recapture with `npm run capture:android-store-screenshots` before final submission when UI, art, build, or device inputs change; the full capture also regenerates the Android store contact sheet.

## Remaining Work

- Provide real backend auth provider issuer/audience/JWKS values and connect the tested mobile token refresh hook to the provider SDK before any production private upload; mobile secure token storage plus mobile/API production mock-fallback guards, production auth config validation, and a tested JWT/JWKS verifier are in place, but no production provider issues tokens yet.
- Deploy the tested Postgres API server process with `npm run start:api`, production auth settings, probe wiring, safe operational logger shipping/retention, infrastructure-level distributed rate limits, the `pg` database client adapter, and secret management.
- Add deployed OpenAI source-photo safety and generation quality configuration plus production quality threshold value calibration, then set `TINY_PET_WORKER_QUALITY_CALIBRATION_ID` to the approved calibration record id.
- Mount the tested generation worker runtime-env deployment in production scheduler infrastructure using `npm run start:generation-worker`, real provider/S3 credentials, explicit worker model env, scheduler process env, calibrated threshold values, and a calibration id; production API config now blocks mock poll auto-completion, and worker runtime env validation fails closed for production provider/storage/DB omissions plus missing or invalid model/quality threshold/calibration values.
- Provide real production S3-compatible bucket credentials, endpoint policy, and secret management for the tested API storage signer and worker storage adapter so remote generated pet art renders in API-backed builds.
- Replace API-backed privacy local-adapter auth fallback with real auth/session persistence, deploy the Postgres-backed privacy request routes against production auth/storage, and mount the tested OpenAI image edit, source-photo safety, and generation quality adapters, calibrated threshold values, and deployed S3 worker storage config on the tested worker runtime for the repository-bundle generation lifecycle.
- Replace bundled sample generated-pet PNGs with approved final generated art if needed; dog/cat reaction/seasonal fallback state assets are now generated and validated locally.
- Replace or approve generated item/background art if needed, including final plant stage PNGs from `docs/design/plant-stage-asset-manifest.json`; pass `TINY_PET_REQUIRE_FINAL_PLANT_STAGE_ASSETS=true npm run validate:plant-stage-assets`, then recapture and revalidate iOS/Android store screenshots when final art changes before submission. Run `npm run validate:final-screenshot-freshness` after recapture so final screenshot evidence is newer than the latest visual UI/art source.
- Run VoiceOver and any deeper iOS reduced-motion edge-case checks through `docs/ios-manual-qa-checklist.md`; hatching, pet reveal, terrarium, chat, and shop have automated iOS simulator evidence, and TalkBack plus Android reduced-motion checks remain part of the final Android manual completion pass.
- Set final public privacy, terms, and support config values for production validation.
- Confirm final auth/provider/crash-analytics/encryption-at-rest choices against the store privacy/data safety draft and `npm run validate:privacy-sdk-boundaries` before submitting App Store privacy labels or Google Play Data safety answers.
- Mount the tested privacy deletion, outbox, and chat-retention worker runtime-env deployments in production scheduler infrastructure with the API `start:*` worker commands, selected `TINY_PET_OPERATIONAL_ALERT_ROUTING`, worker scheduler env, and bucket lifecycle policy checks.
- Harden premium chat for production with deployed log/alert sinks and scheduler deployment; the backend-only OpenAI provider gateway, operational-logger-backed safe provider monitor hook, sanitized alert events, output moderation fallback, rate limits, retention-window filtering, bounded retention purge worker, and production config validation for explicit model, turn-limit, context, and retention policy selection are in place.
- Connect commerce ledger to real App Store / Google Play product/account setup, deployed refund/revocation webhook registration, and entitlement monitoring; tested HTTP and direct store verifier adapters, restore APIs, request-scoped token handling, direct App Store signed transaction JWS verification, and server-only revocation webhook signing are already in place behind production config.
