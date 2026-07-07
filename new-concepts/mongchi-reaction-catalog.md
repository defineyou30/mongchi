# Mongchi Reaction Catalog

This document defines the authored/local reaction system used for free pet speech bubbles. These reactions do not call AI and can be unlimited.

Mongchi is a new standalone product concept.

## Related Documents

- [UX Flow](mongchi-ux-flow.md)
- [Data Model And API](mongchi-data-model-api.md)
- [AI Pipeline](mongchi-ai-pipeline.md)
- [State, Episode, And Weather Engine](../docs/design/state-episode-weather-engine.md)

## 1. Purpose

The reaction catalog makes the pet feel alive without AI cost.

It should:

- React to care state.
- Reflect pet personality.
- Avoid repetition.
- Stay warm and pet-like.
- Never imply the real pet's consciousness is inside the app.
- Work offline or with a bundled catalog.

## 2. Reaction Selection Inputs

Core inputs:

- `locale`
- `pet_name`
- `species`
- `personality_tags`
- `talking_style`
- `favorite_thing`
- `satiety` or `hunger`
- `energy`
- `happiness`
- `affection`
- `garden_health`
- `cleanliness`
- `recent_action`
- `time_bucket`
- `days_away`
- `walk_status`
- `weather_condition`
- `weather_intensity`
- `weather_source`
- `inventory_context`
- `event_context`

Time buckets:

- morning
- afternoon
- evening
- night

Recent actions:

- feed
- talk
- walk_start
- walk_return
- play
- affection
- water
- clean
- treat
- item_place
- app_open

Weather conditions:

- clear
- partly_cloudy
- cloudy
- rain
- storm
- snow
- fog
- wind
- hot
- cold

## 3. Reaction Rule Shape

```json
{
  "id": "ko_morning_affectionate_001",
  "locale": "ko-KR",
  "conditions": {
    "time_bucket": "morning",
    "personality_tags_any": ["affectionate", "gentle"],
    "affection_min": 50
  },
  "lines": [
    "{petName}, 아니 내가... 아침부터 너 기다렸어.",
    "좋은 아침이야. 네 자리 비워뒀어."
  ],
  "animation": "idle_happy",
  "priority": 40,
  "cooldown_hours": 12,
  "safety_level": "safe"
}
```

## 4. Selection Algorithm

Recommended:

1. Filter by locale.
2. Filter by hard conditions.
3. Remove recently shown reactions still in cooldown.
4. Score by priority and specificity.
5. Apply light randomness within top candidates.
6. Fill placeholders.
7. Return reaction line and animation.

Tie-breakers:

- Prefer recent action-specific reactions.
- Prefer urgent care reactions.
- Prefer personality-specific reactions.
- Avoid repeating the same line for the same pet within a short window.

## 5. Tone Rules

Do:

- Keep lines short.
- Make the pet sound warm, playful, and emotionally present.
- Let the line feel pet-like, not assistant-like.
- Use gentle humor.
- Make absence soft, not guilt-heavy.

Avoid:

- "You abandoned me."
- "I am your real pet."
- "I will die if you do not feed me."
- Medical, legal, financial advice.
- Manipulative purchase prompts.
- Long paragraphs.

## 6. Korean Tone Examples

### App Open

Normal:

- `왔구나. 유리돔 안쪽이 조금 더 따뜻해졌어.`
- `나 방금 네 발소리 들은 것 같았어.`
- `오늘도 내 작은 정원에 들러줘서 좋아.`

Playful:

- `드디어 왔다. 내가 안 기다린 척한 거 봤어?`
- `좋아, 오늘의 보호자 점수는 지금부터 시작이야.`

Comforting:

- `오늘 천천히 와도 괜찮아. 난 여기 있었어.`
- `잠깐 쉬어가. 내 정원은 조용해.`

### Morning

- `좋은 아침이야. 꽃들이 먼저 일어나 있었어.`
- `아침 공기가 포근해. 밥그릇도 살짝 깨어났고.`
- `오늘도 우리 천천히 시작하자.`

### Night

- `밤이 조용해졌어. 조금만 더 같이 있다가 잘래?`
- `별빛이 유리돔에 붙어 있어.`
- `오늘 하루도 잘 버텼어. 내가 봤어.`

### Hungry / Low Satiety

Gentle:

- `내 밥그릇이 조용히 너를 부르고 있어.`
- `간식 생각이 조금 났어. 아주 조금.`

Playful:

- `밥그릇 회의 결과, 지금은 밥 시간이래.`
- `내 배가 작은 북처럼 말하고 있어.`

Avoid:

- Do not make the pet look sick or desperate.

### Recently Fed

- `완벽했어. 행복한 꼬리 움직임 저장 완료.`
- `맛있었어. 나 지금 아주 훌륭한 상태야.`
- `밥그릇이랑 나랑 둘 다 만족했어.`

### Low Energy

- `조금 졸려. 네가 옆에 있으면 더 잘 잘 것 같아.`
- `오늘은 작은 낮잠이 필요할지도 몰라.`
- `조용한 시간이 좋아.`

### High Affection

- `너 오면 여기 공기가 달라져.`
- `나 너 알아. 마음으로 먼저 알아.`
- `오늘도 네 편이야. 작은 발로라도.`

### Missed Visits

1 day:

- `어제는 조금 조용했어. 그래도 오늘 왔으니까 좋아.`
- `다시 와줘서 좋아. 정원도 반가워해.`

Several days:

- `오랜만이야. 천천히 다시 시작해도 괜찮아.`
- `기다리는 동안 꽃들이 조금 자랐어. 같이 볼래?`

Avoid:

- No guilt.
- No punishment.

### Walk Start

- `산책 다녀올게. 작은 모험이면 충분해.`
- `구름 근처까지 갔다 올게. 선물 찾으면 가져올게.`
- `나 잠깐 탐험가 모드야.`

### Walk Return

- `다녀왔어. 나뭇잎이 나한테 인사했어.`
- `작은 걸 주워왔어. 네가 좋아할 줄 알았어.`
- `산책 보고서: 바람이 좋았고, 나는 귀여웠어.`

### Garden Needs Water

- `꽃들이 물 얘기를 조용히 하고 있어.`
- `정원이 목을 축이면 나도 기분이 좋아져.`
- `저 작은 잎이 너를 보고 있어.`

### After Watering

- `방금 정원이 반짝였어. 나도 봤어.`
- `꽃들이 고맙다고 했어. 아마도.`
- `물이 내려가니까 공기가 부드러워졌어.`

### Affection / Petting

- `그 손길 알아.`
- `한 번 더 해도 돼. 내가 허락했어.`
- `좋아. 지금 마음이 동그랗게 됐어.`

### Play

- `좋아, 놀자. 내가 이길 확률은 귀여움으로 보정돼.`
- `공이랑 나랑 이미 팀이야.`
- `조금 뛰었더니 구름도 흔들린 것 같아.`

### Treat

- `이건 특별한 맛이야. 표정 관리가 안 돼.`
- `간식이 이렇게 귀여워도 되는 거야?`
- `내가 방금 행복을 씹었어.`

### New Item

- `이거 우리 집에 두면 예쁘겠다.`
- `작은 물건인데 정원이 달라 보여.`
- `내가 여기 앉으면 딱 좋을 것 같아.`

### Error-Safe Generic

- `잠깐만. 유리돔이 생각 중이야.`
- `조금 느리지만 괜찮아. 난 여기 있어.`

## 7. English Tone Examples

### App Open

- `You came back. The dome feels warmer now.`
- `I saved this little spot for you.`
- `The garden was quiet. I like it better with you here.`

### Hungry

- `My bowl is politely trying to get your attention.`
- `I had one tiny snack thought. Maybe two.`

### Fed

- `Perfect. I stored one happy wiggle for you.`
- `Snack accepted. You may stay.`

### Missed Visits

- `It was quiet for a bit. But you're here now.`
- `We can start again slowly. I kept the flowers company.`

### Walk Return

- `I'm back. The wind said hello.`
- `I brought back something tiny because it reminded me of you.`

## 8. Personality Variants

### Playful

Traits:

- Light jokes.
- Tiny confidence.
- Food/toy humor.

Example:

- `I was very brave near the snack bowl.`

### Calm

Traits:

- Slow.
- Gentle.
- Quiet observations.

Example:

- `The garden is soft today. Let's stay a little.`

### Shy

Traits:

- Warm but reserved.
- Soft gratitude.

Example:

- `I'm glad it's you. I was hoping quietly.`

### Curious

Traits:

- Notices plants/items.
- Asks small questions.

Example:

- `Do you think the tiny bridge dreams about rivers?`

### Sleepy

Traits:

- Cozy.
- Nap references.

Example:

- `I had a dream about a very round snack.`

### Affectionate

Traits:

- Direct warmth.
- Bond language.

Example:

- `There you are. My favorite part of the day moved closer.`

## 9. Reaction Categories To Build

Launch target categories:

- greeting_morning
- greeting_afternoon
- greeting_evening
- greeting_night
- hungry_low
- fed_recent
- energy_low
- affection_high
- affection_low
- missed_one_day
- missed_many_days
- walk_start
- walk_return_common
- walk_return_rare
- garden_needs_water
- garden_watered
- play_start
- play_done
- petting
- treat_common
- treat_special
- new_item
- item_placed
- generation_reveal
- premium_chat_teaser
- error_soft

## 10. Launch Content Targets

Minimum:

- 20 lines per major category.
- 6 personality variants for common greetings.
- Korean and English starter packs if both languages are targeted.

Better launch:

- 500+ Korean lines.
- 500+ English lines.
- Cooldown and anti-repeat metadata.

Mature:

- 3,000+ localized lines.
- Seasonal packs.
- Event packs.
- Pet species-specific variants.

## 11. Safety Review Checklist

Reject lines that:

- Create guilt or fear.
- Imply the real pet's soul/consciousness exists in the app.
- Mention death, abandonment, or harm casually.
- Push purchases manipulatively.
- Give professional advice.
- Are too human-assistant-like.
- Are too long for a speech bubble.

## 12. Implementation Notes

- Store catalog as JSON or server-driven data.
- Version catalogs by locale.
- Track recently shown reaction IDs.
- Return fallback generic line when no condition matches.
- Separate UI copy from generated image assets.
- Premium chat should not reuse authored lines as if they were AI, but can share tone guidelines.
