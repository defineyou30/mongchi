import type { GeneratedAsset, GeneratedAssetId, PetSpecies } from "@mongchi/shared";
import { Image } from "react-native";
import type { ImageSourcePropType, ImageStyle, StyleProp } from "react-native";

const FALLBACK_ASSET_ID = "asset_miso_idle_001";
const fallbackAssetKeyBySpecies: Record<PetSpecies, string> = {
  dog: "miso",
  cat: "luna"
};

const generatedPetAssetSources: Partial<Record<GeneratedAssetId, ImageSourcePropType>> = {
  asset_miso_base_001: require("../../../assets/generated/pets/miso/base.png"),
  asset_miso_idle_001: require("../../../assets/generated/pets/miso/idle.png"),
  asset_miso_happy_001: require("../../../assets/generated/pets/miso/happy.png"),
  asset_miso_sleep_001: require("../../../assets/generated/pets/miso/sleep.png"),
  asset_miso_play_001: require("../../../assets/generated/pets/miso/play.png"),
  asset_miso_hungry_001: require("../../../assets/generated/pets/miso/hungry.png"),
  asset_miso_walk_return_001: require("../../../assets/generated/pets/miso/walk_return.png"),
  asset_miso_treat_reaction_001: require("../../../assets/generated/pets/miso/treat_reaction.png"),
  asset_miso_chat_portrait_001: require("../../../assets/generated/pets/miso/chat_portrait.png"),
  asset_miso_curious_001: require("../../../assets/generated/pets/miso/curious.png"),
  asset_miso_celebrate_001: require("../../../assets/generated/pets/miso/celebrate.png"),
  asset_miso_garden_help_001: require("../../../assets/generated/pets/miso/garden_help.png"),
  asset_miso_seasonal_001: require("../../../assets/generated/pets/miso/seasonal.png"),
  // TODO: replace with dedicated sad/sick/messy art once generated (see docs/improvement-backlog.md §8)
  asset_miso_sad_001: require("../../../assets/generated/pets/miso/hungry.png"),
  asset_miso_sick_001: require("../../../assets/generated/pets/miso/sleep.png"),
  asset_miso_messy_001: require("../../../assets/generated/pets/miso/walk_return.png"),
  asset_luna_base_001: require("../../../assets/generated/pets/luna/base.png"),
  asset_luna_idle_001: require("../../../assets/generated/pets/luna/idle.png"),
  asset_luna_happy_001: require("../../../assets/generated/pets/luna/happy.png"),
  asset_luna_sleep_001: require("../../../assets/generated/pets/luna/sleep.png"),
  asset_luna_play_001: require("../../../assets/generated/pets/luna/play.png"),
  asset_luna_hungry_001: require("../../../assets/generated/pets/luna/hungry.png"),
  asset_luna_walk_return_001: require("../../../assets/generated/pets/luna/walk_return.png"),
  asset_luna_treat_reaction_001: require("../../../assets/generated/pets/luna/treat_reaction.png"),
  asset_luna_chat_portrait_001: require("../../../assets/generated/pets/luna/chat_portrait.png"),
  asset_luna_curious_001: require("../../../assets/generated/pets/luna/curious.png"),
  asset_luna_celebrate_001: require("../../../assets/generated/pets/luna/celebrate.png"),
  asset_luna_garden_help_001: require("../../../assets/generated/pets/luna/garden_help.png"),
  asset_luna_seasonal_001: require("../../../assets/generated/pets/luna/seasonal.png"),
  asset_luna_sad_001: require("../../../assets/generated/pets/luna/hungry.png"),
  asset_luna_sick_001: require("../../../assets/generated/pets/luna/sleep.png"),
  asset_luna_messy_001: require("../../../assets/generated/pets/luna/walk_return.png")
};

export const getGeneratedPetAssetSource = (assetId?: GeneratedAssetId | null, remoteUri?: string | null): ImageSourcePropType =>
  generatedPetAssetSources[assetId ?? FALLBACK_ASSET_ID] ?? (remoteUri ? { uri: remoteUri } : generatedPetAssetSources[FALLBACK_ASSET_ID]!);

export const getFallbackGeneratedPetAssetId = (
  species?: PetSpecies | null,
  state: GeneratedAsset["state"] = "idle"
): GeneratedAssetId => {
  const assetKey = fallbackAssetKeyBySpecies[species ?? "dog"] ?? fallbackAssetKeyBySpecies.dog;

  return `asset_${assetKey}_${state}_001`;
};

interface GeneratedPetAssetImageProps {
  assetId?: GeneratedAssetId | null;
  remoteUri?: string | null;
  accessibilityLabel: string;
  decorative?: boolean;
  style: StyleProp<ImageStyle>;
}

export function GeneratedPetAssetImage({ assetId, remoteUri, accessibilityLabel, decorative = false, style }: GeneratedPetAssetImageProps) {
  return (
    <Image
      accessibilityElementsHidden={decorative}
      accessibilityIgnoresInvertColors
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={decorative ? "no-hide-descendants" : "auto"}
      source={getGeneratedPetAssetSource(assetId, remoteUri)}
      resizeMode="contain"
      style={style}
    />
  );
}
