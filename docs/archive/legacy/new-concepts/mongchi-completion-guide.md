# Mongchi Final Completion Guide

This is the final-product guide for Mongchi. It describes the intended complete product, not only the MVP. It should be used after the MVP/execution plan when deciding long-term scope, product depth, engineering modules, safety requirements, content systems, and release readiness.

Mongchi is a new standalone product concept.

## Related Documents

- [Organized Part-Based Guide](mongchi-guide/README.md)
- [Concept Plan](mongchi-plan.md)
- [Execution Plan](mongchi-execution-plan.md)
- [UX Flow](mongchi-ux-flow.md)
- [Asset Prompt Bible](mongchi-asset-prompt-bible.md)
- [AI Pipeline](mongchi-ai-pipeline.md)
- [Data Model And API](mongchi-data-model-api.md)
- [Reaction Catalog](mongchi-reaction-catalog.md)
- [Security And Privacy](mongchi-security-privacy.md)

## 1. Final Product North Star

Mongchi should become a mobile home for a user's beloved pet avatar:

- The user creates a pet from a real dog or cat photo.
- The pet lives in a tiny glass-dome terrarium.
- The user cares for it, talks with it, sends it on walks, decorates its world, and receives comfort.
- The pet feels alive through state-based reactions, animation, memory, and optional AI chat.
- The product is emotionally warm, game-like, collectible, and safe.

The final product should feel less like a generic pet simulator and more like:

```text
My pet has a tiny world in my phone, and it knows me.
```

## 2. Final Product Pillars

### 2.1 Personal Pet Avatar

The generated pet must feel connected to the user's real pet.

Final requirements:

- One-photo creation remains easy.
- Optional multi-photo creation improves identity matching.
- Pet name, species, personality, talking style, and memory notes shape both reactions and premium chat.
- Generated avatar has a stable identity across poses, states, icons, and share assets.
- Regeneration exists, but the app avoids endless frustrating rerolls.

Completion standard:

- Users should say, "This feels like my pet," not merely "This is a cute animal."

### 2.2 Living Terrarium

The terrarium is the main emotional and visual world.

Final requirements:

- The terrarium has day/night, weather, seasonal decorations, plants, props, and small ambient animations.
- The pet can idle, sleep, eat, react, play, walk out, return, and celebrate.
- Decorations change the visual world without overwhelming the pet.
- The main screen remains readable on small and large phones.

Completion standard:

- The home screen should feel pleasant even when the user does nothing for 10 seconds.

### 2.3 Care And Healing Loop

The game loop should be light and emotionally restorative.

Final requirements:

- Users can feed, talk, walk, play, pet/affection, water garden, clean, and give treats.
- The app rewards return visits without punishing absence too harshly.
- Pet states evolve with care history.
- The pet can express needs, gratitude, playfulness, and comfort.
- The daily session works in 30 seconds, but deeper play can last 5 minutes.

Completion standard:

- A user can open the app tired, care for the pet briefly, and leave feeling better.

### 2.4 AI Conversation

AI conversation is a premium emotional layer, not the only source of life.

Final requirements:

- Free state-based reactions are unlimited when they do not call AI.
- Premium extended chat uses AI through the backend only.
- The pet's voice uses name, personality, talking style, care history, and safe memory.
- AI chat is comforting and pet-like, not assistant-like.
- The product never claims the actual pet's consciousness is present.

Completion standard:

- The pet feels emotionally consistent whether using free reactions or premium chat.

### 2.5 Collection And Expression

Items should express affection and identity.

Final requirements:

- Users collect decorations, beds, toys, plants, bowls, terrain pieces, backgrounds, terrarium shells, accessories, and treats.
- Items are visible before purchase.
- Items can be earned, gifted, bought, unlocked, or event-based.
- Treats can trigger special behaviors or temporary animations.
- Premium items feel additive, not mandatory.

Completion standard:

- Users want to decorate because the pet already matters.

### 2.6 Trust And Safety

The product handles personal content, AI, and emotional attachment carefully.

Final requirements:

- Original photos are private.
- Users can delete photos, generated pets, chat history, and account data.
- AI provider usage is disclosed.
- Chat has safety boundaries and crisis handling.
- Monetization avoids grief exploitation and guilt loops.

Completion standard:

- The app feels emotionally intimate without feeling manipulative.

## 3. Final UX Map

### 3.1 First-Time Experience

Final flow:

```text
Splash
-> Welcome popup
-> Soft concept intro
-> Pet name
-> Pet personality and talking style
-> Photo upload
-> Optional extra photos
-> AI consent
-> Generation / hatching
-> Generated pet reveal
-> First terrarium entry
-> First pet message
-> First care action
-> First reward
-> Home screen tutorial fade-out
```

Final details:

- The welcome popup should guide upload, not feel like a generic onboarding carousel.
- Pet name and traits come before photo upload so the user invests emotionally before waiting.
- Optional extra photos are framed as a quality booster, not a requirement.
- The generation wait is a hatching moment with progress states.
- The first pet message should use the name and selected tone.

Completion standard:

- A new user should understand the concept and create a pet without needing external explanation.

### 3.2 Home / Terrarium UX

Final home hierarchy:

1. Pet and terrarium visual.
2. Pet speech/reaction.
3. Primary care actions.
4. Rewards and item opportunities.
5. Secondary navigation.
6. Resource counters.

Home actions:

- Feed.
- Talk.
- Walk.
- Play.
- Pet/affection.
- Water garden.
- Clean or tidy.
- Treat.
- Decorate.

Home states:

- Fresh morning.
- Hungry.
- Sleepy.
- Playful.
- Missing user.
- Just returned from walk.
- Gift available.
- Garden needs water.
- New item available.
- Premium chat available.

Completion standard:

- The home screen should work as both a game dashboard and a soothing companion view.

### 3.3 Care Action UX

Each care action should have:

- A clear trigger.
- A short animation.
- A state change.
- A reaction line.
- A possible reward.
- A cooldown or natural rhythm if needed.

Final care actions:

- Feed: restores hunger, can use normal food or special treats.
- Talk: free short response or premium long chat.
- Walk: sends pet away, returns with reward.
- Play: short toy interaction or mini-game.
- Affection: petting/tapping, raises bond.
- Water: maintains terrarium plants.
- Clean: refreshes terrarium/pet state.
- Treat: triggers special behavior or premium animation.

Completion standard:

- Every action should make the pet feel more alive, not just update a number.

### 3.4 Walk UX

Final walk progression:

1. MVP: idle walk and reward return.
2. Mid-product: walk missions, timers, outdoor item drops.
3. Final: optional step count, routes, weather/event walks, friend visit items.

Final walk states:

- Ready.
- Out walking.
- Returning soon.
- Returned with reward.
- Returned with message.
- Rare find.

Completion standard:

- Walk should feel like a small adventure without becoming a heavy fitness app.

### 3.5 Premium Chat UX

Final chat entry:

- Home talk button opens a short free reaction first.
- If user taps "talk more" or opens chat mode, premium gate appears when needed.
- Chat screen shows pet, terrarium context, and gentle reminders of AI nature.

Chat features:

- Pet-like conversational style.
- Memory of pet name/personality.
- Memory of selected user notes.
- Recent care context.
- Optional conversation topics.
- Safety fallback responses.

Completion standard:

- Premium chat should feel like a deeper bond, not a generic chatbot in a pet skin.

### 3.6 Decoration UX

Final decoration modes:

- Quick place: simple item placement.
- Edit mode: move, rotate if supported, remove, save.
- Theme mode: change full terrarium shell/background.
- Outfit/accessory mode if pet accessories are supported.

Placement strategy:

- Start with slots or grid.
- Expand to layered z-order and scene zones.
- Avoid pixel-perfect manual editing on small screens unless necessary.

Completion standard:

- Users should be able to decorate quickly, but advanced users should still feel ownership.

### 3.7 Collection UX

Final collection areas:

- Owned items.
- Item catalog.
- Theme gallery.
- Pet memories.
- Walk discoveries.
- Seasonal items.
- Treat collection.

Completion standard:

- The collection should create long-term goals without hiding basic joy behind grind.

### 3.8 Sharing UX

Final share outputs:

- Pet card.
- Terrarium still image.
- Short animation/GIF.
- Walk return card.
- Before/after pet photo comparison only if user explicitly chooses.

Completion standard:

- Sharing should celebrate the generated avatar, not expose private original photos by default.

## 4. Final Game Systems

### 4.1 Care State System

Core states:

- Hunger.
- Energy.
- Affection.
- Happiness.
- Garden health.
- Cleanliness.
- Curiosity/adventure.

Design rules:

- Avoid harsh decay.
- Use soft bands: good, wants attention, needs care.
- Absence creates gentle welcome-back moments.
- State should influence reactions, animations, and available prompts.

Completion standard:

- The state system should create variety without making the user anxious.

### 4.2 Bond / Affection System

Bond should represent long-term relationship.

Inputs:

- Returning.
- Feeding.
- Talking.
- Petting.
- Playing.
- Walks.
- Decorating.
- Premium chat.

Outputs:

- New reaction lines.
- New animations.
- New gifts.
- Memory moments.
- Special terrarium events.

Completion standard:

- Bond should feel earned through care, not bought.

### 4.3 Reaction System

Free reactions should be authored and deterministic enough to control cost and safety.

Dimensions:

- Care state.
- Recent action.
- Time of day.
- Days away.
- Personality.
- Talking style.
- Weather/theme.
- Walk status.
- Item context.
- Event context.

Reaction catalog target:

- Launch: hundreds of lines.
- Mature product: thousands of localized lines.
- Each line tagged by condition, tone, priority, and safety level.

Completion standard:

- The pet should rarely repeat the same line in the same context.

### 4.4 AI Chat System

Premium chat should use AI, but under strong product constraints.

Context packet:

- Pet identity.
- Personality tags.
- Talking style.
- Care summary.
- Recent events.
- User memory note.
- Safety instructions.
- Subscription/entitlement state.

Memory levels:

- Session memory.
- Short-term recent interactions.
- User-approved persistent memories.
- No hidden sensitive memory storage.

Completion standard:

- Chat should feel personal while staying transparent and safe.

### 4.5 Item System

Item categories:

- Food.
- Treats.
- Toys.
- Beds.
- Houses.
- Plants.
- Terrain.
- Decorations.
- Lighting.
- Terrarium shells.
- Backgrounds.
- Accessories.
- Seasonal objects.

Item properties:

- `item_id`
- `category`
- `rarity`
- `visual_asset`
- `placement_rules`
- `unlock_source`
- `premium_status`
- `animation_trigger`
- `season`
- `localized_name`

Completion standard:

- Items should be clear, collectible, and useful for self-expression.

### 4.6 Treat System

Treats are a strong BM candidate because they can trigger special behaviors without feeling like core care is paywalled.

Treat types:

- Cute reaction treat.
- Special animation treat.
- Energy treat.
- Walk discovery treat.
- Celebration treat.
- Seasonal treat.

Rules:

- Basic food remains free/earnable.
- Paid treats should be optional and delightful.
- Never make the pet suffer without paid treats.

Completion standard:

- Treats should feel like buying a cute moment, not buying relief from guilt.

### 4.7 Walk / Adventure System

Final walk system can expand into:

- Timed walks.
- Item discovery.
- Weather-based finds.
- Seasonal events.
- Friend terrarium visits.
- Optional real-world steps.

Completion standard:

- Walk should create anticipation and return rewards with minimal user burden.

### 4.8 Event System

Events should refresh the world.

Event types:

- Seasonal themes.
- Pet birthday/adoption day.
- Daily login streaks.
- Weekend walk events.
- Limited item packs.
- Garden bloom events.
- Memory day events.

Completion standard:

- Events should create freshness without overwhelming new users.

## 5. Final AI Asset Pipeline

### 5.1 Pet Creation Pipeline

Final pipeline:

```text
Photo upload
-> Validate / strip metadata
-> Optional multi-photo grouping
-> Safety precheck
-> Pet crop and identity extraction
-> Avatar generation
-> Transparent/background removal
-> Style normalization
-> Pose/state derivation
-> Quality scoring
-> User preview
-> Publish accepted asset set
```

Final output:

- Base avatar.
- Idle.
- Happy.
- Sleep.
- Play.
- Hungry.
- Walk-out / walk-return.
- Treat reaction.
- Chat portrait.
- Share card render.
- Small icon.

Completion standard:

- Generated pet identity should stay stable across all states.

### 5.2 Quality Evaluation

Quality checks:

- Pet visible.
- No missing face.
- No extra animals unless intended.
- Transparent edges acceptable.
- Style matches terrarium world.
- Color palette not muddy.
- Pose usable at mobile scale.
- Similarity acceptable.
- Safe content.

Completion standard:

- Bad generations should be caught before the user sees them whenever possible.

### 5.3 Regeneration Policy

Final policy:

- First creation includes one fair retry.
- Failed quality gate does not consume retry or paid credit.
- Paid regeneration can exist, but should not be the only way to get an acceptable first pet.
- User can report "does not look like my pet" and upload a better photo.

Completion standard:

- Users should not feel charged for AI failure.

### 5.4 AI Cost Controls

Controls:

- Quotas by user/account/device/payment state.
- Provider cost logging per generation and chat.
- Async jobs, not direct client waits.
- Caching final assets.
- Local authored reactions for free interaction.
- Premium chat rate limits.

Completion standard:

- The app can scale without unpredictable AI spend.

## 6. Final Technical Architecture

### 6.1 Client

Preferred direction:

- React Native with Expo.
- TypeScript.
- Shared data contracts.
- Layered 2D rendering first.
- Optional Skia/Rive/Lottie where needed.

Client owns:

- Navigation.
- Presentation.
- Offline-friendly local reaction selection.
- Terrarium rendering.
- Care action UI.
- Upload UX.
- Chat UI.
- Inventory/decorating UI.

Client must not own:

- AI provider keys.
- Purchase truth.
- Permanent entitlement truth.
- Private original photo access beyond signed upload/download.

### 6.2 Backend

Backend owns:

- Auth.
- User profile.
- Pet profile.
- Source photo metadata.
- Generation jobs.
- Asset metadata.
- Care state.
- Reaction catalog versioning.
- Premium chat gateway.
- Inventory.
- Commerce.
- Deletion.
- Audit logs.

### 6.3 AI Worker

AI worker owns:

- Image preprocessing.
- Provider calls.
- Sprite/state derivation.
- Quality scoring.
- Storage writes.
- Job status reports.

### 6.4 Data Storage

Data classes:

- Account data.
- Pet profile data.
- Original photo data.
- Generated asset data.
- Care state.
- Chat/conversation data.
- Commerce/entitlement data.
- Analytics event data.

Storage rule:

- Original photos, generated assets, and share exports should have separate access policies.

### 6.5 Cross-Platform Contract

All core game state should be platform-independent:

- Pet identity.
- Generated asset metadata.
- Care state.
- Reaction rules.
- Inventory.
- Item catalog.
- Terrarium layout.
- Walk sessions.
- Entitlements.

Completion standard:

- iOS and Android clients can render the same pet/terrarium state from the same server response.

## 7. Final Backend API Surface

Core endpoint groups:

- `auth`
- `users`
- `pets`
- `photos`
- `generation-jobs`
- `assets`
- `care`
- `walks`
- `reactions`
- `conversation`
- `inventory`
- `catalog`
- `commerce`
- `privacy`
- `support`

Key flows:

```text
Create pet:
POST photo upload URL
-> PUT photo
-> POST pet profile
-> POST generation job
-> GET generation status
-> GET generated asset set
-> POST accept generated pet
```

```text
Care action:
POST care action
-> server updates state
-> server returns state delta, reaction candidates, reward
```

```text
Premium chat:
POST conversation message
-> entitlement check
-> moderation
-> AI provider call
-> output moderation
-> response + safe memory update
```

Completion standard:

- Every endpoint has ownership checks, validation, and predictable error states.

## 8. Final Frontend Modules

Final module map:

```text
app/
  onboarding/
  terrarium/
  chat/
  inventory/
  shop/
  settings/
src/
  features/
    onboarding/
    petSetup/
    photoUpload/
    generation/
    petPreview/
    terrarium/
    careActions/
    reactions/
    walk/
    chat/
    inventory/
    decoration/
    shop/
    rewards/
    privacy/
    support/
  domain/
    pet/
    care/
    reactions/
    assets/
    terrarium/
    inventory/
    commerce/
    conversation/
  shared/
    api/
    auth/
    design/
    analytics/
    storage/
    config/
    errors/
    i18n/
```

Completion standard:

- Feature modules can be worked on independently without rewriting domain logic.

## 9. Final Security And Privacy Requirements

### 9.1 Photo Data

Required:

- Explicit consent before AI processing.
- EXIF stripping where possible.
- Private storage.
- Signed upload and read URLs.
- Deletion by pet and account.
- Provider data handling disclosure.

### 9.2 Generated Assets

Required:

- Access control for private assets.
- User-controlled public share exports.
- Asset deletion on pet deletion.
- Versioned generated assets.

### 9.3 Chat Data

Required:

- AI disclosure.
- Retention settings.
- User delete option.
- Input/output moderation.
- Sensitive content handling.
- Crisis policy.
- No hidden personal profiling.

### 9.4 Commerce

Required:

- Server-side purchase verification.
- Entitlement ledger.
- Refund/revocation handling.
- Restore purchases.
- Idempotent grants.

### 9.5 Abuse And Cost

Required:

- Upload rate limits.
- Generation rate limits.
- Chat rate limits.
- Suspicious activity flags.
- Cost budgets by provider.
- Admin tools for stuck jobs and abuse cases.

Completion standard:

- A user can trust the app with pet photos and emotional conversation.

## 10. Final Monetization Design

Recommended monetization mix:

- Premium extended chat.
- Extra pet slots.
- Style regeneration packs.
- Premium terrarium themes.
- Visible item packs.
- Seasonal decoration packs.
- Special treat packs.
- Optional subscription bundle.

Avoid:

- Random loot boxes as the core model.
- Paid care required to keep pet happy.
- Charging for failed generation.
- Emotional manipulation around neglect.
- Grief-based copy that implies the real pet is literally present.

Completion standard:

- Monetization should feel like giving more love and expression, not paying to avoid bad feelings.

## 11. Final Content Plan

### 11.1 Reaction Content

Content volume targets:

- Early product: 300-500 authored lines.
- Launch-ready: 1,000+ authored lines.
- Mature product: 3,000+ localized lines across states/events/personalities.

Line categories:

- Greeting.
- Hungry.
- Full.
- Sleepy.
- Playful.
- Affection.
- Missed user.
- Returned from walk.
- Garden needs water.
- New item.
- Seasonal.
- Premium chat entry.

### 11.2 Item Content

Launch-ready catalog:

- 3-5 terrarium themes.
- 20-40 free/earnable items.
- 30-60 premium/seasonal items.
- 10+ treats.
- 5+ toy types.

Mature catalog:

- 10+ terrarium themes.
- 200+ items.
- Seasonal rotation.
- Special behavior treats.

### 11.3 Localization

Final target:

- Korean and English at minimum if launch region requires both.
- Reaction catalog should be written per language, not mechanically translated only.
- Cultural tone must stay gentle and natural.

## 12. Final QA And Release Criteria

### 12.1 UX QA

Must pass:

- First session can be completed without explanation.
- Upload guidance is clear.
- Generation failure is recoverable.
- Main screen has no text overlap on common phone sizes.
- Care actions are understandable.
- Premium chat gate is clear and not deceptive.

### 12.2 Technical QA

Must pass:

- Photo upload works on iOS and Android.
- Generation job state machine handles retry, failure, timeout.
- Assets render consistently on both platforms.
- Care state survives app restart.
- Reaction engine does not repeat excessively.
- Purchases restore correctly.
- Deletion flows actually delete data and storage objects.

### 12.3 Safety QA

Must pass:

- Unsafe image upload blocked or safely handled.
- Chat moderation tested.
- Crisis handling tested.
- No provider keys in client.
- Signed URL expiration tested.
- Rate limits tested.

### 12.4 Store Readiness

Required:

- Privacy policy.
- Terms.
- AI disclosure.
- Photo/data deletion copy.
- App Store privacy labels.
- Google Play data safety form.
- Purchase/restore flow screenshots.
- Support contact.

## 13. Final Roadmap To Completion

### Stage 1: Concept Lock

Goal:

- Finalize product promise, visual direction, target platforms, and core loops.

Deliverables:

- Final concept doc.
- Final completion guide.
- UX flow doc.
- Technical architecture doc.

### Stage 2: UX And Content Foundation

Goal:

- Make first session and daily loop fully specified.

Deliverables:

- Screen-by-screen UX.
- Onboarding copy.
- Reaction catalog v1.
- Imagegen onboarding assets.
- Terrarium visual system.

### Stage 3: Technical Foundation

Goal:

- Create cross-platform app and backend skeleton.

Deliverables:

- React Native/Expo shell.
- API service.
- Auth.
- Shared schemas.
- Storage setup.
- CI/test baseline.

### Stage 4: Pet Creation System

Goal:

- Turn user photo into accepted pet asset.

Deliverables:

- Upload.
- AI generation worker.
- Quality gates.
- Pet preview.
- Asset storage.

### Stage 5: Living Terrarium

Goal:

- Make the home screen feel alive.

Deliverables:

- Terrarium renderer.
- Pet states.
- Care actions.
- Reaction engine.
- Walk idle system.
- Rewards.

### Stage 6: Collection And Economy

Goal:

- Add long-term expression and progression.

Deliverables:

- Item catalog.
- Inventory.
- Decoration mode.
- Treats.
- Daily gifts.
- Item shop.

### Stage 7: Premium AI Conversation

Goal:

- Add safe long-form AI chat.

Deliverables:

- Chat backend.
- Entitlement gate.
- Moderation.
- Memory policy.
- Chat UI.
- Cost controls.

### Stage 8: Security, Privacy, Compliance

Goal:

- Make the product safe for public users.

Deliverables:

- Deletion flows.
- Privacy copy.
- Store compliance docs.
- Rate limits.
- Abuse handling.
- Audit logging.

### Stage 9: Launch Quality

Goal:

- Prepare for App Store / Google Play.

Deliverables:

- Final QA pass.
- Performance pass.
- App metadata.
- Screenshots.
- Monitoring.
- Support process.

### Stage 10: Live Operations

Goal:

- Keep the world fresh after launch.

Deliverables:

- Seasonal events.
- New items.
- Reaction catalog expansion.
- A/B experiments.
- Cost monitoring.
- User feedback loops.

## 14. Completion Definition

Mongchi is "complete" when:

- A user can create a convincing pet avatar from a real photo.
- The first session feels guided and emotionally rewarding.
- The terrarium feels alive every time the app opens.
- Free reactions create life without AI cost.
- Premium chat feels personal, safe, and clearly AI-generated.
- Care loops are gentle and not guilt-heavy.
- Items and treats support expression and monetization without exploitation.
- iOS and Android share the same core data and asset contracts.
- Photos, chats, purchases, and deletion flows are secure and auditable.
- The app is ready for store review, closed testing, and ongoing live content.

## 15. Open Final Decisions

These decisions still need owner confirmation before full production:

- Brand name and tone.
- Dog/cat only at launch vs more species.
- One main pet vs multiple pet collection.
- Exact premium chat monetization model.
- Exact regeneration pricing and retry policy.
- Final item economy: no currency, soft currency, premium currency, or mixed.
- Whether real-world walk/step tracking is ever part of the product.
- Initial launch countries and languages.
- AI provider choice and data processing terms.
- Final backend/storage provider.
