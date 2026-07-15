# Mongchi AI Pipeline

This document defines the AI generation and AI conversation pipeline for Mongchi.

Mongchi is a new standalone product concept.

## Related Documents

- [Asset Prompt Bible](mongchi-asset-prompt-bible.md)
- [Data Model And API](mongchi-data-model-api.md)
- [Security And Privacy](mongchi-security-privacy.md)
- [Reaction Catalog](mongchi-reaction-catalog.md)

## 1. Pipeline Goals

The AI pipeline must:

- Turn a user's real dog or cat photo into a believable Mongchi avatar.
- Preserve recognizable pet identity where possible.
- Produce reusable assets for care states and UI surfaces.
- Keep original photos private.
- Avoid unpredictable AI cost.
- Provide safe failure and retry paths.
- Support premium long-form chat through the backend only.

## 2. AI Boundaries

AI is used for:

- Pet avatar generation.
- Optional multi-photo identity guidance.
- Later: special poses, premium styles, item/theme generation if selected.
- Premium extended conversation.

AI is not required for:

- Free state-based reaction bubbles.
- Basic care state transitions.
- Normal daily loop.
- Static authored reaction catalog.

This boundary protects cost, latency, and safety.

## 3. Pet Generation Flow

```text
Client selects photo
-> Client requests upload URL
-> Client uploads photo
-> API stores photo metadata
-> User confirms pet profile
-> API creates generation job
-> AI worker claims job
-> Worker validates photo
-> Worker strips metadata / preprocesses
-> Worker runs safety precheck
-> Worker generates base avatar
-> Worker derives state assets
-> Worker postprocesses assets
-> Worker runs quality gates
-> Worker uploads assets
-> API marks job complete
-> Client shows pet reveal
-> User accepts or retries/reports
```

## 4. Inputs

Required:

- `user_id`
- `pet_profile_id`
- `species`: dog or cat
- `pet_name`
- `personality_tags`
- `talking_style`
- One source photo

Optional:

- Up to two additional source photos.
- `favorite_thing`
- `memory_note`
- `style_variant`

Client must not send:

- AI provider key.
- Service role key.
- Raw payment entitlement claims.

## 5. Photo Requirements

Recommended photo:

- Pet clearly visible.
- Face or full body visible.
- Good light.
- Not heavily filtered.
- No busy background if possible.
- No multiple animals unless the target pet is obvious.

Validation:

- File type allowlist.
- Size limit.
- Dimension limit.
- Decode check.
- Optional animal detection.
- Optional unsafe content precheck.

Metadata:

- Strip EXIF where possible before provider processing.
- Store only needed metadata.

## 6. Generation Prompt Contract

Base prompt should come from the [Asset Prompt Bible](mongchi-asset-prompt-bible.md).

Required instructions:

- Preserve pet identity.
- Use Mongchi style.
- Make a playable avatar, not a mascot logo.
- Keep the pet readable at small mobile size.
- Avoid extra animals and text.
- Prepare for transparent background/cutout.

Prompt variables:

- `{species}`
- `{pet_name}`
- `{personality_tags}`
- `{talking_style}`
- `{distinctive_features}`
- `{style_version}`

Prompt output expectation:

- Base avatar image.
- Consistent style.
- No readable text.
- No background if possible, or removable chroma-key/clean background.

## 7. Asset States

MVP states:

- `idle`
- `happy`
- `sleep`
- `play`

Near-final states:

- `hungry`
- `walk_out`
- `walk_return`
- `treat_reaction`
- `chat_portrait`

Final states:

- `sad_soft`
- `curious`
- `celebrate`
- `garden_help`
- `clean`
- `seasonal`

Rules:

- Identity must stay stable across states.
- If direct AI multi-state generation is inconsistent, generate a base avatar and derive early states locally.
- Every state should include metadata linking it to the base avatar and style version.

## 8. Postprocess

Postprocess tasks:

- Remove background.
- Normalize canvas size.
- Crop and pad safely.
- Generate multiple sizes.
- Compress for app delivery.
- Create thumbnails.
- Compute content hash.
- Validate file readability.

Recommended sizes:

- `64x64` for small UI.
- `128x128` for standard pet.
- `256x256` or larger for reveal/share.
- Source/high-res retained only if needed.

Formats:

- PNG/WebP for transparent pet assets.
- PNG/WebP/JPEG for backgrounds depending on transparency needs.
- Metadata JSON for each asset set.

## 9. Quality Gates

Reject or retry if:

- No pet visible.
- Wrong species.
- Multiple unintended animals.
- Face missing or severely distorted.
- Unusable crop.
- Unsafe content.
- Heavy artifacting.
- Background cannot be removed enough.
- Too different from source photo.
- Style does not match terrarium world.
- File corrupt or not decodable.

Quality metadata:

- `quality_status`: pass, warning, failed.
- `quality_score`.
- `failed_checks`.
- `manual_review_required`.
- `retry_recommended`.

## 10. User Preview And Retry

Preview actions:

- Accept.
- Retry if available.
- Upload another photo.
- Report issue.

Policy:

- System failure does not consume paid value.
- Quality gate failure does not consume paid retry.
- First pet should include a fair retry path.
- Manual editing is excluded from MVP.

Rejected reasons:

- `not_similar`
- `wrong_species`
- `bad_style`
- `distorted`
- `unsafe_or_unwanted`
- `other`

## 11. Storage Contract

Private original photo path:

```text
photos/{user_id}/{photo_id}/source
```

Generated asset path:

```text
generated-pets/{user_id}/{pet_id}/{generation_job_id}/{state}/{size}/asset.png
```

Metadata path:

```text
generated-pets/{user_id}/{pet_id}/{generation_job_id}/metadata.json
```

Access:

- Original photo private.
- Generated pet assets private/app-readable with signed URLs.
- Public share exports only after explicit share creation.

## 12. Job State Machine

States:

- `created`
- `upload_pending`
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

Failure fields:

- `failure_code`
- `failure_message_safe`
- `retryable`
- `refund_credit_required`

## 13. Premium Chat Pipeline

```text
Client sends chat message
-> API verifies auth
-> API checks entitlement/quota
-> API loads safe pet context
-> API moderates user message
-> API calls AI provider
-> API moderates output
-> API stores allowed conversation state
-> API returns response
```

Chat context:

- Pet name.
- Species.
- Personality tags.
- Talking style.
- Recent care summary.
- Walk status.
- Last few safe messages.
- User-approved memory notes.

System behavior:

- Pet-like.
- Comforting.
- Playful.
- Short enough for mobile unless user asks for more.
- Does not claim to be actual consciousness.
- Does not provide professional advice.

## 14. Chat Safety

Input handling:

- Moderation for unsafe content.
- Detect self-harm/crisis.
- Detect attempts to extract system prompt or unsafe behavior.

Output handling:

- Moderate AI output.
- Use safety fallback if needed.
- Avoid medical/legal/financial instructions.
- Avoid grief exploitation.

Fallback examples:

```text
I care about you, but I am just a little AI companion. If you might hurt yourself or someone else, please contact emergency help or someone you trust now.
```

## 15. Cost Controls

Generation:

- Limit active jobs per user.
- Limit free retries.
- Track provider cost per job.
- Queue jobs asynchronously.
- Cache accepted assets.

Chat:

- Premium entitlement or quota.
- Message rate limits.
- Token limits.
- Short mobile responses by default.
- Conversation summarization.

Free reactions:

- Local/authored only.
- No AI call.

## 16. Observability

Track:

- Job duration by stage.
- Failure rate by provider.
- Quality failure reasons.
- Retry rate.
- User acceptance rate.
- Cost per accepted pet.
- Chat messages per paid user.
- Moderation flags.

Do not log:

- Raw source photos in analytics.
- Raw chat text in product analytics.
- Provider secrets.

## 17. Testing

Required tests:

- File validation.
- Job state transitions.
- Retry behavior.
- Failure refund/credit preservation.
- Asset metadata schema.
- Signed URL access.
- Quality gate failures.
- Chat entitlement gate.
- Chat moderation fallback.
- No AI call for free reactions.

## 18. Open Decisions

- Final AI image provider.
- Whether multi-photo identity improves enough to expose prominently.
- Whether state assets are AI-generated directly or derived locally.
- First free retry count.
- Paid regeneration package design.
- Conversation retention default.
- Whether chat memory is opt-in from day one.
