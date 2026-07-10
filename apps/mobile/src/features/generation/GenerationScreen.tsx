import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Gift, Heart, RotateCcw, Sparkles } from "lucide-react-native";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { generationSteps } from "@mongchi/shared";
import type { GenerationJobStatus } from "@mongchi/shared";

import { useReducedMotionPreference } from "../../shared/accessibility/useReducedMotionPreference";
import { colors, radii, shadows, spacing } from "../../shared/design/tokens";
import { ActionButton } from "../../shared/ui/ActionButton";
import { BackButton } from "../../shared/ui/BackButton";
import { TerrariumArt } from "../../shared/ui/GameIllustrations";
import { GardenSceneFrame } from "../appShell/GardenSceneFrame";
import { useTerrariumSession } from "../session/TerrariumSessionProvider";
import { getGenerationMotionPolicy } from "./generationMotionPolicy";
import { getGenerationPresentation, playGenerationStartCueOnce } from "./generationPresentation";

// Rotating personalized narration keeps the wait feeling like the pet is being
// hand-crafted rather than a spinner running.
const hatchingObservationLines = [
  "Studying the fur colors from your photo...",
  "Sketching {petName}'s ear shape very carefully...",
  "Choosing the fluffiest pixels one by one...",
  "Practicing {petName}'s first hello...",
  "Measuring the perfect tail wiggle...",
  "Teaching the sunlight where {petName} will nap...",
  "Packing tiny memories of {favoriteThing}...",
  "Polishing the glossy eyes until they sparkle..."
];

const eggWarmLines = [
  "Your warmth reached the egg. It wiggled a little!",
  "The egg feels cozier now.",
  "A tiny heartbeat said thank you.",
  "Almost there. Your hand is helping."
];

const hatchingStatusCopy: Record<GenerationJobStatus, string> = {
  created: "Warming the tiny studio.",
  queued: "Waiting for a clear moving-in spot.",
  claimed: "Opening the little studio.",
  validating: "Checking the photo details.",
  preprocessing: "Preparing the photo.",
  safety_checking: "Making sure the tiny friend can move in safely.",
  generating: "Creating the first tiny companion.",
  postprocessing: "Softening the fur and final details.",
  quality_checking: "Checking the final look.",
  uploading_assets: "Packing the pet for home.",
  completed: "Ready to meet.",
  failed: "Move-in paused.",
  cancelled: "Move-in was stopped.",
  expired: "Move-in timed out."
};

const personalityTeaserPhrases: Record<string, string> = {
  playful: "Someone playful is",
  calm: "Someone calm is",
  shy: "Someone a little shy is",
  curious: "Someone curious is",
  sleepy: "Someone sleepy is",
  affectionate: "Someone sweet is"
};

const buildWhosOnTheWayTeaser = (personalityTags: readonly string[]): string => {
  const firstTag = personalityTags[0];
  const phrase = (firstTag && personalityTeaserPhrases[firstTag]) || "Someone sweet is";

  return `${phrase} packing their bags...`;
};

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
  const generationPresentation = getGenerationPresentation({
    activeGenerationJobId: petProfile?.activeGenerationJobId,
    status: generation.status
  });
  const completed = generation.status === "completed";
  const failed = generationPresentation.showsPausedFailure;
  const isQuotaFailure = failed && generation.failureCode === "generation_quota_exceeded";
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
      hatchingObservationLines[observationIndex % hatchingObservationLines.length]!
        .replaceAll("{petName}", activePet.name)
        .replaceAll("{favoriteThing}", activePet.favoriteThing ?? "cozy little things"),
    [activePet.favoriteThing, activePet.name, observationIndex]
  );
  const warmLine = warmTapCount > 0 ? eggWarmLines[(warmTapCount - 1) % eggWarmLines.length]! : null;
  const whosOnTheWayTeaser = useMemo(() => buildWhosOnTheWayTeaser(activePet.personalityTags), [activePet.personalityTags]);
  const reduceMotionEnabled = useReducedMotionPreference();
  const motionPolicy = getGenerationMotionPolicy({
    reduceMotionEnabled,
    status: generation.status
  });

  useEffect(() => {
    if (generationPresentation.guidance) {
      playGenerationStartCueOnce(petProfile?.activeGenerationJobId);
    }
  }, [generationPresentation.guidance, petProfile?.activeGenerationJobId]);

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
    <GardenSceneFrame accessibilityLabel={`${activePet.name}'s moving-in flow`}>
      <BackButton accessibilityLabel="Back to pet setup" onPress={() => router.replace("/pet-setup")} />

      <View style={styles.copy}>
        <Text style={styles.eyebrow}>Moving in</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {completed ? `${activePet.name} is ready` : `${activePet.name} is moving in`}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Warm ${activePet.name}'s egg with a gentle tap`}
        disabled={completed || failed}
        onPress={() => setWarmTapCount((count) => count + 1)}
        style={({ pressed }) => (pressed && !completed && !failed ? styles.hatchingScenePressed : null)}
      >
        <TerrariumArt
          accessibilityLabel={`${activePet.name}'s magical moving-in scene`}
          scene="hatching"
          showAmbientItems={false}
          variant="hatching"
          style={styles.hatchingScene}
        />
      </Pressable>

      {!completed && !failed ? (
        <View style={styles.warmRow}>
          <Sparkles color={colors.honey} size={15} strokeWidth={2.6} />
          <Text style={styles.warmText}>{warmLine ?? "Your tiny friend is forming from the photo details."}</Text>
          {warmTapCount > 0 ? (
            <View style={styles.warmCounter}>
              <Heart color={colors.rose} fill={colors.rose} size={12} strokeWidth={2} />
              <Text style={styles.warmCounterText}>{warmTapCount}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Moving-in progress"
        accessibilityValue={{ min: 0, max: 100, now: generationProgress }}
        style={styles.progressBlock}
      >
        <View style={styles.progressHeader}>
          <View style={styles.stepTitle}>
            <Gift color={colors.honey} size={18} strokeWidth={2.8} />
            <Text style={styles.stepText}>{generationSteps[generation.currentStepIndex]}</Text>
          </View>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${generationProgress}%` }]} />
        </View>
        {!failed ? <Text style={styles.pollText}>{generationPresentation.statusCopy ?? hatchingStatusCopy[generationPollSnapshot.status]}</Text> : null}
        {!completed && !failed ? <Text style={styles.observationText}>{observationLine}</Text> : null}
      </View>

      {!failed ? (
        <View style={styles.recapCard}>
          <Text style={styles.recapTitle}>Who's on the way</Text>
          <Text style={styles.recapLine}>{whosOnTheWayTeaser}</Text>
          {generationPresentation.guidance ? <Text style={styles.resumeGuidance}>{generationPresentation.guidance}</Text> : null}
        </View>
      ) : null}

      {failed ? (
        <View style={styles.failureBlock}>
          <AlertTriangle color={colors.coral} size={22} strokeWidth={2.6} />
          <View style={styles.failureCopy}>
            <Text style={styles.failureTitle}>Move-in paused</Text>
            <Text style={styles.failureText}>
              {isQuotaFailure
                ? "Your tiny friend will be ready to move in soon — check back in a little while."
                : (generation.failureMessageSafe ?? `The tiny door got stuck. Let's try creating ${activePet.name} again.`)}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.stepList}>
        <Text style={styles.stepListTitle}>Along the way</Text>
        {generationSteps.map((step, index) => {
          const isCurrent = index === generation.currentStepIndex && !completed;
          const isPast = index < generation.currentStepIndex || completed;

          return (
            <View key={step} style={styles.stepRow}>
              <View
                style={[
                  styles.stepDot,
                  isPast ? styles.stepDotDone : null,
                  isCurrent ? styles.stepDotCurrent : null
                ]}
              />
              <Text
                style={[
                  styles.stepLabel,
                  isPast ? styles.stepLabelDone : null,
                  isCurrent ? styles.stepLabelCurrent : null
                ]}
              >
                {step}
              </Text>
            </View>
          );
        })}
      </View>

      {motionPolicy.shouldShowManualContinue ? (
        <ActionButton label="Continue" Icon={ArrowRight} onPress={() => pollMockGeneration({ force: true })} />
      ) : null}
      {completed ? (
        <ActionButton
          label="Reveal pet"
          Icon={ArrowRight}
          onPress={() => router.push("/pet-reveal")}
        />
      ) : null}
      {failed && !isQuotaFailure ? (
        <>
          <ActionButton
            label="Try again"
            Icon={RotateCcw}
            disabled={retryTapDisabled}
            onPress={() => {
              setRetryTapDisabled(true);
              retryMockGeneration();
            }}
          />
          <ActionButton label="Choose another photo" Icon={RotateCcw} variant="secondary" onPress={() => router.push("/photo-upload")} />
        </>
      ) : null}
      {isQuotaFailure ? (
        <Pressable accessibilityRole="button" hitSlop={8} style={styles.homeLinkRow} onPress={() => router.replace("/")}>
          <Text style={styles.homeLinkText}>Back to home</Text>
        </Pressable>
      ) : null}
    </GardenSceneFrame>
  );
}

const styles = StyleSheet.create({
  copy: {
    gap: spacing.sm
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
  stepList: {
    borderRadius: radii.panel,
    backgroundColor: "rgba(255,245,222,0.84)",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.8)",
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.gamePanel
  },
  stepListTitle: {
    color: colors.skyDeep,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    marginBottom: 2
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  stepDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "rgba(122,110,102,0.14)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.7)"
  },
  stepDotDone: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(84,168,92,0.5)",
    borderColor: "transparent"
  },
  stepDotCurrent: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.honey,
    borderColor: colors.cream,
    ...shadows.tile
  },
  stepLabel: {
    color: "rgba(122,110,102,0.55)",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700"
  },
  stepLabelDone: {
    color: colors.mutedInk
  },
  stepLabelCurrent: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900"
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
