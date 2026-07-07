# iOS Manual QA Checklist

This checklist is the intermediate device QA path while implementation continues on the iOS simulator and iOS builds. Android validation and TalkBack are final completion checks, not part of the intermediate loop.

## Scope And Evidence

- Primary intermediate device: iPhone 16 Pro simulator or device on the current supported iOS version.
- Small-screen spot check: iPhone 16e or the smallest supported iOS viewport available to QA.
- Intermediate validation command: `npm run validate:ios-preflight`.
- Static checklist gate: `npm run validate:ios-manual-qa`.
- Screenshot capture command: `TINY_PET_QA_PLATFORM=ios TINY_PET_QA_LABEL=<screen-name> npm run qa:mobile-screenshots`.
- Store preset env: `EXPO_PUBLIC_TINY_PET_STORE_SCREENSHOT_PRESET=<preset>`.
- Reduced-motion hatching capture command: `npm run capture:ios-reduce-motion-hatching`.
- Reduced-motion core screen capture command: `npm run capture:ios-reduce-motion-core-evidence`.
- Settings privacy status capture commands: `npm run capture:ios-settings-privacy-evidence` and `npm run capture:ios-settings-privacy-progress-evidence`.
- Large-text evidence capture command: `npm run capture:ios-large-text-evidence`.
- Final App Store screenshots must be captured from a development-client or production build without Expo Go overlays.
- Evidence belongs in `docs/qa-screenshots` and should be summarized in `docs/qa-device-checks.md`.

## First Session Flow

Verify the native first-session path in order:

- Welcome -> Photo upload -> Pet setup -> Hatching -> Pet reveal.
- Welcome opens with the decomposed terrarium art, readable copy, and primary CTA visible.
- Photo upload presents the permission/consent copy before the native photo picker path.
- Pet setup keeps the portrait art, profile ribbon, species choice, traits, and confirm CTA usable after photo selection.
- Hatching shows user-facing progress copy and a readable progressbar.
- Pet reveal exposes Enter terrarium, Try again, and Report issue without overlap.

## Main Terrarium Loop

Verify the post-reveal native loop:

- Main terrarium renders the pet, background, placed items, care controls, inventory entry, and settings entry.
- Shop flow shows credit HUD, category browsing, owned/locked states, and purchasable care/theme options.
- Shop uses bundled item art, owned/locked states, Plus pass destination, and restore purchases entry.
- AI chat / premium bond locked state shows the Plus pass CTA and routes to shop; entitlement-enabled builds should keep provider calls server-side.
- Settings, Privacy controls, Terms, Support, and data deletion actions are reachable.

## VoiceOver Checklist

Enable VoiceOver in iOS Accessibility settings and verify:

- Screen titles expose a VoiceOver header and primary actions are reachable in logical order.
- Decorative images are skipped by the screen reader.
- Meaningful images, including pet, inventory, shop, product, reward, and CTA art, have useful labels.
- Buttons announce role, label, disabled state, and selected state where applicable.
- Text inputs announce label, purpose, and editable state.
- The hatching progressbar announces the current progress state without requiring animation.
- Native permission prompts, denial fallback, and delete original photo confirmation are understandable.
- Privacy controls and destructive confirmation dialogs can be completed without visual-only cues.

## Reduced Motion Checklist

Enable iOS Settings -> Accessibility -> Motion -> Reduce Motion and verify:

- Hatching uses the manual continue control instead of scheduled automatic progress.
- The progressbar and status copy remain readable while motion is reduced.
- Pet reveal, terrarium, shop, and chat screens remain usable without relying on animation timing.
- Turning Reduce Motion off restores the normal hatching progress behavior on the next active generation run.
- The automated iOS evidence capture turns Reduce Motion on for the hatching preset, captures `ios-*-reduce-motion-hatching.png`, and restores the previous simulator setting.
- The automated core evidence capture turns Reduce Motion on for Pet reveal, Main terrarium, AI chat / premium bond, and Shop presets, captures `ios-*-reduce-motion-pet-reveal.png`, `ios-*-reduce-motion-terrarium.png`, `ios-*-reduce-motion-chat.png`, and `ios-*-reduce-motion-shop.png`, and restores the previous simulator setting after each capture.

## Text And Layout Checklist

Check default text size and at least one larger iOS text size:

- Welcome, Photo upload, Pet setup, Hatching, Pet reveal, Main terrarium, AI chat / premium bond, Shop, Settings, Privacy, and Support do not show overlapping text or clipped primary CTAs.
- First-viewport CTAs stay visible on iPhone 16 Pro and the selected small-screen iOS device.
- Large-text evidence should be captured from a small iOS development client with `npm run capture:ios-large-text-evidence`; this sets a larger iOS content size, captures the nine deterministic presets with `large-text-*` labels, and restores the previous simulator content size. Extreme accessibility content sizes still require manual judgment with VoiceOver and scrolling behavior.
- Keyboard, permission, and confirmation dialogs do not permanently hide the current primary action.
- Long pet names, local catalog labels, and support report categories wrap cleanly.

## Photo Privacy And Consent Checklist

Verify the photo path and privacy controls:

- Photo permission/consent copy appears before users pick or capture a pet photo.
- Permission denial leaves a recoverable path back to sample/local photo selection.
- Delete original photo clears the local source-photo reference while keeping the generated pet state.
- Report issue records only a coarse generation category and never asks the user to attach raw photos or chat text.
- Privacy controls explain local and API-backed deletion behavior clearly.
- Settings privacy status evidence should be captured with `npm run capture:ios-settings-privacy-evidence` and `npm run capture:ios-settings-privacy-progress-evidence`; these boot QA-only `settings-privacy-error` and `settings-privacy-progress` presets, capture `ios-*-settings-privacy-status.png` and `ios-*-settings-privacy-progress.png`, and are blocked from production release config.

## Store Screenshot QA Notes

- Use the store preset env to boot deterministic states: `welcome`, `photo-upload`, `pet-setup`, `hatching`, `pet-reveal`, `terrarium`, `chat`, and `shop`.
- Use the matching manifest label with `TINY_PET_QA_PLATFORM=ios` for each iOS capture.
- Intermediate iOS captures can use Expo Go when checking layout, but final App Store captures require a development-client or production build without Expo Go overlays.
- Strict screenshot validation with required iOS and Android PNG coverage is a final completion gate.
- Android screenshot/export evidence is outside this intermediate iOS checklist and is tracked separately; TalkBack and Android Reduce Motion remain final Android manual completion checks.

## Signoff Template

Record each manual pass with:

- Date and tester.
- Device model, iOS version, and build type.
- Screen or preset name.
- Evidence screenshot filename when visual evidence is relevant.
- VoiceOver result.
- Reduce Motion result.
- Text/layout result.
- Privacy/consent result.
- Follow-up issue link or a clear "none" result.
