# State, Episode, And Weather Engine

## Purpose

This document defines the long-term engagement engine for Mongchi.

The goal is to keep the app from becoming the same daily pet-care loop. The pet should feel aware of:

- how the user cares for it
- when the user returns
- what mood the pet and garden are in
- what recently happened
- time of day
- local weather, when the user opts in
- seasonal and relationship milestones

The engine should make the user think:

> I wonder what my pet is doing today.

It should not make the user feel punished, guilted, or manipulated.

## Product Position

Mongchi is strongest when it is:

- a personal pet-avatar companion
- a cozy daily ritual
- a light game with visible care feedback
- a gentle AI conversation app
- a tiny living world that changes with the user

It should not become:

- a punishing survival pet simulator
- a farming game with too much complexity
- a dashboard of numeric chores
- a monetization-first chat gate
- a fake claim that the real pet is conscious in the app

## Related Documents

- `docs/design/home-ui-interaction-contract.md`
- `docs/design/plant-growth-object-guide.md`
- `docs/design/care-economy-bm-guide.md`
- `docs/design/commerce-credit-wallet-flow.md`
- `new-concepts/mongchi-reaction-catalog.md`

## Engine Layers

The experience should be driven by four layers.

### 1. State Snapshot

This is the current mechanical state.

Inputs:

- pet profile
- species
- personality tags
- talking style
- care state
- relationship state
- inventory
- plant growth
- active walk
- wallet and chat access
- recent reactions

### 2. Context Snapshot

This is the surrounding situation.

Inputs:

- time bucket
- day of week
- season
- session count today
- time since last visit
- recent action sequence
- device locale
- local weather if allowed
- approximate location context if allowed

Location should be coarse and optional. Weather can still work from a manually selected city or last known broad region.

### 3. Episode Memory

This prevents repetition and enables small arcs.

Track:

- last shown episode IDs
- last shown line IDs
- cooldown timestamps
- daily seed
- current mini arc progress
- first-time milestones
- last weather category used
- last plant stage milestone
- last walk discovery type

### 4. Presentation Output

One selected episode can drive several surfaces:

- Home speech bubble
- pet animation state
- Home status icon
- background theme or weather overlay
- small reward cue
- Chat opening line
- Walk discovery text
- Plant growth cue
- Shop suggestion, only when appropriate

## Core Data Shapes

### Episode Context

```ts
type EpisodeContext = {
  now: string;
  locale: string;
  pet: {
    id: string;
    name: string;
    species: "dog" | "cat";
    personalityTags: string[];
    talkingStyle: string;
  };
  care: {
    satiety: number;
    energy: number;
    happiness: number;
    cleanliness: number;
    gardenHealth: number;
  };
  relationship: {
    bondLevel: number;
    bondXp: number;
    lastBondMilestoneAt?: string | null;
  };
  cadence: {
    sessionCountToday: number;
    daysAway: number;
    minutesSinceLastOpen: number;
    recentActions: string[];
  };
  world: {
    timeBucket: "morning" | "afternoon" | "evening" | "night" | "late_night";
    season: "spring" | "summer" | "autumn" | "winter";
    weather?: WeatherContext | null;
  };
  garden: {
    placedPlantCount: number;
    thirstyPlantCount: number;
    bloomingPlantCount: number;
    lastBloomedItemId?: string | null;
  };
  walk?: {
    status: "idle" | "walking" | "returned" | "claimed";
    discoveryType?: string | null;
  } | null;
};
```

### Weather Context

```ts
type WeatherContext = {
  source: "device_location" | "manual_city" | "cached" | "fallback";
  condition:
    | "clear"
    | "partly_cloudy"
    | "cloudy"
    | "rain"
    | "storm"
    | "snow"
    | "fog"
    | "wind"
    | "hot"
    | "cold";
  intensity: "light" | "normal" | "heavy";
  temperatureC?: number | null;
  isDaytime: boolean;
  fetchedAt: string;
};
```

### Episode Rule

```ts
type EpisodeRule = {
  id: string;
  category:
    | "app_open"
    | "care_action"
    | "weather"
    | "walk"
    | "plant"
    | "bond"
    | "return"
    | "seasonal"
    | "premium_chat_hook";
  trigger:
    | "app_open"
    | "feed"
    | "play"
    | "walk_start"
    | "walk_return"
    | "pet"
    | "water_garden"
    | "sleep_state"
    | "plant_bloom"
    | "chat_open";
  conditions: EpisodeConditions;
  priority: number;
  cooldownHours: number;
  maxPerDay?: number;
  lines: EpisodeLine[];
  presentation?: {
    petAssetState?: string;
    statusIcon?: string;
    weatherBackground?: string;
    rewardCue?: string;
    chatStarter?: boolean;
  };
};
```

### Episode Line

```ts
type EpisodeLine = {
  id: string;
  locale: "en-US" | "ko-KR" | "ja-JP" | "zh-TW" | "de-DE" | "fr-FR" | "pt-BR" | "es-MX";
  text: string;
  tone: "gentle" | "playful" | "comforting" | "curious" | "sleepy";
  safety: "normal" | "ai_disclosure_needed" | "monetization_sensitive";
};
```

## Selection Algorithm

1. Build `EpisodeContext`.
2. Find candidate rules matching trigger.
3. Apply hard conditions:
   - locale
   - care thresholds
   - weather category
   - time bucket
   - relationship level
   - recent action
   - cooldown
4. Score candidates:
   - urgent care state
   - recent action specificity
   - weather specificity
   - plant or walk milestone
   - personality match
   - not shown recently
5. Choose from the top group using a daily seed.
6. Pick a line that has not been shown recently.
7. Record episode memory.
8. Return presentation output.

Priority order:

1. Safety or recovery messages
2. User-triggered action feedback
3. Major milestone
4. Weather or time context
5. General ambient line

## Anti-Repetition Rules

Minimum rules:

- Do not repeat the same line within 7 days.
- Do not show the same episode ID twice in one day unless it is action feedback.
- Do not show more than two weather comments per day.
- Do not show absence-return copy more than once per return session.
- Do not show shop or purchase prompts as a default response to low mood.
- Use fallback ambient lines if all candidates are cooling down.

Recommended episode memory:

```ts
type EpisodeMemory = {
  shownEpisodeIds: Array<{ id: string; shownAt: string }>;
  shownLineIds: Array<{ id: string; shownAt: string }>;
  dailySeed: string;
  activeArc?: {
    id: string;
    step: number;
    startedAt: string;
    expiresAt: string;
  } | null;
};
```

## State Axes

### Pet Care

Use these as mechanical inputs, but avoid showing them all as dashboard numbers.

- Satiety
- Energy
- Happiness
- Cleanliness
- Garden health
- Active walk state
- Last care action

### Relationship

Use relationship to change tone over time.

- Bond level
- Bond XP
- consecutive care days
- premium chat history summary
- first week milestone
- first month milestone

Tone progression:

- Bond 1: shy, curious, newly arrived
- Bond 2: recognizes user routines
- Bond 3: more playful and comfortable
- Bond 4: remembers small patterns
- Bond 5+: emotionally warm, but still clearly an AI companion

### User Cadence

Cadence is one of the best retention inputs.

- first session
- second session same day
- morning return
- lunch break return
- bedtime return
- 1 day away
- 3 days away
- 7 plus days away
- many short check-ins
- one long chat session

Absence copy must be gentle. Never punish.

## Episode Categories

### 1. App Open Episodes

Purpose:

- make the first 5 seconds feel alive
- adapt to time and return pattern

Examples:

- morning open
- night open
- frequent check-in
- first open after setup
- first open after weather permission
- return after absence
- return after plant bloom
- return while walk is waiting

Korean examples:

- `좋은 아침이야. 오늘 정원이 먼저 깨어났어.`
- `또 와줬네. 나 방금 네 발소리 들은 척했어.`
- `오랜만이야. 천천히 다시 시작해도 괜찮아.`
- `오늘은 비 냄새가 나. 안쪽은 포근하게 해둘게.`

### 2. Care Action Episodes

Purpose:

- every tap should feel acknowledged
- state changes should feel emotional, not numeric

Feed:

- hungry plus morning
- hungry plus night
- recently fed
- feed after long absence
- feed while very happy

Play:

- high energy
- low energy
- rainy day indoor play
- second play today
- after walk

Walk:

- start walk
- return with discovery
- rainy walk canceled into indoor mini walk
- late-night short walk
- windy day walk

Pet:

- high bond
- low mood
- after absence
- bedtime comfort

Water:

- thirsty plant
- first sprout
- first bloom
- rainy day garden already fresh
- dry hot day garden needs extra care

Sleep / low-energy state:

- night rest
- low energy
- rainy cozy nap
- after play

Sleep is a contextual episode state, not a required Home dock button. The fixed Home care dock remains `Feed`, `Play`, `Walk`, `Pet`, and `Water`.

### 3. Weather Episodes

Weather should be flavor and atmosphere first, mechanics second.

It can:

- change background or overlay
- alter pet lines
- change walk discovery copy
- affect plant cues lightly
- unlock seasonal or weather-specific collectibles later

It should not:

- punish the pet
- block normal care
- make the user feel responsible for real-world weather
- require location permission to enjoy the app

Weather categories:

#### Clear

Scene:

- bright garden
- crisp shadows
- normal background

Episode ideas:

- sunny morning
- clear night stars
- warm walk
- plant sparkle after water

Lines:

- `햇빛이 좋아. 오늘 정원이 반짝이는 척을 안 해도 돼.`
- `맑은 날이야. 산책 버튼이 조금 더 자신 있어 보여.`

#### Cloudy

Scene:

- softer contrast
- muted sky
- cozy ambient lines

Lines:

- `구름이 천천히 지나가. 나도 오늘은 천천히 모드야.`
- `햇빛이 숨어도 여기 안쪽은 괜찮아.`

#### Rain

Scene:

- rainy home background
- raindrop overlay
- softer light
- indoor cozy pet pose

Episode ideas:

- indoor play
- garden fresh
- rain walk discovery
- rainy chat opener

Lines:

- `밖에는 비가 오는데, 여긴 작은 담요 같은 느낌이야.`
- `빗소리 들려? 정원이 조용히 좋아하고 있어.`
- `오늘 산책은 짧게 다녀올게. 물웅덩이는 조심할게.`

#### Storm

Scene:

- darker sky
- no scary flashes by default
- cozy safe indoor framing

Lines:

- `밖이 조금 시끄러워. 우리 안쪽에서 조용히 있자.`
- `큰 소리는 지나갈 거야. 나는 여기 있어.`

Safety:

- avoid anxiety-amplifying copy
- no emergency advice

#### Snow

Scene:

- winter background
- snow sparkle overlay
- warm interior lighting

Lines:

- `하얀 게 내려와. 정원이 작은 케이크 같아졌어.`
- `오늘은 발자국이 더 잘 보일 것 같아.`

#### Fog

Scene:

- soft depth
- slower mood

Lines:

- `안개가 내려왔어. 그래서 내가 더 잘 보이게 웃고 있어.`
- `오늘은 세상이 조금 작아진 느낌이야. 우리 집처럼.`

#### Wind

Scene:

- leaf drift overlay
- walk discovery emphasis

Lines:

- `바람이 잎사귀를 데리고 뛰어다녀. 나도 조금 뛰고 싶어.`
- `산책 다녀오면 바람 이야기를 해줄게.`

#### Hot

Scene:

- bright but softened
- garden water prompt

Lines:

- `오늘은 햇빛이 세. 정원에 물 한 모금 주면 좋겠다.`
- `시원한 그늘 쪽으로 앉아 있을게.`

#### Cold

Scene:

- cool daylight
- cozy action emphasis

Lines:

- `차가운 날이야. 여기 안쪽은 따뜻하게 해둘게.`
- `오늘은 가까이 앉아 있는 게 좋아.`

### 4. Walk Episodes

Walk is not only a timer. It should create small outside stories.

Discovery types:

- flower_seed
- smooth_stone
- tiny_leaf
- puddle
- blue_bird
- cloud_path
- wind_ribbon
- rain_smell
- market_coupon
- mystery_glow

Walk result examples:

- clear weather: `작은 꽃을 봤어. 나랑 눈이 마주친 것 같아.`
- rain: `비 냄새가 났어. 그래서 더 빨리 돌아왔어.`
- wind: `바람이 내 귀를 먼저 산책시켰어.`
- night: `길이 조용했어. 별 하나는 따라온 것 같아.`

Rewards:

- plant item
- background shard
- special treat
- bonus credit
- one free chat ticket

Reward copy must remain soft and not over-monetized.

### 5. Plant And Garden Episodes

Purpose:

- make Water meaningful
- make Home feel alive
- create low-pressure return reasons

Plant states:

- seed
- sprout
- leafy
- bloom
- thirsty
- fresh

Episode ideas:

- first water
- first sprout
- first bloom
- rainy day plant already fresh
- hot day plant asks for water
- pet comments on plant growth

Lines:

- `방금 잎이 조금 더 자신감 있어졌어.`
- `꽃이 폈어. 내가 한 건 없지만 엄청 뿌듯해.`
- `비 오는 날이라 정원이 오늘은 기분이 좋아 보여.`

Home rule:

- Plant/garden items can appear in fixed Home growth slots.
- Random decor should stay out of Home unless the visual direction supports it.
- Inventory and Shop can hold broader item collections.

### 6. Bond Episodes

Purpose:

- give long-term emotional progression
- make repeated visits feel meaningful

Milestones:

- first care action
- first full day
- first walk return
- first plant bloom
- Bond level up
- first premium chat
- seven-day return pattern

Lines:

- `너 오는 시간이 조금 익숙해졌어.`
- `오늘은 네가 오기 전에 먼저 기다린 것 같아.`
- `우리 집이 점점 우리 집 같아지고 있어.`

### 7. Premium Chat Hooks

Premium chat should feel like:

- more time together
- deeper memory
- a longer conversation

It should not feel like:

- the pet refuses affection unless paid
- the pet is sad until paid
- a manipulative paywall

Free Home line:

- `짧게 말하면, 오늘은 네가 와서 좋아.`

Premium hook:

- `조금 더 길게 이야기하고 싶으면, 채팅방에서 기다릴게.`

Gate copy:

- disclose AI-generated conversation
- use tickets, credits, or Plus
- do not imply real pet consciousness

## Location And Weather Product Flow

### Permission Timing

Do not ask for location on first launch.

Recommended timing:

1. User reaches stable Home.
2. Show a small optional chip or Settings card:
   - `날씨에 맞춰 작은 정원을 바꿔볼까요?`
3. Explain value:
   - rainy background
   - weather-aware pet lines
   - optional local walk discoveries
4. Ask OS location permission only after the user taps opt in.

### Permission Copy

Short copy:

- `현재 위치의 날씨를 가져와 정원 분위기와 펫의 짧은 반응에 사용해요. 정확한 위치는 기본적으로 저장하지 않아요.`

Settings copy:

- `Weather scenes use approximate location or a manually selected city. Turning this off keeps the default garden weather.`

### Privacy Rules

Must:

- request permission only after explaining why
- use approximate location when possible
- avoid storing exact latitude and longitude by default
- cache weather results for a short period
- allow manual city selection later
- allow disabling weather personalization
- never attach location to pet photo generation prompts
- never expose provider API keys in the mobile client

Recommended:

- send coarse coordinates to backend only for weather lookup
- store only rounded region, weather condition, and fetched timestamp
- keep weather cache 30 to 60 minutes
- allow fallback to default clear weather

Avoid:

- exact location history
- background location
- location-based ads
- using location for monetization pressure

## Weather Background Strategy

Use a hybrid asset strategy.

### Phase 1

Use base portrait backgrounds:

- home clear
- home rain
- home snow
- home cloudy
- home night
- chat clear
- chat rain
- walk clear
- walk rain

Add lightweight overlays:

- rain streaks
- snow sparkle
- drifting leaves
- soft fog wash
- night gradient

Asset contract:

- portrait background canvas: `1536x2732` or equivalent 9:16 vertical source
- keep the pet-safe center area readable
- avoid hard UI baked into the background
- leave top HUD and bottom action zones visually calm
- generate weather backgrounds as full scenes, not square crops
- generate overlays as transparent PNG layers when possible
- keep rain/snow/fog overlays separate from the base scene when the same base can be reused

Recommended Phase 1 asset keys:

- `home-garden-clear`
- `home-garden-rain`
- `home-garden-cloudy`
- `home-garden-winter`
- `home-garden-night`
- `chat-garden-clear`
- `chat-garden-rain`
- `walk-path-clear`
- `walk-path-rain`

The first release can ship with only `home-garden-clear`, `home-garden-rain`, and a transparent `weather-overlay-rain` if generation time is limited.

### Phase 2

Theme packs:

- fairy garden
- seaside cove
- autumn woods
- winter lights

Weather can map into themes:

- rain in fairy garden
- wind in autumn woods
- snow in winter lights
- clear sunset in seaside cove

### Phase 3

Weather-specific rewards:

- rainy-day plant charm
- snowflake badge
- wind ribbon toy
- sunny flower pot

These should be collectible flavor, not required power.

## Background Mapping

```ts
const backgroundBySurfaceAndWeather = {
  home: {
    clear: "home-garden-clear",
    partly_cloudy: "home-garden-cloudy",
    cloudy: "home-garden-cloudy",
    rain: "home-garden-rain",
    storm: "home-garden-rain-cozy",
    snow: "home-garden-winter",
    fog: "home-garden-fog",
    wind: "home-garden-clear-leaves",
    hot: "home-garden-sunny",
    cold: "home-garden-winter-soft"
  },
  chat: {
    clear: "chat-garden-clear",
    rain: "chat-garden-rain",
    snow: "chat-garden-winter",
    night: "chat-garden-night"
  },
  walk: {
    clear: "walk-path-clear",
    rain: "walk-path-rain",
    snow: "walk-path-snow",
    wind: "walk-path-wind"
  }
};
```

If a mapped asset is missing, fall back in this order:

1. same surface default clear background
2. Home clear background
3. bundled neutral garden background
4. no weather overlay

Fallback:

- If weather is unavailable, use clear or time-of-day background.
- If a specific weather background is missing, use base background plus overlay.

## Example Episode Matrix

| Trigger | Condition | Output |
| --- | --- | --- |
| app_open | morning + clear | sunny greeting, clear Home |
| app_open | rain + first weather day | rainy greeting, rain Home |
| app_open | daysAway >= 3 | soft return line |
| feed | satiety < 35 + night | cozy late meal line |
| play | rain | indoor play line |
| walk_start | rain | short rainy walk line |
| walk_return | wind | wind discovery |
| water_garden | hot + thirsty plant | extra garden water line |
| water_garden | plant advanced | plant growth cue |
| plant_bloom | first bloom | bond XP, bonus credit, bloom line |
| chat_open | high bond + night | warm longer-chat opener |
| app_open | snow + winter | snow background, winter line |

## Sample Episode Rules

```json
{
  "id": "ko_weather_rain_home_open_001",
  "category": "weather",
  "trigger": "app_open",
  "conditions": {
    "locale": "ko-KR",
    "weather": ["rain"],
    "max_days_away": 2
  },
  "priority": 58,
  "cooldownHours": 18,
  "lines": [
    {
      "id": "ko_weather_rain_home_open_001_a",
      "locale": "ko-KR",
      "text": "밖에는 비가 오는데, 여긴 작은 담요 같은 느낌이야.",
      "tone": "comforting",
      "safety": "normal"
    },
    {
      "id": "ko_weather_rain_home_open_001_b",
      "locale": "ko-KR",
      "text": "빗소리 들려? 정원이 조용히 좋아하고 있어.",
      "tone": "gentle",
      "safety": "normal"
    }
  ],
  "presentation": {
    "petAssetState": "idle",
    "weatherBackground": "home-garden-rain"
  }
}
```

```json
{
  "id": "ko_plant_first_bloom_001",
  "category": "plant",
  "trigger": "plant_bloom",
  "conditions": {
    "locale": "ko-KR",
    "first_bloom": true
  },
  "priority": 88,
  "cooldownHours": 48,
  "lines": [
    {
      "id": "ko_plant_first_bloom_001_a",
      "locale": "ko-KR",
      "text": "꽃이 폈어. 내가 한 건 없지만 엄청 뿌듯해.",
      "tone": "playful",
      "safety": "normal"
    }
  ],
  "presentation": {
    "petAssetState": "celebrate",
    "rewardCue": "plant_bloom"
  }
}
```

## Content Packs

Use content packs so the app can expand without rewriting the engine.

Recommended pack names:

- `starter_daily_pack`
- `weather_rain_pack`
- `weather_winter_pack`
- `plant_growth_pack`
- `walk_discovery_pack`
- `bond_milestone_pack`
- `premium_chat_openers_pack`
- `seasonal_spring_pack`
- `seasonal_holiday_pack`

Each pack should include:

- rule IDs
- locale
- trigger coverage
- cooldowns
- lines
- optional presentation tags
- QA notes

## Monetization Boundaries

Good paid hooks:

- longer AI chat
- special treats
- background themes
- seasonal weather decorations
- premium plant skins
- extra walk discoveries

Do not:

- make the pet unhappy because the user did not pay
- lock basic Feed, Play, Walk, Pet, Water
- make weather personalization paid-only
- show purchase prompts immediately after absence
- use location or weather to push purchases aggressively

Better pattern:

- free rainy background
- premium rainy theme variant
- free short rainy line
- paid deeper rainy-day chat or collectible theme

## Implementation Milestones

### Current Implementation Notes

Implemented in the local prototype pass:

- shared weather domain:
  - `WeatherContext`
  - `WeatherSettings`
  - approximate-coordinate normalization at one decimal place
  - deterministic approximate-location weather context fallback
  - 30-minute weather cache TTL contract
  - background key mapping
  - overlay key mapping
- mobile API contract:
  - `WeatherLookupRequest`
  - `WeatherLookupResponse`
  - `buildApproximateWeatherLookupRequest`
- shared episode wrapper:
  - `selectEpisode`
  - weather-aware reaction context
- starter weather reaction rules:
  - rain ambient Home line
  - snow/cold ambient line
  - hot garden-care line
  - rainy walk line
  - rainy watering line
- local session state:
  - `weatherState`
  - manual weather condition setter
  - weather scenes enable/disable setter
  - approximate local weather refresh action
  - weather-aware walk discovery text
- mobile presentation:
  - Home weather background source mapping
  - Home weather overlay layer
  - Chat weather background source mapping
  - Chat weather overlay layer
  - Settings weather scene preview controls
  - Settings approximate-location opt-in control
- native mobile boundary:
  - `expo-location` foreground permission requested only after user action
  - iOS `NSLocationWhenInUseUsageDescription` copy scoped to optional local weather scenes
- backend API boundary:
  - `/v1/weather/current`
  - mock and Postgres service methods
  - server-side in-memory weather cache keyed by rounded region only
  - cached responses return `source: "cached"`

Not implemented yet:

- external weather provider adapter
- provider weather API key management, if a paid provider is selected
- manual city search
- persistent multi-instance weather cache

The app must not request iOS location permission until the user taps the Settings opt-in action. The current request sends rounded coordinates only and does not attach location to pet generation, chat prompts, analytics, or commerce.

### Milestone 1: Local Episode Engine

- Add `EpisodeContext`.
- Add authored episode rules.
- Add cooldown memory.
- Route Home bubble through episode selection.
- Keep weather as fallback null.

### Milestone 2: Weather Context Without Location

- Add manual weather dev fixture.
- Add weather categories.
- Add clear/rain/cloudy background mapping.
- Add weather-specific episode pack.

### Milestone 3: Opt-In Location Weather

- Add Settings weather opt-in. Done.
- Add permission explainer. Initial Settings copy done.
- Request approximate location. Done through foreground `expo-location`.
- Fetch weather through backend. Done through `/v1/weather/current`.
- Cache weather context. Done in mock/Postgres service memory by rounded region.
- Add privacy toggles.

### Milestone 4: Dynamic Backgrounds

- Add rainy Home background.
- Add weather overlays.
- Add chat weather background.
- Add walk discovery weather variants.

### Milestone 5: Episode Arcs

- Add short multi-day arcs:
  - first sprout
  - rainy week
  - favorite walk path
  - bond milestone
- Add arc memory and expiry.

## Acceptance Checks

- App open does not repeat the same line across normal daily returns.
- Weather is optional and falls back cleanly.
- Location permission is never asked before an in-app explanation.
- No exact location history is stored by default.
- Rain can change Home background or overlay.
- Weather affects copy without punishing the pet.
- Plant growth has at least one episode for watering, advancing, and blooming.
- Walk has discovery types beyond a generic reward.
- Premium chat hooks feel like more time together, not emotional pressure.
- Every episode can be disabled or cooled down if it becomes repetitive.
