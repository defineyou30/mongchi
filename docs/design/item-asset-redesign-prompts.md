# Item Asset Redesign Prompt Pack

## Direction

The current item assets are procedural placeholder icons. Replace them with a cohesive cozy high-resolution pixel-art mobile game item set that matches `docs/design/image1.png` and `docs/design/image2.png`.

The home screen should feel like one full-screen illustrated game world. Items must look like they belong on the grass, shelf, pond, and dock areas, not like separate UI stickers.

## Global Prompt

Use this prompt for every item generation batch:

```text
Create a cohesive item asset sheet for a premium cozy casual mobile pet game.

Style:
- high-resolution cozy pixel-art collectible prop style
- miniature garden / floating island pet-home mood
- warm daylight, soft 2D shading, clean rounded silhouettes, crisp dark outline
- intentional visible pixel clusters on fur, fabric, ceramic rims, grass-contact edges, and highlights
- tactile collectible objects with rim light, gentle ambient occlusion, and grounded contact shadow
- saturated but natural colors: sky blue, fresh leaf green, cream, honey gold, coral, rose pink, warm wood
- match the visual language of a polished pet sim home screen with floating HUD buttons and a lush garden background

Output contract:
- one item per cell, centered, full object visible
- transparent PNG-ready subject with clean edges
- consistent 3/4 front view unless the item is naturally flat
- consistent bottom-center contact anchor for scene placement
- no text, logo, watermark, labels, UI panels, checkerboard, frame, border, or background scene
- no cast shadow outside the object bounds except a soft detachable contact shadow
- avoid flat vector icons, low-resolution 8-bit/16-bit output, noisy jagged artifacts, clay/plastic toy rendering, and mismatched cartoon styles

Variants needed per item:
- scene: larger grounded object for home placement, with subtle contact shadow
- ui: collectible inventory/shop icon, same object centered with slightly stronger rim light
- hud: small readable icon, simplified details but same material/color identity
- action: button icon, bold silhouette and high contrast, no extra label
```

## Home Visible Item Prompts

### Food Bowl

```text
Subject: a cute ceramic pet food bowl filled with kibble.
Design notes: cream ceramic bowl with small coral paw print, honey-brown kibble, rounded lip, soft warm rim light, low oval contact shadow.
Scene scale: small foreground object placed near the pet.
Avoid: flat red bowl, floating bowl, harsh black outline, oversized shadow.
```

### Toy Ball

```text
Subject: a soft colorful toy ball for a tiny dog or cat.
Design notes: round fabric/rubber ball, pastel yellow, sky blue, coral red panels, glossy but soft, slightly squashed contact on grass.
Scene scale: small foreground toy next to pet.
Avoid: beach-ball realism, noisy jagged edges, perfect flat circle with no grounding.
```

### Pet Bed / Cushion

```text
Subject: a plush round pet cushion bed.
Design notes: rose-pink soft cushion, cream inner fabric, puffy stitched rim, gentle fabric folds, warm underside shadow.
Scene scale: medium midground item, can sit behind or beside the pet.
Avoid: envelope shape, rectangular pillow, hard icon look.
```

### Tiny House

```text
Subject: a tiny cozy pet house for a miniature garden.
Design notes: warm cream stone or wood body, terracotta roof tiles, rounded doorway, small chimney, soft moss/flower accents, grounded grass shadow.
Scene scale: large background/midground prop.
Avoid: simple flat kennel, high contrast black doorway swallowing detail, toy-block proportions.
```

### Flower Pot

```text
Subject: a small terracotta flower pot with garden blossoms.
Design notes: rounded clay pot, leafy green plant, one or two soft pink flowers, subtle soil detail, warm contact shadow.
Scene scale: small side decoration.
Avoid: flat flat-vector plant, overly pixelated leaves, large UI icon border.
```

### Hanging Lantern

```text
Subject: a warm hanging garden lantern.
Design notes: small wood-and-brass lantern with amber glow, vine hook or string, soft translucent light bloom inside object bounds.
Scene scale: hanging or side-ground light prop.
Avoid: black heavy outline, huge blur halo, modern electric lamp.
```

### Watering Can

```text
Subject: a cute mint-blue watering can.
Design notes: rounded metal body, curved handle, small spout with two tiny water droplets, soft highlight and contact shadow.
Scene scale: button/action icon and small garden prop.
Avoid: flat silhouette, noisy jagged aliasing, overly realistic metal.
```

### Pond Tile

```text
Subject: a tiny lily pond tile for a miniature garden.
Design notes: shallow oval pond with clear blue water, soft stone rim, lily pads and one small flower, painterly ripples, ground-level shadow.
Scene scale: medium/large foreground environmental item.
Avoid: sticker-like blue puddle, jagged stones, hard top-down board-game tile.
```

## Full Catalog Item List

Generate these items with the global prompt and matching style:

- food bowl
- treat plate
- bone treat
- toy ball
- plush toy
- pet bed
- tiny house
- flower pot
- leafy plant
- hanging lantern
- small lamp
- watering can
- pond tile
- stepping stone path
- reward pouch
- gift box
- coin
- gem
- seasonal flowers

## Generated Source Sheets

- `docs/design/item-asset-redesign-style-sheet-v1.png`: first 12 core item concepts.
- `docs/design/item-asset-redesign-style-sheet-v2.png`: remaining decor/item concepts for `treat-plate`, `plush-toy`, `leafy-plant`, `small-lamp`, `stepping-stone`, `reward-pouch`, and `seasonal-flowers`.

## Remaining Item Batch Prompt

```text
Create a cohesive item asset sheet for a premium cozy casual mobile pet game, matching an existing lush full-screen garden pet sim with tactile floating HUD buttons and polished high-resolution pixel-art collectible props.

Show exactly 8 standalone item concepts arranged in a clean 4x2 grid on a plain warm off-white background:
- treat plate with tiny biscuits
- plush toy
- leafy plant
- small garden lamp
- stepping stone path
- reward pouch
- seasonal flower cluster
- tiny wooden signpost

Style:
- high-resolution cozy pixel-art collectible prop style
- miniature garden / floating island pet-home mood
- warm daylight, soft 2D shading, clean rounded silhouettes, crisp dark outline
- intentional visible pixel clusters on fabric, ceramic rims, grass-contact edges, and highlights
- tactile collectible objects with rim light, gentle ambient occlusion, and grounded contact shadow
- saturated but natural colors: sky blue, fresh leaf green, cream, honey gold, coral, rose pink, warm wood

Output contract:
- each item centered in its cell, full object visible
- no text, labels, logos, watermark, UI panels, checkerboard, or background scene
- consistent 3/4 front view
- bottom-center contact anchor
- soft detachable contact shadow
- objects should feel placeable on grass, a shelf, or a home dock

Avoid:
- flat vector icons
- low-resolution 8-bit/16-bit pixel sprites
- noisy jagged artifacts
- clay/plastic toy rendering
- mismatched cartoon styles
```

## Implementation Notes

- Keep each master source at 512x512 or 1024x1024 with transparent background.
- Derive app variants from the same source:
  - `scene`: 96-192px depending on catalog size
  - `ui`: 128px
  - `hud`: 64px
  - `action`: 96px
- Do not regenerate item variants with unrelated prompts. One item identity should stay consistent across all four variants.
- Preserve current file names in `apps/mobile/assets/game-items/{scene,ui,hud,action}` so code references do not churn.
- Once a complete curated `game-items` set exists, `npm run generate:mobile-assets` preserves it instead of overwriting it with procedural fallback icons. Delete a specific item set first only when intentionally rebuilding that item from the fallback generator.
