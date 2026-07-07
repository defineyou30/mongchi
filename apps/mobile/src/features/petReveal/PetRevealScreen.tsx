import { useEffect, useRef, useState } from "react";
import { ArrowRight, Share2 } from "lucide-react-native";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { playSfx } from "../../shared/audio";
import { colors, radii, shadows, spacing, useFontFamilies } from "../../shared/design/tokens";
import { getFallbackGeneratedPetAssetId } from "../../shared/assets/generatedPetAssets";
import { ActionButton } from "../../shared/ui/ActionButton";
import { BackButton } from "../../shared/ui/BackButton";
import { TerrariumArt } from "../../shared/ui/GameIllustrations";
import { buildPetRevealShareMessage, sharePetCard } from "../../shared/share/petShare";
import { GardenSceneFrame } from "../appShell/GardenSceneFrame";
import { useTerrariumSession } from "../session/TerrariumSessionProvider";

export function PetRevealScreen() {
  const { acceptGeneratedPet, acceptedAsset, activePet, generation, generatedAssetUriById, pollMockGeneration, retryMockGeneration } =
    useTerrariumSession();
  const fontFamilies = useFontFamilies();
  const petAssetId = acceptedAsset?.id ?? getFallbackGeneratedPetAssetId(activePet.species, "happy");
  const petAssetUri = generatedAssetUriById[petAssetId] ?? null;
  const [isSharing, setIsSharing] = useState(false);

  // A completed generation's signed asset URLs are time-limited and may have
  // been signed a while ago (e.g. the user backgrounded the app between
  // GenerationScreen's "Reveal pet" tap and actually opening this screen, or
  // restored a persisted session). Force one fresh poll on mount so the
  // signed URLs get re-issued instead of the reveal risking an expired link.
  // Guarded to fire at most once per mount -- pollMockGeneration is a stable
  // callback, but re-running on every re-render (e.g. after the poll result
  // lands and generation.status is still "completed") would otherwise loop.
  const forcePollAttemptedRef = useRef(false);

  useEffect(() => {
    if (forcePollAttemptedRef.current || generation.status !== "completed") {
      return;
    }

    forcePollAttemptedRef.current = true;
    pollMockGeneration({ force: true });
  }, [generation.status, pollMockGeneration]);

  // One-shot reveal sound: this screen only ever mounts for the "here's your
  // pet" moment, so a plain mount effect (no persisted key needed) is enough.
  useEffect(() => {
    playSfx("sfx_reveal");
  }, []);

  const handleAccept = () => {
    acceptGeneratedPet();
    router.replace("/terrarium");
  };

  const handleRetry = () => {
    retryMockGeneration();
    router.push("/generation");
  };

  const handleShare = async () => {
    if (isSharing) {
      return;
    }

    setIsSharing(true);
    try {
      await sharePetCard({
        petName: activePet.name,
        assetUri: petAssetUri,
        message: buildPetRevealShareMessage(activePet.name)
      });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <GardenSceneFrame accessibilityLabel={`${activePet.name}'s reveal`}>
      <BackButton accessibilityLabel="Back to moving-in" onPress={() => router.replace("/generation")} />

      <TerrariumArt
        accessibilityLabel={`${activePet.name}'s joyful pet reveal celebration`}
        petAssetId={petAssetId}
        petAssetUri={petAssetUri}
        scene="reveal"
        showAmbientItems={false}
        variant="pet"
        style={styles.revealScene}
      >
        <View style={styles.namePlaque}>
          <Text numberOfLines={1} style={[styles.namePlaqueText, { fontFamily: fontFamilies.label }]}>
            New friend
          </Text>
        </View>
      </TerrariumArt>

      <View style={styles.copy}>
        <Text style={[styles.eyebrow, { fontFamily: fontFamilies.label }]}>Pet reveal</Text>
        <Text accessibilityRole="header" style={[styles.title, { fontFamily: fontFamilies.display }]}>
          Meet {activePet.name}
        </Text>
      </View>

      <View style={styles.actionPanel}>
        <ActionButton label="Step into the garden" Icon={ArrowRight} onPress={handleAccept} />
        <ActionButton
          accessibilityLabel={`Share ${activePet.name}`}
          label="Share"
          Icon={Share2}
          variant="secondary"
          size="compact"
          disabled={isSharing}
          onPress={handleShare}
        />
      </View>

      <View style={styles.notQuiteRightRow}>
        <Text style={[styles.notQuiteRightLabel, { fontFamily: fontFamilies.body }]}>Not quite right?</Text>
        <View style={styles.notQuiteRightLinks}>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={handleRetry}>
            <Text style={[styles.textLink, { fontFamily: fontFamilies.label }]}>Try again</Text>
          </Pressable>
          <Text style={[styles.textLinkDivider, { fontFamily: fontFamilies.body }]}>·</Text>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.push("/support")}>
            <Text style={[styles.textLink, { fontFamily: fontFamilies.label }]}>Report issue</Text>
          </Pressable>
        </View>
      </View>
    </GardenSceneFrame>
  );
}

const styles = StyleSheet.create({
  revealScene: {
    minHeight: 398
  },
  namePlaque: {
    position: "absolute",
    bottom: 22,
    alignSelf: "center",
    minWidth: 152,
    minHeight: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,245,222,0.94)",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.88)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    ...shadows.tile
  },
  namePlaqueText: {
    color: colors.woodDark,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  copy: {
    gap: spacing.md
  },
  eyebrow: {
    color: colors.woodDark,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  title: {
    color: colors.ink,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "900"
  },
  actionPanel: {
    borderRadius: radii.panel,
    backgroundColor: "rgba(255,232,199,0.58)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.82)",
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.gamePanel
  },
  notQuiteRightRow: {
    alignItems: "center",
    gap: 4
  },
  notQuiteRightLabel: {
    color: colors.mutedInk,
    fontSize: 12,
    fontWeight: "700"
  },
  notQuiteRightLinks: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  textLink: {
    color: colors.skyDeep,
    fontSize: 13,
    fontWeight: "800",
    textDecorationLine: "underline"
  },
  textLinkDivider: {
    color: colors.mutedInk,
    fontSize: 13,
    fontWeight: "700"
  }
});
