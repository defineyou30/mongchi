import { assertEquals } from "jsr:@std/assert@1";

import {
  COLD_TEMPERATURE_THRESHOLD_C,
  HOT_TEMPERATURE_THRESHOLD_C,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
  WIND_OVERRIDE_THRESHOLD_KMH,
  buildWeatherLookupResult,
  createRateLimitStore,
  deriveTemperatureBand,
  isRateLimited,
  mapWeatherCodeToBaseCondition,
  mapWeatherCodeToIntensity,
  roundCoordinate,
  validateAndRoundCoordinates
} from "./weatherMapping.ts";

// ---------------------------------------------------------------------------
// Coordinate validation + rounding
// ---------------------------------------------------------------------------

Deno.test("roundCoordinate rounds to 1 decimal place", () => {
  assertEquals(roundCoordinate(37.5665123), 37.6);
  assertEquals(roundCoordinate(-122.349), -122.3);
  assertEquals(roundCoordinate(0), 0);
});

Deno.test("validateAndRoundCoordinates accepts valid coordinates and rounds them", () => {
  const result = validateAndRoundCoordinates(37.5665123, 126.978);

  assertEquals(result, { latitude: 37.6, longitude: 127 });
});

Deno.test("validateAndRoundCoordinates rejects out-of-range latitude/longitude", () => {
  assertEquals(validateAndRoundCoordinates(90.1, 0), null);
  assertEquals(validateAndRoundCoordinates(-90.1, 0), null);
  assertEquals(validateAndRoundCoordinates(0, 180.1), null);
  assertEquals(validateAndRoundCoordinates(0, -180.1), null);
});

Deno.test("validateAndRoundCoordinates accepts boundary values", () => {
  assertEquals(validateAndRoundCoordinates(90, 180), { latitude: 90, longitude: 180 });
  assertEquals(validateAndRoundCoordinates(-90, -180), { latitude: -90, longitude: -180 });
});

Deno.test("validateAndRoundCoordinates rejects non-finite and non-number inputs", () => {
  assertEquals(validateAndRoundCoordinates(Number.NaN, 0), null);
  assertEquals(validateAndRoundCoordinates(Number.POSITIVE_INFINITY, 0), null);
  assertEquals(validateAndRoundCoordinates("37.5", 127), null);
  assertEquals(validateAndRoundCoordinates(37.5, undefined), null);
  assertEquals(validateAndRoundCoordinates(null, null), null);
});

// ---------------------------------------------------------------------------
// Weathercode -> condition mapping
// ---------------------------------------------------------------------------

Deno.test("mapWeatherCodeToBaseCondition maps every documented Open-Meteo WMO code", () => {
  const expected: Record<number, string> = {
    0: "clear",
    1: "clear",
    2: "partly_cloudy",
    3: "cloudy",
    45: "fog",
    48: "fog",
    51: "rain",
    53: "rain",
    55: "rain",
    56: "rain",
    57: "rain",
    61: "rain",
    63: "rain",
    65: "rain",
    66: "rain",
    67: "rain",
    71: "snow",
    73: "snow",
    75: "snow",
    77: "snow",
    80: "rain",
    81: "rain",
    82: "storm",
    85: "snow",
    86: "snow",
    95: "storm",
    96: "storm",
    99: "storm"
  };

  for (const [code, condition] of Object.entries(expected)) {
    assertEquals(mapWeatherCodeToBaseCondition(Number(code)), condition, `code ${code}`);
  }
});

Deno.test("mapWeatherCodeToBaseCondition falls back to cloudy for unknown codes", () => {
  assertEquals(mapWeatherCodeToBaseCondition(4), "cloudy");
  assertEquals(mapWeatherCodeToBaseCondition(1000), "cloudy");
  assertEquals(mapWeatherCodeToBaseCondition(-1), "cloudy");
});

// ---------------------------------------------------------------------------
// Temperature banding
// ---------------------------------------------------------------------------

Deno.test("deriveTemperatureBand buckets at the documented thresholds", () => {
  assertEquals(deriveTemperatureBand(COLD_TEMPERATURE_THRESHOLD_C), "cold");
  assertEquals(deriveTemperatureBand(COLD_TEMPERATURE_THRESHOLD_C - 1), "cold");
  assertEquals(deriveTemperatureBand(COLD_TEMPERATURE_THRESHOLD_C + 1), "mild");
  assertEquals(deriveTemperatureBand(HOT_TEMPERATURE_THRESHOLD_C), "hot");
  assertEquals(deriveTemperatureBand(HOT_TEMPERATURE_THRESHOLD_C + 1), "hot");
  assertEquals(deriveTemperatureBand(HOT_TEMPERATURE_THRESHOLD_C - 1), "mild");
  assertEquals(deriveTemperatureBand(18), "mild");
});

// ---------------------------------------------------------------------------
// Weathercode -> intensity mapping
// ---------------------------------------------------------------------------

Deno.test("mapWeatherCodeToIntensity maps every documented light/moderate/heavy precipitation code", () => {
  const expected: Record<number, string> = {
    51: "light",
    53: "normal",
    55: "heavy",
    56: "light",
    57: "heavy",
    61: "light",
    63: "normal",
    65: "heavy",
    66: "light",
    67: "heavy",
    71: "light",
    73: "normal",
    75: "heavy",
    77: "light",
    80: "light",
    81: "normal",
    82: "heavy",
    85: "light",
    86: "heavy",
    95: "heavy",
    96: "heavy",
    99: "heavy"
  };

  for (const [code, intensity] of Object.entries(expected)) {
    assertEquals(mapWeatherCodeToIntensity(Number(code)), intensity, `code ${code}`);
  }
});

Deno.test("mapWeatherCodeToIntensity falls back to normal for codes with no intensity variant", () => {
  assertEquals(mapWeatherCodeToIntensity(0), "normal");
  assertEquals(mapWeatherCodeToIntensity(3), "normal");
  assertEquals(mapWeatherCodeToIntensity(45), "normal");
  assertEquals(mapWeatherCodeToIntensity(1000), "normal");
});

// ---------------------------------------------------------------------------
// Full result assembly + overrides
// ---------------------------------------------------------------------------

Deno.test("buildWeatherLookupResult keeps a neutral clear-sky result as clear when mild", () => {
  const result = buildWeatherLookupResult({ weatherCode: 0, temperatureC: 20, isDay: true, windSpeedKmh: 5 });

  assertEquals(result, { condition: "clear", intensity: "normal", temperatureBand: "mild", isDaytime: true });
});

Deno.test("buildWeatherLookupResult overrides a neutral condition to hot when temperature is high", () => {
  const result = buildWeatherLookupResult({ weatherCode: 1, temperatureC: 32, isDay: true, windSpeedKmh: 5 });

  assertEquals(result.condition, "hot");
  assertEquals(result.temperatureBand, "hot");
});

Deno.test("buildWeatherLookupResult overrides a neutral condition to cold when temperature is low", () => {
  const result = buildWeatherLookupResult({ weatherCode: 3, temperatureC: -2, isDay: false, windSpeedKmh: 5 });

  assertEquals(result.condition, "cold");
  assertEquals(result.temperatureBand, "cold");
  assertEquals(result.isDaytime, false);
});

Deno.test("buildWeatherLookupResult overrides a neutral condition to wind when wind speed is high, even on a hot day", () => {
  const result = buildWeatherLookupResult({
    weatherCode: 2,
    temperatureC: 30,
    isDay: true,
    windSpeedKmh: WIND_OVERRIDE_THRESHOLD_KMH
  });

  assertEquals(result.condition, "wind");
  assertEquals(result.temperatureBand, "hot");
});

Deno.test("buildWeatherLookupResult never overrides an already-salient condition (rain/storm/snow/fog)", () => {
  assertEquals(buildWeatherLookupResult({ weatherCode: 61, temperatureC: -3, isDay: true, windSpeedKmh: 50 }).condition, "rain");
  assertEquals(buildWeatherLookupResult({ weatherCode: 95, temperatureC: 35, isDay: true, windSpeedKmh: 50 }).condition, "storm");
  assertEquals(buildWeatherLookupResult({ weatherCode: 71, temperatureC: 32, isDay: true, windSpeedKmh: 50 }).condition, "snow");
  assertEquals(buildWeatherLookupResult({ weatherCode: 45, temperatureC: -5, isDay: true, windSpeedKmh: 50 }).condition, "fog");
});

Deno.test("buildWeatherLookupResult carries the weathercode's real precipitation intensity through, not a flattened default", () => {
  // Rain: heavy (65) must report "heavy", not "normal" -- this is the exact
  // fidelity gap a hardcoded client-side "normal" would otherwise introduce.
  assertEquals(buildWeatherLookupResult({ weatherCode: 65, temperatureC: 17, isDay: true, windSpeedKmh: 5 }).intensity, "heavy");
  assertEquals(buildWeatherLookupResult({ weatherCode: 61, temperatureC: 17, isDay: true, windSpeedKmh: 5 }).intensity, "light");
});

Deno.test("buildWeatherLookupResult omits temperatureBand (but still reports intensity) when temperature is not a finite number", () => {
  const result = buildWeatherLookupResult({ weatherCode: 0, temperatureC: Number.NaN, isDay: true, windSpeedKmh: 5 });

  assertEquals(result, { condition: "clear", intensity: "normal", isDaytime: true });
  assertEquals("temperatureBand" in result, false);
});

// ---------------------------------------------------------------------------
// Rate limiter
// ---------------------------------------------------------------------------

Deno.test("isRateLimited allows requests up to the max, then blocks", () => {
  const store = createRateLimitStore();
  const userId = "user-1";
  const now = 1_000_000;

  for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i += 1) {
    assertEquals(isRateLimited(store, userId, now + i), false);
  }

  assertEquals(isRateLimited(store, userId, now + RATE_LIMIT_MAX_REQUESTS), true);
});

Deno.test("isRateLimited tracks each user independently", () => {
  const store = createRateLimitStore();
  const now = 1_000_000;

  for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i += 1) {
    isRateLimited(store, "user-a", now);
  }

  assertEquals(isRateLimited(store, "user-a", now), true);
  assertEquals(isRateLimited(store, "user-b", now), false);
});

Deno.test("isRateLimited allows a new request once the window has fully elapsed", () => {
  const store = createRateLimitStore();
  const userId = "user-1";
  const now = 1_000_000;

  for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i += 1) {
    isRateLimited(store, userId, now);
  }

  assertEquals(isRateLimited(store, userId, now), true);
  assertEquals(isRateLimited(store, userId, now + RATE_LIMIT_WINDOW_MS + 1), false);
});

Deno.test("isRateLimited respects custom window/max overrides", () => {
  const store = createRateLimitStore();
  const userId = "user-1";

  assertEquals(isRateLimited(store, userId, 0, 1_000, 2), false);
  assertEquals(isRateLimited(store, userId, 100, 1_000, 2), false);
  assertEquals(isRateLimited(store, userId, 200, 1_000, 2), true);
  assertEquals(isRateLimited(store, userId, 1_101, 1_000, 2), false);
});
