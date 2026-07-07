# Pet Avatar Generation Prompt Pack

## Direction

Mongchi turns a user's real dog or cat photo into a companion they can raise inside a cozy miniature garden world. The pet avatar must match the same premium 2D/2.5D mobile game style as `docs/design/image1.png` and `docs/design/image2.png`.

This prompt pack is for pet avatars only. Item and prop generation is covered by `docs/design/item-asset-redesign-prompts.md`.

## Global Pet Prompt Contract

Use this contract for every generated pet state:

```text
Use the provided dog or cat photo as the identity reference, then transform the main pet into a Mongchi companion avatar.

Identity:
- preserve recognizable fur color, markings, face shape, ear shape, muzzle/nose details, eye feel, body type, and visible personality
- source-photo identity wins over generic cuteness; do not replace the pet with a generic breed mascot, stock puppy/kitten face, bundled fallback identity, or the earlier flat placeholder puppy look
- when more than one source photo is provided, use the set only to infer the same pet identity, not to merge multiple animals or create duplicate pets
- ignore source photo background, people, furniture, scenery, duplicate animals, and loose props
- create one complete pet only

Style:
- high-resolution cozy pixel-art pet sprite for a premium mobile pet-care app
- crisp dark outline, intentional visible pixel clusters, clean stepped edges
- soft 2D shading, plush layered fur tufts, warm rounded silhouette
- expressive glossy eyes, soft cheeks, readable paws
- warm daylight, soft rim light, gentle ambient occlusion
- natural bottom-center paw/contact anchor for placement on grass
- transparent PNG-ready output with generous padding

Scene fit:
- the pet will stand inside a lush full-screen miniature garden home with soft blue sky, grass, flowers, wooden props, glossy HUD buttons, and collectible 2D/2.5D item art
- match that lighting and material quality even though the output background must stay transparent
- the pet should feel like a polished modern pixel sprite painted for the game scene, not pasted on top

Avoid:
- low-resolution 8-bit or 16-bit output
- noisy jagged artifacts or oversized square pixels
- flat vector mascot style
- smoothed placeholder mascot
- clay/plastic toy rendering
- photorealistic cutout
- magenta/chroma key background
- extra animals
- text, labels, watermark, UI, frame, full floor, detached props
- floating feet or missing ground-contact cues
```

## Required State Set

Generate these states as one consistent identity set. This is not a later polish list: the production worker default must request the full set so Home, Chat, Walk, Treat, Garden, and seasonal screens do not fall back to repeated idle art.

Each state must read through a distinct pose, expression, silhouette, or tiny attached wearable cue. Do not ship a state set where the body is mostly identical and only the mouth, color, or sparkle changes.

- `base`: neutral identity reference, relaxed full-body three-quarter front view
- `idle`: quiet home pose, gentle smile or curious eyes
- `happy`: bright care response, perked ears or lifted tail
- `sleep`: compact resting pose, eyes closed
- `play`: playful lean or lifted paw, no detached toy
- `hungry`: polite food-request expression, no bowl
- `walk_return`: proud after-walk stance, grounded paws
- `treat_reaction`: delighted nibble or sparkle-eyed reaction, no loose plate
- `chat_portrait`: closer friendly portrait/bust, direct eye contact
- `curious`: head tilt or inquisitive expression, no question mark
- `celebrate`: joyful jump or proud sit, no confetti or badge
- `garden_help`: helpful plant-tending stance, no detached garden tool
- `seasonal`: gentle festive charm through wearable detail only

## Quality Gate Notes

Reject or manually review outputs when:

- the pet no longer resembles the source photo identity
- the result looks like a generic cute puppy/cat rather than the user's actual pet
- the result looks like low-resolution 8-bit art, a noisy jagged sprite, or a flat mascot
- the pose is nearly identical across multiple states
- `chat_portrait`, `sleep`, `play`, `hungry`, `walk_return`, `treat_reaction`, `garden_help`, or `seasonal` are visually indistinguishable from `idle`
- paws do not align to a stable bottom-center contact point
- the pet includes background scenery, UI, text, or unrelated props
- the asset would look pasted over the Home background instead of belonging in the same art direction

## Bundled Fallback Rule

Bundled dog/cat fallback PNGs are only for local QA and app-safe placeholder behavior before a real user-generated set is available. They may reuse a curated source identity, but screen-critical states must not be byte-identical to `idle`. If a future curated fallback set is added, include distinct files for every state before running `npm run generate:mobile-assets`; the script preserves complete distinct sets and regenerates weak repeated sets.
