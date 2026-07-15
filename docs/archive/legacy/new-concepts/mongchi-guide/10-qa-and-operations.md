# 10 QA And Operations

## QA Goal

Ensure Mongchi is emotionally coherent, technically stable, safe with private data, and ready for iOS/Android release.

## Product QA

First session:

- User understands concept.
- Welcome popup leads naturally to upload.
- Name/personality setup feels lightweight.
- Photo upload is clear.
- Generation wait feels intentional.
- Reveal creates emotional payoff.
- First care action is obvious.

Home:

- Pet remains visual center.
- Care buttons are clear.
- Free reactions appear quickly.
- Missing a day is not guilt-heavy.
- Walk state is understandable.
- Reward claim is clear.

Premium chat:

- Free reaction and premium chat are distinct.
- Gate explains value.
- AI disclosure is visible.
- Chat tone feels pet-like.

## Frontend QA

Devices:

- Small iPhone.
- Large iPhone.
- Small Android.
- Large Android.
- Notch/safe-area variants.

Check:

- No text overlap.
- Buttons are tappable.
- Long Korean/English text fits.
- Images scale well.
- App handles offline/slow network states.
- Upload permission flows work.
- Care state survives app restart.

## Backend QA

Auth:

- Unauthorized requests blocked.
- Users cannot access other users' pets/photos/jobs.

Generation:

- Job states transition correctly.
- Retry works.
- Timeout works.
- Failed generation preserves paid value.
- Asset metadata is valid.

Care:

- Care action updates state.
- Walk starts and returns.
- Rewards are granted once.

Commerce:

- Purchase verification works.
- Duplicate purchase does not double grant.
- Restore works.
- Refund/revocation handled.

Privacy:

- Delete original photo.
- Delete pet.
- Delete chat history.
- Delete account.

## AI QA

Generation:

- Correct species.
- Pet visible.
- Identity preserved.
- No extra animals.
- Style matches terrarium.
- Transparent/cutout quality acceptable.
- Bad generations are caught or recoverable.

Chat:

- Entitlement enforced.
- Input moderation.
- Output moderation.
- Crisis fallback.
- No literal consciousness claim.
- No professional advice.

Free reactions:

- No AI call.
- Anti-repeat works.
- Personality variation works.
- State-specific lines work.

## Security QA

Photo:

- Unsupported file blocked.
- Oversized file blocked.
- EXIF stripped.
- Signed URL expires.
- Deleted photo inaccessible.

API:

- Ownership enforced.
- Rate limits work.
- Validation errors safe.
- Secrets absent from client.

Commerce:

- Local purchase state not trusted.
- Server entitlement required.

Admin:

- Access is role-based.
- Sensitive actions are audited.

## Store Readiness

Required:

- Privacy policy.
- Terms.
- AI disclosure.
- Data deletion flow.
- App Store privacy labels.
- Google Play data safety form.
- Purchase/restore flow.
- Support contact.
- Screenshots.
- Age rating decision.

Permission copy:

- Photo library.
- Camera.
- Notifications if used.

## Monitoring

Track:

- Generation job failures.
- Quality gate failures.
- Upload failures.
- Chat moderation flags.
- Purchase verification failures.
- API error rates.
- App crashes.
- Cost per accepted pet.

Alert:

- Provider outage.
- High generation failure rate.
- Cost spike.
- Purchase verification errors.
- Storage access errors.
- Delete flow failures.

## Live Operations

Content:

- New reaction packs.
- Seasonal item packs.
- New themes.
- Treat animations.
- Walk discoveries.

Product:

- A/B test welcome flow.
- A/B test generation retry copy.
- Tune reaction anti-repeat.
- Tune daily rewards.
- Tune premium chat gate.

Operations:

- Cost review.
- Safety review.
- Support review.
- Store review updates.
- Content calendar.

## Release Checklist

Before closed test:

- Mock generation path.
- Real upload path.
- Basic generated asset display.
- First care action.
- Free reactions.
- Delete original photo.

Before public launch:

- Real generation quality gate.
- Purchase restore.
- Premium chat safety.
- Privacy policy.
- Store compliance.
- Monitoring.
- Support process.

## Definition Of Done

A feature is done when:

- UX state is documented.
- API contract is typed.
- Error states are handled.
- Privacy impact is reviewed.
- Tests exist for core behavior.
- Analytics events avoid sensitive data.
- iOS and Android behavior is checked.
