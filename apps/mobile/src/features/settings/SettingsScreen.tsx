import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Modal, Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";

import { syncAmbienceWithSettings, syncBgmWithSettings, useAudioSettings } from "../../shared/audio";
import { colors, radii, shadows, spacing, useFontFamilies } from "../../shared/design/tokens";
import { fontPairLabels, useFontPair } from "../../shared/design/fontPair";
import type { FontPairId } from "../../shared/design/fontPair";
import { ActionButton } from "../../shared/ui/ActionButton";
import { useAppDialog } from "../../shared/ui/AppDialog";
import { MongchiIcon } from "../../shared/ui/MongchiIcon";
import { ScreenHeaderRow } from "../../shared/ui/ScreenHeaderRow";
import { GardenSceneFrame } from "../appShell/GardenSceneFrame";
import { useTerrariumSession } from "../session/TerrariumSessionProvider";
import { clearErrorLog, readErrorLog } from "../../shared/errors/reporter";
import type { ErrorLogEntry } from "../../shared/errors/reporter";
import type { WeatherCondition } from "@mongchi/shared";

const weatherPreviewOptions: Array<{ condition: WeatherCondition; label: string; detail: string }> = [
  { condition: "clear", label: "Clear", detail: "Default sunny garden." },
  { condition: "rain", label: "Rain", detail: "Rain overlay and cozy weather lines." },
  { condition: "snow", label: "Snow", detail: "Winter background and soft cold lines." },
  { condition: "wind", label: "Wind", detail: "Leafy movement and walk discoveries." },
  { condition: "hot", label: "Warm", detail: "Sunny scene and extra garden-care cues." }
];
const fallbackWeatherPreview = weatherPreviewOptions[0]!;

export function SettingsScreen() {
  const { showDialog } = useAppDialog();
  const fontFamilies = useFontFamilies();
  const [fontPairId, setFontPairId] = useFontPair();
  const [audioSettings, setAudioSettings] = useAudioSettings();
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
    importSessionBackup
  } = useTerrariumSession();
  const privacyActionInProgress = apiSyncStatus === "syncing";
  const privacyActionError = apiSyncStatus === "error" ? apiErrorMessage : null;
  const [restoreModalVisible, setRestoreModalVisible] = useState(false);
  const [restoreInputText, setRestoreInputText] = useState("");
  const [restoreInFlight, setRestoreInFlight] = useState(false);
  const weatherLocationInProgress = weatherLocationStatus === "requesting";
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
        showDialog({ title: "Error log", message: "No recent errors logged on this device." });
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
      title: "Delete local photo copy?",
      message: "This clears the photo copy saved on this device. Your friend was already made — nothing about them changes.",
      primaryLabel: "Delete",
      secondaryLabel: "Cancel",
      onPrimary: deleteOriginalPhoto
    });
  };

  const confirmDeleteChatHistory = () => {
    showDialog({
      title: "Delete chat history?",
      message: "This clears local chat history for this session. It does not affect free care reactions.",
      primaryLabel: "Delete",
      secondaryLabel: "Cancel",
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
      showDialog({ title: "Backup", message: result.messageSafe });
      return;
    }

    const todayKey = new Date().toISOString().slice(0, 10);

    void Share.share({
      title: `mongchi-backup-${todayKey}.json`,
      message: result.backupText
    }).catch(() => {
      showDialog({ title: "Backup", message: "Couldn't open the share sheet. Please try again." });
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
      showDialog({ title: "Restore from backup", message: "Paste your backup text first." });
      return;
    }

    showDialog({
      title: "Restore this backup?",
      message: "This will replace your current garden. Your current friend will be backed up first, just in case.",
      primaryLabel: "Restore",
      secondaryLabel: "Cancel",
      onPrimary: () => {
        setRestoreInFlight(true);

        void importSessionBackup(restoreInputText)
          .then((result) => {
            if (!result.ok) {
              showDialog({ title: "Restore from backup", message: result.messageSafe });
              return;
            }

            setRestoreModalVisible(false);
            setRestoreInputText("");
            showDialog({ title: "Welcome back!", message: "Your garden has been restored from the backup." });
          })
          .finally(() => setRestoreInFlight(false));
      }
    });
  };

  const handleReset = () => {
    showDialog({
      title: "Delete all your data?",
      message:
        "This deletes this device's pet setup, generated pet, care state, and inventory, and also asks our servers to delete your photo, generated avatars, and account data. This can't be undone.",
      primaryLabel: "Delete",
      secondaryLabel: "Cancel",
      onPrimary: () => {
        void resetSession().then((result) => {
          if (!result.ok) {
            return;
          }

          router.replace("/onboarding");

          if (result.serverDeleteWarning) {
            showDialog({ title: "Server delete needs a retry", message: result.serverDeleteWarning });
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
      accessibilityLabel={`${activePet.name}'s settings and privacy vault`}
      contentStyle={styles.settingsContent}
      innerStyle={styles.settingsInner}
    >
      <ScreenHeaderRow
        title="Settings"
        titleFontFamily={fontFamilies.display}
        backAccessibilityLabel="Back home"
        style={styles.headerRow}
        onBack={() => router.replace("/terrarium")}
      />

      <View style={styles.settingsHero}>
        <View style={styles.heroIcon}>
          <MongchiIcon id="paw" size={34} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={[styles.heroText, { fontFamily: fontFamilies.body }]}>
            Weather, reminders, privacy, and support — all in one cozy spot.
          </Text>
          {/*
            Guest badge removed: with only anonymous auth and no account
            linking (Phase D) yet, a static "Guest" label has nothing to
            contrast against and only raises "guest vs. what?" confusion.
            Reintroduce it alongside a real account-link CTA in Phase D.
          */}
        </View>
      </View>

      {privacyActionInProgress || privacyActionError ? (
        <View style={[styles.statusNotice, privacyActionError ? styles.statusNoticeError : null]}>
          <View style={styles.statusRibbon}>
            <MongchiIcon id={privacyActionError ? "shield-alert" : "shield-check"} size={22} />
            <Text style={[styles.statusRibbonText, { fontFamily: fontFamilies.label }]}>{privacyActionError ? "Needs check" : "Syncing"}</Text>
          </View>
          <Text style={[styles.statusTitle, { fontFamily: fontFamilies.title }]}>
            {privacyActionError ? "Privacy action needs attention" : "Privacy action in progress"}
          </Text>
          <Text style={[styles.statusText, { fontFamily: fontFamilies.body }]}>
            {privacyActionError ?? "Keep the app open while the change finishes."}
          </Text>
        </View>
      ) : null}

      <View style={styles.settingsSection}>
        <View style={styles.sectionHeader}>
          <MongchiIcon id="rain" size={22} />
          <Text style={[styles.sectionTitle, { fontFamily: fontFamilies.label }]}>Little reminders</Text>
        </View>

        <View style={styles.compactRow}>
          <View style={styles.compactIconFrame}>
            {weatherState.settings.enabled ? (
              <MongchiIcon id="rain" size={22} />
            ) : (
              <MongchiIcon id="sun" size={22} />
            )}
          </View>
          <View style={styles.compactCopy}>
            <Text style={[styles.compactTitle, { fontFamily: fontFamilies.title }]}>Weather scenes</Text>
            {weatherState.settings.enabled ? (
              <Text style={[styles.compactText, { fontFamily: fontFamilies.body }]}>{activeWeather.label}: {activeWeather.detail}</Text>
            ) : null}
          </View>
          <ActionButton
            label={weatherState.settings.enabled ? "Turn off" : "Enable"}
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
            <Text style={[styles.compactTitle, { fontFamily: fontFamilies.title }]}>Use my location</Text>
            {weatherLocationMessage ? (
              <Text style={[styles.compactText, { fontFamily: fontFamilies.body }]}>{weatherLocationMessage}</Text>
            ) : null}
          </View>
          <ActionButton
            label={weatherLocationInProgress ? "Checking" : "Enable"}
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
                <Text style={[styles.compactTitle, { fontFamily: fontFamilies.title }]}>Preview weather</Text>
                <Text style={[styles.compactText, { fontFamily: fontFamilies.body }]}>Next: {nextWeather.label}</Text>
              </View>
              <ActionButton
                label="Change"
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
          <Text style={[styles.sectionTitle, { fontFamily: fontFamilies.label }]}>Sound & feel</Text>
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
            <Text style={[styles.compactTitle, { fontFamily: fontFamilies.title }]}>Sounds</Text>
            <Text style={[styles.compactText, { fontFamily: fontFamilies.body }]}>
              Little chimes and taps, paired with gentle vibrations.
            </Text>
          </View>
          <ActionButton
            label={audioSettings.soundsEnabled ? "Turn off" : "Enable"}
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
            <Text style={[styles.compactTitle, { fontFamily: fontFamilies.title }]}>Music & ambience</Text>
            <Text style={[styles.compactText, { fontFamily: fontFamilies.body }]}>
              Soft garden music and background sounds, like birdsong or rain.
            </Text>
          </View>
          <ActionButton
            label={audioSettings.musicEnabled ? "Turn off" : "Enable"}
            variant="secondary"
            size="compact"
            style={styles.compactAction}
            onPress={toggleMusicEnabled}
          />
        </View>
      </View>

      <View style={styles.settingsSection}>
        <View style={styles.sectionHeader}>
          <MongchiIcon id="shield-check" size={22} />
          <Text style={[styles.sectionTitle, { fontFamily: fontFamilies.label }]}>Privacy & care</Text>
        </View>

        <View style={styles.compactRow}>
          <View style={styles.compactIconFrame}>
            <MongchiIcon id="camera" size={22} />
          </View>
          <View style={styles.compactCopy}>
            <Text style={[styles.compactTitle, { fontFamily: fontFamilies.title }]}>Local photo copy</Text>
            <Text style={[styles.compactText, { fontFamily: fontFamilies.body }]}>
              {originalPhotoDeletedAt ? "Deleted from this device." : "A copy is kept on this device only."}
            </Text>
          </View>
          <ActionButton
            label={privacyActionInProgress ? "Deleting" : originalPhotoDeletedAt ? "Cleared" : "Delete"}
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
          Your photo was only used to create your friend — it was tucked away right after move-in.
        </Text>

        <View style={styles.rowDivider} />

        <View style={styles.compactRow}>
          <View style={styles.compactIconFrame}>
            <MongchiIcon id="chat" size={22} />
          </View>
          <View style={styles.compactCopy}>
            <Text style={[styles.compactTitle, { fontFamily: fontFamilies.title }]}>Chat history</Text>
            <Text style={[styles.compactText, { fontFamily: fontFamilies.body }]}>
              {chatHistoryDeletedAt ? "Deleted for this session." : "Manage longer conversations here."}
            </Text>
          </View>
          <ActionButton
            label={privacyActionInProgress ? "Deleting" : chatHistoryDeletedAt ? "Cleared" : "Delete"}
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
            <Text style={[styles.compactTitle, { fontFamily: fontFamilies.title }]}>Back up your friend</Text>
            <Text style={[styles.compactText, { fontFamily: fontFamilies.body }]}>
              Save a copy of your garden so it's never only on this device.
            </Text>
          </View>
          <ActionButton
            label="Export"
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
            <Text style={[styles.compactTitle, { fontFamily: fontFamilies.title }]}>Restore from backup</Text>
            <Text style={[styles.compactText, { fontFamily: fontFamilies.body }]}>
              Paste a saved backup to bring your garden back.
            </Text>
          </View>
          <ActionButton
            label="Restore"
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
          <Text style={[styles.sectionTitle, { fontFamily: fontFamilies.label }]}>Support & legal</Text>
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
          <ActionButton label="Privacy" iconId="shield-check" variant="secondary" size="compact" style={styles.linkButton} onPress={() => router.push("/privacy")} />
          <ActionButton label="Terms" iconId="document" variant="secondary" size="compact" style={styles.linkButton} onPress={() => router.push("/terms")} />
          <ActionButton label="Support" iconId="support" variant="secondary" size="compact" style={styles.linkButton} onPress={() => router.push("/support")} />
        </View>
      </View>

      {__DEV__ ? (
        <View style={styles.devSection}>
          <View style={styles.sectionHeader}>
            <MongchiIcon id="typography" size={22} />
            <Text style={[styles.sectionTitle, { fontFamily: fontFamilies.label }]}>Dev: font pair</Text>
          </View>
          <Text style={[styles.controlText, { fontFamily: fontFamilies.body }]}>
            Compares the two W2 font pairs across the app. Not shown in production builds.
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
            <Text style={[styles.sectionTitle, { fontFamily: fontFamilies.label }]}>Dev: error log</Text>
          </View>
          <Text style={[styles.controlText, { fontFamily: fontFamilies.body }]}>
            {errorLogEntries.length > 0
              ? `${errorLogEntries.length} recent error${errorLogEntries.length === 1 ? "" : "s"} logged on this device.`
              : "No recent errors logged on this device."}
          </Text>
          <View style={styles.linkGrid}>
            <ActionButton label="Share log" iconId="support" variant="secondary" size="compact" style={styles.linkButton} onPress={handleShareErrorLog} />
            <ActionButton label="Clear log" iconId="delete" variant="secondary" size="compact" style={styles.linkButton} onPress={handleClearErrorLog} />
          </View>
        </View>
      ) : null}

      <View style={styles.dangerZone}>
        <Text style={[styles.dangerTitle, { fontFamily: fontFamilies.label }]}>Reset</Text>
        <Text style={[styles.dangerText, { fontFamily: fontFamilies.body }]}>Deletes this device's local pet setup and starts onboarding again.</Text>
        <ActionButton
          label={privacyActionInProgress ? "Deleting" : "Delete pet data"}
          iconId="refresh"
          variant="danger"
          disabled={privacyActionInProgress}
          onPress={handleReset}
        />
      </View>

      <Modal transparent animationType="fade" statusBarTranslucent visible={restoreModalVisible} onRequestClose={closeRestoreModal}>
        <View style={styles.restoreOverlay}>
          <View
            accessibilityLabel="Restore from backup"
            accessibilityRole="alert"
            accessibilityViewIsModal
            style={styles.restoreCard}
          >
            <Text accessibilityRole="header" style={[styles.restoreTitle, { fontFamily: fontFamilies.title }]}>
              Restore from backup
            </Text>
            <Text style={[styles.restoreHint, { fontFamily: fontFamilies.body }]}>
              Paste the backup text you saved earlier (from iCloud, Notes, or email).
            </Text>
            <TextInput
              value={restoreInputText}
              onChangeText={setRestoreInputText}
              placeholder="Paste your backup JSON here"
              placeholderTextColor={colors.mutedInk}
              multiline
              editable={!restoreInFlight}
              style={styles.restoreInput}
              accessibilityLabel="Backup text"
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
                <Text style={[styles.restoreButtonText, styles.restoreSecondaryButtonText]}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={[styles.restoreButton, styles.restorePrimaryButton, restoreInFlight ? styles.restoreButtonDisabled : null]}
                disabled={restoreInFlight}
                onPress={confirmRestoreFromBackup}
              >
                <Text style={[styles.restoreButtonText, styles.restorePrimaryButtonText]}>
                  {restoreInFlight ? "Restoring" : "Restore"}
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
