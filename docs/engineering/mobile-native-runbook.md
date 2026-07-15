# Mobile Native Runbook

> 최신 대조: 2026-07-08 (커밋 8e8fd0c 기준)

Mongchi is an iOS/Android app. Expo is used as the React Native toolchain, not as a web-first target.

## Local Development

```sh
npm install
npm run start:mobile
```

Then open the app with Expo Go or a development build on iOS or Android.

## Native Bundle Validation

For intermediate implementation passes, use the iOS-based preflight:

```sh
npm run validate:ios-preflight
```

This command runs tests, shared/API/worker typecheck, mobile typecheck, static mobile gates, store documentation gates, iOS store screenshot coverage, iOS screenshot freshness, release-config and DB checks, and the iOS Expo export. It intentionally does not run Android export during intermediate work.
It also validates the iOS manual QA checklist so VoiceOver, Reduce Motion, text/layout, photo consent, and store screenshot evidence stay tracked without turning Android into a mid-pass gate.
The preflight also checks that iOS hatching Reduce Motion evidence exists and that the iOS development-client profile is ready for Expo Go-free simulator QA, while current Android store screenshot/contact-sheet/export evidence is checked separately from the intermediate iOS loop.
The static final runbook gate, `npm run validate:final-release-runbook`, keeps the production handoff, final Android commands, strict iOS/Android store screenshot coverage, final screenshot freshness, and Android-free intermediate iOS loop aligned with the package scripts.

Run Android validation at final completion or when changing Android-specific native config:

```sh
npm run validate:android
```

The iOS and Android export commands create temporary Expo export bundles in `/tmp` and verify that the current app code can bundle for the requested mobile platform.
The copy validation keeps developer-facing implementation terms out of the user-visible mobile screens.
The store compliance validation checks that the App Store privacy label and Google Play Data safety draft keeps the core data categories, evidence links, and final-submission caveats.
The store listing validation checks required App Store/Google Play listing fields, short-field character limits, and screenshot-caption coverage.
The store screenshot validation checks that the screenshot manifest stays aligned with app presets, routes, listing captions, and any PNGs already captured.

## iOS Manual QA

Use `docs/release/ios-manual-qa-checklist.md` for intermediate device QA. Run the static checklist gate with:

```sh
npm run validate:ios-manual-qa
```

The checklist covers the first-session path, Main terrarium, AI chat / premium bond, Walk reward / shop, VoiceOver, iOS Reduce Motion, larger text, photo permission/consent, privacy controls, and store screenshot capture notes. Android screenshot/export evidence is tracked separately from the intermediate iOS checklist; TalkBack evidence and Android Reduce Motion evidence remain final Android manual completion checks.

For hatching Reduce Motion evidence, boot an iOS simulator and run:

```sh
npm run capture:ios-reduce-motion-hatching
```

The script enables iOS Reduce Motion in the simulator, opens the deterministic hatching preset through Expo on port `8092`, captures `ios-*-reduce-motion-hatching.png`, validates the PNG through the shared capture helper, and restores the previous Reduce Motion setting. `npm run validate:ios-reduce-motion-evidence` checks that this evidence remains present for the iOS preflight.

For iOS larger-text layout evidence, boot the small iOS simulator with the development client installed and run:

```sh
npm run capture:ios-large-text-evidence
```

The script temporarily sets the simulator content size to `extra-large`, captures all nine deterministic presets through the development client with `large-text-*` labels, generates `ios-*-large-text-store-contact-sheet.png`, and restores the previous content size. `npm run validate:ios-large-text-evidence` checks that the PNG set and contact sheet remain present and clean.

## iOS Development Client Readiness

The EAS `development` profile is configured for an iOS simulator development client, and `expo-dev-client` is installed in the mobile workspace. Keep this static guard passing before final App Store screenshot capture:

```sh
npm run validate:ios-dev-client-readiness
```

This does not build the client. It verifies the development-client dependency, generated iOS workspace, Podfile lock, EAS simulator profile, app scheme, store-capture script support, and the store manifest requirement that final screenshots come from a development-client or production build without Expo Go overlays.

The iOS native project has been generated with:

```sh
npx expo prebuild --platform ios --npm
```

Install or refresh iOS pods with the repo helper:

```sh
npm run ios:pods
```

This helper prefers `rbenv which pod` and sets `RUBYOPT=-rlogger`, which avoids the local system Ruby 2.6 CocoaPods failures seen on this machine.

To build and install the simulator development client without Expo CLI's Simulator-window AppleScript step:

```sh
npm run ios:dev-client:build
```

The script runs `xcodebuild`, installs the built `Mongchi.app` with `xcrun simctl install`, and verifies the installed app container for `com.defineyou.mongchi`. It is quiet by default; set `TINY_PET_IOS_DEV_CLIENT_VERBOSE=true` when full `xcodebuild` logs are needed. The local iPhone 16 Pro development-client build/install has passed with this AppleScript-free path.

## Device Screenshot QA

With the app open on a booted iOS simulator or connected Android emulator/device, capture QA evidence with:

```sh
npm run qa:mobile-screenshots
```

The script saves PNGs to `docs/qa-screenshots`, validates that each capture is a non-empty PNG, and prints the captured dimensions. Use `TINY_PET_QA_PLATFORM=ios`, `TINY_PET_QA_PLATFORM=android`, or `TINY_PET_QA_PLATFORM=all` when a specific platform must be present. Use `TINY_PET_QA_LABEL=<screen-name>` to make the output filename describe the current screen.

## Store Screenshot Presets

QA and store-capture builds can start from deterministic local app states with:

```sh
EXPO_PUBLIC_TINY_PET_STORE_SCREENSHOT_PRESET=hatching npm run start:mobile
```

Supported presets are `welcome`, `photo-upload`, `pet-setup`, `hatching`, `pet-reveal`, `terrarium`, `chat`, `shop`, and `walk-reward`. Aliases such as `generation`, `reveal`, `ai-chat`, and `premium-bond` are normalized to those presets. When a preset is set, the app routes from the splash screen to the matching native screen and does not overwrite the existing AsyncStorage session. Production release-config validation rejects this env var.

QA-only operational screens use a separate preset env so they do not become store screenshot states. For example, Settings privacy failure copy can be captured on iOS with:

```sh
npm run capture:ios-settings-privacy-evidence
```

That script boots `EXPO_PUBLIC_TINY_PET_QA_SCREEN_PRESET=settings-privacy-error` and captures `ios-*-settings-privacy-status.png`. The progress state can be captured with:

```sh
npm run capture:ios-settings-privacy-progress-evidence
```

That command boots `EXPO_PUBLIC_TINY_PET_QA_SCREEN_PRESET=settings-privacy-progress` and captures `ios-*-settings-privacy-progress.png`. Production release-config validation rejects both QA preset values.

`docs/store-screenshot-manifest.json` is the submission screenshot manifest. Each entry maps a preset to its route, `TINY_PET_QA_LABEL`, and store caption. Use `npm run validate:store-screenshots` while preparing the app. After iOS store screenshots have been captured during the iOS-only intermediate pass, enforce iOS screenshot coverage without requiring Android:

```sh
npm run validate:ios-store-screenshots
```

After an iOS-only UI/art pass, confirm the current iOS store screenshots are newer than the latest visual source without requiring Android recapture:

```sh
npm run validate:ios-final-screenshot-freshness
```

Run full strict mode before submission:

```sh
TINY_PET_REQUIRE_STORE_SCREENSHOTS=true npm run validate:store-screenshots
```

Strict mode requires at least one iOS and one Android PNG for every store preset, named like `ios-iphone-16-pro-store-welcome.png` or `android-pixel-8-store-welcome.png`. The environment also accepts `TINY_PET_REQUIRE_STORE_SCREENSHOTS=ios`, `android`, or `all`; use `android` or `all` only during the final Android pass.

After any final cross-platform UI, item art, pet art, background, plant stage, visual token, or store preset change, recapture the iOS/Android store screenshots and then run:

```sh
npm run validate:final-screenshot-freshness
```

This final-only guard fails when a store screenshot is older than the current visual source files, so old captures cannot pass the final submission gate after an art pass.

For each final screenshot, launch the build with the matching preset, then capture with the matching label from the manifest:

```sh
EXPO_PUBLIC_TINY_PET_STORE_SCREENSHOT_PRESET=welcome npm run start:mobile
TINY_PET_QA_PLATFORM=ios TINY_PET_QA_LABEL=store-welcome npm run qa:mobile-screenshots
```

Repeat for every manifest preset and platform. Restart the app bundle between presets so the public preset env is applied cleanly.

For iOS preset capture automation, boot an iOS simulator and run:

```sh
npm run capture:ios-store-screenshots
```

To capture only part of the manifest while iterating, pass a comma-separated preset list:

```sh
TINY_PET_IOS_STORE_SCREENSHOT_PRESETS=welcome,pet-setup npm run capture:ios-store-screenshots
```

When more than one iOS simulator is booted, target a specific device with its UDID or name:

```sh
TINY_PET_IOS_STORE_SCREENSHOT_DEVICE_UDID=<simulator-udid> \
TINY_PET_IOS_STORE_SCREENSHOT_CLIENT=development-client \
TINY_PET_IOS_STORE_SCREENSHOT_PRESETS=welcome \
npm run capture:ios-store-screenshots
```

The script starts Expo Metro with a cleared transform cache on port `8091` by default, opens each preset in the booted iOS simulator, captures with `TINY_PET_QA_PLATFORM=ios`, rejects React Native red error screens, iOS open-link prompts, and development-client tools overlays, and runs `npm run validate:ios-store-screenshots` after all manifest presets are captured. The screenshot validator also rejects same-device store captures that are visually too similar across different presets, which catches stale cached screens. Preview captures from Expo Go are useful for layout QA, but final App Store captures should use the development-client or production path.

After an iOS simulator development client is installed, recapture through that client with:

```sh
TINY_PET_IOS_STORE_SCREENSHOT_CLIENT=development-client npm run capture:ios-store-screenshots
```

In development-client mode the script opens `{scheme}://expo-development-client/?url=...&disableOnboarding=1`, using the app scheme from `apps/mobile/app.json`. It also primes `EXDevMenuIsOnboardingFinished=true` and `EXDevMenuShowFloatingActionButton=false` in the simulator app defaults so the first-run dev menu sheet and floating tools button cannot appear in store screenshots.

On a fresh simulator install, iOS can show an `Open in "Mongchi"?` confirmation before handing the deep link to the development client. The screenshot capture and store screenshot validators reject screenshots containing that prompt so it cannot be submitted accidentally. If the prompt appears, accept it once in Simulator, then rerun the development-client capture command.

The capture script also writes `docs/qa-screenshots/ios-iphone-16-pro-store-contact-sheet.png` when the full manifest is captured. Regenerate it manually after screenshot edits with:

```sh
npm run generate:ios-store-contact-sheet
```

For final Android recapture/signoff, connect or boot one Android emulator/device with the development client or production build installed, then run:

```sh
npm run capture:android-store-screenshots
```

The Android capture script uses the same store screenshot manifest and `EXPO_PUBLIC_TINY_PET_STORE_SCREENSHOT_PRESET` values as the iOS path, starts Expo Metro on port `8093`, opens each preset through `adb`, captures with `TINY_PET_QA_PLATFORM=android`, and runs `npm run validate:android-store-screenshots` after the full manifest is captured. This command is intentionally reserved for final Android recapture/signoff, not the intermediate iOS loop.
When the full manifest is captured, the script also writes `docs/qa-screenshots/android-<device>-store-contact-sheet.png`. Regenerate or validate it manually with:

```sh
npm run generate:android-store-contact-sheet
npm run validate:android-store-contact-sheet
```

When more than one Android device is connected, target a specific device with:

```sh
TINY_PET_ANDROID_STORE_SCREENSHOT_SERIAL=<adb-serial> npm run capture:android-store-screenshots
```

Android emulator networking defaults to `10.0.2.2` for reaching the host Metro server. For a physical device, set a reachable host or LAN IP:

```sh
TINY_PET_ANDROID_STORE_SCREENSHOT_HOST=<host-or-lan-ip> npm run capture:android-store-screenshots
```

To capture only part of the manifest while repairing final Android screenshots, pass a comma-separated preset list:

```sh
TINY_PET_ANDROID_STORE_SCREENSHOT_PRESETS=welcome,pet-setup npm run capture:android-store-screenshots
```

`npm run validate:ios-store-contact-sheet` checks that the contact sheet exists, is a valid multi-screen PNG, and is not older than the source iOS store screenshots.
`npm run validate:android-store-contact-sheet` performs the same freshness check for the current or final Android store screenshots.

## Store Privacy Forms

`docs/release/store-privacy-data-safety.md` contains the current App Store privacy label and Google Play Data safety draft, based on the implemented mobile permissions, API contracts, safe analytics boundary, operational logging redaction, and server-side provider boundaries. Run `npm run validate:store-compliance` and `npm run validate:privacy-sdk-boundaries` after changing photo upload, premium chat, purchases, analytics, diagnostics, tracking, advertising, auth, storage, or provider integrations.

## Store Listing Copy

`docs/release/store-listing-draft.md` contains the current App Store and Google Play listing copy, review notes, release notes, and screenshot captions for the first native store package. Run `npm run validate:store-listing` after changing product positioning, premium chat copy, privacy copy, screenshot preset names, or store product names.

## EAS Profiles

`eas.json` defines:

- `development`: internal development client build.
- `preview`: internal distribution build.
- `production`: production profile with auto-incrementing versions.

## Current Boundaries

- Photo selection can use native library/camera, but selected images remain local-only until backend upload is implemented.
- Sample-photo selection remains available only as a fallback for simulator/demo use.
- A production API fetch client boundary exists for app requests, session-token resolution, auth token injection, base URL validation, and safe error mapping; local/integration runtime sessions can still use local prototype state unless an API base URL is configured, but production release-config validation requires `EXPO_PUBLIC_TINY_PET_API_BASE_URL`.
- AI generation, premium chat provider calls, payments, storage, and backend services require a configured backend; provider calls stay server-side and are never wired directly into the mobile app.
- Provider keys and service secrets must stay out of the mobile app.
- Use `EXPO_PUBLIC_TINY_PET_API_BASE_URL` only for a public backend base URL. The mock auth token env is development metadata only. Do not place provider keys, service tokens, payment secrets, receipt secrets, or production auth secrets in mobile env files.
- After real production legal URLs, auth/JWKS, Postgres, S3, store verifier, commerce webhook, OpenAI/provider, and worker values are available, run `npm run validate:production-release-config` before closed-test packaging.
- After final UI/art changes, recapture store screenshots and run `npm run validate:final-screenshot-freshness` before closed-test packaging.
- Run `npm run validate:final-release-runbook` before the final gate if the runbook, release checklist, or package scripts changed.
- The final cross-platform release gate is `TINY_PET_FINAL_RELEASE_ALLOW_ANDROID=true npm run validate:final-release`. It intentionally requires an explicit env flag because it runs Android validation and strict iOS/Android store screenshot coverage; intermediate iOS preflight only dry-runs the final plan.
