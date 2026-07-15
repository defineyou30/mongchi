import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Gift } from "lucide-react-native";

import type { RewardClaimQueueItem } from "@mongchi/shared";

import type { AppLocale } from "../../localization/localeNormalization";
import { playSfx } from "../../shared/audio";
import { colors, radii, shadows, spacing, useTypography } from "../../shared/design/tokens";
import { maybeRequestAppReview } from "../../shared/review/appReviewPrompt";
import { GameItemImage, gameItemAssetByCatalogId } from "../../shared/ui/GameIllustrations";
import {
  getRewardClaimArt,
  getRewardClaimCardCopy,
  getRewardClaimReceiveButtonLabel,
  getRewardClaimRetryLine
} from "./rewardClaimPresentation";

export interface RewardClaimOverlayProps {
  /** The reward currently at the front of the queue, or null to hide the overlay entirely. */
  item: RewardClaimQueueItem | null;
  locale: AppLocale;
  reduceMotion: boolean;
  /**
   * Days since the active pet moved in, for the App Store review prompt's
   * own gate (see appReviewPrompt.ts) -- this overlay has no session access
   * of its own, so the mount site is responsible for computing this and for
   * omitting it (leaving the review prompt a no-op) wherever that isn't
   * available yet. Only read for a "streak" reward's completion; every other
   * reward kind ignores it entirely.
   */
  daysTogether?: number;
  /** Performs the actual claim (RPC for credit rewards, local grant for the daily treat). Resolves { ok: false } on a retryable failure -- the card stays up with a retry line instead of advancing. */
  onClaim: (item: RewardClaimQueueItem) => Promise<{ ok: boolean }>;
  /** Called once the success animation finishes, so the caller can pop the queue and show the next item (if any). */
  onDone: (item: RewardClaimQueueItem) => void;
}

const SPARKLE_COUNT = 6;
const SPARKLE_ANGLES = Array.from({ length: SPARKLE_COUNT }, (_, index) => (index / SPARKLE_COUNT) * Math.PI * 2);
const SUCCESS_LINGER_MS = 700;

/**
 * A single reusable "claim experience" for every credit/treat reward source
 * (settlement missions, care-streak milestones, the monthly letter, the walk
 * journal completing, bond levels, and the daily care treat) -- see
 * apps/mobile/src/features/session/TerrariumSessionProvider.tsx's reward
 * claim queue for how `item` is produced and sequenced. Mount once near the
 * app root (see app/_layout.tsx) so it can appear over any screen.
 */
export function RewardClaimOverlay({ item, locale, reduceMotion, daysTogether, onClaim, onDone }: RewardClaimOverlayProps) {
  const typography = useTypography();
  const cardScale = useRef(new Animated.Value(reduceMotion ? 1 : 0.7)).current;
  const cardOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const sparkleProgress = useRef(new Animated.Value(0)).current;
  const amountPulse = useRef(new Animated.Value(1)).current;
  const [claiming, setClaiming] = useState(false);
  const [claimFailed, setClaimFailed] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  // Bounce the card in whenever a new item arrives; reduced motion skips
  // straight to the resting state (still visible, just no motion).
  useEffect(() => {
    if (!item) {
      return;
    }

    setClaiming(false);
    setClaimFailed(false);
    setSucceeded(false);
    sparkleProgress.setValue(0);
    amountPulse.setValue(1);

    if (reduceMotion) {
      cardScale.setValue(1);
      cardOpacity.setValue(1);
      return;
    }

    cardScale.setValue(0.7);
    cardOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(cardScale, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 180, useNativeDriver: true })
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  if (!item) {
    return null;
  }

  const copy = getRewardClaimCardCopy(item.copyCategory, locale);
  const art = getRewardClaimArt(item.kind);
  const receiveLabel = getRewardClaimReceiveButtonLabel(locale);

  const handleReceive = async () => {
    if (claiming || succeeded) {
      return;
    }

    setClaiming(true);
    setClaimFailed(false);

    const result = await onClaim(item);

    if (!result.ok) {
      setClaiming(false);
      setClaimFailed(true);
      return;
    }

    setSucceeded(true);
    playSfx(item.kind === "credit" ? "jingle_discovery" : "sfx_treat");

    // App Store review prompt: a care-streak milestone (streak_3 and up --
    // see creditRewards.ts's CARE_STREAK_REWARD_LENGTHS, all >= 3 days) is
    // one of this app's few unambiguously positive moments, so it's one of
    // two spots that can surface the native review sheet (see
    // appReviewPrompt.ts's own gate for the actual budget/spacing rules).
    // Fire-and-forget: never blocks the claim animation or the queue
    // advancing to the next reward. daysTogether is only ever undefined if
    // the mount site couldn't supply it yet, in which case this is a no-op.
    if (item.copyCategory === "streak" && daysTogether !== undefined) {
      void maybeRequestAppReview("streak_reward_claimed", { daysTogether });
    }

    if (reduceMotion) {
      setTimeout(() => onDone(item), SUCCESS_LINGER_MS);
      return;
    }

    Animated.parallel([
      Animated.timing(sparkleProgress, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(amountPulse, { toValue: 1.35, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(amountPulse, { toValue: 1, duration: 220, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
      ])
    ]).start(() => {
      setTimeout(() => onDone(item), SUCCESS_LINGER_MS);
    });
  };

  return (
    <Modal transparent animationType="fade" statusBarTranslucent visible onRequestClose={() => undefined}>
      <View style={styles.overlay}>
        <Animated.View
          accessibilityRole="alert"
          accessibilityLabel={copy.accessibilityLabel}
          accessibilityViewIsModal
          style={[styles.card, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}
        >
          <View style={styles.artWrap}>
            {!reduceMotion ? (
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                {SPARKLE_ANGLES.map((angle) => {
                  const distance = 46;
                  const translateX = sparkleProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, Math.cos(angle) * distance]
                  });
                  const translateY = sparkleProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, Math.sin(angle) * distance]
                  });
                  const sparkleOpacity = sparkleProgress.interpolate({
                    inputRange: [0, 0.15, 1],
                    outputRange: [0, 1, 0]
                  });

                  return (
                    <Animated.View
                      key={angle}
                      style={[
                        styles.sparkle,
                        {
                          opacity: sparkleOpacity,
                          transform: [{ translateX }, { translateY }, { scale: sparkleOpacity }]
                        }
                      ]}
                    />
                  );
                })}
              </View>
            ) : null}
            {art === "credit_gem" ? (
              <GameItemImage accessibilityLabel="" decorative item="gem" style={styles.artImage} variant="ui" />
            ) : (
              <GameItemImage
                accessibilityLabel=""
                decorative
                item={item.itemId ? gameItemAssetByCatalogId[item.itemId] ?? "flowerPot" : "flowerPot"}
                style={styles.artImage}
                variant="ui"
              />
            )}
          </View>
          {item.kind === "credit" && item.amount ? (
            <Animated.View style={[styles.amountChip, { transform: [{ scale: amountPulse }] }]}>
              <Text style={[styles.amountText, typography.title]}>{`+${item.amount}`}</Text>
            </Animated.View>
          ) : null}
          <Text accessibilityRole="header" style={[styles.title, typography.title]}>
            {copy.title}
          </Text>
          <Text style={[styles.body, typography.body]}>{copy.body}</Text>
          {claimFailed ? <Text style={[styles.retryLine, typography.label]}>{getRewardClaimRetryLine(locale)}</Text> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={receiveLabel}
            accessibilityState={{ disabled: claiming || succeeded, busy: claiming }}
            disabled={claiming || succeeded}
            style={[styles.button, (claiming || succeeded) && styles.buttonDisabled]}
            onPress={handleReceive}
          >
            <Gift color={colors.ink} size={16} strokeWidth={2.8} />
            <Text style={[styles.buttonText, typography.button]}>{receiveLabel}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(20,24,38,0.46)",
    padding: spacing.xl
  },
  card: {
    width: "100%",
    maxWidth: 320,
    borderRadius: radii.panel,
    borderWidth: 4,
    borderBottomWidth: 7,
    borderColor: colors.cream,
    backgroundColor: "rgba(255,245,222,0.98)",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
    ...shadows.gamePanel
  },
  artWrap: {
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs
  },
  artImage: {
    width: 72,
    height: 72
  },
  sparkle: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 8,
    height: 8,
    marginTop: -4,
    marginLeft: -4,
    borderRadius: 4,
    backgroundColor: colors.honey
  },
  amountChip: {
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.gold,
    backgroundColor: "rgba(246,184,79,0.22)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs / 2
  },
  amountText: {
    color: colors.gold
  },
  title: {
    color: colors.ink,
    textAlign: "center"
  },
  body: {
    color: colors.mutedInk,
    textAlign: "center"
  },
  retryLine: {
    color: colors.gold,
    textAlign: "center"
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: 46,
    minWidth: 140,
    borderRadius: radii.pill,
    borderWidth: 3,
    borderBottomWidth: 5,
    borderColor: colors.cream,
    backgroundColor: colors.apple,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    marginTop: spacing.xs
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonText: {
    color: colors.ink
  }
});
