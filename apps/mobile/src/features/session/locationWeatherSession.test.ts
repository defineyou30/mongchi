import { describe, expect, it, vi } from "vitest";

// locationWeatherSession.ts imports ensureSupabaseSession from
// supabaseGenerationSession.ts, which in turn imports these native modules at
// the top level -- none of them are actually exercised by
// refreshApproximateLocationWeather itself, but the module graph still needs
// them resolvable, so this test mocks them the same way
// supabasePremiumChatSession.test.ts / supabaseGenerationSession.test.ts do.
vi.mock("expo-crypto", () => ({
  randomUUID: vi.fn(() => "11111111-1111-4111-8111-111111111111")
}));

vi.mock("expo-image-manipulator", () => ({
  SaveFormat: { PNG: "png", JPEG: "jpeg", WEBP: "webp" },
  manipulateAsync: vi.fn(async (uri: string) => ({ uri: `manipulated://${uri}`, width: 1024, height: 768 }))
}));

vi.mock("expo-file-system/legacy", () => ({
  uploadAsync: vi.fn(),
  getInfoAsync: vi.fn(),
  FileSystemUploadType: { BINARY_CONTENT: 0, MULTIPART: 1 }
}));

const { requestForegroundPermissionsAsyncMock, getCurrentPositionAsyncMock } = vi.hoisted(() => ({
  requestForegroundPermissionsAsyncMock: vi.fn(async () => ({ granted: true })),
  getCurrentPositionAsyncMock: vi.fn(async () => ({
    coords: { latitude: 37.5665123, longitude: 126.978, accuracy: 20 }
  }))
}));

vi.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: requestForegroundPermissionsAsyncMock,
  getCurrentPositionAsync: getCurrentPositionAsyncMock,
  Accuracy: { Lowest: 1 }
}));

const { getSupabaseClientMock } = vi.hoisted(() => ({
  getSupabaseClientMock: vi.fn((): unknown => null)
}));

vi.mock("./supabaseClient", () => ({
  getSupabaseClient: getSupabaseClientMock
}));

import type { WeatherLookupRequest, WeatherLookupResponse } from "@mongchi/shared";

import type { DailyLoopApiClient } from "./apiDailyLoopSession";
import { refreshApproximateLocationWeather } from "./locationWeatherSession";

const requestedAt = "2026-07-14T09:00:00.000Z";

interface FakeSupabaseClientOptions {
  session?: { user: { id: string } } | null;
  signInError?: { message: string } | null;
  invokeError?: { message: string } | null;
  invokeData?: unknown;
}

const createFakeSupabaseClient = (options: FakeSupabaseClientOptions = {}) => {
  const invokeCalls: Array<{ name: string; body: unknown }> = [];
  let currentSession = options.session !== undefined ? options.session : { user: { id: "user_anon_001" } };

  const client = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: currentSession } })),
      signInAnonymously: vi.fn(async () => {
        if (options.signInError) {
          return { data: { session: null }, error: options.signInError };
        }

        currentSession = { user: { id: "user_anon_001" } };
        return { data: { session: currentSession }, error: null };
      })
    },
    functions: {
      invoke: vi.fn(async (name: string, init: { body: unknown }) => {
        invokeCalls.push({ name, body: init.body });

        if (options.invokeError) {
          return { data: null, error: options.invokeError };
        }

        return {
          data: options.invokeData ?? { condition: "rain", intensity: "heavy", temperatureBand: "mild", isDaytime: false },
          error: null
        };
      })
    }
  };

  return { client, invokeCalls };
};

const createFakeApiClient = (result: DailyLoopApiClient["lookupCurrentWeather"]): DailyLoopApiClient =>
  ({ lookupCurrentWeather: result }) as unknown as DailyLoopApiClient;

describe("refreshApproximateLocationWeather", () => {
  it("returns denied when location permission is not granted", async () => {
    requestForegroundPermissionsAsyncMock.mockResolvedValueOnce({ granted: false });

    const result = await refreshApproximateLocationWeather({ runtimeMode: "local", client: null, requestedAt });

    expect(result).toEqual({
      ok: false,
      status: "denied",
      messageSafe: "Location permission is off. You can still use manual weather preview."
    });
  });

  it("returns an error when reading the device position throws", async () => {
    getCurrentPositionAsyncMock.mockRejectedValueOnce(new Error("gps unavailable"));

    const result = await refreshApproximateLocationWeather({ runtimeMode: "local", client: null, requestedAt });

    expect(result).toEqual({
      ok: false,
      status: "error",
      messageSafe: "Could not read your approximate location right now."
    });
  });

  it("api runtime mode still calls the dead services/api client unchanged", async () => {
    const weather: WeatherLookupResponse["weather"] = {
      source: "device_location",
      condition: "snow",
      intensity: "normal",
      isDaytime: true,
      fetchedAt: requestedAt,
      temperatureC: -2
    };
    const lookupCurrentWeather = vi.fn(async (_body: WeatherLookupRequest) => ({
      ok: true as const,
      status: 200,
      data: { weather, cache: { key: "k", approximateLatitude: 37.6, approximateLongitude: 127, expiresAt: requestedAt, maxAgeSeconds: 1800 } }
    }));

    const result = await refreshApproximateLocationWeather({
      runtimeMode: "api",
      client: createFakeApiClient(lookupCurrentWeather),
      requestedAt
    });

    expect(result).toEqual({ ok: true, weather, source: "api", messageSafe: "Approximate local weather is now shaping the garden." });
    expect(lookupCurrentWeather).toHaveBeenCalledTimes(1);
    expect(getSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("falls back to synthetic weather when no Supabase client is configured", async () => {
    getSupabaseClientMock.mockReturnValueOnce(null);

    const result = await refreshApproximateLocationWeather({ runtimeMode: "local", client: null, requestedAt });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe("local");
      expect(result.messageSafe).toBe("Approximate local weather is now shaping the garden.");
      expect(result.weather.source).toBe("device_location");
      expect(result.weather.regionLabel).toBe("Approximate local weather");
    }
  });

  it("uses the real weather-lookup Edge Function result when the invoke succeeds", async () => {
    const { client, invokeCalls } = createFakeSupabaseClient({
      invokeData: { condition: "rain", intensity: "heavy", temperatureBand: "mild", isDaytime: false }
    });
    getSupabaseClientMock.mockReturnValueOnce(client);

    const result = await refreshApproximateLocationWeather({ runtimeMode: "local", client: null, requestedAt });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe("local");
      expect(result.messageSafe).toBe("Local weather is now shaping the garden.");
      expect(result.weather.condition).toBe("rain");
      expect(result.weather.isDaytime).toBe(false);
      expect(result.weather.source).toBe("device_location");
      // The Edge Function's real intensity ("heavy") must pass through, not
      // get flattened to a hardcoded "normal" -- see
      // createRealLocationWeatherContext's doc comment (packages/shared) for
      // why that flattening would silently break anything gated on
      // WeatherContext.intensity downstream.
      expect(result.weather.intensity).toBe("heavy");
      // An explicit, locale-driven "local weather" regionLabel is stamped
      // for the real path (distinct from the synthetic path's "Approximate
      // local weather" family) -- see createRealLocationWeatherContext's doc
      // comment (packages/shared).
      expect(result.weather.regionLabel).toBe("Local weather");
    }

    // Coordinates sent to the Edge Function are already rounded to 1 decimal
    // (37.5665123 -> 37.6, 126.978 -> 127) -- the client half of the
    // rounding defense-in-depth (server rounds again independently).
    expect(invokeCalls).toEqual([{ name: "weather-lookup", body: { latitude: 37.6, longitude: 127 } }]);
  });

  it("falls back to synthetic weather when the Edge Function response is missing intensity", async () => {
    const { client } = createFakeSupabaseClient({ invokeData: { condition: "rain", isDaytime: false } });
    getSupabaseClientMock.mockReturnValueOnce(client);

    const result = await refreshApproximateLocationWeather({ runtimeMode: "local", client: null, requestedAt });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.messageSafe).toBe("Approximate local weather is now shaping the garden.");
    }
  });

  it("falls back to synthetic weather when the Edge Function response has an invalid intensity value", async () => {
    const { client } = createFakeSupabaseClient({ invokeData: { condition: "rain", intensity: "extreme", isDaytime: false } });
    getSupabaseClientMock.mockReturnValueOnce(client);

    const result = await refreshApproximateLocationWeather({ runtimeMode: "local", client: null, requestedAt });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.messageSafe).toBe("Approximate local weather is now shaping the garden.");
    }
  });

  it("signs in anonymously first when there is no existing Supabase session", async () => {
    const { client } = createFakeSupabaseClient({ session: null });
    getSupabaseClientMock.mockReturnValueOnce(client);

    const result = await refreshApproximateLocationWeather({ runtimeMode: "local", client: null, requestedAt });

    expect(result.ok).toBe(true);
    expect(client.auth.signInAnonymously).toHaveBeenCalledTimes(1);
    if (result.ok) {
      expect(result.messageSafe).toBe("Local weather is now shaping the garden.");
    }
  });

  it("falls back to synthetic weather when anonymous sign-in fails", async () => {
    const { client } = createFakeSupabaseClient({ session: null, signInError: { message: "network down" } });
    getSupabaseClientMock.mockReturnValueOnce(client);

    const result = await refreshApproximateLocationWeather({ runtimeMode: "local", client: null, requestedAt });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe("local");
      expect(result.messageSafe).toBe("Approximate local weather is now shaping the garden.");
    }
  });

  it("falls back to synthetic weather when the Edge Function invoke errors", async () => {
    const { client } = createFakeSupabaseClient({ invokeError: { message: "upstream unavailable" } });
    getSupabaseClientMock.mockReturnValueOnce(client);

    const result = await refreshApproximateLocationWeather({ runtimeMode: "local", client: null, requestedAt });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.messageSafe).toBe("Approximate local weather is now shaping the garden.");
    }
  });

  it("falls back to synthetic weather when the Edge Function returns a malformed payload", async () => {
    const { client } = createFakeSupabaseClient({ invokeData: { condition: "tornado", isDaytime: true } });
    getSupabaseClientMock.mockReturnValueOnce(client);

    const result = await refreshApproximateLocationWeather({ runtimeMode: "local", client: null, requestedAt });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.messageSafe).toBe("Approximate local weather is now shaping the garden.");
    }
  });

  it("falls back to synthetic weather when functions.invoke throws", async () => {
    const client = {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: { user: { id: "user_anon_001" } } } })),
        signInAnonymously: vi.fn()
      },
      functions: {
        invoke: vi.fn(async () => {
          throw new Error("network exploded");
        })
      }
    };
    getSupabaseClientMock.mockReturnValueOnce(client);

    const result = await refreshApproximateLocationWeather({ runtimeMode: "local", client: null, requestedAt });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.messageSafe).toBe("Approximate local weather is now shaping the garden.");
    }
  });
});
