# Push Notification State Strategy

## Intent

Pushes should feel like the pet is asking for a small, specific moment, not like the app is nagging. The first production pass should use local state, approximate weather, and time bucket signals. OS push delivery can later consume the shared `selectPetPushNotificationCandidates` engine.

## Notification Families

| Key | Trigger | Action | Cooldown | Notes |
| --- | --- | --- | --- | --- |
| `meal_urgent` | fullness <= 25 and last meal >= 5h | Feed | 4h | Highest priority. Do not combine with shop/BM copy. |
| `meal_due` | fullness <= 45 and last meal >= 4h | Feed | 4h | Gentle meal reminder. |
| `thirst_due` | thirst/water meter <= 42 | Water | 3h | Uses pet water bowl language, not plant watering. |
| `thirst_hot_weather` | hot weather and water meter <= 65 | Water | 3h | Weather-aware early nudge. |
| `bored_play` | happiness <= 45 or recommended action is play | Play | 5h | Suppressed at night. |
| `attention_return` | no interaction >= 10h or affection <= 42 | Pet/Talk | 8h | Best for retention without implying distress. |
| `walk_window` | morning/evening and happiness < 70 | Walk | 20h | One calm daily walk nudge. |
| `rest_needed` | evening/night and energy <= 40 | Rest | 10h | Allowed at night because it is quiet-mode copy. |
| `rainy_cozy_check` | rain and happiness < 72 | Talk | 8h | Weather mood nudge. |

## Copy Rules

- Keep the title pet-specific: `{petName}` should appear when possible.
- Avoid guilt framing like “your pet is sad because of you.”
- Avoid direct monetization in care reminders. BM can appear only after the user opens the relevant action sheet.
- Night quiet hours should suppress low-priority play/walk/social nudges.
- When multiple candidates exist, send only the top priority candidate.

## Production Wiring Notes

- Persist `lastSentAtByKey` per pet and notification key.
- Recompute candidates after app backgrounding and after successful care actions.
- If remote push is added, the server should receive rounded/coarse care summaries, not raw private photo or chat content.
