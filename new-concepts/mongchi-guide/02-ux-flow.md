# 02 UX Flow

## UX North Star

The user should feel:

```text
I can bring my pet into a tiny world, care for it, and hear from it.
```

## UX Principles

- Explain value before asking for effort.
- Keep the pet and terrarium as the visual center.
- Make photo upload feel safe and natural.
- Make generation feel like hatching, not waiting.
- Do not guilt the user for absence.
- Keep core daily use under 30 seconds.
- Use app-rendered text, not text baked into generated images.

## First-Time Flow

```text
Splash
-> Welcome popup
-> Pet name
-> Personality and talking style
-> Photo upload intro
-> Photo review and consent
-> Generation / hatching
-> Pet reveal
-> First terrarium
-> First care action
-> First reward
```

## Screen Specs

### Splash

Goal:

- Establish the tiny glass-dome world.

Elements:

- Fullscreen terrarium art.
- Soft ambient motion.
- Auto-advance.

### Welcome Popup

Goal:

- Guide the user toward upload.

Elements:

- Tiny terrarium image.
- Short concept copy.
- Primary CTA: `Choose pet photo`.
- Privacy microcopy.

### Pet Name

Goal:

- Create emotional investment.

Elements:

- Pet name input.
- Species selector.
- Continue CTA.

### Personality And Talking Style

Goal:

- Seed local reactions and premium chat.

Elements:

- Personality chips: playful, calm, shy, curious, sleepy, affectionate.
- Talking style chips: cute, gentle, cheerful, comforting.
- Optional favorite thing.

### Photo Upload Intro

Goal:

- Make upload low-friction.

Elements:

- Friendly photo guide.
- Choose photo CTA.
- Photo tips.
- One-photo-is-enough message.

### Photo Review

Goal:

- Confirm photo before AI processing.

Elements:

- Photo preview.
- Quality checklist.
- Optional extra photos.
- Consent copy.
- Continue CTA to pet setup.

### Generation / Hatching

Goal:

- Turn processing into anticipation.

Progress states:

- Preparing photo.
- Finding little details.
- Creating companion.
- Polishing tiny world.
- Moving in.

Recovery:

- Retry.
- Choose another photo.
- Safe failure copy.

### Pet Reveal

Goal:

- Create the first emotional payoff.

Elements:

- Generated pet centered.
- Pet name.
- First greeting.
- Enter terrarium CTA.
- Try again/report issue secondary actions.

### First Terrarium

Goal:

- Make the product playable immediately.

Elements:

- Default terrarium.
- Pet idle animation.
- Speech bubble.
- Guided first care action.

### First Reward

Goal:

- Introduce collection.

Elements:

- Starter item card.
- Place now CTA.
- Later CTA.

## Daily Home Flow

```text
Open app
-> Select reaction by state
-> Show speech bubble
-> User taps care action
-> Animate pet/terrarium
-> Update state
-> Show reaction/reward
```

Care actions:

- Feed.
- Talk.
- Walk.
- Play.
- Affection.
- Water.
- Clean.
- Treat.

## Premium Chat Flow

```text
Tap Talk
-> Free state reaction
-> User taps Talk more
-> Premium gate if needed
-> Chat screen
-> AI response with safety controls
```

Premium gate should:

- Explain longer conversations.
- Mention AI disclosure.
- Avoid pressure.

## Walk Flow

```text
Tap Walk
-> Confirm send
-> Pet leaves / walking state
-> Timer or background state
-> Pet returns
-> User claims reward
```

MVP:

- No GPS.
- No step counter.
- No map.

Later:

- Missions.
- Outdoor finds.
- Friend visits.
- Optional real-world steps.

## Error UX

Upload failure:

```text
We couldn't read that photo. Try another image with your pet clearly visible.
```

Generation failure:

```text
The tiny door got stuck. Let's try creating {petName} again.
```

Network:

```text
The terrarium needs a connection for this step. We'll keep your progress here.
```

## UX Acceptance Checklist

- First flow has no dead ends.
- Upload is clearly explained before permission prompts.
- Generated pet reveal feels rewarding.
- Free reactions make the pet feel alive without AI.
- Premium chat gate is clear.
- Missing a day is not guilt-heavy.
- Error states are recoverable.
- Original photo privacy is visible but not scary.
- Main screen works in 30 seconds.
