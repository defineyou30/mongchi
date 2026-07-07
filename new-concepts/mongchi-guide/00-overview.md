# 00 Overview

## Product Definition

Mongchi is a cross-platform iOS/Android pet-life game where users upload a real dog or cat photo and create a tiny digital avatar that lives inside a cozy glass-dome terrarium.

The product combines:

- AI pet creation from a real pet photo.
- Light daily care loops.
- Healing companion interaction.
- Free authored state-based speech.
- Premium AI conversation.
- Decoration, collection, treats, and seasonal events.

## North Star

```text
My pet has a tiny world in my phone, and it knows me.
```

## Final Product Pillars

### Personal Pet Avatar

The generated avatar should feel connected to the user's actual pet. The pet name, species, personality, talking style, and memory notes shape both free reactions and premium chat.

### Living Terrarium

The terrarium is the emotional home screen. It should include a glass-dome world, small garden details, day/night mood, seasonal variations, decorations, and ambient life.

### Care And Healing

The app should be gentle, not guilt-heavy. Users should be able to feed, talk, walk, play, pet, water, clean, and give treats without feeling punished for absence.

### Conversation

Free reactions are unlimited and authored/local. Premium extended chat can use AI, but must be clearly disclosed and safe.

### Collection And Expression

Items, terrarium themes, toys, beds, plants, and treats should help users express affection for the pet. Premium items should feel additive, not mandatory.

### Trust And Safety

Photos are private. Chat is sensitive. The app must not claim the real pet's consciousness is inside the product.

## Core Decisions

- Platform: iOS and Android.
- Client: React Native with Expo as default candidate.
- Photo input: one required photo; optional extra photos as quality booster.
- Manual generated-pet editing: excluded from first implementation path.
- Walk: starts as idle action and reward return.
- Items: decoration-only at first.
- Treats: later BM candidate for special behaviors.
- Premium: long-form AI chat, extra pets, regeneration, item/theme packs.

## Key Product Risks

- AI output does not resemble the user's pet enough.
- Onboarding asks for too much before emotional payoff.
- AI chat feels generic or unsafe.
- Costs scale unpredictably.
- Monetization feels emotionally manipulative.
- Photo/privacy handling is unclear.
- UI becomes cluttered and loses the pet as the center.

## Completion Definition

Mongchi is complete when:

- A user can create a convincing pet avatar from a real photo.
- First session feels guided and emotionally rewarding.
- The terrarium feels alive every time the app opens.
- Free reactions create life without AI cost.
- Premium chat feels personal, safe, and clearly AI-generated.
- Care loops are gentle and not guilt-heavy.
- Items and treats support expression and monetization without exploitation.
- iOS and Android share the same core data and asset contracts.
- Photos, chats, purchases, and deletion flows are secure and auditable.
