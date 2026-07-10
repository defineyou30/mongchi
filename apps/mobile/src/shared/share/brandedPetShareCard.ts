import { normalizeConfiguredUrl } from "../config/publicReleaseConfig";

export interface BrandedPetShareCardInput {
  readonly petName: string;
  readonly daysTogether?: number | null;
  readonly publicUrl?: string | null;
}

export interface BrandedPetShareCardCopy {
  readonly petName: string;
  readonly warmLine: string;
  readonly attribution: "Made with MongChi";
  readonly publicUrl: string | null;
}

const fallbackPetName = "My dog";

export const buildBrandedPetShareCardCopy = ({
  petName,
  daysTogether,
  publicUrl
}: BrandedPetShareCardInput): BrandedPetShareCardCopy => {
  const normalizedPetName = petName.trim() || fallbackPetName;
  const warmLine =
    typeof daysTogether === "number" && daysTogether > 0
      ? `${daysTogether} day${daysTogether === 1 ? "" : "s"} of tiny garden moments.`
      : "A tiny friend, always close.";

  return {
    petName: normalizedPetName,
    warmLine,
    attribution: "Made with MongChi",
    publicUrl: normalizeConfiguredUrl(publicUrl)
  };
};
