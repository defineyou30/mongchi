import { CheckCircle2, Lock, Sparkles } from "lucide-react-native";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import type { ExpressionPack, GeneratedAssetState } from "@mongchi/shared";

import { normalizeAppLocale } from "../../localization/localeNormalization";
import { colors, useTypography } from "../../shared/design/tokens";
import { GameItemImage } from "../../shared/ui/GameIllustrations";
import { ActionButton } from "../../shared/ui/ActionButton";
import { getLocalizedExpressionPackCopy } from "./shopCatalogPresentation";
import type { ExpressionPackShopPresentation, ExpressionPackShopStatus } from "./shopCatalogPresentation";
import { styles } from "./ExpressionPackShelf.styles";

export interface ExpressionPackShelfItem {
  pack: ExpressionPack;
  presentation: ExpressionPackShopPresentation;
}

interface ExpressionPackShelfProps {
  items: readonly ExpressionPackShelfItem[];
  ownedStates: readonly GeneratedAssetState[];
  onUnlockPack: (packId: string) => void;
}

const accentByPackId: Record<string, string> = {
  "pack-everyday-moments": colors.honey,
  "pack-care-reactions": colors.skyDeep,
  "pack-special-days": colors.violet,
  "pack-tender-care": colors.rose
};

const expressionPackActionKeyByStatus = {
  available: "generate",
  failed: "retry",
  locked: "needCredits",
  generating: "making",
  purchasing: "making",
  owned: "owned"
} as const satisfies Record<ExpressionPackShopStatus, string>;

export function ExpressionPackShelf({ items, ownedStates, onUnlockPack }: ExpressionPackShelfProps) {
  const typography = useTypography();
  const { i18n, t } = useTranslation();
  const locale = normalizeAppLocale(i18n.resolvedLanguage);
  const ownedStateSet = new Set(ownedStates);

  return (
    <View style={styles.shelf}>
      <View style={styles.introBand}>
        <Sparkles color={colors.violet} size={22} strokeWidth={2.5} />
        <View style={styles.introCopy}>
          <Text style={[styles.introTitle, typography.title]}>{t("shop.expressionPacks.title")}</Text>
          <Text style={[styles.introText, typography.body]}>{t("shop.expressionPacks.description")}</Text>
        </View>
      </View>

      {items.map(({ pack, presentation }) => {
        const accent = accentByPackId[pack.id] ?? colors.honey;
        const settled = presentation.status === "owned";
        const busy = presentation.status === "generating" || presentation.status === "purchasing";
        const copy = getLocalizedExpressionPackCopy(pack, locale);
        const actionLabel = t(`shop.expressionPacks.actions.${expressionPackActionKeyByStatus[presentation.status]}`);

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
                        <CheckCircle2 color={colors.leaf} size={20} strokeWidth={2.8} />
                      ) : (
                        <Lock color={accent} size={18} strokeWidth={2.8} />
                      )}
                    </View>
                    <Text numberOfLines={2} style={[styles.poseName, typography.label]}>{poseCopy.name}</Text>
                    <Text numberOfLines={3} style={[styles.poseUsage, typography.body]}>{poseCopy.usage}</Text>
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
                disabled={!presentation.canAct || busy || settled}
                label={actionLabel}
                Icon={settled ? CheckCircle2 : Sparkles}
                size="compact"
                style={styles.packAction}
                variant={presentation.status === "failed" ? "secondary" : "primary"}
                onPress={() => onUnlockPack(pack.id)}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}
