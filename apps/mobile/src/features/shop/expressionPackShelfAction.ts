import type { ExpressionPackShopPresentation } from "./shopCatalogPresentation";

export type ExpressionPackShelfAction = "credits" | "disabled" | "unlock";

export const getExpressionPackShelfAction = (
  presentation: Pick<ExpressionPackShopPresentation, "canAct" | "status">
): ExpressionPackShelfAction => {
  if (presentation.status === "owned" || presentation.status === "generating" || presentation.status === "purchasing") {
    return "disabled";
  }

  if (presentation.status === "locked" || (presentation.status === "failed" && !presentation.canAct)) {
    return "credits";
  }

  return presentation.canAct ? "unlock" : "disabled";
};
