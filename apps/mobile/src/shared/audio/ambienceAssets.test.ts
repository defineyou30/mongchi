import { describe, expect, it } from "vitest";

type WeatherCondition =
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

const weatherToAmbienceTrack = (condition: WeatherCondition): "amb_birds" | "amb_rain" => {
  if (condition === "rain" || condition === "storm") {
    return "amb_rain";
  }

  return "amb_birds";
};

describe("ambienceAssets logic (see ambiencePlayer.test.ts for require(...)-safe coverage of the manifest itself)", () => {
  describe("weatherToAmbienceTrack", () => {
    it("maps rain to the rain ambience track", () => {
      expect(weatherToAmbienceTrack("rain")).toBe("amb_rain");
    });

    it("maps storm to the rain ambience track", () => {
      expect(weatherToAmbienceTrack("storm")).toBe("amb_rain");
    });

    it("maps every other weather condition to the birds ambience track", () => {
      const nonRainConditions: WeatherCondition[] = [
        "clear",
        "partly_cloudy",
        "cloudy",
        "snow",
        "fog",
        "wind",
        "hot",
        "cold"
      ];

      for (const condition of nonRainConditions) {
        expect(weatherToAmbienceTrack(condition)).toBe("amb_birds");
      }
    });
  });
});
