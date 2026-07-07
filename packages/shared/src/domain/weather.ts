import type { ISODateTime, Locale } from "./common";

export type WeatherSource = "device_location" | "manual_city" | "cached" | "fallback";

export type WeatherCondition =
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

export type WeatherIntensity = "light" | "normal" | "heavy";

export type WeatherSurface = "home" | "chat" | "walk";

export type WeatherOverlayKey = "none" | "rain" | "storm" | "snow" | "fog" | "leaves" | "night" | "heat";

export type WeatherBackgroundKey =
  | "home-garden-clear"
  | "home-garden-cloudy"
  | "home-garden-rain"
  | "home-garden-rain-cozy"
  | "home-garden-winter"
  | "home-garden-fog"
  | "home-garden-clear-leaves"
  | "home-garden-sunny"
  | "home-garden-winter-soft"
  | "home-garden-night"
  | "chat-garden-clear"
  | "chat-garden-rain"
  | "chat-garden-winter"
  | "chat-garden-night"
  | "walk-path-clear"
  | "walk-path-rain"
  | "walk-path-snow"
  | "walk-path-wind";

export interface WeatherContext {
  source: WeatherSource;
  condition: WeatherCondition;
  intensity: WeatherIntensity;
  isDaytime: boolean;
  fetchedAt: ISODateTime;
  temperatureC?: number;
  regionLabel?: string;
}

export interface WeatherSettings {
  enabled: boolean;
  useApproximateLocation: boolean;
  manualCity?: string;
  lastExplainedAt?: ISODateTime;
}

export interface WeatherScenePresentation {
  backgroundKey: WeatherBackgroundKey;
  overlayKey: WeatherOverlayKey;
  label: string;
  shortLine: string;
  accessibilityLabel: string;
}

export interface ApproximateWeatherCoordinates {
  approximateLatitude: number;
  approximateLongitude: number;
}

export const WEATHER_COORDINATE_PRECISION_DECIMALS = 1;
export const WEATHER_CACHE_TTL_MS = 30 * 60 * 1000;

const fallbackFetchedAt = "2026-06-24T09:00:00.000Z";

export const defaultWeatherContext: WeatherContext = {
  source: "fallback",
  condition: "clear",
  intensity: "normal",
  isDaytime: true,
  fetchedAt: fallbackFetchedAt,
  temperatureC: 22,
  regionLabel: "Tiny Garden"
};

export const defaultWeatherSettings: WeatherSettings = {
  enabled: false,
  useApproximateLocation: false
};

const labelsByCondition: Record<WeatherCondition, { ko: string; en: string }> = {
  clear: { ko: "맑음", en: "Clear" },
  partly_cloudy: { ko: "구름 조금", en: "Partly cloudy" },
  cloudy: { ko: "흐림", en: "Cloudy" },
  rain: { ko: "비", en: "Rain" },
  storm: { ko: "소나기", en: "Storm" },
  snow: { ko: "눈", en: "Snow" },
  fog: { ko: "안개", en: "Fog" },
  wind: { ko: "바람", en: "Wind" },
  hot: { ko: "더움", en: "Warm" },
  cold: { ko: "추움", en: "Cold" }
};

const lineByCondition: Record<WeatherCondition, { ko: string; en: string }> = {
  clear: { ko: "정원 위로 햇빛이 천천히 지나가.", en: "Sunlight is moving slowly across the garden." },
  partly_cloudy: { ko: "구름 그림자가 작은 길 위를 지나갔어.", en: "A cloud shadow crossed the tiny path." },
  cloudy: { ko: "오늘 정원은 부드러운 흐림 모드야.", en: "The garden feels softly cloudy today." },
  rain: { ko: "비 냄새가 나. 안쪽은 더 포근하게 해둘게.", en: "It smells like rain. I'll keep this spot cozy." },
  storm: { ko: "밖은 조금 요란해도 여긴 안전하고 따뜻해.", en: "Outside is noisy, but this little place is safe." },
  snow: { ko: "눈빛이 정원 끝에 살짝 내려앉았어.", en: "Snowlight settled softly at the garden edge." },
  fog: { ko: "안개가 와서 정원이 비밀스러워졌어.", en: "Fog made the garden feel a little secret." },
  wind: { ko: "바람이 작은 잎을 데리고 지나갔어.", en: "The wind carried one tiny leaf past us." },
  hot: { ko: "햇빛이 강해. 잎사귀들이 물 이야기를 해.", en: "The sun is strong. The leaves are talking about water." },
  cold: { ko: "차가운 날이야. 가까이 있으면 더 따뜻해.", en: "It's chilly today. Staying close feels warmer." }
};

const homeBackgroundByWeather: Record<WeatherCondition, WeatherBackgroundKey> = {
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
};

const chatBackgroundByWeather: Record<WeatherCondition, WeatherBackgroundKey> = {
  clear: "chat-garden-clear",
  partly_cloudy: "chat-garden-clear",
  cloudy: "chat-garden-clear",
  rain: "chat-garden-rain",
  storm: "chat-garden-rain",
  snow: "chat-garden-winter",
  fog: "chat-garden-clear",
  wind: "chat-garden-clear",
  hot: "chat-garden-clear",
  cold: "chat-garden-winter"
};

const walkBackgroundByWeather: Record<WeatherCondition, WeatherBackgroundKey> = {
  clear: "walk-path-clear",
  partly_cloudy: "walk-path-clear",
  cloudy: "walk-path-clear",
  rain: "walk-path-rain",
  storm: "walk-path-rain",
  snow: "walk-path-snow",
  fog: "walk-path-clear",
  wind: "walk-path-wind",
  hot: "walk-path-clear",
  cold: "walk-path-snow"
};

const approximateWeatherConditions: WeatherCondition[] = [
  "clear",
  "partly_cloudy",
  "cloudy",
  "rain",
  "wind",
  "fog",
  "hot",
  "cold",
  "snow"
];

const temperatureByCondition: Record<WeatherCondition, number> = {
  clear: 23,
  partly_cloudy: 21,
  cloudy: 19,
  rain: 17,
  storm: 18,
  snow: -2,
  fog: 12,
  wind: 15,
  hot: 31,
  cold: 3
};

export const roundWeatherCoordinate = (value: number): number => {
  const factor = 10 ** WEATHER_COORDINATE_PRECISION_DECIMALS;

  return Math.round(value * factor) / factor;
};

export const normalizeApproximateWeatherCoordinates = (
  latitude: number,
  longitude: number
): ApproximateWeatherCoordinates | null => {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  return {
    approximateLatitude: roundWeatherCoordinate(latitude),
    approximateLongitude: roundWeatherCoordinate(longitude)
  };
};

export const getWeatherLookupCacheKey = (coordinates: ApproximateWeatherCoordinates): string =>
  `weather:${coordinates.approximateLatitude.toFixed(WEATHER_COORDINATE_PRECISION_DECIMALS)}:${coordinates.approximateLongitude.toFixed(
    WEATHER_COORDINATE_PRECISION_DECIMALS
  )}`;

/**
 * Stable per calendar day (UTC), so the seed below only moves when the day rolls over
 * rather than on every call. Keeping this to a plain YYYY-MM-DD hash (rather than reading
 * the clock directly) keeps createApproximateLocationWeatherContext a pure function of its
 * `now` argument, consistent with the rest of this module's "inject now" convention.
 */
const getDaySeedComponent = (now: ISODateTime): number => {
  const isoDay = new Date(now).toISOString().slice(0, 10); // "YYYY-MM-DD"
  let hash = 0;

  for (let index = 0; index < isoDay.length; index += 1) {
    hash = (hash * 33 + isoDay.charCodeAt(index)) | 0;
  }

  return Math.abs(hash);
};

export const createApproximateLocationWeatherContext = (
  coordinates: ApproximateWeatherCoordinates,
  now: ISODateTime,
  options: {
    source?: WeatherSource;
    regionLabel?: string;
  } = {}
): WeatherContext => {
  const locationSeed = Math.round(coordinates.approximateLatitude * 10) * 31 + Math.round(coordinates.approximateLongitude * 10) * 17;
  const seed = Math.abs(locationSeed + getDaySeedComponent(now));
  const condition = approximateWeatherConditions[seed % approximateWeatherConditions.length] ?? "clear";
  const localHour = (new Date(now).getUTCHours() + Math.round(coordinates.approximateLongitude / 15) + 24) % 24;

  return {
    source: options.source ?? "device_location",
    condition,
    intensity: seed % 5 === 0 ? "heavy" : seed % 3 === 0 ? "light" : "normal",
    isDaytime: localHour >= 6 && localHour < 20,
    fetchedAt: now,
    temperatureC: temperatureByCondition[condition],
    regionLabel: options.regionLabel ?? "Approximate local weather"
  };
};

export const getWeatherBackgroundKey = (surface: WeatherSurface, weather: WeatherContext = defaultWeatherContext): WeatherBackgroundKey => {
  if (!weather.isDaytime && surface === "home" && weather.condition === "clear") {
    return "home-garden-night";
  }

  if (!weather.isDaytime && surface === "chat" && weather.condition === "clear") {
    return "chat-garden-night";
  }

  switch (surface) {
    case "chat":
      return chatBackgroundByWeather[weather.condition];
    case "walk":
      return walkBackgroundByWeather[weather.condition];
    case "home":
    default:
      return homeBackgroundByWeather[weather.condition];
  }
};

export const getWeatherOverlayKey = (weather: WeatherContext = defaultWeatherContext): WeatherOverlayKey => {
  if (!weather.isDaytime && weather.condition === "clear") {
    return "night";
  }

  switch (weather.condition) {
    case "rain":
      return "rain";
    case "storm":
      return "storm";
    case "snow":
      return "snow";
    case "fog":
      return "fog";
    case "wind":
      return "leaves";
    case "hot":
      return "heat";
    default:
      return "none";
  }
};

export const getWeatherConditionLabel = (weather: WeatherContext, locale: Locale = "en-US"): string => {
  const labels = labelsByCondition[weather.condition];

  return locale === "ko-KR" ? labels.ko : labels.en;
};

export const getWeatherScenePresentation = (
  surface: WeatherSurface,
  weather: WeatherContext = defaultWeatherContext,
  locale: Locale = "en-US"
): WeatherScenePresentation => {
  const label = getWeatherConditionLabel(weather, locale);
  const lines = lineByCondition[weather.condition];
  const shortLine = locale === "ko-KR" ? lines.ko : lines.en;
  const source = weather.source === "fallback" ? "default garden weather" : weather.regionLabel ?? "local weather";

  return {
    backgroundKey: getWeatherBackgroundKey(surface, weather),
    overlayKey: getWeatherOverlayKey(weather),
    label,
    shortLine,
    accessibilityLabel: `${label} scene using ${source}. ${shortLine}`
  };
};

export const createManualWeatherContext = (
  condition: WeatherCondition,
  now: ISODateTime,
  options: {
    intensity?: WeatherIntensity;
    isDaytime?: boolean;
    temperatureC?: number;
    regionLabel?: string;
  } = {}
): WeatherContext => {
  const base: WeatherContext = {
    source: "manual_city",
    condition,
    intensity: options.intensity ?? "normal",
    isDaytime: options.isDaytime ?? true,
    fetchedAt: now
  };

  return {
    ...base,
    ...(options.temperatureC !== undefined ? { temperatureC: options.temperatureC } : {}),
    ...(options.regionLabel ? { regionLabel: options.regionLabel } : {})
  };
};
