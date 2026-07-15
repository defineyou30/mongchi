import { Gift } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import type { CareActionType, ItemId } from "@mongchi/shared";

import { colors, shadows, useFontFamilies } from "../../shared/design/tokens";
import { GameItemImage } from "../../shared/ui/GameIllustrations";
import type { HomeCareMenuOption } from "./terrariumHomeCareMenu";
import type { HomeFloatingDockAction } from "./terrariumHomeInteractionContract";

interface HomeCareActionTrayProps {
  readonly action: HomeFloatingDockAction;
  readonly activePetName: string;
  readonly isCareActionLocked: boolean;
  readonly options: readonly HomeCareMenuOption[];
  readonly getCooldownLeftMs: (action: CareActionType) => number;
  readonly onOpenShop: () => void;
  readonly onSelectOption: (action: CareActionType, itemId?: ItemId) => void;
}

const formatCooldownBadge = (milliseconds: number): string => {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.ceil(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m`;
  }

  return `${Math.ceil(minutes / 60)}h`;
};

export function HomeCareActionTray({
  action,
  activePetName,
  getCooldownLeftMs,
  isCareActionLocked,
  options,
  onOpenShop,
  onSelectOption
}: HomeCareActionTrayProps) {
  const fontFamilies = useFontFamilies();
  const { t } = useTranslation();
  const trayTitleByAction: Record<HomeFloatingDockAction, string> = {
    affection: t("home.care.tray.titles.affection"),
    feed: t("home.care.tray.titles.feed"),
    play: t("home.care.tray.titles.play"),
    walk: t("home.care.tray.titles.walk"),
    water_garden: t("home.care.tray.titles.water_garden")
  };

  return (
    <View accessibilityLabel={t("home.care.tray.optionsAccessibilityLabel", { title: trayTitleByAction[action] })} style={styles.tray}>
      <Text style={[styles.trayTitle, { fontFamily: fontFamilies.label }]}>{trayTitleByAction[action]}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.options}>
        {options.map((option) => {
          // A purchased item (a treat, or a special toy like Buddy Plush /
          // Rose Cushion) bypasses the base action's rhythm cooldown -- see
          // getHomeCarePressDecision. Only the base (owned, no-itemId) option
          // should show/respect the cooldown badge: an item option stays
          // tappable even while the base action is cooling down, and the
          // trailing "More ..." shop tile (also itemId-less, but never
          // owned) must never borrow the base action's cooldown countdown
          // as its own meta text.
          const cooldownLeftMs = option.owned && !option.itemId ? getCooldownLeftMs(option.action) : 0;
          const disabled = isCareActionLocked || (option.owned && cooldownLeftMs > 0);
          const cooldownLabel = cooldownLeftMs > 0 ? formatCooldownBadge(cooldownLeftMs) : null;
          const accessibilityLabel = !option.owned
            ? t("home.care.tray.shopOption", { title: option.title })
            : cooldownLabel
              ? t("home.care.tray.cooldownOption", { title: option.title, cooldown: cooldownLabel })
              : t("home.care.tray.useOption", { title: option.title, petName: activePetName });

          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityLabel={accessibilityLabel}
              disabled={disabled}
              style={[styles.option, !option.owned ? styles.shopOption : null, disabled ? styles.optionDisabled : null]}
              onPress={() => {
                if (!option.owned) {
                  onOpenShop();
                  return;
                }

                onSelectOption(option.action, option.itemId);
              }}
            >
              <View style={styles.optionIconFrame}>
                <GameItemImage
                  accessibilityLabel={option.title}
                  decorative
                  item={option.assetKey}
                  style={styles.optionIcon}
                  variant="ui"
                />
              </View>
              <Text numberOfLines={1} style={[styles.optionTitle, { fontFamily: fontFamilies.label }]}>
                {option.title}
              </Text>
              <Text numberOfLines={1} style={[styles.optionMeta, { fontFamily: fontFamilies.label }]}>
                {cooldownLabel ?? option.meta}
              </Text>
            </Pressable>
          );
        })}

        {options.length === 0 ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t("home.care.tray.openShop")} style={[styles.option, styles.shopOption]} onPress={onOpenShop}>
            <View style={styles.optionIconFrame}>
              <Gift color={colors.woodDark} size={30} strokeWidth={2.6} />
            </View>
            <Text numberOfLines={1} style={[styles.optionTitle, { fontFamily: fontFamilies.label }]}>
              {t("home.care.tray.shop")}
            </Text>
            <Text numberOfLines={1} style={[styles.optionMeta, { fontFamily: fontFamilies.label }]}>
              {t("common.actions.open")}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tray: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 152,
    zIndex: 220,
    borderRadius: 26,
    backgroundColor: "rgba(255,245,222,0.94)",
    borderWidth: 3,
    borderBottomWidth: 5,
    borderColor: "rgba(255,255,255,0.9)",
    padding: 10,
    gap: 8,
    ...shadows.tile
  },
  trayTitle: {
    color: colors.woodDark,
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "900",
    textAlign: "center",
    textTransform: "uppercase"
  },
  options: {
    flexDirection: "row",
    gap: 8
  },
  option: {
    width: 96,
    minHeight: 88,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.76)",
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    paddingVertical: 7,
    gap: 2
  },
  shopOption: {
    backgroundColor: "rgba(244,255,240,0.9)"
  },
  optionDisabled: {
    opacity: 0.5
  },
  optionIconFrame: {
    width: 46,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible"
  },
  optionIcon: {
    width: 42,
    height: 42
  },
  optionTitle: {
    color: colors.ink,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "900"
  },
  optionMeta: {
    color: colors.mutedInk,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "900"
  }
});
