import { DEFAULT_THEME_ID, getCreditItemPrice, isTreatInventoryItem } from "@mongchi/shared";
import type { CommerceProduct, Entitlement, ExpressionPack, GeneratedAssetState, Inventory, Item, ItemId } from "@mongchi/shared";

// Starter kit items granted for free at signup (see mockInventory) — they
// have no purchase path and no in-game use beyond the fixed care-action
// bonus already baked into their base action (feed/play), so surfacing them
// as "Owned" shop entries would just be dead clutter on the shop shelves.
const nonShoppableStarterKitItemIds: ReadonlySet<ItemId> = new Set(["item_food_bowl_basic", "item_toy_ball_mint"]);

export const isNonShoppableStarterKitItem = (itemId: ItemId): boolean => nonShoppableStarterKitItemIds.has(itemId);

export type LocalShopCatalogStatusKind = "owned" | "premium" | "starter" | "available";

export interface LocalShopCatalogPresentation {
  locked: boolean;
  ownedQuantity: number;
  creditCost: number | null;
  repeatable: boolean;
  purchaseLabel: string | null;
  statusKind: LocalShopCatalogStatusKind;
  statusLabel: string;
}

export type PremiumPassShopSource = "server_catalog" | "local_preview";

export interface PremiumPassShopPresentation {
  active: boolean;
  product: CommerceProduct;
  source: PremiumPassShopSource;
  statusLabel: string;
}

export interface ShopSummaryPresentation {
  lockedCount: number;
  ownedQuantity: number;
  plusLabel: string;
  visibleCount: number;
}

export type ExpressionPackShopStatus = "owned" | "generating" | "purchasing" | "failed" | "available" | "locked";

export interface ExpressionPackShopPresentation {
  status: ExpressionPackShopStatus;
  ownedStateCount: number;
  totalStateCount: number;
  canAct: boolean;
  priceLabel: string;
  statusLabel: string;
  actionLabel: string;
}

interface ExpressionPackPurchaseStatusLike {
  readonly status: "pending" | "failed";
  readonly failureMessageSafe?: string;
}

export const premiumPassFallbackProduct: CommerceProduct = {
  productId: "premium_chat_monthly",
  entitlementKey: "premium_chat",
  grantType: "subscription"
};

const grantLabels: Record<CommerceProduct["grantType"], string> = {
  consumable: "Credit",
  durable: "Owned once",
  subscription: "Subscription"
};

export const isPremiumPassProduct = (product: CommerceProduct) =>
  product.productId === premiumPassFallbackProduct.productId || product.entitlementKey === premiumPassFallbackProduct.entitlementKey;

export const hasActiveProductEntitlement = (product: CommerceProduct, entitlements: Entitlement[]) =>
  entitlements.some(
    (entitlement) =>
      entitlement.status === "active" &&
      (entitlement.productId === product.productId || entitlement.key === product.entitlementKey)
  );

export const getPremiumPassShopPresentation = (
  commerceProducts: CommerceProduct[],
  entitlements: Entitlement[]
): PremiumPassShopPresentation => {
  const premiumProduct = commerceProducts.find(isPremiumPassProduct);
  const product = premiumProduct ?? premiumPassFallbackProduct;
  const active = hasActiveProductEntitlement(product, entitlements);

  return {
    active,
    product,
    source: premiumProduct ? "server_catalog" : "local_preview",
    statusLabel: active ? "Active" : premiumProduct ? grantLabels[product.grantType] : "Plus locked"
  };
};

export const getLocalShopCatalogPresentation = (item: Item, inventory: Inventory): LocalShopCatalogPresentation => {
  const ownedEntry = inventory.items.find((entry) => entry.itemId === item.id);
  const creditCost = getCreditItemPrice(item.id)?.creditCost ?? null;
  const repeatable = isTreatInventoryItem(item);

  if (ownedEntry) {
    return {
      locked: false,
      ownedQuantity: ownedEntry.quantity,
      creditCost,
      repeatable,
      purchaseLabel: repeatable && creditCost !== null ? "Buy more" : null,
      statusKind: "owned",
      statusLabel: `Owned x${ownedEntry.quantity}`
    };
  }

  if (item.isPremium) {
    return {
      locked: true,
      ownedQuantity: 0,
      creditCost,
      repeatable,
      purchaseLabel: creditCost !== null ? "Buy & place" : null,
      statusKind: "premium",
      statusLabel: "Premium preview"
    };
  }

  if (item.rarity === "starter") {
    return {
      locked: true,
      ownedQuantity: 0,
      creditCost,
      repeatable,
      purchaseLabel: creditCost !== null ? "Buy & place" : null,
      statusKind: "starter",
      statusLabel: "Starter"
    };
  }

  return {
    locked: true,
    ownedQuantity: 0,
    creditCost,
    repeatable,
    purchaseLabel: creditCost !== null ? "Buy & place" : null,
    statusKind: "available",
    statusLabel: creditCost !== null ? "Available" : "Preview"
  };
};

export const getLocalShopSummaryPresentation = (
  items: Item[],
  inventory: Inventory,
  premiumPass: PremiumPassShopPresentation
): ShopSummaryPresentation => {
  const itemPresentations = items.map((item) => getLocalShopCatalogPresentation(item, inventory));

  return {
    lockedCount: itemPresentations.filter((presentation) => presentation.locked).length,
    ownedQuantity: inventory.items.reduce((total, item) => total + item.quantity, 0),
    plusLabel: premiumPass.active ? "Active" : "Plus locked",
    visibleCount: items.length
  };
};

export const getExpressionPackShopPresentation = (
  pack: ExpressionPack,
  acceptedAssetStates: readonly GeneratedAssetState[],
  inventory: Inventory,
  purchaseStatus: ExpressionPackPurchaseStatusLike | undefined,
  devStoreUnlocked: boolean,
  creditBalance: number
): ExpressionPackShopPresentation => {
  const acceptedStateSet = new Set(acceptedAssetStates);
  const ownedStateCount = pack.states.filter((state) => acceptedStateSet.has(state)).length;
  const totalStateCount = pack.states.length;
  const fullyUnlocked = ownedStateCount === totalStateCount;
  const recordedOwned = (inventory.ownedExpressionPackIds ?? []).includes(pack.id);

  if (fullyUnlocked) {
    return {
      status: "owned",
      ownedStateCount,
      totalStateCount,
      canAct: false,
      priceLabel: "Owned",
      statusLabel: `${ownedStateCount}/${totalStateCount} kept`,
      actionLabel: "Owned"
    };
  }

  if (purchaseStatus?.status === "pending") {
    return {
      status: "purchasing",
      ownedStateCount,
      totalStateCount,
      canAct: false,
      priceLabel: "Making",
      statusLabel: "Generating",
      actionLabel: "Making..."
    };
  }

  const affordable = devStoreUnlocked || creditBalance >= pack.creditCost;

  if (purchaseStatus?.status === "failed") {
    return {
      status: "failed",
      ownedStateCount,
      totalStateCount,
      canAct: affordable,
      priceLabel: `${pack.creditCost} cr`,
      statusLabel: "Retry",
      actionLabel: affordable ? "Retry pack" : "Need credits"
    };
  }

  if (recordedOwned) {
    return {
      status: "generating",
      ownedStateCount,
      totalStateCount,
      canAct: false,
      priceLabel: "Saving",
      statusLabel: `${ownedStateCount}/${totalStateCount} ready`,
      actionLabel: "Saving..."
    };
  }

  return {
    status: affordable ? "available" : "locked",
    ownedStateCount,
    totalStateCount,
    canAct: affordable,
    priceLabel: `${pack.creditCost} cr`,
    statusLabel: affordable ? "Available" : "Locked",
    actionLabel: affordable ? "Unlock pack" : "Need credits"
  };
};

/**
 * The three states a garden theme card can be in -- see the "테마 BM 결함" fix.
 * Every theme (default included) renders through this single presentation
 * path now; there is no separate "free instant apply" list anymore.
 */
export type ThemeCardStatus = "default_free" | "locked_for_purchase" | "owned";

export interface ThemeCardPresentation {
  status: ThemeCardStatus;
  owned: boolean;
  applied: boolean;
  /** True when tapping this card's action button should do something (buy or apply). False only for an already-applied card. */
  canAct: boolean;
  priceLabel: string;
  statusLabel: string;
  actionLabel: string;
}

/**
 * Presents a single theme card's price/status/action-button copy from raw
 * ownership + selection state, so ShopPreviewScreen has one rendering path
 * for the default theme, an unpurchased theme, and an owned-but-not-applied
 * theme instead of the old two-list (free-apply vs buy-card) split.
 */
export const getThemeCardPresentation = (
  themeId: ItemId,
  creditCost: number,
  inventory: Inventory,
  devStoreUnlocked: boolean,
  creditBalance: number
): ThemeCardPresentation => {
  const applied = (inventory.selectedTerrariumThemeId ?? DEFAULT_THEME_ID) === themeId;
  const isDefault = themeId === DEFAULT_THEME_ID;
  const owned = isDefault || (inventory.ownedThemeIds ?? []).includes(themeId);

  if (isDefault) {
    return {
      status: "default_free",
      owned: true,
      applied,
      canAct: !applied,
      priceLabel: "Free",
      statusLabel: applied ? "Applied" : "Free",
      actionLabel: applied ? "Applied" : "Apply"
    };
  }

  if (owned) {
    return {
      status: "owned",
      owned: true,
      applied,
      canAct: !applied,
      priceLabel: applied ? "Applied" : "Owned",
      statusLabel: applied ? "Applied" : "Owned",
      actionLabel: applied ? "Applied" : "Apply"
    };
  }

  const affordable = devStoreUnlocked || creditBalance >= creditCost;

  return {
    status: "locked_for_purchase",
    owned: false,
    applied: false,
    canAct: affordable,
    priceLabel: `${creditCost} cr`,
    statusLabel: devStoreUnlocked ? "Dev open" : "Locked",
    actionLabel: "Unlock"
  };
};

export const getServerShopSummaryPresentation = (
  products: CommerceProduct[],
  entitlements: Entitlement[],
  premiumPass: PremiumPassShopPresentation
): ShopSummaryPresentation => {
  const visibleProducts = products.filter((product) => !isPremiumPassProduct(product));

  return {
    lockedCount: visibleProducts.filter((product) => !hasActiveProductEntitlement(product, entitlements)).length,
    ownedQuantity: entitlements.filter((entitlement) => entitlement.status === "active").length,
    plusLabel: premiumPass.active ? "Active" : "Plus locked",
    visibleCount: visibleProducts.length
  };
};
