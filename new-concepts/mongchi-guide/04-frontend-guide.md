# 04 Frontend Guide

## Frontend Goal

Build a cross-platform iOS/Android client where users can create a pet, enter the terrarium, perform care actions, see free reactions, decorate, and access premium chat.

## Stack Candidate

Default:

- React Native.
- Expo.
- TypeScript.
- Expo Router or equivalent routing.
- Server-state library for API requests.
- Local store for UI state and offline-friendly reaction cache.

Why:

- Shared iOS/Android codebase.
- Familiar development model.
- Good fit for onboarding, upload, AI job status, care UI, chat, and commerce.
- A heavier game engine is not needed until mini-games or complex scene rendering demand it.

## App Structure

```text
apps/mobile/
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

## Module Responsibilities

### onboarding

- Welcome popup.
- Concept intro.
- First-session routing.

### petSetup

- Pet name.
- Species.
- Personality tags.
- Talking style.
- Favorite thing.

### photoUpload

- Photo picker/camera.
- Upload guidance.
- Consent.
- Upload progress.

### generation

- Job creation.
- Status polling.
- Hatching screen.
- Failure and retry.

### petPreview

- Generated pet reveal.
- Accept.
- Retry/report issue.

### terrarium

- Main scene composition.
- Pet asset rendering.
- Layout zones.
- Ambient animations.

### careActions

- Feed.
- Talk.
- Walk.
- Play.
- Affection.
- Water.
- Clean.
- Treat.

### reactions

- Local reaction selection.
- Cooldown/anti-repeat.
- Speech bubble rendering.

### chat

- Premium chat gate.
- Chat UI.
- Backend-only AI messages.

### inventory / decoration

- Owned items.
- Catalog preview.
- Item placement.
- Save/cancel layout.

### privacy

- Delete original photo.
- Delete pet.
- Delete chat history.
- Delete account.

## Rendering Approach

Phase 1:

- React Native views.
- Layered PNG/WebP assets.
- Simple transforms.
- Speech bubble overlay.

Phase 2:

- Add Rive/Lottie for polished pet/UI animations if useful.
- Add Skia/canvas if scene composition needs richer rendering.

Avoid early:

- Full Unity integration.
- Complex physics.
- Pixel-perfect manual room editor.

## Key Screens

- Splash.
- Welcome popup.
- Pet name.
- Personality/talking style.
- Photo upload.
- Photo review.
- Hatching.
- Pet reveal.
- Main terrarium.
- Reaction bubble.
- Walk status.
- Inventory.
- Decoration.
- Premium chat gate.
- Chat.
- Settings/privacy.

## State Strategy

Server truth:

- Pet profile.
- Generation jobs.
- Accepted assets.
- Care state.
- Inventory.
- Entitlements.

Local/client:

- UI routing.
- Form drafts.
- Recent reaction IDs.
- Cached reaction catalog.
- Cached signed asset URLs with expiry awareness.

Offline-friendly:

- Display last known pet/terrarium.
- Local authored reactions can still show.
- Queue non-sensitive care actions only if product accepts eventual consistency.

## API Integration Rules

- No AI provider keys in app.
- No service role keys in app.
- Treat purchase state as untrusted until verified by server.
- Use typed DTO mappers.
- Handle every documented error code.
- Show gentle user-facing errors.

## Frontend Test Plan

Unit:

- Reaction selection.
- Care state display mapping.
- Form validation.
- DTO mapping.

Component:

- Welcome popup.
- Photo upload guide.
- Hatching states.
- Pet reveal.
- Care action buttons.
- Premium gate.

E2E:

- First-session happy path.
- Upload failure path.
- Generation failure/retry path.
- Daily care loop.
- Walk return reward.
- Privacy delete photo path.

Visual:

- Small phone.
- Large phone.
- iOS safe areas.
- Android navigation areas.
- Long Korean/English text.

## Frontend Acceptance Criteria

- First session can be completed without external explanation.
- Upload permissions are explained before system prompts.
- Main terrarium keeps pet visually central.
- Free reactions appear instantly without AI.
- Premium chat gate is clear.
- No UI overlap on common phones.
- Errors are recoverable.
- Privacy controls are reachable.
