# Category Asset Generation Contract

## Why

Do not generate every pet, item, button, HUD, and shop asset in one large image. Large mixed sheets make small objects melt together, cause inconsistent outlines, and make later slicing unreliable.

Generate by category. Each source sheet must have one visual job, one scale family, and a small fixed grid.

## Shared Style

- Premium cozy mobile pet game.
- High-resolution cozy pixel-art hybrid, not low-resolution 8-bit/16-bit.
- Crisp dark outline, soft 2D shading, intentional pixel clusters, clean silhouette.
- Warm garden daylight, cream/wood UI, pink/coral/yellow/green accents.
- No labels, no watermarks, no UI frames inside asset cells unless the sheet is specifically for button frames.
- Each cell must have generous padding, full object visible, centered bottom anchor.

## Sheet Rules

- Maximum 6 assets for character action sheets.
- Maximum 9 assets for item or button sheets.
- Never mix pet characters, shop props, HUD buttons, and background scenery in one source sheet.
- Every grid cell must have equal size and a plain removable background.
- Name every cell in the prompt, left-to-right and top-to-bottom.
- Keep a separate source image for each category before slicing into app PNG variants.

## Pet Action Sheets

Generate two separate sheets:

### Dog Action Sheet

```text
Create a 3x2 source sheet for one consistent small dog companion in a premium cozy mobile pet game.

Cells, left to right:
1. idle sitting, happy eyes
2. feeding, front paws near a bowl
3. play, leaning toward a toy ball
4. walk, tiny backpack and stepping pose
5. sleep, curled up peacefully
6. affection, one paw raised with heart mood

Style: high-resolution cozy pixel-art pet sprite, crisp dark outline, plush fur clumps, expressive glossy eyes, soft 2D shading, intentional pixel clusters, warm garden daylight.
Constraints: same dog identity in every cell, no background scene, no text, no UI, no duplicated pose with only mouth/color changes.
```

### Cat Action Sheet

```text
Create a 3x2 source sheet for one consistent small cat companion in a premium cozy mobile pet game.

Cells, left to right:
1. idle sitting, bright eyes
2. feeding, front paws near a bowl
3. play, batting a toy ball
4. walk, tiny backpack and stepping pose
5. sleep, curled up peacefully
6. affection, tail curl with heart mood

Style and constraints match the dog action sheet.
```

## Button Asset Sheets

Use one or two 3x2 sheets. Do not exceed 6 per sheet unless the prompt explicitly uses a 3x3 grid.

```text
Create a 3x2 source sheet of chunky floating mobile game action buttons.

Cells:
1. feed button, coral red, food bowl icon
2. play button, honey yellow, toy ball icon
3. rest button, sky blue, moon icon
4. affection button, rose pink, heart icon
5. water button, leaf green, watering can icon
6. shop button, warm wood, striped shop icon

Style: tactile rounded square buttons, thick cream rim, clean solid face, no inner translucent haze, no text, icon centered, readable at 64px.
```

## Item Sheets

Generate by item family:

### Food And Treats

```text
Create a 3x3 source sheet of cozy pet food and treat items.
Cells: food bowl, treat plate, bone treat, biscuit pouch, milk bowl, fish snack, kibble jar, reward pouch, tiny picnic basket.
Style: high-resolution cozy pixel-art collectible props, crisp outline, soft 2D shading, bottom-center contact anchor.
```

### Toys And Comfort

```text
Create a 3x3 source sheet of cozy pet toy and comfort items.
Cells: toy ball, plush bear, rope toy, pet bed, cushion, blanket nest, squeaky duck, yarn ball, tiny chew toy.
```

### Garden Decor

```text
Create a 3x3 source sheet of miniature garden decor items.
Cells: tiny house, flower pot, leafy plant, hanging lantern, small lamp, pond tile, stepping stones, seasonal flowers, wooden signpost.
```

### Currency And Premium

```text
Create a 3x2 source sheet of shop currency and premium reward icons.
Cells: gem, coin, gift box, plus pass ticket, locked chest, starter bundle.
```

## Shop Character Sheet

Generate separately from products.

```text
Create one shop helper character for a cozy mobile pet shop scene.

Subject: a small dog shop helper wearing a tiny green backpack, cheerful walking/selling pose.
Composition: full body, centered, transparent-ready plain background, no shelf or shop UI.
Style: same high-resolution cozy pixel-art pet sprite style as the dog action sheet.
Use: placed in the upper shop showcase above the product grid.
```

## Implementation Notes

- Save source sheets under `docs/design/source-sheets/`.
- Slice approved cells into:
  - `apps/mobile/assets/generated/pets/{dog|cat}/`
  - `apps/mobile/assets/game-items/{scene,ui,hud,action}/`
  - `apps/mobile/assets/shop/`
- Scene items may keep a subtle contact shadow.
- Button, HUD, and price icons must not include baked floor shadows.
- After slicing, run:
  - `npm run validate:mobile-assets`
  - `npm run validate:mobile-visual-assets`
  - `npm run generate:mobile-asset-contact-sheet`
