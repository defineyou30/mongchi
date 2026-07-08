import { ArrowLeft, Store } from "lucide-react-native";
import { router } from "expo-router";
import { useMemo } from "react";
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radii, shadows, spacing, useTypography } from "../../shared/design/tokens";
import { ActionButton } from "../../shared/ui/ActionButton";
import { BackButton } from "../../shared/ui/BackButton";
import { GameItemImage, gameItemAssetByCatalogId } from "../../shared/ui/GameIllustrations";
import { useTerrariumSession } from "../session/TerrariumSessionProvider";
import { getHomeDockActionForItem } from "../terrarium/terrariumHomeCareMenu";
import { getInventorySummaryPresentation } from "./inventoryPresentation";

const inventoryBackground = require("../../../assets/generated/backgrounds/pixel-garden-premium-v1.png");

export function InventoryScreen() {
  const { catalogItems, inventory } = useTerrariumSession();
  const { ownedItems } = useMemo(() => getInventorySummaryPresentation(catalogItems, inventory), [catalogItems, inventory]);
  const typography = useTypography();

  return (
    <View style={styles.sceneRoot}>
      <ImageBackground accessibilityElementsHidden resizeMode="cover" source={inventoryBackground} style={styles.sceneBackground}>
        <View style={styles.sceneWash} />
      </ImageBackground>
      <SafeAreaView accessibilityLabel="Inventory" edges={["top", "left", "right"]} style={styles.sceneSafe}>
        <ScrollView bounces={false} contentContainerStyle={styles.sceneContent} showsVerticalScrollIndicator={false}>
          <BackButton accessibilityLabel="Back home" onPress={() => router.push("/terrarium")} />

          <Text accessibilityRole="header" style={[styles.title, typography.display]}>
            Inventory
          </Text>

          {ownedItems.length > 0 ? (
            <View style={styles.itemGrid}>
              {ownedItems.map(({ entry, item }) => {
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
                    accessibilityHint="Goes home and opens this item's tray"
                    accessibilityLabel={`Give ${item.name} now`}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.itemCard, pressed ? styles.itemCardPressed : null]}
                    onPress={() => router.push(dockAction ? `/terrarium?openTray=${dockAction}` : "/terrarium")}
                  >
                    <View style={styles.itemIconFrame}>
                      <GameItemImage
                        accessibilityLabel={`${item.name} inventory icon`}
                        item={gameItemAssetByCatalogId[item.id] ?? "flowerPot"}
                        style={styles.itemIcon}
                      />
                    </View>
                    <View style={styles.itemCopy}>
                      <Text style={[styles.itemName, typography.body]}>{item.name}</Text>
                      <Text style={[styles.itemDescription, typography.label]}>{item.description}</Text>
                    </View>
                    <Text style={[styles.quantity, typography.label]}>x{entry.quantity}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyStateText, typography.body]}>Nothing here yet — treats and toys you pick up will show up in this shelf.</Text>
            </View>
          )}

          <View style={styles.footerActions}>
            <ActionButton
              label="Back home"
              Icon={ArrowLeft}
              size="compact"
              style={styles.footerAction}
              onPress={() => router.push("/terrarium")}
            />
            <ActionButton
              label="Shop"
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
