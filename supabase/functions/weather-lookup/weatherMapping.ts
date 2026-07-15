// Pure mapping/validation logic for the weather-lookup Edge Function --
// extracted from index.ts so it's testable with `deno test` (no network, no
// SupabaseClient), mirroring chat-turn/{locale,freeAllowance,moderation}.ts
// and delete-account/deletionPlan.ts's split of pure logic from the HTTP
// handler.
//
// WeatherCondition below is a hand-duplicated copy of
// packages/shared/src/domain/weather.ts's WeatherCondition union. That npm
// workspace package cannot be imported into this Deno Edge Function (separate
// runtime, no bundler step) -- see chat-turn/freeAllowance.ts's identical
// "duplicated on purpose, keep both in sync by hand" note. If you add/rename
// a WeatherCondition member in packages/shared/src/domain/weather.ts, update
// this union and mapWeatherCodeToCondition's exhaustive switch below too.
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

export type WeatherTemperatureBand = "cold" | "mild" | "hot";

// Hand-duplicated copy of packages/shared/src/domain/weather.ts's
// WeatherIntensity -- same "cannot import across the Deno/npm workspace
// boundary" reason as the WeatherCondition duplication above.
export type WeatherIntensity = "light" | "normal" | "heavy";

// ---------------------------------------------------------------------------
// Coordinate validation + rounding.
//
// Rounding to 1 decimal place (~11km at the equator) is the server-side half
// of "never store/return anything more precise than a rough neighborhood" --
// packages/shared/src/domain/weather.ts's WEATHER_COORDINATE_PRECISION_DECIMALS
// documents the same constant for the client-side rounding this mirrors. Both
// sides round independently (defense in depth): even if a caller sends
// full-precision coordinates, this function only ever forwards the rounded
// pair to Open-Meteo and only ever computes/returns weather derived from
// that rounded pair -- see index.ts's module doc comment for the "never
// logged, never persisted" guarantee this rounding supports.
// ---------------------------------------------------------------------------

const COORDINATE_PRECISION_DECIMALS = 1;

export const roundCoordinate = (value: number): number => {
  const factor = 10 ** COORDINATE_PRECISION_DECIMALS;

  return Math.round(value * factor) / factor;
};

export interface ValidatedCoordinates {
  latitude: number;
  longitude: number;
}

export const validateAndRoundCoordinates = (latitude: unknown, longitude: unknown): ValidatedCoordinates | null => {
  if (typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  return {
    latitude: roundCoordinate(latitude),
    longitude: roundCoordinate(longitude)
  };
};

// ---------------------------------------------------------------------------
// Open-Meteo weathercode -> app WeatherCondition mapping.
//
// Table follows Open-Meteo's documented WMO weather interpretation codes
// (https://open-meteo.com/en/docs -- "WMO Weather interpretation codes").
// Every code Open-Meteo documents is mapped explicitly; any other integer
// (a future code addition, or a transport glitch) falls back to "cloudy" per
// the "unknown code -> cloudy" guard below, never throws.
// ---------------------------------------------------------------------------

const weatherCodeToBaseCondition: Record<number, WeatherCondition> = {
  0: "clear", // Clear sky
  1: "clear", // Mainly clear
  2: "partly_cloudy", // Partly cloudy
  3: "cloudy", // Overcast
  45: "fog", // Fog
  48: "fog", // Depositing rime fog
  51: "rain", // Drizzle: light
  53: "rain", // Drizzle: moderate
  55: "rain", // Drizzle: dense
  56: "rain", // Freezing drizzle: light
  57: "rain", // Freezing drizzle: dense
  61: "rain", // Rain: slight
  63: "rain", // Rain: moderate
  65: "rain", // Rain: heavy
  66: "rain", // Freezing rain: light
  67: "rain", // Freezing rain: heavy
  71: "snow", // Snow fall: slight
  73: "snow", // Snow fall: moderate
  75: "snow", // Snow fall: heavy
  77: "snow", // Snow grains
  80: "rain", // Rain showers: slight
  81: "rain", // Rain showers: moderate
  82: "storm", // Rain showers: violent
  85: "snow", // Snow showers: slight
  86: "snow", // Snow showers: heavy
  95: "storm", // Thunderstorm: slight or moderate
  96: "storm", // Thunderstorm with slight hail
  99: "storm" // Thunderstorm with heavy hail
};

/** Unmapped/unrecognized weathercode values fall back to "cloudy" -- never throws, never blocks the response. */
export const mapWeatherCodeToBaseCondition = (weatherCode: number): WeatherCondition => weatherCodeToBaseCondition[weatherCode] ?? "cloudy";

// ---------------------------------------------------------------------------
// Weathercode -> WeatherIntensity.
//
// Several WMO codes distinguish light/moderate/heavy variants of the same
// precipitation (drizzle 51/53/55, rain 61/63/65, freezing rain 66/67, snow
// 71/73/75, rain showers 80/81/82, snow showers 85/86, thunderstorm severity
// 95 vs 96/99) -- mapWeatherCodeToBaseCondition above deliberately collapses
// all of those into a single condition ("rain"/"snow"/"storm") since
// WeatherCondition only carries one fact at a time, exactly like the
// synthetic packages/shared/src/domain/weather.ts generator. That intensity
// signal doesn't have to be thrown away, though: WeatherContext already has a
// separate `intensity` field for it (the synthetic generator fills it from a
// day/location hash). This table recovers the same signal from the real
// weathercode instead of discarding it, so anything gated on
// WeatherContext.intensity downstream (packages/shared/src/reactions/
// localReactionEngine.ts's weatherIntensity rule condition/scoring) can react
// to real weather exactly as it would to synthetic weather. Codes with no
// intensity variant (clear/cloudy/fog/etc) default to "normal", matching the
// synthetic generator's own most-common bucket.
// ---------------------------------------------------------------------------

const weatherCodeToIntensity: Record<number, WeatherIntensity> = {
  51: "light", // Drizzle: light
  53: "normal", // Drizzle: moderate
  55: "heavy", // Drizzle: dense
  56: "light", // Freezing drizzle: light
  57: "heavy", // Freezing drizzle: dense
  61: "light", // Rain: slight
  63: "normal", // Rain: moderate
  65: "heavy", // Rain: heavy
  66: "light", // Freezing rain: light
  67: "heavy", // Freezing rain: heavy
  71: "light", // Snow fall: slight
  73: "normal", // Snow fall: moderate
  75: "heavy", // Snow fall: heavy
  77: "light", // Snow grains
  80: "light", // Rain showers: slight
  81: "normal", // Rain showers: moderate
  82: "heavy", // Rain showers: violent
  85: "light", // Snow showers: slight
  86: "heavy", // Snow showers: heavy
  95: "heavy", // Thunderstorm: slight or moderate
  96: "heavy", // Thunderstorm with slight hail
  99: "heavy" // Thunderstorm with heavy hail
};

/** Codes with no documented intensity variant (clear/cloudy/fog/etc) fall back to "normal". */
export const mapWeatherCodeToIntensity = (weatherCode: number): WeatherIntensity => weatherCodeToIntensity[weatherCode] ?? "normal";

// ---------------------------------------------------------------------------
// Temperature banding + condition overrides.
//
// "hot"/"cold"/"wind" are conditions in the app's WeatherCondition union (see
// packages/shared/src/domain/weather.ts's approximateWeatherConditions and
// temperatureByCondition), but no Open-Meteo weathercode maps to them --
// weathercode alone only ever describes cloud/precipitation state. Real
// weather still needs to reach those three states (otherwise a genuinely hot,
// cold, or windy-but-clear day would never render as anything but plain
// "clear"/"cloudy"), so a "neutral" base condition (clear/partly_cloudy/
// cloudy -- i.e. nothing already visually dominant like rain/storm/snow/fog)
// is overridden by wind speed first, then temperature. Non-neutral base
// conditions are never overridden: a rainy 2°C day stays "rain", not "cold",
// since the rain is already the more salient single-value fact the app's
// WeatherCondition enum can carry.
// ---------------------------------------------------------------------------

/** Below this (inclusive), a neutral base condition is reported as "cold". */
export const COLD_TEMPERATURE_THRESHOLD_C = 5;
/** At/above this, a neutral base condition is reported as "hot". */
export const HOT_TEMPERATURE_THRESHOLD_C = 28;
/** At/above this wind speed (km/h, Open-Meteo's wind_speed_10m default unit), a neutral base condition is reported as "wind". Roughly Beaufort 6 ("strong breeze"). */
export const WIND_OVERRIDE_THRESHOLD_KMH = 40;

export const deriveTemperatureBand = (temperatureC: number): WeatherTemperatureBand => {
  if (temperatureC <= COLD_TEMPERATURE_THRESHOLD_C) {
    return "cold";
  }

  if (temperatureC >= HOT_TEMPERATURE_THRESHOLD_C) {
    return "hot";
  }

  return "mild";
};

const neutralConditions: ReadonlySet<WeatherCondition> = new Set(["clear", "partly_cloudy", "cloudy"]);

const applyConditionOverrides = (
  baseCondition: WeatherCondition,
  temperatureBand: WeatherTemperatureBand,
  windSpeedKmh: number
): WeatherCondition => {
  if (!neutralConditions.has(baseCondition)) {
    return baseCondition;
  }

  if (windSpeedKmh >= WIND_OVERRIDE_THRESHOLD_KMH) {
    return "wind";
  }

  if (temperatureBand === "hot") {
    return "hot";
  }

  if (temperatureBand === "cold") {
    return "cold";
  }

  return baseCondition;
};

// ---------------------------------------------------------------------------
// Full result assembly -- what index.ts returns to the client.
// ---------------------------------------------------------------------------

export interface OpenMeteoCurrentWeather {
  weatherCode: number;
  temperatureC: number;
  isDay: boolean;
  windSpeedKmh: number;
}

export interface WeatherLookupResult {
  condition: WeatherCondition;
  /** Always present -- see mapWeatherCodeToIntensity's doc comment; defaults to "normal" for codes with no intensity variant. */
  intensity: WeatherIntensity;
  temperatureBand?: WeatherTemperatureBand;
  isDaytime: boolean;
}

export const buildWeatherLookupResult = (current: OpenMeteoCurrentWeather): WeatherLookupResult => {
  const baseCondition = mapWeatherCodeToBaseCondition(current.weatherCode);
  const intensity = mapWeatherCodeToIntensity(current.weatherCode);

  if (!Number.isFinite(current.temperatureC)) {
    // No usable temperature reading -- report the weathercode-derived
    // condition/intensity as-is (no hot/cold/wind override) rather than
    // guessing.
    return { condition: baseCondition, intensity, isDaytime: current.isDay };
  }

  const temperatureBand = deriveTemperatureBand(current.temperatureC);
  const windSpeedKmh = Number.isFinite(current.windSpeedKmh) ? current.windSpeedKmh : 0;

  return {
    condition: applyConditionOverrides(baseCondition, temperatureBand, windSpeedKmh),
    intensity,
    temperatureBand,
    isDaytime: current.isDay
  };
};

// ---------------------------------------------------------------------------
// Per-user in-memory rate limit.
//
// Deliberately not backed by a DB table or Postgres RPC -- the task this
// function serves ("look up today's weather for one rough coordinate") is
// read-only and stores nothing, so a heavyweight persisted rate-limit
// infrastructure (like chat-turn's reserve_chat_turn) would be disproportionate.
// A sliding window kept in the Edge Function instance's own memory is enough
// to stop a buggy client from hammering Open-Meteo several times a second;
// it resets on cold start / a new instance, which is an acceptable
// (deliberately cheap) gap for a free, keyless, non-billed upstream.
// ---------------------------------------------------------------------------

export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_REQUESTS = 6;

export type RateLimitStore = Map<string, number[]>;

export const createRateLimitStore = (): RateLimitStore => new Map();

/**
 * Records a request attempt for `userId` at `nowMs` and reports whether it
 * exceeds the allowance. Pure with respect to its inputs (store is mutated,
 * but nowMs/window/max are all parameters) so it's testable without real
 * timers -- inject a fake clock and a fresh Map per test.
 */
export const isRateLimited = (
  store: RateLimitStore,
  userId: string,
  nowMs: number,
  windowMs: number = RATE_LIMIT_WINDOW_MS,
  maxRequests: number = RATE_LIMIT_MAX_REQUESTS
): boolean => {
  const recentTimestamps = (store.get(userId) ?? []).filter((timestamp) => nowMs - timestamp < windowMs);

  if (recentTimestamps.length >= maxRequests) {
    store.set(userId, recentTimestamps);
    return true;
  }

  recentTimestamps.push(nowMs);
  store.set(userId, recentTimestamps);
  return false;
};
