import { useEffect, useRef } from "react";
import { Animated, Image, ImageBackground, StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";
import type { ImageStyle, StyleProp, ViewStyle } from "react-native";

import type { GeneratedAssetId, PetSpecies } from "@mongchi/shared";

import { useReducedMotionPreference } from "../accessibility/useReducedMotionPreference";
import {
  gameItemAssetByCatalogId,
  getDefaultHomeSlotForItem,
  getGameItemAssetKeyForPlantStage,
  getGameItemDefinition,
  getGameItemSource,
  homeDecorationSlots
} from "../assets/gameItemCatalog";
import type { GameItemAssetKey, GameItemVariant, HomeDecorationSlotId } from "../assets/gameItemCatalog";
import { GeneratedPetAssetImage, getFallbackGeneratedPetAssetId } from "../assets/generatedPetAssets";
import { colors, radii, shadows, spacing } from "../design/tokens";

export { gameItemAssetByCatalogId, getGameItemAssetKeyForPlantStage };
export type { GameItemAssetKey, HomeDecorationSlotId };

// Legacy generated item anchors kept for asset-manifest validation compatibility:
// item_bone_biscuit: "bone", item_cushion_rose: "cushion", item_doghouse_sunny: "doghouse",
// item_food_bowl_basic: "foodBowl", item_flower_pot_sunny: "flowerPot", item_gift_ribbon: "gift",
// item_lantern_glow: "lantern", item_toy_ball_mint: "toyBall", item_watering_can_mint: "wateringCan"
// ../../../assets/generated/items/bone-v3.png ../../../assets/generated/items/coin-v3.png
// ../../../assets/generated/items/cushion-v3.png ../../../assets/generated/items/doghouse-v3.png
// ../../../assets/generated/items/flower-pot-v3.png ../../../assets/generated/items/food-bowl-v3.png
// ../../../assets/generated/items/gem-v3.png ../../../assets/generated/items/gift-v3.png
// ../../../assets/generated/items/lantern-v3.png ../../../assets/generated/items/toy-ball-v3.png
// ../../../assets/generated/items/watering-can-v3.png

const backgroundSources = {
  pixelGarden: require("../../../assets/generated/backgrounds/candidates/home-garden-premium-v2-portrait.png"),
  chatGarden: require("../../../assets/generated/backgrounds/candidates/chat-garden-premium-v1-portrait.png"),
  hatchReveal: require("../../../assets/generated/backgrounds/candidates/hatch-reveal-garden-premium-v1-portrait.png"),
  legacyPixelGarden: require("../../../assets/generated/backgrounds/pixel-garden-premium-v1.png"),
  loadingWorld: require("../../../assets/generated/brand/loading-screen-v1.png"),
  themeAutumnWoods: require("../../../assets/generated/backgrounds/themes/theme-autumn-woods-v1-portrait.png"),
  themeFairyGarden: require("../../../assets/generated/backgrounds/themes/theme-fairy-garden-v1-portrait.png"),
  themeSeasideCove: require("../../../assets/generated/backgrounds/themes/theme-seaside-cove-v1-portrait.png"),
  themeWinterLights: require("../../../assets/generated/backgrounds/themes/theme-winter-lights-v1-portrait.png"),
  welcomeWorld: require("../../../assets/generated/brand/welcome-screen-v1.png")
};

interface GameItemImageProps {
  item: GameItemAssetKey;
  accessibilityLabel: string;
  decorative?: boolean;
  style?: StyleProp<ImageStyle>;
  variant?: GameItemVariant;
}

export function GameItemImage({ item, accessibilityLabel, decorative = false, style, variant = "ui" }: GameItemImageProps) {
  return (
    <Image
      accessibilityElementsHidden={decorative}
      accessibilityIgnoresInvertColors
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={decorative ? "no-hide-descendants" : "auto"}
      resizeMode="contain"
      source={getGameItemSource(item, variant)}
      style={[styles.itemIcon, style]}
    />
  );
}

// Soft breathing glow used while the pet is still forming and no preview
// image exists yet. Replaces the old three-overlapping-circle silhouette,
// which read as an ambiguous "AI web" blob rather than something warm and
// alive. A gentle pulsing halo plus a couple of drifting sparkles reads as
// "someone tiny is in there" without pretending to show a shape yet.
function HatchingAura() {
  const reduceMotionEnabled = useReducedMotionPreference();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotionEnabled) {
      pulse.setValue(0.5);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1600, useNativeDriver: true })
      ])
    );

    loop.start();

    return () => loop.stop();
  }, [pulse, reduceMotionEnabled]);

  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.9] });
  const sparkleOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });

  return (
    <View style={styles.hatchingAura}>
      <Animated.View style={[styles.hatchingAuraGlow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
      <View style={styles.hatchingAuraCore} />
      <View style={styles.hatchingAuraQuestionBadge}>
        <Text style={styles.hatchingAuraQuestionMark}>?</Text>
      </View>
      <Animated.View style={[styles.hatchingAuraSparkleA, { opacity: sparkleOpacity }]} />
      <Animated.View style={[styles.hatchingAuraSparkleB, { opacity: sparkleOpacity }]} />
      <Animated.View style={[styles.hatchingAuraSparkleC, { opacity: sparkleOpacity }]} />
    </View>
  );
}

interface TerrariumArtProps {
  accessibilityLabel: string;
  children?: ReactNode;
  petAssetId?: GeneratedAssetId | null;
  petAssetUri?: string | null;
  placedItems?: TerrariumPlacedItem[];
  scene?: "garden" | "hatching" | "reveal" | "welcome" | "loading" | "chat";
  showAmbientItems?: boolean;
  variant?: "empty" | "hatching" | "pet";
  style?: StyleProp<ViewStyle>;
}

export interface TerrariumPlacedItem {
  id: string;
  item: GameItemAssetKey;
  label: string;
  rotation?: number;
  slotId?: HomeDecorationSlotId;
  x?: number;
  y?: number;
}

export function TerrariumArt({
  accessibilityLabel,
  children,
  petAssetId,
  petAssetUri,
  placedItems,
  scene,
  showAmbientItems = true,
  variant = "pet",
  style
}: TerrariumArtProps) {
  const showPet = variant === "pet";
  const hatching = variant === "hatching";
  const usePlacedInventory = placedItems !== undefined;
  const sceneMode = scene ?? (hatching ? "hatching" : "garden");
  const backgroundSource =
    sceneMode === "hatching"
      ? backgroundSources.hatchReveal
        : sceneMode === "reveal"
        ? backgroundSources.hatchReveal
        : sceneMode === "welcome"
          ? backgroundSources.welcomeWorld
          : sceneMode === "loading"
            ? backgroundSources.loadingWorld
            : sceneMode === "chat"
              ? backgroundSources.chatGarden
              : backgroundSources.pixelGarden;
  return (
    <ImageBackground
      accessibilityLabel={accessibilityLabel}
      imageStyle={styles.panelImage}
      resizeMode="cover"
      source={backgroundSource}
      style={[
        styles.panel,
        styles.terrariumScene,
        sceneMode === "garden" ? styles.gardenScene : null,
        sceneMode === "reveal" ? styles.revealScene : null,
        style
      ]}
    >
      <View style={styles.sceneLayer}>
        {sceneMode === "reveal" && showAmbientItems ? (
          <>
            <View style={styles.confettiOne} />
            <View style={styles.confettiTwo} />
            <View style={styles.confettiThree} />
            <View style={styles.confettiFour} />
          </>
        ) : null}
        {usePlacedInventory && showAmbientItems ? (
          <>
            <GameItemImage accessibilityLabel="Tiny house" decorative item="tinyHouse" style={styles.sceneDoghouse} variant="scene" />
            <GameItemImage accessibilityLabel="Lantern" decorative item="hangingLantern" style={styles.sceneLantern} variant="scene" />
            <GameItemImage accessibilityLabel="Flower pot" decorative item="flowerPot" style={styles.scenePot} variant="scene" />
            <GameItemImage accessibilityLabel="Pond tile" decorative item="pondTile" style={styles.scenePondTile} variant="scene" />
          </>
        ) : null}
        {usePlacedInventory
          ? placedItems.map((placedItem) => {
              const itemDefinition = getGameItemDefinition(placedItem.item);
              const slot = placedItem.slotId ? homeDecorationSlots[placedItem.slotId] : getDefaultHomeSlotForItem(placedItem.item);
              const width = itemDefinition.pixelWidth * slot.scale * itemDefinition.defaultScale;
              const height = itemDefinition.pixelHeight * slot.scale * itemDefinition.defaultScale;
              const rotation = placedItem.rotation ?? slot.rotation ?? 0;

              return (
              <View
                key={placedItem.id}
                style={[
                  styles.placedItem,
                  {
                    left: `${slot.x * 100}%`,
                    top: `${slot.y * 100}%`,
                    width,
                    height,
                    marginLeft: -width * itemDefinition.anchorX,
                    marginTop: -height * itemDefinition.anchorY,
                    zIndex: slot.zIndex,
                    transform: [{ rotate: `${rotation}deg` }]
                  }
                ]}
              >
                {itemDefinition.contactShadow === "runtime" ? <View style={styles.placedItemShadow} /> : null}
                <GameItemImage accessibilityLabel={placedItem.label} item={placedItem.item} style={styles.placedItemImage} variant="scene" />
              </View>
              );
            })
          : showAmbientItems ? (
              <>
                <GameItemImage accessibilityLabel="Tiny house" decorative item="tinyHouse" style={styles.sceneDoghouse} variant="scene" />
                <GameItemImage accessibilityLabel="Lantern" decorative item="hangingLantern" style={styles.sceneLantern} variant="scene" />
                <GameItemImage accessibilityLabel="Toy ball" decorative item="toyBall" style={styles.sceneBall} variant="scene" />
                <GameItemImage accessibilityLabel="Flower pot" decorative item="flowerPot" style={styles.scenePot} variant="scene" />
              </>
            ) : null}
        {hatching ? (
          <View style={styles.hatchGlow}>
            <View style={styles.hatchingPlatform} />
            {petAssetId || petAssetUri ? (
              <GeneratedPetAssetImage
                accessibilityLabel="Pet friend moving in"
                assetId={petAssetId ?? null}
                decorative
                remoteUri={petAssetUri ?? null}
                style={styles.hatchingPetPreview}
              />
            ) : (
              <HatchingAura />
            )}
          </View>
        ) : null}
        {showPet ? (
          <View style={[styles.petStage, sceneMode === "reveal" ? styles.revealPetStage : null]}>
            <View style={[styles.petStageShadow, sceneMode === "reveal" ? styles.revealPetStageShadow : null]} />
            <GeneratedPetAssetImage
              accessibilityLabel="Generated pet avatar"
              assetId={petAssetId ?? null}
              decorative
              remoteUri={petAssetUri ?? null}
              style={[styles.petSprite, sceneMode === "reveal" ? styles.revealPetSprite : null]}
            />
          </View>
        ) : null}
        {children}
      </View>
    </ImageBackground>
  );
}

interface PetSetupArtProps {
  detailLabel?: string;
  nameLabel?: string;
  photoUri?: string | null;
  isSamplePhoto?: boolean;
  showCharms?: boolean;
  species: PetSpecies;
}

export function PetSetupArt({
  detailLabel,
  nameLabel,
  photoUri,
  isSamplePhoto = false,
  showCharms = true,
  species
}: PetSetupArtProps) {
  const hasPhoto = !!photoUri || isSamplePhoto;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.panel, styles.setupPanel]}
    >
      {showCharms ? (
        <>
          <GameItemImage accessibilityLabel="Setup gift charm" decorative item="gift" style={styles.setupGiftCharm} />
          <GameItemImage accessibilityLabel="Setup bone charm" decorative item="bone" style={styles.setupBoneCharm} />
          <GameItemImage accessibilityLabel="Setup cushion charm" decorative item="cushion" style={styles.setupCushionCharm} />
        </>
      ) : null}
      <View style={styles.setupPortraitWrap}>
        <View style={styles.setupPortraitShadow} />
        <View style={styles.setupPortraitBezel}>
          <View style={[styles.setupPixelCorner, styles.setupPixelCornerTopLeft]} />
          <View style={[styles.setupPixelCorner, styles.setupPixelCornerTopRight]} />
          <View style={[styles.setupPixelCorner, styles.setupPixelCornerBottomLeft]} />
          <View style={[styles.setupPixelCorner, styles.setupPixelCornerBottomRight]} />
          <View accessibilityLabel="Your snapshot pinned to the moving-in board" style={styles.portraitRing}>
            {hasPhoto ? (
              isSamplePhoto ? (
                <GeneratedPetAssetImage
                  accessibilityLabel="Your sample pet photo"
                  assetId={getFallbackGeneratedPetAssetId(species, "idle")}
                  style={styles.setupSnapshotImage}
                />
              ) : (
                <Image
                  accessibilityIgnoresInvertColors
                  accessibilityLabel="Your selected pet photo"
                  resizeMode="cover"
                  source={{ uri: photoUri as string }}
                  style={styles.setupSnapshotImage}
                />
              )
            ) : (
              <View style={styles.setupSilhouette}>
                <View style={styles.setupSilhouetteEarLeft} />
                <View style={styles.setupSilhouetteEarRight} />
                <View style={styles.setupSilhouetteHead} />
                <View style={styles.setupSilhouetteBody} />
                <View style={styles.setupSilhouetteQuestionBadge}>
                  <Text style={styles.setupSilhouetteQuestionMark}>?</Text>
                </View>
              </View>
            )}
            <View style={styles.setupPortraitGloss} />
          </View>
        </View>
      </View>
      <View style={styles.setupProfileRibbon}>
        <View style={styles.setupProfileRibbonDot} />
        <Text numberOfLines={1} style={styles.setupProfileName}>
          {nameLabel ?? "Tiny pet"}
        </Text>
      </View>
    </View>
  );
}

export function PhotoUploadArt({
  showDecorations = true,
  showSlots = true,
  species = "dog"
}: {
  showDecorations?: boolean;
  showSlots?: boolean;
  species?: PetSpecies;
}) {
  return (
    <ImageBackground
      accessibilityElementsHidden
      imageStyle={styles.panelImage}
      importantForAccessibility="no-hide-descendants"
      resizeMode="cover"
      source={backgroundSources.pixelGarden}
      style={[styles.panel, styles.photoPanel]}
    >
      <View style={styles.photoGlow} />
      {showDecorations ? (
        <>
          <GameItemImage accessibilityLabel="Photo lantern charm" decorative item="lantern" style={styles.photoLantern} />
          <GameItemImage accessibilityLabel="Photo flower charm" decorative item="flowerPot" style={styles.photoFlowerPot} />
          <GameItemImage accessibilityLabel="Photo toy charm" decorative item="toyBall" style={styles.photoToyBall} />
        </>
      ) : null}
      <View style={styles.photoCardWrap}>
        <View style={styles.photoCardShadow} />
        <View style={styles.photoCard}>
          <View style={styles.photoCardTape} />
          <GeneratedPetAssetImage
            accessibilityLabel="Sample pet photo card"
            assetId={getFallbackGeneratedPetAssetId(species, "happy")}
            decorative
            style={styles.photoPuppyAsset}
          />
          <View style={styles.photoCardGloss} />
        </View>
      </View>
      {showSlots ? (
        <View style={styles.photoSlots}>
          <View style={styles.photoSlot}>
            <Text style={styles.photoSlotPlus}>+</Text>
          </View>
          <View style={styles.photoSlot}>
            <Text style={styles.photoSlotPlus}>+</Text>
          </View>
          <View style={styles.photoSlot}>
            <Text style={styles.photoSlotPlus}>+</Text>
          </View>
        </View>
      ) : null}
    </ImageBackground>
  );
}

export function PremiumBondArt({
  petAssetId,
  petAssetUri,
  compact = false
}: {
  petAssetId?: GeneratedAssetId | null;
  petAssetUri?: string | null;
  compact?: boolean;
}) {
  return (
    <ImageBackground
      accessibilityElementsHidden
      imageStyle={styles.panelImage}
      importantForAccessibility="no-hide-descendants"
      resizeMode="cover"
      source={backgroundSources.chatGarden}
      style={[styles.panel, styles.chatPanel, compact ? styles.chatPanelCompact : null]}
    >
      <GameItemImage
        accessibilityLabel="Garden doghouse decoration"
        decorative
        item="doghouse"
        style={[styles.chatDoghouse, compact ? styles.chatDoghouseCompact : null]}
      />
      <GameItemImage
        accessibilityLabel="Tiny toy ball"
        decorative
        item="toyBall"
        style={[styles.chatToyBall, compact ? styles.chatToyBallCompact : null]}
      />
      <GeneratedPetAssetImage
        accessibilityLabel="Pet in chat garden"
        assetId={petAssetId ?? null}
        decorative
        remoteUri={petAssetUri ?? null}
        style={[styles.chatPet, compact ? styles.chatPetCompact : null]}
      />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 30,
    overflow: "hidden",
    borderWidth: 4,
    borderBottomWidth: 7,
    borderColor: "rgba(255,245,222,0.92)",
    ...shadows.gamePanel
  },
  panelImage: {
    borderRadius: 30
  },
  terrariumScene: {
    minHeight: 360,
    backgroundColor: colors.sky,
    alignItems: "center",
    justifyContent: "flex-end"
  },
  gardenScene: {
    backgroundColor: "#BFE7FF"
  },
  revealScene: {
    backgroundColor: "#D6F2FF"
  },
  sceneLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "flex-end"
  },
  depthGlow: {
    position: "absolute",
    top: 42,
    alignSelf: "center",
    width: "78%",
    height: "48%",
    borderRadius: 120,
    backgroundColor: "rgba(255,245,222,0.32)"
  },
  backHill: {
    position: "absolute",
    bottom: 102,
    left: -24,
    right: -24,
    height: 126,
    borderTopLeftRadius: 120,
    borderTopRightRadius: 120,
    backgroundColor: "rgba(146,221,191,0.58)",
    borderTopWidth: 10,
    borderTopColor: "rgba(255,245,222,0.22)"
  },
  midIsland: {
    position: "absolute",
    bottom: 38,
    width: "88%",
    height: 128,
    borderRadius: 72,
    backgroundColor: "rgba(116,189,104,0.92)",
    borderTopWidth: 12,
    borderTopColor: "rgba(197,237,154,0.96)",
    borderBottomWidth: 13,
    borderBottomColor: colors.moss
  },
  frontMossLip: {
    position: "absolute",
    bottom: 24,
    width: "72%",
    height: 42,
    borderRadius: 24,
    backgroundColor: "rgba(62,122,66,0.5)",
    borderTopWidth: 5,
    borderTopColor: "rgba(255,245,222,0.28)"
  },
  pathStoneA: {
    position: "absolute",
    bottom: 82,
    width: 50,
    height: 22,
    borderRadius: 14,
    backgroundColor: "rgba(255,232,199,0.58)",
    transform: [{ rotate: "-8deg" }]
  },
  pathStoneB: {
    position: "absolute",
    bottom: 58,
    left: "39%",
    width: 42,
    height: 18,
    borderRadius: 12,
    backgroundColor: "rgba(255,232,199,0.46)",
    transform: [{ rotate: "12deg" }]
  },
  pathStoneC: {
    position: "absolute",
    bottom: 58,
    right: "37%",
    width: 44,
    height: 18,
    borderRadius: 12,
    backgroundColor: "rgba(255,232,199,0.5)",
    transform: [{ rotate: "-10deg" }]
  },
  revealHalo: {
    position: "absolute",
    bottom: 92,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: "rgba(255,211,106,0.34)",
    borderWidth: 12,
    borderColor: "rgba(255,255,255,0.26)"
  },
  confettiOne: {
    position: "absolute",
    top: 54,
    left: 54,
    width: 14,
    height: 22,
    borderRadius: 5,
    backgroundColor: colors.rose,
    transform: [{ rotate: "-18deg" }]
  },
  confettiTwo: {
    position: "absolute",
    top: 92,
    right: 62,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.yellow
  },
  confettiThree: {
    position: "absolute",
    top: 152,
    left: 82,
    width: 16,
    height: 16,
    borderRadius: 5,
    backgroundColor: colors.lavender,
    transform: [{ rotate: "24deg" }]
  },
  confettiFour: {
    position: "absolute",
    top: 134,
    right: 92,
    width: 12,
    height: 26,
    borderRadius: 5,
    backgroundColor: colors.coral,
    transform: [{ rotate: "14deg" }]
  },
  skyPanel: {
    minHeight: 340,
    backgroundColor: colors.sky,
    alignItems: "center",
    justifyContent: "flex-end"
  },
  cloudLarge: {
    position: "absolute",
    top: 42,
    left: 34,
    width: 110,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.76)"
  },
  cloudSmall: {
    position: "absolute",
    top: 84,
    right: 42,
    width: 82,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.56)"
  },
  sun: {
    position: "absolute",
    top: 48,
    right: 54,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.yellow
  },
  dome: {
    width: "86%",
    height: 282,
    marginBottom: -8,
    borderTopLeftRadius: 150,
    borderTopRightRadius: 150,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.82)",
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "flex-end"
  },
  island: {
    position: "absolute",
    bottom: 22,
    width: "86%",
    height: 102,
    borderRadius: 62,
    backgroundColor: colors.mint,
    borderBottomWidth: 16,
    borderBottomColor: colors.leaf
  },
  treeTop: {
    position: "absolute",
    bottom: 106,
    width: 112,
    height: 94,
    borderRadius: 56,
    backgroundColor: colors.apple
  },
  treeTrunk: {
    position: "absolute",
    bottom: 78,
    width: 28,
    height: 62,
    borderRadius: 12,
    backgroundColor: colors.gold
  },
  vine: {
    position: "absolute",
    top: 48,
    right: 58,
    width: 16,
    height: 130,
    borderRadius: 8,
    backgroundColor: "rgba(84,168,92,0.72)"
  },
  pond: {
    position: "absolute",
    bottom: 40,
    left: 54,
    width: 82,
    height: 42,
    borderRadius: 26,
    backgroundColor: "#6FC6E8"
  },
  sceneDoghouse: {
    position: "absolute",
    bottom: 70,
    left: 28,
    width: 64,
    height: 64
  },
  sceneLantern: {
    position: "absolute",
    right: 26,
    bottom: 88,
    width: 52,
    height: 52
  },
  sceneBall: {
    position: "absolute",
    left: 96,
    bottom: 30,
    width: 52,
    height: 52
  },
  scenePot: {
    position: "absolute",
    right: 78,
    bottom: 30,
    width: 52,
    height: 52
  },
  scenePondTile: {
    position: "absolute",
    left: 40,
    bottom: 18,
    width: 96,
    height: 70
  },
  placedItem: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "flex-end"
  },
  placedItemShadow: {
    position: "absolute",
    bottom: 6,
    width: 54,
    height: 14,
    borderRadius: 12,
    backgroundColor: "rgba(37,78,57,0.26)",
    transform: [{ scaleX: 1.12 }]
  },
  placedItemImage: {
    width: "100%",
    height: "100%"
  },
  petStage: {
    width: 206,
    height: 206,
    marginBottom: 76,
    alignItems: "center",
    justifyContent: "flex-end"
  },
  revealPetStage: {
    width: 208,
    height: 208,
    marginBottom: 58
  },
  petStageShadow: {
    position: "absolute",
    bottom: 20,
    width: 148,
    height: 32,
    borderRadius: 18,
    backgroundColor: "rgba(35,75,58,0.24)",
    transform: [{ scaleX: 1.12 }]
  },
  revealPetStageShadow: {
    bottom: 22,
    width: 144,
    height: 32,
    backgroundColor: "rgba(90,84,50,0.2)"
  },
  petSprite: {
    width: 184,
    height: 184
  },
  revealPetSprite: {
    width: 174,
    height: 174
  },
  hatchGlow: {
    width: 184,
    height: 150,
    marginBottom: 64,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 16
  },
  hatchingPlatform: {
    position: "absolute",
    bottom: 2,
    width: 162,
    height: 46,
    borderRadius: 999,
    backgroundColor: "rgba(255,211,106,0.38)",
    borderWidth: 2,
    borderColor: "rgba(255,245,222,0.62)",
    transform: [{ scaleX: 1.14 }],
    display: "none"
  },
  hatchingPetPreview: {
    width: 138,
    height: 138,
    opacity: 0.82
  },
  hatchingAura: {
    width: 138,
    height: 138,
    alignItems: "center",
    justifyContent: "center"
  },
  hatchingAuraGlow: {
    position: "absolute",
    width: 138,
    height: 138,
    borderRadius: 69,
    backgroundColor: "rgba(255,211,106,0.42)",
    borderWidth: 3,
    borderColor: "rgba(255,245,222,0.7)",
    shadowColor: colors.honey,
    shadowOpacity: 0.5,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6
  },
  hatchingAuraCore: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "rgba(255,245,222,0.88)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)"
  },
  hatchingAuraQuestionBadge: {
    position: "absolute",
    bottom: -6,
    right: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 2,
    borderColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.tile
  },
  hatchingAuraQuestionMark: {
    color: colors.woodDark,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "900"
  },
  hatchingAuraSparkleA: {
    position: "absolute",
    top: 4,
    right: 18,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.white
  },
  hatchingAuraSparkleB: {
    position: "absolute",
    bottom: 18,
    left: 10,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.yellow
  },
  hatchingAuraSparkleC: {
    position: "absolute",
    top: 34,
    left: -6,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.white
  },
  setupPanel: {
    minHeight: 300,
    backgroundColor: "rgba(255,232,199,0.86)",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md
  },
  setupGlow: {
    position: "absolute",
    top: 24,
    alignSelf: "center",
    width: 232,
    height: 152,
    borderRadius: 80,
    backgroundColor: "rgba(255,245,222,0.42)"
  },
  setupGiftCharm: {
    position: "absolute",
    top: 30,
    right: 36,
    width: 44,
    height: 44,
    transform: [{ rotate: "8deg" }]
  },
  setupBoneCharm: {
    position: "absolute",
    left: 32,
    bottom: 76,
    width: 48,
    height: 48,
    transform: [{ rotate: "-12deg" }]
  },
  setupCushionCharm: {
    position: "absolute",
    right: 40,
    bottom: 64,
    width: 48,
    height: 48,
    transform: [{ rotate: "10deg" }]
  },
  setupPortraitWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 8,
    transform: [{ rotate: "-2deg" }]
  },
  setupPortraitShadow: {
    position: "absolute",
    bottom: 0,
    width: 146,
    height: 18,
    borderRadius: 999,
    backgroundColor: "rgba(42,82,64,0.2)",
    transform: [{ scaleX: 1.2 }]
  },
  setupPortraitBezel: {
    width: 166,
    height: 128,
    position: "relative"
  },
  portraitRing: {
    width: 166,
    height: 128,
    borderRadius: 30,
    borderWidth: 5,
    borderBottomWidth: 8,
    borderColor: colors.gold,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...shadows.tile
  },
  setupPixelCorner: {
    position: "absolute",
    width: 14,
    height: 14,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 2,
    borderColor: colors.gold,
    zIndex: 2
  },
  setupPixelCornerTopLeft: {
    top: -5,
    left: -5,
    borderBottomRightRadius: 7
  },
  setupPixelCornerTopRight: {
    top: -5,
    right: -5,
    borderBottomLeftRadius: 7
  },
  setupPixelCornerBottomLeft: {
    bottom: -5,
    left: -5,
    borderTopRightRadius: 7
  },
  setupPixelCornerBottomRight: {
    bottom: -5,
    right: -5,
    borderTopLeftRadius: 7
  },
  setupPortraitGloss: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 30,
    backgroundColor: "rgba(255,255,255,0.22)"
  },
  setupPetPreview: {
    width: 122,
    height: 110
  },
  setupSnapshotImage: {
    width: "100%",
    height: "100%",
    borderRadius: 24
  },
  setupSilhouette: {
    width: 92,
    height: 88,
    alignItems: "center",
    justifyContent: "flex-end",
    shadowColor: colors.honey,
    shadowOpacity: 0.48,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6
  },
  setupSilhouetteEarLeft: {
    position: "absolute",
    top: 14,
    left: 4,
    width: 30,
    height: 46,
    borderRadius: 18,
    backgroundColor: "rgba(255,232,199,0.78)",
    borderWidth: 2,
    borderColor: "rgba(255,245,222,0.84)",
    transform: [{ rotate: "-18deg" }]
  },
  setupSilhouetteEarRight: {
    position: "absolute",
    top: 14,
    right: 4,
    width: 30,
    height: 46,
    borderRadius: 18,
    backgroundColor: "rgba(255,232,199,0.78)",
    borderWidth: 2,
    borderColor: "rgba(255,245,222,0.84)",
    transform: [{ rotate: "18deg" }]
  },
  setupSilhouetteHead: {
    position: "absolute",
    top: 4,
    width: 64,
    height: 58,
    borderRadius: 30,
    backgroundColor: "rgba(255,245,222,0.82)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.78)"
  },
  setupSilhouetteBody: {
    width: 70,
    height: 54,
    borderRadius: 28,
    backgroundColor: "rgba(255,232,199,0.76)",
    borderWidth: 2,
    borderColor: "rgba(255,245,222,0.76)"
  },
  setupSilhouetteQuestionBadge: {
    position: "absolute",
    top: 18,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 2,
    borderColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.tile
  },
  setupSilhouetteQuestionMark: {
    color: colors.woodDark,
    fontSize: 19,
    lineHeight: 22,
    fontWeight: "900"
  },
  setupProfileRibbon: {
    minWidth: "62%",
    minHeight: 40,
    borderRadius: radii.pill,
    backgroundColor: "#20283F",
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.cream,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    ...shadows.tile
  },
  setupProfileRibbonDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.apple
  },
  setupProfileName: {
    color: colors.cream,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "900",
    textAlign: "center"
  },
  setupProfileDetail: {
    color: colors.mutedInk,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "900",
    textAlign: "center",
    textTransform: "uppercase"
  },
  profileSilhouette: {
    width: 96,
    height: 96,
    borderRadius: 42,
    backgroundColor: colors.mutedInk,
    alignItems: "center",
    justifyContent: "center"
  },
  profileEarLeft: {
    position: "absolute",
    top: 18,
    left: 8,
    width: 24,
    height: 34,
    borderRadius: 14,
    backgroundColor: colors.gold,
    transform: [{ rotate: "-24deg" }]
  },
  profileEarRight: {
    position: "absolute",
    top: 18,
    right: 8,
    width: 24,
    height: 34,
    borderRadius: 14,
    backgroundColor: colors.gold,
    transform: [{ rotate: "24deg" }]
  },
  profileCatEarLeft: {
    top: 4,
    left: 20,
    width: 0,
    height: 0,
    borderLeftWidth: 13,
    borderRightWidth: 13,
    borderBottomWidth: 28,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: colors.gold,
    borderRadius: 0,
    backgroundColor: "transparent",
    transform: [{ rotate: "-18deg" }]
  },
  profileCatEarRight: {
    top: 4,
    right: 20,
    width: 0,
    height: 0,
    borderLeftWidth: 13,
    borderRightWidth: 13,
    borderBottomWidth: 28,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: colors.gold,
    borderRadius: 0,
    backgroundColor: "transparent",
    transform: [{ rotate: "18deg" }]
  },
  profileHead: {
    width: 68,
    height: 62,
    borderRadius: 30,
    backgroundColor: colors.cream,
    borderWidth: 4,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center"
  },
  profileEyeLeft: {
    position: "absolute",
    top: 22,
    left: 20,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.ink
  },
  profileEyeRight: {
    position: "absolute",
    top: 22,
    right: 20,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.ink
  },
  profileMuzzle: {
    position: "absolute",
    bottom: 12,
    width: 28,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.parchment
  },
  profileCatMuzzle: {
    width: 22
  },
  photoPanel: {
    minHeight: 244,
    backgroundColor: "#BFE7FF",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md
  },
  photoGlow: {
    position: "absolute",
    top: 40,
    width: 214,
    height: 126,
    borderRadius: 64,
    backgroundColor: "rgba(255,245,222,0.28)"
  },
  photoLantern: {
    position: "absolute",
    right: 26,
    top: 30,
    width: 50,
    height: 50,
    transform: [{ rotate: "7deg" }]
  },
  photoFlowerPot: {
    position: "absolute",
    left: 22,
    bottom: 20,
    width: 52,
    height: 52,
    transform: [{ rotate: "-5deg" }]
  },
  photoToyBall: {
    position: "absolute",
    right: 46,
    bottom: 24,
    width: 48,
    height: 48,
    transform: [{ rotate: "12deg" }]
  },
  photoCardWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 7,
    transform: [{ rotate: "-3deg" }]
  },
  photoCardShadow: {
    position: "absolute",
    bottom: 0,
    width: 126,
    height: 18,
    borderRadius: 999,
    backgroundColor: "rgba(42,82,64,0.22)",
    transform: [{ scaleX: 1.25 }]
  },
  photoCard: {
    width: 156,
    height: 104,
    borderRadius: 20,
    backgroundColor: colors.cream,
    borderWidth: 6,
    borderBottomWidth: 9,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...shadows.tile
  },
  photoCardTape: {
    position: "absolute",
    top: -2,
    width: 44,
    height: 14,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: "rgba(255,232,199,0.88)"
  },
  photoCardGloss: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 24,
    backgroundColor: "rgba(255,255,255,0.24)"
  },
  photoPuppyAsset: {
    width: 92,
    height: 82
  },
  photoSlots: {
    flexDirection: "row",
    gap: spacing.sm
  },
  photoSlot: {
    width: 54,
    height: 56,
    borderRadius: 18,
    borderWidth: 3,
    borderStyle: "dashed",
    borderColor: "rgba(217,149,56,0.84)",
    backgroundColor: "rgba(255,245,222,0.82)",
    alignItems: "center",
    justifyContent: "center",
    ...shadows.tile
  },
  photoSlotPlus: {
    color: colors.woodDark,
    fontSize: 24,
    lineHeight: 27,
    fontWeight: "900"
  },
  chatPanel: {
    minHeight: 374,
    backgroundColor: "#BFE7FF",
    justifyContent: "flex-end"
  },
  chatPanelCompact: {
    minHeight: 276
  },
  chatGarden: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    height: 152,
    borderTopLeftRadius: 100,
    borderTopRightRadius: 100,
    backgroundColor: "rgba(146,221,191,0.86)",
    borderTopWidth: 12,
    borderTopColor: "rgba(143,203,67,0.82)"
  },
  chatGardenCompact: {
    height: 112,
    borderTopWidth: 9
  },
  chatPath: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    width: "52%",
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,232,199,0.74)",
    transform: [{ rotate: "-6deg" }]
  },
  chatPathCompact: {
    bottom: 18,
    height: 42
  },
  chatDoghouse: {
    position: "absolute",
    left: 28,
    bottom: 66,
    width: 64,
    height: 64
  },
  chatDoghouseCompact: {
    left: 22,
    bottom: 54,
    width: 52,
    height: 52
  },
  chatToyBall: {
    position: "absolute",
    left: 86,
    bottom: 28,
    width: 46,
    height: 46
  },
  chatToyBallCompact: {
    left: 72,
    bottom: 22,
    width: 38,
    height: 38
  },
  chatPet: {
    width: 148,
    height: 148,
    alignSelf: "center",
    marginBottom: 54
  },
  chatPetCompact: {
    width: 126,
    height: 126,
    marginBottom: 42
  },
  itemIcon: {
    width: 72,
    height: 72
  }
});
