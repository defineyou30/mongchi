import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react-native";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import type { GeneratedAssetState, ItemId, PetSpecies } from "@mongchi/shared";

import { normalizeAppLocale } from "../../localization/localeNormalization";
import { getFallbackGeneratedPetAssetId, GeneratedPetAssetImage } from "../../shared/assets/generatedPetAssets";
import { themeBackgroundSourceById } from "../../shared/assets/weatherSceneAssets";
import { colors, radii, spacing, useFontFamilies } from "../../shared/design/tokens";
import { ActionButton } from "../../shared/ui/ActionButton";
import { BrandedPetShareCard } from "../../shared/share/MongchiShareCard";
import type { BrandedPetShareCardHandle } from "../../shared/share/MongchiShareCard";
import { buildFriendShareMessage, sharePetCard } from "../../shared/share/petShare";
import type { FriendPoseCell } from "./friendProfilePresentation";
import {
  getInitialShareCardPoseState,
  getInitialShareCardThemeId,
  getShareCardPoseOptions,
  getShareCardThemeOptions,
  resolveShareCardPoseAssetId,
  selectShareCardPose,
  selectShareCardTheme
} from "./shareCardPresentation";

const PREVIEW_SIZE = { width: 232, height: 290 } as const;

interface ShareCardCustomizeSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly petName: string;
  readonly species: PetSpecies;
  readonly daysTogether: number;
  readonly poseCells: readonly FriendPoseCell[];
  readonly ownedThemeIds: readonly ItemId[];
  readonly preferredThemeId: ItemId | null;
  readonly generatedAssetUriById: Partial<Record<string, string>>;
}

/**
 * The friend page's "customize & share" flow: pick an owned pose and an
 * owned garden theme, preview the resulting marketing card live, then share
 * it. Renders the same BrandedPetShareCard used for capture (see
 * MongchiShareCard's poster layout) so the preview is pixel-for-pixel what
 * gets shared -- no separate mock-up view to keep in sync.
 */
export function ShareCardCustomizeSheet({
  visible,
  onClose,
  petName,
  species,
  daysTogether,
  poseCells,
  ownedThemeIds,
  preferredThemeId,
  generatedAssetUriById
}: ShareCardCustomizeSheetProps) {
  const { i18n, t } = useTranslation();
  const locale = normalizeAppLocale(i18n.resolvedLanguage);
  const fontFamilies = useFontFamilies();
  const shareCardRef = useRef<BrandedPetShareCardHandle>(null);
  const [isSharing, setIsSharing] = useState(false);

  const poseOptions = getShareCardPoseOptions(poseCells, locale);
  const themeOptions = getShareCardThemeOptions(ownedThemeIds, locale);

  const [poseState, setPoseState] = useState<GeneratedAssetState>(() =>
    getInitialShareCardPoseState(poseOptions, null)
  );
  const [themeId, setThemeId] = useState<ItemId>(() => getInitialShareCardThemeId(themeOptions, preferredThemeId));

  // Re-seed the selection every time the sheet opens, so a previous visit's
  // mid-edit choice never lingers -- it always starts from the pet's usual
  // pose and the player's currently-applied garden theme.
  useEffect(() => {
    if (!visible) {
      return;
    }

    setPoseState(getInitialShareCardPoseState(poseOptions, null));
    setThemeId(getInitialShareCardThemeId(themeOptions, preferredThemeId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const selectedPoseAssetId = resolveShareCardPoseAssetId(poseOptions, poseState) ?? getFallbackGeneratedPetAssetId(species, poseState);
  const selectedPoseAssetUri = generatedAssetUriById[selectedPoseAssetId] ?? null;

  const handleShare = async () => {
    if (isSharing) {
      return;
    }

    setIsSharing(true);
    try {
      const brandedCardUri = (await shareCardRef.current?.capture()) ?? null;

      await sharePetCard({
        petName,
        brandedCardUri,
        message: buildFriendShareMessage({ petName, daysTogether, locale })
      });
      onClose();
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text accessibilityRole="header" style={[styles.title, { fontFamily: fontFamilies.display }]}>
              {t("friend.shareCard.title")}
            </Text>
            <Text style={[styles.subtitle, { fontFamily: fontFamilies.body }]}>{t("friend.shareCard.subtitle")}</Text>
          </View>
          <Pressable
            accessibilityLabel={t("friend.shareCard.closeAccessibilityLabel")}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => [styles.closeButton, pressed ? styles.closeButtonPressed : null]}
            onPress={onClose}
          >
            <X color={colors.woodDark} size={22} strokeWidth={3} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View
            accessibilityLabel={t("friend.shareCard.previewAccessibilityLabel", { petName })}
            style={styles.previewWrap}
          >
            <BrandedPetShareCard
              ref={shareCardRef}
              assetId={selectedPoseAssetId}
              backgroundThemeId={themeId}
              daysTogether={daysTogether}
              locale={locale}
              petAssetUri={selectedPoseAssetUri}
              petName={petName}
              style={PREVIEW_SIZE}
            />
          </View>

          <Text style={[styles.sectionTitle, { fontFamily: fontFamilies.label }]}>
            {t("friend.shareCard.poseSectionTitle")}
          </Text>
          <ScrollView horizontal contentContainerStyle={styles.optionRow} showsHorizontalScrollIndicator={false}>
            {poseOptions.map((option) => {
              const selected = option.state === poseState;
              const optionAssetId = option.assetId ?? getFallbackGeneratedPetAssetId(species, option.state);

              return (
                <Pressable
                  key={option.state}
                  accessibilityLabel={option.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.poseSwatch,
                    selected ? styles.swatchSelected : null,
                    pressed ? styles.swatchPressed : null
                  ]}
                  onPress={() => setPoseState(selectShareCardPose(poseOptions, option.state, poseState))}
                >
                  <GeneratedPetAssetImage
                    accessibilityLabel={option.label}
                    assetId={optionAssetId}
                    decorative
                    remoteUri={option.assetId ? (generatedAssetUriById[option.assetId] ?? null) : null}
                    style={styles.poseSwatchImage}
                  />
                  {selected ? (
                    <View style={styles.selectedBadge}>
                      <Check color={colors.white} size={12} strokeWidth={3.4} />
                    </View>
                  ) : null}
                  <Text numberOfLines={1} style={[styles.swatchLabel, { fontFamily: fontFamilies.label }]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[styles.sectionTitle, { fontFamily: fontFamilies.label }]}>
            {t("friend.shareCard.themeSectionTitle")}
          </Text>
          <ScrollView horizontal contentContainerStyle={styles.optionRow} showsHorizontalScrollIndicator={false}>
            {themeOptions.map((option) => {
              const selected = option.themeId === themeId;

              return (
                <Pressable
                  key={option.themeId}
                  accessibilityLabel={option.name}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.themeSwatch,
                    selected ? styles.swatchSelected : null,
                    pressed ? styles.swatchPressed : null
                  ]}
                  onPress={() => setThemeId(selectShareCardTheme(themeOptions, option.themeId, themeId))}
                >
                  <Image
                    accessibilityIgnoresInvertColors
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    resizeMode="cover"
                    source={themeBackgroundSourceById[option.themeId]}
                    style={styles.themeSwatchImage}
                  />
                  {selected ? (
                    <View style={styles.selectedBadge}>
                      <Check color={colors.white} size={12} strokeWidth={3.4} />
                    </View>
                  ) : null}
                  <Text numberOfLines={1} style={[styles.swatchLabel, { fontFamily: fontFamilies.label }]}>
                    {option.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </ScrollView>

        <View style={styles.footer}>
          <ActionButton
            accessibilityLabel={t("common.actions.cancel")}
            label={t("common.actions.cancel")}
            size="compact"
            style={styles.footerAction}
            variant="secondary"
            onPress={onClose}
          />
          <ActionButton
            accessibilityLabel={t("friend.shareCard.shareAccessibilityLabel", { petName })}
            disabled={isSharing}
            label={t("common.actions.share")}
            size="compact"
            style={styles.footerAction}
            onPress={() => void handleShare()}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm
  },
  headerCopy: {
    flex: 1,
    gap: 2
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "900"
  },
  subtitle: {
    color: colors.mutedInk,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800"
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center"
  },
  closeButtonPressed: {
    transform: [{ scale: 0.95 }]
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm
  },
  previewWrap: {
    alignItems: "center",
    paddingVertical: spacing.md
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    marginTop: spacing.xs
  },
  optionRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingRight: spacing.md
  },
  poseSwatch: {
    width: 84,
    alignItems: "center",
    gap: 4,
    borderRadius: radii.card,
    borderWidth: 2,
    borderColor: "transparent",
    padding: spacing.xs,
    position: "relative"
  },
  themeSwatch: {
    width: 96,
    alignItems: "center",
    gap: 4,
    borderRadius: radii.card,
    borderWidth: 2,
    borderColor: "transparent",
    padding: spacing.xs,
    position: "relative"
  },
  swatchSelected: {
    borderColor: colors.skyDeep,
    backgroundColor: "rgba(201,240,255,0.55)"
  },
  swatchPressed: {
    backgroundColor: "rgba(246,209,163,0.4)"
  },
  poseSwatchImage: {
    width: 64,
    height: 64
  },
  themeSwatchImage: {
    width: 80,
    height: 64,
    borderRadius: radii.control
  },
  selectedBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.leaf,
    alignItems: "center",
    justifyContent: "center"
  },
  swatchLabel: {
    color: colors.ink,
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center"
  },
  footer: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm
  },
  footerAction: {
    flex: 1
  }
});
