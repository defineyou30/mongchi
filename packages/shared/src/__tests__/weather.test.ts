import { describe, expect, it } from "vitest";

import {
  createApproximateLocationWeatherContext,
  createManualWeatherContext,
  createRealLocationWeatherContext,
  getWeatherScenePresentation,
  normalizeApproximateWeatherCoordinates
} from "../index";
import type { ApproximateWeatherCoordinates, WeatherCondition, WeatherContext } from "../index";

const addDaysIso = (baseIso: string, days: number): string => {
  const date = new Date(baseIso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
};

/**
 * Groups the 9 approximate-weather conditions the same way the walk
 * collectibles (packages/shared/src/session/prototypeSession.ts walk
 * collection) are gated: sunny/clear, rain, snow/cold, wind, fog. Every
 * group must be reachable or the walk collectible journal is permanently
 * incomplete for players who never relocate.
 */
const weatherGroupOf = (condition: WeatherCondition): "sunny" | "rain" | "snow_cold" | "wind" | "fog" | "other" => {
  if (condition === "clear" || condition === "partly_cloudy" || condition === "cloudy" || condition === "hot") {
    return "sunny";
  }
  if (condition === "rain" || condition === "storm") {
    return "rain";
  }
  if (condition === "snow" || condition === "cold") {
    return "snow_cold";
  }
  if (condition === "wind") {
    return "wind";
  }
  if (condition === "fog") {
    return "fog";
  }
  return "other";
};

describe("createApproximateLocationWeatherContext seed", () => {
  const coordinates = normalizeApproximateWeatherCoordinates(37.5, 127.0) as ApproximateWeatherCoordinates;

  it("stays stable across multiple calls within the same UTC day", () => {
    const morning = createApproximateLocationWeatherContext(coordinates, "2026-07-07T01:00:00.000Z");
    const evening = createApproximateLocationWeatherContext(coordinates, "2026-07-07T22:00:00.000Z");

    expect(evening.condition).toBe(morning.condition);
    expect(evening.intensity).toBe(morning.intensity);
  });

  it("can change once the calendar day rolls over, for a fixed location", () => {
    const start = "2026-07-01T09:00:00.000Z";
    const conditionsSeen = new Set<WeatherCondition>();

    for (let day = 0; day < 14; day += 1) {
      const context = createApproximateLocationWeatherContext(coordinates, addDaysIso(start, day));
      conditionsSeen.add(context.condition);
    }

    // A pure coordinate hash would collapse this to size 1 forever. With the day
    // component added, the same location must see more than one condition across
    // two weeks, or a player who never moves is stuck with permanently static weather.
    expect(conditionsSeen.size).toBeGreaterThan(1);
  });

  it("never changes with time-of-day alone (only the calendar day matters)", () => {
    const day = "2026-07-07";
    const hours = ["00", "05", "11", "16", "23"];
    const conditions = hours.map((hour) => createApproximateLocationWeatherContext(coordinates, `${day}T${hour}:00:00.000Z`).condition);

    expect(new Set(conditions).size).toBe(1);
  });

  it("is deterministic - same coordinates and same day always produce the same result", () => {
    const now = "2026-07-07T09:00:00.000Z";

    const first = createApproximateLocationWeatherContext(coordinates, now);
    const second = createApproximateLocationWeatherContext(coordinates, now);

    expect(first).toEqual(second);
  });

  describe("weather group reachability across a realistic play window", () => {
    const sampleLocations: Array<[number, number]> = [
      [37.5, 127.0], // Seoul
      [0, 0], // null island
      [-33.9, 151.2], // Sydney
      [51.5, -0.1], // London
      [40.7, -74.0], // New York
      [1.35, 103.8] // Singapore
    ];

    it.each(sampleLocations)(
      "surfaces all 5 walk-collectible weather groups within 60 days for coordinates (%s, %s)",
      (latitude, longitude) => {
        const fixedCoordinates = normalizeApproximateWeatherCoordinates(latitude, longitude) as ApproximateWeatherCoordinates;
        const start = "2026-07-07T09:00:00.000Z";
        const groupsSeen = new Set<string>();

        for (let day = 0; day < 60; day += 1) {
          const context = createApproximateLocationWeatherContext(fixedCoordinates, addDaysIso(start, day));
          groupsSeen.add(weatherGroupOf(context.condition));
        }

        expect(groupsSeen).toEqual(new Set(["sunny", "rain", "snow_cold", "wind", "fog"]));
      }
    );
  });
});

describe("createManualWeatherContext (settings preview) is preserved", () => {
  it("still produces an exact, non-seeded condition regardless of the day component change above", () => {
    const now = "2026-07-07T09:00:00.000Z";

    const context = createManualWeatherContext("snow", now, { intensity: "heavy", isDaytime: false, temperatureC: -4 });

    expect(context).toEqual({
      source: "manual_city",
      condition: "snow",
      intensity: "heavy",
      isDaytime: false,
      fetchedAt: now,
      temperatureC: -4
    });
  });

  it("is unaffected by which day it's called on", () => {
    const first = createManualWeatherContext("rain", "2026-07-01T09:00:00.000Z");
    const second = createManualWeatherContext("rain", "2026-07-09T09:00:00.000Z");

    expect(first.condition).toBe(second.condition);
    expect(first.condition).toBe("rain");
  });
});

describe("weather presentation locale boundaries", () => {
  it("Given Japanese approximate weather, when context is generated, then its direct region line stays Japanese", () => {
    const coordinates = normalizeApproximateWeatherCoordinates(35.7, 139.7);

    expect(coordinates).not.toBeNull();
    if (!coordinates) {
      throw new Error("Expected valid Tokyo coordinates");
    }

    const weather = createApproximateLocationWeatherContext(coordinates, "2026-07-07T09:00:00.000Z", {
      locale: "ja-JP"
    });

    expect(weather.regionLabel).toBe("おおよその現地の天気");
  });

  it("Given Japanese rain, when presentation is generated, then the label and line stay Japanese", () => {
    const weather = createManualWeatherContext("rain", "2026-07-07T09:00:00.000Z");

    const presentation = getWeatherScenePresentation("home", weather, "ja-JP");

    expect(presentation.label).toBe("雨");
    expect(presentation.shortLine).toBe("雨の匂いがするね。ここはもっと心地よくしておくよ。");
    expect(presentation.accessibilityLabel).toContain("雨");
  });

  it("Given Mexican Spanish snow, when presentation is generated, then no English copy leaks through", () => {
    const weather = createManualWeatherContext("snow", "2026-07-07T09:00:00.000Z");

    const presentation = getWeatherScenePresentation("walk", weather, "es-MX");

    expect(presentation.label).toBe("Nieve");
    expect(presentation.shortLine).toBe("La luz de la nieve se posó suavemente al borde del jardín.");
    expect(presentation.accessibilityLabel).toContain("Escena del clima");
  });
});

describe("createRealLocationWeatherContext (weather-lookup Edge Function result)", () => {
  const now = "2026-07-07T09:00:00.000Z";

  it("carries the condition, intensity, and isDaytime straight through from the lookup result", () => {
    const context = createRealLocationWeatherContext({ condition: "rain", intensity: "heavy", temperatureBand: "mild", isDaytime: false }, now);

    expect(context.source).toBe("device_location");
    expect(context.condition).toBe("rain");
    expect(context.isDaytime).toBe(false);
    // Unlike the synthetic path (which derives intensity from a day/location
    // hash), the real path must pass the Edge Function's own intensity
    // through verbatim -- flattening it to a hardcoded "normal" is exactly
    // the bug that made a real heavy storm indistinguishable from a light
    // drizzle to anything gated on WeatherContext.intensity (see
    // localReactionEngine.ts's weatherIntensity condition/scoring).
    expect(context.intensity).toBe("heavy");
    expect(context.fetchedAt).toBe(now);
  });

  it("fills temperatureC from the same condition-keyed table the synthetic path uses", () => {
    // Compares against createApproximateLocationWeatherContext's own output
    // for a day that happens to seed "hot" for this fixed location, rather
    // than a hardcoded number, so this test breaks (instead of silently
    // drifting) if the shared temperatureByCondition table ever changes.
    const coordinates = normalizeApproximateWeatherCoordinates(37.5, 127.0) as ApproximateWeatherCoordinates;
    let hotDayContext: WeatherContext | null = null;

    for (let day = 0; day < 60 && !hotDayContext; day += 1) {
      const candidate = createApproximateLocationWeatherContext(coordinates, addDaysIso(now, day));

      if (candidate.condition === "hot") {
        hotDayContext = candidate;
      }
    }

    expect(hotDayContext).not.toBeNull();

    const real = createRealLocationWeatherContext({ condition: "hot", intensity: "normal", isDaytime: true }, now);

    expect(real.temperatureC).toBe(hotDayContext?.temperatureC);
  });

  it("stamps an explicit, per-locale 'local weather' regionLabel distinct from the synthetic path's 'approximate' phrasing", () => {
    const context = createRealLocationWeatherContext(
      { condition: "clear", intensity: "normal", temperatureBand: "mild", isDaytime: true },
      now,
      { locale: "ko-KR" }
    );

    expect(context.regionLabel).toBe("현지 날씨");

    const presentation = getWeatherScenePresentation("home", context, "ko-KR");

    expect(presentation.accessibilityLabel).toContain("현지 날씨");
    expect(presentation.accessibilityLabel).not.toContain("대략적인");
  });

  it("defaults regionLabel to the en-US label when no locale is given", () => {
    const context = createRealLocationWeatherContext({ condition: "clear", intensity: "normal", isDaytime: true }, now);

    expect(context.regionLabel).toBe("Local weather");
  });

  it("still reads distinctly from the approximate path's 'Approximate local weather' region label", () => {
    const coordinates = normalizeApproximateWeatherCoordinates(35.7, 139.7) as ApproximateWeatherCoordinates;
    const approximate = createApproximateLocationWeatherContext(coordinates, now, { locale: "en-US" });
    const real = createRealLocationWeatherContext(
      { condition: approximate.condition, intensity: "normal", isDaytime: approximate.isDaytime },
      now,
      { locale: "en-US" }
    );

    const approximatePresentation = getWeatherScenePresentation("home", approximate, "en-US");
    const realPresentation = getWeatherScenePresentation("home", real, "en-US");

    expect(approximatePresentation.accessibilityLabel).toContain("approximate local weather");
    expect(realPresentation.accessibilityLabel).toContain("Local weather");
    expect(realPresentation.accessibilityLabel).not.toContain("approximate local weather");
  });

  it("every WeatherCondition the lookup can return maps to a defined temperatureC", () => {
    const conditions: WeatherCondition[] = [
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
    ];

    for (const condition of conditions) {
      const context = createRealLocationWeatherContext({ condition, intensity: "normal", isDaytime: true }, now);
      expect(typeof context.temperatureC).toBe("number");
    }
  });

  // Bug fix regression coverage: a real "it's raining right now" lookup must
  // drive the exact same home-screen scene presentation (overlay wash, rain
  // drops, background key) as a synthetic "rain" context already did --
  // getWeatherScenePresentation/getWeatherOverlayKey/getWeatherBackgroundKey
  // are driven purely by `condition` (+ `isDaytime` for the night/clear
  // special case), so a real context is not filtered out by any of them.
  it("a real rain context resolves to the same rain overlay/background as a synthetic rain context", () => {
    const real = createRealLocationWeatherContext({ condition: "rain", intensity: "heavy", isDaytime: false }, now);
    const synthetic = createManualWeatherContext("rain", now);

    const realPresentation = getWeatherScenePresentation("home", real, "en-US");
    const syntheticPresentation = getWeatherScenePresentation("home", synthetic, "en-US");

    expect(realPresentation.overlayKey).toBe("rain");
    expect(realPresentation.backgroundKey).toBe("home-garden-rain");
    expect(realPresentation.overlayKey).toBe(syntheticPresentation.overlayKey);
    expect(realPresentation.backgroundKey).toBe(syntheticPresentation.backgroundKey);
  });

  it("a real storm/snow/fog context resolves to its matching overlay too", () => {
    expect(getWeatherScenePresentation("home", createRealLocationWeatherContext({ condition: "storm", intensity: "heavy", isDaytime: true }, now)).overlayKey).toBe(
      "storm"
    );
    expect(getWeatherScenePresentation("home", createRealLocationWeatherContext({ condition: "snow", intensity: "light", isDaytime: true }, now)).overlayKey).toBe(
      "snow"
    );
    expect(getWeatherScenePresentation("home", createRealLocationWeatherContext({ condition: "fog", intensity: "normal", isDaytime: true }, now)).overlayKey).toBe(
      "fog"
    );
  });
});
