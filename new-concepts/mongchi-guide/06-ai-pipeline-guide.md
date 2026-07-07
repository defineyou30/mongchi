# 06 AI Pipeline Guide

## AI Pipeline Goal

Turn a user's real dog or cat photo into a believable Mongchi avatar while keeping privacy, safety, cost, and quality under control.

## AI Boundaries

AI is used for:

- Pet avatar generation.
- Optional multi-photo identity guidance.
- Later: special poses, premium styles, generated themes.
- Premium extended chat.

AI is not used for:

- Free state-based reactions.
- Basic care state changes.
- Normal daily loop.
- Authored reaction catalog.

## Pet Generation Flow

```text
Client selects photo
-> API issues upload URL
-> Client uploads photo
-> API creates pet profile and generation job
-> AI worker claims job
-> Validate photo
-> Strip metadata / preprocess
-> Safety precheck
-> Generate base avatar
-> Derive state assets
-> Postprocess
-> Quality gates
-> Upload assets
-> API marks job complete
-> Client shows reveal
```

## Inputs

Required:

- User ID.
- Pet profile ID.
- Species.
- Pet name.
- Personality tags.
- Talking style.
- One source photo.

Optional:

- Up to two more photos.
- Favorite thing.
- Memory note.
- Style variant.

## Asset States

First implementation:

- Base.
- Idle.
- Happy.
- Sleep.
- Play.

Next:

- Hungry.
- Walk return.
- Treat reaction.
- Chat portrait.

Final:

- Curious.
- Celebrate.
- Garden help.
- Seasonal.

## Generation Prompt Rules

Use the style from [03 Design And Assets](03-design-and-assets.md).

Prompt must:

- Preserve pet identity.
- Use Mongchi style.
- Avoid generic mascot look.
- Avoid text/logos.
- Avoid extra animals.
- Prepare for transparent background.
- Keep asset readable at small mobile size.

## Postprocess

Required:

- Remove background.
- Normalize canvas.
- Crop and pad safely.
- Generate sizes.
- Compress for app.
- Create thumbnails.
- Compute content hash.
- Validate file readability.

Recommended sizes:

- 64.
- 128.
- 256.
- Reveal/share larger version if needed.

## Quality Gates

Reject or retry if:

- No pet visible.
- Wrong species.
- Face missing.
- Multiple unintended animals.
- Unsafe content.
- Heavy artifacting.
- Background removal failed.
- Style mismatch.
- Identity mismatch too severe.
- File corrupt.

Quality metadata:

- `quality_status`
- `quality_score`
- `failed_checks`
- `manual_review_required`
- `retry_recommended`

## User Retry Policy

Recommended:

- First pet includes one fair retry.
- System failure does not consume paid value.
- Quality gate failure does not consume paid value.
- User can upload another photo.
- Manual post-generation editing is not part of first implementation.

## Premium Chat Pipeline

```text
Client message
-> API verifies auth
-> API checks entitlement
-> API loads pet context
-> Input moderation
-> AI provider call
-> Output moderation
-> Response returned
-> Safe memory update if allowed
```

Chat context:

- Pet name.
- Species.
- Personality tags.
- Talking style.
- Recent care summary.
- Walk status.
- User-approved memory note.

Chat must not:

- Claim to be the real pet's consciousness.
- Give professional advice.
- Ignore safety flags.
- Use provider keys on client.

## Cost Controls

Generation:

- Async jobs.
- Active job limits.
- Free retry limits.
- Cost logging.
- Provider fallback policy.

Chat:

- Premium entitlement.
- Rate limits.
- Token limits.
- Short mobile responses by default.
- Summarized context.

Free reactions:

- Authored/local only.
- No AI call.

## Observability

Track:

- Job duration.
- Failure reason.
- Quality failure rate.
- Accepted generation rate.
- Retry rate.
- Cost per accepted pet.
- Premium chat usage.
- Moderation flags.

Do not log:

- Raw photos in analytics.
- Raw chat text in product analytics.
- Provider secrets.

## AI Acceptance Criteria

- One photo can generate a usable pet.
- Generated assets have stable identity across states.
- Bad generations are caught or recoverable.
- Chat is backend-only and moderated.
- Free reactions never call AI.
- Costs are measurable.
