import type { PetSetupDraft, PetSpecies, TalkingStyle } from "@mongchi/shared";

const speciesLabels: Record<PetSpecies, string> = {
  cat: "Cat",
  dog: "Dog"
};

const talkingStyleLabels: Record<TalkingStyle, string> = {
  cheerful: "Cheerful",
  comforting: "Comforting",
  cute: "Cute",
  gentle: "Gentle"
};

export interface PetSetupSummaryPresentation {
  detailLabel: string;
  nameLabel: string;
  speciesLabel: string;
  talkingStyleLabel: string;
}


export const getPetSetupSummaryPresentation = (draft: PetSetupDraft): PetSetupSummaryPresentation => {
  const speciesLabel = speciesLabels[draft.species];
  const talkingStyleLabel = talkingStyleLabels[draft.talkingStyle];

  return {
    detailLabel: `${speciesLabel} / ${talkingStyleLabel}`,
    nameLabel: draft.name.trim() || "Tiny pet",
    speciesLabel,
    talkingStyleLabel
  };
};
