# Mongchi Security And Privacy

This document defines the security, privacy, AI safety, commerce safety, and compliance requirements for Mongchi.

Mongchi is a new standalone product concept.

## Related Documents

- [Data Model And API](mongchi-data-model-api.md)
- [AI Pipeline](mongchi-ai-pipeline.md)
- [Reaction Catalog](mongchi-reaction-catalog.md)
- [Final Completion Guide](mongchi-completion-guide.md)

## 1. Privacy Principles

- Original photos are private user content.
- Generated pet assets belong to the user's app experience.
- Chat content may be sensitive and must be handled carefully.
- AI provider usage must be disclosed.
- Users must be able to delete original photos, generated pets, chat history, and account data.
- The app must never claim the real pet's consciousness is inside the product.

## 2. Data Classification

### 2.1 Sensitive

- Original pet photos.
- Photos that accidentally include people, homes, addresses, or EXIF metadata.
- Chat messages.
- User memory notes.
- Account identifiers.
- Purchase records.

### 2.2 Private App Data

- Generated pet assets.
- Care state.
- Pet name/personality.
- Inventory.
- Terrarium layout.
- Walk sessions.

### 2.3 Public Only By User Action

- Shared pet cards.
- Shared terrarium images.
- Shared GIFs/videos.

Default:

- Nothing is public unless the user explicitly shares it.

## 3. Photo Security

Requirements:

- Use signed upload URLs.
- Validate file type and size.
- Decode image before processing.
- Strip EXIF metadata where possible.
- Store original photos in private storage.
- Do not expose original photo URLs to other users.
- Keep provider access server-side only.
- Provide deletion for original photos.

User-facing copy:

```text
Your photo is used to create your pet avatar. You can delete the original photo later.
```

Deletion copy:

```text
Deleting the original photo keeps your generated pet, but future regeneration may need a new photo.
```

## 4. Generated Asset Security

Requirements:

- Store generated assets separately from original photos.
- Use signed read URLs for app-private assets.
- Create public share exports only after explicit user action.
- Delete generated assets when the user deletes a pet.
- Version generated assets by generation job.
- Keep content hashes for integrity checks.

## 5. AI Image Provider Safety

Controls:

- Backend/worker calls provider, never client.
- No provider keys in mobile app.
- Upload moderation/safety precheck.
- Provider response validation.
- Quality gates before user preview.
- Cost budget per user/job/provider.
- Retry and failure policy.

Failure policy:

- System/provider failure should not consume paid generation value.
- Quality gate failure should not consume paid generation value.
- User rejection may consume retry only after clear preview and policy.

## 6. AI Chat Safety

Risks:

- User may share sensitive emotional content.
- User may become emotionally over-attached.
- Model may give unsafe advice.
- Product may accidentally imply the real animal is literally speaking.

Required controls:

- AI disclosure before premium chat.
- User input moderation.
- Model output moderation.
- Crisis/self-harm fallback.
- No professional advice framing.
- No claim of actual pet consciousness.
- Rate limits.
- Conversation retention controls.
- Delete chat history option.

Required disclosure:

```text
This is an AI-generated conversation shaped by your pet's profile. It is not your real pet's consciousness.
```

Tone boundary:

- Pet-like and comforting.
- Not therapist.
- Not doctor.
- Not legal/financial advisor.
- Not a deceased pet resurrection product.

## 7. Emotional Safety

The product is emotionally intimate. Avoid:

- Guilt loops.
- Threatening pet sadness/death.
- "Your pet misses you because you neglected them."
- "Pay to make them happy again."
- Copy that exploits grief.
- Claims that the app can truly preserve or recreate the real pet.

Allowed:

- Gentle "welcome back."
- Soft care reminders.
- Comforting pet-like messages.
- Transparent AI language.

Example safe missed-visit copy:

```text
It was quiet for a bit. But you're here now.
```

Unsafe:

```text
I thought you forgot me forever.
```

## 8. Commerce Safety

Requirements:

- Server-side purchase verification.
- Entitlement ledger.
- Idempotent purchase grant.
- Refund/revocation handling.
- Restore purchases.
- Clear premium chat terms.
- Clear generation credit policy.

Do not monetize:

- Recovery from neglect.
- Fixing system-generated bad assets.
- Basic food required for normal happiness.
- Emotional crisis responses.

Safe monetization:

- Premium extended chat.
- Extra pets.
- Visible item packs.
- Terrarium themes.
- Style regeneration after fair retry.
- Special treats for cute optional animations.

## 9. Access Control

Rules:

- A user can only access their own pets.
- A user can only access their own source photos.
- A user can only access their own generated assets unless shared.
- Workers can only access jobs through service credentials.
- Admin access must be audited.
- Signed URLs must be short-lived.

Backend checks:

- `user_id` ownership on every user-data endpoint.
- Entitlement check before premium chat.
- Inventory ownership before placement.
- Purchase verification before grant.

## 10. Rate Limits And Abuse

Rate-limit:

- Photo uploads.
- Generation job creation.
- Generation retry.
- Premium chat messages.
- Share export creation.
- Failed auth attempts.

Abuse signals:

- Many failed uploads.
- Many blocked images.
- Rapid generation retries.
- Chat moderation triggers.
- Purchase fraud signals.

Responses:

- Soft warning.
- Temporary cooldown.
- Require re-auth.
- Manual review.
- Account restriction for severe abuse.

## 11. Retention And Deletion

User controls:

- Delete original photo.
- Delete generated pet.
- Delete chat history.
- Delete account.
- Manage memory note.

Deletion must cover:

- Database rows.
- Storage objects.
- Derived assets when required.
- Conversation records if requested.
- Share exports if user requests or policy requires.

Retention policy decisions needed:

- How long original photos are kept by default.
- Whether original photos are deleted after successful generation unless user opts in.
- How long chat history is kept.
- Whether premium chat memory is opt-in.

Recommended:

- Make original photo retention explicit.
- Allow generated pet to remain after original photo deletion.
- Make persistent chat memory opt-in.

## 12. Store Compliance

App Store / Google Play readiness:

- Privacy policy.
- Terms of service.
- Data deletion flow.
- AI disclosure.
- Photo upload purpose string.
- Camera/photo library permissions.
- In-app purchase restore.
- Data safety / privacy labels.
- Support contact.

Permission copy examples:

Photo library:

```text
Choose a photo of your pet to create their Mongchi avatar.
```

Camera:

```text
Take a photo of your pet to create their tiny companion.
```

## 13. Logging And Analytics

Do log:

- Event names.
- Status codes.
- Job stage durations.
- Failure categories.
- Entitlement state changes.
- Moderation category counts.

Do not log:

- Raw source photos.
- Raw chat text in product analytics.
- Full provider prompts with private user details in broad logs.
- Payment secrets.
- API keys.

Sensitive operational logs:

- Must be access-controlled.
- Must have retention limits.
- Should redact user-generated content where possible.

## 14. Admin And Support

Support tools may need:

- View job status.
- See failure code.
- Trigger retry if safe.
- Confirm deletion request status.
- Inspect purchase entitlement state.

Support tools must not:

- Freely browse original photos.
- Read chat content without explicit support/legal basis.
- Export private data casually.

Admin requirements:

- Role-based access.
- Audit trail.
- Least privilege.
- Manual review workflow.

## 15. Security Testing Checklist

Photo:

- Unsupported file blocked.
- Oversized file blocked.
- EXIF stripped.
- Signed URL expires.
- Deleted photo cannot be accessed.

Generation:

- User cannot access another user's job.
- Worker cannot claim unauthorized job.
- Failed generation does not consume paid credit.
- Provider key absent from client bundle.

Chat:

- Premium gate enforced server-side.
- Input moderation blocks unsafe content.
- Output moderation fallback works.
- Chat deletion removes records per policy.

Commerce:

- Fake local purchase state ignored.
- Duplicate purchase does not double-grant.
- Refund revokes entitlement.
- Restore works.

API:

- Auth required.
- Ownership enforced.
- Rate limits work.
- Validation errors safe.

## 16. Open Security Decisions

- Original photo default retention.
- Chat history default retention.
- Age rating and child safety positioning.
- AI provider data-processing terms.
- Whether original photo deletion is automatic after generation.
- Whether public sharing requires watermark or user ID omission.
- Premium chat memory opt-in UX.
- Admin access approval workflow.
