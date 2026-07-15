import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Modal, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";

import { syncAmbienceWithSettings, syncBgmWithSettings, useAudioSettings } from "../../shared/audio";
import { useNotificationPreferences } from "../notifications/useNotificationPreferences";
import { colors, radii, shadows, spacing, useFontFamilies } from "../../shared/design/tokens";
import { fontPairLabels, useFontPair } from "../../shared/design/fontPair";
import type { FontPairId } from "../../shared/design/fontPair";
import { ActionButton } from "../../shared/ui/ActionButton";
import { useAppDialog } from "../../shared/ui/AppDialog";
import { MongchiIcon } from "../../shared/ui/MongchiIcon";
import { LanguageSelectorSheet } from "../../shared/ui/LanguageSelectorSheet";
import { ScreenHeaderRow } from "../../shared/ui/ScreenHeaderRow";
import { GardenSceneFrame } from "../appShell/GardenSceneFrame";
import { useTerrariumSession } from "../session/TerrariumSessionProvider";
import { clearErrorLog, readErrorLog } from "../../shared/errors/reporter";
import type { ErrorLogEntry } from "../../shared/errors/reporter";
import type { WeatherCondition } from "@mongchi/shared";

import { getLocalizedText, normalizeAppLocale } from "../../localization/locale";
import type { AppLocale } from "../../localization/locale";
import { getNativeLanguageName } from "../../localization/languageOptions";
import { deviceLanguagePreference } from "../../localization/languagePreference";
import { useAppLanguagePreference } from "../../localization/useAppLanguagePreference";

const getSafeServerMessage = (locale: AppLocale, englishMessage: string, localizedFallback: string): string =>
  getLocalizedText(locale, {
    "en-US": englishMessage,
    "ko-KR": localizedFallback,
    "ja-JP": localizedFallback,
    "zh-TW": localizedFallback,
    "de-DE": localizedFallback,
    "fr-FR": localizedFallback,
    "pt-BR": localizedFallback,
    "es-MX": localizedFallback
  });

export function SettingsScreen() {
  const { showDialog } = useAppDialog();
  const { i18n, t } = useTranslation();
  const locale = normalizeAppLocale(i18n.resolvedLanguage);
  const fontFamilies = useFontFamilies();
  const [languagePreference] = useAppLanguagePreference();
  const [fontPairId, setFontPairId] = useFontPair();
  const [audioSettings, setAudioSettings] = useAudioSettings();
  const [notificationPreferences, setNotificationPreferences] = useNotificationPreferences();
  const {
    activePet,
    apiErrorMessage,
    apiSyncStatus,
    chatHistoryDeletedAt,
    deleteChatHistory,
    deleteOriginalPhoto,
    originalPhotoDeletedAt,
    // restorePurchases: wired but unused while the row below is hidden --
    // see the "Restore purchases hidden" comment further down.
    refreshWeatherFromApproximateLocation,
    setManualWeatherCondition,
    setWeatherScenesEnabled,
    weatherState,
    weatherLocationMessage,
    weatherLocationStatus,
    resetSession,
    exportSessionBackup,
    importSessionBackup,
    accountIdentity,
    linkAppleAccount,
    recoverAccountWithApple,
    petProfile,
    memories,
    careStreak
  } = useTerrariumSession();
  const privacyActionInProgress = apiSyncStatus === "syncing";
  const privacyActionError = apiSyncStatus === "error" ? apiErrorMessage : null;
  const [restoreModalVisible, setRestoreModalVisible] = useState(false);
  const [languageSelectorVisible, setLanguageSelectorVisible] = useState(false);
  const [restoreInputText, setRestoreInputText] = useState("");
  const [restoreInFlight, setRestoreInFlight] = useState(false);
  // Account recovery stack, package C: guards both Apple actions below
  // against a double-tap while a native prompt / Supabase round-trip is
  // already in flight -- same "disable + relabel" pattern as
  // privacyActionInProgress above, just scoped to this one section instead
  // of the whole screen.
  const [accountActionInFlight, setAccountActionInFlight] = useState(false);
  // "정원 불러오기" (recover a garden) only needs its own confirm dialog when
  // there's something on this device worth warning about first -- an active
  // pet with at least one remembered moment or a live care streak. A brand
  // new/empty local garden has nothing to lose, so recovery proceeds
  // straight away in that case.
  const hasMeaningfulLocalProgress = petProfile !== null && (memories.length > 0 || careStreak.current > 0);
  const weatherLocationInProgress = weatherLocationStatus === "requesting";
  const localizedWeatherLocationMessage = weatherLocationStatus === "idle"
    ? weatherLocationMessage
    : t(`settings.weather.locationMessages.${weatherLocationStatus}`);
  const activeLanguageName = languagePreference === deviceLanguagePreference
    ? `${t("languageSelector.automatic")} · ${getNativeLanguageName(locale)}`
    : getNativeLanguageName(locale);
  const fallbackWeatherPreview = { condition: "clear" as const, label: t("settings.weather.options.clear.label"), detail: t("settings.weather.options.clear.detail") };
  const weatherPreviewOptions: Array<{ condition: WeatherCondition; label: string; detail: string }> = [
    fallbackWeatherPreview,
    { condition: "rain", label: t("settings.weather.options.rain.label"), detail: t("settings.weather.options.rain.detail") },
    { condition: "snow", label: t("settings.weather.options.snow.label"), detail: t("settings.weather.options.snow.detail") },
    { condition: "wind", label: t("settings.weather.options.wind.label"), detail: t("settings.weather.options.wind.detail") },
    { condition: "hot", label: t("settings.weather.options.hot.label"), detail: t("settings.weather.options.hot.detail") }
  ];
  const activeWeatherIndex = Math.max(0, weatherPreviewOptions.findIndex((option) => option.condition === weatherState.context.condition));
  const activeWeather = weatherPreviewOptions[activeWeatherIndex] ?? fallbackWeatherPreview;
  const nextWeather = weatherPreviewOptions[(activeWeatherIndex + 1) % weatherPreviewOptions.length] ?? fallbackWeatherPreview;

  // Applies the flipped setting to the already-running BGM/ambience players
  // immediately (see bgmPlayer.ts/ambiencePlayer.ts's syncWithSettings doc
  // comments) -- otherwise turning Music back on wouldn't take effect until
  // the home screen next remounts and re-runs its "start BGM" effect.
  const toggleMusicEnabled = () => {
    setAudioSettings({ ...audioSettings, musicEnabled: !audioSettings.musicEnabled });
    syncBgmWithSettings();
    syncAmbienceWithSettings();
  };

  // "Care reminders" bundles gardenCare + returnReminders behind a single
  // toggle -- useNotificationSync.ts reads both from the same preferences
  // object, but the UI doesn't need to expose that internal split.
  const careRemindersEnabled = notificationPreferences.gardenCare;
  const toggleCareReminders = () => {
    setNotificationPreferences({
      ...notificationPreferences,
      gardenCare: !careRemindersEnabled,
      returnReminders: !careRemindersEnabled
    });
  };
  const toggleWalkUpdates = () => {
    setNotificationPreferences({ ...notificationPreferences, walkReturns: !notificationPreferences.walkReturns });
  };

  // Diagnostics (__DEV__ only, see docs/readiness-diagnosis.md item 5): a
  // read-only view into the local error ring buffer for spotting recurring
  // failures during QA. Not a support-facing feature yet -- Sentry (a
  // separate, native-rebuild-bundled task) will eventually make this
  // visible to real support requests without needing device access.
  const [errorLogEntries, setErrorLogEntries] = useState<ErrorLogEntry[]>([]);

  useEffect(() => {
    if (!__DEV__) {
      return;
    }

    void readErrorLog().then(setErrorLogEntries);
  }, []);

  const handleShareErrorLog = () => {
    void readErrorLog().then((entries) => {
      if (entries.length === 0) {
        showDialog({ title: t("settings.dialogs.errorLog"), message: t("settings.dialogs.noErrors") });
        return;
      }

      const summary = entries
        .map((entry) => `[${entry.timestamp}] ${entry.level}: ${entry.message}`)
        .join("\n");

      void Share.share({ message: summary });
    });
  };

  const handleClearErrorLog = () => {
    void clearErrorLog().then(() => setErrorLogEntries([]));
  };

  const confirmDeleteOriginalPhoto = () => {
    showDialog({
      title: t("settings.dialogs.deletePhotoTitle"),
      message: t("settings.dialogs.deletePhotoMessage"),
      primaryLabel: t("common.actions.delete"),
      secondaryLabel: t("common.actions.cancel"),
      onPrimary: deleteOriginalPhoto
    });
  };

  const confirmDeleteChatHistory = () => {
    showDialog({
      title: t("settings.dialogs.deleteChatTitle"),
      message: t("settings.dialogs.deleteChatMessage"),
      primaryLabel: t("common.actions.delete"),
      secondaryLabel: t("common.actions.cancel"),
      onPrimary: deleteChatHistory
    });
  };

  // "Back up your friend": hands the current session envelope to RN's
  // built-in Share sheet as a named JSON file, so the user can save it to
  // iCloud/Files, Notes, or email it to themselves -- no new native
  // dependency needed (see docs/readiness-diagnosis.md item 4).
  const handleExportBackup = () => {
    const result = exportSessionBackup();

    if (!result.ok) {
      showDialog({
        title: t("settings.dialogs.backup"),
        message: getSafeServerMessage(locale, result.messageSafe, t("settings.dialogs.backupFailed"))
      });
      return;
    }

    const todayKey = new Date().toISOString().slice(0, 10);

    void Share.share({
      title: `mongchi-backup-${todayKey}.json`,
      message: result.backupText
    }).catch(() => {
      showDialog({ title: t("settings.dialogs.backup"), message: t("settings.dialogs.shareFailed") });
    });
  };

  const openRestoreModal = () => {
    setRestoreInputText("");
    setRestoreModalVisible(true);
  };

  const closeRestoreModal = () => {
    if (restoreInFlight) {
      return;
    }

    setRestoreModalVisible(false);
    setRestoreInputText("");
  };

  const confirmRestoreFromBackup = () => {
    if (restoreInputText.trim().length === 0) {
      showDialog({ title: t("settings.dialogs.restore"), message: t("settings.dialogs.pasteFirst") });
      return;
    }

    showDialog({
      title: t("settings.dialogs.restoreConfirmTitle"),
      message: t("settings.dialogs.restoreConfirmMessage"),
      primaryLabel: t("common.actions.restore"),
      secondaryLabel: t("common.actions.cancel"),
      onPrimary: () => {
        setRestoreInFlight(true);

        void importSessionBackup(restoreInputText)
          .then((result) => {
            if (!result.ok) {
              showDialog({
                title: t("settings.dialogs.restore"),
                message: getSafeServerMessage(locale, result.messageSafe, t("settings.dialogs.restoreFailed"))
              });
              return;
            }

            setRestoreModalVisible(false);
            setRestoreInputText("");
            showDialog({ title: t("settings.dialogs.restoredTitle"), message: t("settings.dialogs.restoredMessage") });
          })
          .finally(() => setRestoreInFlight(false));
      }
    });
  };

  // "Link with Apple": canceled is a silent no-op (the owner just backed out
  // of the native prompt, nothing to say), identity_already_linked gets its
  // own dialog pointing at "Recover a garden" below since that's the actual
  // next step, and every other failure (unavailable/linking_disabled/
  // request_failed) gets a warm generic retry message. On success,
  // accountIdentity updates on its own (see TerrariumSessionProvider's
  // linkAppleAccount) and this row flips to the connected status row below
  // -- no extra dialog needed for the happy path.
  const handleLinkAppleAccount = () => {
    if (accountActionInFlight) {
      return;
    }

    setAccountActionInFlight(true);

    void linkAppleAccount()
      .then((result) => {
        if (result.ok || result.reason === "canceled") {
          return;
        }

        if (result.reason === "unavailable") {
          showDialog({ title: t("settings.dialogs.accountLink"), message: t("settings.account.unavailableMessage") });
          return;
        }

        if (result.reason === "identity_already_linked") {
          showDialog({ title: t("settings.dialogs.accountLink"), message: t("settings.account.alreadyLinkedMessage") });
          return;
        }

        showDialog({ title: t("settings.dialogs.accountLink"), message: t("settings.account.linkFailedMessage") });
      })
      .finally(() => setAccountActionInFlight(false));
  };

  // The actual Apple recovery call, shared by both the "nothing to lose"
  // fast path and the "confirm first" path below -- see
  // hasMeaningfulLocalProgress's doc comment for which one a given tap
  // takes. restored:true and restored:false both count as success (the
  // account swap itself worked either way, see
  // RecoverAccountWithAppleResult's doc comment) and just get different
  // welcome-back copy.
  const runRecoverAccountWithApple = () => {
    setAccountActionInFlight(true);

    void recoverAccountWithApple()
      .then((result) => {
        if (!result.ok) {
          if (result.reason === "canceled") {
            return;
          }

          if (result.reason === "unavailable") {
            showDialog({ title: t("settings.dialogs.accountRecover"), message: t("settings.account.unavailableMessage") });
            return;
          }

          showDialog({ title: t("settings.dialogs.accountRecover"), message: t("settings.account.recoverFailedMessage") });
          return;
        }

        if (result.restored) {
          showDialog({ title: t("settings.dialogs.restoredTitle"), message: t("settings.account.recoveredMessage") });
          return;
        }

        showDialog({ title: t("settings.dialogs.accountRecover"), message: t("settings.account.recoveredNoSnapshotMessage") });
      })
      .finally(() => setAccountActionInFlight(false));
  };

  const handleRecoverAccountWithApple = () => {
    if (accountActionInFlight) {
      return;
    }

    if (!hasMeaningfulLocalProgress) {
      runRecoverAccountWithApple();
      return;
    }

    showDialog({
      title: t("settings.account.recoverConfirmTitle"),
      message: t("settings.account.recoverConfirmMessage"),
      primaryLabel: t("common.actions.restore"),
      secondaryLabel: t("common.actions.cancel"),
      onPrimary: runRecoverAccountWithApple
    });
  };

  const handleReset = () => {
    showDialog({
      title: t("settings.dialogs.deleteAllTitle"),
      message: t("settings.dialogs.deleteAllMessage"),
      primaryLabel: t("common.actions.delete"),
      secondaryLabel: t("common.actions.cancel"),
      onPrimary: () => {
        void resetSession().then((result) => {
          if (!result.ok) {
            return;
          }

          router.replace("/onboarding");

          if (result.serverDeleteWarning) {
            showDialog({
              title: t("settings.dialogs.serverRetry"),
              message: getSafeServerMessage(locale, result.serverDeleteWarning, t("settings.dialogs.serverRetryMessage"))
            });
          }
        });
      }
    });
  };

  // handleRestorePurchases: re-enable together with the hidden "Restore
  // purchases" row once native IAP is live (see comment near that row).
  //
  // const handleRestorePurchases = () => {
  //   setRestoreInProgress(true);
  //
  //   void restorePurchases()
  //     .then((result) => {
  //       if (!result.ok) {
  //         showDialog({ title: "Restore purchases", message: result.messageSafe });
  //         return;
  //       }
  //
  //       if (result.mode === "local") {
  //         showDialog({ title: "Restore purchases", message: "Purchase restore is unavailable right now." });
  //         return;
  //       }
  //
  //       showDialog({
  //         title: "Restore purchases",
  //         message: result.restoredCount > 0
  //           ? `Restored ${result.restoredCount} purchase${result.restoredCount === 1 ? "" : "s"}.`
  //           : "No restorable purchases found."
  //       });
  //     })
  //     .finally(() => setRestoreInProgress(false));
  // };

  return (
    <GardenSceneFrame
      accessibilityLabel={t("settings.accessibilityLabel", { petName: activePet.name })}
      contentStyle={styles.settingsContent}
      innerStyle={styles.settingsInner}
    >
      <ScreenHeaderRow
        title={t("settings.title")}
        titleFontFamily={fontFamilies.display}
        backAccessibilityLabel={t("settings.back")}
        style={styles.headerRow}
        onBack={() => router.replace("/terrarium")}
      />

      <View style={styles.settingsHero}>
        <View style={styles.heroIcon}>
          <MongchiIcon id="paw" size={34} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={[styles.heroText, { fontFamily: fontFamilies.body }]}>
            {t("settings.hero")}
          </Text>
          {/*
            Guest badge removed: with only anonymous auth and no account
            linking (Phase D) yet, a static "Guest" label has nothing to
            contrast against and only raises "guest vs. what?" confusion.
            Reintroduce it alongside a real account-link CTA in Phase D.
          */}
        </View>
      </View>

      <View style={styles.settingsSection}>
        <View style={styles.compactRow}>
          <View style={styles.compactIconFrame}>
            <MongchiIcon id="typography" size={22} />
          </View>
          <View style={styles.compactCopy}>
            <Text style={[styles.compactTitle, { fontFamily: fontFamilies.title }]}>{t("settings.language.title")}</Text>
            <Text style={[styles.compactText, { fontFamily: fontFamilies.body }]}>
              {activeLanguageName} · {t("settings.language.detail")}
            </Text>
          </View>
          <ActionButton
            label={t("settings.language.action")}
            variant="secondary"
            size="compact"
            style={styles.compactAction}
            onPress={() => setLanguageSelectorVisible(true)}
          />
        </View>
      </View>

      <LanguageSelectorSheet visible={languageSelectorVisible} onClose={() => setLanguageSelectorVisible(false)} />

      {privacyActionInProgress || privacyActionError ? (
        <View style={[styles.statusNotice, privacyActionError ? styles.statusNoticeError : null]}>
          <View style={styles.statusRibbon}>
            <MongchiIcon id={privacyActionError ? "shield-alert" : "shield-check"} size={22} />
            <Text style={[styles.statusRibbonText, { fontFamily: fontFamilies.label }]}>{privacyActionError ? t("settings.status.needsCheck") : t("settings.status.syncing")}</Text>
          </View>
          <Text style={[styles.statusTitle, { fontFamily: fontFamilies.title }]}>
            {privacyActionError ? t("settings.status.attention") : t("settings.status.inProgress")}
          </Text>
          <Text style={[styles.statusText, { fontFamily: fontFamilies.body }]}>
            {privacyActionError ? t("settings.status.errorDetail") : t("settings.status.keepOpen")}
          </Text>
        </View>
      ) : null}

      <View style={styles.settingsSection}>
        <View style={styles.sectionHeader}>
          <MongchiIcon id="rain" size={22} />
          <Text style={[styles.sectionTitle, { fontFamily: fontFamilies.label }]}>{t("settings.sections.reminders")}</Text>
        </View>

        <View style={styles.compactRow}>
          <View style={styles.compactIconFrame}>
            <MongchiIcon id="paw" size={22} style={!careRemindersEnabled ? styles.mutedIcon : undefined} />
          </View>
          <View style={styles.compactCopy}>
            <Text style={[styles.compactTitle, { fontFamily: fontFamilies.title }]}>{t("settings.notifications.careReminders")}</Text>
            <Text style={[styles.compactText, { fontFamily: fontFamilies.body }]}>{t("settings.notifications.careRemindersDetail")}</Text>
          </View>
          <ActionButton
            label={careRemindersEnabled ? t("common.actions.turnOff") : t("common.actions.enable")}
            variant="secondary"
            size="compact"
            style={styles.compactAction}
            onPress={toggleCareReminders}
          />
        </View>

        <View style={styles.rowDivider} />

        <View style={styles.compactRow}>
          <View style={styles.compactIconFrame}>
            <MongchiIcon id="walk" size={22} style={!notificationPreferences.walkReturns ? styles.mutedIcon : undefined} />
          </View>
          <View style={styles.compactCopy}>
            <Text style={[styles.compactTitle, { fontFamily: fontFamilies.title }]}>{t("settings.notifications.walkUpdates")}</Text>
            <Text style={[styles.compactText, { fontFamily: fontFamilies.body }]}>{t("settings.notifications.walkUpdatesDetail")}</Text>
          </View>
          <ActionButton
            label={notificationPreferences.walkReturns ? t("common.actions.turnOff") : t("common.actions.enable")}
            variant="secondary"
            size="compact"
            style={styles.compactAction}
            onPress={toggleWalkUpdates}
          />
        </View>

        <View style={styles.rowDivider} />

        <View style={styles.compactRow}>
          <View style={styles.compactIconFrame}>
            {weatherState.settings.enabled ? (
              <MongchiIcon id="rain" size={22} />
            ) : (
              <MongchiIcon id="sun" size={22} />
            )}
          </View>
          <View style={styles.compactCopy}>
            <Text style={[styles.compactTitle, { fontFamily: fontFamilies.title }]}>{t("settings.weather.scenes")}</Text>
            {weatherState.settings.enabled ? (
              <Text style={[styles.compactText, { fontFamily: fontFamilies.body }]}>{activeWeather.label}: {activeWeather.detail}</Text>
            ) : null}
          </View>
          <ActionButton
            label={weatherState.settings.enabled ? t("common.actions.turnOff") : t("common.actions.enable")}
            variant="secondary"
            size="compact"
            style={styles.compactAction}
            onPress={() => setWeatherScenesEnabled(!weatherState.settings.enabled)}
          />
        </View>

        <View style={styles.rowDivider} />

        <View style={styles.compactRow}>
          <View style={styles.compactIconFrame}>
            <MongchiIcon id="location" size={22} />
          </View>
          <View style={styles.compactCopy}>
            <Text style={[styles.compactTitle, { fontFamily: fontFamilies.title }]}>{t("settings.weather.useLocation")}</Text>
            <Text style={[styles.compactText, { fontFamily: fontFamilies.body }]}>
              {localizedWeatherLocationMessage ?? t("settings.weather.useLocationDetail")}
            </Text>
          </View>
          <ActionButton
            label={weatherLocationInProgress ? t("common.actions.checking", { defaultValue: "Checking" }) : t("common.actions.enable")}
            variant="secondary"
            size="compact"
            style={styles.compactAction}
            disabled={weatherLocationInProgress}
            onPress={() => {
              void refreshWeatherFromApproximateLocation();
            }}
          />
        </View>

        {!weatherState.settings.useApproximateLocation ? (
          <>
            <View style={styles.rowDivider} />
            <View style={styles.compactRow}>
              <View style={styles.compactIconFrame}>
                <MongchiIcon id="rain" size={22} />
              </View>
              <View style={styles.compactCopy}>
                <Text style={[styles.compactTitle, { fontFamily: fontFamilies.title }]}>{t("settings.weather.preview")}</Text>
                <Text style={[styles.compactText, { fontFamily: fontFamilies.body }]}>{t("settings.weather.next", { weather: nextWeather.label })}</Text>
              </View>
              <ActionButton
                label={t("common.actions.change")}
                variant="secondary"
                size="compact"
                style={styles.compactAction}
                onPress={() => setManualWeatherCondition(nextWeather.condition)}
              />
            </View>
          </>
        ) : null}
      </View>

      <View style={styles.settingsSection}>
        <View style={styles.sectionHeader}>
          <MongchiIcon id="music" size={22} />
          <Text style={[styles.sectionTitle, { fontFamily: fontFamilies.label }]}>{t("settings.sections.sound")}</Text>
        </View>

        <View style={styles.compactRow}>
          <View style={styles.compactIconFrame}>
            {audioSettings.soundsEnabled ? (
              <MongchiIcon id="sound-on" size={22} />
            ) : (
              <MongchiIcon id="sound-off" size={22} />
            )}
          </View>
          <View style={styles.compactCopy}>
            <Text style={[styles.compactTitle, { fontFamily: fontFamilies.title }]}>{t("settings.sound.effects")}</Text>
            <Text style={[styles.compactText, { fontFamily: fontFamilies.body }]}>{t("settings.sound.effectsDetail")}</Text>
          </View>
          <ActionButton
            label={audioSettings.soundsEnabled ? t("common.actions.turnOff") : t("common.actions.enable")}
            variant="secondary"
            size="compact"
            style={styles.compactAction}
            onPress={() => setAudioSettings({ ...audioSettings, soundsEnabled: !audioSettings.soundsEnabled })}
          />
        </View>

        <View style={styles.compactRow}>
          <View style={styles.compactIconFrame}>
            <MongchiIcon id="ambience" size={22} style={!audioSettings.musicEnabled ? styles.mutedIcon : undefined} />
          </View>
          <View style={styles.compactCopy}>
            <Text style={[styles.compactTitle, { fontFamily: fontFamilies.title }]}>{t("settings.sound.music")}</Text>
            <Text style={[styles.compactText, { fontFamily: fontFamilies.body }]}>{t("settings.sound.musicDetail")}</Text>
          </View>
          <ActionButton
            label={audioSettings.musicEnabled ? t("common.actions.turnOff") : t("common.actions.enable")}
            variant="secondary"
            size="compact"
            style={styles.compactAction}
            onPress={toggleMusicEnabled}
          />
        </View>
      </View>

      {/*
        Account recovery stack, package C: iOS-only for now -- Sign in with
        Apple (appleAuthSession.ts) is the only identity provider wired up,
        and AppleAuthentication.isAvailableAsync() itself is iOS-only, so an
        Android build would only ever see the "unavailable" branch. Gate at
        render time rather than inside linkAppleAccount/recoverAccountWithApple
        so Android never shows a section with nothing it can do.
      */}
      {Platform.OS === "ios" ? (
        <View style={styles.settingsSection}>
          <View style={styles.sectionHeader}>
            <MongchiIcon id="lock" size={22} />
            <Text style={[styles.sectionTitle, { fontFamily: fontFamilies.label }]}>{t("settings.sections.account")}</Text>
          </View>

          {accountIdentity.linked ? (
            <View style={styles.compactRow}>
              <View style={styles.compactIconFrame}>
                <MongchiIcon id="shield-check" size={22} />
              </View>
              <View style={styles.compactCopy}>
                <Text style={[styles.compactTitle, { fontFamily: fontFamilies.title }]}>{t("settings.account.connectedTitle")}</Text>
                <Text style={[styles.compactText, { fontFamily: fontFamilies.body }]}>{t("settings.account.connectedDetail")}</Text>
                {accountIdentity.email ? (
                  <Text style={[styles.accountEmailText, { fontFamily: fontFamilies.body }]}>
                    {t("settings.account.connectedEmailDetail", { email: accountIdentity.email })}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : (
            <>
              <View style={styles.compactRow}>
                <View style={styles.compactIconFrame}>
                  <MongchiIcon id="shield-check" size={22} />
                </View>
                <View style={styles.compactCopy}>
                  <Text style={[styles.compactTitle, { fontFamily: fontFamilies.title }]}>{t("settings.account.linkTitle")}</Text>
                  <Text style={[styles.compactText, { fontFamily: fontFamilies.body }]}>{t("settings.account.linkDetail")}</Text>
                </View>
                <ActionButton
                  label={accountActionInFlight ? t("settings.account.linkActionInFlight") : t("settings.account.linkAction")}
                  variant="secondary"
                  size="compact"
                  style={styles.compactAction}
                  disabled={accountActionInFlight}
                  onPress={handleLinkAppleAccount}
                />
              </View>

              <View style={styles.rowDivider} />

              <View style={styles.compactRow}>
                <View style={styles.compactIconFrame}>
                  <MongchiIcon id="download" size={22} />
                </View>
                <View style={styles.compactCopy}>
                  <Text style={[styles.compactTitle, { fontFamily: fontFamilies.title }]}>{t("settings.account.recoverTitle")}</Text>
                  <Text style={[styles.compactText, { fontFamily: fontFamilies.body }]}>{t("settings.account.recoverDetail")}</Text>
                </View>
                <ActionButton
                  label={accountActionInFlight ? t("settings.account.recoverActionInFlight") : t("settings.account.recoverAction")}
                  variant="secondary"
                  size="compact"
                  style={styles.compactAction}
                  disabled={accountActionInFlight}
                  onPress={handleRecoverAccountWithApple}
                />
              </View>
            </>
          )}
        </View>
      ) : null}

      <View style={styles.settingsSection}>
        <View style={styles.sectionHeader}>
          <MongchiIcon id="shield-check" size={22} />
          <Text style={[styles.sectionTitle, { fontFamily: fontFamilies.label }]}>{t("settings.sections.privacy")}</Text>
        </View>

        <View style={styles.compactRow}>
          <View style={styles.compactIconFrame}>
            <MongchiIcon id="camera" size={22} />
          </View>
          <View style={styles.compactCopy}>
            <Text style={[styles.compactTitle, { fontFamily: fontFamilies.title }]}>{t("settings.privacy.localPhoto")}</Text>
            <Text style={[styles.compactText, { fontFamily: fontFamilies.body }]}>
              {originalPhotoDeletedAt ? t("settings.privacy.photoDeleted") : t("settings.privacy.photoStored")}
            </Text>
          </View>
          <ActionButton
            label={privacyActionInProgress ? t("common.actions.deleting") : originalPhotoDeletedAt ? t("common.actions.cleared") : t("common.actions.delete")}
            iconId="delete"
            variant="danger"
            size="compact"
            style={styles.compactAction}
            disabled={!!originalPhotoDeletedAt || privacyActionInProgress}
            onPress={confirmDeleteOriginalPhoto}
          />
        </View>

        <View style={styles.rowDivider} />

        <Text style={[styles.privacyNote, { fontFamily: fontFamilies.body }]}>
          {t("settings.privacy.photoNote")}
        </Text>

        <View style={styles.rowDivider} />

        <View style={styles.compactRow}>
          <View style={styles.compactIconFrame}>
            <MongchiIcon id="chat" size={22} />
          </View>
          <View style={styles.compactCopy}>
            <Text style={[styles.compactTitle, { fontFamily: fontFamilies.title }]}>{t("settings.privacy.chatHistory")}</Text>
            <Text style={[styles.compactText, { fontFamily: fontFamilies.body }]}>
              {chatHistoryDeletedAt ? t("settings.privacy.chatDeleted") : t("settings.privacy.chatDetail")}
            </Text>
          </View>
          <ActionButton
            label={privacyActionInProgress ? t("common.actions.deleting") : chatHistoryDeletedAt ? t("common.actions.cleared") : t("common.actions.delete")}
            iconId="delete"
            variant="danger"
            size="compact"
            style={styles.compactAction}
            disabled={!!chatHistoryDeletedAt || privacyActionInProgress}
            onPress={confirmDeleteChatHistory}
          />
        </View>

        <View style={styles.rowDivider} />

        <View style={styles.compactRow}>
          <View style={styles.compactIconFrame}>
            <MongchiIcon id="download" size={22} />
          </View>
          <View style={styles.compactCopy}>
            <Text style={[styles.compactTitle, { fontFamily: fontFamilies.title }]}>{t("settings.privacy.backup")}</Text>
            <Text style={[styles.compactText, { fontFamily: fontFamilies.body }]}>{t("settings.privacy.backupDetail")}</Text>
          </View>
          <ActionButton
            label={t("common.actions.export")}
            iconId="download"
            variant="secondary"
            size="compact"
            style={styles.compactAction}
            onPress={handleExportBackup}
          />
        </View>

        <View style={styles.compactRow}>
          <View style={styles.compactIconFrame}>
            <MongchiIcon id="upload" size={22} />
          </View>
          <View style={styles.compactCopy}>
            <Text style={[styles.compactTitle, { fontFamily: fontFamilies.title }]}>{t("settings.privacy.restore")}</Text>
            <Text style={[styles.compactText, { fontFamily: fontFamilies.body }]}>{t("settings.privacy.restoreDetail")}</Text>
          </View>
          <ActionButton
            label={t("common.actions.restore")}
            iconId="upload"
            variant="secondary"
            size="compact"
            style={styles.compactAction}
            onPress={openRestoreModal}
          />
        </View>
      </View>

      <View style={styles.settingsSection}>
        <View style={styles.sectionHeader}>
          <MongchiIcon id="shopping-bag" size={22} />
          <Text style={[styles.sectionTitle, { fontFamily: fontFamilies.label }]}>{t("settings.sections.support")}</Text>
        </View>

        {/*
          Restore purchases hidden: native store checkout is still gated
          behind EXPO_PUBLIC_TINY_PET_ENABLE_NATIVE_CHECKOUT (off — see
          apps/mobile/.env.example), so this always round-trips to the
          server with an empty transaction list and reports "No restorable
          purchases found," regardless of what the user actually bought.
          Re-show this row once native IAP is enabled and store review for
          that flow has passed.
        <View style={styles.compactRow}>
          <View style={styles.compactIconFrame}>
            <MongchiIcon id="refresh" size={22} />
          </View>
          <View style={styles.compactCopy}>
            <Text style={[styles.compactTitle, { fontFamily: fontFamilies.title }]}>Restore purchases</Text>
          </View>
          <ActionButton
            label={restoreInProgress ? "Restoring" : "Restore"}
            variant="secondary"
            size="compact"
            style={styles.compactAction}
            disabled={restoreInProgress || privacyActionInProgress}
            onPress={handleRestorePurchases}
          />
        </View>

        <View style={styles.rowDivider} />
        */}

        <View style={styles.linkGrid}>
          <ActionButton label={t("settings.links.privacy")} iconId="shield-check" variant="secondary" size="compact" style={styles.linkButton} onPress={() => router.push("/privacy")} />
          <ActionButton label={t("settings.links.terms")} iconId="document" variant="secondary" size="compact" style={styles.linkButton} onPress={() => router.push("/terms")} />
          <ActionButton label={t("settings.links.support")} iconId="support" variant="secondary" size="compact" style={styles.linkButton} onPress={() => router.push("/support")} />
        </View>
      </View>

      {__DEV__ ? (
        <View style={styles.devSection}>
          <View style={styles.sectionHeader}>
            <MongchiIcon id="typography" size={22} />
            <Text style={[styles.sectionTitle, { fontFamily: fontFamilies.label }]}>{t("settings.dev.fontTitle")}</Text>
          </View>
          <Text style={[styles.controlText, { fontFamily: fontFamilies.body }]}>
            {t("settings.dev.fontDetail")}
          </Text>
          <View style={styles.linkGrid}>
            {fontPairOptions.map((option) => (
              <ActionButton
                key={option.id}
                label={fontPairLabels[option.id]}
                iconId="typography"
                variant={fontPairId === option.id ? "primary" : "secondary"}
                size="compact"
                style={styles.linkButton}
                onPress={() => setFontPairId(option.id)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {__DEV__ ? (
        <View style={styles.devSection}>
          <View style={styles.sectionHeader}>
            <MongchiIcon id="bug" size={22} />
            <Text style={[styles.sectionTitle, { fontFamily: fontFamilies.label }]}>{t("settings.dev.errorTitle")}</Text>
          </View>
          <Text style={[styles.controlText, { fontFamily: fontFamilies.body }]}>
            {errorLogEntries.length > 0
              ? t("settings.dev.errorCount", { count: errorLogEntries.length })
              : t("settings.dialogs.noErrors")}
          </Text>
          <View style={styles.linkGrid}>
            <ActionButton label={t("settings.dev.shareLog")} iconId="support" variant="secondary" size="compact" style={styles.linkButton} onPress={handleShareErrorLog} />
            <ActionButton label={t("settings.dev.clearLog")} iconId="delete" variant="secondary" size="compact" style={styles.linkButton} onPress={handleClearErrorLog} />
          </View>
        </View>
      ) : null}

      <View style={styles.dangerZone}>
        <Text style={[styles.dangerTitle, { fontFamily: fontFamilies.label }]}>{t("settings.reset.title")}</Text>
        <Text style={[styles.dangerText, { fontFamily: fontFamilies.body }]}>{t("settings.reset.detail")}</Text>
        <ActionButton
          label={privacyActionInProgress ? t("common.actions.deleting") : t("settings.reset.action")}
          iconId="refresh"
          variant="danger"
          disabled={privacyActionInProgress}
          onPress={handleReset}
        />
      </View>

      <Modal transparent animationType="fade" statusBarTranslucent visible={restoreModalVisible} onRequestClose={closeRestoreModal}>
        <View style={styles.restoreOverlay}>
          <View
            accessibilityLabel={t("settings.restoreModal.accessibilityLabel")}
            accessibilityRole="alert"
            accessibilityViewIsModal
            style={styles.restoreCard}
          >
            <Text accessibilityRole="header" style={[styles.restoreTitle, { fontFamily: fontFamilies.title }]}>
              {t("settings.restoreModal.title")}
            </Text>
            <Text style={[styles.restoreHint, { fontFamily: fontFamilies.body }]}>
              {t("settings.restoreModal.hint")}
            </Text>
            <TextInput
              value={restoreInputText}
              onChangeText={setRestoreInputText}
              placeholder={t("settings.restoreModal.placeholder")}
              placeholderTextColor={colors.mutedInk}
              multiline
              editable={!restoreInFlight}
              style={styles.restoreInput}
              accessibilityLabel={t("settings.restoreModal.inputAccessibilityLabel")}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.restoreActions}>
              <Pressable
                accessibilityRole="button"
                style={[styles.restoreButton, styles.restoreSecondaryButton]}
                disabled={restoreInFlight}
                onPress={closeRestoreModal}
              >
                <Text style={[styles.restoreButtonText, styles.restoreSecondaryButtonText]}>{t("common.actions.cancel")}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={[styles.restoreButton, styles.restorePrimaryButton, restoreInFlight ? styles.restoreButtonDisabled : null]}
                disabled={restoreInFlight}
                onPress={confirmRestoreFromBackup}
              >
                <Text style={[styles.restoreButtonText, styles.restorePrimaryButtonText]}>
                  {restoreInFlight ? t("common.actions.restoring") : t("common.actions.restore")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </GardenSceneFrame>
  );
}

const fontPairOptions: Array<{ id: FontPairId }> = [{ id: "A" }, { id: "B" }];

const styles = StyleSheet.create({
  settingsContent: {
    paddingTop: 14,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg
  },
  settingsInner: {
    gap: spacing.md
  },
  headerRow: {
    // No marginTop here: settingsContent.paddingTop already provides the
    // gap below the safe area. Adding marginTop on top of that padding
    // used to double up the top margin (see settings-screen audit).
    marginBottom: spacing.xs
  },
  settingsHero: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    borderRadius: 24,
    backgroundColor: "rgba(255,245,222,0.9)",
    borderWidth: 3,
    borderBottomWidth: 6,
    borderColor: "rgba(255,255,255,0.86)",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...shadows.gamePanel
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 21,
    backgroundColor: colors.cream,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.84)",
    alignItems: "center",
    justifyContent: "center",
    ...shadows.tile
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs
  },
  heroText: {
    color: colors.mutedInk,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800"
  },
  // guestBadge / guestBadgeText: kept for Phase D, when account linking
  // gives "Guest" something real to contrast against.
  // guestBadge: {
  //   alignSelf: "flex-start",
  //   marginTop: spacing.xs,
  //   borderRadius: radii.pill,
  //   backgroundColor: "rgba(125,97,200,0.14)",
  //   borderWidth: 2,
  //   borderColor: "rgba(255,255,255,0.7)",
  //   paddingHorizontal: spacing.sm,
  //   paddingVertical: 4
  // },
  // guestBadgeText: {
  //   color: colors.violet,
  //   fontSize: 11,
  //   lineHeight: 14,
  //   fontWeight: "900",
  //   textTransform: "uppercase"
  // },
  settingsSection: {
    borderRadius: 22,
    backgroundColor: "rgba(255,245,222,0.82)",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.82)",
    padding: spacing.sm,
    gap: spacing.sm,
    ...shadows.gamePanel
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  devSection: {
    borderRadius: 22,
    backgroundColor: "rgba(231,222,255,0.68)",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.82)",
    padding: spacing.sm,
    gap: spacing.sm,
    ...shadows.gamePanel
  },
  linkGrid: {
    flexDirection: "row",
    gap: spacing.sm
  },
  linkButton: {
    flex: 1
  },
  dangerZone: {
    borderRadius: 24,
    backgroundColor: "rgba(255,244,240,0.9)",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.82)",
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.gamePanel
  },
  dangerTitle: {
    color: colors.coral,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  dangerText: {
    color: colors.mutedInk,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800"
  },
  statusNotice: {
    borderRadius: radii.panel,
    backgroundColor: "rgba(244,255,246,0.92)",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.82)",
    padding: spacing.md,
    gap: spacing.xs,
    ...shadows.gamePanel
  },
  statusNoticeError: {
    backgroundColor: "rgba(255,244,240,0.94)",
    borderColor: "rgba(255,255,255,0.82)"
  },
  statusRibbon: {
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    backgroundColor: colors.cream,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.82)",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    ...shadows.tile
  },
  statusRibbonText: {
    color: colors.ink,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  statusTitle: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900"
  },
  statusText: {
    color: colors.mutedInk,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700"
  },
  compactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  compactIconFrame: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.cream,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.84)",
    alignItems: "center",
    justifyContent: "center"
  },
  mutedIcon: {
    opacity: 0.48
  },
  compactCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  compactTitle: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900"
  },
  compactText: {
    color: colors.mutedInk,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700"
  },
  accountEmailText: {
    color: colors.mutedInk,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    opacity: 0.72
  },
  compactAction: {
    flexShrink: 0
  },
  rowDivider: {
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.6)"
  },
  controlText: {
    color: colors.mutedInk,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700"
  },
  privacyNote: {
    color: colors.mutedInk,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700"
  },
  restoreOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(20,24,38,0.42)",
    padding: 24
  },
  restoreCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 28,
    borderWidth: 4,
    borderBottomWidth: 7,
    borderColor: colors.cream,
    backgroundColor: "rgba(255,245,222,0.98)",
    padding: 18,
    gap: 12,
    ...shadows.gamePanel
  },
  restoreTitle: {
    color: colors.ink,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "900"
  },
  restoreHint: {
    color: colors.mutedInk,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700"
  },
  restoreInput: {
    minHeight: 120,
    maxHeight: 220,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(125,97,200,0.28)",
    backgroundColor: "rgba(255,255,255,0.9)",
    color: colors.ink,
    fontSize: 12,
    lineHeight: 16,
    padding: 12,
    textAlignVertical: "top"
  },
  restoreActions: {
    flexDirection: "row",
    gap: 10
  },
  restoreButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 23,
    borderWidth: 3,
    borderBottomWidth: 5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  restorePrimaryButton: {
    backgroundColor: colors.apple,
    borderColor: colors.cream
  },
  restoreSecondaryButton: {
    backgroundColor: "rgba(255,255,255,0.78)",
    borderColor: "rgba(255,255,255,0.92)"
  },
  restoreButtonDisabled: {
    opacity: 0.7
  },
  restoreButtonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900"
  },
  restorePrimaryButtonText: {
    color: colors.white
  },
  restoreSecondaryButtonText: {
    color: colors.woodDark
  }
});
