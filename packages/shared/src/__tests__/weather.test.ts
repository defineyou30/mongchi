import { describe, expect, it } from "vitest";

import {
  createApproximateLocationWeatherContext,
  createManualWeatherContext,
  getWeatherScenePresentation,
  normalizeApproximateWeatherCoordinates
} from "../index";
import type { ApproximateWeatherCoordinates, WeatherCondition } from "../index";

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
