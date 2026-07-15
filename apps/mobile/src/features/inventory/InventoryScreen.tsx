import { ArrowLeft, Store } from "lucide-react-native";
import { router } from "expo-router";
import { useMemo } from "react";
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { normalizeAppLocale } from "../../localization/localeNormalization";
import { colors, radii, shadows, spacing, useTypography } from "../../shared/design/tokens";
import { ActionButton } from "../../shared/ui/ActionButton";
import { BackButton } from "../../shared/ui/BackButton";
import { GameItemImage, gameItemAssetByCatalogId } from "../../shared/ui/GameIllustrations";
import { useTerrariumSession } from "../session/TerrariumSessionProvider";
import { getHomeDockActionForItem } from "../terrarium/terrariumHomeCareMenu";
import { getInventorySummaryPresentation } from "./inventoryPresentation";
import { getLocalizedCatalogItemCopy } from "../shop/shopCatalogPresentation";

const inventoryBackground = require("../../../assets/generated/backgrounds/pixel-garden-premium-v1.png");

export function InventoryScreen() {
  const { catalogItems, inventory } = useTerrariumSession();
  const { ownedItems } = useMemo(() => getInventorySummaryPresentation(catalogItems, inventory), [catalogItems, inventory]);
  const typography = useTypography();
  const { i18n, t } = useTranslation();
  const locale = normalizeAppLocale(i18n.resolvedLanguage);

  return (
    <View style={styles.sceneRoot}>
      <ImageBackground accessibilityElementsHidden resizeMode="cover" source={inventoryBackground} style={styles.sceneBackground}>
        <View style={styles.sceneWash} />
      </ImageBackground>
      <SafeAreaView accessibilityLabel={t("inventory.accessibilityLabel")} edges={["top", "left", "right"]} style={styles.sceneSafe}>
        <ScrollView bounces={false} contentContainerStyle={styles.sceneContent} showsVerticalScrollIndicator={false}>
          <BackButton accessibilityLabel={t("inventory.back")} onPress={() => router.push("/terrarium")} />

          <Text accessibilityRole="header" style={[styles.title, typography.display]}>
            {t("inventory.title")}
          </Text>

          {ownedItems.length > 0 ? (
            <View style={styles.itemGrid}>
              {ownedItems.map(({ entry, item }) => {
                const copy = getLocalizedCatalogItemCopy(item, locale);
                // "Give now" (docs/gamefeel-sound-plan.md §1 Tier 4): tapping a
                // card jumps home and auto-opens the tray this item belongs to
                // (e.g. Buddy Plush -> the play tray) so an owner can hand it
                // over in one tap instead of navigating home and hunting for
                // it themselves. getHomeDockActionForItem returns null for
                // items with no dock tray of their own (e.g. the starter food
                // bowl) -- those cards still go home, just without opening a
                // specific tray.
                const dockAction = getHomeDockActionForItem(item);

                return (
                  <Pressable
                    key={item.id}
                    accessibilityHint={t("inventory.giveHint")}
                    accessibilityLabel={t("inventory.giveAccessibilityLabel", { name: copy.name })}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.itemCard, pressed ? styles.itemCardPressed : null]}
                    onPress={() =>
                      router.push(dockAction ? `/terrarium?openTray=${dockAction}&openItem=${encodeURIComponent(item.id)}` : "/terrarium")
                    }
                  >
                    <View style={styles.itemIconFrame}>
                      <GameItemImage
                        accessibilityLabel={t("inventory.iconAccessibilityLabel", { name: copy.name })}
                        item={gameItemAssetByCatalogId[item.id] ?? "flowerPot"}
                        style={styles.itemIcon}
                      />
                    </View>
                    <View style={styles.itemCopy}>
                      <Text style={[styles.itemName, typography.body]}>{copy.name}</Text>
                      <Text style={[styles.itemDescription, typography.label]}>{copy.description}</Text>
                    </View>
                    <Text style={[styles.quantity, typography.label]}>x{entry.quantity}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyStateText, typography.body]}>{t("inventory.empty")}</Text>
            </View>
          )}

          <View style={styles.footerActions}>
            <ActionButton
              label={t("common.actions.backHome")}
              Icon={ArrowLeft}
              size="compact"
              style={styles.footerAction}
              onPress={() => router.push("/terrarium")}
            />
            <ActionButton
              label={t("inventory.shop")}
              Icon={Store}
              size="compact"
              style={styles.footerAction}
              variant="secondary"
              onPress={() => router.push("/shop")}
            />
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
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl
  },
  // backButton style removed: sceneContent.paddingTop already provides the
  // gap below the safe area. The old marginTop here doubled up the top
  // margin (see settings-screen audit, applied here too).
  title: {
    color: colors.ink
  },
  itemGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  itemCard: {
    width: "48%",
    minHeight: 190,
    borderRadius: 22,
    backgroundColor: "rgba(255,245,222,0.92)",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.82)",
    padding: spacing.md,
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    ...shadows.tile
  },
  itemCardPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.88
  },
  itemIconFrame: {
    width: 74,
    height: 74,
    borderRadius: 22,
    backgroundColor: colors.cream,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.82)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    ...shadows.tile
  },
  itemIcon: {
    width: 66,
    height: 66
  },
  itemCopy: {
    width: "100%",
    minWidth: 0,
    alignItems: "center",
    gap: spacing.xs
  },
  itemName: {
    color: colors.ink,
    textAlign: "center"
  },
  itemDescription: {
    color: colors.mutedInk,
    textAlign: "center",
    textTransform: "none"
  },
  quantity: {
    color: colors.skyDeep
  },
  emptyState: {
    borderRadius: radii.panel,
    backgroundColor: "rgba(255,245,222,0.85)",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.8)",
    padding: spacing.lg,
    alignItems: "center"
  },
  emptyStateText: {
    color: colors.mutedInk,
    textAlign: "center"
  },
  footerActions: {
    flexDirection: "row",
    gap: spacing.sm
  },
  footerAction: {
    flex: 1
  }
});
