import { isTreatInventoryItem } from "@mongchi/shared";
import type { CareActionType, Inventory, Item, ItemId } from "@mongchi/shared";

import { gameItemAssetByCatalogId } from "../../shared/assets/gameItemCatalogMapping";
import type { GameItemAssetKey } from "../../shared/assets/gameItemCatalogMapping";
import { homeFloatingDockActions } from "./terrariumHomeInteractionContract";
import type { HomeFloatingDockAction } from "./terrariumHomeInteractionContract";
import type { AppLocale } from "../../localization/localeNormalization";
import { getLocalizedText } from "../../localization/localizedText";
import type { LocalizedText } from "../../localization/localizedText";
import { getLocalizedCatalogItemCopy } from "../shop/shopCatalogPresentation";
import type { CareShopCategoryId } from "../shop/shopRouteParams";

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
  /**
   * @deprecated No longer applied -- the dock now always shows every owned
   * item (see getVisibleHomeCareMenuOptions) rather than a preview-capped
   * mix of owned and unowned items, so there is nothing left to cap. Kept
   * only so existing call sites don't need to drop the prop.
   */
  readonly limit?: number;
  readonly locale?: AppLocale;
  readonly preferredItemId?: ItemId | undefined;
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
  assetKey: "bath",
  owned: true
};

const baseTitleById: Readonly<Record<string, LocalizedText>> = {
  "base-affection": { "en-US": "Pet", "ko-KR": "쓰다듬기", "ja-JP": "なでる", "zh-TW": "摸摸", "de-DE": "Streicheln", "fr-FR": "Caresser", "pt-BR": "Acariciar", "es-MX": "Acariciar" },
  "base-feed": { "en-US": "Meal", "ko-KR": "밥", "ja-JP": "ごはん", "zh-TW": "餐點", "de-DE": "Mahlzeit", "fr-FR": "Repas", "pt-BR": "Refeição", "es-MX": "Comida" },
  "base-play": { "en-US": "Ball", "ko-KR": "공", "ja-JP": "ボール", "zh-TW": "球", "de-DE": "Ball", "fr-FR": "Balle", "pt-BR": "Bola", "es-MX": "Pelota" },
  "base-walk": { "en-US": "Path", "ko-KR": "산책길", "ja-JP": "小道", "zh-TW": "小徑", "de-DE": "Weg", "fr-FR": "Chemin", "pt-BR": "Caminho", "es-MX": "Sendero" },
  "base-water": { "en-US": "Water", "ko-KR": "물", "ja-JP": "お水", "zh-TW": "喝水", "de-DE": "Wasser", "fr-FR": "Eau", "pt-BR": "Água", "es-MX": "Agua" },
  "base-clean": { "en-US": "Bath", "ko-KR": "목욕", "ja-JP": "お風呂", "zh-TW": "洗澡", "de-DE": "Bad", "fr-FR": "Bain", "pt-BR": "Banho", "es-MX": "Baño" }
};

const baseMetaById: Readonly<Record<string, LocalizedText>> = {
  "base-affection": { "en-US": "+Bond", "ko-KR": "+유대감", "ja-JP": "+絆", "zh-TW": "+感情", "de-DE": "+Bindung", "fr-FR": "+Complicité", "pt-BR": "+Vínculo", "es-MX": "+Vínculo" },
  "base-feed": { "en-US": "+Full", "ko-KR": "+배부름", "ja-JP": "+満腹", "zh-TW": "+飽足", "de-DE": "+Satt", "fr-FR": "+Satiété", "pt-BR": "+Saciedade", "es-MX": "+Saciedad" },
  "base-play": { "en-US": "+Mood", "ko-KR": "+기분", "ja-JP": "+気分", "zh-TW": "+心情", "de-DE": "+Laune", "fr-FR": "+Humeur", "pt-BR": "+Humor", "es-MX": "+Ánimo" },
  "base-walk": { "en-US": "+Bond", "ko-KR": "+유대감", "ja-JP": "+絆", "zh-TW": "+感情", "de-DE": "+Bindung", "fr-FR": "+Complicité", "pt-BR": "+Vínculo", "es-MX": "+Vínculo" },
  "base-water": { "en-US": "+Thirst", "ko-KR": "+갈증", "ja-JP": "+水分", "zh-TW": "+水分", "de-DE": "+Wasser", "fr-FR": "+Hydratation", "pt-BR": "+Hidratação", "es-MX": "+Hidratación" },
  "base-clean": { "en-US": "+Fresh", "ko-KR": "+청결", "ja-JP": "+さっぱり", "zh-TW": "+清爽", "de-DE": "+Frische", "fr-FR": "+Fraîcheur", "pt-BR": "+Frescor", "es-MX": "+Frescura" }
};

const shopMeta: LocalizedText = { "en-US": "Shop", "ko-KR": "상점", "ja-JP": "ショップ", "zh-TW": "商店", "de-DE": "Shop", "fr-FR": "Boutique", "pt-BR": "Loja", "es-MX": "Tienda" };

/**
 * Which shop category (if any) the dock's trailing "More ..." tile should
 * deep-link to for a given action. Walk has none: its only special item
 * (item_stepping_stone_path) isn't sold anywhere in the shop, so a "More"
 * tile there would just be a dead end -- see getVisibleHomeCareMenuOptions.
 */
const shopCategoryByAction: Partial<Record<HomeFloatingDockAction, CareShopCategoryId>> = {
  affection: "rest",
  feed: "treats",
  play: "toys",
  water_garden: "drinks"
};

export const getShopCategoryForHomeAction = (action: HomeFloatingDockAction): CareShopCategoryId | null =>
  shopCategoryByAction[action] ?? null;

const moreTitleByAction: Partial<Record<HomeFloatingDockAction, LocalizedText>> = {
  affection: { "en-US": "More cozy picks", "ko-KR": "포근한 아이템 더보기", "ja-JP": "くつろぎグッズをもっと見る", "zh-TW": "更多舒適小物", "de-DE": "Mehr Kuschelsachen", "fr-FR": "Plus de douceurs", "pt-BR": "Mais itens aconchegantes", "es-MX": "Más artículos acogedores" },
  feed: { "en-US": "More treats", "ko-KR": "간식 더보기", "ja-JP": "おやつをもっと見る", "zh-TW": "更多點心", "de-DE": "Mehr Leckerlis", "fr-FR": "Plus de friandises", "pt-BR": "Mais petiscos", "es-MX": "Más premios" },
  play: { "en-US": "More toys", "ko-KR": "장난감 더보기", "ja-JP": "おもちゃをもっと見る", "zh-TW": "更多玩具", "de-DE": "Mehr Spielzeug", "fr-FR": "Plus de jouets", "pt-BR": "Mais brinquedos", "es-MX": "Más juguetes" },
  water_garden: { "en-US": "More drinks", "ko-KR": "음료 더보기", "ja-JP": "お水をもっと見る", "zh-TW": "更多飲品", "de-DE": "Mehr Getränke", "fr-FR": "Plus de boissons", "pt-BR": "Mais bebidas", "es-MX": "Más bebidas" }
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
      return item.category === "drink" || item.behaviorTags.includes("drink");
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
  locale = "en-US",
  preferredItemId
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
        title: getLocalizedCatalogItemCopy(item, locale).name,
        meta: owned ? `x${devStoreUnlocked ? Math.max(1, quantity) : quantity}` : getLocalizedText(locale, shopMeta),
        quantity: devStoreUnlocked ? Math.max(1, quantity) : quantity,
        owned,
        assetKey: gameItemAssetByCatalogId[item.id] ?? baseOptionByAction[action].assetKey,
        itemId: item.id
      };
    });
  // Every owned item is reachable -- no preview cap. Unowned catalog items no
  // longer render as translucent "Shop" cards in the dock itself: besides
  // needlessly advertising items an owner can't yet act on, item_stepping_
  // stone_path (walk) isn't sold anywhere in the shop, making its old preview
  // card a dead end. A single trailing "More ..." tile (only for actions
  // with a real shop category -- see shopCategoryByAction) closes the loop
  // instead; if nothing is owned yet, that tile is the only special option.
  const ownedOptions = specialOptions
    .filter((option) => option.owned)
    .sort((left, right) => Number(right.itemId === preferredItemId) - Number(left.itemId === preferredItemId));
  const moreTitle = devStoreUnlocked ? undefined : moreTitleByAction[action];
  const moreOption: HomeCareMenuOption | null = moreTitle
    ? {
        id: `more-${action}`,
        action,
        title: getLocalizedText(locale, moreTitle),
        meta: getLocalizedText(locale, shopMeta),
        quantity: 0,
        assetKey: "giftBox",
        owned: false
      }
    : null;
  const visibleSpecialOptions = moreOption ? [...ownedOptions, moreOption] : ownedOptions;
  // Bath is a second always-visible base option, not one of the special/more
  // options above (same reasoning as the base option itself always showing).
  const leadingOptions = action === "water_garden" ? [baseOptionByAction[action], bathOption] : [baseOptionByAction[action]];

  return [...leadingOptions, ...visibleSpecialOptions].map((option) => {
    const title = baseTitleById[option.id];
    const meta = baseMetaById[option.id];

    return title && meta ? { ...option, title: getLocalizedText(locale, title), meta: getLocalizedText(locale, meta) } : option;
  });
};
