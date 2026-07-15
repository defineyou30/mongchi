import type { ImageSourcePropType } from "react-native";

import type { PlantGrowthStageKey } from "@mongchi/shared";

import { gameItemAssetByCatalogId as catalogAssetMapping } from "./gameItemCatalogMapping";
import type { GameItemAssetKey } from "./gameItemCatalogMapping";

export type GameItemCategory =
  | "food"
  | "treat"
  | "drink"
  | "toy"
  | "bed"
  | "house"
  | "plant"
  | "light"
  | "water"
  | "path"
  | "reward"
  | "premiumDecor"
  | "seasonalDecor";

export type GameItemSceneSize = "small" | "medium" | "large" | "hero";
export type GameItemZLayer = "background" | "midground" | "petAdjacent" | "foreground";
export type GameItemContactShadow = "baked" | "runtime" | "none";
export type GameItemVariant = "scene" | "ui" | "hud" | "action";

export type HomeDecorationSlotId =
  | "petCenterSlot"
  | "foodSlot"
  | "toySlot"
  | "bedSlot"
  | "houseSlot"
  | "leftPlantSlot"
  | "rightPlantSlot"
  | "lightSlot"
  | "waterSlot"
  | "pathSlot"
  | "rewardSlot"
  | "premiumSlot";

export type { GameItemAssetKey } from "./gameItemCatalogMapping";

export interface HomeDecorationSlot {
  id: HomeDecorationSlotId;
  x: number;
  y: number;
  zIndex: number;
  scale: number;
  allowedCategories: GameItemCategory[];
  rotation?: number;
  canOverlapPet: boolean;
  layer: GameItemZLayer;
}

export interface GameItemDefinition {
  assetId: string;
  category: GameItemCategory;
  sceneSize: GameItemSceneSize;
  pixelWidth: number;
  pixelHeight: number;
  anchorX: number;
  anchorY: number;
  defaultScale: number;
  allowedSlots: [HomeDecorationSlotId, ...HomeDecorationSlotId[]];
  zLayer: GameItemZLayer;
  canOverlapPet: boolean;
  contactShadow: GameItemContactShadow;
  sources: Record<GameItemVariant, ImageSourcePropType>;
}

const defineSingleImageSources = (source: ImageSourcePropType): Record<GameItemVariant, ImageSourcePropType> => ({
  scene: source,
  ui: source,
  hud: source,
  action: source
});

const defineVariantImageSources = (
  scene: ImageSourcePropType,
  ui: ImageSourcePropType,
  hud: ImageSourcePropType,
  action: ImageSourcePropType
): Record<GameItemVariant, ImageSourcePropType> => ({ scene, ui, hud, action });

const itemSources = {
  foodBowl: {
    scene: require("../../../assets/game-items/scene/food-bowl.png"),
    ui: require("../../../assets/game-items/ui/food-bowl.png"),
    hud: require("../../../assets/game-items/hud/food-bowl.png"),
    action: require("../../../assets/game-items/action/food-bowl.png")
  },
  treatPlate: {
    scene: require("../../../assets/game-items/scene/treat-plate.png"),
    ui: require("../../../assets/game-items/ui/treat-plate.png"),
    hud: require("../../../assets/game-items/hud/treat-plate.png"),
    action: require("../../../assets/game-items/action/treat-plate.png")
  },
  bone: {
    scene: require("../../../assets/game-items/scene/bone.png"),
    ui: require("../../../assets/game-items/ui/bone.png"),
    hud: require("../../../assets/game-items/hud/bone.png"),
    action: require("../../../assets/game-items/action/bone.png")
  },
  salmonBites: {
    scene: require("../../../assets/game-items/scene/salmon-bites.png"),
    ui: require("../../../assets/game-items/ui/salmon-bites.png"),
    hud: require("../../../assets/game-items/hud/salmon-bites.png"),
    action: require("../../../assets/game-items/action/salmon-bites.png")
  },
  chickenJerky: {
    scene: require("../../../assets/game-items/scene/chicken-jerky.png"),
    ui: require("../../../assets/game-items/ui/chicken-jerky.png"),
    hud: require("../../../assets/game-items/hud/chicken-jerky.png"),
    action: require("../../../assets/game-items/action/chicken-jerky.png")
  },
  pumpkinCookie: {
    scene: require("../../../assets/game-items/scene/pumpkin-cookie.png"),
    ui: require("../../../assets/game-items/ui/pumpkin-cookie.png"),
    hud: require("../../../assets/game-items/hud/pumpkin-cookie.png"),
    action: require("../../../assets/game-items/action/pumpkin-cookie.png")
  },
  berryYogurt: {
    scene: require("../../../assets/game-items/scene/berry-yogurt.png"),
    ui: require("../../../assets/game-items/ui/berry-yogurt.png"),
    hud: require("../../../assets/game-items/hud/berry-yogurt.png"),
    action: require("../../../assets/game-items/action/berry-yogurt.png")
  },
  sweetPotatoChew: {
    scene: require("../../../assets/game-items/scene/sweet-potato-chew.png"),
    ui: require("../../../assets/game-items/ui/sweet-potato-chew.png"),
    hud: require("../../../assets/game-items/hud/sweet-potato-chew.png"),
    action: require("../../../assets/game-items/action/sweet-potato-chew.png")
  },
  tunaCrunch: {
    scene: require("../../../assets/game-items/scene/tuna-crunch.png"),
    ui: require("../../../assets/game-items/ui/tuna-crunch.png"),
    hud: require("../../../assets/game-items/hud/tuna-crunch.png"),
    action: require("../../../assets/game-items/action/tuna-crunch.png")
  },
  duckBiscuit: {
    scene: require("../../../assets/game-items/scene/duck-biscuit.png"),
    ui: require("../../../assets/game-items/ui/duck-biscuit.png"),
    hud: require("../../../assets/game-items/hud/duck-biscuit.png"),
    action: require("../../../assets/game-items/action/duck-biscuit.png")
  },
  cheesePuff: {
    scene: require("../../../assets/game-items/scene/cheese-puff.png"),
    ui: require("../../../assets/game-items/ui/cheese-puff.png"),
    hud: require("../../../assets/game-items/hud/cheese-puff.png"),
    action: require("../../../assets/game-items/action/cheese-puff.png")
  },
  appleBiscuit: {
    scene: require("../../../assets/game-items/scene/apple-biscuit.png"),
    ui: require("../../../assets/game-items/ui/apple-biscuit.png"),
    hud: require("../../../assets/game-items/hud/apple-biscuit.png"),
    action: require("../../../assets/game-items/action/apple-biscuit.png")
  },
  honeyPawWafer: defineVariantImageSources(
    require("../../../assets/game-items/scene/honey-paw-wafer.png"),
    require("../../../assets/game-items/ui/honey-paw-wafer.png"),
    require("../../../assets/game-items/hud/honey-paw-wafer.png"),
    require("../../../assets/game-items/action/honey-paw-wafer.png")
  ),
  milkPupCup: {
    scene: require("../../../assets/game-items/scene/milk-pup-cup.png"),
    ui: require("../../../assets/game-items/ui/milk-pup-cup.png"),
    hud: require("../../../assets/game-items/hud/milk-pup-cup.png"),
    action: require("../../../assets/game-items/action/milk-pup-cup.png")
  },
  dewdropWater: defineVariantImageSources(
    require("../../../assets/game-items/scene/dewdrop-water.png"), require("../../../assets/game-items/ui/dewdrop-water.png"), require("../../../assets/game-items/hud/dewdrop-water.png"), require("../../../assets/game-items/action/dewdrop-water.png")
  ),
  appleSip: defineVariantImageSources(
    require("../../../assets/game-items/scene/apple-sip.png"), require("../../../assets/game-items/ui/apple-sip.png"), require("../../../assets/game-items/hud/apple-sip.png"), require("../../../assets/game-items/action/apple-sip.png")
  ),
  berryMilk: defineVariantImageSources(
    require("../../../assets/game-items/scene/berry-milk.png"), require("../../../assets/game-items/ui/berry-milk.png"), require("../../../assets/game-items/hud/berry-milk.png"), require("../../../assets/game-items/action/berry-milk.png")
  ),
  pumpkinCream: defineVariantImageSources(
    require("../../../assets/game-items/scene/pumpkin-cream.png"), require("../../../assets/game-items/ui/pumpkin-cream.png"), require("../../../assets/game-items/hud/pumpkin-cream.png"), require("../../../assets/game-items/action/pumpkin-cream.png")
  ),
  blueberrySmoothie: defineVariantImageSources(
    require("../../../assets/game-items/scene/blueberry-smoothie.png"), require("../../../assets/game-items/ui/blueberry-smoothie.png"), require("../../../assets/game-items/hud/blueberry-smoothie.png"), require("../../../assets/game-items/action/blueberry-smoothie.png")
  ),
  carrotCooler: defineVariantImageSources(
    require("../../../assets/game-items/scene/carrot-cooler.png"), require("../../../assets/game-items/ui/carrot-cooler.png"), require("../../../assets/game-items/hud/carrot-cooler.png"), require("../../../assets/game-items/action/carrot-cooler.png")
  ),
  sweetPotatoShake: defineVariantImageSources(
    require("../../../assets/game-items/scene/sweet-potato-shake.png"), require("../../../assets/game-items/ui/sweet-potato-shake.png"), require("../../../assets/game-items/hud/sweet-potato-shake.png"), require("../../../assets/game-items/action/sweet-potato-shake.png")
  ),
  salmonBroth: defineVariantImageSources(
    require("../../../assets/game-items/scene/salmon-broth.png"), require("../../../assets/game-items/ui/salmon-broth.png"), require("../../../assets/game-items/hud/salmon-broth.png"), require("../../../assets/game-items/action/salmon-broth.png")
  ),
  tunaBroth: defineVariantImageSources(
    require("../../../assets/game-items/scene/tuna-broth.png"), require("../../../assets/game-items/ui/tuna-broth.png"), require("../../../assets/game-items/hud/tuna-broth.png"), require("../../../assets/game-items/action/tuna-broth.png")
  ),
  coconutSplash: defineVariantImageSources(
    require("../../../assets/game-items/scene/coconut-splash.png"), require("../../../assets/game-items/ui/coconut-splash.png"), require("../../../assets/game-items/hud/coconut-splash.png"), require("../../../assets/game-items/action/coconut-splash.png")
  ),
  pearNectar: defineVariantImageSources(
    require("../../../assets/game-items/scene/pear-nectar.png"), require("../../../assets/game-items/ui/pear-nectar.png"), require("../../../assets/game-items/hud/pear-nectar.png"), require("../../../assets/game-items/action/pear-nectar.png")
  ),
  toyBall: {
    scene: require("../../../assets/game-items/scene/toy-ball.png"),
    ui: require("../../../assets/game-items/ui/toy-ball.png"),
    hud: require("../../../assets/game-items/hud/toy-ball.png"),
    action: require("../../../assets/game-items/action/toy-ball.png")
  },
  plushToy: {
    scene: require("../../../assets/game-items/scene/plush-toy.png"),
    ui: require("../../../assets/game-items/ui/plush-toy.png"),
    hud: require("../../../assets/game-items/hud/plush-toy.png"),
    action: require("../../../assets/game-items/action/plush-toy.png")
  },
  ropeRing: {
    scene: require("../../../assets/game-items/scene/rope-ring.png"),
    ui: require("../../../assets/game-items/ui/rope-ring.png"),
    hud: require("../../../assets/game-items/hud/rope-ring.png"),
    action: require("../../../assets/game-items/action/rope-ring.png")
  },
  starSqueaker: {
    scene: require("../../../assets/game-items/scene/star-squeaker.png"),
    ui: require("../../../assets/game-items/ui/star-squeaker.png"),
    hud: require("../../../assets/game-items/hud/star-squeaker.png"),
    action: require("../../../assets/game-items/action/star-squeaker.png")
  },
  ribbonWand: {
    scene: require("../../../assets/game-items/scene/ribbon-wand.png"),
    ui: require("../../../assets/game-items/ui/ribbon-wand.png"),
    hud: require("../../../assets/game-items/hud/ribbon-wand.png"),
    action: require("../../../assets/game-items/action/ribbon-wand.png")
  },
  cloverPuzzle: {
    scene: require("../../../assets/game-items/scene/clover-puzzle.png"),
    ui: require("../../../assets/game-items/ui/clover-puzzle.png"),
    hud: require("../../../assets/game-items/hud/clover-puzzle.png"),
    action: require("../../../assets/game-items/action/clover-puzzle.png")
  },
  moonFrisbee: defineVariantImageSources(
    require("../../../assets/game-items/scene/moon-frisbee.png"), require("../../../assets/game-items/ui/moon-frisbee.png"), require("../../../assets/game-items/hud/moon-frisbee.png"), require("../../../assets/game-items/action/moon-frisbee.png")
  ),
  bellRoller: defineVariantImageSources(
    require("../../../assets/game-items/scene/bell-roller.png"), require("../../../assets/game-items/ui/bell-roller.png"), require("../../../assets/game-items/hud/bell-roller.png"), require("../../../assets/game-items/action/bell-roller.png")
  ),
  featherTeaser: defineVariantImageSources(
    require("../../../assets/game-items/scene/feather-teaser.png"), require("../../../assets/game-items/ui/feather-teaser.png"), require("../../../assets/game-items/hud/feather-teaser.png"), require("../../../assets/game-items/action/feather-teaser.png")
  ),
  snuffleMat: defineVariantImageSources(
    require("../../../assets/game-items/scene/snuffle-mat.png"), require("../../../assets/game-items/ui/snuffle-mat.png"), require("../../../assets/game-items/hud/snuffle-mat.png"), require("../../../assets/game-items/action/snuffle-mat.png")
  ),
  wobbleTreatBall: defineVariantImageSources(
    require("../../../assets/game-items/scene/wobble-treat-ball.png"), require("../../../assets/game-items/ui/wobble-treat-ball.png"), require("../../../assets/game-items/hud/wobble-treat-ball.png"), require("../../../assets/game-items/action/wobble-treat-ball.png")
  ),
  crinkleLeaf: defineVariantImageSources(
    require("../../../assets/game-items/scene/crinkle-leaf.png"), require("../../../assets/game-items/ui/crinkle-leaf.png"), require("../../../assets/game-items/hud/crinkle-leaf.png"), require("../../../assets/game-items/action/crinkle-leaf.png")
  ),
  sunbeamSpinner: defineVariantImageSources(
    require("../../../assets/game-items/scene/sunbeam-spinner.png"), require("../../../assets/game-items/ui/sunbeam-spinner.png"), require("../../../assets/game-items/hud/sunbeam-spinner.png"), require("../../../assets/game-items/action/sunbeam-spinner.png")
  ),
  cloudCushion: {
    scene: require("../../../assets/game-items/scene/cloud-cushion.png"),
    ui: require("../../../assets/game-items/ui/cloud-cushion.png"),
    hud: require("../../../assets/game-items/hud/cloud-cushion.png"),
    action: require("../../../assets/game-items/action/cloud-cushion.png")
  },
  petBed: {
    scene: require("../../../assets/game-items/scene/pet-bed.png"),
    ui: require("../../../assets/game-items/ui/pet-bed.png"),
    hud: require("../../../assets/game-items/hud/pet-bed.png"),
    action: require("../../../assets/game-items/action/pet-bed.png")
  },
  cloverNapMat: defineVariantImageSources(
    require("../../../assets/game-items/scene/clover-nap-mat.png"), require("../../../assets/game-items/ui/clover-nap-mat.png"), require("../../../assets/game-items/hud/clover-nap-mat.png"), require("../../../assets/game-items/action/clover-nap-mat.png")
  ),
  moonPillow: defineVariantImageSources(
    require("../../../assets/game-items/scene/moon-pillow.png"), require("../../../assets/game-items/ui/moon-pillow.png"), require("../../../assets/game-items/hud/moon-pillow.png"), require("../../../assets/game-items/action/moon-pillow.png")
  ),
  starBlanket: defineVariantImageSources(
    require("../../../assets/game-items/scene/star-blanket.png"), require("../../../assets/game-items/ui/star-blanket.png"), require("../../../assets/game-items/hud/star-blanket.png"), require("../../../assets/game-items/action/star-blanket.png")
  ),
  cozyBasket: defineVariantImageSources(
    require("../../../assets/game-items/scene/cozy-basket.png"), require("../../../assets/game-items/ui/cozy-basket.png"), require("../../../assets/game-items/hud/cozy-basket.png"), require("../../../assets/game-items/action/cozy-basket.png")
  ),
  windowPerch: defineVariantImageSources(
    require("../../../assets/game-items/scene/window-perch.png"), require("../../../assets/game-items/ui/window-perch.png"), require("../../../assets/game-items/hud/window-perch.png"), require("../../../assets/game-items/action/window-perch.png")
  ),
  patchworkRug: defineVariantImageSources(
    require("../../../assets/game-items/scene/patchwork-rug.png"), require("../../../assets/game-items/ui/patchwork-rug.png"), require("../../../assets/game-items/hud/patchwork-rug.png"), require("../../../assets/game-items/action/patchwork-rug.png")
  ),
  sleepTent: defineVariantImageSources(
    require("../../../assets/game-items/scene/sleep-tent.png"), require("../../../assets/game-items/ui/sleep-tent.png"), require("../../../assets/game-items/hud/sleep-tent.png"), require("../../../assets/game-items/action/sleep-tent.png")
  ),
  donutBed: defineVariantImageSources(
    require("../../../assets/game-items/scene/donut-bed.png"), require("../../../assets/game-items/ui/donut-bed.png"), require("../../../assets/game-items/hud/donut-bed.png"), require("../../../assets/game-items/action/donut-bed.png")
  ),
  gardenHammock: defineVariantImageSources(
    require("../../../assets/game-items/scene/garden-hammock.png"), require("../../../assets/game-items/ui/garden-hammock.png"), require("../../../assets/game-items/hud/garden-hammock.png"), require("../../../assets/game-items/action/garden-hammock.png")
  ),
  lanternNest: defineVariantImageSources(
    require("../../../assets/game-items/scene/lantern-nest.png"), require("../../../assets/game-items/ui/lantern-nest.png"), require("../../../assets/game-items/hud/lantern-nest.png"), require("../../../assets/game-items/action/lantern-nest.png")
  ),
  tinyHouse: {
    scene: require("../../../assets/game-items/scene/tiny-house.png"),
    ui: require("../../../assets/game-items/ui/tiny-house.png"),
    hud: require("../../../assets/game-items/hud/tiny-house.png"),
    action: require("../../../assets/game-items/action/tiny-house.png")
  },
  flowerPot: {
    scene: require("../../../assets/game-items/scene/flower-pot.png"),
    ui: require("../../../assets/game-items/ui/flower-pot.png"),
    hud: require("../../../assets/game-items/hud/flower-pot.png"),
    action: require("../../../assets/game-items/action/flower-pot.png")
  },
  leafyPlant: {
    scene: require("../../../assets/game-items/scene/leafy-plant.png"),
    ui: require("../../../assets/game-items/ui/leafy-plant.png"),
    hud: require("../../../assets/game-items/hud/leafy-plant.png"),
    action: require("../../../assets/game-items/action/leafy-plant.png")
  },
  hangingLantern: {
    scene: require("../../../assets/game-items/scene/hanging-lantern.png"),
    ui: require("../../../assets/game-items/ui/hanging-lantern.png"),
    hud: require("../../../assets/game-items/hud/hanging-lantern.png"),
    action: require("../../../assets/game-items/action/hanging-lantern.png")
  },
  smallLamp: {
    scene: require("../../../assets/game-items/scene/small-lamp.png"),
    ui: require("../../../assets/game-items/ui/small-lamp.png"),
    hud: require("../../../assets/game-items/hud/small-lamp.png"),
    action: require("../../../assets/game-items/action/small-lamp.png")
  },
  wateringCan: {
    scene: require("../../../assets/game-items/scene/watering-can.png"),
    ui: require("../../../assets/game-items/ui/watering-can.png"),
    hud: require("../../../assets/game-items/hud/watering-can.png"),
    action: require("../../../assets/game-items/action/watering-can.png")
  },
  drinkWaterBowl: {
    scene: require("../../../assets/game-items/scene/drink-water-bowl.png"),
    ui: require("../../../assets/game-items/ui/drink-water-bowl.png"),
    hud: require("../../../assets/game-items/hud/drink-water-bowl.png"),
    action: require("../../../assets/game-items/action/drink-water-bowl.png")
  },
  pondTile: {
    scene: require("../../../assets/game-items/scene/pond-tile.png"),
    ui: require("../../../assets/game-items/ui/pond-tile.png"),
    hud: require("../../../assets/game-items/hud/pond-tile.png"),
    action: require("../../../assets/game-items/action/pond-tile.png")
  },
  steppingStone: {
    scene: require("../../../assets/game-items/scene/stepping-stone.png"),
    ui: require("../../../assets/game-items/ui/stepping-stone.png"),
    hud: require("../../../assets/game-items/hud/stepping-stone.png"),
    action: require("../../../assets/game-items/action/stepping-stone.png")
  },
  rewardPouch: {
    scene: require("../../../assets/game-items/scene/reward-pouch.png"),
    ui: require("../../../assets/game-items/ui/reward-pouch.png"),
    hud: require("../../../assets/game-items/hud/reward-pouch.png"),
    action: require("../../../assets/game-items/action/reward-pouch.png")
  },
  giftBox: {
    scene: require("../../../assets/game-items/scene/gift-box.png"),
    ui: require("../../../assets/game-items/ui/gift-box.png"),
    hud: require("../../../assets/game-items/hud/gift-box.png"),
    action: require("../../../assets/game-items/action/gift-box.png")
  },
  coin: {
    scene: require("../../../assets/game-items/scene/coin.png"),
    ui: require("../../../assets/game-items/ui/coin.png"),
    hud: require("../../../assets/game-items/hud/coin.png"),
    action: require("../../../assets/game-items/action/coin.png")
  },
  gem: {
    scene: require("../../../assets/game-items/scene/gem.png"),
    ui: require("../../../assets/game-items/ui/gem.png"),
    hud: require("../../../assets/game-items/hud/gem.png"),
    action: require("../../../assets/game-items/action/gem.png")
  },
  seasonalFlowers: {
    scene: require("../../../assets/game-items/scene/seasonal-flowers.png"),
    ui: require("../../../assets/game-items/ui/seasonal-flowers.png"),
    hud: require("../../../assets/game-items/hud/seasonal-flowers.png"),
    action: require("../../../assets/game-items/action/seasonal-flowers.png")
  }
} satisfies Record<
  Exclude<
    GameItemAssetKey,
    | "flowerPotSeed"
    | "flowerPotSprout"
    | "flowerPotLeafy"
    | "flowerPotBloom"
    | "cloverSprout"
    | "cloverLeafy"
    | "cloverBloom"
    | "springPatchSprout"
    | "springPatchLeafy"
    | "springPatchBloom"
    | "cushion"
    | "doghouse"
    | "gift"
    | "lantern"
    | "bath"
  >,
  Record<GameItemVariant, ImageSourcePropType>
>;

const defineItem = (
  assetId: string,
  category: GameItemCategory,
  sceneSize: GameItemSceneSize,
  pixelSize: number,
  allowedSlots: [HomeDecorationSlotId, ...HomeDecorationSlotId[]],
  zLayer: GameItemZLayer,
  sources: Record<GameItemVariant, ImageSourcePropType>,
  options: Partial<Pick<GameItemDefinition, "anchorX" | "anchorY" | "defaultScale" | "canOverlapPet" | "contactShadow">> = {}
): GameItemDefinition => ({
  assetId,
  category,
  sceneSize,
  pixelWidth: pixelSize,
  pixelHeight: pixelSize,
  anchorX: options.anchorX ?? 0.5,
  anchorY: options.anchorY ?? 1,
  defaultScale: options.defaultScale ?? 1,
  allowedSlots,
  zLayer,
  canOverlapPet: options.canOverlapPet ?? false,
  contactShadow: options.contactShadow ?? "baked",
  sources
});

const plantStageSources = {
  flowerPotSeed: defineSingleImageSources(require("../../../assets/game-items/plant-stages/scene/flower-pot-seed.png")),
  flowerPotSprout: defineSingleImageSources(require("../../../assets/game-items/plant-stages/scene/flower-pot-sprout.png")),
  flowerPotLeafy: defineSingleImageSources(require("../../../assets/game-items/plant-stages/scene/flower-pot-leafy.png")),
  flowerPotBloom: defineSingleImageSources(require("../../../assets/game-items/plant-stages/scene/flower-pot-bloom.png")),
  cloverSprout: defineSingleImageSources(require("../../../assets/game-items/plant-stages/scene/clover-sprout.png")),
  cloverLeafy: defineSingleImageSources(require("../../../assets/game-items/plant-stages/scene/clover-leafy.png")),
  cloverBloom: defineSingleImageSources(require("../../../assets/game-items/plant-stages/scene/clover-bloom.png")),
  springPatchSprout: defineSingleImageSources(require("../../../assets/game-items/plant-stages/scene/spring-patch-sprout.png")),
  springPatchLeafy: defineSingleImageSources(require("../../../assets/game-items/plant-stages/scene/spring-patch-leafy.png")),
  springPatchBloom: defineSingleImageSources(require("../../../assets/game-items/plant-stages/scene/spring-patch-bloom.png"))
} satisfies Record<
  | "flowerPotSeed"
  | "flowerPotSprout"
  | "flowerPotLeafy"
  | "flowerPotBloom"
  | "cloverSprout"
  | "cloverLeafy"
  | "cloverBloom"
  | "springPatchSprout"
  | "springPatchLeafy"
  | "springPatchBloom",
  Record<GameItemVariant, ImageSourcePropType>
>;

/**
 * Bath tray icon (terrariumHomeCareMenu's always-visible "Bath" option in the
 * Water tray) -- a single pixel-art icon reused across all four variants,
 * same technique as plantStageSources above.
 */
const bathSources = defineSingleImageSources(require("../../../assets/game-items/action/bath.png"));

export const gameItemDefinitions: Record<GameItemAssetKey, GameItemDefinition> = {
  foodBowl: defineItem("scene_food_bowl", "food", "small", 96, ["foodSlot"], "petAdjacent", itemSources.foodBowl),
  treatPlate: defineItem("scene_treat_plate", "food", "small", 96, ["rewardSlot", "foodSlot"], "foreground", itemSources.treatPlate),
  bone: defineItem("scene_bone", "food", "small", 96, ["rewardSlot", "foodSlot"], "foreground", itemSources.bone),
  salmonBites: defineItem("scene_salmon_bites", "treat", "small", 96, ["rewardSlot", "foodSlot"], "foreground", itemSources.salmonBites),
  chickenJerky: defineItem("scene_chicken_jerky", "treat", "small", 96, ["rewardSlot", "foodSlot"], "foreground", itemSources.chickenJerky),
  pumpkinCookie: defineItem("scene_pumpkin_cookie", "treat", "small", 96, ["rewardSlot", "foodSlot"], "foreground", itemSources.pumpkinCookie),
  berryYogurt: defineItem("scene_berry_yogurt", "treat", "small", 96, ["rewardSlot", "foodSlot"], "foreground", itemSources.berryYogurt),
  sweetPotatoChew: defineItem("scene_sweet_potato_chew", "treat", "small", 96, ["rewardSlot", "foodSlot"], "foreground", itemSources.sweetPotatoChew),
  tunaCrunch: defineItem("scene_tuna_crunch", "treat", "small", 96, ["rewardSlot", "foodSlot"], "foreground", itemSources.tunaCrunch),
  duckBiscuit: defineItem("scene_duck_biscuit", "treat", "small", 96, ["rewardSlot", "foodSlot"], "foreground", itemSources.duckBiscuit),
  cheesePuff: defineItem("scene_cheese_puff", "treat", "small", 96, ["rewardSlot", "foodSlot"], "foreground", itemSources.cheesePuff),
  appleBiscuit: defineItem("scene_apple_biscuit", "treat", "small", 96, ["rewardSlot", "foodSlot"], "foreground", itemSources.appleBiscuit),
  honeyPawWafer: defineItem("scene_honey_paw_wafer", "treat", "small", 96, ["rewardSlot", "foodSlot"], "foreground", itemSources.honeyPawWafer),
  milkPupCup: defineItem("scene_milk_pup_cup", "drink", "small", 96, ["waterSlot", "foodSlot"], "foreground", itemSources.milkPupCup),
  dewdropWater: defineItem("scene_dewdrop_water", "drink", "small", 96, ["waterSlot", "foodSlot"], "foreground", itemSources.dewdropWater),
  appleSip: defineItem("scene_apple_sip", "drink", "small", 96, ["waterSlot", "foodSlot"], "foreground", itemSources.appleSip),
  berryMilk: defineItem("scene_berry_milk", "drink", "small", 96, ["waterSlot", "foodSlot"], "foreground", itemSources.berryMilk),
  pumpkinCream: defineItem("scene_pumpkin_cream", "drink", "small", 96, ["waterSlot", "foodSlot"], "foreground", itemSources.pumpkinCream),
  blueberrySmoothie: defineItem("scene_blueberry_smoothie", "drink", "small", 96, ["waterSlot", "foodSlot"], "foreground", itemSources.blueberrySmoothie),
  carrotCooler: defineItem("scene_carrot_cooler", "drink", "small", 96, ["waterSlot", "foodSlot"], "foreground", itemSources.carrotCooler),
  sweetPotatoShake: defineItem("scene_sweet_potato_shake", "drink", "small", 96, ["waterSlot", "foodSlot"], "foreground", itemSources.sweetPotatoShake),
  salmonBroth: defineItem("scene_salmon_broth", "drink", "small", 96, ["waterSlot", "foodSlot"], "foreground", itemSources.salmonBroth),
  tunaBroth: defineItem("scene_tuna_broth", "drink", "small", 96, ["waterSlot", "foodSlot"], "foreground", itemSources.tunaBroth),
  coconutSplash: defineItem("scene_coconut_splash", "drink", "small", 96, ["waterSlot", "foodSlot"], "foreground", itemSources.coconutSplash),
  pearNectar: defineItem("scene_pear_nectar", "drink", "small", 96, ["waterSlot", "foodSlot"], "foreground", itemSources.pearNectar),
  toyBall: defineItem("scene_toy_ball", "toy", "small", 96, ["toySlot"], "foreground", itemSources.toyBall),
  plushToy: defineItem("scene_plush_toy", "toy", "medium", 128, ["toySlot", "bedSlot"], "foreground", itemSources.plushToy),
  ropeRing: defineItem("scene_rope_ring", "toy", "small", 96, ["toySlot"], "foreground", itemSources.ropeRing),
  starSqueaker: defineItem("scene_star_squeaker", "toy", "small", 96, ["toySlot"], "foreground", itemSources.starSqueaker),
  ribbonWand: defineItem("scene_ribbon_wand", "toy", "small", 96, ["toySlot"], "foreground", itemSources.ribbonWand),
  cloverPuzzle: defineItem("scene_clover_puzzle", "toy", "medium", 96, ["toySlot"], "foreground", itemSources.cloverPuzzle),
  moonFrisbee: defineItem("scene_moon_frisbee", "toy", "small", 96, ["toySlot"], "foreground", itemSources.moonFrisbee),
  bellRoller: defineItem("scene_bell_roller", "toy", "small", 96, ["toySlot"], "foreground", itemSources.bellRoller),
  featherTeaser: defineItem("scene_feather_teaser", "toy", "small", 96, ["toySlot"], "foreground", itemSources.featherTeaser),
  snuffleMat: defineItem("scene_snuffle_mat", "toy", "medium", 128, ["toySlot"], "foreground", itemSources.snuffleMat),
  wobbleTreatBall: defineItem("scene_wobble_treat_ball", "toy", "small", 96, ["toySlot"], "foreground", itemSources.wobbleTreatBall),
  crinkleLeaf: defineItem("scene_crinkle_leaf", "toy", "small", 96, ["toySlot"], "foreground", itemSources.crinkleLeaf),
  sunbeamSpinner: defineItem("scene_sunbeam_spinner", "toy", "small", 96, ["toySlot"], "foreground", itemSources.sunbeamSpinner),
  cloudCushion: defineItem("scene_cloud_cushion", "bed", "medium", 96, ["bedSlot"], "midground", itemSources.cloudCushion),
  petBed: defineItem("scene_pet_bed", "bed", "medium", 128, ["bedSlot"], "midground", itemSources.petBed),
  cloverNapMat: defineItem("scene_clover_nap_mat", "bed", "medium", 128, ["bedSlot"], "midground", itemSources.cloverNapMat),
  moonPillow: defineItem("scene_moon_pillow", "bed", "medium", 128, ["bedSlot"], "midground", itemSources.moonPillow),
  starBlanket: defineItem("scene_star_blanket", "bed", "medium", 128, ["bedSlot"], "midground", itemSources.starBlanket),
  cozyBasket: defineItem("scene_cozy_basket", "bed", "medium", 128, ["bedSlot"], "midground", itemSources.cozyBasket),
  windowPerch: defineItem("scene_window_perch", "bed", "medium", 128, ["bedSlot"], "midground", itemSources.windowPerch),
  patchworkRug: defineItem("scene_patchwork_rug", "bed", "medium", 128, ["bedSlot"], "midground", itemSources.patchworkRug),
  sleepTent: defineItem("scene_sleep_tent", "bed", "large", 160, ["bedSlot"], "midground", itemSources.sleepTent),
  donutBed: defineItem("scene_donut_bed", "bed", "medium", 128, ["bedSlot"], "midground", itemSources.donutBed),
  gardenHammock: defineItem("scene_garden_hammock", "bed", "large", 160, ["bedSlot"], "midground", itemSources.gardenHammock),
  lanternNest: defineItem("scene_lantern_nest", "bed", "large", 160, ["bedSlot"], "midground", itemSources.lanternNest),
  tinyHouse: defineItem("scene_tiny_house", "house", "hero", 192, ["houseSlot"], "background", itemSources.tinyHouse, {
    defaultScale: 0.95
  }),
  flowerPot: defineItem("scene_flower_pot", "plant", "small", 96, ["leftPlantSlot", "rightPlantSlot"], "midground", itemSources.flowerPot),
  flowerPotSeed: defineItem("scene_flower_pot_seed", "plant", "small", 96, ["leftPlantSlot", "rightPlantSlot"], "midground", plantStageSources.flowerPotSeed),
  flowerPotSprout: defineItem("scene_flower_pot_sprout", "plant", "small", 96, ["leftPlantSlot", "rightPlantSlot"], "midground", plantStageSources.flowerPotSprout),
  flowerPotLeafy: defineItem("scene_flower_pot_leafy", "plant", "small", 96, ["leftPlantSlot", "rightPlantSlot"], "midground", plantStageSources.flowerPotLeafy),
  flowerPotBloom: defineItem("scene_flower_pot_bloom", "plant", "small", 96, ["leftPlantSlot", "rightPlantSlot"], "midground", plantStageSources.flowerPotBloom),
  leafyPlant: defineItem("scene_leafy_plant", "plant", "medium", 128, ["leftPlantSlot", "rightPlantSlot"], "midground", itemSources.leafyPlant),
  cloverSprout: defineItem("scene_clover_sprout", "plant", "medium", 128, ["leftPlantSlot", "rightPlantSlot"], "midground", plantStageSources.cloverSprout),
  cloverLeafy: defineItem("scene_clover_leafy", "plant", "medium", 128, ["leftPlantSlot", "rightPlantSlot"], "midground", plantStageSources.cloverLeafy),
  cloverBloom: defineItem("scene_clover_bloom", "plant", "medium", 128, ["leftPlantSlot", "rightPlantSlot"], "midground", plantStageSources.cloverBloom),
  hangingLantern: defineItem("scene_hanging_lantern", "light", "medium", 128, ["lightSlot"], "background", itemSources.hangingLantern, {
    anchorY: 0.12,
    contactShadow: "none"
  }),
  smallLamp: defineItem("scene_small_lamp", "light", "small", 96, ["lightSlot", "rightPlantSlot"], "petAdjacent", itemSources.smallLamp),
  wateringCan: defineItem("scene_watering_can", "water", "small", 96, ["waterSlot", "rightPlantSlot"], "foreground", itemSources.wateringCan),
  drinkWaterBowl: defineItem("scene_drink_water_bowl", "water", "small", 96, ["waterSlot", "foodSlot"], "foreground", itemSources.drinkWaterBowl),
  pondTile: defineItem("scene_pond_tile", "water", "large", 160, ["waterSlot"], "foreground", itemSources.pondTile, {
    canOverlapPet: false
  }),
  steppingStone: defineItem("scene_stepping_stone", "path", "medium", 128, ["pathSlot"], "foreground", itemSources.steppingStone),
  rewardPouch: defineItem("scene_reward_pouch", "reward", "small", 96, ["rewardSlot"], "foreground", itemSources.rewardPouch),
  giftBox: defineItem("scene_gift_box", "reward", "small", 96, ["rewardSlot"], "foreground", itemSources.giftBox),
  coin: defineItem("scene_coin", "reward", "small", 96, ["rewardSlot"], "foreground", itemSources.coin),
  gem: defineItem("scene_gem", "premiumDecor", "small", 96, ["premiumSlot", "rewardSlot"], "foreground", itemSources.gem),
  seasonalFlowers: defineItem(
    "scene_seasonal_flowers",
    "seasonalDecor",
    "medium",
    128,
    ["leftPlantSlot", "rightPlantSlot", "premiumSlot"],
    "midground",
    itemSources.seasonalFlowers
  ),
  springPatchSprout: defineItem("scene_spring_patch_sprout", "seasonalDecor", "large", 160, ["leftPlantSlot", "rightPlantSlot", "premiumSlot"], "midground", plantStageSources.springPatchSprout),
  springPatchLeafy: defineItem("scene_spring_patch_leafy", "seasonalDecor", "large", 160, ["leftPlantSlot", "rightPlantSlot", "premiumSlot"], "midground", plantStageSources.springPatchLeafy),
  springPatchBloom: defineItem("scene_spring_patch_bloom", "seasonalDecor", "large", 160, ["leftPlantSlot", "rightPlantSlot", "premiumSlot"], "midground", plantStageSources.springPatchBloom),
  cushion: defineItem("scene_pet_bed_alias", "bed", "medium", 128, ["bedSlot"], "midground", itemSources.petBed),
  doghouse: defineItem("scene_tiny_house_alias", "house", "hero", 192, ["houseSlot"], "background", itemSources.tinyHouse),
  gift: defineItem("scene_gift_box_alias", "reward", "small", 96, ["rewardSlot"], "foreground", itemSources.giftBox),
  lantern: defineItem("scene_hanging_lantern_alias", "light", "medium", 128, ["lightSlot"], "background", itemSources.hangingLantern, {
    anchorY: 0.12,
    contactShadow: "none"
  }),
  bath: defineItem("scene_bath_tray", "water", "small", 96, ["waterSlot", "rightPlantSlot"], "foreground", bathSources)
};

export const gameItemAssetByCatalogId = catalogAssetMapping satisfies Record<string, GameItemAssetKey>;

export const plantStageAssetByCatalogId: Record<string, Partial<Record<PlantGrowthStageKey, GameItemAssetKey>>> = {
  item_flower_pot_sunny: {
    seed: "flowerPotSeed",
    sprout: "flowerPotSprout",
    leafy: "flowerPotLeafy",
    bloom: "flowerPotBloom"
  },
  item_leafy_plant_clover: {
    sprout: "cloverSprout",
    leafy: "cloverLeafy",
    bloom: "cloverBloom"
  },
  item_seasonal_flowers_spring: {
    sprout: "springPatchSprout",
    leafy: "springPatchLeafy",
    bloom: "springPatchBloom"
  }
};

export const getGameItemAssetKeyForPlantStage = (
  catalogItemId: string,
  stageKey: PlantGrowthStageKey | null | undefined,
  fallback: GameItemAssetKey
): GameItemAssetKey => (stageKey ? plantStageAssetByCatalogId[catalogItemId]?.[stageKey] ?? fallback : fallback);

export const homeDecorationSlots: Record<HomeDecorationSlotId, HomeDecorationSlot> = {
  petCenterSlot: {
    id: "petCenterSlot",
    x: 0.5,
    y: 0.74,
    zIndex: 50,
    scale: 1,
    allowedCategories: ["food", "treat", "drink", "toy", "bed", "house", "plant", "light", "water", "path", "reward", "premiumDecor", "seasonalDecor"],
    canOverlapPet: true,
    layer: "petAdjacent"
  },
  foodSlot: {
    id: "foodSlot",
    x: 0.32,
    y: 0.79,
    zIndex: 64,
    scale: 0.82,
    allowedCategories: ["food", "treat", "drink"],
    rotation: -2,
    canOverlapPet: false,
    layer: "foreground"
  },
  toySlot: {
    id: "toySlot",
    x: 0.7,
    y: 0.82,
    zIndex: 66,
    scale: 0.86,
    allowedCategories: ["toy"],
    rotation: 7,
    canOverlapPet: false,
    layer: "foreground"
  },
  bedSlot: {
    id: "bedSlot",
    x: 0.28,
    y: 0.69,
    zIndex: 36,
    scale: 0.92,
    allowedCategories: ["bed"],
    canOverlapPet: false,
    layer: "midground"
  },
  houseSlot: {
    id: "houseSlot",
    x: 0.2,
    y: 0.62,
    zIndex: 18,
    scale: 0.8,
    allowedCategories: ["house"],
    rotation: -3,
    canOverlapPet: false,
    layer: "background"
  },
  leftPlantSlot: {
    id: "leftPlantSlot",
    x: 0.18,
    y: 0.78,
    zIndex: 42,
    scale: 0.82,
    allowedCategories: ["plant", "seasonalDecor"],
    rotation: -5,
    canOverlapPet: false,
    layer: "midground"
  },
  rightPlantSlot: {
    id: "rightPlantSlot",
    x: 0.82,
    y: 0.72,
    zIndex: 44,
    scale: 0.86,
    allowedCategories: ["plant", "seasonalDecor", "light", "water"],
    rotation: 5,
    canOverlapPet: false,
    layer: "midground"
  },
  lightSlot: {
    id: "lightSlot",
    x: 0.86,
    y: 0.36,
    zIndex: 20,
    scale: 0.82,
    allowedCategories: ["light"],
    canOverlapPet: false,
    layer: "background"
  },
  waterSlot: {
    id: "waterSlot",
    x: 0.28,
    y: 0.9,
    zIndex: 70,
    scale: 0.9,
    allowedCategories: ["water", "drink"],
    rotation: -3,
    canOverlapPet: false,
    layer: "foreground"
  },
  pathSlot: {
    id: "pathSlot",
    x: 0.5,
    y: 0.91,
    zIndex: 68,
    scale: 0.88,
    allowedCategories: ["path"],
    rotation: -2,
    canOverlapPet: false,
    layer: "foreground"
  },
  rewardSlot: {
    id: "rewardSlot",
    x: 0.82,
    y: 0.84,
    zIndex: 72,
    scale: 0.82,
    allowedCategories: ["reward", "food", "treat", "drink"],
    rotation: 5,
    canOverlapPet: false,
    layer: "foreground"
  },
  premiumSlot: {
    id: "premiumSlot",
    x: 0.62,
    y: 0.58,
    zIndex: 32,
    scale: 0.8,
    allowedCategories: ["premiumDecor", "seasonalDecor"],
    canOverlapPet: false,
    layer: "midground"
  }
};

export const getGameItemDefinition = (item: GameItemAssetKey) => gameItemDefinitions[item];

export const getGameItemSource = (item: GameItemAssetKey, variant: GameItemVariant = "ui") =>
  gameItemDefinitions[item].sources[variant];

export const getDefaultHomeSlotForItem = (item: GameItemAssetKey): HomeDecorationSlot =>
  homeDecorationSlots[gameItemDefinitions[item].allowedSlots[0]];
