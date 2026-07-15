# Mongchi Backend And Release Audit

Last verified: 2026-07-12

This document is the current implementation-backed status for the Supabase
backend and release gates. Code and live CLI output take precedence over older
planning documents.

## Current Runtime

| Area | Current implementation | Verified state |
| --- | --- | --- |
| Authentication | Supabase anonymous auth | Active; every Edge Function resolves the JWT user |
| Avatar generation | `supabase/functions/generate-avatar` | Active deployment version 24 |
| AI chat | `supabase/functions/chat-turn` | Local code is fail-closed and server-authoritative; deployment remains to be verified |
| Account deletion | `supabase/functions/delete-account` | Active deployment version 3 |
| Database | Supabase Postgres migrations `0001` through `0015` exist locally | Operator previously confirmed `0013`; `0014`-`0015` require remote push/verification |
| Storage | Private `pet-media` bucket with RLS and one-hour signed reads | Implemented locally |
| AI provider | OpenAI key and image model/quality secrets exist server-side | Active; monthly provider spend cap is external and was not verifiable from this repository |

`supabase secrets list` confirms that `GENERATION_TEST_STATES` and
`GENERATION_DRY_RUN` are not configured in the linked project. Secret values
were not read or recorded.

## Release Blockers

### C1. Chat cost abuse controls are fixed locally; deployment is pending

Migration `0014_chat_turn_guardrails.sql` and the current `chat-turn` code now
enforce the boundary before any provider call:

- the client no longer sends or selects `charge`;
- `reserve_chat_turn` decides starter-free, daily-free, Plus, or credit on the
  server and debits credit before OpenAI is called;
- a user-global rolling rate bucket cannot be reset by changing `petId`;
- `(user_id, request_id)` is reserved first and completed requests replay the
  stored response without another provider call;
- failed provider/save paths call `fail_chat_turn`, which restores the reserved
  free allowance or credit;
- normal-turn messages and the replay payload commit in one SQL transaction,
  so a partial saved-message/stuck-request state cannot be created;
- `CHAT_LIVE_ENABLED` is fail-closed, and the mobile entry point is also off
  unless `EXPO_PUBLIC_TINY_PET_LIVE_CHAT_ENABLED=true`.

**Release rule:** keep both flags off until migration `0014` and the current
function are deployed and exercised against the linked project. This closes
the original cost-abuse finding in the repository, not yet in the verified
remote runtime.

### C2. Crisis moderation requires external expert sign-off

Confirmed. `supabase/functions/chat-turn/moderation.ts` explicitly labels its
self-harm patterns, thresholds, and eight-locale referral copy as draft and as
a C4 launch gate. The code path itself is valuable: an input match skips the
LLM, skips charging, stores a system referral, and supplies US 988 plus
`findahelpline.com`. That implementation does not replace professional review.

**Release rule:** either obtain documented mental-health professional review
for detection sensitivity, regional accuracy, and all localized copy, or ship
v1 with live AI chat disabled.

### C3. Legal pages exist, but release URLs are not configured

The canonical legal documents no longer contain company, jurisdiction, or
support-email placeholders:

- Operator: DefineYou
- Jurisdiction: Republic of Korea
- Contact: `lucas@define-you.com`

They remain unreviewed legal drafts and are currently uncommitted. The mobile
environment does not define `EXPO_PUBLIC_TINY_PET_PRIVACY_URL`,
`EXPO_PUBLIC_TINY_PET_TERMS_URL`, or
`EXPO_PUBLIC_TINY_PET_SUPPORT_EMAIL`, so the in-app external links and support
email action remain disabled.

**Release rule:** publish the legal pages to stable HTTPS URLs, set the three
production public variables, run `npm run validate:production-release-config`,
and enter the Privacy Policy URL in App Store Connect.

### C4. Release configuration is incomplete

- The audit began with 24 modified and 24 untracked paths; this documentation
  refresh adds more changes. The substantially dirty worktree is a release
  reproducibility risk, not evidence of missing GitHub linkage.
- `apps/mobile/app.json` is version `0.1.0`; choose and set the actual first
  store version before release.
- `eas.json` exists, but `eas project:info --non-interactive` reports that the
  EAS project is not configured. Run `eas init` before relying on EAS Build or
  Submit.
- The linked Edge Functions are active, but migration deployment cannot be
  rechecked from CLI until the saved database password is corrected.
- The schema default for `generation_quota.free_limit` is `1`. The live value
  for existing QA users is unknown; query and normalize it before release.
- No generation test-state or dry-run secret is active in the linked Supabase
  project.
- OpenAI monthly budget and alert thresholds are provider-account settings and
  still require dashboard confirmation.

## Medium-Priority Findings

| Feedback | Verdict | Current evidence | Required action |
| --- | --- | --- | --- |
| No crash visibility | Confirmed | Mobile reporter is a local AsyncStorage ring buffer of 20 entries | Add a remote crash/error SDK before public rollout |
| No network timeouts anywhere | Corrected locally | Common API fetch aborts at 30 seconds; Supabase auth/storage/query/function/account-deletion calls have bounded waits | Verify slow/offline behavior on device |
| Home rerenders every second | Confirmed risk | `TerrariumHomeScreen.tsx` is 3,855 lines and updates `clock` every second | Isolate the clock/cooldown surface and profile on a lower-end physical device before refactoring |
| No chat-response report action | Corrected locally | Migration `0015` owns reports; pet-AI messages expose a localized reason dialog and persist through `report_chat_message` | Deploy `0015`; define the support review SLA |
| Signed URLs last seven days | Corrected locally | Mobile generated-asset reads now request one-hour URLs | Verify foreground refresh after expiry |
| Font and generated-asset size | Confirmed | Three Fusion Pixel fonts total about 11.4 MB; generated assets total about 42 MB | Subset fonts and remove unreferenced candidate art from the production bundle |
| Credits permanently dead-end after about 60 | Incomplete diagnosis | Local bond/walk/plant rewards grant bonus credits, but server-paid generation consumes only server `credit_wallets` | Unify earn/spend authority, then add IAP or a bounded repeatable server grant; do not advertise local bonus value that cannot fund server generation |

Apple's current guidelines explicitly require reporting and response mechanisms
for user-generated/social content and for software offered under its chatbot
rule. Mongchi's one-to-one generated pet chat is not named as a separate AI
category in the guideline, so a per-response report button is treated here as
a prudent review and support control, not as a quoted universal AI-chat rule.

External release references:

- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple App Privacy configuration: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy
- Expo EAS project setup: https://docs.expo.dev/build/setup/

## Dog And Cat Support

Cat support is already present below the UI layer:

- `PetSpecies` is `"dog" | "cat"`.
- API request schemas, Supabase avatar generation, source-photo checks, quality
  evaluation, and chat context accept both species.
- The generation prompt explicitly preserves dog or cat identity.
- Bundled Luna cat fallback assets exist for the same state set as Miso.

The real cat journey is now open in local code:

- pet setup presents accessible Dog/Cat selection slots and writes the selected
  `PetSpecies` into the existing generation draft;
- welcome, photo-intro, upload, and setup copy is pet-neutral across all eight
  locales;
- the same generation, fallback, profile, and chat contracts remain shared by
  both species.

Remaining cat launch QA:

- Onboarding story art is dog-specific.
- Some authored reaction rules and thirst copy are dog-only; general fallback
  rules work, but the cat experience is less authored.
- Cat generation needs a real-photo QA matrix before launch.

Recommendation: keep cats in the same v1 scope, but do not advertise parity
until onboarding art and the real-photo/state QA matrix are complete. Details
are tracked in `docs/product/cat-expansion.md`.

## Required Order

1. Deploy/verify migrations `0014`-`0015` and the current `chat-turn`; keep live chat disabled until professional safety sign-off.
2. Publish legal/support pages and set production URLs/email.
3. Reconcile and commit the worktree; rerun tests and native exports from that commit.
4. Verify migrations `0001`-`0015`, live `free_limit`, Edge Function secrets, and OpenAI spend controls.
5. Configure EAS and set the first store version/build numbers.
6. Add remote crash reporting; mobile network waits are now bounded locally.
7. Finish neutral onboarding art and run dog/cat generation QA separately.
