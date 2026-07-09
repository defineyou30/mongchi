# Mongchi Design System

## 1. Atmosphere & Identity

Mongchi feels like a warm handheld pet toy rebuilt for a modern iPhone: soft storybook gardens, pixel-kissed glossy controls, and a pet that feels present without becoming visually noisy. The signature is the floating garden scene: the world fills the screen, HUD/buttons hover as chunky collectible objects, and dialogs feel like game UI rather than native system alerts.

## 2. Color

### Palette

| Role | Token | Light | Dark | Usage |
| --- | --- | --- | --- | --- |
| Sky/base | `colors.sky` | `#9FDBFF` | same | Root and fallback screen fill |
| Sky/soft | `colors.skySoft` | `#CFEFFF` | same | Soft background wash |
| Sky/deep | `colors.skyDeep` | `#3F9BD7` | same | Water and informational HUD fills |
| Leaf | `colors.leaf` | `#54A85C` | same | Growth, success, active state |
| Moss | `colors.moss` | `#3F8D54` | same | Secondary green state |
| Cream | `colors.cream` | `#FFF5DE` | same | Button rims, cards, chips |
| Parchment | `colors.parchment` | `#FFF0C9` | same | Dialog and tray surface |
| Parchment/deep | `colors.parchmentDeep` | `#E9C78F` | same | Pressed rim, separators |
| Wood | `colors.wood` | `#A86435` | same | Strong border, label accents |
| Wood/dark | `colors.woodDark` | `#5B3726` | same | Primary text and outlines |
| Coral | `colors.coral` | `#FF7777` | same | Food/action accent |
| Rose | `colors.rose` | `#FF8AB9` | same | Affection accent |
| Honey | `colors.honey` | `#F7B94C` | same | Walk/energy accent |
| Violet | `colors.violet` | `#8E6EEB` | same | Premium and magical accents |
| Ink | `colors.ink` | `#3F2D2A` | same | Primary text |
| Muted ink | `colors.mutedInk` | `#7A6E66` | same | Secondary copy |

### Rules

- Do not use raw hex in new UI code unless adding it to this file and `tokens.ts` first.
- Cream/wood is a rim system, not a full card theme. Gameplay surfaces should let the garden art remain dominant.
- Shop and modal UI may use parchment panels; home controls should stay floating and asset-led.

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Usage |
| --- | --- | --- | --- | --- |
| Display | 30-36 | 900 | 1.1 | First-session screen titles |
| H1 | 24-30 | 900 | 1.15 | Shop/settings/popup titles |
| H2 | 18-22 | 900 | 1.2 | Tray and card titles |
| Body | 15-17 | 800 | 1.35 | Main readable copy |
| Caption | 11-13 | 900 | 1.1 | HUD labels, badges |
| Pixel mono | 16-20 | 800 | 1.25 | Pet speech, timers |

### Font Stack

- Primary: `PixelifySans`, falling back to system only while font loading is pending.
- Body text must remain legible on iPhone; never place more than two short lines inside the pet speech bubble.

## 4. Spacing & Layout

### Base Unit

All spacing derives from 4px. Use the existing `spacing` tokens: `xs=4`, `sm=8`, `md=12`, `lg=16`, `xl=24`, `xxl=32`.

### Mobile Layout Rules

- Primary target is iOS portrait.
- Home background is full bleed. Do not add top/bottom white gaps around playable scenes.
- Top HUD sits under the dynamic island; side rail floats left; bottom action dock floats above the home indicator.
- Action trays slide above the bottom dock and never cover the pet's face.

## 5. Components

### Floating HUD Meter
- **Structure**: asset icon overlaps a dark pill track; track uses 5-7 rounded segments.
- **Variants**: satiety, thirst, affection/mood, energy, clean.
- **States**: default, low, active gain pulse.
- **Motion**: gain pulse on the icon and segment fill after actions.

### Floating Action Button
- **Structure**: PNG button asset as the button; no extra cream backing behind the asset.
- **Variants**: feed, play, walk, affection, water.
- **States**: default, selected menu, disabled cooldown, pressed.
- **Motion**: tiny scale on press; cooldown badge floats above, not clipped by the asset border.

### Care Option Tray
- **Structure**: parchment rounded tray, horizontal options, each option with one asset and short label.
- **Variants**: meal/treats, play toys, walk passes, affection gifts, drinks.
- **States**: available, cooldown, premium/dev open, empty.

### Home Retention Prompt
- **Structure**: compact floating parchment card above the bottom care dock, with a D-day chip, short relationship promise, and one CTA.
- **Variants**: D1 daily hello, D3 reward rhythm, D7 memory, D14 habit, D30 letter.
- **Material tokens**: use `homeRetentionSurfaces.card`, `cardReward`, `cardMemory`, `cardLetter`, `rim`, `softRim`, and `progressTrack` from `tokens.ts`.
- **Rules**: hide while walk panels or care trays own the bottom surface; CTA should route to either the recommended care action or the friend profile, never a dead end.

### Game Dialog
- **Structure**: dim overlay, parchment panel, pixel-gloss icon/animation, title, short message, primary/secondary buttons.
- **Variants**: info, confirm, permission, purchase, error, loading.
- **Motion**: 180-220ms opacity/scale entry; Lottie may loop inside.

### Friend Profile Surface
- **Structure**: hero pose stage, compact stat ribbon, readable discovery panels, scrapbook timeline, and a warm letter panel.
- **Material tokens**: use `profileSurfaces.heroPlate`, `skyPanel`, `skyCell`, `skyCellLocked`, `parchmentPanel`, `letterPanel`, `letterGlow`, `lightRim`, `softRim`, and `mutedTrack` from `tokens.ts`.
- **Rules**: Walk finds and Mong's Letter must stay readable over the garden background; avoid ad hoc raw translucent fills in new profile UI.

### Shop Shelf
- **Structure**: full-screen shop background, top back button + title + credit HUD, large selected preview, category tabs, item grid.
- **Categories**: treats, themes, inventory. Plant/placement/decor shelves are archived until layout placement returns.
- **States**: purchasable, owned, applied theme, preview-only, dev open.

### Welcome Popup
- **Structure**: custom dialog layered over onboarding, Happy Dog Lottie, friendly title, one primary action.
- **Rules**: no native alert; no long explanatory paragraph.

### First-Run Welcome Onboarding
- **Structure**: three image-led mobile slides before photo setup; one large generated story image, step label, short emotional headline, one body line, pagination dots, primary Next/Start action, and Skip.
- **Tone**: explain the promise before the setup task: beloved pet close by, one real photo, tiny friend moving into the garden.
- **Rules**: no emoji icons; use app-generated pixel story art and tokenized game UI buttons. Once completed or skipped, continue into the photo setup intro instead of repeating every launch.

### Official Landing Page
- **Structure**: compact official game-site flow: image-led hero, "What is Mongchi?" explainer, four-icon play row, screenshot feature bands, download panel.
- **Visual source**: reuse app garden backgrounds, pet sprites, glossy button PNGs, and store screenshots before generating new web-only art.
- **States**: links and store badges use visible hover/focus rings; download buttons may show honest coming-soon state until release URLs are configured.
- **Rules**: keep the page closer to a cozy game guide than a SaaS landing page; no long pricing grids, KPI counters, generic testimonial cards, or AI-product gradient hero.

## 6. Motion & Interaction

| Type | Duration | Easing | Usage |
| --- | --- | --- | --- |
| Micro | 120-160ms | ease-out | Button press |
| Tray | 220-280ms | ease-in-out | Care option tray open/close |
| Feedback | 4500-6500ms | n/a | Pet action state and speech visibility |
| Loading | loop | n/a | Global Lottie loading |

- Use transform/opacity animations only for UI motion.
- Care actions should not instantly allow another major action. A short global lock plus individual cooldowns protect the pet loop.
- Walk uses the paws Lottie while the pet is away.

## 7. Depth & Surface

### Strategy

Mixed: asset-driven depth for buttons and HUD, parchment panels for dialogs and shop shelves, minimal native shadows. Avoid stacking a CSS/React Native button background behind PNG buttons that already contain their own rim, gloss, or border.

### Accepted Debt

- The domain name `water_garden` remains as the code-level action for now, but user-facing labels and effects treat it as pet hydration. Rename to `water_pet` only during a backend/schema migration pass.
