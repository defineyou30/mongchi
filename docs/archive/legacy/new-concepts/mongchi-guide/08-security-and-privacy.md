# 08 Security And Privacy

## Security Goal

Protect pet photos, generated assets, chat content, purchase state, and user trust.

This app handles emotionally sensitive content. Security and privacy are part of the product experience, not only backend requirements.

## Data Classes

Sensitive:

- Original pet photos.
- Chat messages.
- User memory notes.
- Account identifiers.
- Purchase records.

Private app data:

- Generated pet assets.
- Pet profile.
- Care state.
- Inventory.
- Terrarium layout.
- Walk sessions.

Public only by user action:

- Shared pet cards.
- Shared terrarium images.
- Shared GIFs/videos.

## Photo Privacy

Requirements:

- Signed upload URLs.
- File type/size validation.
- Image decode validation.
- EXIF stripping where possible.
- Private storage.
- Short-lived signed read URLs.
- Delete original photo flow.
- No public original photo URLs.

User copy:

```text
Your photo is used to create your pet avatar. You can delete the original photo later.
```

## Generated Assets

Requirements:

- Store separately from original photos.
- Version by generation job.
- Use signed read URLs for app-private assets.
- Create public share exports only after explicit user action.
- Delete generated assets when pet is deleted.

## AI Provider Safety

Requirements:

- Backend/worker provider calls only.
- No provider keys in app.
- Upload safety precheck.
- Provider output validation.
- Quality gates before preview.
- Cost budget.
- Job tracing.

Failure policy:

- System failure does not consume paid value.
- Quality gate failure does not consume paid value.
- User-visible failure should be soft and recoverable.

## Chat Safety

Risks:

- Sensitive user disclosure.
- Emotional over-attachment.
- Unsafe advice.
- Literal-pet-consciousness confusion.

Controls:

- AI disclosure.
- Input moderation.
- Output moderation.
- Crisis/self-harm fallback.
- No professional advice framing.
- Conversation retention settings.
- Delete chat history.
- Rate limits.

Required disclosure:

```text
This is an AI-generated conversation shaped by your pet's profile. It is not your real pet's consciousness.
```

## Emotional Safety

Avoid:

- Guilt loops.
- Threatening pet sadness/death.
- Paid recovery from neglect.
- Grief exploitation.
- Copy implying the real pet is literally present.

Allowed:

- Gentle welcome-back.
- Soft reminders.
- Comforting pet-like messages.
- Transparent AI language.

Safe missed-visit example:

```text
It was quiet for a bit. But you're here now.
```

## Commerce Security

Requirements:

- Server-side purchase verification.
- Entitlement ledger.
- Idempotent grants.
- Refund/revocation handling.
- Restore purchases.
- Clear premium chat terms.
- Clear generation credit policy.

Do not monetize:

- Basic food required for normal happiness.
- Recovery from neglect.
- Fixing system-generated bad assets.
- Crisis responses.

## Access Control

Rules:

- Users can only access their own pets.
- Users can only access their own photos.
- Users can only access their own generated assets unless shared.
- Workers access jobs through service credentials only.
- Admin access is audited.

## Rate Limits

Rate-limit:

- Uploads.
- Generation jobs.
- Generation retries.
- Premium chat messages.
- Share exports.
- Failed auth attempts.

## Deletion Requirements

User must be able to:

- Delete original photo.
- Delete generated pet.
- Delete chat history.
- Delete account.
- Manage memory note.

Deletion must cover:

- Database rows.
- Storage objects.
- Derived assets when required.
- Conversation records.
- Share exports if requested or policy requires.

Recommended:

- Original photo deletion can preserve generated pet.
- Persistent chat memory should be opt-in.

## Store Compliance

Required:

- Privacy policy.
- Terms of service.
- Data deletion flow.
- AI disclosure.
- Photo/camera permission copy.
- In-app purchase restore.
- App Store privacy labels.
- Google Play data safety form.
- Support contact.

## Logging Rules

Do log:

- Event names.
- Status codes.
- Job stage durations.
- Failure categories.
- Entitlement state changes.

Do not log:

- Raw source photos.
- Raw chat text in product analytics.
- Provider secrets.
- Payment secrets.

## Security Test Checklist

- Unsupported file blocked.
- Oversized file blocked.
- EXIF stripped.
- Signed URL expires.
- Deleted photo cannot be accessed.
- User cannot access another user's pet/job/photo.
- Provider key absent from client bundle.
- Premium chat gate enforced server-side.
- Duplicate purchase does not double-grant.
- Refund revokes entitlement.
- Deletion removes storage objects.

## Open Decisions

- Original photo default retention.
- Chat history default retention.
- Age rating.
- AI provider data-processing terms.
- Whether original photo deletion is automatic after generation.
- Premium chat memory opt-in UX.
- Admin access approval workflow.
