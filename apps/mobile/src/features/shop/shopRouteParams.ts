import { getExpressionPackById } from "@mongchi/shared";

export type ShopCategoryId = "treats" | "toysAndRest" | "moments" | "themes";

const shopCategoryIds = new Set<ShopCategoryId>(["treats", "toysAndRest", "moments", "themes"]);

const firstParamValue = (param: string | string[] | undefined): string | undefined =>
  Array.isArray(param) ? param[0] : param;

export const getInitialShopCategory = (param: string | string[] | undefined): ShopCategoryId => {
  const value = firstParamValue(param);

  return value && shopCategoryIds.has(value as ShopCategoryId) ? (value as ShopCategoryId) : "treats";
};

export const getInitialExpressionPackId = (param: string | string[] | undefined): string | null => {
  const value = firstParamValue(param);

  return value && getExpressionPackById(value) ? value : null;
};
