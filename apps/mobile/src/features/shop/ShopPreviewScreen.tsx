import { router, useLocalSearchParams } from "expo-router";
import { CheckCircle2, Lock } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { ImageSourcePropType } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { DEFAULT_THEME_ID, expressionPacks, themeBundles } from "@mongchi/shared";
import type { CommerceProduct, EntitlementKey, Item, ItemId } from "@mongchi/shared";
import { themeBackgroundSourceById } from "../../shared/assets/weatherSceneAssets";

import { normalizeAppLocale } from "../../localization/localeNormalization";
import { playSfx } from "../../shared/audio";
import { colors, shadows, spacing, useFontFamilies, useTypography } from "../../shared/design/tokens";
import { GameItemImage, gameItemAssetByCatalogId } from "../../shared/ui/GameIllustrations";
import type { GameItemAssetKey } from "../../shared/ui/GameIllustrations";
import { useAppDialog } from "../../shared/ui/AppDialog";
import { ScreenHeaderRow } from "../../shared/ui/ScreenHeaderRow";
import { useTerrariumSession } from "../session/TerrariumSessionProvider";
import {
  getLocalShopSummaryPresentation,
  getLocalizedCatalogItemCopy,
  getLocalizedExpressionPackCopy,
  getLocalShopCatalogPresentation,
  getExpressionPackShopPresentation,
  getPremiumPassShopPresentation,
  getServerShopSummaryPresentation,
  getThemeCardPresentation,
  hasActiveProductEntitlement,
  isNonShoppableStarterKitItem,
  isPremiumPassProduct
} from "./shopCatalogPresentation";
import { balanceShopItemName, resolveShopGridLayout } from "./shopGridLayout";
import { ExpressionPackShelf } from "./ExpressionPackShelf";
import type { ExpressionPackShelfItem } from "./ExpressionPackShelf";
import { getInitialExpressionPackId, getInitialShopCategory } from "./shopRouteParams";
import type { ShopCategoryId } from "./shopRouteParams";

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
  kind: "local_item" | "commerce_product" | "expression_pack" | "theme" | "preview";
  actionLabel?: string;
  itemId?: ItemId;
  packId?: string;
  /** Set only for a theme entry that still needs purchasing (locked_for_purchase) -- see handleSelectedEntryAction. */
  themeBundleId?: string | null;
  themeStatus?: "default_free" | "locked_for_purchase" | "owned";
  product?: CommerceProduct;
  active?: boolean;
  previewImage?: ImageSourcePropType;
}

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

  if (item.category === "treat" || item.behaviorTags.includes("treat") || item.category === "food") {
    return "treats";
  }

  if (item.category === "toy" || item.category === "bed") {
    return "toysAndRest";
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
    return "toysAndRest";
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
    toysAndRest: t("shop.categories.toysAndRest"),
    moments: t("shop.categories.moments"),
    themes: t("shop.categories.themes")
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
  const premiumPass = getPremiumPassShopPresentation(commerceProducts, activeEntitlements, locale);
  // IAP-backed commerce products (credit packs, subscriptions) render as
  // browsable-but-unbuyable "Soon" cards whenever native checkout isn't wired
  // up for this build (checkoutAvailable false) -- that reads as a broken
  // shop, not a coming-soon shelf. Hide them outside __DEV__ so a production
  // build with checkout not yet enabled shows an honest empty shelf instead.
  // Re-enable at launch once EXPO_PUBLIC_TINY_PET_ENABLE_NATIVE_CHECKOUT is
  // on and checkout is verified end-to-end.
  const showUnwiredCommerceProducts = __DEV__ || checkoutAvailable;
  const visibleCommerceProducts = useServerCatalog && showUnwiredCommerceProducts
    ? commerceProducts.filter((product) => !isPremiumPassProduct(product) && getProductShopCategory(product) !== null)
    : [];
  const rawShopSummary = useServerCatalog
    ? getServerShopSummaryPresentation(commerceProducts, activeEntitlements, premiumPass, locale)
    : getLocalShopSummaryPresentation(catalogItems, inventory, premiumPass, locale);
  const shopSummary = devStoreUnlocked
    ? {
        ...rawShopSummary,
        lockedCount: 0,
        plusLabel: t("shop.devOpen")
      }
    : rawShopSummary;
  const localShopItems = useServerCatalog
    ? []
    : catalogItems
        .filter((item) => getItemShopCategory(item) !== null)
        .map((item) => {
          const presentation = getLocalShopCatalogPresentation(item, inventory, locale);
          const assetKey = gameItemAssetByCatalogId[item.id] ?? "flowerPot";
          const canBuyWithCredits =
            presentation.purchaseLabel !== null &&
            presentation.creditCost !== null &&
            (devStoreUnlocked || creditBalance >= presentation.creditCost);
          const showCreditPurchase = presentation.purchaseLabel !== null && (presentation.locked || presentation.repeatable);

          return {
            assetKey,
            canBuyWithCredits,
            item,
            presentation,
            showCreditPurchase
          };
        });
  const [selectedCategory, setSelectedCategory] = useState<ShopCategoryId>(() => getInitialShopCategory(requestedCategory));
  const displayedCreditBalance = selectedCategory === "moments" ? expressionPackCreditBalance : creditBalance;
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [shopShelfWidth, setShopShelfWidth] = useState(() => Math.max(0, viewportWidth - spacing.lg * 2));
  const shopGridLayout = useMemo(
    () => resolveShopGridLayout({ containerWidth: shopShelfWidth, fontScale }),
    [fontScale, shopShelfWidth]
  );
  const shopProductCardWidthStyle = useMemo(() => ({ width: shopGridLayout.cardWidth }), [shopGridLayout.cardWidth]);
  const acceptedAssetStates = useMemo(() => acceptedAssets.map((asset) => asset.state), [acceptedAssets]);
  useEffect(() => {
    setSelectedCategory(getInitialShopCategory(requestedCategory));
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

  const expressionPackEntries = useMemo<ShopEntry[]>(
    () =>
      expressionPackShelfItems.map(({ pack, presentation }) => {
        const assetKey: GameItemAssetKey =
          pack.id === "pack-care-reactions" ? "rewardPouch" : pack.id === "pack-special-days" ? "seasonalFlowers" : "giftBox";
        const copy = getLocalizedExpressionPackCopy(pack, locale);

        return {
          id: `expression-${pack.id}`,
          category: "moments",
          name: copy.name,
          description: copy.description,
          assetKey,
          statusLabel: presentation.statusLabel,
          priceLabel: presentation.priceLabel,
          ownedQuantity: presentation.status === "owned" ? presentation.totalStateCount : 0,
          canAct: presentation.canAct,
          actionLabel: presentation.actionLabel,
          kind: "expression_pack",
          packId: pack.id
        };
      }),
    [expressionPackShelfItems, locale]
  );

  const shopEntries = useMemo<ShopEntry[]>(
    () => {
      const purchasableEntries = useServerCatalog ? commerceShopEntries : localShopEntries;

      return [...purchasableEntries, ...expressionPackEntries, ...themeEntries];
    },
    [commerceShopEntries, expressionPackEntries, localShopEntries, themeEntries, useServerCatalog]
  );

  const entriesByCategory = useMemo<Record<ShopCategoryId, ShopEntry[]>>(
    () => ({
      treats: shopEntries.filter((entry) => entry.category === "treats"),
      toysAndRest: shopEntries.filter((entry) => entry.category === "toysAndRest"),
      moments: shopEntries.filter((entry) => entry.category === "moments"),
      themes: shopEntries.filter((entry) => entry.category === "themes")
    }),
    [shopEntries]
  );

  const selectedCategoryEntries = entriesByCategory[selectedCategory];
  const fallbackPreviewEntry: ShopEntry = {
    id: "empty-shop-preview",
    category: selectedCategory,
    name: shopCategoryLabels[selectedCategory],
    description: t("shop.emptyPreview"),
    assetKey: selectedCategory === "treats" ? "treatPlate" : selectedCategory === "themes" ? "seasonalFlowers" : selectedCategory === "moments" ? "giftBox" : "toyBall",
    statusLabel: t("shop.comingSoon"),
    priceLabel: t("shop.soon"),
    ownedQuantity: 0,
    canAct: false,
    kind: "preview"
  };
  const selectedEntry = selectedCategoryEntries.find((entry) => entry.id === selectedEntryId) ?? selectedCategoryEntries[0] ?? fallbackPreviewEntry;
  const shopCategories = (Object.keys(shopCategoryLabels) as ShopCategoryId[]).map((id) => ({
    id,
    label: shopCategoryLabels[id],
    count: entriesByCategory[id].length
  }));

  const handlePurchase = (product: CommerceProduct) => {
    void purchaseProduct(product).then((result) => {
      if (!result.ok) {
        showDialog({ title: t("shop.dialogs.checkout"), message: locale === "en-US" ? result.messageSafe : t("shop.dialogs.checkoutFailed") });
        return;
      }

      // Purchase-specific SFX is Phase 2 (see docs/gamefeel-sound-plan.md §2,
      // Purchase feedback avoids a casino-like sound; reuse the shared toast chime for now.
      playSfx("sfx_toast");
    });
  };

  const handleCreditItemPurchase = (itemId: ItemId) => {
    void purchaseCatalogItem(itemId).then((result) => {
      if (!result.ok) {
        showDialog({ title: t("shop.dialogs.shop"), message: locale === "en-US" ? result.messageSafe : t("shop.dialogs.shopFailed") });
        return;
      }

      playSfx("sfx_toast");
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
        showDialog({ title: t("shop.dialogs.posePack"), message: locale === "en-US" ? result.messageSafe : t("shop.dialogs.posePackFailed") });
        return;
      }

      if (!result.started) {
        return;
      }

      playSfx("sfx_toast");
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

    if (entry.kind === "expression_pack" && entry.packId && entry.canAct) {
      handleExpressionPackPurchase(entry.packId);
      return;
    }

    if (entry.kind === "theme" && entry.itemId && entry.canAct) {
      // Locked (unpurchased) themes spend credits once via purchaseThemeBundle;
      // the default theme and any already-owned theme just re-apply for free
      // via applyTheme, which refuses anything not in ownedThemeIds.
      const result =
        entry.themeStatus === "locked_for_purchase" && entry.themeBundleId
          ? purchaseThemeBundle(entry.themeBundleId)
          : applyTheme(entry.itemId);

      if (!result.ok) {
        showDialog({ title: t("shop.dialogs.theme"), message: locale === "en-US" ? result.messageSafe : t("shop.dialogs.themeFailed") });
        return;
      }

      showDialog({
        title: entry.themeStatus === "locked_for_purchase" ? t("shop.dialogs.makeover") : t("shop.dialogs.themeApplied"),
        message: t("shop.dialogs.themeAppliedMessage", { name: entry.name }),
        primaryLabel: t("common.actions.ok"),
        secondaryLabel: t("common.actions.viewHome"),
        onSecondary: () => router.replace("/terrarium")
      });
      return;
    }
  };

  return (
    <View style={styles.sceneRoot}>
      <ImageBackground accessibilityElementsHidden resizeMode="cover" source={shopBackground} style={styles.sceneBackground}>
        <View style={styles.sceneWash} />
      </ImageBackground>
      <SafeAreaView accessibilityLabel={t("shop.accessibilityLabel")} edges={["top", "left", "right"]} style={styles.sceneSafe}>
        <ScrollView bounces={false} contentContainerStyle={styles.sceneContent} showsVerticalScrollIndicator={false}>
          <ScreenHeaderRow
            backAccessibilityLabel={t("shop.back")}
            right={
              <View accessibilityLabel={t("shop.walletAccessibilityLabel", { credits: displayedCreditBalance, owned: shopSummary.ownedQuantity })} style={styles.creditHud}>
                <GameItemImage accessibilityLabel={t("shop.creditGemAccessibilityLabel")} decorative item="gem" style={styles.creditHudIcon} variant="hud" />
                <Text style={[styles.creditHudText, typography.label]}>{displayedCreditBalance}</Text>
              </View>
            }
            style={styles.headerRow}
            title={t("shop.title")}
            titleFontFamily={fontFamilies.title}
            onBack={() => router.replace("/terrarium")}
          />

          {selectedCategory !== "moments" ? <View style={styles.itemPreviewPanel}>
            <View style={styles.previewArtFrame}>
              <View style={styles.previewGlow} />
              {selectedEntry.previewImage ? (
                <Image
                  accessibilityIgnoresInvertColors
                  accessibilityLabel={t("shop.backgroundPreview", { name: selectedEntry.name })}
                  resizeMode="contain"
                  source={selectedEntry.previewImage}
                  style={styles.previewBackgroundImage}
                />
              ) : (
                <GameItemImage accessibilityLabel={t("shop.largePreview", { name: selectedEntry.name })} item={selectedEntry.assetKey} style={styles.previewIcon} variant="ui" />
              )}
            </View>
            <View style={styles.previewCopy}>
              <Text style={[styles.featuredEyebrow, typography.label]}>{shopCategoryLabels[selectedEntry.category]}</Text>
              <Text numberOfLines={2} style={[styles.featuredItemName, typography.title]}>{selectedEntry.name}</Text>
              <Text numberOfLines={2} style={[styles.featuredItemDescription, typography.body]}>{selectedEntry.description}</Text>
            </View>
            <View style={styles.previewFooter}>
              <View style={[styles.featuredOwnedPill, selectedEntry.ownedQuantity > 0 ? styles.featuredOwnedPillActive : null]}>
                {selectedEntry.ownedQuantity > 0 || selectedEntry.canAct ? (
                  <CheckCircle2 color={colors.leaf} size={15} strokeWidth={2.8} />
                ) : (
                  <Lock color={colors.mutedInk} size={15} strokeWidth={2.8} />
                )}
                <Text style={[styles.featuredOwnedText, typography.label]}>{selectedEntry.statusLabel}</Text>
              </View>
              <View accessibilityLabel={t("shop.pricesAccessibilityLabel")} style={styles.previewPricePill}>
                <GameItemImage accessibilityLabel={t("shop.walletGemAccessibilityLabel")} decorative item="gem" style={styles.productPriceIcon} variant="hud" />
                <Text style={[styles.productPriceText, typography.label]}>{selectedEntry.priceLabel}</Text>
                <GameItemImage accessibilityLabel={t("shop.coinAccessibilityLabel")} decorative item="coin" style={styles.productPriceIcon} variant="hud" />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  selectedEntry.kind === "theme"
                    ? selectedEntry.themeStatus === "locked_for_purchase"
                      ? selectedEntry.canAct
                        ? t("shop.actionAccessibility.unlockTheme", { name: selectedEntry.name, price: selectedEntry.priceLabel })
                        : t("shop.actionAccessibility.themeLocked", { name: selectedEntry.name })
                      : selectedEntry.canAct
                        ? t("shop.actionAccessibility.applyTheme", { name: selectedEntry.name })
                        : t("shop.actionAccessibility.themeApplied", { name: selectedEntry.name })
                    : selectedEntry.kind === "expression_pack"
                      ? selectedEntry.canAct
                        ? `${selectedEntry.actionLabel ?? t("shop.actions.unlockPack")} ${selectedEntry.name}`
                        : `${selectedEntry.name}. ${selectedEntry.statusLabel}`
                    : selectedEntry.canAct
                      ? t("shop.actionAccessibility.buy", { name: selectedEntry.name })
                      : selectedEntry.statusLabel
                }
                accessibilityState={{ disabled: !selectedEntry.canAct }}
                disabled={!selectedEntry.canAct}
                style={({ pressed }) => [
                  styles.previewActionButton,
                  pressed ? styles.productCardPressed : null,
                  !selectedEntry.canAct ? styles.previewActionDisabled : null
                ]}
                onPress={() => handleSelectedEntryAction(selectedEntry)}
              >
                <Text numberOfLines={1} style={[styles.previewActionText, typography.button]}>
                  {selectedEntry.kind === "theme"
                    ? selectedEntry.themeStatus === "locked_for_purchase"
                      ? selectedEntry.canAct
                        ? t("shop.actions.unlockTheme")
                        : t("shop.locked")
                      : selectedEntry.canAct
                        ? t("shop.actions.applyTheme")
                        : t("common.actions.applied")
                    : selectedEntry.kind === "expression_pack"
                      ? (selectedEntry.actionLabel ?? (selectedEntry.canAct ? t("shop.actions.unlockPack") : t("shop.locked")))
                    : selectedEntry.canAct
                      ? t("shop.actions.getItem")
                      : t("shop.locked")}
                </Text>
              </Pressable>
            </View>
          </View> : null}

          <View style={styles.shopCategoryTabs}>
            {shopCategories.map((category) => (
              <Pressable
                key={category.id}
                accessibilityRole="button"
                accessibilityLabel={t("shop.categoryAccessibilityLabel", { label: category.label, count: category.count })}
                accessibilityState={{ selected: selectedCategory === category.id }}
                style={[styles.categoryTab, selectedCategory === category.id ? styles.categoryTabActive : null]}
                onPress={() => {
                  setSelectedCategory(category.id);
                  setSelectedEntryId(entriesByCategory[category.id][0]?.id ?? null);
                }}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.categoryTabText,
                    typography.label,
                    selectedCategory === category.id ? styles.categoryTabTextActive : null
                  ]}
                >
                  {category.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {selectedCategory === "moments" ? (
            <ExpressionPackShelf
              items={expressionPackShelfItems}
              ownedStates={acceptedAssetStates}
              onUnlockPack={handleExpressionPackPurchase}
            />
          ) : (
            <View
              style={styles.shopShelf}
              onLayout={({ nativeEvent }) => {
                const measuredWidth = nativeEvent.layout.width;
                setShopShelfWidth((currentWidth) => Math.abs(currentWidth - measuredWidth) > 0.5 ? measuredWidth : currentWidth);
              }}
            >
              {selectedCategoryEntries.length > 0 ? selectedCategoryEntries.map((entry) => {
              const selected = selectedEntry.id === entry.id;

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
                      <CheckCircle2 color={colors.leaf} size={15} strokeWidth={3} />
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
                    <GameItemImage accessibilityLabel={t("shop.itemIcon", { name: entry.name })} item={entry.assetKey} style={styles.productIcon} variant="ui" />
                  )}
                  <Text
                    adjustsFontSizeToFit={shopGridLayout.columnCount > 2}
                    minimumFontScale={0.82}
                    numberOfLines={2}
                    style={[styles.productName, typography.label]}
                  >
                    {balanceShopItemName(entry.name)}
                  </Text>
                  <View style={[styles.productPrice, entry.ownedQuantity > 0 ? styles.productOwnedPrice : null]}>
                    {entry.ownedQuantity > 0 ? <CheckCircle2 color={colors.leaf} size={15} strokeWidth={2.8} /> : <GameItemImage accessibilityLabel={t("shop.gemPriceAccessibilityLabel")} decorative item="gem" style={styles.productPriceIcon} variant="hud" />}
                    <Text style={[styles.productPriceText, typography.label]}>{entry.priceLabel}</Text>
                  </View>
                </Pressable>
              );
              }) : (
                <View style={styles.emptyShelf}>
                  <Text style={[styles.emptyShelfText, typography.body]}>{t("shop.emptyShelf")}</Text>
                </View>
              )}
            </View>
          )}

          <View
            accessibilityLabel={t("shop.summary.accessibilityLabel", { owned: shopSummary.ownedQuantity, locked: shopSummary.lockedCount, plus: shopSummary.plusLabel })}
            style={styles.shopAccessibilitySummary}
          >
            <Text>{t("shop.summary.owned")}</Text>
            <Text>{t("shop.summary.locked", { count: shopSummary.lockedCount })}</Text>
            <Text>{shopSummary.plusLabel}</Text>
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
    opacity: 0.58
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
    width: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: colors.cream,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center"
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
