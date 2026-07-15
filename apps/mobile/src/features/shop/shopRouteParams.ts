import { getExpressionPackById } from "@mongchi/shared";

export type ShopCategoryId = "treats" | "drinks" | "toys" | "rest" | "moments" | "themes";
export type CareShopCategoryId = Extract<ShopCategoryId, "treats" | "drinks" | "toys" | "rest">;
export type ShopTabId = "care" | "customize";
/**
 * Customize-tab sub filter. Reuses the "moments" id (rather than inventing a
 * separate "posePacks" id) so it stays aligned with the existing
 * `category=moments` routing alias below and with `CareShopCategoryId`'s
 * sibling `ShopCategoryId` values.
 */
export type CustomizeShopFilterId = "all" | Extract<ShopCategoryId, "moments" | "themes">;

const shopCategoryIds = new Set<ShopCategoryId>(["treats", "drinks", "toys", "rest", "moments", "themes"]);

const firstParamValue = (param: string | string[] | undefined): string | undefined =>
  Array.isArray(param) ? param[0] : param;

export const getInitialShopCategory = (param: string | string[] | undefined): ShopCategoryId => {
  const value = firstParamValue(param);

  return value && shopCategoryIds.has(value as ShopCategoryId) ? (value as ShopCategoryId) : "treats";
};

export const getInitialShopTab = (param: string | string[] | undefined): ShopTabId => {
  const category = getInitialShopCategory(param);

  return category === "moments" || category === "themes" ? "customize" : "care";
};

export const isCareShopCategory = (category: ShopCategoryId): category is CareShopCategoryId =>
  category === "treats" || category === "drinks" || category === "toys" || category === "rest";

export const getInitialCustomizeShopFilter = (param: string | string[] | undefined): CustomizeShopFilterId => {
  const category = getInitialShopCategory(param);

  return category === "moments" || category === "themes" ? category : "all";
};

export const getInitialExpressionPackId = (param: string | string[] | undefined): string | null => {
  const value = firstParamValue(param);

  return value && getExpressionPackById(value) ? value : null;
};
