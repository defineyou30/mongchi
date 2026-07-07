import * as Location from "expo-location";

import {
  buildApproximateWeatherLookupRequest,
  createApproximateLocationWeatherContext
} from "@mongchi/shared";
import type { Locale, WeatherContext } from "@mongchi/shared";

import type { DailyLoopApiClient, TerrariumRuntimeMode } from "./apiDailyLoopSession";

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

  return {
    ok: true,
    weather: createApproximateLocationWeatherContext(request.request, options.requestedAt),
    source: "local",
    messageSafe: "Approximate local weather is now shaping the garden."
  };
};
