import { isTreatInventoryItem } from "@mongchi/shared";
import type { CareActionType, Inventory, Item, ItemId } from "@mongchi/shared";

import { gameItemAssetByCatalogId } from "../../shared/assets/gameItemCatalogMapping";
import type { GameItemAssetKey } from "../../shared/assets/gameItemCatalogMapping";
import { homeFloatingDockActions } from "./terrariumHomeInteractionContract";
import type { HomeFloatingDockAction } from "./terrariumHomeInteractionContract";

export interface HomeCareMenuOption {
  readonly id: string;
  readonly action: CareActionType;
  readonly title: string;
  readonly meta: string;
  readonly quantity: number;
  readonly assetKey: GameItemAssetKey;
  readonly owned: boolean;
  readonly itemId?: ItemId;
}

interface HomeCareMenuInput {
  readonly action: HomeFloatingDockAction;
  readonly catalogItems: readonly Item[];
  readonly devStoreUnlocked: boolean;
  readonly inventory: Inventory;
  readonly limit?: number;
}

const baseOptionByAction: Record<HomeFloatingDockAction, HomeCareMenuOption> = {
  affection: {
    id: "base-affection",
    action: "affection",
    title: "Pet",
    meta: "+Bond",
    quantity: 1,
    assetKey: "petBed",
    owned: true
  },
  feed: {
    id: "base-feed",
    action: "feed",
    title: "Meal",
    meta: "+Full",
    quantity: 1,
    assetKey: "foodBowl",
    owned: true
  },
  play: {
    id: "base-play",
    action: "play",
    title: "Ball",
    meta: "+Mood",
    quantity: 1,
    assetKey: "toyBall",
    owned: true
  },
  walk: {
    id: "base-walk",
    action: "walk",
    title: "Path",
    meta: "+Bond",
    quantity: 1,
    assetKey: "steppingStone",
    owned: true
  },
  water_garden: {
    id: "base-water",
    action: "water_garden",
    title: "Water",
    meta: "+Thirst",
    quantity: 1,
    assetKey: "drinkWaterBowl",
    owned: true
  }
};

/**
 * "Bath" lives in the Water tray rather than owning a floating-dock button
 * of its own -- clean's domain (cleanliness decay, cooldown) was already
 * complete, but had no home-screen entry point at all, so a "Bath, please"
 * reaction line had nothing for the owner to tap. This mirrors the base
 * options above: always owned, no itemId, but its `action` is "clean"
 * (outside HomeFloatingDockAction) rather than "water_garden" -- the same
 * pattern base-feed's treat items already use via getOptionActionForItem.
 */
const bathOption: HomeCareMenuOption = {
  id: "base-clean",
  action: "clean",
  title: "Bath",
  meta: "+Fresh",
  quantity: 1,
  assetKey: "wateringCan",
  owned: true
};

const isSpecialCareItemForAction = (action: HomeFloatingDockAction, item: Item): boolean => {
  switch (action) {
    case "affection":
      return item.behaviorTags.includes("affection") || item.behaviorTags.includes("sleep");
    case "feed":
      return isTreatInventoryItem(item);
    case "play":
      return item.id !== "item_toy_ball_mint" && item.behaviorTags.includes("play");
    case "walk":
      return item.behaviorTags.includes("walk") || item.category === "path";
    case "water_garden":
      return item.id === "item_milk_pup_cup";
  }
};

const getOptionActionForItem = (action: HomeFloatingDockAction, item: Item): CareActionType => {
  if (action === "feed" && isTreatInventoryItem(item)) {
    return "treat";
  }

  return action;
};

/**
 * Inverse of isSpecialCareItemForAction -- given an owned item, which home
 * dock tray would offer it? Used by the Inventory screen's "Give now" card
 * tap (docs/gamefeel-sound-plan.md §1 Tier 4) to know which tray to
 * auto-open after navigating home. Returns null for items with no dock tray
 * of their own (e.g. the starter food bowl) -- those cards still navigate
 * home, just without opening a specific tray.
 */
export const getHomeDockActionForItem = (item: Item): HomeFloatingDockAction | null =>
  homeFloatingDockActions.find((action) => isSpecialCareItemForAction(action, item)) ?? null;

export const getVisibleHomeCareMenuOptions = ({
  action,
  catalogItems,
  devStoreUnlocked,
  inventory,
  limit = action === "feed" ? 3 : 4
}: HomeCareMenuInput): HomeCareMenuOption[] => {
  const quantityByItemId = new Map(inventory.items.map((entry) => [entry.itemId, entry.quantity]));
  const specialOptions = catalogItems
    .filter((item) => isSpecialCareItemForAction(action, item))
    .map((item) => {
      const quantity = quantityByItemId.get(item.id) ?? 0;
      const owned = devStoreUnlocked || quantity > 0;

      return {
        id: `item-${item.id}`,
        action: getOptionActionForItem(action, item),
        title: action === "feed" ? "Treat" : item.name,
        meta: owned ? `x${devStoreUnlocked ? Math.max(1, quantity) : quantity}` : "Shop",
        quantity: devStoreUnlocked ? Math.max(1, quantity) : quantity,
        owned,
        assetKey: gameItemAssetByCatalogId[item.id] ?? baseOptionByAction[action].assetKey,
        itemId: item.id
      };
    });
  const ownedOptions = specialOptions.filter((option) => option.owned);
  const previewOptions = specialOptions.filter((option) => !option.owned).slice(0, Math.max(0, limit - 1));
  const visibleSpecialOptions = devStoreUnlocked ? ownedOptions : [...ownedOptions, ...previewOptions].slice(0, Math.max(0, limit - 1));
  // Bath is a second always-visible base option, not one of the
  // limit-bounded special/preview slots above (same reasoning as the base
  // option itself never counting against `limit`).
  const leadingOptions = action === "water_garden" ? [baseOptionByAction[action], bathOption] : [baseOptionByAction[action]];

  return [...leadingOptions, ...visibleSpecialOptions];
};
