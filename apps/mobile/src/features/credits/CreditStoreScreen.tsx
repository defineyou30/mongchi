import { router } from "expo-router";
import { useEffect } from "react";
import { ImageBackground, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { STARTER_CREDIT_GRANT, creditPacks } from "@mongchi/shared";

import { playSfx } from "../../shared/audio";
import { useFontFamilies, useTypography } from "../../shared/design/tokens";
import { ActionButton } from "../../shared/ui/ActionButton";
import { useAppDialog } from "../../shared/ui/AppDialog";
import { GameItemImage } from "../../shared/ui/GameIllustrations";
import { MongchiIcon } from "../../shared/ui/MongchiIcon";
import { ScreenHeaderRow } from "../../shared/ui/ScreenHeaderRow";
import { useTerrariumSession } from "../session/TerrariumSessionProvider";
import { styles } from "./CreditStoreScreen.styles";

const shopBackground = require("../../../assets/generated/backgrounds/candidates/shop-market-premium-v1-portrait.png");

export function CreditStoreScreen() {
  const { t } = useTranslation();
  const typography = useTypography();
  const fontFamilies = useFontFamilies();
  const { showDialog } = useAppDialog();
  const {
    creditBalance,
    creditPackPricingById,
    hydrateCreditBalance,
    nativeCheckoutReady,
    purchaseArrivingProductId,
    purchaseInProgressProductId,
    purchaseProduct
  } = useTerrariumSession();
  const checkoutAvailable = nativeCheckoutReady;

  useEffect(() => {
    void hydrateCreditBalance();
  }, [hydrateCreditBalance]);

  return (
    <ImageBackground accessibilityLabel={t("creditsStore.accessibilityLabel")} resizeMode="cover" source={shopBackground} style={styles.sceneRoot}>
      <View style={styles.sceneWash} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView bounces={false} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ScreenHeaderRow
            backAccessibilityLabel={t("creditsStore.back")}
            right={
              <View accessibilityLabel={t("creditsStore.balanceAccessibilityLabel", { credits: creditBalance })} style={styles.balanceHud}>
                <GameItemImage accessibilityLabel={t("shop.creditGemAccessibilityLabel")} decorative item="gem" style={styles.balanceHudIcon} variant="hud" />
                <Text style={[styles.balanceHudText, typography.label]}>{creditBalance}</Text>
              </View>
            }
            title={t("creditsStore.title")}
            titleFontFamily={fontFamilies.title}
            onBack={() => router.replace("/shop")}
          />

          <View style={styles.heroBand}>
            <View style={styles.heroGemPlate}>
              <GameItemImage accessibilityLabel={t("shop.creditGemAccessibilityLabel")} decorative item="gem" style={styles.heroGem} variant="ui" />
            </View>
            <View style={styles.heroCopy}>
              <Text style={[styles.heroTitle, typography.title]}>{t("creditsStore.heroTitle")}</Text>
              <Text style={[styles.heroBody, typography.body]}>{t("creditsStore.heroBody")}</Text>
            </View>
          </View>

          <View style={styles.starterBand}>
            <MongchiIcon id="gift" size={32} />
            <View style={styles.starterCopy}>
              <Text style={[styles.starterTitle, typography.label]}>
                {t("creditsStore.starterTitle", { credits: STARTER_CREDIT_GRANT })}
              </Text>
              <Text style={[styles.starterBody, typography.body]}>{t("creditsStore.starterBody")}</Text>
            </View>
            <MongchiIcon id="check" size={24} />
          </View>

          <Text style={[styles.sectionTitle, typography.title]}>{t("creditsStore.choosePack")}</Text>

          <View style={styles.packShelf}>
            {creditPacks.map((pack) => {
              const priceString = creditPackPricingById[pack.productId];
              const purchasing = purchaseInProgressProductId === pack.productId;
              const arriving = purchaseArrivingProductId === pack.productId;
              const canPurchase = checkoutAvailable && priceString !== undefined && purchaseInProgressProductId === null;
              const featured = pack.tier === "popular";
              const actionLabel = arriving
                ? t("creditsStore.actions.arriving")
                : purchasing
                  ? t("creditsStore.actions.purchasing")
                  : canPurchase
                    ? t("creditsStore.actions.buy")
                    : t("creditsStore.actions.preparing");

              return (
                <View key={pack.productId} style={[styles.packCard, featured ? styles.packCardFeatured : null]}>
                  {featured ? (
                    <View style={styles.popularTag}>
                      <Text style={[styles.popularText, typography.label]}>{t("creditsStore.popular")}</Text>
                    </View>
                  ) : null}
                  <View style={styles.packInfoRow}>
                    <View style={styles.packIconPlate}>
                      <GameItemImage accessibilityLabel={t("shop.creditGemAccessibilityLabel")} decorative item="gem" style={styles.packGem} variant="ui" />
                    </View>
                    <View style={styles.packCopy}>
                      <Text adjustsFontSizeToFit minimumFontScale={0.75} numberOfLines={1} style={[styles.packAmount, typography.title]}>
                        {t("creditsStore.packAmount", { credits: pack.credits })}
                      </Text>
                      <Text style={[styles.packDetail, typography.body]}>{t(`creditsStore.packs.${pack.tier}`)}</Text>
                      <Text style={[styles.storePrice, typography.label]}>{priceString ?? t("creditsStore.storePrice")}</Text>
                    </View>
                  </View>
                  <ActionButton
                    accessibilityLabel={t("creditsStore.purchaseAccessibilityLabel", { credits: pack.credits })}
                    disabled={!canPurchase}
                    iconId={canPurchase ? "gem" : "lock"}
                    label={actionLabel}
                    size="compact"
                    style={styles.packAction}
                    onPress={() => {
                      if (!canPurchase) return;

                      void purchaseProduct(pack.productId).then((result) => {
                        if (!result.ok) {
                          showDialog({ title: t("creditsStore.dialogs.failedTitle"), message: t("creditsStore.dialogs.failedBody") });
                          return;
                        }

                        if (result.status === "cancelled") {
                          return;
                        }

                        if (result.status === "pending") {
                          showDialog({ title: t("creditsStore.dialogs.pendingTitle"), message: t("creditsStore.dialogs.pendingBody") });
                          return;
                        }

                        playSfx("sfx_purchase");

                        if (result.status === "purchased_delayed") {
                          showDialog({ title: t("creditsStore.dialogs.delayedTitle"), message: t("creditsStore.dialogs.delayedBody") });
                          return;
                        }

                        showDialog({ title: t("creditsStore.dialogs.successTitle"), message: t("creditsStore.dialogs.successBody") });
                      });
                    }}
                  />
                </View>
              );
            })}
          </View>

          <View style={styles.storeNotice}>
            <MongchiIcon id="shield-check" size={26} />
            <Text style={[styles.storeNoticeText, typography.body]}>{t("creditsStore.storeNotice")}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}
