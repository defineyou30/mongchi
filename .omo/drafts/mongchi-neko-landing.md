---
slug: mongchi-neko-landing
status: awaiting-approval
intent: clear
pending-action: write .omo/plans/mongchi-neko-landing.md
approach: Neko Atsume-inspired lightweight official game/app landing page for Mongchi, using Mongchi's existing pixel-gloss garden design system rather than SaaS/wellness landing conventions.
---

# Draft: mongchi-neko-landing

## Components (topology ledger)
<!-- Lock the SHAPE before depth. One row per top-level component that can succeed or fail independently. -->
<!-- id | outcome (one line) | status: active|deferred | evidence path -->
L1 | Above-fold official-site hero with Mongchi garden world, app title, one-line promise, and download CTAs | active | DESIGN.md:3-5, /tmp/neko-index.html:25-43
L2 | What-is-Mongchi explainer panel modeled after Neko Atsume's "What is" image, but accessible HTML text over Mongchi art | active | /tmp/neko-index.html:60-63, DESIGN.md:49-52
L3 | Four-icon "How to play" row translating Neko's Catbook/Album/Shop/Remodel pattern into Photo, Move-in, Care, Garden | active | /tmp/neko-about.html:15-76, DESIGN.md:75-98
L4 | Feature bands for screenshots: photo-to-friend, care loop, chat/memory, garden/shop | active | /tmp/neko-about.html:15-120, docs/qa-screenshots/ios-iphone-16-pro-store-contact-sheet.png
L5 | Download, support, and privacy footer with store buttons and FAQ links | active | /tmp/neko-index.html:96-147, /tmp/neko-index.html:150-160

## Open assumptions (announced defaults)
<!-- Record any default you adopt instead of asking, so the user can veto it at the gate. -->
<!-- assumption | adopted default | rationale | reversible? -->
Visual density | Use Neko Atsume's simple official-site density, not a long SaaS page | User explicitly selected Neko Atsume feel; this keeps the page playful and low-pressure | yes
Typography | Use Pixelify Sans for headings/badges and Baloo 2 for readable body/CTA text | Matches app default font pair and keeps body copy legible | yes
Copy language | Prepare English-first copy with optional Korean adaptation later | App screenshots and Neko reference are English; App Store landing likely targets global audience | yes
Reference use | Borrow structure/mood only; do not copy Neko assets, logo, cats, exact copy, or hidden image-text approach | Avoid trademark/copyright issues and preserve Mongchi identity/accessibility | no

## Findings (cited - path:lines)
- Mongchi identity is "warm handheld pet toy" with storybook gardens and pixel-kissed glossy controls; world should fill the surface rather than sit inside generic cards. Evidence: DESIGN.md:3-5, DESIGN.md:60-65.
- Mongchi color and surface system is sky, leaf, cream, parchment, wood, coral/rose/honey accents; raw hex additions must go through tokens. Evidence: DESIGN.md:11-34, apps/mobile/src/shared/design/tokens.ts:7-31.
- Mongchi app typography default is Pixelify Sans + Baloo 2; display/title/bubble use Pixelify and body/button/label use Baloo. Evidence: apps/mobile/src/shared/design/fontPair.ts:14-35, apps/mobile/src/shared/design/tokens.ts:80-125.
- Neko Atsume top page is image-led: large swipe banner, simple image nav, one "What is" illustration block, download panel, small banner/footer. Evidence: /tmp/neko-index.html:25-63, /tmp/neko-index.html:96-160.
- Neko Atsume How To Play uses a 540px-ish mobile-first fixed visual language, yellow section dividers, four square icon anchors, and pastel feature bands. Evidence: /tmp/neko-about.html:5-6, /tmp/neko-about.html:15-120.

## Decisions (with rationale)
- Direction: "official cozy game site" rather than "premium wellness SaaS." Rationale: user selected Neko Atsume; Mongchi's app visuals already carry a toy/garden game identity.
- Hero memory: lead with a big illustrated garden + dog + phone composition. Rationale: Neko's first impression is one large character/world banner; Mongchi should do the same with the user's dog in a tiny garden.
- Section count: keep landing compact: Hero, What is Mongchi, How to play, Garden features, Download/FAQ. Rationale: Neko's site is charming because it is not over-explained.
- Accessibility upgrade: use real HTML text styled like chunky game labels, not image-only text. Rationale: Neko's old image-text approach is charming but not suitable for a modern accessible landing page.

## Scope IN
- Design brief for a Neko Atsume-inspired Mongchi landing page.
- Section structure, visual direction, typography, color, asset usage, and copy tone.
- Guardrails for what not to copy from Neko Atsume.

## Scope OUT (Must NOT have)
- No implementation in this turn.
- No copying Neko Atsume logo, cat art, exact copy, or image-only text assets.
- No long SaaS-style pricing/testimonial/features grid unless the user explicitly asks later.
- No dark/purple AI-product landing style.

## Open questions
- Approval needed: proceed with this Neko Atsume-inspired compact official-site direction, or make it more modern/premium while keeping the same reference?

## Approval gate
status: awaiting-approval
pending: user approval to turn this design direction into a decision-complete implementation plan or start implementation in a later turn.
<!-- When exploration is exhausted and unknowns are answered, set status: awaiting-approval. -->
<!-- That durable record is the loop guard: on a later turn read it and resume at the gate instead of re-running exploration. -->
