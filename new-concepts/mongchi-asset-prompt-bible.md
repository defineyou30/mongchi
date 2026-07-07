# Mongchi Asset Prompt Bible

This document defines the image and asset generation language for Mongchi. Use it for imagegen prompts, design references, asset briefs, and style consistency.

Mongchi is a new standalone product concept.

## Related Documents

- [Concept Plan](mongchi-plan.md)
- [UX Flow](mongchi-ux-flow.md)
- [AI Pipeline](mongchi-ai-pipeline.md)
- Reference image: [mongchi-reference-v1.png](assets/mongchi-reference-v1.png)

## 1. Visual Identity

Core phrase:

```text
cozy pixel terrarium, soft 2.5D mobile game art, crisp pixel-inspired charm, modern rounded UI, bright sky mood, tiny glass-dome pet world
```

The world should feel:

- Tiny.
- Warm.
- Collectible.
- Magical but grounded.
- Fresh and bright.
- Emotionally safe.
- Premium casual game quality.

Avoid making it:

- Generic pet app.
- Normal bedroom simulator.
- Pure retro 8-bit pixel art.
- Dark fantasy.
- Photorealistic.
- UI-cluttered.
- Beige-only or purple-only.

## 2. Master Style Block

Use this block in most prompts:

```text
Style: premium casual mobile game art, soft 2.5D illustration mixed with crisp pixel-inspired charm. Cozy tiny glass-dome terrarium world floating in a bright sky. Rounded modern mobile UI language, clear hierarchy, soft shadows, polished app-store-ready finish. Fresh palette with sky blue, mint green, apple green, coral, soft yellow, warm white, and small saturated accents. Emotionally warm, playful, gentle, not childish.
```

## 3. Master Avoid Block

Use this block in most prompts:

```text
Avoid: readable text inside the image, logos, brand names, watermarks, dark fantasy, photorealism, cluttered interface, generic room simulator, pure 8-bit pixel art, horror, grief exploitation, copy of existing games, beige-only palette, purple-only palette, harsh shadows, messy UI, tiny unreadable buttons.
```

## 4. UI Image Rules

- Generated images should usually contain no readable text.
- App copy should be rendered by the app UI, not baked into generated images.
- Use icon-like shapes and blank UI chips if a mockup needs interface elements.
- Keep safe-area space for iOS and Android.
- The pet must remain the visual center.
- Avoid huge decorative cards inside the scene.
- Use rounded icon buttons, but keep the world itself immersive.

## 4.1 Source Sheet Generation Rules

Do not generate large all-in-one asset sheets. They consistently reduce clarity, break borders, and make transparent cutouts unreliable.

Use these hard limits for imagegen source sheets:

- 1 asset per image for backgrounds, loading screens, app logo, hero art, and any pet image created from a real user photo.
- 2 assets per image for paired species references, such as one dog and one cat in the same action style.
- 4 assets per image for pet state sheets when identity consistency is important.
- 4 to 6 assets per image for UI buttons, HUD icons, treats, shop items, and small collectible props.
- 6 assets is the maximum for any new source sheet.
- Preferred layouts: `2x2`, `2x3`, or `3x2`.
- Avoid `3x3`, `4x4`, 9-item sheets, complete-set sheets, or mixed-category sheets.

Every source-sheet prompt must specify:

```text
Create exactly {4 or 6} large isolated assets in a clean {2x2, 2x3, or 3x2} grid. Each cell must be large, centered, evenly padded, and separated by clear empty space. Keep all assets in the same category and same visual style. No readable text. No extra mini icons. No mixed categories. No 3x3 grid.
```

For cutout assets, use either real transparency or a single flat removable chroma-key background. Do not place cream cards, UI panels, decorative frames, scene backgrounds, or shadows behind assets unless the button shell itself is the asset.

## 5. First-Time UX Asset Prompts

### 5.1 Welcome Hero

Use:

```text
Create a vertical mobile game welcome illustration for Mongchi.

Show a tiny glass-dome terrarium floating in a bright sky, with soft clouds, small flowers, moss, a little pond, a warm pet silhouette waiting inside, and a gentle magical glow that suggests a beloved pet will move in soon.

Style: premium casual mobile game art, soft 2.5D illustration mixed with crisp pixel-inspired charm. Cozy, bright, emotionally warm, app-store-ready.

Composition: vertical 9:16, leave clear top and bottom space for app-rendered UI text and buttons. No readable text inside the image.

Avoid: logos, watermarks, photorealism, dark fantasy, clutter, existing game look.
```

### 5.2 Welcome Popup Background

Use:

```text
Create a soft mobile onboarding background for a cozy pet-raising game.

Show a close-up tiny glass-dome terrarium with a little empty grassy spot, small food bowl, toy ball, flower pot, and warm morning light. The scene should invite the user to upload a pet photo.

Style: cozy pixel terrarium, soft 2.5D, crisp pixel-inspired details, modern mobile game polish.

Composition: vertical phone background with calm center area and clean negative space for a popup. No readable text.
```

### 5.3 Photo Upload Guide

Use:

```text
Create a friendly photo upload guide illustration for a mobile pet avatar creation flow.

Show three simple visual examples as cute cards without readable text: a clear pet photo in bright light, a blurry pet photo, and a cluttered pet photo. Use icon-like check and warning shapes, but no letters or words.

Style: Mongchi visual language, soft 2.5D, pixel-inspired charm, warm and reassuring.

Composition: vertical mobile-friendly illustration with clean spacing.
```

### 5.4 Generation Hatching

Use:

```text
Create a magical hatching/loading scene for Mongchi.

Show a tiny glass dome glowing softly as a pet avatar is being created inside. Include sparkles, floating leaves, gentle light beams, a small garden bed, and a sense that something beloved is moving into the terrarium.

Style: premium casual mobile game, soft 2.5D, crisp pixel-inspired charm, bright sky, warm light.

Composition: vertical phone screen, central hatching dome, leave space for app-rendered progress text. No readable text.
```

### 5.5 Pet Reveal

Use:

```text
Create a pet reveal screen background for Mongchi.

Show a newly created cute dog or cat avatar standing in the center of a tiny glass-dome garden. The pet should feel personalized and lovable, with soft pixel-inspired details and expressive eyes. The terrarium includes flowers, a small pond, food bowl, toy, and warm light.

Style: soft 2.5D mobile game art with crisp pixel charm, cozy, premium, emotionally warm.

Composition: vertical 9:16, pet clearly centered, no readable text, no logos.
```

### 5.6 First Reward Card

Use:

```text
Create a reward card illustration for Mongchi.

Show one small collectible item, such as a starter flower pot or tiny toy, presented on a warm rounded card with sparkles and soft shadows. The item should match a cozy pixel terrarium world.

Style: premium casual game reward art, soft 2.5D, crisp pixel-inspired charm, bright and cheerful.

Composition: centered item, transparent-feeling or simple warm background, no readable text.
```

### 5.7 Error / Retry

Use:

```text
Create a gentle retry illustration for a pet avatar generation flow.

Show a tiny glass dome with a stuck little door, soft leaves, and a friendly non-scary mood. It should communicate "try again" without feeling like failure.

Style: cozy pixel terrarium, soft 2.5D, warm and reassuring.

Composition: vertical mobile illustration, clean negative space, no readable text.
```

## 6. Main Terrarium Prompts

### 6.1 Default Terrarium

Use:

```text
Create the default home scene for Mongchi.

Scene: a tiny glass-dome terrarium floating in a bright sky, with grass, moss, flowers, a small pond, tiny wooden bridge, food bowl, toy ball, cushion, little pet house, and soft morning light.

Style: premium casual mobile game, soft 2.5D illustration mixed with crisp pixel-art charm. Modern rounded UI compatibility, app-store-ready polish.

Composition: vertical phone screen, central pet area clear, enough space for top counters and bottom care buttons if overlaid by app UI. No readable text.
```

### 6.2 Empty Terrarium

Use:

```text
Create an empty starter terrarium scene before the pet arrives.

Show a tiny glass-dome garden with a soft empty grassy center, a food bowl, small cushion, toy, pond, and flowers. It should feel ready for a beloved pet to move in.

Style: cozy pixel terrarium, soft 2.5D mobile game art, bright sky, gentle anticipation.

No readable text, no logos, no watermark.
```

### 6.3 Night Terrarium

Use:

```text
Create a night version of the Mongchi home scene.

Show the glass-dome garden under a soft starry sky, warm lantern glow, sleepy flowers, gentle blue shadows, and cozy pet rest area. Keep it peaceful, not dark or spooky.

Style: soft 2.5D, pixel-inspired charm, premium casual game polish.

No readable text.
```

### 6.4 Rainy Terrarium

Use:

```text
Create a rainy-day Mongchi scene.

Show soft raindrops on the outside of the glass dome, fresh green plants, a warm inside light, tiny puddles near the pond, and a cozy protected mood.

Style: premium casual mobile game, soft 2.5D, crisp pixel details, emotionally warm.

No readable text.
```

### 6.5 Seasonal Themes

Spring:

```text
Create a spring Mongchi theme with blooming flowers, fresh grass, butterflies, soft sunlight, and tiny pastel decorations. Keep the glass-dome floating island structure.
```

Summer:

```text
Create a summer Mongchi theme with bright greenery, tiny fruit, water sparkle, a cool shade spot, and cheerful sky.
```

Autumn:

```text
Create an autumn Mongchi theme with tiny orange leaves, warm lanterns, mushrooms, cozy blanket, and golden light.
```

Winter:

```text
Create a winter Mongchi theme with soft snow outside the glass dome, warm inside lighting, tiny evergreen plants, cozy cushion, and gentle holiday-like charm without specific holiday logos.
```

## 7. Pet Avatar Prompts

### 7.1 Base Pet Avatar From Photo

Use with photo input:

```text
Create a cute playable pet avatar based on the provided dog or cat photo.

Keep the pet's distinctive identity: fur color, markings, ear shape, face shape, and overall personality. Stylize it for Mongchi as a soft 2.5D mobile game companion with crisp pixel-inspired charm. The pet should look like a user's beloved real pet transformed into a tiny avatar, not a generic mascot.

Pose: centered, front-facing or three-quarter view, standing or sitting naturally.

Output style: clean transparent-background-friendly character art, readable at small mobile size, expressive eyes, soft rounded proportions, cozy but not babyish.

Avoid: changing species, adding unrelated accessories, adding text, photorealism, pure 8-bit pixel art, scary expression, extra animals, busy background.
```

### 7.2 Idle State

```text
Create the idle state for this Mongchi pet avatar.

The pet is calm, alive, and gently attentive. Keep the exact same identity, fur markings, colors, face, proportions, and style as the base pet. Pose should be suitable for subtle breathing/blinking animation.

Transparent-background-friendly, no text, no props unless already part of the pet.
```

### 7.3 Happy State

```text
Create the happy state for this Mongchi pet avatar.

The pet looks delighted and affectionate, with a small bounce-like pose, bright eyes, and warm expression. Preserve the same identity and markings as the base pet.

Transparent-background-friendly, no text, no extra characters.
```

### 7.4 Sleep State

```text
Create the sleep state for this Mongchi pet avatar.

The pet is curled up or resting peacefully, cozy and safe. Preserve identity, markings, colors, and style. This should work inside a tiny terrarium bed or cushion.

Transparent-background-friendly, no readable text, no dream text bubbles.
```

### 7.5 Play State

```text
Create the play state for this Mongchi pet avatar.

The pet is playful and energetic, looking ready to chase a tiny toy or bounce. Preserve the same pet identity and markings as the base avatar.

Transparent-background-friendly, no readable text, optional tiny toy only if requested.
```

### 7.6 Hungry State

```text
Create the hungry state for this Mongchi pet avatar.

The pet looks gently expectant near an invisible food bowl area, cute and not distressed. Preserve identity. Avoid making the pet look sick or punished.

Transparent-background-friendly, no text.
```

### 7.7 Walk Return State

```text
Create the walk-return state for this Mongchi pet avatar.

The pet looks proud and happy after a tiny walk, perhaps holding or standing near a small leaf, flower, or pebble reward. Preserve identity and style.

Transparent-background-friendly, no readable text.
```

### 7.8 Treat Reaction State

```text
Create a special treat reaction for this Mongchi pet avatar.

The pet reacts with an adorable unique behavior, such as a happy wiggle, sparkle bounce, tiny spin, or delighted face. Preserve identity. Keep it suitable for a premium treat animation.

Transparent-background-friendly, no text, no extra characters.
```

### 7.9 Sad State

```text
Create the sad state for this Mongchi pet avatar.

The pet looks gently wistful: drooped ears, lowered tail, softly downcast glossy eyes, small hunched sit. It should invite care and comfort, never look punished, abandoned, or crying heavily. Preserve identity, markings, colors, and style.

Transparent-background-friendly, no tears streaming, no rain cloud symbols, no text.
```

### 7.10 Sick State (Under the Weather)

```text
Create the under-the-weather state for this Mongchi pet avatar.

The pet looks low-energy and unwell in a cozy, family-safe way: curled or slumped sit, half-closed tired eyes, slightly pale cheeks. An optional tiny blanket draped on the back is allowed only if naturally attached. Never distressing, never medical imagery. Preserve identity.

Transparent-background-friendly, no thermometer, no medicine props, no text.
```

### 7.11 Messy State

```text
Create the messy state for this Mongchi pet avatar.

The pet's fur is ruffled with tufts sticking out and small dust smudges on cheeks or paws, wearing a mildly sheepish just-rolled-somewhere expression. Cute and endearing, not dirty in a gross way. Preserve identity.

Transparent-background-friendly, no dirt pile, no separate props, no text.
```

## 8. Item Prompts

All item prompts should use:

```text
Asset type: single collectible item for Mongchi.
Style: soft 2.5D premium casual game item, crisp pixel-inspired charm, tiny scale, rounded shapes, clean silhouette, readable at small mobile size.
Background: perfectly flat removable chroma-key color or transparent-ready plain background if needed.
Avoid: text, logos, watermark, realistic product branding, clutter, harsh shadow.
```

For multiple items, generate only one category per sheet and limit the sheet to 4 to 6 large cells:

```text
Create exactly 6 large Mongchi collectible items in a 3x2 grid. Category: {treats / toys / drinks / plants / premium tokens}. Each item should fill most of its cell, with clean empty padding and consistent scale. Use the same premium pixel-inspired shop-item style. Background must be transparent-ready or one flat removable chroma-key color. No text, no labels, no UI card backgrounds, no 3x3 grid.
```

### 8.1 Food Bowl

```text
Create a tiny pet food bowl item for Mongchi. It should be cozy, rounded, cute, and fit inside a glass-dome garden habitat. Include small kibble pieces. No text or logo.
```

### 8.2 Watering Can

```text
Create a tiny watering can item for Mongchi. It should feel like a collectible garden-care object, mint green or soft blue, rounded, premium casual game style.
```

### 8.3 Toy Ball

```text
Create a tiny toy ball item for Mongchi. Bright but tasteful colors, rounded, playful, readable at small size.
```

### 8.4 Pet Bed

```text
Create a cozy tiny pet bed for Mongchi. Soft cushion, rounded, warm, fits inside a small glass-dome garden world.
```

### 8.5 Tiny House

```text
Create a tiny pet house item for Mongchi. Miniature garden house, rounded roof, warm light, cozy and collectible.
```

### 8.6 Flower Pot

```text
Create a tiny flower pot item for Mongchi. Small blooming plant, soft colors, cozy pixel terrarium style.
```

### 8.7 Lantern

```text
Create a tiny warm lantern item for Mongchi. Soft glow, rounded metal/wood details, cozy night terrarium mood.
```

### 8.8 Treat

```text
Create a special pet treat item for Mongchi. It should look delightful and premium, like a tiny heart-shaped biscuit or star snack, with soft sparkle accents. No text or logo.
```

## 9. UI Icon Prompts

Icons should be consistent and readable.

Common style:

```text
Create a rounded mobile game icon for Mongchi. Soft 2.5D, pixel-inspired charm, thick friendly silhouette, bright but tasteful colors, no text, no logo, centered object, readable at 48px.
```

For icon sheets, use:

```text
Create exactly 6 large rounded mobile game button assets for Mongchi in a 3x2 grid. Style should match the approved shop-button look: glossy colorful square button shell, crisp pixel-inspired object inside, dark friendly outline, small white shine, no extra cream card behind the button. Each button must be centered, same size, same perspective, and separated by clear empty space. No text, no labels, no 3x3 grid.
```

Icon list:

- Feed: food bowl.
- Talk: speech bubble with tiny heart.
- Walk: little paw path or leaf path.
- Affection: heart/paw.
- Water: watering can.
- Play: toy ball.
- Items: small gift box or shelf.
- Shop: tiny awning.
- Settings: soft gear.
- Camera/share: camera icon.

## 10. Share Asset Prompts

### 10.1 Pet Card

```text
Create a shareable pet card illustration for Mongchi.

Show the generated pet avatar in a cozy mini terrarium frame with soft decorations and a warm collectible-card layout. Leave blank areas for app-rendered pet name and date. No readable text inside the image.

Style: premium casual mobile game, soft 2.5D, crisp pixel-inspired charm.
```

### 10.2 Walk Return Card

```text
Create a walk return reward card for Mongchi.

Show a happy pet returning to the glass-dome terrarium with a tiny discovered item, such as a flower, leaf, pebble, or small toy. Warm, cheerful, collectible.

No readable text.
```

## 11. Prompt Variables

Use these placeholders:

- `{pet_species}`
- `{pet_name}`
- `{personality_tags}`
- `{talking_style}`
- `{fur_color}`
- `{distinctive_markings}`
- `{asset_state}`
- `{terrarium_theme}`
- `{item_category}`
- `{season}`

Example:

```text
Create the {asset_state} state for {pet_name}, a {pet_species} with {fur_color} fur and {distinctive_markings}. Personality: {personality_tags}. Use Mongchi style...
```

## 12. Asset QA Checklist

For every generated image:

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

For transparent/cutout assets:

- Clean silhouette.
- No color fringe.
- No background remnants.
- Readable at 64px and 128px.
- Safe crop bounds.

## 13. Naming Conventions

Suggested filenames:

- `welcome-terrarium-hero-v1.png`
- `photo-upload-guide-v1.png`
- `generation-hatching-dome-v1.png`
- `pet-reveal-background-v1.png`
- `pet-{pet_id}-idle-v1.png`
- `pet-{pet_id}-happy-v1.png`
- `item-food-bowl-basic-v1.png`
- `item-treat-heart-biscuit-v1.png`
- `icon-care-feed-v1.png`

## 14. Production Notes

- Keep source prompts with generated assets.
- Store accepted concept assets under `docs/new-concepts/assets/` until app asset folders exist.
- Final app assets should move into platform asset folders with versioned metadata.
- Do not overwrite previous accepted assets without explicit replacement.
- For UI text, prefer app-rendered text over generated text.
