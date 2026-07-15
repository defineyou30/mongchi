import { useEffect, useRef, useState } from "react";
import { Check, Globe2, Smartphone, X } from "lucide-react-native";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";

import { getDeviceAppLocale } from "../../localization/locale";
import { appLanguageOptions, getNativeLanguageName } from "../../localization/languageOptions";
import { deviceLanguagePreference } from "../../localization/languagePreference";
import type { AppLanguagePreference } from "../../localization/languagePreference";
import { useAppLanguagePreference } from "../../localization/useAppLanguagePreference";
import {
  colors,
  getFontFamilyForLocale,
  useFontFamilies
} from "../design/tokens";
import { fontPairFamilies, useFontPair } from "../design/fontPair";
import { languageSelectorStyles as styles } from "./LanguageSelectorSheet.styles";

interface LanguageGlobeButtonProps {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export function LanguageGlobeButton({ onPress, style }: LanguageGlobeButtonProps) {
  const { t } = useTranslation();

  return (
    <Pressable
      accessibilityLabel={t("languageSelector.openAccessibilityLabel")}
      accessibilityRole="button"
      hitSlop={8}
      style={({ pressed }) => [styles.globeButton, pressed ? styles.globeButtonPressed : null, style]}
      onPress={onPress}
    >
      <Globe2 color={colors.woodDark} size={25} strokeWidth={2.8} />
    </Pressable>
  );
}

interface LanguageSelectorSheetProps {
  onClose: () => void;
  visible: boolean;
}

export function LanguageSelectorSheet({ onClose, visible }: LanguageSelectorSheetProps) {
  const { t } = useTranslation();
  const fontFamilies = useFontFamilies();
  const [fontPairId] = useFontPair();
  const [preference, setPreference] = useAppLanguagePreference();
  const [updatingPreference, setUpdatingPreference] = useState<AppLanguagePreference | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const selectionInFlight = useRef(false);
  const deviceLocale = getDeviceAppLocale();

  useEffect(() => {
    if (!visible) {
      setSaveFailed(false);
    }
  }, [visible]);

  const selectPreference = async (nextPreference: AppLanguagePreference) => {
    if (selectionInFlight.current) {
      return;
    }

    selectionInFlight.current = true;
    setSaveFailed(false);
    setUpdatingPreference(nextPreference);

    let saved = false;

    try {
      saved = await setPreference(nextPreference);
    } finally {
      selectionInFlight.current = false;
      setUpdatingPreference(null);
    }

    if (saved) {
      onClose();
      return;
    }

    setSaveFailed(true);
  };

  const renderSelectionMark = (selected: boolean) => selected ? (
    <View style={styles.checkCircle}>
      <Check color={colors.white} size={18} strokeWidth={3.2} />
    </View>
  ) : <View style={styles.checkPlaceholder} />;

  return (
    <Modal
      animationType="fade"
      statusBarTranslucent
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          accessibilityLabel={t("languageSelector.title")}
          accessibilityViewIsModal
          style={styles.sheet}
        >
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Globe2 color={colors.skyDeep} size={25} strokeWidth={2.8} />
            </View>
            <View style={styles.headerCopy}>
              <Text accessibilityRole="header" style={[styles.title, { fontFamily: fontFamilies.display }]}>
                {t("languageSelector.title")}
              </Text>
              <Text lineBreakStrategyIOS="hangul-word" style={[styles.subtitle, { fontFamily: fontFamilies.body }]}>
                {t("languageSelector.subtitle")}
              </Text>
            </View>
            <Pressable
              accessibilityLabel={t("languageSelector.closeAccessibilityLabel")}
              accessibilityRole="button"
              hitSlop={8}
              style={({ pressed }) => [styles.closeButton, pressed ? styles.closeButtonPressed : null]}
              onPress={onClose}
            >
              <X color={colors.woodDark} size={22} strokeWidth={3} />
            </Pressable>
          </View>

          <ScrollView
            bounces={false}
            contentContainerStyle={styles.optionList}
            showsVerticalScrollIndicator={false}
          >
            <Pressable
              accessibilityLabel={`${t("languageSelector.automatic")}, ${t("languageSelector.automaticDetail", { language: getNativeLanguageName(deviceLocale) })}`}
              accessibilityRole="button"
              accessibilityState={{ selected: preference === deviceLanguagePreference }}
              disabled={updatingPreference !== null}
              style={({ pressed }) => [
                styles.option,
                preference === deviceLanguagePreference ? styles.optionSelected : null,
                pressed ? styles.optionPressed : null
              ]}
              onPress={() => void selectPreference(deviceLanguagePreference)}
            >
              <View style={[styles.optionCode, styles.deviceCode]}>
                <Smartphone color={colors.skyDeep} size={21} strokeWidth={2.7} />
              </View>
              <View style={styles.optionCopy}>
                <Text style={[styles.optionTitle, { fontFamily: fontFamilies.title }]}>
                  {t("languageSelector.automatic")}
                </Text>
                <Text style={[styles.optionDetail, { fontFamily: fontFamilies.body }]}>
                  {t("languageSelector.automaticDetail", { language: getNativeLanguageName(deviceLocale) })}
                </Text>
              </View>
              {renderSelectionMark(preference === deviceLanguagePreference)}
            </Pressable>

            <View style={styles.divider} />

            {appLanguageOptions.map((option) => {
              const selected = preference === option.locale;
              const optionFontFamily = getFontFamilyForLocale(option.locale, fontPairFamilies[fontPairId].body);

              return (
                <Pressable
                  key={option.locale}
                  accessibilityLabel={`${option.nativeLabel}${selected ? `, ${t("languageSelector.selected")}` : ""}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  disabled={updatingPreference !== null}
                  style={({ pressed }) => [
                    styles.option,
                    selected ? styles.optionSelected : null,
                    pressed ? styles.optionPressed : null
                  ]}
                  onPress={() => void selectPreference(option.locale)}
                >
                  <View style={styles.optionCode}>
                    <Text style={[styles.optionCodeText, { fontFamily: optionFontFamily }]}>{option.code}</Text>
                  </View>
                  <Text style={[styles.optionTitle, styles.languageName, { fontFamily: optionFontFamily }]}>
                    {option.nativeLabel}
                  </Text>
                  {renderSelectionMark(selected)}
                </Pressable>
              );
            })}
          </ScrollView>

          {saveFailed ? (
            <Text accessibilityLiveRegion="polite" style={[styles.saveError, { fontFamily: fontFamilies.body }]}>
              {t("languageSelector.saveError")}
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
