# Mongchi Data Model And API

This document defines the core data model and API contract for Mongchi. It is platform-independent and should be shared by iOS and Android clients.

Mongchi is a new standalone product concept.

## Related Documents

- [Execution Plan](mongchi-execution-plan.md)
- [AI Pipeline](mongchi-ai-pipeline.md)
- [Reaction Catalog](mongchi-reaction-catalog.md)
- [Security And Privacy](mongchi-security-privacy.md)

## 1. API Principles

- Server owns identity, generated assets, care state, inventory, entitlements, and deletion.
- Client can cache UI state and local reaction catalogs, but must sync server truth.
- Original photos are private.
- Generated assets use signed URLs unless explicitly shared.
- Premium chat and AI generation always go through backend APIs.
- Endpoints must return predictable typed error codes.

## 2. Core Entities

### 2.1 UserProfile

```json
{
  "id": "user_123",
  "display_name": "Kohyun",
  "created_at": "2026-06-24T00:00:00Z",
  "locale": "ko-KR",
  "timezone": "Asia/Seoul",
  "onboarding_status": "completed"
}
```

Fields:

- `id`
- `display_name`
- `locale`
- `timezone`
- `onboarding_status`
- `created_at`
- `updated_at`

### 2.2 PetProfile

```json
{
  "id": "pet_123",
  "user_id": "user_123",
  "name": "Mong",
  "species": "dog",
  "personality_tags": ["playful", "affectionate"],
  "talking_style": "comforting",
  "favorite_thing": "walk",
  "status": "active",
  "active_generation_id": "gen_123"
}
```

Fields:

- `id`
- `user_id`
- `name`
- `species`: dog, cat, later other.
- `personality_tags`
- `talking_style`
- `favorite_thing`
- `memory_note_status`: none, stored, deleted.
- `status`: draft, generating, active, archived, deleted.
- `active_generation_id`
- `created_at`
- `updated_at`

### 2.3 SourcePhoto

```json
{
  "id": "photo_123",
  "user_id": "user_123",
  "pet_id": "pet_123",
  "storage_path": "photos/user_123/photo_123/source",
  "status": "available",
  "is_primary": true,
  "metadata_stripped": true
}
```

Fields:

- `id`
- `user_id`
- `pet_id`
- `storage_path`
- `status`: uploaded, available, deleted, blocked.
- `is_primary`
- `width`
- `height`
- `mime_type`
- `size_bytes`
- `content_hash`
- `metadata_stripped`
- `created_at`
- `deleted_at`

### 2.4 GenerationJob

```json
{
  "id": "gen_123",
  "user_id": "user_123",
  "pet_id": "pet_123",
  "status": "completed",
  "provider": "provider_name",
  "style_version": "tiny_terrarium_v1",
  "retry_count": 0,
  "quality_status": "pass"
}
```

Status:

- `created`
- `queued`
- `claimed`
- `validating`
- `preprocessing`
- `safety_checking`
- `generating`
- `postprocessing`
- `quality_checking`
- `uploading_assets`
- `completed`
- `failed`
- `cancelled`
- `expired`

Fields:

- `id`
- `user_id`
- `pet_id`
- `source_photo_ids`
- `status`
- `provider`
- `style_version`
- `retry_count`
- `quality_status`
- `failure_code`
- `failure_message_safe`
- `retryable`
- `cost_units`
- `created_at`
- `updated_at`
- `completed_at`

### 2.5 GeneratedPetAsset

```json
{
  "id": "asset_123",
  "generation_job_id": "gen_123",
  "pet_id": "pet_123",
  "state": "idle",
  "size": "128",
  "storage_path": "generated-pets/user_123/pet_123/gen_123/idle/128/asset.png",
  "content_hash": "sha256...",
  "width": 128,
  "height": 128
}
```

States:

- `base`
- `idle`
- `happy`
- `sleep`
- `play`
- `hungry`
- `walk_return`
- `treat_reaction`
- `chat_portrait`

Fields:

- `id`
- `pet_id`
- `generation_job_id`
- `state`
- `size`
- `storage_path`
- `mime_type`
- `width`
- `height`
- `content_hash`
- `created_at`

### 2.6 CareState

```json
{
  "pet_id": "pet_123",
  "hunger": 35,
  "energy": 72,
  "happiness": 80,
  "affection": 64,
  "garden_health": 90,
  "cleanliness": 88,
  "last_seen_at": "2026-06-24T00:00:00Z",
  "last_fed_at": "2026-06-24T00:00:00Z",
  "walk_status": "idle"
}
```

Fields:

- `pet_id`
- `hunger`: 0-100, higher means more hungry or define inverse clearly before implementation.
- `energy`
- `happiness`
- `affection`
- `garden_health`
- `cleanliness`
- `last_seen_at`
- `last_fed_at`
- `last_talked_at`
- `last_walked_at`
- `last_played_at`
- `last_watered_at`
- `walk_status`: idle, walking, returned, reward_claimed.
- `updated_at`

Implementation note:

- Pick one convention and keep it consistent. Recommended: 0 = depleted/needs care, 100 = full/good for positive stats; `hunger` may be renamed to `satiety` to avoid inversion.

### 2.7 ReactionRule

```json
{
  "id": "reaction_morning_gentle_001",
  "locale": "en-US",
  "conditions": {
    "time_bucket": "morning",
    "personality_tags_any": ["gentle", "affectionate"],
    "satiety_min": 40
  },
  "lines": [
    "Good morning. I kept the flowers company."
  ],
  "animation": "idle_happy",
  "priority": 40,
  "cooldown_hours": 12
}
```

Fields:

- `id`
- `locale`
- `conditions`
- `lines`
- `animation`
- `priority`
- `cooldown_hours`
- `safety_level`
- `version`

### 2.8 TerrariumLayout

```json
{
  "id": "layout_123",
  "pet_id": "pet_123",
  "theme_id": "theme_default_sky",
  "canvas": {
    "width": 360,
    "height": 640,
    "grid": 8
  },
  "placements": [
    {
      "placement_id": "place_123",
      "item_id": "item_flower_pot_001",
      "x": 120,
      "y": 430,
      "z": 20,
      "slot": "front_left"
    }
  ]
}
```

Fields:

- `id`
- `pet_id`
- `theme_id`
- `canvas`
- `placements`
- `updated_at`

### 2.9 ItemCatalog

```json
{
  "id": "item_treat_heart_biscuit",
  "category": "treat",
  "rarity": "rare",
  "name_key": "item.treat.heart_biscuit.name",
  "asset_path": "items/treats/heart-biscuit-v1.png",
  "premium_status": "premium",
  "behavior_trigger": "treat_reaction_heart"
}
```

Categories:

- food
- treat
- toy
- bed
- house
- plant
- terrain
- decoration
- lighting
- terrarium_shell
- background
- accessory
- seasonal

### 2.10 OwnedItem

```json
{
  "id": "owned_123",
  "user_id": "user_123",
  "item_id": "item_flower_pot_001",
  "source": "daily_reward",
  "quantity": 1,
  "granted_at": "2026-06-24T00:00:00Z"
}
```

### 2.11 WalkSession

```json
{
  "id": "walk_123",
  "pet_id": "pet_123",
  "status": "walking",
  "started_at": "2026-06-24T00:00:00Z",
  "returns_at": "2026-06-24T00:05:00Z",
  "reward_status": "pending"
}
```

Status:

- `walking`
- `returned`
- `claimed`
- `expired`

### 2.12 ConversationSession

```json
{
  "id": "chat_123",
  "user_id": "user_123",
  "pet_id": "pet_123",
  "type": "premium_chat",
  "status": "active",
  "message_count": 6
}
```

Fields:

- `id`
- `user_id`
- `pet_id`
- `type`
- `status`
- `message_count`
- `created_at`
- `updated_at`
- `deleted_at`

### 2.13 Entitlement

```json
{
  "id": "ent_123",
  "user_id": "user_123",
  "type": "premium_chat",
  "status": "active",
  "source": "subscription",
  "expires_at": "2026-07-24T00:00:00Z"
}
```

## 3. API Endpoint Groups

### 3.1 Auth

- `GET /v1/me`
- `PATCH /v1/me`
- `DELETE /v1/me`

### 3.2 Pets

- `GET /v1/pets`
- `POST /v1/pets`
- `GET /v1/pets/:petId`
- `PATCH /v1/pets/:petId`
- `DELETE /v1/pets/:petId`

Create pet request:

```json
{
  "name": "Mong",
  "species": "dog",
  "personality_tags": ["playful", "affectionate"],
  "talking_style": "comforting",
  "favorite_thing": "walk"
}
```

### 3.3 Photos

- `POST /v1/photos/upload-url`
- `POST /v1/photos/complete-upload`
- `GET /v1/photos/:photoId`
- `DELETE /v1/photos/:photoId`

Upload URL request:

```json
{
  "pet_id": "pet_123",
  "mime_type": "image/jpeg",
  "size_bytes": 1234567,
  "is_primary": true
}
```

### 3.4 Generation Jobs

- `POST /v1/generation-jobs`
- `GET /v1/generation-jobs/:jobId`
- `POST /v1/generation-jobs/:jobId/retry`
- `POST /v1/generation-jobs/:jobId/cancel`
- `POST /v1/generation-jobs/:jobId/accept`
- `POST /v1/generation-jobs/:jobId/report`

Create job request:

```json
{
  "pet_id": "pet_123",
  "source_photo_ids": ["photo_123"],
  "style_version": "tiny_terrarium_v1"
}
```

### 3.5 Assets

- `GET /v1/pets/:petId/assets`
- `GET /v1/assets/:assetId/signed-url`
- `POST /v1/share-exports`

### 3.6 Care

- `GET /v1/pets/:petId/care-state`
- `POST /v1/pets/:petId/care-actions`

Care action request:

```json
{
  "action": "feed",
  "item_id": "item_food_basic"
}
```

Care action response:

```json
{
  "care_state": {},
  "reaction": {
    "line": "That was perfect. I saved a happy wiggle for you.",
    "animation": "happy"
  },
  "reward": null
}
```

### 3.7 Walks

- `POST /v1/pets/:petId/walks`
- `GET /v1/pets/:petId/walks/current`
- `POST /v1/walks/:walkId/claim`

### 3.8 Reactions

- `GET /v1/reaction-catalog?locale=ko-KR&version=latest`
- `POST /v1/pets/:petId/reactions/select`

MVP option:

- Bundle reaction catalog in app and use server only for catalog updates.

### 3.9 Conversation

- `POST /v1/conversations`
- `GET /v1/conversations/:conversationId`
- `POST /v1/conversations/:conversationId/messages`
- `DELETE /v1/conversations/:conversationId`

Message request:

```json
{
  "text": "오늘 힘들었어",
  "client_context": {
    "screen": "home",
    "care_state_hint": "normal"
  }
}
```

### 3.10 Inventory And Catalog

- `GET /v1/catalog/items`
- `GET /v1/inventory`
- `POST /v1/inventory/:ownedItemId/place`
- `DELETE /v1/placements/:placementId`
- `PATCH /v1/terrarium-layouts/:layoutId`

### 3.11 Commerce

- `GET /v1/commerce/products`
- `POST /v1/commerce/purchases/verify`
- `POST /v1/commerce/restore`
- `GET /v1/entitlements`

### 3.12 Privacy

- `DELETE /v1/privacy/original-photos`
- `DELETE /v1/privacy/chat-history`
- `DELETE /v1/privacy/pet/:petId`
- `POST /v1/privacy/account-deletion-request`

## 4. Error Codes

Common:

- `unauthorized`
- `forbidden`
- `not_found`
- `validation_error`
- `rate_limited`
- `server_error`

Photo:

- `unsupported_file_type`
- `file_too_large`
- `photo_decode_failed`
- `photo_not_found`
- `photo_blocked`

Generation:

- `generation_quota_exceeded`
- `generation_failed`
- `generation_quality_failed`
- `generation_timeout`
- `generation_not_retryable`

Chat:

- `premium_required`
- `chat_quota_exceeded`
- `message_blocked`
- `response_blocked`

Commerce:

- `purchase_invalid`
- `purchase_already_processed`
- `entitlement_missing`

## 5. Analytics Events

Do not include raw photo or raw chat content.

Events:

- `welcome_viewed`
- `pet_setup_started`
- `pet_name_submitted`
- `personality_selected`
- `photo_upload_started`
- `photo_upload_completed`
- `generation_job_created`
- `generation_job_completed`
- `generation_job_failed`
- `pet_reveal_viewed`
- `pet_generation_accepted`
- `care_action_performed`
- `reaction_shown`
- `walk_started`
- `walk_reward_claimed`
- `item_placed`
- `premium_chat_gate_viewed`
- `premium_chat_started`
- `purchase_started`
- `purchase_completed`
- `privacy_delete_photo_requested`

## 6. Authorization Rules

- Users can only access their own pets.
- Users can only access their own photos.
- Users can only access their own generated assets.
- Service workers can claim generation jobs through service credentials only.
- Purchases require server verification.
- Admin tooling must be separate and audited.

## 7. Open Decisions

- Whether `hunger` should become `satiety` for less confusing math.
- Final backend/storage provider.
- Whether reaction catalog is app-bundled, server-provided, or hybrid.
- Whether chat history is retained by default or opt-in.
- How many free generations/retries are allowed.
- Whether inventory quantity is stack-based or each item instance is unique.
