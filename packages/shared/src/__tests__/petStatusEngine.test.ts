import { describe, expect, it } from "vitest";

import type { CareState } from "../domain";
import { selectPetStatusLine } from "../episodes/petStatusEngine";

const baseCareState: Pick<
  CareState,
  "satiety" | "happiness" | "energy" | "gardenHealth" | "cleanliness" | "affection" | "lastInteractionAt" | "updatedAt"
> = {
  satiety: 80,
  happiness: 80,
  energy: 80,
  gardenHealth: 80,
  cleanliness: 80,
  affection: 80,
  lastInteractionAt: "2026-06-24T08:00:00.000Z",
  updatedAt: "2026-06-24T08:00:00.000Z"
};

describe("pet status line thirst copy", () => {
  it("frames a low thirst meter as the dog's water bowl, not a garden or soil", () => {
    const status = selectPetStatusLine({
      petName: "Miso",
      now: "2026-06-24T09:00:00.000Z",
      careState: { ...baseCareState, gardenHealth: 10 },
      satisfactionSummary: { primaryNeed: "thirst", hint: "A sip would help." }
    });

    expect(status.need).toBe("thirst");
    expect(status.line).not.toMatch(/garden|soil|leaves|leaf/i);
  });

  it("frames a critically low thirst meter with dog water-bowl urgency, not garden/soil urgency", () => {
    const status = selectPetStatusLine({
      petName: "Miso",
      now: "2026-06-24T09:00:00.000Z",
      careState: { ...baseCareState, gardenHealth: 5 },
      satisfactionSummary: { primaryNeed: "thirst", hint: "Water would help a lot." }
    });

    expect(status.need).toBe("thirst");
    expect(status.needBand).toBe("critical");
    expect(status.line).not.toMatch(/garden|soil|leaves|leaf|drooping/i);
  });

  it("recovers water-bowl copy after a water_garden care action instead of garden narration", () => {
    const status = selectPetStatusLine({
      petName: "Miso",
      now: "2026-06-24T09:00:00.000Z",
      careState: baseCareState,
      satisfactionSummary: { hint: "All good." },
      recentAction: "water_garden"
    });

    expect(status.need).toBe("thirst");
    expect(status.line.toLowerCase()).toMatch(/water|sip|bowl/);
  });
});
