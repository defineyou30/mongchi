import type { ISODateTime } from "./common";
import type { WeatherCondition } from "./weather";

/**
 * Walk collectibles: tiny discoveries the pet brings home from walks, keyed to
 * the weather it walked in. Completing the collection is the free-player
 * long-term goal; rarity comes from weather variety, not paywalls.
 */
export interface WalkCollectible {
  id: string;
  nameEn: string;
  nameKo: string;
  flavorEn: string;
  flavorKo: string;
  emoji: string;
  rarity: "common" | "rare";
  /** Weather conditions in which this collectible can be found. Empty = any. */
  weather: WeatherCondition[];
}

export const walkCollectibles: WalkCollectible[] = [
  {
    id: "col_sunny_petal",
    nameEn: "Sunny Petal",
    nameKo: "햇살 꽃잎",
    flavorEn: "A petal that soaked up a whole morning of sun.",
    flavorKo: "아침 햇살을 가득 머금은 꽃잎이야.",
    emoji: "🌸",
    rarity: "common",
    weather: ["clear", "hot"]
  },
  {
    id: "col_smooth_pebble",
    nameEn: "Smooth Pebble",
    nameKo: "동글 조약돌",
    flavorEn: "Perfectly round. Clearly inspected by many paws.",
    flavorKo: "완벽하게 동그래. 많은 발바닥이 검사한 게 분명해.",
    emoji: "🪨",
    rarity: "common",
    weather: ["clear", "partly_cloudy", "cloudy"]
  },
  {
    id: "col_rain_bead",
    nameEn: "Rain Bead",
    nameKo: "빗방울 구슬",
    flavorEn: "A raindrop that forgot to fall all the way.",
    flavorKo: "끝까지 떨어지는 걸 깜빡한 빗방울이야.",
    emoji: "💧",
    rarity: "common",
    weather: ["rain", "storm"]
  },
  {
    id: "col_shiny_leaf",
    nameEn: "Shiny Leaf",
    nameKo: "반짝 잎사귀",
    flavorEn: "Rain-polished until it turned into a tiny mirror.",
    flavorKo: "비에 씻겨서 작은 거울이 된 잎사귀야.",
    emoji: "🍃",
    rarity: "common",
    weather: ["rain", "storm", "fog"]
  },
  {
    id: "col_frost_sparkle",
    nameEn: "Frost Sparkle",
    nameKo: "서리 조각",
    flavorEn: "A cold little star that landed on the path.",
    flavorKo: "길 위에 내려앉은 차가운 작은 별이야.",
    emoji: "❄️",
    rarity: "common",
    weather: ["snow", "cold"]
  },
  {
    id: "col_wind_ribbon",
    nameEn: "Wind Ribbon",
    nameKo: "바람 리본",
    flavorEn: "It followed the pet home and decided to stay.",
    flavorKo: "집까지 따라오더니 눌러앉기로 했대.",
    emoji: "🎀",
    rarity: "common",
    weather: ["wind"]
  },
  {
    id: "col_warm_seed",
    nameEn: "Warm Seed",
    nameKo: "햇볕 씨앗",
    flavorEn: "Still warm from the sunniest spot on the path.",
    flavorKo: "길에서 제일 따뜻한 자리에 있다가 와서 아직 따끈해.",
    emoji: "🌰",
    rarity: "common",
    weather: ["hot", "clear"]
  },
  {
    id: "col_mist_feather",
    nameEn: "Mist Feather",
    nameKo: "안개 깃털",
    flavorEn: "So light it might just be fog holding a shape.",
    flavorKo: "너무 가벼워서 안개가 모양을 흉내 낸 걸지도 몰라.",
    emoji: "🪶",
    rarity: "common",
    weather: ["fog", "cloudy", "partly_cloudy"]
  },
  {
    id: "col_rainbow_shard",
    nameEn: "Rainbow Shard",
    nameKo: "무지개 조각",
    flavorEn: "A once-in-a-while find. The path was showing off.",
    flavorKo: "아주 가끔만 나오는 발견이야. 오늘 길이 자랑하고 싶었나 봐.",
    emoji: "🌈",
    rarity: "rare",
    weather: []
  }
];

export interface WalkCollectionEntry {
  count: number;
  firstFoundAt: ISODateTime;
}

export type WalkCollectionState = Record<string, WalkCollectionEntry>;

export const WALK_COLLECTION_COMPLETE_CREDITS = 20;

const RARE_ROLL_PERCENT = 8;

const hashSeed = (value: string): number => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash);
};

/**
 * Deterministically rolls the collectible found on a walk from the walk id and
 * the weather it happened in — stable across refreshes, varied across walks.
 */
export const rollWalkCollectible = (weatherCondition: WeatherCondition, seed: string): WalkCollectible => {
  const roll = hashSeed(seed);
  const rare = walkCollectibles.find((collectible) => collectible.rarity === "rare");

  if (rare && roll % 100 < RARE_ROLL_PERCENT) {
    return rare;
  }

  const candidates = walkCollectibles.filter(
    (collectible) => collectible.rarity === "common" && (collectible.weather.length === 0 || collectible.weather.includes(weatherCondition))
  );
  const pool = candidates.length > 0 ? candidates : walkCollectibles.filter((collectible) => collectible.rarity === "common");

  return pool[roll % pool.length] ?? walkCollectibles[0]!;
};

export const addToWalkCollection = (
  collection: WalkCollectionState,
  collectibleId: string,
  now: ISODateTime
): { collection: WalkCollectionState; isNew: boolean } => {
  const existing = collection[collectibleId];

  return {
    collection: {
      ...collection,
      [collectibleId]: existing
        ? { ...existing, count: existing.count + 1 }
        : { count: 1, firstFoundAt: now }
    },
    isNew: !existing
  };
};

export const isWalkCollectionComplete = (collection: WalkCollectionState): boolean =>
  walkCollectibles.every((collectible) => (collection[collectible.id]?.count ?? 0) > 0);

export const getWalkCollectibleById = (collectibleId: string): WalkCollectible | null =>
  walkCollectibles.find((collectible) => collectible.id === collectibleId) ?? null;

export const getWalkCollectionProgress = (collection: WalkCollectionState): { found: number; total: number } => ({
  found: walkCollectibles.filter((collectible) => (collection[collectible.id]?.count ?? 0) > 0).length,
  total: walkCollectibles.length
});
