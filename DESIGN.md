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
| Modal overlay | `colors.overlay` | `rgba(37,29,26,0.62)` | same | Focus-preserving game dialog dim |

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

- Latin locales: `PixelifySans` display with `Baloo 2` body.
- Korean: `Fusion Pixel 10px Proportional KO` for complete modern Hangul coverage.
- Japanese: `Fusion Pixel 10px Proportional JA` for localized pixel-grid glyphs.
- Traditional Chinese: `Fusion Pixel 10px Proportional ZH-HANT` for localized pixel-grid glyphs.
- App language defaults to the device locale. An explicit in-app selection persists until the user returns to Automatic.
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
- **Structure**: full-screen shop background, top back button + title + separate credit-wallet HUD, large selected preview, two primary tabs, section headers, and item grids.
- **Primary tabs**: `Treats & Toys` groups food, drinks, toys, and rest items. `Poses & Themes` groups three-slot expression packs and background themes.
- **Density rule**: keep at least 6-8 meaningful choices in each primary tab. Use section headers inside a tab instead of promoting thin categories into extra tabs.
- **Monetization rule**: chat passes stay contextual at the chat gate and never appear on the shop shelf. Credit IAP remains a separate wallet destination.
- **States**: purchasable, owned, applied theme, preview-only, dev open.

### Expression Pack Slot Board
- **Structure**: one full-width repeated pack board with title/description, a connected three-slot rail, and one pack-level action footer.
- **Slot copy**: every slot names the generated pose and the in-app moment that uses it. Locked art stays abstract; do not imply that a finished pose already exists.
- **Pricing**: price and CTA appear once per board and must explicitly say that all three poses unlock together. Never repeat a price on each slot.
- **Profile handoff**: the friend profile is a collection surface. It pages through owned poses only and routes to the Moments shop for more; it never sells from an individual locked pose.
- **States**: available, insufficient credits, generating, failed/retry, owned. Generating and owned keep the three slots visually grouped.

### Credit Pack Shelf
- **Structure**: shop-scene header with the server balance, one starter-grant receipt band, then three full-width gem pack rows with a single purchase action each.
- **Pricing**: the OS store owns localized prices. Before RevenueCat products are configured, cards stay visible but the purchase action reads as preparing and remains disabled.
- **Currency rule**: every visible gem balance maps to Supabase `credit_wallets`. Never mix client-local `bonusCredits` into a server-backed shop balance.
- **States**: preparing, available, purchasing, verified, failed. Only server-verified purchases may increase the visible balance.

### Welcome Popup
- **Structure**: custom dialog layered over onboarding, Happy Dog Lottie, friendly title, one primary action.
- **Rules**: no native alert; no long explanatory paragraph.

### First-Run Welcome Onboarding
- **Structure**: three image-led mobile slides before photo setup; one large generated story image, step label, short emotional headline, one body line, pagination dots, primary Next/Start action, and Skip.
- **Tone**: explain the promise before the setup task: beloved pet close by, one real photo, tiny friend moving into the garden.
- **Rules**: no emoji icons; use app-generated pixel story art and tokenized game UI buttons. Once completed or skipped, continue into the photo setup intro instead of repeating every launch.

### Web Language Menu
- **Structure**: one reusable native `<details>` disclosure with a cream/honey pixel trigger, current locale label, CSS chevron, and a parchment option panel. Each option is a real `<button>` with the language name written in that language; never use flag emoji.
- **Variants**: compact header control and labeled footer control. The header shows the native language name on desktop and its two-letter locale code at narrow widths; the footer always shows the native language name.
- **Mobile header layout**: below the `760px` landing breakpoint, keep the brand and compact locale trigger on the first row and place the three primary navigation links on a full-width second row with an `8px` gap. The open locale panel starts below both rows, and landing/legal content offsets must follow the taller header instead of overlapping it.
- **States**: closed, open, hover, keyboard focus, and selected. Selected rows use the wood-dark surface plus a non-emoji CSS check mark and `aria-selected="true"`.
- **Behavior**: selecting an option applies the locale immediately, persists it locally, updates `?lang=`, updates every language menu on the page, and closes the disclosure. Escape and outside click close any open menu.
- **Accessibility**: the trigger exposes the localized language label, every option remains in tab order, focus rings are visible, and opening the menu never traps focus or clips past the viewport edge.

### Official Landing Page
- **Structure**: compact official game-site flow: image-led hero, "What is Mongchi?" explainer, four-icon play row, screenshot feature bands, download panel.
- **Visual source**: reuse app garden backgrounds, pet sprites, glossy button PNGs, and store screenshots before generating new web-only art.
- **V4 campaign language**: the landing canvas itself is the pixel world. Use full-bleed day/night garden scenes, direct Pixelify headlines with cream/honey pixel outlines, and the App Store V4 poster set as primary storytelling art. Do not put hero or section headlines inside floating cream cards.
- **Web-only generated art**: Imagegen scenes must stay textless and UI-free. Reserve calm sky or garden negative space for live HTML copy, then layer real app captures in a reusable gold phone chassis.
- **Gold phone chassis**: build the rim from the existing cream, honey, wood, and wood-dark tokens with squared pixel steps, inset highlights, and a grounded tinted shadow. Never bake a fake app screen into generated art.
- **Campaign rail**: care, poses, chat, memories, and shop may use the localized V4 App Store posters as a responsive editorial rail. Desktop uses an asymmetric three-column composition; narrow screens use horizontal scroll-snap so the page does not become six posters tall.
- **Web layout tokens**: `landing.container=1280`, `landing.reading=672`, `landing.heroPhone=328`, and `landing.posterGap=24`. Responsive transitions happen at `1040` and `760`; all section padding continues to use the 4px base spacing system.
- **Section rhythm**: transition from bright morning hero to cream transformation stage, sky-blue campaign gallery, and an indigo garden closing scene. Cards are reserved for real information or controls, not as default section containers.
- **States**: links and store badges use visible hover/focus rings; download buttons may show honest coming-soon state until release URLs are configured.
- **Legal and language footer**: use one dark-wood pixel surface with grouped brand/support, legal links, and the labeled footer variant of `Web Language Menu`. Keep native-language option labels, never flag emoji. The footer must expose Privacy Policy, Terms of Service, data deletion, `lucas@define-you.com`, and `© 2026 DefineYou. All rights reserved.` without competing with the download CTA.
- **Landing localization**: mirror the app locales exactly (`en-US`, `ko-KR`, `ja-JP`, `zh-TW`, `de-DE`, `fr-FR`, `pt-BR`, `es-MX`). Default to the closest device locale, persist an explicit choice locally, preserve it with `?lang=` across landing/legal links, and update the document language plus accessible labels and metadata when the locale changes.
- **Landing SEO contract**: use `https://mongchi.app` as the canonical origin, expose reciprocal `hreflang` entries for every supported locale, and keep localized landing/legal URLs discoverable in the sitemap. Search-facing copy should describe the real photo-to-pixel-pet, care, chat, and memory experience naturally; never keyword-stuff or imply that an AI companion replaces a real pet.
- **Editorial content**: only open a public guide or memory-journal hub when at least several original, useful articles are ready. Pet-loss content must use gentle support language, avoid cure or replacement claims, name an author and update date, cite expert sources when making wellbeing claims, and state that the app is not a substitute for professional support.
- **Published legal pages**: keep the full English policy text available, and lead with the matching localized in-app privacy/terms overview for every supported locale. Legal pages reuse the same header, language control, footer, focus treatment, and pixel-material tokens as the landing page. A data-deletion section/link must stay prominent on the web as well as in the app.
- **Rules**: keep the page closer to a cozy game guide than a SaaS landing page; no long pricing grids, KPI counters, generic testimonial cards, blob-card page scaffolding, or AI-product gradient hero.

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
