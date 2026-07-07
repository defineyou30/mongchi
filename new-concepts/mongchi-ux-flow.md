# Mongchi UX Flow

This document defines the detailed UX flow for Mongchi from first open through daily use. It is a product/design specification, not a code implementation.

Mongchi is a new standalone product concept.

## Related Documents

- [Concept Plan](mongchi-plan.md)
- [Execution Plan](mongchi-execution-plan.md)
- [Final Completion Guide](mongchi-completion-guide.md)
- [Asset Prompt Bible](mongchi-asset-prompt-bible.md)

## UX North Star

The user should feel:

```text
I can bring my pet into a tiny world, care for it, and hear from it.
```

Every screen should support one of these emotions:

- Trust: it is safe to upload a pet photo.
- Anticipation: something magical is being created.
- Recognition: this avatar feels connected to my pet.
- Warmth: the pet reacts to me.
- Agency: I can care, talk, decorate, and return.

## Flow 1: First Open To Pet Creation

### Screen 1: Splash

Goal:

- Establish the soft terrarium world before any request.

UI:

- Fullscreen tiny glass-dome terrarium image.
- Subtle floating cloud/leaf animation.
- App name area.

Copy direction:

- Minimal. Avoid feature lists.

Primary action:

- Auto-advance to welcome.

States:

- First launch.
- Returning user with existing pet.
- Offline.

Image asset:

- `welcome-terrarium-hero`.

### Screen 2: Welcome Popup Guide

Goal:

- Explain the value and guide the user to creation.

UI:

- Modal or bottom sheet over the terrarium background.
- Friendly pet silhouette or empty glass dome.
- One primary CTA.
- Small privacy reassurance.

Suggested copy:

```text
Create a tiny home for your pet
Upload one favorite photo and we'll turn your dog or cat into a little companion you can care for and talk to.
```

Primary CTA:

- `Choose pet photo`

Secondary:

- `See a sample` if demo mode is kept.

Privacy microcopy:

```text
Your photo is used to create your pet avatar. You can delete it later.
```

Image asset:

- `welcome-popup-companion`.

### Screen 3: Pet Name

Goal:

- Create emotional investment before upload.

UI:

- Pet name input.
- Species selector: dog, cat.
- Optional skip only for non-critical fields, not name if possible.

Suggested copy:

```text
Who are we welcoming into the terrarium?
```

Primary CTA:

- `Continue`

Validation:

- Name max length.
- No empty if required.
- Gentle profanity handling if needed.

State:

- Keyboard open.
- Validation error.

### Screen 4: Personality And Talking Style

Goal:

- Collect traits that shape free reactions and premium chat.

UI:

- Personality chips: playful, calm, curious, sleepy, shy, affectionate.
- Talking style chips: cute, gentle, cheerful, comforting.
- Optional favorite thing: snack, toy, walk, nap, cuddle.

Suggested copy:

```text
What are they like?
Choose a few traits so their little messages feel more like them.
```

Primary CTA:

- `Continue`

Rules:

- 1-3 personality chips.
- 1 talking style.
- Optional favorite thing.

Data output:

- `personality_tags`
- `talking_style`
- `favorite_thing`

### Screen 5: Photo Upload Intro

Goal:

- Make upload feel safe and easy.

UI:

- Good photo example illustration.
- Camera/gallery options.
- Optional "add more later" note.

Suggested copy:

```text
Pick one clear photo
A bright photo of their face or full body works best. One is enough to start.
```

Primary CTA:

- `Choose photo`

Secondary:

- `Photo tips`

Image asset:

- `photo-upload-guide`.

### Screen 6: Photo Review

Goal:

- Let user confirm selected photo before processing.

UI:

- Selected photo preview.
- Soft quality checklist.
- Optional add up to two extra photos.
- AI processing consent checkbox or inline consent.

Suggested copy:

```text
Looks good?
We'll use this photo to create your tiny companion.
```

Quality checklist:

- Face visible.
- Good light.
- Not too blurry.

Primary CTA:

- `Continue`

Secondary:

- `Choose another`

Error states:

- Unsupported file.
- File too large.
- Upload failed.
- No pet visible, if detection exists.

### Screen 7: Generation / Hatching

Goal:

- Turn waiting into a magical moment.

UI:

- Glass dome hatching scene.
- Progress step labels.
- Tiny animation.
- Cancel should be hidden or gentle, not accidental.

Progress steps:

- Preparing photo.
- Finding little details.
- Creating companion.
- Polishing tiny world.
- Moving in.

Suggested copy:

```text
Your tiny companion is moving in
This can take a little moment.
```

Error states:

- Generation failed.
- Quality failed.
- Moderation blocked.
- Network timeout.

Recovery:

- Retry.
- Choose another photo.
- Contact support if repeated.

Image asset:

- `generation-hatching-dome`.

### Screen 8: Pet Reveal

Goal:

- Make the first look emotionally satisfying.

UI:

- Generated pet centered inside a simple terrarium.
- Pet name displayed as UI text, not generated image text.
- One short generated/authored greeting.

Suggested copy:

```text
{petName} is here
```

Pet greeting template:

```text
I found my tiny home. Is this where we get snacks?
```

Primary CTA:

- `Enter terrarium`

Secondary:

- `Try again` if retry available.

Tertiary:

- `Report issue`

No manual editor:

- The product should not offer body/eye/color editing in this flow.

### Screen 9: First Terrarium

Goal:

- Give the user a playable home immediately.

UI:

- Default glass-dome terrarium.
- Pet idle animation.
- One speech bubble.
- Bottom care actions partially guided.

First speech bubble:

```text
Hi {guardianNameOrFallback}. I think I like it here.
```

Primary guided action:

- Feed or affection.

Coach mark:

```text
Try saying hello with a snack.
```

### Screen 10: First Care Action

Goal:

- Show the core loop in one satisfying interaction.

Flow:

```text
Tap feed
-> food bowl animation
-> pet happy reaction
-> affection or happiness increases
-> first reward appears
```

Reaction examples:

- `That was perfect. I saved a happy wiggle for you.`
- `Snack accepted. You may stay.`

Reward:

- Starter flower.
- Small toy.
- Soft currency if used.

### Screen 11: First Reward

Goal:

- Introduce collection gently.

UI:

- Reward card.
- Item image.
- Place now CTA.

Suggested copy:

```text
First little gift
Place this in {petName}'s terrarium.
```

Primary CTA:

- `Place it`

Secondary:

- `Later`

Image asset:

- `first-reward-card`.

## Flow 2: Daily Home Loop

### Entry Greeting

When user opens app:

```text
Load care state
-> select reaction rule
-> show pet speech
-> animate pet state
```

Greeting examples:

- Morning: `Good morning. I checked the flowers while you were away.`
- Hungry: `My bowl is doing that empty thing again.`
- Missed user: `You came back. I kept your spot warm.`
- High affection: `There you are. I was hoping it would be you.`

### Care Action Pattern

Each action follows:

```text
Tap action
-> immediate animation
-> state update
-> reward check
-> reaction bubble
-> optional next suggestion
```

Actions:

- Feed.
- Talk.
- Walk.
- Play.
- Affection.
- Water garden.
- Clean.
- Treat.

### Feed

States:

- Normal food available.
- Special treat available.
- Recently fed.
- Hungry.

UX:

- Food bowl fills.
- Pet eats or reacts.
- Hunger decreases.

Special treat:

- Can trigger special animation.
- Should never be required for normal care.

### Talk

Free mode:

- Shows state-based reaction.
- No AI call.
- Unlimited.

Premium entry:

- `Talk more` opens chat.
- Premium gate if needed.

Free talk examples:

- `I had a small thought. It was mostly about you and snacks.`
- `The garden sounds softer when you're here.`

### Walk

MVP:

- Send pet on idle walk.
- Pet leaves screen or moves to walk status.
- Later returns with reward.

UX states:

- Ready to walk.
- Out walking.
- Returned.
- Reward claimed.

Copy examples:

- `Send {petName} on a tiny walk?`
- `{petName} is exploring near the clouds.`
- `{petName} brought something back.`

### Affection

UX:

- Tap/hold pet or heart button.
- Pet leans in, wiggles, or sparkles.
- Affection increases.

Reaction examples:

- `I knew that hand.`
- `Again, please. For science.`

### Water Garden

UX:

- Watering can animation.
- Plants brighten.
- Garden health increases.

Reaction examples:

- `The flowers stood up straighter. I did too.`

### Clean

UX:

- Light tidy animation.
- Dust/leaves clear.
- Cleanliness increases.

Reaction examples:

- `Everything smells like a new blanket.`

## Flow 3: Premium Chat

### Entry

User taps talk:

```text
Show free reaction
-> User taps Talk more
-> Open chat gate or chat screen
```

Gate copy direction:

- Warm, not aggressive.
- Explain value: longer conversations, remembered style, more personal replies.

Suggested gate copy:

```text
Talk a little longer
Unlock longer conversations with {petName}, shaped by their personality and your care history.
```

Safety microcopy:

```text
AI-generated conversation. Not the real animal's consciousness.
```

### Chat Screen

UI:

- Pet portrait.
- Conversation bubbles.
- Suggested prompts.
- Safety/info link.
- End chat CTA.

Suggested prompts:

- `Cheer me up`
- `What did you do today?`
- `Tell me something cute`
- `Remember this about us`

Safety:

- Crisis fallback.
- No medical/legal/financial advice framing.
- No claiming to be the literal pet.

## Flow 4: Decoration

### Inventory Entry

Entry points:

- Reward card.
- Bottom/side item button.
- Shop.

Inventory categories:

- Plants.
- Toys.
- Beds.
- Bowls.
- Lights.
- Houses.
- Terrain.
- Terrarium shells.
- Treats.

### Placement

MVP:

- Slot or simple grid.

Final:

- Layered placement zones.
- Save/cancel.
- Preview locked items.

UX rules:

- Do not hide the pet behind large objects.
- Show invalid placement clearly.
- Let users undo.

## Flow 5: Share

Share moments:

- Pet reveal.
- Terrarium snapshot.
- Walk return.
- New item placement.
- Seasonal event.

Default:

- Share generated avatar/terrarium only.
- Do not include original photo unless explicit.

Share formats:

- Still image.
- Pet card.
- Short GIF/video later.

## Flow 6: Error And Recovery

### Upload Error

Tone:

- Gentle and practical.

Copy:

```text
We couldn't read that photo.
Try another image with your pet clearly visible.
```

Actions:

- Choose another.
- Try again.

### Generation Failure

Copy:

```text
The tiny door got stuck.
Let's try creating {petName} again.
```

Rules:

- Do not consume paid value on system failure.
- Keep retry obvious.

### Unsafe Or Unsupported Photo

Copy:

```text
This photo can't be used for pet creation.
Please choose a clear photo of your dog or cat.
```

Avoid:

- Overexplaining moderation.
- Blaming user.

### Network Error

Copy:

```text
The terrarium needs a connection for this step.
We'll keep your progress here.
```

## Flow 7: Settings And Privacy

Required settings:

- Manage pet.
- Delete original photo.
- Delete generated pet.
- Delete account.
- AI conversation data.
- Restore purchases.
- Support.
- Privacy policy.
- Terms.

Delete photo copy:

```text
Delete original photo?
Your generated pet can stay, but future regeneration may need a new photo.
```

Delete pet copy:

```text
Delete {petName}?
This removes their avatar, terrarium, and related data.
```

## UX Acceptance Checklist

- First flow has no dead ends.
- Upload is clearly explained before permission prompts.
- Generated pet reveal feels rewarding.
- Free reactions make pet feel alive without AI.
- Premium chat gate is clear and not deceptive.
- Missing a day is not guilt-heavy.
- Error states are recoverable.
- Original photo privacy is visible but not scary.
- Main screen works in 30 seconds.
- The pet remains the visual center.
