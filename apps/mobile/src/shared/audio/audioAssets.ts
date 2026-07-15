export type SfxId =
  | "sfx_tap"
  | "sfx_feed"
  | "sfx_water"
  | "sfx_play"
  | "sfx_affection"
  | "sfx_rest"
  | "sfx_treat"
  | "sfx_toast"
  | "jingle_levelup"
  | "jingle_discovery"
  | "jingle_letter"
  | "jingle_arrival"
  | "sfx_reveal"
  | "sfx_clean"
  | "sfx_walk_return"
  | "sfx_walk_start"
  | "sfx_purchase";

export const sfxAssetSources: Record<SfxId, number> = {
  sfx_tap: require("../../../assets/audio/sfx_tap.m4a"),
  sfx_feed: require("../../../assets/audio/sfx_feed.m4a"),
  sfx_water: require("../../../assets/audio/sfx_water.m4a"),
  sfx_play: require("../../../assets/audio/sfx_play.m4a"),
  sfx_affection: require("../../../assets/audio/sfx_affection.m4a"),
  sfx_rest: require("../../../assets/audio/sfx_rest.m4a"),
  sfx_treat: require("../../../assets/audio/sfx_treat.m4a"),
  sfx_toast: require("../../../assets/audio/sfx_toast.m4a"),
  jingle_levelup: require("../../../assets/audio/jingle_levelup.m4a"),
  jingle_discovery: require("../../../assets/audio/jingle_discovery.m4a"),
  jingle_letter: require("../../../assets/audio/jingle_letter.m4a"),
  jingle_arrival: require("../../../assets/audio/jingle_arrival.m4a"),
  sfx_reveal: require("../../../assets/audio/sfx_reveal.m4a"),
  sfx_clean: require("../../../assets/audio/sfx_clean.m4a"),
  sfx_walk_return: require("../../../assets/audio/sfx_walk_return.m4a"),
  sfx_walk_start: require("../../../assets/audio/sfx_walk_start.m4a"),
  sfx_purchase: require("../../../assets/audio/sfx_purchase.m4a")
};

export const careActionSfxById: Partial<Record<string, SfxId>> = {
  feed: "sfx_feed",
  water_garden: "sfx_water",
  play: "sfx_play",
  affection: "sfx_affection",
  rest: "sfx_rest",
  treat: "sfx_treat",
  clean: "sfx_clean",
  walk: "sfx_walk_start"
};

export const sfxIds: SfxId[] = Object.keys(sfxAssetSources) as SfxId[];
