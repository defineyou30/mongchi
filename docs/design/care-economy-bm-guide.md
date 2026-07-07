# Care Economy And BM Guide

## Product Decision

Keep care, relationship, and monetization as separate systems.

The app should feel like raising and talking with a beloved pet, not like managing a hard survival meter. BM exists around optional depth, convenience, collection, and premium conversation. It should not make basic affection feel paywalled.

## Core Meter Roles

### Satisfaction / Mood

- User-facing meaning: how comfortable and cared-for the pet feels right now.
- Source: derived from care meters such as food, happiness, cleanliness, energy, garden health, and recent interaction.
- UI role: heart/mood meter, care hint, recommended action, short reaction tone.
- It is not spendable currency.
- It should not be sold directly.

### Bond

- User-facing meaning: long-term relationship growth with the pet.
- Source: care actions, talking, affection, treats, walks, and soft bloom rewards.
- UI role: level/progress badge, future unlock gating, deeper personalization.
- It is not spendable currency.
- It should not decrease from ordinary absence or low satisfaction.

### Credits

- User-facing meaning: spendable value for optional purchases.
- Source: purchased packs, bonus rewards, events, first-bloom bonuses, future ads or missions if added.
- UI role: shop balance, item purchase cost, premium chat credit fallback.
- Credits can buy consumables, decor, special treats, and selected premium actions.
- Server verification is required before real-money purchases or entitlement grants are trusted.

### Free Chat Tickets

- User-facing meaning: limited free chances for longer premium AI replies.
- Source: starter gift, events, subscription perks, future rewards.
- Spend priority: free ticket first, then bonus credits, then paid credits.
- They should never be confused with authored short reactions.

### Plus Pass

- User-facing meaning: premium bond pass for longer AI chat and future Plus perks.
- Source: active server-owned entitlement.
- UI role: Plus pass card, premium chat unlocked state, store restore path.
- It does not change the free local reaction system.

## Home Interaction Roles

Home should expose a few immediate actions rather than a full management dashboard:

- Feed: restores food and gently improves mood.
- Play: improves happiness while costing some energy/cleanliness.
- Rest: restores energy.
- Pet: raises affection and mood.
- Water: serves the pet's water bowl and improves thirst/hydration.
- Talk: free authored short reaction; premium AI chat remains a separate gated flow.
- Walk: idle send-and-return loop with a reward.
- Treat: optional consumable special action; routes to shop when none are available.
- Clean: utility action that can appear as a recommendation or secondary action.

Home care actions should give immediate lightweight feedback, but that feedback is not a wallet. The feedback chip can show meter deltas such as `Food +28`, `Mood +14`, `Energy -8`, `Clean -4`, `Water +24`, or `Bond +1` so the player understands the result of tapping a button.

Tradeoffs are allowed when they feel cozy and expected, such as Play spending a little energy or cleanliness. Basic water care is pet hydration, not a plant reward faucet. It should not mint credits or plant bloom rewards inside the default Home loop.

## BM Boundaries

- Free short reactions are authored/local and must not call an AI provider.
- Longer AI chat requires active Plus entitlement, free chat ticket, or sufficient credits.
- Local preview can show saved tickets/credits, but it should not imply that free short hellos consume those balances.
- The premium chat gate should label the current access mode: ready long chat, local long-chat preview, or locked Plus chat.
- Treats are repeatable consumables and can support credit BM, but they are not required for baseline happiness.
- Decor and plants are collection/identity purchases, not mandatory care. If fixed-scene placement starts to fight the art direction, decor should move behind stronger BM categories instead of forcing clutter onto Home.
- Regeneration/avatar retries can use credits later, but original-photo handling and safety checks stay server-owned.
- Store purchase verification, raw receipt tokens, provider keys, and storage credentials stay out of the mobile app.

## Shop Category Direction

The shop should not become a noisy inventory board if purchased props are hard to place beautifully in the miniature scene. Prioritize categories that fit the pet-care fantasy without overcrowding Home:

- Special treats: consumable reactions, rare authored lines, small bond gains, and cute one-off animations.
- Special vacations or walks: paid/earned outing tickets that return with a memory, reward, or themed photo-card moment.
- Premium chat: Plus pass, chat tickets, or credits for longer AI replies.
- Background themes: fairy garden, seaside, autumn, winter, and seasonal room/world skins that do not require manual prop placement.
- Avatar retries: controlled regeneration credits for users who want another pet look.

Physical props can still exist as curated starter rewards or limited bundles, but Home placement should stay slot-based and sparse. A shop purchase should never create overlapping clutter around the pet.

The shopkeeper is a separate market guide character, not the user's pet avatar. The user's pet remains the emotional companion in Home and Chat; the shopkeeper only explains purchases, credits, and offers.

Advanced long-term gates can use a non-basic premium affinity meter, separate from normal mood and bond. Basic care should raise mood and bond for free, while premium affinity can unlock special treats, vacation offers, or seasonal memories that are not reachable through ordinary repeated taps.

## Reward Direction

Rewards should feel like gentle encouragement:

- Walk rewards: starter decor or collectible items.
- Plant first bloom: small bonus credits and bond XP.
- Daily/event rewards: small credits, free chat ticket, seasonal decor preview.
- Treat purchases: repeatable low-cost item loop.
- Plus pass: subscription for longer premium conversation and future premium personalization.

Avoid:

- spending heart/mood
- reducing bond as punishment
- blocking basic care behind credits
- using AI for every tiny speech bubble
- making water or treats mandatory for basic pet happiness

## Implementation Contract

- `CareSatisfactionSummary` drives mood labels, hints, and recommended actions.
- `RelationshipState` owns bond XP/level and total talk/care counters.
- `CreditWallet` owns credits, bonus credits, and free chat tickets.
- `getPremiumChatPaymentPreview` owns premium chat payment priority.
- `performPrototypeCareAction("treat")` consumes an owned treat item when one exists; otherwise the mobile home routes to shop.
- `performPrototypeCareAction("water_garden")` is the compatibility action id for pet hydration; it should improve the water/thirst meter without granting plant bloom rewards.
- Mobile chat can show authored short talk immediately, but API premium chat must go through the backend premium chat contract.
