# 05 Backend Guide

## Backend Goal

Own user data, photos, generation jobs, generated assets, care state, inventory, premium chat, commerce entitlements, privacy deletion, and auditability.

The backend protects the app from:

- Exposing AI provider keys.
- Trusting local purchase state.
- Publicly leaking private photos.
- Losing generation job state.
- Mixing user data across accounts.

## Module Structure

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
  privacy/
  safety/
  analytics/
  admin/
```

## Module Responsibilities

### auth

- Verify sessions.
- Resolve current user.
- Protect all private endpoints.

### users

- User profile.
- Locale/timezone.
- Onboarding state.

### pets

- Pet profile.
- Name/species/personality/talking style.
- Active generation.
- Delete/archive pet.

### photos

- Signed upload URL.
- Complete upload.
- Photo metadata.
- Delete original photo.
- Safety/precheck status.

### generation

- Create job.
- Job state machine.
- Retry/cancel/accept.
- Worker claim protocol.
- Failure/refund metadata.

### assets

- Generated asset metadata.
- Signed read URLs.
- Share export creation.
- Asset deletion.

### care

- Care state.
- Care action processing.
- State deltas.
- Reward hooks.

### reactions

- Reaction catalog versioning.
- Optional server-side reaction selection.
- Locale support.

### conversation

- Premium chat sessions.
- Entitlement checks.
- AI provider gateway.
- Moderation.
- Conversation retention/deletion.

### inventory

- Owned items.
- Placement.
- Starter item grants.
- Rewards.

### commerce

- Product catalog.
- Purchase verification.
- Entitlement ledger.
- Restore.
- Refund/revocation.

### privacy

- Delete photo.
- Delete chat history.
- Delete pet.
- Delete account.
- Audit deletion completion.

### safety

- Upload moderation.
- Chat safety.
- Abuse/rate limits.

## API Groups

- `GET /v1/me`
- `GET/POST/PATCH/DELETE /v1/pets`
- `POST /v1/photos/upload-url`
- `POST /v1/photos/complete-upload`
- `POST /v1/generation-jobs`
- `GET /v1/generation-jobs/:jobId`
- `POST /v1/generation-jobs/:jobId/retry`
- `POST /v1/generation-jobs/:jobId/accept`
- `GET /v1/pets/:petId/assets`
- `GET /v1/pets/:petId/care-state`
- `POST /v1/pets/:petId/care-actions`
- `POST /v1/pets/:petId/walks`
- `POST /v1/walks/:walkId/claim`
- `GET /v1/reaction-catalog`
- `POST /v1/conversations`
- `POST /v1/conversations/:id/messages`
- `GET /v1/catalog/items`
- `GET /v1/inventory`
- `POST /v1/commerce/purchases/verify`
- `POST /v1/commerce/restore`
- `DELETE /v1/privacy/original-photos`
- `DELETE /v1/privacy/chat-history`
- `DELETE /v1/privacy/pet/:petId`

## Storage Classes

### Original Photos

- Private.
- Short-lived signed upload/read.
- EXIF stripped where possible.
- Deletable independently from generated pet.

### Generated Assets

- Private/app-readable.
- Signed read URLs.
- Versioned by generation job.
- Deleted with pet deletion.

### Share Exports

- Created only by explicit user action.
- May be public if sharing requires it.
- Should not include original photo by default.

## Generation Job State Machine

States:

- created
- queued
- claimed
- validating
- preprocessing
- safety_checking
- generating
- postprocessing
- quality_checking
- uploading_assets
- completed
- failed
- cancelled
- expired

Required fields:

- `failure_code`
- `failure_message_safe`
- `retryable`
- `refund_credit_required`
- `provider`
- `cost_units`
- `quality_status`

## Care Action Processing

Request:

```json
{
  "action": "feed",
  "item_id": "item_food_basic"
}
```

Server should:

1. Verify user owns pet.
2. Validate action.
3. Validate item ownership if needed.
4. Update care state.
5. Select reward if any.
6. Return reaction candidate or let client select local reaction.

Response:

```json
{
  "care_state": {},
  "reaction": {
    "line": "Snack accepted. You may stay.",
    "animation": "happy"
  },
  "reward": null
}
```

## Premium Chat Backend

Server must:

- Verify entitlement.
- Moderate input.
- Build pet context.
- Call AI provider.
- Moderate output.
- Store/return response.
- Enforce rate limits.

Pet context:

- Pet name.
- Species.
- Personality tags.
- Talking style.
- Recent care summary.
- Walk status.
- User-approved memory note.

## Commerce

Rules:

- Client purchase state is never final truth.
- Server verifies purchase.
- Entitlements are persisted in a ledger.
- Duplicate purchase grants are idempotent.
- Refund/revocation is handled.
- Restore purchases is required.

Entitlement candidates:

- Premium chat.
- Extra pet slots.
- Regeneration packs.
- Premium item/theme packs.
- Treat packs.

## Backend Tests

Required:

- Auth ownership tests.
- Upload validation tests.
- Signed URL expiry tests.
- Generation job transition tests.
- Retry/refund policy tests.
- Care action transition tests.
- Reaction catalog version tests.
- Chat entitlement tests.
- Purchase verification tests.
- Deletion cascade tests.
- Rate-limit tests.

## Backend Acceptance Criteria

- No provider/service secrets reach mobile app.
- Private photos cannot be accessed by other users.
- Generation failures are recoverable.
- Paid value is preserved on system failure.
- Care state is consistent across devices.
- Purchases restore correctly.
- Deletion removes metadata and storage objects.
- Admin/support access is audited.
