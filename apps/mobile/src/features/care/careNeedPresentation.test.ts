import { describe, expect, it } from "vitest";

import { getCareNeedCtaPresentation } from "./careNeedPresentation";

describe("care need presentation", () => {
  it("creates an actionable CTA from the recommended care action", () => {
    expect(
      getCareNeedCtaPresentation(
        {
          primaryNeed: "clean",
          recommendedAction: "clean",
          recommendedActionLabel: "Clean",
          hint: "A quick clean would help."
        },
        "Miso"
      )
    ).toMatchObject({
      action: "clean",
      label: "Clean",
      title: "Freshen up"
    });
  });

  it("creates an actionable rest CTA when energy is the active need", () => {
    const cta = getCareNeedCtaPresentation(
      {
        primaryNeed: "rest",
        recommendedAction: "rest",
        recommendedActionLabel: "Rest",
        hint: "Energy is running low."
      },
      "Miso"
    );

    expect(cta).toMatchObject({
      action: "rest",
      label: "Rest",
      title: "Rest mode"
    });
  });

  it("creates an actionable water CTA when thirst is the active need", () => {
    const cta = getCareNeedCtaPresentation(
      {
        primaryNeed: "thirst",
        recommendedAction: "water_garden",
        recommendedActionLabel: "Water",
        hint: "A little water would help."
      },
      "Miso"
    );

    expect(cta).toMatchObject({
      action: "water_garden",
      label: "Water",
      title: "Water bowl"
    });
  });

  it("returns null when there is no active care need", () => {
    expect(
      getCareNeedCtaPresentation(
        {
          hint: "Care rhythm is good."
        },
        "Miso"
      )
    ).toBeNull();
  });
});
