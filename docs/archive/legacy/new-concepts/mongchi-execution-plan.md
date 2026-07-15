# Mongchi Execution Plan

This is a new standalone pet-life game concept. Treat any existing codebase only as optional reference material if it matches this guide.

## Related Documents

- [Organized Part-Based Guide](mongchi-guide/README.md)
- [Concept Plan](mongchi-plan.md)
- [Final Completion Guide](mongchi-completion-guide.md)
- [UX Flow](mongchi-ux-flow.md)
- [Asset Prompt Bible](mongchi-asset-prompt-bible.md)
- [AI Pipeline](mongchi-ai-pipeline.md)
- [Data Model And API](mongchi-data-model-api.md)
- [Reaction Catalog](mongchi-reaction-catalog.md)
- [Security And Privacy](mongchi-security-privacy.md)

## 1. Product Summary

Mongchi is a cross-platform iOS/Android pet-life game where users upload a real dog or cat photo and create a tiny digital avatar that lives inside a cozy glass-dome terrarium.

The product combines:

- Light game loops: feed, talk, walk, affection, garden care, daily rewards.
- Healing companion experience: the pet feels emotionally present and reacts warmly.
- AI creation: the pet avatar is generated from the user's actual pet photo.
- AI conversation: short free state-based reactions by default, premium long-form chat later.
- Collection and monetization: terrarium decoration, themes, extra pets, regeneration, special treats.

## 2. Core Decisions

- Platform target: iOS and Android.
- Client default: React Native with Expo as the first candidate.
- Visual direction: cozy pixel terrarium, soft 2.5D, modern rounded mobile UI.
- Photo input: one required photo, optional extra photos only if quality testing proves value.
- Generation editing: no manual post-generation editor in MVP.
- Free pet reactions: unlimited if they are local/authored and do not call AI.
- Premium candidate: extended chatbot-style conversation.
- Walk: MVP starts as idle action and reward return, not GPS or step-based walking.
- Items: start decoration-only; treats may later trigger special behaviors and become BM.

## 3. UX Principles

- The first session must feel guided, safe, and emotionally warm.
- The app should explain why each step exists before asking for effort.
- Avoid guilt-heavy Tamagotchi pressure. Missing a day should create a gentle return moment, not punishment.
- The pet can feel personal, but the app must not imply the real animal's consciousness is inside the app.
- UI should keep the pet and terrarium as the emotional center. Counters and systems should stay secondary.
- Monetization should feel like added affection, expression, and personalization, not a penalty.

## 4. Overall UX Flow

### 4.1 First Session

```text
App open
-> Warm welcome popup
-> Mongchi concept illustration
-> Pet name and personality setup
-> Pet photo upload
-> Friendly generation / hatching scene
-> Generated pet preview
-> Enter first terrarium
-> First short pet reaction
-> First care action
-> First small reward
```

### 4.2 Daily Loop

```text
Open app
-> Pet greets user with state-based reaction
-> User chooses one or more care actions
-> Terrarium reacts visually
-> User may send pet on walk
-> User receives small reward / message / item
-> Optional decoration or premium chat entry
```

### 4.3 Premium Chat Loop

```text
Tap talk
-> Free short reaction if normal care context
-> Offer extended chat when user wants open conversation
-> Premium gate / credit use / subscription path
-> Chat memory uses pet name, selected traits, care history, and safe context
```

### 4.4 Walk Loop

```text
Tap walk
-> Pet leaves for short idle walk
-> Timer or short background state
-> Pet returns with reward
-> Reward can be affection, small item, garden item, or short message
```

## 5. MVP Screens

### 5.1 Welcome

Purpose:

- Make the concept understandable in 5 seconds.
- Build trust before asking for a pet photo.
- Lead directly into setup.

Required elements:

- Tiny terrarium illustration.
- One clear primary action.
- Short privacy reassurance.
- No dense feature explanation.

Imagegen asset:

- Welcome illustration showing a tiny glass terrarium and a warm pet silhouette.

### 5.2 Pet Setup

Purpose:

- Collect emotional personalization before upload.
- Seed local reactions and premium chatbot personality.

Fields:

- Pet name.
- Species: dog or cat for MVP.
- Personality chips: playful, calm, shy, curious, sleepy, affectionate.
- Talking style chips: cute, comforting, cheerful, gentle.
- Optional memory note: short user-written note for premium chat later.

MVP rule:

- Keep setup under 60 seconds.
- Allow "skip for now" for non-essential fields.

### 5.3 Photo Upload

Purpose:

- Receive one clear photo.
- Explain quality tips without making the user feel judged.

Requirements:

- One required image.
- Optional add more photos later, hidden behind a secondary action.
- Photo quality guidance with visual examples.
- Consent copy for AI processing.

Imagegen asset:

- Upload guide illustration: good lighting, clear face/body, no clutter.

### 5.4 Generation / Hatching

Purpose:

- Turn waiting into anticipation.
- Reduce anxiety around AI processing.

Requirements:

- Progress states: preparing, creating, polishing, moving in.
- Hatching terrarium visual.
- Safe retry state.
- No fake precision timers unless supported.

Imagegen asset:

- Glass-dome hatching scene.

### 5.5 Pet Preview

Purpose:

- Let the user approve the generated pet without complex editing.

Actions:

- Accept.
- Regenerate if allowed.
- Report issue.

MVP rule:

- No manual body/eye/color editor.

### 5.6 Main Terrarium

Purpose:

- The main emotional/game hub.

Required UI:

- Central pet.
- Terrarium scene.
- State-based speech bubble.
- Bottom care actions: feed, talk, walk, affection, water.
- Side entry points: items, rewards, settings.
- Top light counters: affection, energy/garden, premium currency only if needed.

Rendering:

- Start with React Native UI composition and layered PNG/WebP assets.
- Use JSON layout metadata for pet, props, and decorations.

### 5.7 Free Reaction Bubble

Purpose:

- Make the pet feel alive without AI cost.

Inputs:

- Hunger.
- Energy.
- Affection.
- Recent action.
- Missed visits.
- Time of day.
- Walk status.
- Personality traits.

Output:

- Short authored reaction line.
- Optional pet animation state.

### 5.8 Premium Chat

Purpose:

- Provide deeper emotional interaction and monetization path.

MVP stance:

- Can be prototype-gated or deferred, but the architecture should reserve it.

Safety:

- Clear AI disclosure.
- No medical, legal, financial advice positioning.
- Crisis and self-harm safety handling if user messages require it.
- Avoid claiming the AI is the actual pet.

### 5.9 Items / Decoration

Purpose:

- Give users expression and progression.

MVP:

- Starter items.
- Simple slots or grid placement.
- Decoration-only effects.

Later:

- Special treats that trigger unique animations.
- Premium terrarium themes.
- Seasonal packs.

### 5.10 Settings / Privacy

Required:

- Delete pet.
- Delete original photo.
- Delete account.
- Manage AI data permissions.
- Restore purchases.
- Contact/support/report issue.

## 6. Imagegen Asset Plan

Use imagegen for emotional flow support, not only final UI polish.

Initial assets:

- Welcome concept art.
- Upload guide.
- Generation/hatching scene.
- First terrarium empty state.
- First reward card.
- Error/retry illustration.

Rules:

- Keep all prompt output aligned with the reference image in `docs/new-concepts/assets/mongchi-reference-v1.png`.
- Avoid readable text inside generated images.
- Store all accepted assets under `docs/new-concepts/assets/` or a future app asset folder.
- Each image prompt should include: cozy pixel terrarium, glass dome, pet-life game, soft 2.5D, modern rounded UI, no logo, no readable text.

## 7. Modular Architecture

### 7.1 Client Modules

Proposed React Native/Expo structure:

```text
apps/mobile/
  app/
    onboarding/
    terrarium/
    chat/
    shop/
    settings/
  src/
    features/
      onboarding/
      pet-creation/
      generation/
      terrarium/
      care/
      reactions/
      chat/
      walk/
      inventory/
      shop/
      privacy/
    shared/
      api/
      auth/
      config/
      design/
      analytics/
      storage/
      validation/
    domain/
      pet/
      care/
      assets/
      inventory/
      conversation/
```

Client module rules:

- `features/*` owns screen-level UI and feature state.
- `domain/*` owns pure data models and rules.
- `shared/api` owns network clients and DTO mapping.
- `shared/design` owns tokens, buttons, cards, icon buttons, and layout helpers.
- `features/reactions` must work offline and without AI calls.
- `features/chat` must call server APIs only; no provider keys in client.

### 7.2 Backend Modules

```text
services/api/
  auth/
  users/
  pets/
  photos/
  generation/
  assets/
  care/
  reactions/
  conversation/
  inventory/
  commerce/
  safety/
  analytics/
  admin/
```

Backend module responsibilities:

- `auth`: user session verification.
- `photos`: upload URL, photo metadata, deletion.
- `generation`: job creation, status, retry, quota.
- `assets`: generated pet asset metadata and signed URLs.
- `care`: pet state, daily loop, walk timers, rewards.
- `reactions`: authored reaction catalog and selection rules.
- `conversation`: premium chat gateway, conversation memory, moderation.
- `inventory`: owned items and placement.
- `commerce`: entitlements, purchases, restore, refunds.
- `safety`: upload moderation, chat safety, abuse controls.
- `analytics`: privacy-safe product events.

### 7.3 AI Worker Modules

```text
services/ai-worker/
  input_validation/
  photo_preprocess/
  safety_precheck/
  avatar_generation/
  sprite_derivation/
  postprocess/
  quality_scoring/
  storage_writer/
  job_reporter/
```

AI worker responsibilities:

- Validate file type, size, dimensions.
- Preprocess crop/resize.
- Run moderation/safety checks.
- Generate avatar from one required photo.
- Optionally use extra photos for identity hints.
- Derive minimal states: idle, happy, sleep, play.
- Remove background and normalize asset sizes.
- Run quality checks before publishing.
- Report job status and errors back to API.

## 8. Shared Data Contracts

Key models:

- `UserProfile`
- `PetProfile`
- `PetPersonality`
- `SourcePhoto`
- `GenerationJob`
- `GeneratedPetAsset`
- `CareState`
- `ReactionRule`
- `ReactionLine`
- `ConversationSession`
- `TerrariumLayout`
- `InventoryItem`
- `OwnedItem`
- `WalkSession`
- `Entitlement`

Example care state:

```json
{
  "pet_id": "pet_123",
  "hunger": 42,
  "energy": 78,
  "affection": 63,
  "garden_health": 88,
  "last_fed_at": "2026-06-24T00:00:00Z",
  "last_played_at": "2026-06-24T00:00:00Z",
  "last_seen_at": "2026-06-24T00:00:00Z",
  "walk_status": "idle",
  "personality_tags": ["gentle", "curious"]
}
```

Example reaction rule:

```json
{
  "id": "reaction_hungry_gentle_morning_001",
  "conditions": {
    "hunger_min": 70,
    "time_bucket": "morning",
    "personality_tags_any": ["gentle"]
  },
  "lines": [
    "I was hoping you would come by. Breakfast smells nice today.",
    "Good morning. I think my bowl is trying to get your attention."
  ],
  "animation": "hungry_idle",
  "priority": 80
}
```

## 9. Frontend Plan

### 9.1 Stack Candidate

Default:

- React Native.
- Expo framework.
- TypeScript.
- Expo Router or equivalent route structure.
- Server-state library for API queries.
- Local store for short-lived UI and offline care cache.

Why this direction:

- React Native targets iOS and Android with a shared codebase.
- The official React Native docs recommend using a framework for new apps, and call Expo a production-grade React Native framework.
- Expo supports a single JS/TS project that can run on native devices, which fits the first MVP.

### 9.2 Rendering Approach

MVP:

- Layered images and React Native views.
- Simple transform animations.
- JSON-driven terrarium layout.
- Local reaction bubble and lightweight pet animation states.

Potential upgrades:

- React Native Skia for richer 2D rendering.
- Rive or Lottie for polished UI/pet animations.
- Unity only if mini-games or real-time scene complexity outgrow RN.

### 9.3 Frontend Milestones

1. App shell and navigation.
2. Design tokens and reusable UI controls.
3. Welcome and setup flow.
4. Photo upload UI and consent.
5. Generation status and hatching scene.
6. Pet preview and accept/regenerate.
7. Main terrarium screen.
8. Local reaction engine.
9. Care actions and walk idle loop.
10. Inventory starter items.
11. Settings/privacy.
12. Premium chat placeholder/gate.

### 9.4 Frontend Tests

- Unit tests for reaction rule selection.
- Unit tests for care state transitions.
- Component tests for onboarding steps.
- E2E smoke for first-session flow.
- Visual checks for main terrarium layout on small/large phones.

## 10. Backend Plan

### 10.1 API Responsibilities

- Authenticate users.
- Issue upload URLs.
- Create generation jobs.
- Return job status.
- Serve signed generated asset URLs.
- Store pet profile and personality.
- Store care state and walk sessions.
- Select or serve reaction rule catalogs.
- Gate premium chat and commerce entitlements.
- Delete photo, pet, and account data.

### 10.2 Storage

Separate buckets or access classes:

- Private original photos.
- Private/generated working assets.
- App-readable generated pet assets.
- Public share exports only when user explicitly shares.

Rules:

- Original photos should never be public.
- Generated share images should be user-controlled.
- Signed URLs should be short-lived.
- Deletion must cover metadata and object storage.

### 10.3 Backend Milestones

1. Auth/session foundation.
2. Photo upload endpoint.
3. Generation job table and API.
4. AI worker job claim/status protocol.
5. Generated asset metadata API.
6. Pet profile/personality API.
7. Care state API.
8. Reaction catalog API or bundled catalog versioning.
9. Walk session API.
10. Inventory and item catalog.
11. Commerce entitlement skeleton.
12. Privacy deletion flows.

### 10.4 Backend Tests

- Auth boundary tests.
- Upload validation tests.
- Generation job state-machine tests.
- Signed URL access tests.
- Care state transition tests.
- Deletion cascade tests.
- Entitlement gate tests.
- Abuse/rate-limit tests.

## 11. AI Generation Plan

### 11.1 MVP Generation Contract

Input:

- One required pet photo.
- Pet species.
- Pet name.
- Personality tags.
- Optional extra photos.

Output:

- Transparent pet avatar PNG/WebP.
- Idle asset.
- Happy asset.
- Sleep asset.
- Play asset.
- Metadata: style version, source hash, generation job id, quality score.

### 11.2 Quality Gates

Before publishing:

- File exists and is decodable.
- Has expected dimensions.
- Background is transparent or key removed.
- Pet is centered and visible.
- No unsafe content.
- No obvious duplicate/corrupt frame.
- Quality score passes threshold.

### 11.3 Failure Handling

Failure states:

- Upload invalid.
- Moderation blocked.
- Generation failed.
- Quality failed.
- Timeout.
- User rejected result.

User-facing handling:

- Keep language soft and non-technical.
- Offer retry.
- Offer upload new photo.
- Preserve credit if paid generation fails.

## 12. Conversation And Reaction Plan

### 12.1 Free Reactions

Free reactions are authored, local/server-provided, and do not call AI.

Dimensions:

- Hunger.
- Energy.
- Affection.
- Garden health.
- Recent action.
- Time of day.
- Days away.
- Walk status.
- Pet personality.

Benefits:

- No variable AI cost.
- Fast response.
- Easier safety control.
- Still feels alive if enough lines exist.

### 12.2 Premium Chat

Premium chat calls an AI provider through the backend only.

Context:

- Pet name.
- Species.
- Personality tags.
- User-selected talking style.
- Recent care history.
- Optional user memory note.

Safety:

- No provider keys in app.
- Moderation for user input and model output.
- Crisis handling policy.
- Clear disclosure that this is AI-generated conversation.
- No claim that the real pet is literally speaking.

## 13. Commerce Plan

MVP-friendly monetization candidates:

- Premium extended chat.
- Extra pet slots.
- Style regeneration packs.
- Premium terrarium themes.
- Visible item packs.
- Special treats that trigger unique animations.

Avoid at MVP:

- Random loot boxes.
- Punishment-based monetization.
- Paid recovery from neglect.
- Paywall before first emotional success.

Commerce rules:

- First pet creation should feel generous.
- Failed generation should not consume paid value unfairly.
- Purchases and entitlements must be server-confirmed.
- Restore purchases must exist before launch.

## 14. Security, Privacy, And Safety

### 14.1 Photo Privacy

Risks:

- Original pet photos are personal user content.
- Photos may accidentally include people, homes, addresses, or metadata.

Controls:

- Strip EXIF metadata before provider processing where possible.
- Store original photos privately.
- Use short-lived upload/download URLs.
- Do not expose original photo URLs to other users.
- Provide delete photo and delete pet flows.
- Document provider data handling before launch.

### 14.2 AI Provider Safety

Controls:

- Server-side provider calls only.
- No API keys in mobile app.
- Preflight moderation for uploaded images.
- Provider error isolation.
- Cost budget and rate limits.
- Job tracing for debugging.

### 14.3 Chat Safety

Risks:

- User may disclose sensitive content.
- User may emotionally over-attach.
- Model may produce unsafe or inappropriate advice.

Controls:

- Input/output moderation.
- Crisis response policy.
- Clear AI disclosure.
- Conversation retention settings.
- Age and content policy decisions before launch.
- Avoid grief exploitation or claims of resurrecting a pet's consciousness.

### 14.4 Commerce Security

Controls:

- Server-side purchase verification.
- Entitlement ledger.
- Refund/revocation handling.
- Idempotent purchase grant.
- No trust in local purchase state alone.

### 14.5 Backend Security

Controls:

- Auth required for all user data.
- Row-level ownership or equivalent access control.
- Signed URLs for private assets.
- Rate limits on upload, generation, and chat.
- Abuse monitoring.
- Structured audit logs for generation and purchase actions.

## 15. Analytics And Metrics

MVP metrics:

- Welcome to upload conversion.
- Upload to generated pet completion.
- Generated pet acceptance rate.
- First care action completion.
- Day 1 return.
- Day 7 return.
- Free reaction engagement.
- Premium chat CTA view and conversion.
- Item placement rate.

Privacy rule:

- Do not log raw chat text or images into product analytics.
- Use event names and metadata only.

## 16. Work Plan

### Phase 0: Product Lock

Deliverables:

- Final MVP scope.
- UX flow spec.
- Safety and privacy assumptions.
- Tech stack decision.

Exit criteria:

- The team can build a prototype without re-deciding the concept.

### Phase 1: UX Prototype

Deliverables:

- Welcome, setup, upload, generation, preview, main terrarium wireframes.
- Imagegen support assets for onboarding.
- Reaction bubble behavior spec.

Exit criteria:

- First-session flow is understandable without explanation.

### Phase 2: Technical Foundation

Deliverables:

- React Native/Expo app shell.
- API skeleton.
- Auth/session placeholder.
- Shared TypeScript data contracts.
- Storage path and asset metadata design.

Exit criteria:

- App can call backend and load mock pet/terrarium data.

### Phase 3: AI Generation MVP

Deliverables:

- Photo upload.
- Generation job lifecycle.
- Mock provider.
- Real provider adapter behind server/worker.
- Generated asset publishing.

Exit criteria:

- A user photo can become a displayed pet asset in the app.

### Phase 4: Care And Reaction Loop

Deliverables:

- Care state model.
- Feed/talk/walk/affection/water actions.
- Authored reaction engine.
- Walk idle reward.

Exit criteria:

- A user can complete the daily loop without premium chat.

### Phase 5: Items And Rewards

Deliverables:

- Starter item catalog.
- Inventory.
- Simple terrarium placement.
- Daily gift.

Exit criteria:

- User can receive and place at least one item.

### Phase 6: Premium Chat And Commerce Skeleton

Deliverables:

- Premium chat gate.
- Chat backend gateway.
- Entitlement model.
- Purchase verification design.

Exit criteria:

- Premium chat can be tested in sandbox or behind a feature flag.

### Phase 7: Security, Privacy, QA

Deliverables:

- Deletion flows.
- Moderation flows.
- Rate limits.
- Privacy copy.
- E2E smoke tests.
- Release risk checklist.

Exit criteria:

- MVP is safe enough for closed testing.

## 17. Supporting Documents

Created supporting documents:

- [UX Flow](mongchi-ux-flow.md)
- [Asset Prompt Bible](mongchi-asset-prompt-bible.md)
- [AI Pipeline](mongchi-ai-pipeline.md)
- [Data Model And API](mongchi-data-model-api.md)
- [Reaction Catalog](mongchi-reaction-catalog.md)
- [Security And Privacy](mongchi-security-privacy.md)

## 18. Reference Notes

- React Native official docs recommend using a React Native framework for new apps and describe Expo as a production-grade framework: https://reactnative.dev/docs/environment-setup
- Expo describes its approach as one JavaScript/TypeScript project that can run natively across devices: https://docs.expo.dev/
