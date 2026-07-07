import type { ImageSourcePropType } from "react-native";

import type { ItemId, WeatherBackgroundKey } from "@mongchi/shared";

const homeGarden = require("../../../assets/generated/backgrounds/candidates/home-garden-premium-v2-portrait.png");
const chatGarden = require("../../../assets/generated/backgrounds/candidates/chat-garden-premium-v1-portrait.png");
const themeAutumnWoods = require("../../../assets/generated/backgrounds/themes/theme-autumn-woods-v1-portrait.png");
const themeFairyGarden = require("../../../assets/generated/backgrounds/themes/theme-fairy-garden-v1-portrait.png");
const themeSeasideCove = require("../../../assets/generated/backgrounds/themes/theme-seaside-cove-v1-portrait.png");
const themeWinterLights = require("../../../assets/generated/backgrounds/themes/theme-winter-lights-v1-portrait.png");

export const weatherBackgroundSourceByKey: Record<WeatherBackgroundKey, ImageSourcePropType> = {
  "home-garden-clear": homeGarden,
  "home-garden-cloudy": homeGarden,
  "home-garden-rain": homeGarden,
  "home-garden-rain-cozy": homeGarden,
  "home-garden-winter": homeGarden,
  "home-garden-fog": homeGarden,
  "home-garden-clear-leaves": homeGarden,
  "home-garden-sunny": homeGarden,
  "home-garden-winter-soft": homeGarden,
  "home-garden-night": homeGarden,
  "chat-garden-clear": chatGarden,
  "chat-garden-rain": chatGarden,
  "chat-garden-winter": chatGarden,
  "chat-garden-night": chatGarden,
  "walk-path-clear": homeGarden,
  "walk-path-rain": homeGarden,
  "walk-path-snow": homeGarden,
  "walk-path-wind": homeGarden
};

export const getWeatherBackgroundSource = (key: WeatherBackgroundKey): ImageSourcePropType =>
  weatherBackgroundSourceByKey[key] ?? homeGarden;

export const themeBackgroundSourceById: Record<ItemId, ImageSourcePropType> = {
  "theme-default-garden": homeGarden,
  "theme-autumn-woods": themeAutumnWoods,
  "theme-fairy-garden": themeFairyGarden,
  "theme-seaside-cove": themeSeasideCove,
  "theme-winter-lights": themeWinterLights
};

export const getHomeBackgroundSource = (
  key: WeatherBackgroundKey,
  selectedTerrariumThemeId?: ItemId
): ImageSourcePropType => {
  if (selectedTerrariumThemeId && themeBackgroundSourceById[selectedTerrariumThemeId]) {
    return themeBackgroundSourceById[selectedTerrariumThemeId];
  }

  return getWeatherBackgroundSource(key);
};
