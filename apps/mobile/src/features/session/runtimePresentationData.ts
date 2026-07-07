import {
  mockEntitlements,
  mockItems
} from "@mongchi/shared";
import type {
  Entitlement,
  Item
} from "@mongchi/shared";

import type { TerrariumRuntimeMode } from "./apiDailyLoopSession";

export const getRuntimeCatalogItems = (mode: TerrariumRuntimeMode, apiCatalogItems: Item[] | null): Item[] =>
  mode === "api" ? apiCatalogItems ?? [] : mockItems;

export const getRuntimeActiveEntitlements = (
  mode: TerrariumRuntimeMode,
  apiEntitlements: Entitlement[] | null
): Entitlement[] => (mode === "api" ? apiEntitlements ?? [] : mockEntitlements).filter((entitlement) => entitlement.status === "active");
