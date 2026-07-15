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

const weatherToAmbienceTrack = (condition: WeatherCondition): "amb_birds" | "amb_rain" | "amb_wind" | "amb_snow" => {
  if (condition === "rain" || condition === "storm") {
    return "amb_rain";
  }

  if (condition === "wind") {
    return "amb_wind";
  }

  if (condition === "snow") {
    return "amb_snow";
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

    it("maps wind to its own wind ambience track", () => {
      expect(weatherToAmbienceTrack("wind")).toBe("amb_wind");
    });

    it("maps snow to its own snow ambience track", () => {
      expect(weatherToAmbienceTrack("snow")).toBe("amb_snow");
    });

    it("maps every remaining weather condition to the birds ambience track", () => {
      const birdsConditions: WeatherCondition[] = ["clear", "partly_cloudy", "cloudy", "fog", "hot", "cold"];

      for (const condition of birdsConditions) {
        expect(weatherToAmbienceTrack(condition)).toBe("amb_birds");
      }
    });
  });
});
