import type { GeneratedAsset, MockGenerationState, MockPhotoState, PetProfile } from "@mongchi/shared";

export type InitialPetLaunchRoute = "/welcome" | "/onboarding" | "/pet-setup" | "/generation" | "/pet-reveal" | "/terrarium";

export interface InitialPetLaunchRouteInput {
  readonly hasSeenWelcome: boolean;
  readonly photo: MockPhotoState;
  readonly generation: MockGenerationState;
  readonly petProfile: PetProfile | null;
  readonly acceptedAsset: GeneratedAsset | null;
  readonly acceptedAssets: readonly GeneratedAsset[];
}

export const getInitialPetLaunchRoute = ({
  hasSeenWelcome,
  photo,
  generation,
  petProfile,
  acceptedAsset,
  acceptedAssets
}: InitialPetLaunchRouteInput): InitialPetLaunchRoute => {
  const resolvedAsset = acceptedAsset ?? acceptedAssets[0] ?? null;

  if (petProfile?.lifecycleStatus === "active" && resolvedAsset) {
    return "/terrarium";
  }

  if (generation.status === "completed" && resolvedAsset) {
    return "/pet-reveal";
  }

  if (petProfile?.activeGenerationJobId || generation.status !== "created") {
    return "/generation";
  }

  if ((photo.selectedMockPhoto || photo.selectedPhotoUri !== null) && photo.consentAccepted) {
    return "/pet-setup";
  }

  return hasSeenWelcome ? "/onboarding" : "/welcome";
};
