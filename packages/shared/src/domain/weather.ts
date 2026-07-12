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

const approximateWeatherRegionLabelByLocale: Record<Locale, string> = {
  "en-US": "Approximate local weather",
  "ko-KR": "대략적인 현지 날씨",
  "ja-JP": "おおよその現地の天気",
  "zh-TW": "大約的當地天氣",
  "de-DE": "Ungefähres lokales Wetter",
  "fr-FR": "Météo locale approximative",
  "pt-BR": "Clima local aproximado",
  "es-MX": "Clima local aproximado"
};

// allow: SIZE_OK — exhaustive localized weather copy is an indivisible typed data table.
const labelsByLocale: Record<Locale, Record<WeatherCondition, string>> = {
  "en-US": {
    clear: "Clear",
    partly_cloudy: "Partly cloudy",
    cloudy: "Cloudy",
    rain: "Rain",
    storm: "Storm",
    snow: "Snow",
    fog: "Fog",
    wind: "Wind",
    hot: "Warm",
    cold: "Cold"
  },
  "ko-KR": {
    clear: "맑음",
    partly_cloudy: "구름 조금",
    cloudy: "흐림",
    rain: "비",
    storm: "소나기",
    snow: "눈",
    fog: "안개",
    wind: "바람",
    hot: "더움",
    cold: "추움"
  },
  "ja-JP": {
    clear: "晴れ",
    partly_cloudy: "晴れ時々くもり",
    cloudy: "くもり",
    rain: "雨",
    storm: "嵐",
    snow: "雪",
    fog: "霧",
    wind: "風",
    hot: "暑い",
    cold: "寒い"
  },
  "zh-TW": {
    clear: "晴朗",
    partly_cloudy: "局部多雲",
    cloudy: "陰天",
    rain: "下雨",
    storm: "暴風雨",
    snow: "下雪",
    fog: "霧",
    wind: "風",
    hot: "炎熱",
    cold: "寒冷"
  },
  "de-DE": {
    clear: "Klar",
    partly_cloudy: "Teilweise bewölkt",
    cloudy: "Bewölkt",
    rain: "Regen",
    storm: "Sturm",
    snow: "Schnee",
    fog: "Nebel",
    wind: "Wind",
    hot: "Heiß",
    cold: "Kalt"
  },
  "fr-FR": {
    clear: "Dégagé",
    partly_cloudy: "Partiellement nuageux",
    cloudy: "Nuageux",
    rain: "Pluie",
    storm: "Orage",
    snow: "Neige",
    fog: "Brouillard",
    wind: "Vent",
    hot: "Chaud",
    cold: "Froid"
  },
  "pt-BR": {
    clear: "Céu limpo",
    partly_cloudy: "Parcialmente nublado",
    cloudy: "Nublado",
    rain: "Chuva",
    storm: "Tempestade",
    snow: "Neve",
    fog: "Neblina",
    wind: "Vento",
    hot: "Quente",
    cold: "Frio"
  },
  "es-MX": {
    clear: "Despejado",
    partly_cloudy: "Parcialmente nublado",
    cloudy: "Nublado",
    rain: "Lluvia",
    storm: "Tormenta",
    snow: "Nieve",
    fog: "Niebla",
    wind: "Viento",
    hot: "Calor",
    cold: "Frío"
  }
};

const linesByLocale: Record<Locale, Record<WeatherCondition, string>> = {
  "en-US": {
    clear: "Sunlight is moving slowly across the garden.",
    partly_cloudy: "A cloud shadow crossed the tiny path.",
    cloudy: "The garden feels softly cloudy today.",
    rain: "It smells like rain. I'll keep this spot cozy.",
    storm: "Outside is noisy, but this little place is safe.",
    snow: "Snowlight settled softly at the garden edge.",
    fog: "Fog made the garden feel a little secret.",
    wind: "The wind carried one tiny leaf past us.",
    hot: "The sun is strong. The leaves are talking about water.",
    cold: "It's chilly today. Staying close feels warmer."
  },
  "ko-KR": {
    clear: "정원 위로 햇빛이 천천히 지나가.",
    partly_cloudy: "구름 그림자가 작은 길 위를 지나갔어.",
    cloudy: "오늘 정원은 부드러운 흐림 모드야.",
    rain: "비 냄새가 나. 안쪽은 더 포근하게 해둘게.",
    storm: "밖은 조금 요란해도 여긴 안전하고 따뜻해.",
    snow: "눈빛이 정원 끝에 살짝 내려앉았어.",
    fog: "안개가 와서 정원이 비밀스러워졌어.",
    wind: "바람이 작은 잎을 데리고 지나갔어.",
    hot: "햇빛이 강해. 잎사귀들이 물 이야기를 해.",
    cold: "차가운 날이야. 가까이 있으면 더 따뜻해."
  },
  "ja-JP": {
    clear: "陽ざしが庭をゆっくり通り過ぎているよ。",
    partly_cloudy: "雲の影が小さな道を横切ったよ。",
    cloudy: "今日の庭はやわらかなくもり空だよ。",
    rain: "雨の匂いがするね。ここはもっと心地よくしておくよ。",
    storm: "外は少しにぎやかでも、ここは安全であたたかいよ。",
    snow: "雪の光が庭の端にそっと降りたよ。",
    fog: "霧が来て、庭が少し秘密めいた場所になったよ。",
    wind: "風が小さな葉っぱを一枚、連れていったよ。",
    hot: "陽ざしが強いね。葉っぱたちがお水の話をしているよ。",
    cold: "今日は寒いね。そばにいるともっとあたたかいよ。"
  },
  "zh-TW": {
    clear: "陽光正慢慢地走過花園。",
    partly_cloudy: "一片雲影掠過了小路。",
    cloudy: "今天的花園有種柔柔的陰天氣息。",
    rain: "聞得到雨的味道。我會讓這裡更舒適。",
    storm: "外面有點吵，但這個小地方安全又溫暖。",
    snow: "雪光輕輕落在花園邊緣。",
    fog: "霧來了，花園變得有點神祕。",
    wind: "風帶著一片小葉子從我們身邊走過。",
    hot: "陽光很強。葉子們正在聊水的事。",
    cold: "今天很冷。靠近一點就更溫暖。"
  },
  "de-DE": {
    clear: "Das Sonnenlicht wandert langsam durch den Garten.",
    partly_cloudy: "Ein Wolkenschatten zog über den kleinen Weg.",
    cloudy: "Der Garten fühlt sich heute sanft bewölkt an.",
    rain: "Es riecht nach Regen. Ich halte diesen Platz gemütlich.",
    storm: "Draußen ist es laut, aber dieser kleine Ort ist sicher und warm.",
    snow: "Schneelicht hat sich sanft am Gartenrand niedergelassen.",
    fog: "Der Nebel lässt den Garten ein wenig geheimnisvoll wirken.",
    wind: "Der Wind trug ein kleines Blatt an uns vorbei.",
    hot: "Die Sonne ist stark. Die Blätter reden über Wasser.",
    cold: "Heute ist es kühl. Nähe fühlt sich wärmer an."
  },
  "fr-FR": {
    clear: "La lumière du soleil traverse doucement le jardin.",
    partly_cloudy: "L'ombre d'un nuage a traversé le petit chemin.",
    cloudy: "Le jardin semble doucement nuageux aujourd'hui.",
    rain: "Ça sent la pluie. Je vais garder cet endroit bien douillet.",
    storm: "Dehors, c'est bruyant, mais ce petit endroit est sûr et chaleureux.",
    snow: "La lumière de la neige s'est posée doucement au bord du jardin.",
    fog: "Le brouillard a donné au jardin un petit air secret.",
    wind: "Le vent a emporté une petite feuille devant nous.",
    hot: "Le soleil tape fort. Les feuilles parlent d'eau.",
    cold: "Il fait froid aujourd'hui. Rester près l'un de l'autre réchauffe."
  },
  "pt-BR": {
    clear: "A luz do sol está passeando devagar pelo jardim.",
    partly_cloudy: "A sombra de uma nuvem atravessou o caminho pequeno.",
    cloudy: "O jardim está com um clima suavemente nublado hoje.",
    rain: "Tem cheirinho de chuva. Vou deixar este cantinho aconchegante.",
    storm: "Lá fora está barulhento, mas este cantinho é seguro e quentinho.",
    snow: "A luz da neve pousou suavemente na beira do jardim.",
    fog: "A neblina deixou o jardim um pouquinho misterioso.",
    wind: "O vento levou uma folhinha bem diante de nós.",
    hot: "O sol está forte. As folhas estão falando de água.",
    cold: "Hoje está frio. Ficar pertinho deixa tudo mais quentinho."
  },
  "es-MX": {
    clear: "La luz del sol avanza lentamente por el jardín.",
    partly_cloudy: "La sombra de una nube cruzó el caminito.",
    cloudy: "Hoy el jardín se siente suavemente nublado.",
    rain: "Huele a lluvia. Mantendré este rincón acogedor.",
    storm: "Afuera hay ruido, pero este rinconcito es seguro y cálido.",
    snow: "La luz de la nieve se posó suavemente al borde del jardín.",
    fog: "La niebla hizo que el jardín se sintiera un poco secreto.",
    wind: "El viento llevó una hojita frente a nosotros.",
    hot: "El sol está fuerte. Las hojas están hablando de agua.",
    cold: "Hoy hace frío. Estar cerquita se siente más cálido."
  }
};

interface WeatherPresentationLocaleCopy {
  readonly defaultSource: string;
  readonly approximateSource: string;
  readonly localSource: string;
  readonly accessibilityLabel: (label: string, source: string, shortLine: string) => string;
}

const presentationCopyByLocale: Record<Locale, WeatherPresentationLocaleCopy> = {
  "en-US": {
    defaultSource: "default garden weather",
    approximateSource: "approximate local weather",
    localSource: "local weather",
    accessibilityLabel: (label, source, shortLine) => `${label} scene using ${source}. ${shortLine}`
  },
  "ko-KR": {
    defaultSource: "기본 정원 날씨",
    approximateSource: "대략적인 현지 날씨",
    localSource: "현지 날씨",
    accessibilityLabel: (label, source, shortLine) => `${source} 기준 ${label} 장면. ${shortLine}`
  },
  "ja-JP": {
    defaultSource: "庭の標準天気",
    approximateSource: "おおよその現地の天気",
    localSource: "現地の天気",
    accessibilityLabel: (label, source, shortLine) => `${source}に基づく${label}の風景。${shortLine}`
  },
  "zh-TW": {
    defaultSource: "預設花園天氣",
    approximateSource: "大約的當地天氣",
    localSource: "當地天氣",
    accessibilityLabel: (label, source, shortLine) => `${source}的${label}場景。${shortLine}`
  },
  "de-DE": {
    defaultSource: "Standardwetter im Garten",
    approximateSource: "ungefähres lokales Wetter",
    localSource: "lokales Wetter",
    accessibilityLabel: (label, source, shortLine) => `Wetterszene: ${label}, Quelle: ${source}. ${shortLine}`
  },
  "fr-FR": {
    defaultSource: "météo par défaut du jardin",
    approximateSource: "météo locale approximative",
    localSource: "météo locale",
    accessibilityLabel: (label, source, shortLine) => `Scène météo : ${label}, source : ${source}. ${shortLine}`
  },
  "pt-BR": {
    defaultSource: "clima padrão do jardim",
    approximateSource: "clima local aproximado",
    localSource: "clima local",
    accessibilityLabel: (label, source, shortLine) => `Cena do clima: ${label}, fonte: ${source}. ${shortLine}`
  },
  "es-MX": {
    defaultSource: "clima predeterminado del jardín",
    approximateSource: "clima local aproximado",
    localSource: "clima local",
    accessibilityLabel: (label, source, shortLine) => `Escena del clima: ${label}, fuente: ${source}. ${shortLine}`
  }
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
    locale?: Locale;
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
    regionLabel: options.regionLabel ?? approximateWeatherRegionLabelByLocale[options.locale ?? "en-US"]
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
  return labelsByLocale[locale][weather.condition];
};

export const getWeatherScenePresentation = (
  surface: WeatherSurface,
  weather: WeatherContext = defaultWeatherContext,
  locale: Locale = "en-US"
): WeatherScenePresentation => {
  const label = getWeatherConditionLabel(weather, locale);
  const shortLine = linesByLocale[locale][weather.condition];
  const copy = presentationCopyByLocale[locale];
  const source =
    weather.source === "fallback"
      ? copy.defaultSource
      : weather.regionLabel === "Approximate local weather"
        ? copy.approximateSource
        : weather.regionLabel ?? copy.localSource;

  return {
    backgroundKey: getWeatherBackgroundKey(surface, weather),
    overlayKey: getWeatherOverlayKey(weather),
    label,
    shortLine,
    accessibilityLabel: copy.accessibilityLabel(label, source, shortLine)
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
