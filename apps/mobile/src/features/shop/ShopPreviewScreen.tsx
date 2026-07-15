import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { ImageSourcePropType } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { DEFAULT_THEME_ID, expressionPacks, themeBundles } from "@mongchi/shared";
import type { CareActionType, CommerceProduct, EntitlementKey, Item, ItemId } from "@mongchi/shared";
import { themeBackgroundSourceById } from "../../shared/assets/weatherSceneAssets";

import { normalizeAppLocale } from "../../localization/localeNormalization";
import { playSfx } from "../../shared/audio";
import { colors, shadows, spacing, useFontFamilies, useTypography } from "../../shared/design/tokens";
import { GameItemImage, gameItemAssetByCatalogId } from "../../shared/ui/GameIllustrations";
import type { GameItemAssetKey } from "../../shared/ui/GameIllustrations";
import { MongchiIcon } from "../../shared/ui/MongchiIcon";
import { useAppDialog } from "../../shared/ui/AppDialog";
import { ScreenHeaderRow } from "../../shared/ui/ScreenHeaderRow";
import { useTerrariumSession } from "../session/TerrariumSessionProvider";
import { CareMomentLayer } from "../terrarium/CareMomentLayer";
import { getCareMomentStaging } from "../terrarium/terrariumHomeCareMoment";
import {
  getLocalizedCatalogItemCopy,
  getLocalizedExpressionPackCopy,
  getLocalShopCatalogPresentation,
  getExpressionPackShopPresentation,
  getShopCareMomentPreviewAction,
  getThemeCardPresentation,
  hasActiveProductEntitlement,
  isNonShoppableStarterKitItem,
  isPremiumPassProduct,
  shouldShowOwnedQuantityBadge
} from "./shopCatalogPresentation";
import { balanceShopItemName, resolveShopGridLayout } from "./shopGridLayout";
import { ExpressionPackShelf } from "./ExpressionPackShelf";
import type { ExpressionPackShelfItem } from "./ExpressionPackShelf";
import {
  getInitialCustomizeShopFilter,
  getInitialExpressionPackId,
  getInitialShopCategory,
  getInitialShopTab,
  isCareShopCategory
} from "./shopRouteParams";
import type { CareShopCategoryId, CustomizeShopFilterId, ShopCategoryId, ShopTabId } from "./shopRouteParams";

// The moment components anchor themselves relative to "petStageBottomPx" --
// the home screen's much taller pet stage. The shop's previewArtFrame is a
// fixed 188px-tall panel, so 0 keeps every moment (bowl/ball/heart-burst)
// comfortably inside its bounds instead of the home screen's larger offsets.
const SHOP_PREVIEW_PET_STAGE_BOTTOM_PX = 0;

const productAssetById: Readonly<Record<string, GameItemAssetKey>> = {
  premium_chat_monthly: "gift",
  extra_pet_slot_1: "doghouse",
  regeneration_credit_1: "gem",
  theme_pack_starter: "flowerPot"
};

const fallbackAssetByEntitlement: Record<EntitlementKey, GameItemAssetKey> = {
  premium_chat: "gift",
  extra_pet_slot: "doghouse",
  regeneration_credit: "gem",
  theme_pack: "flowerPot",
  item_pack: "toyBall",
  treat_pack: "bone",
  subscription_plus: "gem"
};

type ProductCopyKey = "premiumChat" | "extraPetSlot" | "regenerationCredit" | "starterTheme" | "itemPack" | "treatPack" | "plusPass";

const productCopyKeyById: Readonly<Record<string, ProductCopyKey>> = {
  premium_chat_monthly: "premiumChat",
  extra_pet_slot_1: "extraPetSlot",
  regeneration_credit_1: "regenerationCredit",
  theme_pack_starter: "starterTheme"
};

const fallbackCopyKeyByEntitlement: Record<EntitlementKey, ProductCopyKey> = {
  premium_chat: "premiumChat",
  extra_pet_slot: "extraPetSlot",
  regeneration_credit: "regenerationCredit",
  theme_pack: "starterTheme",
  item_pack: "itemPack",
  treat_pack: "treatPack",
  subscription_plus: "plusPass"
};

const shopBackground = require("../../../assets/generated/backgrounds/candidates/shop-market-premium-v1-portrait.png");
/**
 * Shop categories: care consumables,
 * toy/rest comfort items, expression moments, and background-only garden
 * makeovers. Placeable home decor no longer exists as a shop concept -- the
 * garden background is a finished illustration.
 */
interface ShopEntry {
  id: string;
  category: ShopCategoryId;
  name: string;
  description: string;
  assetKey: GameItemAssetKey;
  statusLabel: string;
  priceLabel: string;
  ownedQuantity: number;
  canAct: boolean;
  kind: "local_item" | "commerce_product" | "theme" | "preview";
  /** Repeatable (consumable) local items keep showing their buy-more credit price once owned, so the grid card's price pill can't also carry the owned quantity -- the owned badge shows a small "x{n}" instead. See handleSelectedEntryAction's local_item branch for the buy-more flow this supports. */
  repeatable?: boolean;
  itemId?: ItemId;
  /** Set only for a theme entry that still needs purchasing (locked_for_purchase) -- see handleSelectedEntryAction. */
  themeBundleId?: string | null;
  themeStatus?: "default_free" | "locked_for_purchase" | "owned";
  product?: CommerceProduct;
  active?: boolean;
  previewImage?: ImageSourcePropType;
}

type CareShopFilterId = "all" | CareShopCategoryId;

const careShopFilterIds: readonly CareShopFilterId[] = ["all", "treats", "drinks", "toys", "rest"];

const getInitialCareShopFilter = (param: string | string[] | undefined): CareShopFilterId => {
  if (param === undefined) {
    return "all";
  }

  const category = getInitialShopCategory(param);

  return isCareShopCategory(category) ? category : "all";
};

const customizeShopFilterIds: readonly CustomizeShopFilterId[] = ["all", "moments", "themes"];

interface BackgroundThemeEntry {
  readonly id: ItemId;
  readonly bundleId: string | null;
  readonly copyKey: ThemeCopyKey;
  readonly creditCost: number;
  readonly previewImage: ImageSourcePropType;
}

type ThemeCopyKey = "default" | "fairy" | "seaside" | "autumn" | "winter";

const themeCopyKeyById: Readonly<Record<ItemId, ThemeCopyKey>> = {
  [DEFAULT_THEME_ID]: "default",
  "theme-fairy-garden": "fairy",
  "theme-seaside-cove": "seaside",
  "theme-autumn-woods": "autumn",
  "theme-winter-lights": "winter"
};

const defaultGardenPreviewImage = require("../../../assets/generated/backgrounds/candidates/home-garden-premium-v2-portrait.png");

/**
 * Single source of Themes-tab cards: the
 * always-free default garden plus every purchasable bundle from
 * themeBundles.ts. Every card renders through the same 3-state presentation
 * (getThemeCardPresentation) -- there is no more separate "free instant
 * apply" list living apart from the priced bundle cards.
 */
const backgroundThemeEntries: readonly BackgroundThemeEntry[] = [
  {
    id: DEFAULT_THEME_ID,
    bundleId: null,
    copyKey: "default",
    creditCost: 0,
    previewImage: defaultGardenPreviewImage
  },
  ...themeBundles.map((bundle) => ({
    id: bundle.themeId,
    bundleId: bundle.id,
    copyKey: themeCopyKeyById[bundle.themeId] ?? "default",
    creditCost: bundle.creditCost,
    previewImage: themeBackgroundSourceById[bundle.themeId] ?? defaultGardenPreviewImage
  }))
];

const getItemShopCategory = (item: Item): ShopCategoryId | null => {
  if (isNonShoppableStarterKitItem(item.id)) {
    return null;
  }

  if (item.category === "theme") {
    return "themes";
  }

  if (item.category === "drink" || item.behaviorTags.includes("drink")) {
    return "drinks";
  }

  if (item.category === "treat" || item.behaviorTags.includes("treat") || item.category === "food") {
    return "treats";
  }

  if (item.category === "toy") {
    return "toys";
  }

  if (item.category === "bed") {
    return "rest";
  }

  return null;
};

const getProductShopCategory = (product: CommerceProduct): ShopCategoryId | null => {
  if (product.entitlementKey === "theme_pack") {
    return "themes";
  }

  if (product.entitlementKey === "treat_pack") {
    return "treats";
  }

  if (product.entitlementKey === "item_pack") {
    return "toys";
  }

  return null;
};

export function ShopPreviewScreen() {
  const { category: requestedCategory, packId: requestedPackParam } = useLocalSearchParams<{
    category?: string | string[];
    packId?: string | string[];
  }>();
  const requestedPackId = getInitialExpressionPackId(requestedPackParam);
  const { showDialog } = useAppDialog();
  const { i18n, t } = useTranslation();
  const locale = normalizeAppLocale(i18n.resolvedLanguage);
  const shopCategoryLabels: Record<ShopCategoryId, string> = {
    treats: t("shop.categories.treats"),
    drinks: t("shop.categories.drinks"),
    toys: t("shop.categories.toys"),
    rest: t("shop.categories.rest"),
    moments: t("shop.categories.moments"),
    themes: t("shop.categories.themes")
  };
  const careShopFilterLabels: Record<CareShopFilterId, string> = {
    all: t("shop.categories.all"),
    treats: shopCategoryLabels.treats,
    drinks: shopCategoryLabels.drinks,
    toys: shopCategoryLabels.toys,
    rest: shopCategoryLabels.rest
  };
  const customizeShopFilterLabels: Record<CustomizeShopFilterId, string> = {
    all: t("shop.categories.all"),
    moments: shopCategoryLabels.moments,
    themes: shopCategoryLabels.themes
  };
  const shopTabLabels: Record<ShopTabId, string> = {
    care: t("shop.tabs.care"),
    customize: t("shop.tabs.customize")
  };
  const { fontScale, width: viewportWidth } = useWindowDimensions();
  const {
    activeEntitlements,
    acceptedAssets,
    applyTheme,
    catalogItems,
    commerceProducts,
    creditBalance,
    devStoreCreditsAvailable,
    devStoreUnlocked,
    expressionPackCreditBalance,
    hydrateCreditBalance,
    inventory,
    expressionPackPurchaseStatusById,
    nativeCheckoutReady,
    purchaseCatalogItem,
    purchaseExpressionPack,
    purchaseInProgressProductId,
    purchaseProduct,
    purchaseThemeBundle,
    runtimeMode
  } = useTerrariumSession();
  const typography = useTypography();
  const fontFamilies = useFontFamilies();

  // Credit Phase 1c trigger point (b): shop entry refreshes wallet.credits
  // from the server before the player sees prices (design doc §6.2). No-op
  // without a Supabase client or on a failed fetch -- the credit HUD just
  // keeps showing the last cached balance.
  useEffect(() => {
    void hydrateCreditBalance();
  }, [hydrateCreditBalance]);
  const useServerCatalog = runtimeMode === "api" && commerceProducts.length > 0;
  const checkoutAvailable = useServerCatalog && nativeCheckoutReady;
  // IAP-backed commerce products (credit packs, subscriptions) render as
  // browsable-but-unbuyable "Soon" cards whenever native checkout isn't wired
  // up for this build (checkoutAvailable false) -- that reads as a broken
  // shop, not a coming-soon shelf. Hide them outside __DEV__ so a production
  // build with checkout not yet enabled shows an honest empty shelf instead.
  // Re-enable at launch once EXPO_PUBLIC_TINY_PET_ENABLE_NATIVE_CHECKOUT is
  // on and checkout is verified end-to-end.
  const showUnwiredCommerceProducts = __DEV__ || checkoutAvailable;
  const visibleCommerceProducts =
    useServerCatalog && showUnwiredCommerceProducts
      ? commerceProducts.filter(
          (product) => product.productId !== "regeneration_credit_1" && !isPremiumPassProduct(product) && getProductShopCategory(product) !== null
        )
      : [];
  const localShopItems = catalogItems
    .filter((item) => getItemShopCategory(item) !== null)
    .map((item) => {
      const presentation = getLocalShopCatalogPresentation(item, inventory, locale);
      const assetKey = gameItemAssetByCatalogId[item.id] ?? "flowerPot";
      const canBuyWithCredits =
        presentation.purchaseLabel !== null && presentation.creditCost !== null && (devStoreUnlocked || creditBalance >= presentation.creditCost);
      const showCreditPurchase = presentation.purchaseLabel !== null && (presentation.locked || presentation.repeatable);

      return {
        assetKey,
        canBuyWithCredits,
        item,
        presentation,
        showCreditPurchase
      };
    });
  const [selectedTab, setSelectedTab] = useState<ShopTabId>(() => getInitialShopTab(requestedCategory));
  const [selectedCareFilter, setSelectedCareFilter] = useState<CareShopFilterId>(() => getInitialCareShopFilter(requestedCategory));
  const [selectedCustomizeFilter, setSelectedCustomizeFilter] = useState<CustomizeShopFilterId>(() =>
    getInitialCustomizeShopFilter(requestedCategory)
  );
  const displayedCreditBalance = creditBalance;
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [shopShelfWidth, setShopShelfWidth] = useState(() => Math.max(0, viewportWidth - spacing.lg * 2));
  const shopGridLayout = useMemo(() => resolveShopGridLayout({ containerWidth: shopShelfWidth, fontScale }), [fontScale, shopShelfWidth]);
  const shopProductCardWidthStyle = useMemo(() => ({ width: shopGridLayout.cardWidth }), [shopGridLayout.cardWidth]);
  const acceptedAssetStates = useMemo(() => acceptedAssets.map((asset) => asset.state), [acceptedAssets]);
  useEffect(() => {
    setSelectedTab(getInitialShopTab(requestedCategory));
    setSelectedCareFilter(getInitialCareShopFilter(requestedCategory));
    setSelectedCustomizeFilter(getInitialCustomizeShopFilter(requestedCategory));
  }, [requestedCategory]);
  const themeEntries = useMemo<ShopEntry[]>(
    () =>
      backgroundThemeEntries.map((theme) => {
        const presentation = getThemeCardPresentation(theme.id, theme.creditCost, inventory, devStoreUnlocked, creditBalance, locale);

        return {
          id: `theme-${theme.id}`,
          category: "themes",
          name: t(`shop.themes.${theme.copyKey}Name`),
          description: t(`shop.themes.${theme.copyKey}Description`),
          assetKey: "seasonalFlowers",
          statusLabel: presentation.statusLabel,
          priceLabel: presentation.priceLabel,
          ownedQuantity: presentation.owned ? 1 : 0,
          canAct: presentation.canAct,
          kind: "theme",
          itemId: theme.id,
          themeBundleId: theme.bundleId,
          themeStatus: presentation.status,
          previewImage: theme.previewImage
        };
      }),
    [creditBalance, devStoreUnlocked, inventory, locale, t]
  );

  const localShopEntries = useMemo<ShopEntry[]>(
    () =>
      localShopItems.reduce<ShopEntry[]>((entries, { assetKey, canBuyWithCredits, item, presentation, showCreditPurchase }) => {
        const category = getItemShopCategory(item);

        if (!category) {
          return entries;
        }

        const owned = presentation.ownedQuantity > 0;
        const copy = getLocalizedCatalogItemCopy(item, locale);
        // Owned, non-repeatable items with nothing left to buy (purchaseLabel
        // null) are simply owned and settled — nothing more to do with them.
        const ownedAndSettled = owned && !showCreditPurchase;

        entries.push({
          id: `local-${item.id}`,
          category,
          name: copy.name,
          description: copy.description,
          assetKey,
          statusLabel: ownedAndSettled
            ? t("shop.owned")
            : owned
              ? t("shop.ownedQuantity", { count: presentation.ownedQuantity })
              : devStoreUnlocked && showCreditPurchase
                ? t("shop.devOpen")
                : showCreditPurchase
                  ? t("shop.available")
                  : presentation.statusLabel,
          priceLabel:
            owned && !presentation.repeatable
              ? t("shop.ownedQuantity", { count: presentation.ownedQuantity })
              : presentation.creditCost !== null
                ? `${presentation.creditCost}`
                : presentation.statusLabel,
          ownedQuantity: presentation.ownedQuantity,
          canAct: ownedAndSettled ? false : showCreditPurchase && canBuyWithCredits,
          kind: "local_item",
          repeatable: presentation.repeatable,
          itemId: item.id
        });

        return entries;
      }, []),
    [devStoreUnlocked, localShopItems, locale, t]
  );

  const commerceShopEntries = useMemo<ShopEntry[]>(
    () =>
      visibleCommerceProducts.reduce<ShopEntry[]>((entries, product) => {
        const category = getProductShopCategory(product);

        if (!category) {
          return entries;
        }

        const copyKey = productCopyKeyById[product.productId] ?? fallbackCopyKeyByEntitlement[product.entitlementKey];
        const copy = {
          name: t(`shop.products.${copyKey}.name`),
          description: t(`shop.products.${copyKey}.description`),
          item: productAssetById[product.productId] ?? fallbackAssetByEntitlement[product.entitlementKey]
        };
        const active = hasActiveProductEntitlement(product, activeEntitlements);
        const grantLabel = t(`shop.grants.${product.grantType}`);

        entries.push({
          id: `product-${product.productId}`,
          category,
          name: copy.name,
          description: copy.description,
          assetKey: copy.item,
          statusLabel: active ? t("shop.owned") : grantLabel,
          priceLabel: active ? t("shop.owned") : grantLabel,
          ownedQuantity: active ? 1 : 0,
          canAct: !active && checkoutAvailable && purchaseInProgressProductId === null,
          kind: "commerce_product",
          product,
          active
        });

        return entries;
      }, []),
    [activeEntitlements, checkoutAvailable, purchaseInProgressProductId, t, visibleCommerceProducts]
  );

  const expressionPackShelfItems = useMemo<ExpressionPackShelfItem[]>(() => {
    const items = expressionPacks.map((pack) => ({
      pack,
      presentation: getExpressionPackShopPresentation(
        pack,
        acceptedAssetStates,
        inventory,
        expressionPackPurchaseStatusById[pack.id],
        devStoreCreditsAvailable,
        expressionPackCreditBalance,
        locale
      )
    }));
    const requestedItem = requestedPackId ? items.find((item) => item.pack.id === requestedPackId) : undefined;

    return requestedItem ? [requestedItem, ...items.filter((item) => item.pack.id !== requestedPackId)] : items;
  }, [acceptedAssetStates, devStoreCreditsAvailable, expressionPackCreditBalance, expressionPackPurchaseStatusById, inventory, locale, requestedPackId]);

  const shopEntries = useMemo<ShopEntry[]>(() => {
    return [...localShopEntries, ...commerceShopEntries, ...themeEntries];
  }, [commerceShopEntries, localShopEntries, themeEntries]);

  const shopSummary = useMemo(() => {
    const expressionPackOwnedStateCount = expressionPackShelfItems.reduce(
      (total, item) => total + item.presentation.ownedStateCount,
      0
    );
    const lockedExpressionPackCount = expressionPackShelfItems.filter((item) => item.presentation.status !== "owned").length;

    return {
      ownedQuantity: shopEntries.reduce((total, entry) => total + entry.ownedQuantity, expressionPackOwnedStateCount),
      lockedCount: devStoreUnlocked
        ? 0
        : shopEntries.filter((entry) => entry.ownedQuantity === 0).length + lockedExpressionPackCount
    };
  }, [devStoreUnlocked, expressionPackShelfItems, shopEntries]);

  const entriesByCategory = useMemo<Record<ShopCategoryId, ShopEntry[]>>(
    () => ({
      treats: shopEntries.filter((entry) => entry.category === "treats"),
      drinks: shopEntries.filter((entry) => entry.category === "drinks"),
      toys: shopEntries.filter((entry) => entry.category === "toys"),
      rest: shopEntries.filter((entry) => entry.category === "rest"),
      moments: shopEntries.filter((entry) => entry.category === "moments"),
      themes: shopEntries.filter((entry) => entry.category === "themes")
    }),
    [shopEntries]
  );

  const careShopEntries = useMemo(
    () => [...entriesByCategory.treats, ...entriesByCategory.drinks, ...entriesByCategory.toys, ...entriesByCategory.rest],
    [entriesByCategory]
  );
  const selectedTabEntries = selectedTab === "care"
    ? selectedCareFilter === "all"
      ? careShopEntries
      : entriesByCategory[selectedCareFilter]
    : entriesByCategory.themes;
  const fallbackCategory: ShopCategoryId = selectedTab === "care" ? "treats" : "themes";
  const fallbackPreviewEntry: ShopEntry = {
    id: "empty-shop-preview",
    category: fallbackCategory,
    name: shopTabLabels[selectedTab],
    description: t("shop.emptyPreview"),
    assetKey: selectedTab === "care" ? "treatPlate" : "seasonalFlowers",
    statusLabel: t("shop.comingSoon"),
    priceLabel: t("shop.soon"),
    ownedQuantity: 0,
    canAct: false,
    kind: "preview"
  };
  const selectedEntry = selectedTabEntries.find((entry) => entry.id === selectedEntryId) ?? selectedTabEntries[0] ?? fallbackPreviewEntry;
  // Care items (treats/drinks/toys/rest) get the animated care-moment
  // preview; themes keep their static backdrop image and the fallback
  // "shelf is being stocked" card has no real action to preview.
  const carePreviewAction: CareActionType | null =
    selectedTab === "care" && selectedEntry.kind !== "preview" ? getShopCareMomentPreviewAction(selectedEntry.category) : null;
  // Passing the selected entry's itemId swaps the moment's generic category
  // art for that specific item's own "action" art (see
  // terrariumHomeCareMoment.ts's getCareMomentStaging) -- undefined for
  // commerce/theme/preview entries, which just falls back to the base staging.
  const carePreviewStaging = carePreviewAction ? getCareMomentStaging(carePreviewAction, selectedEntry.itemId) : null;
  const [carePreviewActedAtMs, setCarePreviewActedAtMs] = useState(() => Date.now());
  useEffect(() => {
    if (carePreviewStaging) {
      // Re-stamping actedAtMs remounts CareMomentLayer's keyed moment
      // component (see its `key={actedAtMs}`), replaying the animation every
      // time a different care item is selected or the screen (re)opens.
      setCarePreviewActedAtMs(Date.now());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carePreviewAction, selectedEntry.id]);
  const selectedEntryCanPress = selectedEntry.canAct;
  const selectedEntryActionPresentation = (() => {
    if (selectedEntry.kind === "theme") {
      if (selectedEntry.themeStatus === "locked_for_purchase") {
        return {
          accessibilityLabel: selectedEntry.canAct
            ? t("shop.actionAccessibility.unlockTheme", { name: selectedEntry.name, price: selectedEntry.priceLabel })
            : t("shop.actionAccessibility.themeLocked", { name: selectedEntry.name }),
          label: selectedEntry.canAct ? t("shop.actions.unlockTheme") : t("shop.locked")
        };
      }

      return {
        accessibilityLabel: selectedEntry.canAct
          ? t("shop.actionAccessibility.applyTheme", { name: selectedEntry.name })
          : t("shop.actionAccessibility.themeApplied", { name: selectedEntry.name }),
        label: selectedEntry.canAct ? t("shop.actions.applyTheme") : t("common.actions.applied")
      };
    }

    return {
      accessibilityLabel: selectedEntry.canAct
        ? t("shop.actionAccessibility.buy", { name: selectedEntry.name })
        : selectedEntry.statusLabel,
      label: selectedEntry.canAct
        ? t("shop.actions.getItem")
        : selectedEntry.ownedQuantity > 0
          ? t("shop.owned")
          : t("shop.locked")
    };
  })();
  const shopTabs: readonly { id: ShopTabId; label: string; count: number }[] = [
    {
      id: "care",
      label: shopTabLabels.care,
      count: careShopEntries.length
    },
    {
      id: "customize",
      label: shopTabLabels.customize,
      count: expressionPackShelfItems.length + entriesByCategory.themes.length
    }
  ];

  const handlePurchase = (product: CommerceProduct) => {
    void purchaseProduct(product).then((result) => {
      if (!result.ok) {
        showDialog({
          title: t("shop.dialogs.checkout"),
          message: locale === "en-US" ? result.messageSafe : t("shop.dialogs.checkoutFailed")
        });
        return;
      }

      // Dedicated purchase chime (docs/gamefeel-sound-plan.md §2's "purchase
      // feedback avoids a casino-like sound" call, fulfilled by sfx_purchase --
      // see sfxCueContracts.ts's "purchase" dedicated cue).
      playSfx("sfx_purchase");
    });
  };

  const handleCreditItemPurchase = (itemId: ItemId) => {
    void purchaseCatalogItem(itemId).then((result) => {
      if (!result.ok) {
        showDialog({
          title: t("shop.dialogs.shop"),
          message: locale === "en-US" ? result.messageSafe : t("shop.dialogs.shopFailed")
        });
        return;
      }

      playSfx("sfx_purchase");
      showDialog({
        title: t("shop.dialogs.itemAdded"),
        message: locale === "en-US" ? result.messageSafe : t("shop.dialogs.itemAddedMessage"),
        primaryLabel: t("common.actions.ok")
      });
    });
  };

  const handleExpressionPackPurchase = (packId: string) => {
    void purchaseExpressionPack(packId).then((result) => {
      if (!result.ok) {
        showDialog({
          title: t("shop.dialogs.posePack"),
          message: locale === "en-US" ? result.messageSafe : t("shop.dialogs.posePackFailed")
        });
        return;
      }

      if (!result.started) {
        return;
      }

      playSfx("sfx_purchase");
      showDialog({
        title: t("shop.dialogs.posesOnWay"),
        message: locale === "en-US" ? result.messageSafe : t("shop.dialogs.posesOnWayMessage"),
        primaryLabel: t("common.actions.ok"),
        secondaryLabel: t("common.actions.seeProfile"),
        onSecondary: () => router.replace("/friend")
      });
    });
  };

  const handleSelectedEntryAction = (entry: ShopEntry) => {
    if (entry.kind === "local_item" && entry.itemId && entry.canAct) {
      handleCreditItemPurchase(entry.itemId);
      return;
    }

    if (entry.kind === "commerce_product" && entry.product && entry.canAct) {
      handlePurchase(entry.product);
      return;
    }

    if (entry.kind === "theme" && entry.itemId && entry.canAct) {
      const handleThemeResult = (result: ReturnType<typeof applyTheme>) => {
        if (!result.ok) {
          showDialog({
            title: t("shop.dialogs.theme"),
            message: locale === "en-US" ? result.messageSafe : t("shop.dialogs.themeFailed")
          });
          return;
        }

        showDialog({
          title: entry.themeStatus === "locked_for_purchase" ? t("shop.dialogs.makeover") : t("shop.dialogs.themeApplied"),
          message: t("shop.dialogs.themeAppliedMessage", { name: entry.name }),
          primaryLabel: t("common.actions.ok"),
          secondaryLabel: t("common.actions.viewHome"),
          onSecondary: () => router.replace("/terrarium")
        });
      };

      // Locked (unpurchased) themes spend credits once via purchaseThemeBundle
      // (an async server round-trip against the live Supabase shop); the
      // default theme and any already-owned theme just re-apply for free via
      // applyTheme, which refuses anything not in ownedThemeIds and stays
      // synchronous.
      if (entry.themeStatus === "locked_for_purchase" && entry.themeBundleId) {
        void purchaseThemeBundle(entry.themeBundleId).then(handleThemeResult);
      } else {
        handleThemeResult(applyTheme(entry.itemId));
      }
      return;
    }
  };

  const renderShopGrid = (entries: readonly ShopEntry[]) => (
    <View
      style={styles.shopShelf}
      onLayout={({ nativeEvent }) => {
        const measuredWidth = nativeEvent.layout.width;
        setShopShelfWidth((currentWidth) => (Math.abs(currentWidth - measuredWidth) > 0.5 ? measuredWidth : currentWidth));
      }}
    >
      {entries.length > 0 ? (
        entries.map((entry) => {
          const selected = selectedEntry.id === entry.id;
          const keepLatinNameOnOneLine = !entry.name.includes(" ") && !["ja-JP", "ko-KR", "zh-TW"].includes(locale);

          return (
            <Pressable
              key={entry.id}
              accessibilityLabel={`${entry.name}. ${entry.statusLabel}.`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.productCard,
                shopProductCardWidthStyle,
                selected ? styles.productCardSelected : null,
                pressed ? styles.productCardPressed : null
              ]}
              onPress={() => setSelectedEntryId(entry.id)}
            >
              {entry.ownedQuantity > 0 ? (
                <View style={styles.productOwnedBadge}>
                  <MongchiIcon id="owned" size={18} />
                  {shouldShowOwnedQuantityBadge(entry) ? (
                    <Text style={[typography.label, styles.productOwnedBadgeText]}>{`x${entry.ownedQuantity}`}</Text>
                  ) : null}
                </View>
              ) : null}
              {entry.previewImage ? (
                <Image
                  accessibilityIgnoresInvertColors
                  accessibilityLabel={t("shop.backgroundThumbnail", { name: entry.name })}
                  resizeMode="cover"
                  source={entry.previewImage}
                  style={styles.productPreviewImage}
                />
              ) : (
                <GameItemImage
                  accessibilityLabel={t("shop.itemIcon", { name: entry.name })}
                  item={entry.assetKey}
                  style={styles.productIcon}
                  variant="ui"
                />
              )}
              <Text
                adjustsFontSizeToFit={shopGridLayout.columnCount > 2}
                lineBreakStrategyIOS={locale === "ko-KR" ? "hangul-word" : locale === "ja-JP" ? "push-out" : "standard"}
                minimumFontScale={keepLatinNameOnOneLine ? 0.58 : 0.72}
                numberOfLines={keepLatinNameOnOneLine ? 1 : 2}
                style={[styles.productName, typography.label]}
              >
                {balanceShopItemName(entry.name)}
              </Text>
              <View style={[styles.productPrice, entry.ownedQuantity > 0 ? styles.productOwnedPrice : null]}>
                {entry.ownedQuantity > 0 ? (
                  <MongchiIcon id="owned" size={18} />
                ) : (
                  <GameItemImage
                    accessibilityLabel={t("shop.gemPriceAccessibilityLabel")}
                    decorative
                    item="gem"
                    style={styles.productPriceIcon}
                    variant="hud"
                  />
                )}
                <Text style={[styles.productPriceText, typography.label]}>{entry.priceLabel}</Text>
              </View>
            </Pressable>
          );
        })
      ) : (
        <View style={styles.emptyShelf}>
          <Text style={[styles.emptyShelfText, typography.body]}>{t("shop.emptyShelf")}</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.sceneRoot}>
      <ImageBackground accessibilityElementsHidden resizeMode="cover" source={shopBackground} style={styles.sceneBackground}>
        <View style={styles.sceneWash} />
      </ImageBackground>
      <SafeAreaView accessibilityLabel={t("shop.accessibilityLabel")} edges={["top", "right", "bottom", "left"]} style={styles.sceneSafe}>
        <ScrollView bounces={false} contentContainerStyle={styles.sceneContent} showsVerticalScrollIndicator={false}>
          <ScreenHeaderRow
            backAccessibilityLabel={t("shop.back")}
            right={
              <Pressable
                accessibilityLabel={t("shop.walletAccessibilityLabel", {
                  credits: displayedCreditBalance,
                  owned: shopSummary.ownedQuantity
                })}
                accessibilityHint={t("shop.openCreditStore")}
                accessibilityRole="button"
                style={({ pressed }) => [styles.creditHud, pressed ? styles.creditHudPressed : null]}
                onPress={() => router.push("/credits")}
              >
                <GameItemImage accessibilityLabel={t("shop.creditGemAccessibilityLabel")} decorative item="gem" style={styles.creditHudIcon} variant="hud" />
                <Text style={[styles.creditHudText, typography.label]}>{displayedCreditBalance}</Text>
                <MongchiIcon id="forward" size={16} />
              </Pressable>
            }
            style={styles.headerRow}
            title={t("shop.title")}
            titleFontFamily={fontFamilies.title}
            onBack={() => router.replace("/terrarium")}
          />

          <View style={styles.shopCategoryTabs}>
            {shopTabs.map((tab) => (
              <Pressable
                key={tab.id}
                accessibilityRole="button"
                accessibilityLabel={t("shop.categoryAccessibilityLabel", {
                  label: tab.label,
                  count: tab.count
                })}
                accessibilityState={{ selected: selectedTab === tab.id }}
                style={[styles.categoryTab, selectedTab === tab.id ? styles.categoryTabActive : null]}
                onPress={() => {
                  setSelectedTab(tab.id);
                  setSelectedEntryId(tab.id === "care" ? selectedTabEntries[0]?.id ?? careShopEntries[0]?.id ?? null : entriesByCategory.themes[0]?.id ?? null);
                }}
              >
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                  numberOfLines={2}
                  style={[styles.categoryTabText, typography.label, selectedTab === tab.id ? styles.categoryTabTextActive : null]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {selectedTab === "care" ? (
            <View accessibilityLabel={t("shop.careFiltersAccessibilityLabel")} style={styles.careFilterRow}>
              {careShopFilterIds.map((filterId) => {
                const selected = selectedCareFilter === filterId;
                const count = filterId === "all" ? careShopEntries.length : entriesByCategory[filterId].length;

                return (
                  <Pressable
                    key={filterId}
                    accessibilityLabel={t("shop.categoryAccessibilityLabel", {
                      label: careShopFilterLabels[filterId],
                      count
                    })}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={[styles.careFilterChip, selected ? styles.careFilterChipActive : null]}
                    onPress={() => {
                      const nextEntries = filterId === "all" ? careShopEntries : entriesByCategory[filterId];
                      setSelectedCareFilter(filterId);
                      setSelectedEntryId(nextEntries[0]?.id ?? null);
                    }}
                  >
                    <Text
                      adjustsFontSizeToFit
                      minimumFontScale={0.58}
                      numberOfLines={1}
                      style={[styles.careFilterText, typography.label, selected ? styles.careFilterTextActive : null]}
                    >
                      {careShopFilterLabels[filterId]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {selectedTab === "customize" ? (
            <View accessibilityLabel={t("shop.customizeFiltersAccessibilityLabel")} style={styles.careFilterRow}>
              {customizeShopFilterIds.map((filterId) => {
                const selected = selectedCustomizeFilter === filterId;
                const count =
                  filterId === "all"
                    ? expressionPackShelfItems.length + entriesByCategory.themes.length
                    : filterId === "moments"
                      ? expressionPackShelfItems.length
                      : entriesByCategory.themes.length;

                return (
                  <Pressable
                    key={filterId}
                    accessibilityLabel={t("shop.categoryAccessibilityLabel", {
                      label: customizeShopFilterLabels[filterId],
                      count
                    })}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={[styles.careFilterChip, selected ? styles.careFilterChipActive : null]}
                    onPress={() => {
                      setSelectedCustomizeFilter(filterId);
                      if (filterId !== "moments") {
                        setSelectedEntryId(entriesByCategory.themes[0]?.id ?? null);
                      }
                    }}
                  >
                    <Text
                      adjustsFontSizeToFit
                      minimumFontScale={0.58}
                      numberOfLines={1}
                      style={[styles.careFilterText, typography.label, selected ? styles.careFilterTextActive : null]}
                    >
                      {customizeShopFilterLabels[filterId]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {selectedTab === "care" || selectedCustomizeFilter !== "moments" ? (
            <View style={styles.itemPreviewPanel}>
              <View style={styles.previewArtFrame}>
                <View style={styles.previewGlow} />
                {selectedEntry.previewImage ? (
                  <Image
                    accessibilityIgnoresInvertColors
                    accessibilityLabel={t("shop.backgroundPreview", {
                      name: selectedEntry.name
                    })}
                    resizeMode="cover"
                    source={selectedEntry.previewImage}
                    style={styles.previewBackgroundImage}
                  />
                ) : (
                  <>
                    <GameItemImage
                      accessibilityLabel={t("shop.largePreview", {
                        name: selectedEntry.name
                      })}
                      item={selectedEntry.assetKey}
                      style={styles.previewIcon}
                      variant="ui"
                    />
                    {carePreviewAction && carePreviewStaging ? (
                      <CareMomentLayer
                        action={carePreviewAction}
                        actedAtMs={carePreviewActedAtMs}
                        itemId={selectedEntry.itemId ?? null}
                        petStageBottomPx={SHOP_PREVIEW_PET_STAGE_BOTTOM_PX}
                      />
                    ) : null}
                  </>
                )}
              </View>
              <View style={styles.previewCopy}>
                <Text style={[styles.featuredEyebrow, typography.label]}>{shopCategoryLabels[selectedEntry.category]}</Text>
                <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={2} style={[styles.featuredItemName, typography.title]}>
                  {selectedEntry.name}
                </Text>
                <Text
                  adjustsFontSizeToFit
                  lineBreakStrategyIOS={locale === "ko-KR" ? "hangul-word" : locale === "ja-JP" ? "push-out" : "standard"}
                  minimumFontScale={0.74}
                  numberOfLines={2}
                  style={[styles.featuredItemDescription, typography.body]}
                >
                  {selectedEntry.description}
                </Text>
              </View>
              <View style={styles.previewFooter}>
                <View style={[styles.featuredOwnedPill, selectedEntry.ownedQuantity > 0 ? styles.featuredOwnedPillActive : null]}>
                  {selectedEntry.ownedQuantity > 0 ? (
                    <MongchiIcon id="owned" size={18} />
                  ) : selectedEntryCanPress ? (
                    <MongchiIcon id="gift" size={18} />
                  ) : (
                    <MongchiIcon id="lock" size={18} />
                  )}
                  <Text style={[styles.featuredOwnedText, typography.label]}>{selectedEntry.statusLabel}</Text>
                </View>
                <View accessibilityLabel={t("shop.pricesAccessibilityLabel")} style={styles.previewPricePill}>
                  <GameItemImage
                    accessibilityLabel={t("shop.walletGemAccessibilityLabel")}
                    decorative
                    item="gem"
                    style={styles.productPriceIcon}
                    variant="hud"
                  />
                  <Text style={[styles.productPriceText, typography.label]}>{selectedEntry.priceLabel}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={selectedEntryActionPresentation.accessibilityLabel}
                  accessibilityState={{ disabled: !selectedEntryCanPress }}
                  disabled={!selectedEntryCanPress}
                  style={({ pressed }) => [
                    styles.previewActionButton,
                    pressed ? styles.productCardPressed : null,
                    !selectedEntryCanPress ? styles.previewActionDisabled : null
                  ]}
                  onPress={() => handleSelectedEntryAction(selectedEntry)}
                >
                  <Text adjustsFontSizeToFit minimumFontScale={0.74} numberOfLines={1} style={[styles.previewActionText, typography.button]}>
                    {selectedEntryActionPresentation.label}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {selectedTab === "customize" ? (
            <>
              {selectedCustomizeFilter === "all" || selectedCustomizeFilter === "moments" ? (
                <>
                  <View style={styles.shopSectionHeader}>
                    <Text style={[styles.shopSectionTitle, typography.title]}>{t("shop.sections.posePacks")}</Text>
                    <Text style={[styles.shopSectionBody, typography.body]}>{t("shop.sections.posePacksDescription")}</Text>
                  </View>
                  <ExpressionPackShelf
                    items={expressionPackShelfItems}
                    ownedStates={acceptedAssetStates}
                    onOpenCreditStore={() => router.push("/credits")}
                    onUnlockPack={handleExpressionPackPurchase}
                  />
                </>
              ) : null}
              {selectedCustomizeFilter === "all" || selectedCustomizeFilter === "themes" ? (
                <>
                  <View style={styles.shopSectionHeader}>
                    <Text style={[styles.shopSectionTitle, typography.title]}>{t("shop.sections.themes")}</Text>
                    <Text style={[styles.shopSectionBody, typography.body]}>{t("shop.sections.themesDescription")}</Text>
                  </View>
                  {renderShopGrid(entriesByCategory.themes)}
                </>
              ) : null}
            </>
          ) : (
            <>
              <View style={styles.shopSectionHeader}>
                <Text style={[styles.shopSectionTitle, typography.title]}>{t("shop.sections.careItems")}</Text>
                <Text
                  adjustsFontSizeToFit
                  lineBreakStrategyIOS={locale === "ko-KR" ? "hangul-word" : "standard"}
                  minimumFontScale={0.9}
                  numberOfLines={2}
                  style={[styles.shopSectionBody, typography.body]}
                >
                  {t("shop.sections.careItemsDescription")}
                </Text>
              </View>
              {renderShopGrid(selectedTabEntries)}
            </>
          )}

          <View
            accessibilityLabel={t("shop.summary.accessibilityLabel", {
              owned: shopSummary.ownedQuantity,
              locked: shopSummary.lockedCount
            })}
            style={styles.shopAccessibilitySummary}
          >
            <Text>{t("shop.summary.owned")}</Text>
            <Text>{t("shop.summary.locked", { count: shopSummary.lockedCount })}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  sceneRoot: {
    flex: 1,
    backgroundColor: colors.skySoft
  },
  sceneBackground: {
    position: "absolute",
    top: -96,
    right: 0,
    bottom: -96,
    left: 0
  },
  sceneWash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(255,245,222,0.08)"
  },
  sceneSafe: {
    flex: 1
  },
  sceneContent: {
    flexGrow: 1,
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl
  },
  headerRow: {
    zIndex: 20
  },
  itemPreviewPanel: {
    minHeight: 286,
    borderRadius: 30,
    borderWidth: 4,
    borderBottomWidth: 7,
    borderColor: colors.cream,
    backgroundColor: "rgba(255,245,222,0.83)",
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.gamePanel
  },
  previewArtFrame: {
    height: 188,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.44)",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.76)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  previewGlow: {
    position: "absolute",
    bottom: 18,
    width: 188,
    height: 74,
    borderRadius: 999,
    backgroundColor: "rgba(255,232,199,0.6)"
  },
  previewIcon: {
    width: 138,
    height: 138
  },
  previewBackgroundImage: {
    width: "100%",
    height: "100%",
    borderRadius: 22,
    backgroundColor: "rgba(255,245,222,0.62)"
  },
  previewCopy: {
    gap: spacing.xs
  },
  previewFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  previewPricePill: {
    minHeight: 32,
    borderRadius: 16,
    backgroundColor: colors.cream,
    borderWidth: 2,
    borderColor: colors.parchment,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3
  },
  previewActionButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 19,
    backgroundColor: colors.apple,
    borderWidth: 3,
    borderBottomWidth: 5,
    borderColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm
  },
  previewActionDisabled: {
    opacity: 0.7
  },
  previewActionText: {
    color: colors.white
  },
  shopCategoryTabs: {
    minHeight: 50,
    borderRadius: 22,
    backgroundColor: "rgba(255,245,222,0.72)",
    borderWidth: 3,
    borderColor: colors.cream,
    padding: 5,
    flexDirection: "row",
    gap: 5
  },
  // Same tone/radius/border as shopCategoryTabs above it, so the sub-category
  // chip row reads as a matching second tier of the tab bar instead of a
  // loose row of floating pills.
  careFilterRow: {
    minHeight: 50,
    borderRadius: 22,
    backgroundColor: "rgba(255,245,222,0.72)",
    borderWidth: 3,
    borderColor: colors.cream,
    padding: 5,
    flexDirection: "row",
    gap: 4,
    width: "100%"
  },
  careFilterChip: {
    flex: 1,
    minWidth: 0,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: colors.cream,
    backgroundColor: "rgba(255,245,222,0.82)",
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center"
  },
  careFilterChipActive: {
    backgroundColor: colors.apple,
    borderColor: colors.white
  },
  careFilterText: {
    color: colors.woodDark,
    textAlign: "center"
  },
  careFilterTextActive: {
    color: colors.white
  },
  // Rounded to match the cream/bordered container family above it
  // (shopCategoryTabs at 22, itemPreviewPanel at 30) instead of sitting as a
  // sharp-cornered strip -- shared by every section header, care and
  // customize tab alike (Treats/drinks & toys, Pose packs, Garden themes).
  shopSectionHeader: {
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 22,
    backgroundColor: "rgba(255,245,222,0.74)",
    borderWidth: 2,
    borderColor: colors.cream
  },
  shopSectionTitle: {
    color: colors.ink
  },
  shopSectionBody: {
    color: colors.woodDark
  },
  categoryTab: {
    flex: 1,
    minHeight: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4
  },
  categoryTabActive: {
    backgroundColor: colors.apple,
    borderWidth: 2,
    borderColor: colors.cream
  },
  categoryTabText: {
    width: "100%",
    color: colors.woodDark,
    textTransform: "uppercase",
    textAlign: "center",
    textAlignVertical: "center"
  },
  categoryTabTextActive: {
    color: colors.white
  },
  shopAccessibilitySummary: {
    position: "absolute",
    left: -1000,
    top: 0,
    width: 1,
    height: 1,
    opacity: 0
  },
  creditHud: {
    minWidth: 84,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#20283F",
    borderWidth: 3,
    borderColor: colors.cream,
    paddingLeft: 4,
    paddingRight: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    zIndex: 10
  },
  creditHudPressed: {
    transform: [{ translateY: 2 }],
    opacity: 0.88
  },
  creditHudIcon: {
    width: 27,
    height: 27
  },
  creditHudText: {
    color: colors.cream
  },
  shopShelf: {
    borderRadius: 26,
    borderWidth: 4,
    borderBottomWidth: 7,
    borderColor: colors.cream,
    backgroundColor: "rgba(133,88,50,0.92)",
    padding: spacing.sm,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    ...shadows.gamePanel
  },
  productCard: {
    width: "23.45%",
    minHeight: 114,
    borderRadius: 16,
    backgroundColor: "#F7D7A8",
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: "#B88652",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 6,
    position: "relative"
  },
  productCardPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 3
  },
  productCardSelected: {
    borderColor: colors.cream,
    backgroundColor: "#FFE3B8",
    transform: [{ translateY: -2 }]
  },
  productIcon: {
    width: 48,
    height: 48
  },
  productPreviewImage: {
    width: "100%",
    height: 54,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.82)"
  },
  productName: {
    width: "100%",
    color: colors.ink,
    textAlign: "center",
    textTransform: "none"
  },
  productPrice: {
    minHeight: 24,
    minWidth: 50,
    borderRadius: 12,
    backgroundColor: colors.cream,
    borderWidth: 2,
    borderColor: colors.parchment,
    paddingHorizontal: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 1
  },
  productOwnedPrice: {
    backgroundColor: "#EDFFE1",
    borderColor: "#D7F1C1"
  },
  productPriceIcon: {
    width: 13,
    height: 13
  },
  productPriceText: {
    color: colors.woodDark,
    textTransform: "uppercase"
  },
  productOwnedBadge: {
    position: "absolute",
    top: 7,
    right: 7,
    zIndex: 3,
    minWidth: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: colors.cream,
    borderWidth: 2,
    borderColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    gap: 2
  },
  // Only rendered for repeatable (consumable) owned items -- see ShopEntry's
  // "repeatable" doc comment for why the price pill can't carry this number.
  productOwnedBadgeText: {
    color: colors.woodDark,
    fontSize: 10,
    lineHeight: 12
  },
  emptyShelf: {
    minHeight: 120,
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  emptyShelfText: {
    color: colors.cream
  },
  featuredEyebrow: {
    color: colors.woodDark,
    textTransform: "uppercase"
  },
  featuredItemName: {
    color: colors.ink
  },
  featuredOwnedPill: {
    minHeight: 30,
    borderRadius: 15,
    backgroundColor: colors.parchment,
    borderWidth: 2,
    borderColor: colors.cream,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  featuredOwnedPillActive: {
    backgroundColor: "#F0FFE9",
    borderColor: "#D6F3C6"
  },
  featuredOwnedText: {
    color: colors.woodDark,
    textTransform: "uppercase"
  },
  featuredItemDescription: {
    color: colors.mutedInk,
    textTransform: "none"
  }
});
