# CLI Goal Prompt

Use this prompt when starting a fresh CLI/Codex session for Mongchi in a separate project folder.

```text
You are building Mongchi as a brand-new standalone product.

Mongchi is a cross-platform iOS/Android pet-life game where users upload a real dog or cat photo and create a tiny digital avatar that lives inside a cozy glass-dome terrarium. The app combines light game loops, healing companion interaction, AI pet creation, free authored state-based reactions, premium AI chat, decoration, collection, treats, and safe monetization.

Important project rule:
- Treat this as a new standalone app.
- Do not inherit assumptions from any previous product or repository.
- Use the provided Mongchi guide folder as the source of truth.
- If existing code is present, inspect it first, but only follow it if it matches the guide.
- If there is no app yet, scaffold from the guide rather than inventing a different product.

Start by reading these guide files in order:
1. README.md
2. 00-overview.md
3. 01-product-planning.md
4. 02-ux-flow.md
5. 03-design-and-assets.md
6. 04-frontend-guide.md
7. 05-backend-guide.md
8. 06-ai-pipeline-guide.md
9. 07-content-and-reactions.md
10. 08-security-and-privacy.md
11. 09-commerce-and-monetization.md
12. 10-qa-and-operations.md

Product north star:
"My pet has a tiny world in my phone, and it knows me."

Core product decisions:
- Platform target: iOS and Android.
- Client candidate: React Native with Expo and TypeScript.
- Visual direction: cozy pixel terrarium, soft 2.5D mobile game art, crisp pixel-inspired charm, modern rounded UI, bright sky mood.
- First flow: welcome popup -> pet name/personality -> photo upload -> generation/hatching -> pet reveal -> first terrarium -> first reaction -> first care action.
- Free speech: unlimited authored/local state-based reactions, no AI call.
- Premium speech: extended AI chat through backend only.
- AI generation: one required pet photo, optional extra photos later; no manual generated-pet editor in the first implementation.
- Care actions: feed, talk, walk, play, affection, water garden, clean, treat.
- Walk starts as idle send-and-return reward.
- Items start as decoration; treats can later trigger special cute behaviors.
- Security: original photos are private, provider keys never ship in the app, purchases are server-verified, deletion flows are required.

Your first task:
Create a practical implementation plan and initial project scaffold for this product.

If no project exists yet:
1. Propose and create a clean folder structure for a React Native/Expo TypeScript app plus backend/API and AI worker placeholders.
2. Add README files that explain each module.
3. Add initial shared TypeScript domain types for pet profile, generation job, care state, reaction rule, item, inventory, walk session, conversation, and entitlement.
4. Add a minimal app shell plan or scaffold for onboarding, terrarium, chat, inventory, shop, and settings.
5. Add mock data and a mock reaction engine before wiring real AI.
6. Keep secrets and provider keys out of the client.
7. Do not implement real purchases, production migrations, or real provider calls without explicit user confirmation.

If a project already exists:
1. Inspect the existing folder structure and package files first.
2. Summarize what exists.
3. Map existing code to the Mongchi guide.
4. Make the smallest safe next implementation step.
5. Preserve unrelated user work.

Immediate build order:
1. App shell and navigation.
2. Design tokens and base UI components.
3. Onboarding and pet setup screens.
4. Photo upload UI with mock upload.
5. Generation/hatching mock state.
6. Pet reveal screen with mock asset.
7. Main terrarium screen.
8. Local authored reaction engine.
9. Care action state transitions.
10. Walk idle reward loop.
11. Inventory and starter items.
12. Backend/API skeleton.
13. AI generation worker skeleton.
14. Security/privacy flows.

Definition of done for the first implementation pass:
- The app can run locally.
- The user can complete a mocked first-session flow.
- A mock pet appears in the terrarium.
- Feed/talk/walk/affection/water actions update local care state.
- Free reaction bubbles are selected from local authored rules without AI.
- The structure is ready for backend and AI generation integration.
- All implementation choices are documented.
```
