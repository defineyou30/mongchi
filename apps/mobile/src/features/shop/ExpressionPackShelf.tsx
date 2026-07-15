import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import type { ExpressionPack, GeneratedAssetState } from "@mongchi/shared";

import { normalizeAppLocale } from "../../localization/localeNormalization";
import { colors, useTypography } from "../../shared/design/tokens";
import { GameItemImage } from "../../shared/ui/GameIllustrations";
import { ActionButton } from "../../shared/ui/ActionButton";
import { MongchiIcon } from "../../shared/ui/MongchiIcon";
import { getExpressionPackShelfAction } from "./expressionPackShelfAction";
import { getLocalizedExpressionPackCopy } from "./shopCatalogPresentation";
import type { ExpressionPackShopPresentation } from "./shopCatalogPresentation";
import { styles } from "./ExpressionPackShelf.styles";

export interface ExpressionPackShelfItem {
  pack: ExpressionPack;
  presentation: ExpressionPackShopPresentation;
}

interface ExpressionPackShelfProps {
  items: readonly ExpressionPackShelfItem[];
  ownedStates: readonly GeneratedAssetState[];
  onOpenCreditStore: () => void;
  onUnlockPack: (packId: string) => void;
}

const accentByPackId: Record<string, string> = {
  "pack-everyday-moments": colors.honey,
  "pack-care-reactions": colors.skyDeep,
  "pack-special-days": colors.violet,
  "pack-tender-care": colors.rose
};

export function ExpressionPackShelf({ items, ownedStates, onOpenCreditStore, onUnlockPack }: ExpressionPackShelfProps) {
  const typography = useTypography();
  const { i18n, t } = useTranslation();
  const locale = normalizeAppLocale(i18n.resolvedLanguage);
  const ownedStateSet = new Set(ownedStates);

  return (
    <View style={styles.shelf}>
      {items.map(({ pack, presentation }) => {
        const accent = accentByPackId[pack.id] ?? colors.honey;
        const settled = presentation.status === "owned";
        const copy = getLocalizedExpressionPackCopy(pack, locale);
        const shelfAction = getExpressionPackShelfAction(presentation);
        const actionLabel = presentation.actionLabel;

        return (
          <View
            key={pack.id}
            accessibilityLabel={t("shop.expressionPacks.boardAccessibilityLabel", { name: copy.name, price: presentation.priceLabel, status: presentation.statusLabel })}
            style={styles.packBoard}
          >
            <View style={[styles.accentRail, { backgroundColor: accent }]} />
            <View style={styles.packHeader}>
              <View style={styles.packHeadingCopy}>
                <Text style={[styles.packTitle, typography.title]}>{copy.name}</Text>
                <Text style={[styles.packDescription, typography.body]}>{copy.description}</Text>
              </View>
              <View style={styles.poseCountTag}>
                <Text style={[styles.poseCountText, typography.label]}>{t("shop.expressionPacks.poseCount")}</Text>
              </View>
            </View>

            <View style={styles.slotRail}>
              {pack.poseDetails.map((pose, index) => {
                const owned = ownedStateSet.has(pose.state);
                const poseCopy = copy.poseCopyByState[pose.state] ?? { name: copy.name, usage: copy.description };

                return (
                  <View key={pose.state} style={[styles.poseSlot, index > 0 ? styles.poseSlotDivider : null]}>
                    <View style={[styles.slotIcon, { borderColor: accent }]}>
                      {owned ? (
                        <MongchiIcon id="owned" size={22} />
                      ) : (
                        <MongchiIcon id="lock" size={22} />
                      )}
                    </View>
                    <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={2} style={[styles.poseName, typography.label]}>{poseCopy.name}</Text>
                    <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={4} style={[styles.poseUsage, typography.body]}>{poseCopy.usage}</Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.packFooter}>
              <View style={styles.priceGroup}>
                <GameItemImage accessibilityLabel={t("shop.expressionPacks.creditGemAccessibilityLabel")} decorative item="gem" style={styles.priceIcon} variant="hud" />
                <View>
                  <Text style={[styles.priceText, typography.label]}>{settled ? t("shop.expressionPacks.allOwned") : t("shop.expressionPacks.allPrice", { credits: pack.creditCost })}</Text>
                  <Text style={[styles.statusText, typography.body]}>{presentation.statusLabel}</Text>
                </View>
              </View>
              <ActionButton
                accessibilityLabel={t("shop.expressionPacks.actionAccessibilityLabel", { action: actionLabel, name: copy.name })}
                disabled={shelfAction === "disabled"}
                label={actionLabel}
                iconId={settled ? "owned" : shelfAction === "credits" ? "gem" : "sparkles"}
                size="compact"
                style={styles.packAction}
                variant={presentation.status === "failed" ? "secondary" : "primary"}
                onPress={() => shelfAction === "credits" ? onOpenCreditStore() : onUnlockPack(pack.id)}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}
