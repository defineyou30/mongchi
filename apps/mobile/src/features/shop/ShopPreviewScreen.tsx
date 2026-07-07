import { router } from "expo-router";
import { CheckCircle2, Lock } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ImageSourcePropType } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DEFAULT_THEME_ID, themeBundles } from "@mongchi/shared";
import type { CommerceProduct, EntitlementKey, Item, ItemId } from "@mongchi/shared";
import { themeBackgroundSourceById } from "../../shared/assets/weatherSceneAssets";

import { playSfx } from "../../shared/audio";
import { colors, shadows, spacing, useFontFamilies, useTypography } from "../../shared/design/tokens";
import { GameItemImage, gameItemAssetByCatalogId } from "../../shared/ui/GameIllustrations";
import type { GameItemAssetKey } from "../../shared/ui/GameIllustrations";
import { useAppDialog } from "../../shared/ui/AppDialog";
import { ScreenHeaderRow } from "../../shared/ui/ScreenHeaderRow";
import { useTerrariumSession } from "../session/TerrariumSessionProvider";
import {
  getLocalShopSummaryPresentation,
  getLocalShopCatalogPresentation,
  getPremiumPassShopPresentation,
  getServerShopSummaryPresentation,
  getThemeCardPresentation,
  hasActiveProductEntitlement,
  isNonShoppableStarterKitItem,
  isPremiumPassProduct
} from "./shopCatalogPresentation";

const productCopyById: Record<string, { name: string; description: string; item: GameItemAssetKey }> = {
  premium_chat_monthly: {
    name: "Plus monthly chat",
    description: "Longer, warmer chats whenever the Plus pass is active.",
    item: "gift"
  },
  extra_pet_slot_1: {
    name: "Extra pet slot",
    description: "Make room for one more tiny pet profile.",
    item: "doghouse"
  },
  regeneration_credit_1: {
    name: "Regeneration credit",
    description: "One avatar retry when you want a fresh look.",
    item: "gem"
  },
  theme_pack_starter: {
    name: "Starter theme pack",
    description: "A fresh backdrop for the tiny home.",
    item: "flowerPot"
  }
};

const fallbackCopyByEntitlement: Record<EntitlementKey, { name: string; description: string; item: GameItemAssetKey }> = {
  premium_chat: {
    name: "Plus monthly chat",
    description: "Longer, warmer chats whenever the Plus pass is active.",
    item: "gift"
  },
  extra_pet_slot: {
    name: "Extra pet slot",
    description: "Make room for one more tiny pet profile.",
    item: "doghouse"
  },
  regeneration_credit: {
    name: "Regeneration credit",
    description: "One avatar retry when you want a fresh look.",
    item: "gem"
  },
  theme_pack: {
    name: "Starter theme pack",
    description: "A fresh backdrop for the tiny home.",
    item: "flowerPot"
  },
  item_pack: {
    name: "Item pack",
    description: "A curated set of treats and toys.",
    item: "toyBall"
  },
  treat_pack: {
    name: "Treat pack",
    description: "Special snacks for cute reaction moments.",
    item: "bone"
  },
  subscription_plus: {
    name: "Plus pass",
    description: "Premium bond perks for longer chats and future Plus features.",
    item: "gem"
  }
};

const grantLabels: Record<CommerceProduct["grantType"], string> = {
  consumable: "Credit",
  durable: "Owned once",
  subscription: "Subscription"
};

const shopBackground = require("../../../assets/generated/backgrounds/candidates/shop-market-premium-v1-portrait.png");
const getProductCopy = (product: CommerceProduct) =>
  productCopyById[product.productId] ?? fallbackCopyByEntitlement[product.entitlementKey];

/**
 * Three shop categories (see mongchi "상점 재편" wave): Treats (consumable
 * food/treat snacks), Toys & Rest (toy/bed comfort items), and Themes
 * (background-only garden makeovers). Placeable home decor no longer exists
 * as a shop concept — the garden background is a finished illustration.
 */
type ShopCategoryId = "treats" | "toysAndRest" | "themes";

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
  itemId?: ItemId;
  /** Set only for a theme entry that still needs purchasing (locked_for_purchase) -- see handleSelectedEntryAction. */
  themeBundleId?: string | null;
  themeStatus?: "default_free" | "locked_for_purchase" | "owned";
  product?: CommerceProduct;
  active?: boolean;
  previewImage?: ImageSourcePropType;
}

const shopCategoryLabels: Record<ShopCategoryId, string> = {
  treats: "Treats",
  toysAndRest: "Toys & Rest",
  themes: "Themes"
};

interface BackgroundThemeEntry {
  readonly id: ItemId;
  readonly bundleId: string | null;
  readonly name: string;
  readonly description: string;
  readonly creditCost: number;
  readonly previewImage: ImageSourcePropType;
}

const defaultGardenPreviewImage = require("../../../assets/generated/backgrounds/candidates/home-garden-premium-v2-portrait.png");

/**
 * Single source of Themes-tab cards (see the "테마 BM 결함" fix): the
 * always-free default garden plus every purchasable bundle from
 * themeBundles.ts. Every card renders through the same 3-state presentation
 * (getThemeCardPresentation) -- there is no more separate "free instant
 * apply" list living apart from the priced bundle cards.
 */
const backgroundThemeEntries: readonly BackgroundThemeEntry[] = [
  {
    id: DEFAULT_THEME_ID,
    bundleId: null,
    name: "Cozy Garden",
    description: "The garden's original, always-free backdrop.",
    creditCost: 0,
    previewImage: defaultGardenPreviewImage
  },
  ...themeBundles.map((bundle) => ({
    id: bundle.themeId,
    bundleId: bundle.id,
    name: bundle.nameEn,
    description: bundle.descriptionEn,
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
  const { showDialog } = useAppDialog();
  const {
    activeEntitlements,
    applyTheme,
    catalogItems,
    commerceProducts,
    creditBalance,
    devStoreUnlocked,
    inventory,
    nativeCheckoutReady,
    purchaseCatalogItem,
    purchaseInProgressProductId,
    purchaseProduct,
    purchaseThemeBundle,
    runtimeMode
  } = useTerrariumSession();
  const typography = useTypography();
  const fontFamilies = useFontFamilies();
  const useServerCatalog = runtimeMode === "api" && commerceProducts.length > 0;
  const checkoutAvailable = useServerCatalog && nativeCheckoutReady;
  const premiumPass = getPremiumPassShopPresentation(commerceProducts, activeEntitlements);
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
    ? getServerShopSummaryPresentation(commerceProducts, activeEntitlements, premiumPass)
    : getLocalShopSummaryPresentation(catalogItems, inventory, premiumPass);
  const shopSummary = devStoreUnlocked
    ? {
        ...rawShopSummary,
        lockedCount: 0,
        plusLabel: "Dev open"
      }
    : rawShopSummary;
  const localShopItems = useServerCatalog
    ? []
    : catalogItems
        .filter((item) => getItemShopCategory(item) !== null)
        .map((item) => {
          const presentation = getLocalShopCatalogPresentation(item, inventory);
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
  const [selectedCategory, setSelectedCategory] = useState<ShopCategoryId>("treats");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const themeEntries = useMemo<ShopEntry[]>(
    () =>
      backgroundThemeEntries.map((theme) => {
        const presentation = getThemeCardPresentation(theme.id, theme.creditCost, inventory, devStoreUnlocked, creditBalance);

        return {
          id: `theme-${theme.id}`,
          category: "themes",
          name: theme.name,
          description: theme.description,
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
    [creditBalance, devStoreUnlocked, inventory]
  );

  const localShopEntries = useMemo<ShopEntry[]>(
    () =>
      localShopItems.reduce<ShopEntry[]>((entries, { assetKey, canBuyWithCredits, item, presentation, showCreditPurchase }) => {
        const category = getItemShopCategory(item);

        if (!category) {
          return entries;
        }

        const owned = presentation.ownedQuantity > 0;
        // Owned, non-repeatable items with nothing left to buy (purchaseLabel
        // null) are simply owned and settled — nothing more to do with them.
        const ownedAndSettled = owned && !showCreditPurchase;

        entries.push({
          id: `local-${item.id}`,
          category,
          name: item.name,
          description: item.description,
          assetKey,
          statusLabel: ownedAndSettled
            ? "Owned"
            : owned
              ? `Owned x${presentation.ownedQuantity}`
              : devStoreUnlocked && showCreditPurchase
                ? "Dev open"
                : showCreditPurchase
                  ? "Available"
                  : presentation.statusLabel,
          priceLabel:
            owned && !presentation.repeatable
              ? `Owned x${presentation.ownedQuantity}`
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
    [devStoreUnlocked, localShopItems]
  );

  const commerceShopEntries = useMemo<ShopEntry[]>(
    () =>
      visibleCommerceProducts.reduce<ShopEntry[]>((entries, product) => {
        const category = getProductShopCategory(product);

        if (!category) {
          return entries;
        }

        const copy = getProductCopy(product);
        const active = hasActiveProductEntitlement(product, activeEntitlements);

        entries.push({
          id: `product-${product.productId}`,
          category,
          name: copy.name,
          description: copy.description,
          assetKey: copy.item,
          statusLabel: active ? "Owned" : grantLabels[product.grantType],
          priceLabel: active ? "Owned" : grantLabels[product.grantType],
          ownedQuantity: active ? 1 : 0,
          canAct: !active && checkoutAvailable && purchaseInProgressProductId === null,
          kind: "commerce_product",
          product,
          active
        });

        return entries;
      }, []),
    [activeEntitlements, checkoutAvailable, purchaseInProgressProductId, visibleCommerceProducts]
  );

  const shopEntries = useMemo<ShopEntry[]>(
    () => {
      const purchasableEntries = useServerCatalog ? commerceShopEntries : localShopEntries;

      return [...purchasableEntries, ...themeEntries];
    },
    [commerceShopEntries, localShopEntries, themeEntries, useServerCatalog]
  );

  const entriesByCategory = useMemo<Record<ShopCategoryId, ShopEntry[]>>(
    () => ({
      treats: shopEntries.filter((entry) => entry.category === "treats"),
      toysAndRest: shopEntries.filter((entry) => entry.category === "toysAndRest"),
      themes: shopEntries.filter((entry) => entry.category === "themes")
    }),
    [shopEntries]
  );

  const selectedCategoryEntries = entriesByCategory[selectedCategory];
  const fallbackPreviewEntry: ShopEntry = {
    id: "empty-shop-preview",
    category: selectedCategory,
    name: shopCategoryLabels[selectedCategory],
    description: "New cozy items will appear here when this shelf is stocked.",
    assetKey: selectedCategory === "treats" ? "treatPlate" : selectedCategory === "themes" ? "seasonalFlowers" : "toyBall",
    statusLabel: "Coming soon",
    priceLabel: "Soon",
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
        showDialog({ title: "Checkout", message: result.messageSafe });
        return;
      }

      // Purchase-specific SFX is Phase 2 (see docs/gamefeel-sound-plan.md §2,
      // "구매(카지노 느낌 회피)") -- reusing the shared toast chime for now.
      playSfx("sfx_toast");
    });
  };

  const handleCreditItemPurchase = (itemId: ItemId) => {
    void purchaseCatalogItem(itemId).then((result) => {
      if (!result.ok) {
        showDialog({ title: "Shop", message: result.messageSafe });
        return;
      }

      playSfx("sfx_toast");
      showDialog({
        title: "Item added",
        message: result.messageSafe,
        primaryLabel: "OK"
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
      // Locked (unpurchased) themes spend credits once via purchaseThemeBundle;
      // the default theme and any already-owned theme just re-apply for free
      // via applyTheme, which refuses anything not in ownedThemeIds.
      const result =
        entry.themeStatus === "locked_for_purchase" && entry.themeBundleId
          ? purchaseThemeBundle(entry.themeBundleId)
          : applyTheme(entry.itemId);

      if (!result.ok) {
        showDialog({ title: "Theme", message: result.messageSafe });
        return;
      }

      showDialog({
        title: entry.themeStatus === "locked_for_purchase" ? "Garden makeover!" : "Theme applied",
        message: `${entry.name} is now your garden background.`,
        primaryLabel: "OK",
        secondaryLabel: "View home",
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
      <SafeAreaView accessibilityLabel="Garden shop" edges={["top", "left", "right"]} style={styles.sceneSafe}>
        <ScrollView bounces={false} contentContainerStyle={styles.sceneContent} showsVerticalScrollIndicator={false}>
          <ScreenHeaderRow
            backAccessibilityLabel="Back home"
            right={
              <View accessibilityLabel={`Shop wallet, ${creditBalance} credits and ${shopSummary.ownedQuantity} owned kit items`} style={styles.creditHud}>
                <GameItemImage accessibilityLabel="Shop credit gem icon" decorative item="gem" style={styles.creditHudIcon} variant="hud" />
                <Text style={[styles.creditHudText, typography.label]}>{creditBalance}</Text>
              </View>
            }
            style={styles.headerRow}
            title="Garden Shop"
            titleFontFamily={fontFamilies.title}
            onBack={() => router.replace("/terrarium")}
          />

          <View style={styles.itemPreviewPanel}>
            <View style={styles.previewArtFrame}>
              <View style={styles.previewGlow} />
              {selectedEntry.previewImage ? (
                <Image
                  accessibilityIgnoresInvertColors
                  accessibilityLabel={`${selectedEntry.name} background preview`}
                  resizeMode="contain"
                  source={selectedEntry.previewImage}
                  style={styles.previewBackgroundImage}
                />
              ) : (
                <GameItemImage accessibilityLabel={`${selectedEntry.name} large preview`} item={selectedEntry.assetKey} style={styles.previewIcon} variant="ui" />
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
              <View accessibilityLabel="Gem and coin prices accepted" style={styles.previewPricePill}>
                <GameItemImage accessibilityLabel="Wallet credit gem" decorative item="gem" style={styles.productPriceIcon} variant="hud" />
                <Text style={[styles.productPriceText, typography.label]}>{selectedEntry.priceLabel}</Text>
                <GameItemImage accessibilityLabel="Coin currency" decorative item="coin" style={styles.productPriceIcon} variant="hud" />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  selectedEntry.kind === "theme"
                    ? selectedEntry.themeStatus === "locked_for_purchase"
                      ? selectedEntry.canAct
                        ? `Unlock ${selectedEntry.name} for ${selectedEntry.priceLabel}`
                        : `${selectedEntry.name} is locked`
                      : selectedEntry.canAct
                        ? `Apply ${selectedEntry.name}`
                        : `${selectedEntry.name} is applied`
                    : selectedEntry.canAct
                      ? `Buy ${selectedEntry.name}`
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
                        ? "Unlock theme"
                        : "Locked"
                      : selectedEntry.canAct
                        ? "Apply theme"
                        : "Applied"
                    : selectedEntry.canAct
                      ? "Get item"
                      : "Locked"}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.shopCategoryTabs}>
            {shopCategories.map((category) => (
              <Pressable
                key={category.id}
                accessibilityRole="button"
                accessibilityLabel={`${category.label}, ${category.count} items`}
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

          <View style={styles.shopShelf}>
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
                      accessibilityLabel={`${entry.name} background thumbnail`}
                      resizeMode="cover"
                      source={entry.previewImage}
                      style={styles.productPreviewImage}
                    />
                  ) : (
                    <GameItemImage accessibilityLabel={`${entry.name} icon`} item={entry.assetKey} style={styles.productIcon} variant="ui" />
                  )}
                  <Text numberOfLines={2} style={[styles.productName, typography.label]}>{entry.name}</Text>
                  <View style={[styles.productPrice, entry.ownedQuantity > 0 ? styles.productOwnedPrice : null]}>
                    {entry.ownedQuantity > 0 ? <CheckCircle2 color={colors.leaf} size={15} strokeWidth={2.8} /> : <GameItemImage accessibilityLabel="Gem price" decorative item="gem" style={styles.productPriceIcon} variant="hud" />}
                    <Text style={[styles.productPriceText, typography.label]}>{entry.priceLabel}</Text>
                  </View>
                </Pressable>
              );
            }) : (
              <View style={styles.emptyShelf}>
                <Text style={[styles.emptyShelfText, typography.body]}>This shelf is being stocked.</Text>
              </View>
            )}
          </View>

          <View
            accessibilityLabel={`${shopSummary.ownedQuantity} owned kit items, ${shopSummary.lockedCount} locked shop items, ${shopSummary.plusLabel}`}
            style={styles.shopAccessibilitySummary}
          >
            <Text>Kit owned</Text>
            <Text>{shopSummary.lockedCount} locked shop items</Text>
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
