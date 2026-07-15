import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import type { GenerationJobStatus } from "@mongchi/shared";

import { getLocalizedText, normalizeAppLocale } from "../../localization/locale";
import { useReducedMotionPreference } from "../../shared/accessibility/useReducedMotionPreference";
import { recordMobileEvent } from "../../shared/analytics/mobileAnalytics";
import { colors, radii, shadows, spacing } from "../../shared/design/tokens";
import { ActionButton } from "../../shared/ui/ActionButton";
import { BackButton } from "../../shared/ui/BackButton";
import { TerrariumArt } from "../../shared/ui/GameIllustrations";
import { MongchiIcon } from "../../shared/ui/MongchiIcon";
import { GardenSceneFrame } from "../appShell/GardenSceneFrame";
import { useTerrariumSession } from "../session/TerrariumSessionProvider";
import { classifyGenerationFailureReason } from "./generationFailureReason";
import { getGenerationMotionPolicy } from "./generationMotionPolicy";
import {
  getGenerationPresentation,
  playGenerationArrivalCueOnce,
  recordGenerationFailureCueOnce
} from "./generationPresentation";

// Rotating personalized narration keeps the wait feeling like the pet is being
// hand-crafted rather than a spinner running.
const generationStepKeys = [
  "generation.steps.preparing",
  "generation.steps.details",
  "generation.steps.creating",
  "generation.steps.polishing",
  "generation.steps.movingIn"
] as const;

const hatchingObservationKeys = [
  "generation.observations.first",
  "generation.observations.second",
  "generation.observations.third",
  "generation.observations.fourth",
  "generation.observations.fifth",
  "generation.observations.sixth",
  "generation.observations.seventh",
  "generation.observations.eighth"
] as const;

const eggWarmKeys = [
  "generation.warmLines.first",
  "generation.warmLines.second",
  "generation.warmLines.third",
  "generation.warmLines.fourth"
] as const;

// Server-side safety-rejection failure codes (supabase/functions/generate-avatar's
// safety-check step -- see markJobFailed's callers there). These get their own
// localized copy in every locale (generation.safetyFailure) instead of the
// generic generation.retryFailure, since "try again" on the *same* photo is
// never going to help here -- see the safety-failure CTA reorder below, which
// makes "Choose another photo" the primary action for exactly this reason.
const safetyFailureCodes = new Set([
  "source_photo_safety_failed",
  "source_photo_safety_unavailable",
  "source_photo_manual_review_required"
]);

const hatchingStatusKeys = {
  created: "generation.statuses.created",
  queued: "generation.statuses.queued",
  claimed: "generation.statuses.claimed",
  validating: "generation.statuses.validating",
  preprocessing: "generation.statuses.preprocessing",
  safety_checking: "generation.statuses.safety_checking",
  generating: "generation.statuses.generating",
  postprocessing: "generation.statuses.postprocessing",
  quality_checking: "generation.statuses.quality_checking",
  uploading_assets: "generation.statuses.uploading_assets",
  cleanup_pending: "generation.statuses.cleanup_pending",
  completed: "generation.statuses.completed",
  failed: "generation.statuses.failed",
  cancelled: "generation.statuses.cancelled",
  expired: "generation.statuses.expired"
} as const satisfies Record<GenerationJobStatus, string>;

export function GenerationScreen() {
  const {
    activePet,
    petProfile,
    generation,
    generationPollSnapshot,
    generationProgress,
    pollMockGeneration,
    retryMockGeneration
  } = useTerrariumSession();
  const { i18n, t } = useTranslation();
  const locale = normalizeAppLocale(i18n.resolvedLanguage);
  const generationPresentation = getGenerationPresentation({
    activeGenerationJobId: petProfile?.activeGenerationJobId,
    status: generation.status
  });
  const completed = generation.status === "completed";
  const failed = generationPresentation.showsPausedFailure;
  const isQuotaFailure = failed && generation.failureCode === "generation_quota_exceeded";
  const isSafetyFailure = failed && !!generation.failureCode && safetyFailureCodes.has(generation.failureCode);
  const [observationIndex, setObservationIndex] = useState(0);
  const [warmTapCount, setWarmTapCount] = useState(0);
  // Local, render-driven disable for the "Try again" button, on top of the
  // ref-based in-flight guard in TerrariumSessionProvider. The provider's
  // guard prevents duplicate network calls; this flag prevents the button
  // from even looking tappable during that window, and resets once a fresh
  // failure comes in so the next real retry attempt can be tapped again.
  const [retryTapDisabled, setRetryTapDisabled] = useState(false);
  const observationLine = useMemo(
    () =>
      t(hatchingObservationKeys[observationIndex % hatchingObservationKeys.length] ?? hatchingObservationKeys[0], {
        petName: activePet.name,
        favoriteThing: activePet.favoriteThing ?? t("generation.favoriteFallback")
      }),
    [activePet.favoriteThing, activePet.name, observationIndex, t]
  );
  const warmLine = warmTapCount > 0 ? t(eggWarmKeys[(warmTapCount - 1) % eggWarmKeys.length] ?? eggWarmKeys[0]) : null;
  const firstPersonalityTag = activePet.personalityTags[0];
  const teaserKey = (() => {
    switch (firstPersonalityTag) {
      case "playful": return "generation.teaser.playful" as const;
      case "calm": return "generation.teaser.calm" as const;
      case "shy": return "generation.teaser.shy" as const;
      case "curious": return "generation.teaser.curious" as const;
      case "sleepy": return "generation.teaser.sleepy" as const;
      case "affectionate": return "generation.teaser.affectionate" as const;
      default: return "generation.teaser.fallback" as const;
    }
  })();
  const whosOnTheWayTeaser = t(teaserKey);
  const localizedRetryFailure = t("generation.retryFailure", { petName: activePet.name });
  // Non-English locales previously showed this same generic retryFailure
  // line no matter why generation failed. A safety rejection needs its own
  // copy (generation.safetyFailure) that nudges toward a different photo
  // rather than "let's try again" -- see the CTA reorder below for the same
  // reasoning applied to the buttons. en-US is unchanged: it keeps showing
  // the server's own messageSafe (already reason-specific) with retryFailure
  // only as a fallback if the server didn't send one.
  const localizedSafetyFailure = t("generation.safetyFailure");
  const nonEnglishFailureMessage = isSafetyFailure ? localizedSafetyFailure : localizedRetryFailure;
  const safeFailureMessage = getLocalizedText(locale, {
    "en-US": generation.failureMessageSafe ?? localizedRetryFailure,
    "ko-KR": nonEnglishFailureMessage,
    "ja-JP": nonEnglishFailureMessage,
    "zh-TW": nonEnglishFailureMessage,
    "de-DE": nonEnglishFailureMessage,
    "fr-FR": nonEnglishFailureMessage,
    "pt-BR": nonEnglishFailureMessage,
    "es-MX": nonEnglishFailureMessage
  });
  const reduceMotionEnabled = useReducedMotionPreference();
  const motionPolicy = getGenerationMotionPolicy({
    reduceMotionEnabled,
    status: generation.status
  });

  // Plays the arrival jingle the moment this job's status flips to
  // completed, not when the loading screen is first entered -- see
  // playGenerationArrivalCueOnce's doc comment. This is the one "it's done"
  // beat for this flow: PetRevealScreen's own sfx_reveal on mount is a
  // separate, later moment the player reaches only after deliberately
  // tapping "Reveal" below, not an automatic follow-on from this screen.
  // generation_completed rides the same per-job dedupe (playSfx/haptics and
  // the analytics event should fire exactly once, together, for the same
  // arrival) rather than tracking its own job-id set.
  useEffect(() => {
    if (completed && playGenerationArrivalCueOnce(petProfile?.activeGenerationJobId)) {
      recordMobileEvent("generation_completed", {});
    }
  }, [completed, petProfile?.activeGenerationJobId]);

  useEffect(() => {
    // Re-enables "Try again" whenever a fresh failure lands, not just when
    // retryCount changes. A retry that fails before a new job is created
    // (e.g. the source photo's file:// URI has gone stale and can't be
    // re-read) leaves retryCount unchanged, so keying off retryCount alone
    // left the button permanently disabled after that single failed tap.
    // failedAt/failureCode change on every terminal failure, retried or not,
    // so they catch that case too.
    if (failed) {
      setRetryTapDisabled(false);
    }
  }, [failed, generation.retryCount, generation.failedAt, generation.failureCode]);

  // generation_failed, deduped by failedAt (a fresh timestamp on every
  // terminal failure, retried or not -- see recordGenerationFailureCueOnce's
  // doc comment) so a re-render while status stays "failed" never double
  // reports the same occurrence. `reason` is bucketed into a small closed
  // set (see classifyGenerationFailureReason) rather than passing the raw,
  // server-evolvable failureCode string through as free text.
  useEffect(() => {
    if (failed && recordGenerationFailureCueOnce(generation.failedAt)) {
      recordMobileEvent("generation_failed", { reason: classifyGenerationFailureReason(generation.failureCode) });
    }
  }, [failed, generation.failedAt, generation.failureCode]);

  useEffect(() => {
    if (completed || failed) {
      return;
    }

    const interval = setInterval(() => {
      setObservationIndex((index) => index + 1);
    }, 3500);

    return () => clearInterval(interval);
  }, [completed, failed]);

  useEffect(() => {
    if (!motionPolicy.shouldScheduleAutomaticPoll) {
      return;
    }

    const interval = setInterval(() => {
      pollMockGeneration();
    }, 900);

    return () => clearInterval(interval);
  }, [motionPolicy.shouldScheduleAutomaticPoll, pollMockGeneration]);

  return (
    <GardenSceneFrame accessibilityLabel={t("generation.accessibilityLabel", { petName: activePet.name })}>
      <BackButton accessibilityLabel={t("generation.back")} onPress={() => router.replace("/pet-setup")} />

      <View style={styles.copy}>
        <Text style={styles.eyebrow}>{t("generation.eyebrow")}</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {completed ? t("generation.titleReady", { petName: activePet.name }) : t("generation.titleMoving", { petName: activePet.name })}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("generation.warmAccessibilityLabel", { petName: activePet.name })}
        disabled={completed || failed}
        onPress={() => setWarmTapCount((count) => count + 1)}
        style={({ pressed }) => (pressed && !completed && !failed ? styles.hatchingScenePressed : null)}
      >
        <TerrariumArt
          accessibilityLabel={t("generation.artAccessibilityLabel", { petName: activePet.name })}
          scene="hatching"
          showAmbientItems={false}
          variant="hatching"
          style={styles.hatchingScene}
        />
      </Pressable>

      {!completed && !failed ? (
        <View style={styles.warmRow}>
          <MongchiIcon id="sparkles" size={22} />
          <Text style={styles.warmText}>{warmLine ?? t("generation.forming")}</Text>
          {warmTapCount > 0 ? (
            <View style={styles.warmCounter}>
              <MongchiIcon id="affection" size={18} />
              <Text style={styles.warmCounterText}>{warmTapCount}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View
        accessibilityRole="progressbar"
        accessibilityLabel={t("generation.progressAccessibilityLabel")}
        accessibilityValue={{ min: 0, max: 100, now: generationProgress }}
        style={styles.progressBlock}
      >
        <View style={styles.progressHeader}>
          <View style={styles.stepTitle}>
            <MongchiIcon id="gift" size={24} />
            <Text style={styles.stepText}>{t(generationStepKeys[generation.currentStepIndex] ?? generationStepKeys[0])}</Text>
          </View>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${generationProgress}%` }]} />
        </View>
        {!failed ? <Text style={styles.pollText}>{t(hatchingStatusKeys[generationPollSnapshot.status])}</Text> : null}
        {!completed && !failed ? <Text style={styles.observationText}>{observationLine}</Text> : null}
      </View>

      {!failed ? (
        <View style={styles.recapCard}>
          <Text style={styles.recapTitle}>{t("generation.recapTitle")}</Text>
          <Text style={styles.recapLine}>{whosOnTheWayTeaser}</Text>
          {generationPresentation.guidance ? <Text style={styles.resumeGuidance}>{t("generation.guidance")}</Text> : null}
        </View>
      ) : null}

      {failed ? (
        <View style={styles.failureBlock}>
          <MongchiIcon id="alert" size={28} />
          <View style={styles.failureCopy}>
            <Text style={styles.failureTitle}>{t("generation.failureTitle")}</Text>
            <Text style={styles.failureText}>
              {isQuotaFailure
                ? t("generation.quotaFailure")
                : safeFailureMessage}
            </Text>
          </View>
        </View>
      ) : null}

      {motionPolicy.shouldShowManualContinue ? (
        <ActionButton label={t("common.actions.continue")} iconId="forward" onPress={() => pollMockGeneration({ force: true })} />
      ) : null}
      {completed ? (
        <ActionButton
          label={t("generation.reveal")}
          iconId="forward"
          onPress={() => router.push("/pet-reveal")}
        />
      ) : null}
      {failed && !isQuotaFailure ? (
        isSafetyFailure ? (
          // Safety rejections need a different default CTA than an ordinary
          // failure: retrying with the *same* photo will just fail the same
          // safety check again, so "Choose another photo" leads here instead
          // of "Try again" (still offered, just demoted to secondary) --
          // avoids nudging the player into a retry loop.
          <>
            <ActionButton
              label={t("common.actions.chooseAnotherPhoto")}
              iconId="refresh"
              onPress={() => router.push("/photo-upload")}
            />
            <ActionButton
              label={t("common.actions.tryAgain")}
              iconId="refresh"
              variant="secondary"
              disabled={retryTapDisabled}
              onPress={() => {
                setRetryTapDisabled(true);
                retryMockGeneration();
              }}
            />
          </>
        ) : (
          <>
            <ActionButton
              label={t("common.actions.tryAgain")}
              iconId="refresh"
              disabled={retryTapDisabled}
              onPress={() => {
                setRetryTapDisabled(true);
                retryMockGeneration();
              }}
            />
            <ActionButton label={t("common.actions.chooseAnotherPhoto")} iconId="refresh" variant="secondary" onPress={() => router.push("/photo-upload")} />
          </>
        )
      ) : null}
      {isQuotaFailure ? (
        <Pressable accessibilityRole="button" hitSlop={8} style={styles.homeLinkRow} onPress={() => router.replace("/")}>
          <Text style={styles.homeLinkText}>{t("common.actions.backHome")}</Text>
        </Pressable>
      ) : null}

    </GardenSceneFrame>
  );
}

const styles = StyleSheet.create({
  copy: {
    gap: spacing.xs,
    borderRadius: radii.panel,
    borderWidth: 3,
    borderBottomWidth: 6,
    borderColor: "rgba(255,255,255,0.84)",
    backgroundColor: "rgba(255,245,222,0.94)",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...shadows.gamePanel
  },
  eyebrow: {
    color: colors.skyDeep,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  title: {
    color: colors.ink,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900"
  },
  hatchingScene: {
    minHeight: 300,
    justifyContent: "flex-end"
  },
  hatchingScenePressed: {
    transform: [{ scale: 0.985 }]
  },
  warmRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    alignSelf: "flex-start",
    maxWidth: "100%",
    marginHorizontal: spacing.sm,
    borderRadius: radii.control,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: "rgba(255,255,255,0.78)",
    backgroundColor: "rgba(255,245,222,0.92)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadows.tile
  },
  warmText: {
    flex: 1,
    color: colors.mutedInk,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700"
  },
  warmCounter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: "rgba(255,255,255,0.7)"
  },
  warmCounterText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "900"
  },
  observationText: {
    color: colors.woodDark,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "800"
  },
  recapCard: {
    borderRadius: radii.panel,
    backgroundColor: "rgba(255,245,222,0.84)",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.8)",
    padding: spacing.md,
    gap: 3,
    ...shadows.gamePanel
  },
  recapTitle: {
    color: colors.skyDeep,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  recapLine: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900"
  },
  progressBlock: {
    borderRadius: radii.panel,
    backgroundColor: "rgba(255,232,199,0.88)",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.82)",
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.gamePanel
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  stepTitle: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  stepText: {
    flex: 1,
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  pollText: {
    color: colors.mutedInk,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700"
  },
  resumeGuidance: {
    color: colors.mutedInk,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700"
  },
  track: {
    height: 18,
    borderRadius: 10,
    backgroundColor: "rgba(122,110,102,0.16)",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.72)"
  },
  fill: {
    height: "100%",
    borderRadius: 9,
    backgroundColor: colors.honey
  },
  failureBlock: {
    borderRadius: radii.panel,
    backgroundColor: "rgba(255,242,239,0.92)",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.82)",
    padding: spacing.lg,
    flexDirection: "row",
    gap: spacing.md,
    ...shadows.gamePanel
  },
  failureCopy: {
    flex: 1,
    gap: spacing.xs
  },
  failureTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  failureText: {
    color: colors.mutedInk,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700"
  },
  homeLinkRow: {
    alignSelf: "center"
  },
  homeLinkText: {
    color: colors.skyDeep,
    fontSize: 13,
    fontWeight: "800",
    textDecorationLine: "underline"
  }
});
