# Cat Expansion

Last verified: 2026-07-12

## Decision

Mongchi should support cats. The backend and asset architecture already model
dogs and cats, so excluding cats now narrows acquisition without buying much
technical simplicity. The remaining work is primarily onboarding, copy,
species-aware presentation, and QA.

Do not infer species automatically and silently from the photo. Let the user
choose **Dog** or **Cat** before generation, then use the image safety/quality
pipeline to verify that the uploaded photo matches that choice.

## Already Implemented

- Shared domain: `PetSpecies = "dog" | "cat"`.
- Supabase and Node API request validation accept both values.
- `generate-avatar` prompt and quality checks use the requested species.
- Premium chat includes species in the provider context.
- Miso dog and Luna cat fallback state sets are registered in the mobile app.
- Session migration preserves dog/cat values.
- Pet setup exposes accessible Dog/Cat selection slots and persists the choice.
- Welcome, photo intro/upload, and setup copy is pet-neutral in all eight locales.

## Remaining Work

### 1. Species Choice (Complete In Local Code)

The setup path now presents two stable selection slots and persists the choice
through `updateDraft({ species })`.
The selected species must be included in the existing generation input
snapshot; no new database column is needed.

### 2. Species-Neutral Onboarding (Copy Complete, Art Pending)

Dog-only welcome and photo copy has been replaced across all eight locales.
Species-specific words remain in the selector. Replace the dog-leaning story
art with either a dog-and-cat composition or a neutral photo-to-companion scene.

### 3. Species-Aware Care Copy

Audit authored rules and copy for dog assumptions such as paws, walks, and
water-bowl wording. Walking remains a valid product action for cats, but cat
copy should frame it as an outing or exploration rather than assuming a
dog-style walk. Add cat-authored reaction lines instead of relying entirely on
generic fallback rules.

### 4. Generation QA

Run a minimum source-photo matrix across:

- short-hair and long-hair cats;
- light, dark, tabby, calico, and high-contrast markings;
- front, three-quarter, and seated poses;
- difficult ears, tails, and facial masks;
- each starter state (`idle`, `happy`, `sleep`);
- one complete paid expression pack.

Reject launch if identity markings drift between the three generated slots or
if the model produces dog-like muzzle/body proportions.

### 5. Release QA

- Complete onboarding once as dog and once as cat.
- Verify cat fallback art appears when signed URLs expire or network reads fail.
- Verify every care action has a valid cat state or documented fallback chain.
- Verify chat, profile, sharing, notifications, and legal copy avoid dog-only labels.
- Capture one cat App Store screenshot only after the real path passes.

## Scope Estimate

This is a medium mobile/product pass, not a backend migration. The critical
path is species selection, eight-locale copy, onboarding art, and real
generation QA. Multi-pet support is separate; v1 can still allow exactly one
pet while letting that pet be either a dog or a cat.
