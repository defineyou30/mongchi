import type { PetSpecies } from "@mongchi/shared";

export const petSpeciesOptions = [
  { value: "dog", labelKey: "petSetup.species.dog" },
  { value: "cat", labelKey: "petSetup.species.cat" }
] as const satisfies readonly { readonly value: PetSpecies; readonly labelKey: string }[];
