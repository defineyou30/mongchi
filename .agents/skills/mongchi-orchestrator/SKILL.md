---
name: tiny-pet-orchestrator
description: "Coordinate Tiny Pet Terrarium product, design, care-loop, shop, onboarding, asset, and iOS QA work. Use when the user asks to continue the app, improve UX/UI, adjust pet states, shop/BM flows, weather/time engines, onboarding, or rerun scenario QA. Do not use for unrelated one-line code questions."
---

# Tiny Pet Orchestrator

Run Tiny Pet Terrarium changes as a direct main-agent workflow. Do not spawn subagents unless the user explicitly asks for subagents, parallel agents, or delegation.

## Source Of Truth

- Product/design contract: `DESIGN.md`
- Project pointer: `AGENTS.md`
- Mobile app: `apps/mobile`
- Shared domain: `packages/shared/src`
- Generated art: `apps/mobile/assets`
- QA screenshots: `docs/qa-screenshots`

## Workflow

### Phase 0: Context Check

- Confirm the requested work belongs to Tiny Pet Terrarium.
- Read `DESIGN.md` before touching UI.
- Search current code with `rg` before assuming behavior.
- Preserve unrelated user edits and generated assets.

### Phase 1: Product And State Contract

- Identify affected loops: onboarding, avatar generation, home care, chat, walk, shop, settings, weather/time.
- For care actions, compare producer/consumer contracts across:
  - `packages/shared/src/domain/care.ts`
  - `packages/shared/src/care/localCare.ts`
  - `packages/shared/src/session/prototypeSession.ts`
  - `apps/mobile/src/features/session/TerrariumSessionProvider.tsx`
  - `apps/mobile/src/features/terrarium/*`
- Document if a user-facing concept still has an older code name, such as `water_garden`.

### Phase 2: Design And Assets

- Match the pixel-gloss button and cozy storybook background style in `DESIGN.md`.
- Do not add extra cream/card backgrounds behind PNG button assets that already include rim/gloss.
- Generate or use assets in small focused batches. Avoid packing too many sprites into one image.
- Keep plant/placement/decor inventory hidden unless the user explicitly brings placement back.

### Phase 3: Implementation

- Prefer narrow helper modules over adding more logic to oversized screens.
- Keep shop categories focused on treats, themes, and inventory.
- Care actions should support base actions plus premium/special item variants.
- Time/weather/status reactions should make daily use feel varied without requiring AI for every tap.
- Use custom in-app dialogs instead of native alerts for user-facing flows.

### Phase 4: Verification

- Run the smallest relevant tests first, then the mobile typecheck.
- For visual changes, capture iOS simulator screenshots for the affected flows.
- For scenario QA, actually tap through: feed, treat, play, walk, pet, water, shop theme apply, settings back, loading, onboarding.
- Report failures before claiming completion.

## Trigger Examples

- "홈 화면 상호작용이 반복적이지 않게 상태엔진 수정해줘"
- "상점 BM 구조랑 테마 적용까지 다시 정리해"
- "온보딩부터 홈까지 iOS QA 돌려서 깨지는 부분 고쳐"

## Near Miss Examples

- "이 문장 번역해줘" -> answer directly.
- "package.json 이름 뭐야?" -> answer directly after reading.
- "이미지 하나 만들어줘" -> use imagegen workflow, not this orchestrator unless it affects the app.

## Failure Handling

- Retry transient command failures once.
- If Expo/dev-client validation cannot run, still run typecheck and explain the blocked QA.
- If an asset exists but is visually wrong, archive or hide it rather than deleting user work without permission.
