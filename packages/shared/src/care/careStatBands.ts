import type { CareState } from "../domain/care";

export type CareStatBand = "critical" | "low" | "okay" | "great";

export type CareBandMeterKey = "satiety" | "happiness" | "energy" | "affection" | "gardenHealth" | "cleanliness";

export const careBandMeterKeys = [
  "satiety",
  "happiness",
  "energy",
  "affection",
  "gardenHealth",
  "cleanliness"
] as const satisfies readonly CareBandMeterKey[];

export const getCareStatBand = (value: number): CareStatBand => {
  if (value < 20) {
    return "critical";
  }

  if (value < 45) {
    return "low";
  }

  if (value < 75) {
    return "okay";
  }

  return "great";
};

export type CareStateBands = Record<CareBandMeterKey, CareStatBand>;

export const getCareStateBands = (
  state: Pick<CareState, CareBandMeterKey>
): CareStateBands => ({
  satiety: getCareStatBand(state.satiety),
  happiness: getCareStatBand(state.happiness),
  energy: getCareStatBand(state.energy),
  affection: getCareStatBand(state.affection),
  gardenHealth: getCareStatBand(state.gardenHealth),
  cleanliness: getCareStatBand(state.cleanliness)
});

export const countCareBandsAtOrBelow = (
  bands: CareStateBands,
  threshold: Extract<CareStatBand, "critical" | "low">
): number =>
  careBandMeterKeys.filter((key) =>
    threshold === "critical" ? bands[key] === "critical" : bands[key] === "critical" || bands[key] === "low"
  ).length;
