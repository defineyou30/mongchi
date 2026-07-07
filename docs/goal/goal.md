Goal: Rework Mongchi's Home UI, full app flow, and entire shop/item asset system using the attached references as the visual north star.

Attached references:

- Image 1: Home UI / asset quality / button style / HUD / item placement reference. (mongchi/docs/goal/image1.png)
- Image 2: Full app flow and screen concept reference.
  (mongchi/docs/goal/image2.png)

Important:
Do not copy the dome or circular terrarium shape literally.
The glass dome and round island are optional motifs only.
What we want from the references is the overall game UI feeling:

- premium cozy mobile pet game
- rich miniature world
- high-resolution cozy pixel-art game illustration
- polished item assets
- chunky glossy buttons
- compact HUD meters
- collectible decoration feeling
- dense but readable game screen composition

Do not interpret this as low-resolution 8-bit/16-bit pixel art.
The target is the polished high-resolution pixel-sprite game asset feeling shown in the references.

Current problem:
The current implementation still feels too flat, too app-like, or visually inconsistent.
Previous attempts overcorrected between flat mascot, low-resolution sprite, and smoothed mascot.
The Home screen should feel closer to Image 1 in UI density, button treatment, HUD, asset polish, and pet-world composition.

Primary objective:
Use Image 1 as the Home visual north star.
Use Image 2 as the full-flow concept north star.
Rebuild Home first, then apply the approved visual language across the app.

Home screen direction:

- Rebuild Home as the visual acceptance gate.
- Use Image 1 as the main Home UI reference.
- Ignore the literal dome/round base if it conflicts with our layout.
- Build a cozy miniature pet world scene where the pet lives.
- Pet, items, buttons, HUD, and background must feel from the same game world.
- The screen should feel like a playable mobile pet game, not a dashboard.
- Do not use the reference image as a static screenshot. Rebuild real components and real asset layers.

Home UI requirements:

- Top HUD should use compact game meters for mood, energy, and garden health only.
- Credits/gems and kit inventory counts belong in Shop wallet or Inventory summaries, not the main Home HUD.
- Do not show a coin HUD on Home until a separate Home-specific reward loop exists in data; collectible coin items may still exist as decor/rewards.
- Use rounded meter capsules with glossy item icons, similar to the reference.
- Avoid large dashboard stat cards.
- Add side utility buttons if useful: shop, camera/photo, missions, inventory, book/profile.
- Bottom action buttons should be large chunky square tiles like the reference:
  food, play, sleep/rest, affection, water, walk/treat.
- Buttons need glossy face, thick rim, soft shadow, icon-first design.
- Text should be minimal inside action buttons.
- Home must remain functional: care actions, reactions, chat, inventory, shop, settings, walk reward.

Use `docs/design/home-ui-interaction-contract.md` as the current iOS Home interaction contract for HUD, left utility rail, bottom care dock, right context area, water/garden care, and duplicate CTA cleanup.

Pet direction:

- The pet must look like a polished high-resolution pixel-art cozy mobile game companion.
- It should match the attached reference style and the Home scene.
- Do not preserve the current bad mascot style.
- Do not make a low-resolution 8-bit/16-bit sprite.
- Do not blur or smooth an existing mascot.
- Redraw or replace the pet asset direction if needed.
- Pet should have crisp dark outline, visible pixel clusters, warm lighting, detailed fur tufts, clear silhouette, expressive eyes, and natural grass contact shadow.
- The pet should feel like a modern pixel sprite made for the scene, not pasted on top.

Item and shop asset reset:
Delete, replace, or stop using the current shop/item assets if they do not match the new reference direction.
Do not polish the existing mismatched item icons.
Recreate the item catalog visually from scratch to match the attached Home UI reference.

Important:
The item system must be designed for actual placement inside the Home background scene.
Do not create item icons only for shop cards.
Every placeable item must have a scene-placement version with predictable size, anchor point, category, and z-layer.

Item asset requirements:

- Create a new cohesive item set for the cozy pet world.
- Items should match the reference style:
  polished high-resolution pixel-sprite mobile game objects
  warm lighting
  soft contact shadow
  tactile material highlights
  collectible casual-game look
- Avoid low-resolution 8-bit/16-bit sprites.
- Avoid flat emoji-like icons.
- Avoid generic placeholder icons.
- Avoid merely smoothing or recoloring old assets.

Required item categories:

- food
- toy
- bed
- house
- plant
- light
- water
- path
- reward
- premiumDecor
- seasonalDecor

Initial item set:

- food bowl
- treat plate
- toy ball
- plush toy
- pet bed / cushion
- tiny pet house
- flower pot
- leafy plant
- hanging lantern
- small lamp
- watering can
- pond / water tile
- stepping stone / path tile
- reward pouch
- gift box
- coin
- gem
- seasonal flower decor

Two asset variants per item where useful:

1. Scene asset
   - used inside the Home scene
   - includes perspective and contact shadow
   - sized for placement slots
   - transparent background
   - visually grounded

2. UI icon asset
   - used in shop, inventory, HUD, and buttons
   - can be more front-facing and simplified
   - still must match the same material style
   - transparent background

Fixed sizing and placement contract:
Define a consistent asset sizing system before integrating items.

Use fixed logical asset sizes:

- small decor scene asset: 96x96
- medium decor scene asset: 128x128
- large decor scene asset: 160x160
- hero/house scene asset: 192x192
- UI icon asset: 128x128
- HUD icon asset: 64x64
- action button icon asset: 96x96

Each scene asset must define:

- assetId
- category
- sceneSize: small | medium | large | hero
- pixelWidth
- pixelHeight
- anchorX
- anchorY
- defaultScale
- allowedSlots
- zLayer: background | midground | petAdjacent | foreground
- canOverlapPet: boolean
- contactShadow: baked | runtime | none

Anchor rules:

- anchorX should usually be 0.5.
- anchorY should usually be 1.0 for ground-based objects.
- Hanging/light items may use anchorY 0.0 or 0.15.
- Wall/shelf items may use slot-specific anchors.
- Ground objects should align to the slot floor using anchorY 1.0.

Home item placement system:
Do not randomly place items.
Create a fixed decoration-slot system for Home.

Home scene should have predefined placement slots:

- petCenterSlot
- foodSlot: accepts food
- toySlot: accepts toy
- bedSlot: accepts bed
- houseSlot: accepts house
- leftPlantSlot: accepts plant / seasonalDecor
- rightPlantSlot: accepts plant / seasonalDecor
- lightSlot: accepts light
- waterSlot: accepts water
- pathSlot: accepts path
- rewardSlot: accepts reward
- premiumSlot: accepts premiumDecor

Each slot should define:

- x/y position
- zIndex/layer
- scale
- allowed item category
- optional rotation
- whether the pet can overlap it
- whether the item appears behind or in front of the pet

The placement system should scale scene assets consistently:

- small: around 12-16% of scene width
- medium: around 16-22% of scene width
- large: around 22-28% of scene width
- hero/house: around 28-34% of scene width

Placement rules:

- Items must sit naturally in the scene with contact shadows.
- Items should not overlap the pet's face/body.
- Items should not block care buttons or HUD.
- Foreground items can partially overlap the ground, but not the pet.
- Background decor should appear behind the pet.
- Scene objects and UI icons may use separate asset variants if needed.

Background and item compatibility:
When creating backgrounds, reserve clear placement areas for items.
The Home background should have visible but uncluttered zones for:

- pet center
- left foreground decor
- right foreground decor
- back house/decor
- water/path area
- light/hanging decor
- food/toy near pet

Do not create a background that is so detailed that placed items disappear.
Do not create items with colors too similar to the ground.
Items must remain readable at mobile size.

Shop / Inventory requirements:

- Shop should display UI icon assets.
- Inventory should display UI icon assets.
- Home should display scene assets.
- Do not reuse tiny HUD icons as scene objects.
- Do not reuse large scene objects directly in compact HUD without an icon variant.
- Every shop item should preview where it can be placed.
- Shop should feel like a cozy item shelf/store inside the same world, not an ecommerce list.
- Inventory should feel like a toy shelf, storage box, or garden kit.
- Item cards should clearly show:
  owned, placed, locked, premium, new, reward-ready.
- Product cards should use game UI materials.

Full flow direction using Image 2:
After Home is visually aligned, update the full flow to match Image 2's concept:
Welcome -> Setup -> Photo Upload -> Hatch -> Reveal -> Home -> Chat/Bond -> Inventory/Shop/Walk Reward.

Screen-specific direction:

- Welcome: entering a tiny pet world, starter gift, photo CTA, cozy game feel, reduced explanatory text.
- Setup: adoption pass, name tag, species selector, trait charms, pet preview.
- Photo Upload: photo cards, optional slots, camera/library buttons, safe consent chip.
- Hatch: magical generation moment, glow, progress, pet silhouette forming.
- Reveal: celebration scene, pet hero, starter gift/reward badge, confetti, glow, retry/report de-emphasized.
- Home: use Image 1 as the main UI reference.
- Chat/Bond: warm bond scene, pet present, speech bubbles, premium deeper-chat gate as locked reward, AI disclosure as small secondary safety chip.
- Inventory/Shop: wooden shelf / toy shelf / garden kit, collectible item cards, owned/placed/locked/new states.
- Walk Reward: pet returns from path, reward pouch/item, claim reward panel.
- Settings/Support/Legal: can stay more utilitarian, but must use the same panel/button material language.

Implementation constraints:

- Keep current React Native / Expo structure.
- Keep existing routes and session logic.
- Do not break the first-session flow.
- Do not remove privacy, AI disclosure, retry/report, settings, inventory, shop, or walk functionality.
- Do not introduce production secrets or real external services.
- If using generated raster assets, place them in the appropriate app asset folders and update the asset registry.
- Do not leave old mismatched item assets referenced by primary Home/Shop/Inventory UI.
- Keep validation/typecheck scripts passing.

Suggested workflow:

1. Inspect current asset registry and Home composition.
2. Define the placement slot contract and item asset manifest.
3. Recreate or replace the Home background/pet/item assets according to the reference style.
4. Rebuild Home UI/HUD/buttons using Image 1 as the visual gate.
5. Verify Home screenshot first.
6. If Home does not visually match the reference direction, iterate before touching all screens.
7. Once Home passes, update Welcome, Photo Upload, Setup, Hatch, Reveal, Chat, Inventory, Shop, and Walk Reward using Image 2.
8. Run typecheck and existing mobile/native validations.
9. Capture final screenshots for Home and the main flow screens.

Acceptance criteria:

- Home looks visually closer to Image 1 in UI quality, buttons, HUD, item placement, and asset polish.
- The dome/round base is not required, but the premium cozy game feeling is required.
- Pet and items look naturally placed in the world.
- Items can be replaced through fixed decoration slots.
- Home uses scene-placement assets, while Shop/Inventory/HUD use appropriate UI icon assets.
- Current mismatched item assets are no longer used in primary Home/Shop/Inventory UI.
- Buttons look like game buttons, not normal app CTAs.
- Full flow screens follow the visual concept shown in Image 2.
- Existing typecheck and validation scripts pass.
