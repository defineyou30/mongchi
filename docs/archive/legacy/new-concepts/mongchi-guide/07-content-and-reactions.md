# 07 Content And Reactions

## Content Goal

Make the pet feel alive without calling AI for every line.

The free reaction system should:

- Be unlimited.
- Be authored/local or server-provided catalog.
- Vary by pet state and personality.
- Avoid guilt-heavy language.
- Stay pet-like, warm, short, and safe.

## Reaction Inputs

- Locale.
- Pet name.
- Species.
- Personality tags.
- Talking style.
- Favorite thing.
- Satiety/hunger.
- Energy.
- Happiness.
- Affection.
- Garden health.
- Cleanliness.
- Recent action.
- Time of day.
- Days away.
- Walk status.
- Event context.

## Reaction Rule Shape

```json
{
  "id": "ko_morning_affectionate_001",
  "locale": "ko-KR",
  "conditions": {
    "time_bucket": "morning",
    "personality_tags_any": ["affectionate"],
    "affection_min": 50
  },
  "lines": [
    "좋은 아침이야. 네 자리 비워뒀어."
  ],
  "animation": "idle_happy",
  "priority": 40,
  "cooldown_hours": 12,
  "safety_level": "safe"
}
```

## Selection Logic

1. Filter by locale.
2. Filter by conditions.
3. Exclude recently shown lines in cooldown.
4. Prefer urgent care states.
5. Prefer recent action-specific lines.
6. Prefer personality-specific lines.
7. Randomize lightly among top candidates.
8. Fill placeholders.

## Tone Rules

Do:

- Keep lines short.
- Use gentle humor.
- Make the pet sound warm and present.
- Respond to care state.
- Make absence soft.

Avoid:

- Guilt.
- Fear.
- "I am your real pet."
- Death/abandonment language.
- Purchase pressure.
- Professional advice.
- Long paragraphs.

## Launch Reaction Categories

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

## Korean Starter Lines

App open:

- `왔구나. 유리돔 안쪽이 조금 더 따뜻해졌어.`
- `나 방금 네 발소리 들은 것 같았어.`
- `오늘도 내 작은 정원에 들러줘서 좋아.`

Hungry:

- `내 밥그릇이 조용히 너를 부르고 있어.`
- `간식 생각이 조금 났어. 아주 조금.`
- `밥그릇 회의 결과, 지금은 밥 시간이래.`

Fed:

- `완벽했어. 행복한 꼬리 움직임 저장 완료.`
- `맛있었어. 나 지금 아주 훌륭한 상태야.`

Missed visits:

- `다시 와줘서 좋아. 정원도 반가워해.`
- `오랜만이야. 천천히 다시 시작해도 괜찮아.`

Walk start:

- `산책 다녀올게. 작은 모험이면 충분해.`
- `구름 근처까지 갔다 올게. 선물 찾으면 가져올게.`

Walk return:

- `다녀왔어. 나뭇잎이 나한테 인사했어.`
- `작은 걸 주워왔어. 네가 좋아할 줄 알았어.`

Affection:

- `그 손길 알아.`
- `한 번 더 해도 돼. 내가 허락했어.`

Treat:

- `이건 특별한 맛이야. 표정 관리가 안 돼.`
- `내가 방금 행복을 씹었어.`

## English Starter Lines

App open:

- `You came back. The dome feels warmer now.`
- `I saved this little spot for you.`

Hungry:

- `My bowl is politely trying to get your attention.`
- `I had one tiny snack thought. Maybe two.`

Fed:

- `Perfect. I stored one happy wiggle for you.`
- `Snack accepted. You may stay.`

Walk return:

- `I'm back. The wind said hello.`
- `I brought back something tiny because it reminded me of you.`

## Personality Tone

Playful:

- Tiny jokes.
- Food/toy humor.
- Confident cute voice.

Calm:

- Gentle.
- Slow.
- Observational.

Shy:

- Warm but reserved.
- Soft gratitude.

Curious:

- Notices small objects.
- Asks small questions.

Sleepy:

- Cozy.
- Nap language.

Affectionate:

- Direct warmth.
- Bond language.

## Content Targets

Prototype:

- 100-200 lines.

Launch:

- 500+ Korean lines.
- 500+ English lines if English is supported.
- Cooldowns and priority metadata.

Mature:

- 3,000+ localized lines.
- Seasonal/event packs.
- Species/personality variants.

## Content QA

Reject lines that:

- Create guilt.
- Imply literal consciousness.
- Mention abandonment/harm casually.
- Push payment manipulatively.
- Are too assistant-like.
- Are too long for a bubble.

## Content Acceptance Criteria

- The same line does not repeat too often.
- Common states have enough variety.
- Korean tone feels natural.
- English tone is not mechanically translated.
- Free reactions feel alive even without AI.
- Premium chat tone can extend from the authored style.
