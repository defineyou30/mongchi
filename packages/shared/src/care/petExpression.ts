import type { GeneratedAssetState } from "../domain/assets";
import type { CareSatisfactionTier, CareState } from "../domain/care";
import { countCareBandsAtOrBelow, getCareStateBands } from "./careStatBands";

/**
 * Derives the ambient (no recent action) pet expression from care stat bands so
 * neglect is visible on the pet's body, not just in the meters. Priority:
 * compound neglect > hunger > exhaustion > messiness > sadness > glow.
 */
export const deriveAmbientPetAssetState = (
  state: Pick<CareState, "satiety" | "happiness" | "energy" | "affection" | "gardenHealth" | "cleanliness">,
  tier?: CareSatisfactionTier
): GeneratedAssetState => {
  const bands = getCareStateBands(state);

  if (countCareBandsAtOrBelow(bands, "critical") >= 2) {
    return "sick";
  }

  if (bands.satiety === "critical") {
    return "hungry";
  }

  if (bands.energy === "critical") {
    return "sleep";
  }

  if (bands.cleanliness === "critical") {
    return "messy";
  }

  if (bands.happiness === "critical" || bands.happiness === "low") {
    return "sad";
  }

  if (bands.satiety === "low") {
    return "hungry";
  }

  if (tier === "glowing") {
    return "happy";
  }

  return "idle";
};
