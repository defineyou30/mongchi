# Home UI Interaction Contract

## Scope

This contract defines the iOS Home screen interaction model.

Android is paused for this pass. Capture a fresh iOS simulator baseline when
reviewing Home UI changes; disposable QA screenshots are not retained in Git.

Related system docs:

- `docs/design/state-episode-weather-engine.md`
- `docs/design/plant-growth-object-guide.md`
- `docs/archive/legacy/new-concepts/mongchi-reaction-catalog.md`

## Product Role

Home is the main playable pet-care stage.

It should feel like a cozy miniature game world where the user's real-pet avatar lives, not like a dashboard of management cards. The scene, pet, placed items, HUD, and action buttons should all feel from the same premium 2D/2.5D mobile pet game style.

The core Home promise is:

- see the pet
- read the pet's current mood
- do one cozy care action
- optionally enter chat, inventory, shop, settings, or walk/reward flows

## Current Visual Baseline

Generate a fresh simulator capture with the commands in
`docs/mobile-native-runbook.md` before visual review.

The visual north star remains:

- `docs/design/image1.png`
- `docs/design/image2.png`

Do not copy the dome literally. Use the references for HUD density, chunky floating controls, item polish, and scene-first composition.

## Home Element Roles

### Top HUD

The top HUD is read-only pet and garden status.

Use compact capsule meters, not dashboard cards.

Current iOS HUD contract:

- Heart: current `Mood` / satisfaction meter.
- Lightning: `Energy` meter.
- Watering can or leaf: `Garden` health meter.

Rules:

- Mood is not spendable.
- Bond is long-term relationship progress and should not be shown as a spendable wallet.
- Credits/gems are spendable wallet values and belong in Shop, not the main Home scene.
- Kit is inventory quantity, not currency, and belongs in Shop or Inventory summaries.
- Do not show a coin or gem HUD on Home until a separate Home-specific reward loop exists in data.
- HUD should stay compact enough that the scene remains the hero.

### Left Utility Rail

The left rail is navigation only.

Recommended fixed order:

1. Shop
2. Chat
3. Inventory
4. Settings

Rules:

- Do not put daily care actions in this rail.
- Do not duplicate bottom care actions here.
- Keep icons large, glossy, and label-free unless accessibility requires labels.

### Bottom Action Dock

The bottom dock is the daily care action set.

Recommended five actions:

1. Feed
2. Play
3. Walk
4. Pet
5. Water

Rules:

- These are the actions the user taps repeatedly.
- They should be chunky floating square tiles like the reference.
- Icon-first design; text can be hidden or minimal.
- Each action must produce immediate feedback: pet reaction, small thought/bubble, meter delta, item animation, or scene cue.
- Basic care must never require credits or Plus.

### Right Context Area

The right side is for status and temporary context, not permanent duplicate actions.

Allowed:

- current mood/status pill, such as `Cozy`, `Needs care`, `Hungry`, `Sleepy`
- bond/level pill
- daily gift
- quest/event
- walk/reward status
- treat shop only when a treat action needs a purchase route

Avoid:

- a permanent `Play` button, because Play already belongs in the bottom dock
- a permanent `Treat shop` if there is no active treat need or promotion
- multiple stacked CTAs that make Home feel like a dashboard

## Care Action Meanings

### Feed

Primary effect:

- restores food/hunger
- gently improves mood

Possible feedback:

- food bowl animation
- happy nibble reaction
- `Food +`, `Mood +`

### Play

Primary effect:

- improves happiness
- costs some energy

Possible feedback:

- toy bounce
- playful pet pose
- `Mood +`, `Energy -`

### Walk

Primary effect:

- starts or resolves a short cozy walk episode
- can return a small discovery, memory, weather cue, or reward
- spends a little energy and can improve mood/bond

Possible feedback:

- path button cue
- pet with small bag or stepping pose
- `Mood +`, `Bond +`, `Energy -`
- weather-aware discovery, such as rainy leaf, snow sparkle, or sunny flower

### Pet

Primary effect:

- raises affection and mood
- contributes to bond XP

Possible feedback:

- heart bubble
- tail/face reaction
- `Mood +`, `Bond +`

### Water

Primary effect:

- fills the pet's water bowl
- improves thirst / hydration
- gives a calm pet reaction

Important:

Water is pet hydration on Home; plant growth belongs to a separate optional system.

This keeps the core fantasy focused on the user's pet and prevents the Home loop from feeling like a plant-care game.

Possible feedback:

- watering can cue
- plant fresh/growing/blooming cue
- `Garden +`
- first bloom reward

## Plant Growth Boundary

Plants should begin as presets.

Recommended initial depth:

- placeable plant decor
- selected growable plant presets only
- fixed stages: `seed`, `sprout`, `leafy`, `bloom`
- Water advances growth by points
- first bloom can give tiny bond XP and bonus credits

Avoid:

- full farming-game complexity
- plant death
- harsh decay
- making water mandatory for basic pet happiness

The plant loop is a supporting cozy layer, not the main game.

## Treat Boundary

Treats are optional consumables.

Use treats for:

- special reaction
- small mood or bond bump
- future credit/BM loop
- shop entry when none are owned

Do not use treats for:

- mandatory baseline happiness
- blocking normal Feed/Pet/Play
- confusing free care with paid consumables

## Chat Boundary

Home can show short authored pet reactions for free.

Longer AI chat is separate:

- routed through Chat
- gated by Plus, free ticket, or credits
- always labeled as AI-generated
- not called for every Home bubble

## Home Cleanup Priorities

When improving Home, prioritize in this order:

1. Pet and scene are visually dominant.
2. Bottom care actions are clear and not duplicated elsewhere.
3. Top HUD is compact and readable.
4. Left rail remains pure navigation.
5. Right context only shows timely status or event CTAs.
6. Placed items sit in fixed scene slots and do not block pet/action controls.
7. Reward overlays stay small and scene-aware, not full dashboard cards.

## Acceptance Checks

Before considering an iOS Home pass done:

- The screenshot uses `ios-iphone-16-pro-store-terrarium.png` as current evidence.
- The pet is not hidden by UI.
- The bottom dock has one clear care action per tile.
- `Play` is not permanently duplicated outside the bottom dock.
- `Water` reads as garden care.
- Shop, Chat, Inventory, and Settings remain reachable.
- Reward state remains reachable without covering the pet's face.
- The screen does not introduce Android-specific changes in this pass.
