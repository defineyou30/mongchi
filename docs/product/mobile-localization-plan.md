# Mongchi Mobile Localization Plan

Status: Implemented; release-language review pending
Baseline: current implementation, audited 2026-07-12
Launch locales: `en-US`, `ko-KR`, `ja-JP`, `zh-TW`, `de-DE`, `fr-FR`, `pt-BR`, `es-MX`
Primary markets: United States, South Korea, Japan, Taiwan, Germany, France, Brazil, and Mexico

## Implementation progress (2026-07-12)

Completed in the current mobile localization pass:

- Typed resources for all eight launch locales, English fallback, device-locale normalization, and automated 620-key/interpolation parity coverage.
- Splash, welcome onboarding, photo intro/upload, pet setup, generation, reveal, and first Home welcome copy, including photo validation, permission dialogs, accessibility labels, placeholders, and locale-aware reveal/share messages.
- Terrarium Home visible HUD, rail, pet, care-dock/tray, walk, retention, meter-guide, event-toast, and accessibility presentation. Stable care action IDs such as `water_garden` remain untranslated.
- Friend profile visible sections, stats, walk finds, memory timeline, monthly letter, pose labels/paging, share messages, and generated share-card copy. Pet names and generated-asset state IDs remain unchanged.
- Shop preview, expression-pack shelf, themes, catalog items, purchase states/dialogs, inventory, and related accessibility copy. Product, item, pack, entitlement, and theme IDs remain unchanged.
- Chat screen/history copy, conversation starters, access states, localized deterministic validation/entitlement/rate-limit fallbacks, and locale forwarding for premium chat requests.
- Settings, OS app-language route, backup/restore/delete dialogs, weather/audio/privacy controls, Privacy, Support, and Terms visible copy.
- Focused Vitest coverage across launch locales, including resources, Home/profile/shop/chat presentation, deterministic chat errors, and share copy.

Still required before the plan's full release definition of done:

- Clean-install permission, scheduled-notification delivery, VoiceOver order, large-text, and generated share-card QA on release builds.
- Live provider-language and safety scenario QA for premium chat in each launch locale.
- Locale-specific App Store metadata and screenshot exports beyond the current English set.
- Final native-speaker legal/product review of every translated monetization, safety, Privacy, Support, and Terms surface.

## 1. Product decision

Mongchi should launch with eight app locales:

1. Keep English as the operational fallback and Korean as the home-market language.
2. Cover the high-value mobile markets of Japan, Taiwan, Germany, and France.
3. Cover the high-growth Latin American markets through Brazilian Portuguese and Mexican/neutral Latin American Spanish.
4. Do not target mainland China in this wave because the AI generation/chat provider is not supported there.

English remains the fallback language. The app follows the device or per-app system language. Settings shows the active language and routes users to the OS app-language setting; a second in-app language preference is not added in the first pass.

This keeps one language source of truth and follows the platform-level language selection supported by modern iOS and Android. The implementation should use Expo's supported-locales configuration rather than a custom language switcher.

Official references:

- [Expo localization guide](https://docs.expo.dev/guides/localization/)
- [Expo localization API](https://docs.expo.dev/versions/latest/sdk/localization/)
- [react-i18next TypeScript guide](https://react.i18next.com/latest/typescript)

## 2. Current implementation audit

| Area | Current state | Required change |
| --- | --- | --- |
| Mobile dependency | Expo-compatible `expo-localization`, `i18next`, and `react-i18next` are installed. | Keep versions aligned with the active Expo SDK. |
| App root | Localization initializes before session providers and refreshes on foreground return. | Re-run locale-switch QA after Expo or React Native upgrades. |
| Screen copy | Core mobile surfaces use one typed resource shape across eight locales for visible and accessibility copy. | Enforce the no-raw-copy gate for future screens. |
| Session locale | Presentation and API adapters read the active BCP 47 locale without translating domain identifiers. | Extend the same boundary to future notification workers. |
| Mobile API calls | Home weather and premium chat receive the active locale and timezone. | Keep server fallbacks in parity with mobile resources. |
| AI chat | Mobile, API, and `chat-turn` forward all eight locale tags and localize deterministic validation, safety, entitlement, crisis, refusal, and rate-limit paths. | Complete live provider-language and safety scenario QA. |
| Native permissions | iOS and Android declare all eight locales for app name, camera, photo, and location permission strings. | Validate clean-install dialogs on release builds. |
| Notifications | Garden, return, walk, and Android channel copy resolve through the active eight-locale runtime resource. | Validate delivery after locale changes on physical devices. |
| Fonts | Latin locales keep branded font roles while Korean, Japanese, and Traditional Chinese use verified system fallbacks. | Verify large text and future custom CJK font changes on supported devices. |
| Store assets | The current App Store set contains English text. | Export locale-specific sets only after in-app copy freezes and market priority is confirmed. |

The counts above are an inventory baseline, not a translation key target. Repeated labels and shared messages should resolve to one key.

## 3. Localization architecture

### 3.1 Module layout

The current mobile localization boundary is:

```text
apps/mobile/src/localization/
  config.ts
  locale.ts
  localeNormalization.ts
  localizedText.ts
  resourceCatalog.ts
  runtimeResources.ts
  resources/
    en-US.ts
    ko-KR.ts
    ja-JP.ts
    zh-TW.ts
    de-DE.ts
    fr-FR.ts
    pt-BR.ts
    es-MX.ts
```

`config.ts` initializes i18next. `localeNormalization.ts` owns supported BCP 47 tags and fallback rules. `resourceCatalog.ts` enforces one typed resource shape, while `runtimeResources.ts` exposes locale-aware copy to non-React notification and service adapters.

### 3.2 Locale rules

- Supported locales are exact BCP 47 tags: `en-US`, `ko-KR`, `ja-JP`, `zh-TW`, `de-DE`, `fr-FR`, `pt-BR`, and `es-MX`.
- Language variants normalize to the launch-market locale. Traditional Chinese tags (`zh-TW`, `zh-Hant`, `zh-HK`, `zh-MO`) normalize to `zh-TW`; Simplified Chinese and unsupported languages fall back to `en-US`.
- The locale is read once before the first user-facing screen. Do not briefly render English and then swap languages.
- Android locale changes are refreshed when the app returns to foreground.
- Pet names, user-entered text, SKU/product IDs, database enums, event names, asset keys, and API error codes are never translated.
- Domain models store stable codes and values. Translation occurs only in presentation or notification builders.
- Missing production keys fall back to English and report a non-fatal diagnostic with the key and screen.

### 3.3 Translation key design

Use semantic keys, not English sentences:

```ts
t("home.memory.oneWeek.title")
t("shop.expressionPack.unlockAll", { count: 3 })
t("chat.input.placeholder", { petName })
```

Use plural rules and interpolation for counts. Do not concatenate translated fragments, and do not put JSX markup into resource values unless a sentence genuinely needs styled inline content.

### 3.4 Typography

- English keeps the existing Pixelify/Fredoka/Nunito hierarchy.
- Korean, Japanese, and Traditional Chinese headings and body copy use verified platform system fonts, mapped through the existing typography roles.
- Pixelify remains limited to short Latin branding or numeric labels when a CJK locale is active.
- CJK line height must be tested separately; do not reuse a fixed Latin line height when glyph bounds clip.

## 4. Server and AI contract

The backend must receive locale as data, not infer it from translated text.

1. Replace hard-coded mobile `en-US` values in session, Home, and chat calls with the active locale.
2. Keep `locale` and `timezone` required in chat request contracts and validate all eight locale tags server-side.
3. In `chat-turn`, require the model to reply in the requested language while preserving the pet's tone and pet name.
4. Localize deterministic server messages such as empty input, length limits, entitlement failures, and provider failures before returning them to UI.
5. Keep safety classification language-independent where possible, and review every localized refusal/crisis message before market release.
6. Store raw conversation text and stable flags; do not store a translated duplicate of user or AI messages.
7. Add locale to push-notification jobs so notification title/body are rendered at send time from stable event codes.

AI fallback order:

1. Requested locale response.
2. Deterministic localized fallback for known failures.
3. English fallback only when a requested resource is missing, with diagnostics.

## 5. Delivery sequence

### PR 1 - Infrastructure and contract

- Install localization dependencies with Expo-compatible versions.
- Add the localization module, typed resource declarations, locale normalization, and formatter tests.
- Configure `expo-localization` supported locales in `app.json`.
- Mount localization before `TerrariumSessionProvider`.
- Add a development-only missing-key reporter.

Acceptance:

- Every supported simulator locale opens directly in its requested language without an English flash.
- An unsupported locale opens in English.
- TypeScript rejects unknown translation keys.

### PR 2 - Onboarding and Home vertical slice

- Migrate Splash, onboarding, photo upload, pet setup, generation, reveal, welcome dialog, Home HUD, care actions, and Home retention cards.
- Replace fixed `DEFAULT_PROTOTYPE_LOCALE` use in user-facing presentation builders.
- Localize accessibility labels and loading/error states in the same pass as visible copy.

Acceptance:

- A new user can complete photo selection through first Home entry in every launch locale.
- No English remains in a localized onboarding/Home flow except protected product names or user content.
- iPhone 16 Pro and the smallest supported iPhone show no truncation or overlap.

### PR 3 - Profile, shop, inventory, and chat

- Migrate profile stats, Walk Finds, moments, Mong's Letter, pose names, pack descriptions, shop states, inventory, and all chat UI.
- Send the active locale to premium chat and weather presentation.
- Localize server validation and entitlement messages.
- Keep product IDs and expression state IDs stable while translating their presentation metadata.

Acceptance:

- Expression packs clearly describe the same three poses in all launch locales.
- Chat replies and deterministic errors follow the requested locale.
- Long pet names and long translated pack names do not resize or shift fixed controls.

### PR 4 - Settings, legal, native permissions, and notifications

- Migrate Settings, support, privacy, terms, account deletion, dialogs, and error boundary copy.
- Add localized camera, photo-library, save-image, and location permission descriptions.
- Add the Settings language row that opens the OS app settings.
- Localize push notification templates and deep-link destinations.

Acceptance:

- Native permission dialogs use the active language after a clean install.
- Legal copy versions are explicitly tracked per locale.
- Notification copy matches the locale attached to the scheduled event.

### PR 5 - Store listing and release QA

- Freeze the eight-locale product glossary.
- Translate App Store title, subtitle, promotional text, keywords, description, privacy/support copy, and release notes.
- Produce `docs/release/store-assets/v4-pixel/final/ko-KR/` with the same six-slide story as the English set.
- Run screenshot, large-text, VoiceOver, reduce-motion, offline, error, and AI-language QA.

Acceptance:

- Every store claim is visible in the shipped build.
- App Store screenshots contain no mixed-language UI.
- Each market release checklist passes on a clean install.

## 6. QA matrix

Minimum scenarios per launch locale:

| Surface | Required checks |
| --- | --- |
| Onboarding | Permission denial, bad photo, generation retry, resume after interruption, first welcome dialog |
| Home | All HUD labels, care actions, retention cards, day/night/weather copy, offline state |
| Profile | Long pet name, all stats, Walk Finds locked/owned, moments timeline, letter state, pose paging |
| Shop | Insufficient credits, dev credits, purchase pending, generation pending, retry, owned pack |
| Chat | Starter prompts, typing state, long user text, requested-language adherence, safety fallback, rate/entitlement error |
| Settings/legal | Language route, privacy permissions, delete account, legal version, support links |
| Accessibility | VoiceOver order, accessibility labels, large text, contrast, text clipping, reduce motion |

Automated gates:

- Resource shape and interpolation-token parity across all eight locales.
- No raw user-facing string additions in screen files without an explicit allowlist.
- Locale normalization and formatter unit tests.
- Snapshot or presentation tests for long Latin and CJK strings.
- Chat contract tests for every supported locale plus unknown-locale fallback.
- Native export/prebuild check confirming all eight supported locales and localized permission strings.

## 7. Translation ownership and glossary

One glossary file should define protected names and preferred product terms before translation begins.

| English | Korean direction | Rule |
| --- | --- | --- |
| Mongchi | Mongchi or 몽치, product decision required | Use one spelling consistently in store metadata and UI. |
| tiny companion | 작은 친구 | Prefer emotional language over technical avatar wording. |
| care | 돌보기 | Use for the daily action loop. |
| Bond | 유대감 | Keep separate from streak. |
| Streak | 연속 돌봄 | Avoid untranslated growth jargon. |
| Together | 함께한 시간 | Use the actual metric meaning, not a literal isolated adjective. |
| expression pack | 표정 팩 | Explain the three included poses in shop copy. |
| Walk Finds | 산책 발견물 | Keep collection terminology consistent across Home and profile. |
| Mong's Letter | 몽치의 편지 | Pet name interpolation must support user-selected names. |

Machine translation may produce the first draft, but onboarding, monetization, safety, notification, and legal copy require native-speaker review before each market release.

## 8. Definition of done

Localization is complete only when:

- All visible, accessibility, native permission, notification, error, and AI fallback copy is locale-aware.
- English is a tested fallback, not a collection of hard-coded exceptions.
- Locale never changes domain identifiers, purchases, saves, or generated-asset mappings.
- Latin and CJK typography pass the same visual QA as English on real simulator screenshots.
- Each localized store listing and screenshot set matches the shipped locale.
