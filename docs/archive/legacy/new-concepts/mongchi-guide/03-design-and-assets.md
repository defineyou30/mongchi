# 03 Design And Assets

## Design Direction

Core visual phrase:

```text
cozy pixel terrarium, soft 2.5D mobile game art, crisp pixel-inspired charm, modern rounded UI, bright sky mood, tiny glass-dome pet world
```

Reference:

![Mongchi reference](assets/mongchi-reference-v1.png)

## Visual Identity

The world should feel:

- Tiny.
- Warm.
- Collectible.
- Magical but grounded.
- Fresh and bright.
- Emotionally safe.
- Premium casual game quality.

Avoid:

- Generic pet app.
- Normal bedroom simulator.
- Pure retro 8-bit.
- Dark fantasy.
- Photorealism.
- UI clutter.
- Beige-only or purple-only palette.

## Master Style Prompt

```text
Style: premium casual mobile game art, soft 2.5D illustration mixed with crisp pixel-inspired charm. Cozy tiny glass-dome terrarium world floating in a bright sky. Rounded modern mobile UI language, clear hierarchy, soft shadows, polished app-store-ready finish. Fresh palette with sky blue, mint green, apple green, coral, soft yellow, warm white, and small saturated accents. Emotionally warm, playful, gentle, not childish.
```

## Master Avoid Prompt

```text
Avoid: readable text inside the image, logos, brand names, watermarks, dark fantasy, photorealism, cluttered interface, generic room simulator, pure 8-bit pixel art, horror, grief exploitation, copy of existing games, beige-only palette, purple-only palette, harsh shadows, messy UI, tiny unreadable buttons.
```

## UI Asset Rules

- Do not bake readable text into generated images.
- Render copy in app UI.
- Keep safe-area space.
- Keep the pet visually central.
- Use icon-like shapes for mock UI.
- Buttons should be rounded, clear, and readable.
- Main scene should feel immersive, not card-heavy.
- For source sheets, generate only 4 to 6 assets per image. Use `2x2`, `2x3`, or `3x2`; do not use `3x3`, 9-item, complete-set, or mixed-category sheets.
- Generate backgrounds, loading screens, logos, and real-photo pet avatars one image at a time.
- Keep source-sheet cells large, isolated, evenly padded, and category-specific so extraction stays sharp.

## Required Asset Families

### Onboarding

- Welcome hero.
- Welcome popup background.
- Photo upload guide.
- Generation/hatching scene.
- Pet reveal background.
- First reward card.
- Error/retry illustration.

### Pet States

- Base.
- Idle.
- Happy.
- Sleep.
- Play.
- Hungry.
- Walk return.
- Treat reaction.
- Chat portrait.

### Terrarium

- Default.
- Empty starter.
- Night.
- Rainy.
- Spring.
- Summer.
- Autumn.
- Winter.

### Items

- Food bowl.
- Watering can.
- Toy ball.
- Bed.
- Tiny house.
- Flower pot.
- Lantern.
- Treats.
- Plants.
- Terrain.
- Terrarium shells.

### UI Icons

- Feed.
- Talk.
- Walk.
- Affection.
- Water.
- Play.
- Items.
- Shop.
- Settings.
- Camera/share.

## Pet Avatar Prompt

Use with photo input:

```text
Create a cute playable pet avatar based on the provided dog or cat photo.

Keep the pet's distinctive identity: fur color, markings, ear shape, face shape, and overall personality. Stylize it for Mongchi as a soft 2.5D mobile game companion with crisp pixel-inspired charm. The pet should look like a user's beloved real pet transformed into a tiny avatar, not a generic mascot.

Pose: centered, front-facing or three-quarter view, standing or sitting naturally.

Output style: clean transparent-background-friendly character art, readable at small mobile size, expressive eyes, soft rounded proportions, cozy but not babyish.

Avoid: changing species, adding unrelated accessories, adding text, photorealism, pure 8-bit pixel art, scary expression, extra animals, busy background.
```

## Default Terrarium Prompt

```text
Create the default home scene for Mongchi.

Scene: a tiny glass-dome terrarium floating in a bright sky, with grass, moss, flowers, a small pond, tiny wooden bridge, food bowl, toy ball, cushion, little pet house, and soft morning light.

Style: premium casual mobile game, soft 2.5D illustration mixed with crisp pixel-art charm. Modern rounded UI compatibility, app-store-ready polish.

Composition: vertical phone screen, central pet area clear, enough space for top counters and bottom care buttons if overlaid by app UI. No readable text.
```

## Item Prompt Template

```text
Asset type: single collectible item for Mongchi.
Subject: {item_name}.
Style: soft 2.5D premium casual game item, crisp pixel-inspired charm, tiny scale, rounded shapes, clean silhouette, readable at small mobile size.
Background: transparent-ready plain background.
Avoid: text, logos, watermark, realistic product branding, clutter, harsh shadow.
```

## Source Sheet Prompt Template

```text
Create exactly {4 or 6} large Mongchi assets in a clean {2x2, 2x3, or 3x2} grid.
Category: {single category only}.
Each asset must be large, centered, evenly padded, and separated by clear empty space.
Style: approved premium pixel-inspired shop-item/button style, crisp outlines, soft 2.5D shading, readable at mobile size.
Background: transparent-ready or one flat removable chroma-key color.
Avoid: text, labels, logos, extra mini icons, mixed categories, cream card backgrounds behind cutout assets, 3x3 grids, 9 assets, complete-set sheets.
```

## Asset QA Checklist

- Matches Mongchi style.
- No readable fake text.
- No logo or watermark.
- Pet remains emotionally warm.
- Pet identity is preserved across states.
- Works at mobile scale.
- Has enough padding.
- Not cluttered.
- Palette is fresh and varied.
- Does not resemble a known game too closely.

## Naming

Suggested:

- `welcome-terrarium-hero-v1.png`
- `photo-upload-guide-v1.png`
- `generation-hatching-dome-v1.png`
- `pet-reveal-background-v1.png`
- `pet-{pet_id}-idle-v1.png`
- `item-food-bowl-basic-v1.png`
- `icon-care-feed-v1.png`

## Source Of Truth

Full prompt details live in:

- [Asset Prompt Bible](../mongchi-asset-prompt-bible.md)
