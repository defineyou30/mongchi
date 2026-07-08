<!--
  Mongchi Privacy Policy — canonical source.

  IMPORTANT (read before publishing):
  This document was drafted by an engineering assistant from the app's actual
  code paths (see apps/mobile/src/features/legal/PrivacyScreen.tsx and
  supabase/functions/generate-avatar/index.ts for the flows this describes).
  It is NOT legal advice. Before publishing this to a public URL and
  submitting to app stores, have a lawyer review it for your jurisdiction(s),
  confirm GDPR/CCPA applicability to your actual user base, and fill in the
  [JURISDICTION] and contact placeholders below.

  This file must stay in sync with apps/mobile/src/features/legal/PrivacyScreen.tsx.
  If you change one, change the other.
-->

# Mongchi Privacy Policy

**Last updated:** July 8, 2026
**Version:** 1.1

Mongchi ("the app", "we", "us") is a pet-care healing app that turns a photo
of your real pet into an AI-generated pixel companion you can care for. This
policy explains what data the app collects, how it is used, who it is shared
with, and the choices you have.

This is a summary of our actual data flows, written in plain language. It is
not a substitute for reading the full text below if you have specific
concerns.

## 1. No account, no email required

Mongchi does not ask for your name, email address, or phone number. When you
open the app for the first time, it creates an **anonymous authentication
session** (via Supabase Auth) tied only to a random session identifier stored
on your device. We do not know who you are, and there is no password or
account-recovery flow because there is no account to recover.

## 2. What we collect

| Data | Purpose | Where it lives |
| --- | --- | --- |
| A photo of your pet (source photo) | To generate your pixel companion's avatar art | Uploaded temporarily to our private storage bucket, then **automatically deleted the moment generation finishes** (see §3) |
| Generated avatar images | Your companion's in-app appearance | Private storage bucket, accessible only via short-lived signed URLs |
| Pet profile (species, name, personality tags, talking style) | To personalize the avatar and any AI chat | Sent to our generation and chat services as needed |
| Game state (care stats, memories, garden progress, credits) | To run the game | **Stored locally on your device only** (AsyncStorage), not on our servers |
| Approximate location (optional) | To show weather-matched garden scenes | Read from your device's location permission at low accuracy; used for a one-time weather lookup and not stored on our servers |
| Anonymous session identifier | To let the anonymous auth session work at all | Stored locally on your device; sent to our API with each request |
| Basic technical/analytics events (e.g. "generation issue reported") | To fix bugs and understand feature usage | Sent to our analytics pipeline; deliberately excludes raw photos, raw chat text, and payment details (see §6) |

We do **not** collect your contacts, precise/continuous location tracking,
advertising identifiers, or browsing history from other apps.

## 3. Your pet's photo: the full lifecycle

This is the most sensitive data flow in the app, so we describe it in detail:

1. You select or take a photo of your real pet and upload it to a private
   storage bucket (`pet-media`), scoped to your anonymous session.
2. The photo is sent to **OpenAI** for two purposes: (a) an automated safety
   check to confirm the image is an ordinary, appropriate pet photo, and (b)
   image generation, which uses the photo as a visual reference to create
   your companion's pixel-art avatar in several poses/expressions.
3. Once generation completes successfully, **the original uploaded photo is
   automatically deleted from our storage** as part of the same server-side
   job that created your avatar. We do not keep a copy.
4. If you later unlock additional expression states for your companion (an
   "expression pack"), we do not ask for your photo again — we seed the new
   art from a **previously generated avatar image** (art we created, not your
   original photo), because the original photo no longer exists on our
   servers at that point.
5. The generated avatar images themselves are kept (they are your
   companion's appearance) in a **private** storage bucket. The app displays
   them using short-lived **signed URLs** that expire, rather than public
   links.
6. You can delete your original photo separately from the generated avatar
   at any time the flow is in progress, and you can request deletion of your
   data entirely — see §8.

## 4. Third parties we share data with

We keep the list of third parties short and purpose-limited:

- **OpenAI** — receives your pet's source photo (for the safety check and
  avatar generation described in §3) and, for premium AI chat, your pet's
  profile and relevant conversation context (name, personality tags, talking
  style, and recent messages) to generate in-character responses. OpenAI
  processes this data to fulfill our request; see OpenAI's own privacy
  policy for how they handle API data. Premium chat responses are labeled as
  AI-generated and pass through a moderation check before being shown to you.
- **Supabase** — our backend infrastructure provider. Supabase hosts our
  database, private storage buckets, and anonymous authentication. Supabase
  processes data on our behalf and does not use it for its own purposes.
- **Apple / Google (in-app purchases)** — if and when Mongchi offers paid
  credits or items via Apple's App Store or Google Play in-app purchases,
  the purchase itself is handled entirely by Apple/Google's payment systems.
  We receive a purchase receipt/transaction ID to verify and grant your
  in-app credit — we do not receive or store your card number.

We do **not** use advertising SDKs, third-party analytics SDKs with
cross-app tracking, or data brokers. There are no ads in Mongchi.

## 5. Location data

Location access is optional and used only to look up approximate local
weather so your companion's garden scene can match real-world weather. We
request the lowest-accuracy location reading available, use it for a single
weather lookup, and do not store a history of your location. If you decline
location permission, the app falls back to a manual/local weather preview
instead.

## 6. Analytics

We record lightweight product-usage events (for example, that a generation
issue was reported, and which category) to help us find and fix bugs. Our
analytics events are deliberately scoped to exclude raw photos, raw chat
text, and payment details.

## 7. Children's privacy

Mongchi is not directed at children under 13 (or the equivalent minimum age
in your region), and we do not knowingly collect personal information from
children under that age. Because the app does not collect names, emails, or
other identifying account information, we have no practical way to link data
to a child's identity — but if you believe a child has provided us
information through a pet photo or chat and you would like it removed,
contact us using §9 and we will delete it.

## 8. Your rights and choices

Depending on where you live (for example under the EU/UK GDPR or the
California CCPA/CPRA), you may have rights to access, correct, export, or
delete the data associated with your session, and to object to or restrict
certain processing. Because Mongchi does not use accounts, most of these
rights map onto your device session:

- **Delete your original photo** — available directly in the app during the
  photo/generation flow.
- **Delete your data entirely** — available directly in the app: go to
  Settings and choose "Delete pet data." This deletes this device's local
  data and also asks our servers to delete your uploaded photo, generated
  avatars, and every database record tied to your anonymous account
  (generation history, credit balance, and pet slots), then deletes the
  anonymous account itself. If the app can't reach our servers when you do
  this (for example, you're offline), your local data is still cleared
  immediately and the app will tell you to try again later so the
  server-side deletion can complete. You can also contact us (see §9) if
  you'd rather request this by email, or if you run into trouble with the
  in-app option.
- **Local game data** — since care stats, memories, and progress live only
  on your device, uninstalling the app or clearing its storage removes that
  data immediately, without needing to contact us. Note that this data does
  not currently sync or back up anywhere else, so this action is permanent.
- **California residents**: we do not sell or share personal information as
  defined by the CCPA/CPRA, and we do not use your data for cross-context
  behavioral advertising.

To exercise any of these rights, use the contact details in §9.

## 9. Contact us

For privacy questions, deletion requests, or concerns, contact us at the
support email listed in the app's Support screen, or at:

**[SUPPORT_EMAIL — see EXPO_PUBLIC_TINY_PET_SUPPORT_EMAIL]**

## 10. Changes to this policy

We may update this policy as the app changes. We will update the "Last
updated" date above when we do. Material changes affecting how we handle
your pet's photo or generated data will be reflected here before they take
effect.

## 11. Governing law

This policy is governed by the laws of **[JURISDICTION]**. This placeholder
must be filled in (with legal counsel) before publishing.
