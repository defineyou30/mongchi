import type { ImageSourcePropType } from "react-native";

/**
 * Walk collectible pixel icons, keyed by WalkCollectible.id
 * (packages/shared/src/domain/walkCollection.ts). The friend page's "Walk
 * finds" grid renders these instead of the collectible's `emoji` field --
 * `emoji` stays on the domain type purely as an accessibility/text fallback,
 * presentation always prefers the pixel icon when one exists.
 */
export const walkCollectibleAssets: Record<string, ImageSourcePropType> = {
  col_sunny_petal: require("../../../assets/game-items/collectibles/col_sunny_petal.png"),
  col_smooth_pebble: require("../../../assets/game-items/collectibles/col_smooth_pebble.png"),
  col_rain_bead: require("../../../assets/game-items/collectibles/col_rain_bead.png"),
  col_shiny_leaf: require("../../../assets/game-items/collectibles/col_shiny_leaf.png"),
  col_frost_sparkle: require("../../../assets/game-items/collectibles/col_frost_sparkle.png"),
  col_wind_ribbon: require("../../../assets/game-items/collectibles/col_wind_ribbon.png"),
  col_warm_seed: require("../../../assets/game-items/collectibles/col_warm_seed.png"),
  col_mist_feather: require("../../../assets/game-items/collectibles/col_mist_feather.png"),
  col_rainbow_shard: require("../../../assets/game-items/collectibles/col_rainbow_shard.png")
};
