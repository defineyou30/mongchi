import type {
  CareActionType,
  CareSatisfactionNeed,
  CareSatisfactionSummary,
  CareState,
  SelectedReaction,
  TimeBucket,
  WeatherCondition,
  WeatherContext
} from "../domain";
import { defaultWeatherContext } from "../domain/weather";
import { getTimeBucket } from "../reactions/localReactionEngine";
import { getCareStatBand } from "../care/careStatBands";
import type { CareStatBand } from "../care/careStatBands";

export type PetStatusNeed = "fullness" | "thirst" | "mood" | "energy" | "clean" | "attention" | "cozy";
export type PetStatusSource = "return" | "recent_action" | "urgent_need" | "weather_time" | "reaction" | "fallback";
export type PetStatusSurface = "home" | "chat";

export interface PetStatusLineInput {
  petName: string;
  now: string;
  careState?: Pick<CareState, "satiety" | "happiness" | "energy" | "gardenHealth" | "cleanliness" | "affection" | "lastInteractionAt" | "updatedAt"> | undefined;
  satisfactionSummary?: Pick<CareSatisfactionSummary, "primaryNeed" | "hint"> | undefined;
  reaction?: SelectedReaction | null | undefined;
  weather?: WeatherContext | null | undefined;
  recentAction?: CareActionType | null | undefined;
  daysAway?: number | undefined;
  surface?: PetStatusSurface | undefined;
}

export interface PetStatusLinePresentation {
  need: PetStatusNeed;
  line: string;
  accessibilityLabel: string;
  source: PetStatusSource;
  timeBucket: TimeBucket;
  weatherCondition: WeatherCondition;
  needBand?: CareStatBand;
}

const stableNow = "2026-06-24T09:00:00.000Z";

const conditionWords: Record<WeatherCondition, string> = {
  clear: "sunny",
  partly_cloudy: "cloud-soft",
  cloudy: "cloudy",
  rain: "rainy",
  storm: "stormy",
  snow: "snowy",
  fog: "misty",
  wind: "windy",
  hot: "warm",
  cold: "chilly"
};

const needByCareNeed: Record<CareSatisfactionNeed, PetStatusNeed> = {
  food: "fullness",
  play: "mood",
  clean: "clean",
  rest: "energy",
  thirst: "thirst",
  attention: "attention"
};

const seedTimeKey = (now: string): string => {
  const date = new Date(now);

  if (!Number.isFinite(date.getTime())) {
    return stableNow;
  }

  const slot = Math.floor(date.getMinutes() / 6);

  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}-${slot}`;
};

const seedBandKey = (careState: PetStatusLineInput["careState"]): string => {
  if (!careState) {
    return "none";
  }

  return [
    getCareStatBand(careState.satiety),
    getCareStatBand(careState.happiness),
    getCareStatBand(careState.energy),
    getCareStatBand(careState.gardenHealth),
    getCareStatBand(careState.cleanliness)
  ].join(".");
};

const hashString = (value: string): number => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash);
};

const chooseLine = (lines: readonly string[], seedParts: readonly string[]): string => {
  if (lines.length === 0) {
    return "";
  }

  return lines[hashString(seedParts.join("|")) % lines.length] ?? lines[0] ?? "";
};

const fillPlaceholders = (line: string, input: PetStatusLineInput, weather: WeatherContext, timeBucket: TimeBucket): string =>
  line
    .replaceAll("{petName}", input.petName)
    .replaceAll("{weather}", conditionWords[weather.condition])
    .replaceAll("{time}", timeBucket);

const getWeather = (weather: WeatherContext | null | undefined): WeatherContext => weather ?? defaultWeatherContext;

const getTime = (now: string): Date => {
  const date = new Date(now);

  return Number.isFinite(date.getTime()) ? date : new Date(stableNow);
};

const getPrimaryNeed = (
  careState: PetStatusLineInput["careState"],
  satisfactionSummary: PetStatusLineInput["satisfactionSummary"]
): { need: PetStatusNeed; value: number } | null => {
  if (!careState) {
    return satisfactionSummary?.primaryNeed ? { need: needByCareNeed[satisfactionSummary.primaryNeed], value: 0 } : null;
  }

  const values: Array<{ need: PetStatusNeed; value: number }> = [
    { need: "fullness", value: careState.satiety },
    { need: "thirst", value: careState.gardenHealth },
    { need: "mood", value: careState.happiness },
    { need: "energy", value: careState.energy },
    { need: "clean", value: careState.cleanliness }
  ];
  const primary = [...values].sort((left, right) => left.value - right.value)[0] ?? null;

  if (satisfactionSummary?.primaryNeed) {
    const summaryNeed = needByCareNeed[satisfactionSummary.primaryNeed];
    const summaryValue = values.find((entry) => entry.need === summaryNeed)?.value ?? primary?.value ?? 0;

    if (summaryValue < 58) {
      return { need: summaryNeed, value: summaryValue };
    }
  }

  if (primary && primary.value < 58) {
    return primary;
  }

  return null;
};

const returnLines = {
  soft: [
    "You came back. {petName}'s little spot stayed warm.",
    "{petName} heard you return and got quiet-happy.",
    "The {weather} air feels better now that you are here.",
    "{petName} kept one ear pointed at the door the whole time.",
    "The garden perked up the moment you arrived."
  ],
  long: [
    "Welcome back. {petName} wants to start soft today.",
    "It was quiet for a while. {petName} is glad you are here.",
    "{petName} saved one small hello for when you returned.",
    "No rush today. {petName} just wants to sit near you first.",
    "{petName} kept your spot exactly how you left it."
  ]
} as const;

const actionLines: Record<CareActionType, readonly string[]> = {
  feed: [
    "Bowl report: much better.",
    "That helped. My tiny belly is quieter now.",
    "{time} bowl time feels especially cozy.",
    "You always know when my tummy gets loud.",
    "Meal review: all paws up.",
    "Crunch crunch. Happiness confirmed."
  ],
  talk: [
    "I like when your voice visits this little place.",
    "Say one more thing if you want. I am listening.",
    "That hello made the {weather} air feel softer.",
    "I stored those words next to my favorite pebble.",
    "Your voice makes this little dome feel bigger.",
    "Tell me more whenever you want. I have time."
  ],
  walk: [
    "Tiny path started. I will come back soon.",
    "I am taking a small adventure near the {weather} path.",
    "Path mode on. I will look for something small.",
    "Sniff mission accepted. Back soon with news.",
    "I will count clouds on the way. Wish me luck.",
    "The path looks friendly today. Off I go."
  ],
  play: [
    "The toy moved. I bravely investigated.",
    "Tiny play mode started.",
    "That was a good little burst of happy.",
    "Again! My tail is fully awake now.",
    "That bounce was my best one yet.",
    "Playing with you is my favorite kind of busy."
  ],
  rest: [
    "Quiet rest sounds perfect for {time}.",
    "Tiny nap mode. I will keep one ear open.",
    "I am saving soft energy for later.",
    "The cushion accepted me immediately.",
    "Recharging tiny paws. Please enjoy the quiet.",
    "I will dream something small and good."
  ],
  affection: [
    "That gentle pet landed right in my happy spot.",
    "I felt that. My tiny heart did a wiggle.",
    "A small hello from your hand is enough.",
    "Your hand found the exact right spot.",
    "I leaned in. That means it was perfect.",
    "One more pat and I might hum forever."
  ],
  water_garden: [
    "Fresh water helped. My bowl feels calmer now.",
    "That sip made the {weather} air easier.",
    "Water bowl filled. I feel a little brighter.",
    "My tongue did a tiny happy flop after that sip.",
    "That was exactly the cool drink I needed.",
    "Bowl topped up. I feel refreshed from nose to tail."
  ],
  clean: [
    "Fresh again. I feel lighter.",
    "Tiny clean-up complete. Much better.",
    "That made my little corner feel soft again.",
    "Shiny fur activated.",
    "I feel like a brand-new tiny creature.",
    "Fluffed, fresh, and very proud of it."
  ],
  treat: [
    "Special snack detected. Joy confirmed.",
    "That tasted like a tiny celebration.",
    "I will remember that treat with great seriousness.",
    "That was the good kind of surprise.",
    "I did a spin. It deserved a spin.",
    "Saving the memory of that flavor forever."
  ]
};

const urgentNeedLines: Record<PetStatusNeed, readonly string[]> = {
  fullness: [
    "My bowl is starting to look important.",
    "I am thinking small bowl thoughts.",
    "{time} feels like a good time for food.",
    "A little snack would land perfectly right now.",
    "My tummy just made the tiniest sound."
  ],
  thirst: [
    "My water bowl is starting to look important.",
    "A tiny sip would make me feel softer.",
    "The {weather} air makes water sound extra nice.",
    "I keep glancing over at my water bowl.",
    "A fresh, cool drink would hit the spot soon."
  ],
  mood: [
    "I could use a little play moment.",
    "The toy is doing that thing where it looks interesting.",
    "A tiny game would brighten this place.",
    "My tail has been quiet today. Play might wake it.",
    "One small game and I will be my bouncy self again."
  ],
  energy: [
    "I am moving in slow mode right now.",
    "Quiet rest would feel nice.",
    "{time} energy is running a little low.",
    "My paws vote for a small nap.",
    "The cushion has been calling my name softly."
  ],
  clean: [
    "A small freshen-up would help.",
    "I feel a little rumpled around the edges.",
    "Tiny clean mode would make me cozy.",
    "My fur is doing its own thing today.",
    "A quick brush would make me shine again."
  ],
  attention: [
    "I missed your hello, just a little.",
    "A gentle pet would help me settle.",
    "I saved this little look for you.",
    "I have been collecting hellos. The jar is getting full.",
    "One small pat would make this whole day better."
  ],
  cozy: [
    "I am quietly here with you.",
    "This spot feels soft today.",
    "I like this little rhythm.",
    "Everything is in its small right place.",
    "Today is a good day for tiny things."
  ]
};

const criticalNeedLines: Partial<Record<PetStatusNeed, readonly string[]>> = {
  fullness: [
    "My tummy is very serious right now. Bowl, please.",
    "I am running on one crumb of energy. Food would help a lot.",
    "Bowl emergency. Small but urgent.",
    "I keep thinking about food. Only food. Just food.",
    "My belly sent an official request for dinner."
  ],
  thirst: [
    "My bowl is very empty. A big refill would save the day.",
    "I am quite thirsty right now. A big sip, please.",
    "Tiny water emergency. My bowl needs a refill.",
    "My tongue is asking for you and a full water bowl."
  ],
  mood: [
    "Today feels a little gray inside. Stay close?",
    "My tail forgot how to wiggle. A tiny game might remind it.",
    "I am doing small sighs. Play would fix most of them.",
    "I could really use one of our games right now."
  ],
  energy: [
    "My paws say no more steps today. Rest, please.",
    "Battery very low. Cushion required.",
    "I am in extra-slow mode. Even blinking feels big.",
    "Everything is heavy. A long quiet rest would help."
  ],
  clean: [
    "I am mostly dust bunny right now. A bath would help.",
    "I rolled somewhere I should not have. Please send help.",
    "My fur gave up on itself. Freshen-up time.",
    "I left tiny smudges everywhere. Sorry. Bath, please."
  ],
  attention: [
    "I have been saving hellos for a long time now.",
    "One gentle pet would fix almost everything today.",
    "I keep looking at where you usually appear.",
    "It has felt quiet. I am glad you are looking at me now."
  ]
};

const getNeedLinesForBand = (need: PetStatusNeed, band: CareStatBand): readonly string[] => {
  if (band === "critical") {
    return criticalNeedLines[need] ?? urgentNeedLines[need];
  }

  return urgentNeedLines[need];
};

const weatherTimeLines: Record<WeatherCondition, readonly string[]> = {
  clear: [
    "Sunlight is moving slowly across our little spot.",
    "The bright sky makes everything feel newly placed.",
    "{time} light is sitting right beside me.",
    "I found the warmest patch of sun and claimed it.",
    "Blue sky day. The garden looks extra proud."
  ],
  partly_cloudy: [
    "A cloud shadow crossed the tiny path.",
    "The sky keeps changing its mind in a nice way.",
    "Soft clouds made this place feel quieter."
  ],
  cloudy: [
    "Today feels cloudy in the soft way.",
    "The sky is muted, so I am keeping things gentle.",
    "Cloudy {time} makes this little home feel tucked in."
  ],
  rain: [
    "It smells like rain. I will stay cozy inside.",
    "Rain makes the tiny path sound sleepy.",
    "The rainy air makes your hello feel warmer.",
    "I am watching raindrops race down the glass.",
    "Rainy days are for staying close. I approve."
  ],
  storm: [
    "Outside is noisy, but this little place feels safe.",
    "I am listening to the storm from somewhere cozy.",
    "Stormy {time} means extra-soft mode."
  ],
  snow: [
    "Snowlight settled softly near our little home.",
    "The snowy quiet makes me want to stay close.",
    "Cold sparkle day. I am keeping warm."
  ],
  fog: [
    "The fog made our little spot feel secret.",
    "Misty air is good for quiet watching.",
    "I can see just enough to find you."
  ],
  wind: [
    "The wind carried one tiny leaf past us.",
    "Windy {time} makes my ears pay attention.",
    "Something small just danced by in the breeze."
  ],
  hot: [
    "The warm sun makes water sound extra nice.",
    "Warm day. I am keeping my paws in slow mode.",
    "The light is strong, so I am staying close to shade."
  ],
  cold: [
    "It is chilly today. Staying close feels warmer.",
    "Cold air makes this little home feel softer.",
    "Chilly {time}. I am choosing cozy mode."
  ]
};

const chatFallbackLines: readonly string[] = [
  "I am here with you.",
  "I am listening from my tiny spot.",
  "This little place feels better when you check in.",
  "Take your time. I am not going anywhere.",
  "Whatever kind of day it was, I am glad you came.",
  "You can just sit here with me. That counts too."
];

const homeFallbackLines: readonly string[] = [
  "I am quietly here with you.",
  "This little place feels cozy right now.",
  "I found a soft spot and saved it.",
  "I rearranged one pebble today. Big work.",
  "The garden and I were just thinking about you.",
  "Nothing urgent. Just happy you are here."
];

export const selectPetStatusLine = (input: PetStatusLineInput): PetStatusLinePresentation => {
  const surface = input.surface ?? "home";
  const weather = getWeather(input.weather);
  const nowDate = getTime(input.now);
  const timeBucket = getTimeBucket(nowDate);
  const seed = [
    input.petName,
    surface,
    seedTimeKey(input.now),
    seedBandKey(input.careState),
    weather.condition,
    weather.intensity,
    input.recentAction ?? "ambient",
    input.satisfactionSummary?.primaryNeed ?? "none",
    input.careState?.updatedAt ?? ""
  ];

  if ((input.daysAway ?? 0) >= 4) {
    const line = fillPlaceholders(chooseLine(returnLines.long, seed), input, weather, timeBucket);

    return {
      need: "attention",
      line,
      accessibilityLabel: line,
      source: "return",
      timeBucket,
      weatherCondition: weather.condition
    };
  }

  if ((input.daysAway ?? 0) >= 1) {
    const line = fillPlaceholders(chooseLine(returnLines.soft, seed), input, weather, timeBucket);

    return {
      need: "attention",
      line,
      accessibilityLabel: line,
      source: "return",
      timeBucket,
      weatherCondition: weather.condition
    };
  }

  if (input.recentAction) {
    const need = input.recentAction === "water_garden" ? "thirst" : input.recentAction === "feed" ? "fullness" : input.recentAction === "rest" ? "energy" : input.recentAction === "clean" ? "clean" : input.recentAction === "affection" || input.recentAction === "talk" ? "attention" : "mood";
    const line = fillPlaceholders(chooseLine(actionLines[input.recentAction], seed), input, weather, timeBucket);

    return {
      need,
      line,
      accessibilityLabel: line,
      source: "recent_action",
      timeBucket,
      weatherCondition: weather.condition
    };
  }

  const primaryNeed = getPrimaryNeed(input.careState, input.satisfactionSummary);

  if (primaryNeed) {
    const needBand = getCareStatBand(primaryNeed.value);
    const line = fillPlaceholders(chooseLine(getNeedLinesForBand(primaryNeed.need, needBand), seed), input, weather, timeBucket);

    return {
      need: primaryNeed.need,
      line,
      accessibilityLabel: `${line} ${input.satisfactionSummary?.hint ?? ""}`.trim(),
      source: "urgent_need",
      timeBucket,
      weatherCondition: weather.condition,
      needBand
    };
  }

  if (weather.condition !== "clear" || timeBucket === "morning" || timeBucket === "evening" || timeBucket === "night") {
    const line = fillPlaceholders(chooseLine(weatherTimeLines[weather.condition], seed), input, weather, timeBucket);

    return {
      need: "cozy",
      line,
      accessibilityLabel: line,
      source: "weather_time",
      timeBucket,
      weatherCondition: weather.condition
    };
  }

  if (input.reaction?.line) {
    return {
      need: "cozy",
      line: input.reaction.line,
      accessibilityLabel: input.reaction.line,
      source: "reaction",
      timeBucket,
      weatherCondition: weather.condition
    };
  }

  const fallbackLines = surface === "chat" ? chatFallbackLines : homeFallbackLines;
  const line = fillPlaceholders(chooseLine(fallbackLines, seed), input, weather, timeBucket);

  return {
    need: "cozy",
    line,
    accessibilityLabel: line,
    source: "fallback",
    timeBucket,
    weatherCondition: weather.condition
  };
};
