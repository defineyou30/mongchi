// Mongchi weather-lookup Edge Function.
//
// Restores the upstream half of the "location -> real weather -> garden
// scene + pet copy" design intent. Before this function existed, real
// current-weather lookup only lived in services/api's HTTP client
// (apps/mobile/src/features/session/apiDailyLoopSession.ts's
// lookupCurrentWeather) -- a backend that is not deployed to production.
// Production (local runtime mode + Supabase) fell all the way back to
// packages/shared/src/domain/weather.ts's createApproximateLocationWeatherContext,
// a coordinate+date hash pseudo-weather generator with no connection to
// actual conditions. This function gives the mobile client
// (locationWeatherSession.ts) a real upstream to call first, with the
// synthetic generator staying in place purely as the offline/failure
// fallback -- see that file's module doc comment for the full flow.
//
// Contract: POST { latitude, longitude } (JWT-authenticated, like every other
// function here except revenuecat-credit-webhook). Coordinates are validated
// then rounded to 1 decimal place (~11km, matches
// packages/shared/src/domain/weather.ts's WEATHER_COORDINATE_PRECISION_DECIMALS)
// before ever leaving this function -- Open-Meteo (https://open-meteo.com,
// free, keyless) is queried for current weather at the *rounded* pair only.
// Response: { condition, intensity, temperatureBand?, isDaytime } -- see
// weatherMapping.ts for the weathercode -> WeatherCondition table, the
// wind/temperature override rules, and the weathercode -> WeatherIntensity
// table (`intensity` is always present, unlike `temperatureBand`, and exists
// so real weather can drive any WeatherContext.intensity-gated downstream
// logic exactly like the synthetic fallback generator already does).
//
// Privacy: neither the caller's coordinates (raw or rounded) nor the
// Open-Meteo response are logged or written to any table. This function
// never touches the database at all -- no admin SupabaseClient, no insert/
// select, nothing persisted anywhere. auth.getUser() only identifies the
// caller for the per-user rate limit below; the user id itself is never
// logged or stored either.
//
// Auth pattern mirrors chat-turn/delete-account/generate-avatar exactly: the
// caller's JWT (anon key + Bearer token) identifies them via a short-lived
// authClient. Unlike those functions, no privileged service_role `admin`
// client is created at all -- this function has nothing to write.
//
// Rate limit: see weatherMapping.ts's module doc comment -- a simple
// in-memory sliding window per Edge Function instance, intentionally not
// backed by any DB table (nothing here is billed or scarce upstream; this
// only guards against a buggy client hammering Open-Meteo).
//
// CORS: none, matching chat-turn/delete-account/generate-avatar -- only ever
// called via the Supabase JS client's functions.invoke from React Native.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
  buildWeatherLookupResult,
  createRateLimitStore,
  isRateLimited,
  validateAndRoundCoordinates
} from "./weatherMapping.ts";

const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_TIMEOUT_MS = 8_000;

// Lives for the lifetime of this Edge Function instance -- see
// weatherMapping.ts's isRateLimited doc comment for why this is deliberately
// in-memory rather than a persisted table.
const rateLimitStore = createRateLimitStore();

const jsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object";

interface OpenMeteoCurrentWeatherResponse {
  current?: {
    temperature_2m?: unknown;
    weather_code?: unknown;
    is_day?: unknown;
    wind_speed_10m?: unknown;
  };
}

const fetchOpenMeteoCurrentWeather = async (
  latitude: number,
  longitude: number
): Promise<{ ok: true; current: OpenMeteoCurrentWeatherResponse["current"] } | { ok: false }> => {
  const url = new URL(OPEN_METEO_FORECAST_URL);
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("current", "temperature_2m,weather_code,is_day,wind_speed_10m");
  url.searchParams.set("timezone", "UTC");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPEN_METEO_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      return { ok: false };
    }

    const body = (await response.json()) as unknown;

    if (!isRecord(body) || !isRecord(body.current)) {
      return { ok: false };
    }

    return { ok: true, current: body.current as OpenMeteoCurrentWeatherResponse["current"] };
  } catch {
    // Network failure, timeout (AbortError), or non-JSON body -- all treated
    // as "upstream unavailable" so the caller falls back to synthetic
    // weather. Never logs the coordinates that triggered this call.
    return { ok: false };
  } finally {
    clearTimeout(timeout);
  }
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "server_misconfigured" }, 500);
  }

  // 1. Identify the caller. Mirrors chat-turn/delete-account/generate-
  // avatar's HTTP handler exactly -- no privileged admin client is created
  // here since this function never touches the database.
  const authClient = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: userData, error: userError } = await authClient.auth.getUser();

  if (userError || !userData?.user) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const userId = userData.user.id;

  // 2. Per-user rate limit (weatherMapping.ts's doc comment) -- checked
  // before the body is even parsed, so a caller hammering this endpoint
  // never reaches the upstream fetch at all.
  if (isRateLimited(rateLimitStore, userId, Date.now(), RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS)) {
    return jsonResponse({ error: "rate_limited" }, 429);
  }

  // 3. Parse and validate the request body.
  let rawBody: unknown;

  try {
    rawBody = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  if (!isRecord(rawBody)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  const coordinates = validateAndRoundCoordinates(rawBody.latitude, rawBody.longitude);

  if (!coordinates) {
    return jsonResponse({ error: "invalid_coordinates" }, 400);
  }

  // 4. Upstream lookup -- only ever queried with the rounded pair, never
  // logged (module doc comment's privacy guarantee).
  const upstream = await fetchOpenMeteoCurrentWeather(coordinates.latitude, coordinates.longitude);

  if (!upstream.ok) {
    return jsonResponse({ error: "weather_unavailable" }, 503);
  }

  const current = upstream.current;
  const weatherCode = isFiniteNumber(current?.weather_code) ? current.weather_code : null;
  const isDay = current?.is_day === 1 || current?.is_day === true;

  if (weatherCode === null) {
    return jsonResponse({ error: "weather_unavailable" }, 503);
  }

  const result = buildWeatherLookupResult({
    weatherCode,
    temperatureC: isFiniteNumber(current?.temperature_2m) ? current.temperature_2m : Number.NaN,
    isDay,
    windSpeedKmh: isFiniteNumber(current?.wind_speed_10m) ? current.wind_speed_10m : 0
  });

  return jsonResponse(result, 200);
});
