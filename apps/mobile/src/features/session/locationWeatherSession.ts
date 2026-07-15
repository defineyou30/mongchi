import * as Location from "expo-location";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildApproximateWeatherLookupRequest,
  createApproximateLocationWeatherContext,
  createRealLocationWeatherContext
} from "@mongchi/shared";
import type { Locale, RealLocationWeatherLookup, RealWeatherTemperatureBand, WeatherContext } from "@mongchi/shared";

import type { DailyLoopApiClient, TerrariumRuntimeMode } from "./apiDailyLoopSession";
import { getSupabaseClient } from "./supabaseClient";
import { ensureSupabaseSession } from "./supabaseGenerationSession";
import { withRequestTimeout } from "../../shared/api/requestTimeout";
import { reporter } from "../../shared/errors/reporter";

// ---------------------------------------------------------------------------
// Real weather lookup (supabase/functions/weather-lookup). Restores the
// "location -> real weather -> garden scene + pet copy" design intent: the
// only place actual current-weather lookup used to live was services/api's
// HTTP client (apiDailyLoopSession.ts's lookupCurrentWeather), a backend
// that is not deployed to production -- production's "local" runtime mode
// fell all the way through to createApproximateLocationWeatherContext's
// coordinate+date hash pseudo-weather with no connection to actual
// conditions. refreshApproximateLocationWeather below now tries this Edge
// Function first (whenever a Supabase client is configured) and only falls
// back to the synthetic generator when it isn't configured, the device is
// offline, or the lookup fails for any reason -- see weather-lookup's
// weatherMapping.ts for the Open-Meteo weathercode mapping.
// ---------------------------------------------------------------------------

const weatherLookupInvokeTimeoutMs = 10_000;

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object";

const knownWeatherConditions: ReadonlySet<string> = new Set([
  "clear",
  "partly_cloudy",
  "cloudy",
  "rain",
  "storm",
  "snow",
  "fog",
  "wind",
  "hot",
  "cold"
]);
const knownTemperatureBands: ReadonlySet<string> = new Set(["cold", "mild", "hot"]);
const knownWeatherIntensities: ReadonlySet<string> = new Set(["light", "normal", "heavy"]);

/**
 * Design-audit invariant I4 shield, same principle as
 * supabasePremiumChatSession.ts's parseConversationMessage: never trust the
 * Edge Function's raw response shape, even though it's our own function --
 * a malformed/unexpected payload falls back to synthetic weather rather than
 * poisoning the WeatherContext with an invalid condition string.
 *
 * `intensity` is required (not optional) here, matching weather-lookup's
 * response contract (weatherMapping.ts's buildWeatherLookupResult always
 * includes it) -- see RealLocationWeatherLookup's doc comment (@mongchi/shared)
 * for why a missing/invalid intensity must fall back to synthetic weather
 * rather than silently defaulting to "normal": that's exactly the flattening
 * bug this whole intensity plumbing exists to avoid.
 */
const parseWeatherLookupResponse = (data: unknown): RealLocationWeatherLookup | null => {
  if (!isRecord(data)) {
    return null;
  }

  const { condition, intensity, temperatureBand, isDaytime } = data;

  if (typeof condition !== "string" || !knownWeatherConditions.has(condition)) {
    return null;
  }

  if (typeof intensity !== "string" || !knownWeatherIntensities.has(intensity)) {
    return null;
  }

  if (typeof isDaytime !== "boolean") {
    return null;
  }

  if (temperatureBand !== undefined && (typeof temperatureBand !== "string" || !knownTemperatureBands.has(temperatureBand))) {
    return null;
  }

  return {
    condition: condition as RealLocationWeatherLookup["condition"],
    intensity: intensity as RealLocationWeatherLookup["intensity"],
    isDaytime,
    ...(typeof temperatureBand === "string" ? { temperatureBand: temperatureBand as RealWeatherTemperatureBand } : {})
  };
};

/**
 * Design-audit invariant I4 shield, same as invokeSupabaseChatTurn
 * (supabasePremiumChatSession.ts): a raw throw from session sign-in,
 * functions.invoke, or response parsing must never escape as an unhandled
 * promise rejection -- any failure here just means "no real weather this
 * time", handled by the caller falling back to synthetic weather.
 */
const invokeWeatherLookupEdgeFunction = async (
  client: SupabaseClient,
  latitude: number,
  longitude: number
): Promise<RealLocationWeatherLookup | null> => {
  try {
    const session = await ensureSupabaseSession(client);

    if (!session.ok) {
      return null;
    }

    const invoked = await withRequestTimeout(
      client.functions.invoke("weather-lookup", { body: { latitude, longitude } }),
      weatherLookupInvokeTimeoutMs
    );

    if (invoked.error) {
      return null;
    }

    return parseWeatherLookupResponse(invoked.data);
  } catch (cause) {
    reporter.captureMessage("weather: lookup invoke threw", {
      cause: cause instanceof Error ? cause.message : String(cause)
    });
    return null;
  }
};

export type LocationWeatherRefreshStatus = "idle" | "requesting" | "ready" | "denied" | "error";

export type LocationWeatherRefreshResult =
  | {
      ok: true;
      weather: WeatherContext;
      source: "api" | "local";
      messageSafe: string;
    }
  | {
      ok: false;
      status: Exclude<LocationWeatherRefreshStatus, "idle" | "requesting" | "ready">;
      messageSafe: string;
    };

export interface LocationWeatherRefreshOptions {
  runtimeMode: TerrariumRuntimeMode;
  client: DailyLoopApiClient | null;
  locale?: Locale;
  requestedAt: string;
}

export const refreshApproximateLocationWeather = async (
  options: LocationWeatherRefreshOptions
): Promise<LocationWeatherRefreshResult> => {
  const permission = await Location.requestForegroundPermissionsAsync();

  if (!permission.granted) {
    return {
      ok: false,
      status: "denied",
      messageSafe: "Location permission is off. You can still use manual weather preview."
    };
  }

  let position: Location.LocationObject;

  try {
    position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Lowest
    });
  } catch {
    return {
      ok: false,
      status: "error",
      messageSafe: "Could not read your approximate location right now."
    };
  }

  const request = buildApproximateWeatherLookupRequest(
    {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracyMeters: position.coords.accuracy
    },
    options.requestedAt,
    options.locale
  );

  if (!request.ok) {
    return {
      ok: false,
      status: "error",
      messageSafe: request.messageSafe
    };
  }

  if (options.runtimeMode === "api" && options.client) {
    const result = await options.client.lookupCurrentWeather(request.request);

    if (!result.ok) {
      return {
        ok: false,
        status: "error",
        messageSafe: result.error.messageSafe
      };
    }

    return {
      ok: true,
      weather: result.data.weather,
      source: "api",
      messageSafe: "Approximate local weather is now shaping the garden."
    };
  }

  // "local" runtime mode (production): try the real weather-lookup Edge
  // Function first when a Supabase client is configured -- request.request's
  // approximateLatitude/approximateLongitude are already rounded to 1 decimal
  // by buildApproximateWeatherLookupRequest above (same precision the Edge
  // Function itself re-rounds to server-side; sending the already-rounded
  // pair is the client half of that defense-in-depth). Any failure (no
  // client configured, offline, malformed response, upstream unavailable)
  // falls through to the synthetic generator below.
  const supabaseClient = getSupabaseClient();

  if (supabaseClient) {
    const lookup = await invokeWeatherLookupEdgeFunction(
      supabaseClient,
      request.request.approximateLatitude,
      request.request.approximateLongitude
    );

    if (lookup) {
      return {
        ok: true,
        weather: createRealLocationWeatherContext(lookup, options.requestedAt, options.locale ? { locale: options.locale } : {}),
        source: "local",
        messageSafe: "Local weather is now shaping the garden."
      };
    }
  }

  return {
    ok: true,
    weather: createApproximateLocationWeatherContext(request.request, options.requestedAt),
    source: "local",
    messageSafe: "Approximate local weather is now shaping the garden."
  };
};
