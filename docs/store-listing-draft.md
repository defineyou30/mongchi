# Store Listing Draft

> 최신 대조: 2026-07-08 (커밋 8e8fd0c 기준)

This draft is for App Store Connect and Google Play Console setup. It should stay aligned with the implemented native iOS/Android flow: Welcome -> Photo upload -> Pet setup -> Hatching -> Pet reveal -> Main terrarium -> AI chat / premium bond -> Shop.

## App Store Connect

- Name: Mongchi
- Subtitle: Hatch a tiny pet world
- Promotional Text: Turn one dog or cat photo into a cozy pet-world companion, then care, decorate, walk, and chat with clear privacy controls.
- Keywords: pet,avatar,dog,cat,terrarium,cozy,care,walk,shop,chat,ai,companion
- Primary Category: Games
- Secondary Category: Lifestyle

### App Store Description

Mongchi turns one clear dog or cat photo into a tiny companion for a cozy miniature pet world.

Start by picking one clear pet photo with consent, then name your pet, choose a species, and set the personality that should guide the first reactions while the hatching flow prepares a cozy avatar for the tiny home.

At home, you can care for your companion with simple daily actions, watch tiny reactions change with state and weather, and browse shop options for treats, themes, and cozy extras. Free reactions are authored for short, safe moments. Plus chat is clearly labeled as AI-generated, entitlement-gated, and designed for longer cozy conversations.

Privacy controls are part of the app shell. The selected original photo can be deleted separately from the generated avatar, chat history can be cleared, and pet data deletion paths are prepared for API-backed builds. Analytics and operational logs are designed to avoid raw photos, raw chat text, payment details, provider secrets, and receipt payloads.

Mongchi is built as a calm pet-life game for people who want a small companion space, not a social feed or ad network.

### App Store Review Notes

- Native permissions are limited to still-image camera/photo selection for user-chosen pet photos.
- Android microphone is explicitly blocked; iOS microphone usage is not requested.
- AI provider keys, payment verification secrets, and storage credentials stay server-side.
- Premium chat is disclosed as AI-generated and is not a medical, legal, financial, crisis, or professional-advice feature.
- Store screenshots should be captured from the deterministic presets documented in `docs/mobile-native-runbook.md`.

## Google Play Console

- App Name: Mongchi
- Short Description: Hatch a cozy pet avatar and care for a tiny friend.
- Category: Game
- Tags: pet, virtual pet, cozy, avatar, simulation

### Google Play Full Description

Create a tiny home for your dog or cat.

Mongchi lets you choose one clear pet photo, hatch a cozy avatar, and bring it into a floating garden home. Shape the first setup with a name, species, personality tags, talking style, and a favorite tiny thing.

Care for your companion with short daily actions, watch state-aware reactions change through the day, and browse shop options for treats, themes, and Plus pass options without putting payment or provider secrets in the mobile app.

Free pet reactions are authored locally for safe, quick moments. Plus chat is disclosed as AI-generated and uses server-side safety, entitlement, and retention boundaries when configured.

Privacy is central to the first-session flow. Photo consent is explicit, the original photo can be deleted separately, chat history can be cleared, and the production API path is designed around private storage, ownership checks, and safe deletion workers.

### Release Notes

Initial closed-test native slice for iOS and Android:

- First-session flow from welcome through pet reveal.
- Native photo picker and camera permission handling.
- Hatching progress, generated pet reveal, and main terrarium care loop.
- Care actions, shop preview, and Plus chat gate.
- Privacy, terms, support, and destructive-action confirmations.

## Screenshot Captions

| Preset | Caption |
| --- | --- |
| welcome | Start a tiny cozy world from one pet photo. |
| photo-upload | Choose a dog or cat photo with clear consent controls. |
| pet-setup | Shape the pet's name, species, personality, and voice while creation begins. |
| hatching | Watch the tiny companion hatch into the world. |
| pet-reveal | Meet the generated pet before entering the garden. |
| terrarium | Care, decorate, react, and keep the garden alive. |
| chat | Say a quick hello or view the Plus AI chat disclosure. |
| shop | Preview Plus pass and garden extras without mobile secrets. |

## Final Listing Checklist

- Replace or approve final icon, splash, pet, item, and background art before public screenshots.
- Capture final iOS and Android screenshots from a development-client or production build without Expo Go overlays.
- Confirm final privacy policy, terms, and support URL/email values before submission.
- Confirm final in-app purchase product IDs and display names with App Store Connect and Google Play Console.
- Re-run `npm run validate:store-metadata-alignment` after changing app config, permissions, screenshot captions, platform wording, or privacy/purchase copy.
- Re-run `npm run validate:store-listing` after changing product names, screenshots, permissions, privacy copy, or premium chat copy.
