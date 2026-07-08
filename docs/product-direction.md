# Product Direction

> 최신 대조: 2026-07-08 (커밋 8e8fd0c 기준)

Guide source of truth: `new-concepts/mongchi-guide/README.md`.

Mongchi is an iOS/Android cozy pet-life game plus healing companion. The first emotional promise is simple: a user's real dog or cat becomes a tiny avatar living in a cozy miniature pet world.

## Current Product Focus

The app now targets a native pre-release path:

- First-session flow: Welcome -> Photo upload -> Pet setup -> Hatching -> Pet reveal -> Main terrarium -> AI chat / premium bond -> Shop.
- Local prototype mode remains the default for fast simulator work and offline QA.
- API-backed local/integration mode can route pet profiles, source-photo upload metadata, generation jobs, generated assets, care state, inventory, walk rewards, premium chat, restore, and purchase verification through the tested backend boundaries when a public API base URL and server-owned credentials are configured; production release-config validation requires that public API base URL.
- Production still requires real auth/JWKS, Postgres, S3, store verification, provider keys, legal URLs, monitoring, and scheduler infrastructure.

## Art Direction

- Use the provided mockup as direction only, not as a full-screen image inside the app.
- Reference/mockup screen crops are not used as UI.
- The visual north star is premium cozy casual mobile game UI with a high-resolution pixel-art pet-sim hybrid, tactile rounded game HUD, glossy buttons, warm wood, cream panels, moss, flowers, sky, soft light, and a collectible miniature-world feel.
- Pet and item assets should read as modern high-resolution pixel sprites with crisp dark outlines, intentional pixel clusters, soft 2D shading, warm contact grounding, and readable game silhouettes; avoid low-resolution 8-bit or 16-bit output, noisy jagged artifacts, and generic smoothed mascot rendering.
- Photo-generated pet avatars must preserve the user's actual pet identity before generic cuteness; all required states should have distinct pose/expression/silhouette while staying one consistent dog or cat identity.
- Dome, glass, crystal, and hatch motifs are optional accents for hatching, reveal, protection, premium themes, or decorative variants rather than mandatory layout constraints.
- Major screens should read as miniature pet-world scenes instead of flat vector onboarding panels or generic mobile form pages.
- Welcome, photo upload, setup, hatching, reveal, terrarium, premium bond/chat, walk reward, and shop are built from React Native layout plus separate bundled pet, background, and item PNG assets.
- Generated-pet fallback art is bundled for dog/cat core, reaction, chat, walk, hydration, and seasonal states until approved production art and remote generated assets are mounted.
- Plant and garden objects can stay as optional fixed-placement decoration systems, but they should not take over the default pet-care loop.
- Water is pet hydration on Home; plant growth belongs to a separate optional system.
- Care, relationship, and monetization stay separate: heart/mood is derived satisfaction, bond is long-term relationship XP, credits/tickets are spendable value, and short local reactions remain free/authored.

## Implementation Approach

- Use Expo Router for mobile routing.
- Keep domain models in `packages/shared` so mobile, API, and worker use the same contracts.
- Keep free reactions authored/local; daily free speech bubbles must not call an AI provider.
- Keep provider keys, service credentials, payment verification secrets, receipt data, and storage credentials out of the mobile app.
- Treat server-owned Postgres state as the production source of truth for pet profile, generation jobs, assets, care state, inventory, conversations, and entitlements once production infrastructure is configured.
- Keep `npm run validate:ios-preflight` as the intermediate loop; Android store screenshot coverage/contact sheet and Android export have current local evidence, but final production release still requires Android recapture/signoff when UI, art, build, or device inputs change.

## First User Journey

```text
Welcome
-> Photo upload
-> Pet setup
-> Hatching
-> Pet reveal
-> Main terrarium
-> AI chat / premium bond
-> Shop
```
