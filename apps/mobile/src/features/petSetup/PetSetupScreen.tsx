import { ArrowRight, PawPrint } from "lucide-react-native";
import { router } from "expo-router";
import { StyleSheet, Text, TextInput, View } from "react-native";

import type { PersonalityTag, TalkingStyle } from "@mongchi/shared";

import { colors, radii, shadows, spacing, useFontFamilies } from "../../shared/design/tokens";
import { ActionButton } from "../../shared/ui/ActionButton";
import { BackButton } from "../../shared/ui/BackButton";
import { Chip } from "../../shared/ui/Chip";
import { PetSetupArt } from "../../shared/ui/GameIllustrations";
import { GardenSceneFrame } from "../appShell/GardenSceneFrame";
import { useTerrariumSession } from "../session/TerrariumSessionProvider";
import { getPetSetupSummaryPresentation } from "./petSetupPresentation";

const personalityOptions: Array<{ value: PersonalityTag; label: string }> = [
  { value: "playful", label: "Playful" },
  { value: "calm", label: "Calm" },
  { value: "shy", label: "Shy" },
  { value: "curious", label: "Curious" },
  { value: "sleepy", label: "Sleepy" },
  { value: "affectionate", label: "Affectionate" }
];

const talkingStyleOptions: Array<{ value: TalkingStyle; label: string }> = [
  { value: "cute", label: "Cute" },
  { value: "gentle", label: "Gentle" },
  { value: "cheerful", label: "Cheerful" },
  { value: "comforting", label: "Comforting" }
];

export function PetSetupScreen() {
  const { draft, photo, canContinuePetSetup, updateDraft, togglePersonalityTag } = useTerrariumSession();
  const setupSummary = getPetSetupSummaryPresentation(draft);
  const fontFamilies = useFontFamilies();

  return (
    <GardenSceneFrame accessibilityLabel="Pet setup" innerStyle={styles.setupFlow}>
      <BackButton accessibilityLabel="Back to photo" onPress={() => router.replace("/photo-upload")} />

      <PetSetupArt
        detailLabel={setupSummary.detailLabel}
        nameLabel={setupSummary.nameLabel}
        photoUri={photo.selectedPhotoUri}
        isSamplePhoto={photo.selectedMockPhoto}
        showCharms={false}
        species={draft.species}
      />

      <View style={styles.titleLockup}>
        <View style={styles.eyebrowTag}>
          <Text style={[styles.eyebrow, { fontFamily: fontFamilies.label }]}>Moving-in papers</Text>
        </View>
        <Text accessibilityRole="header" style={[styles.title, { fontFamily: fontFamilies.display }]}>
          What should we call your buddy?
        </Text>
        <Text style={[styles.setupCaption, { fontFamily: fontFamilies.body }]}>{setupSummary.detailLabel} · a little soul waiting for a name</Text>
      </View>

      <View style={styles.setupCard}>
        <View style={styles.namePlate}>
          <View style={styles.namePlateIcon}>
            <PawPrint color={colors.woodDark} size={18} strokeWidth={2.7} />
          </View>
          <TextInput
            accessibilityLabel="Pet name"
            value={draft.name}
            placeholder="Pet name"
            placeholderTextColor={colors.mutedInk}
            autoCapitalize="words"
            style={[styles.input, styles.nameInput, { fontFamily: fontFamilies.title }]}
            onChangeText={(name) => updateDraft({ name })}
          />
        </View>
        <Text style={[styles.sectionHint, { fontFamily: fontFamilies.body }]}>This is the name that will greet you at the door every day.</Text>
      </View>

      <View style={styles.setupCard}>
        <View style={styles.sectionLabelRow}>
          <View style={styles.sectionLabelDot} />
          <Text style={[styles.sectionLabel, { fontFamily: fontFamilies.label }]}>How does your buddy feel today?</Text>
        </View>
        <View style={styles.chipRow}>
          {personalityOptions.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={draft.personalityTags.includes(option.value)}
              onPress={() => togglePersonalityTag(option.value)}
            />
          ))}
        </View>

        <View style={styles.divider} />

        <View style={styles.sectionLabelRow}>
          <View style={styles.sectionLabelDot} />
          <Text style={[styles.sectionLabel, { fontFamily: fontFamilies.label }]}>What does their little voice sound like?</Text>
        </View>
        <View style={styles.chipRow}>
          {talkingStyleOptions.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={draft.talkingStyle === option.value}
              onPress={() => updateDraft({ talkingStyle: option.value })}
            />
          ))}
        </View>
      </View>

      <View style={styles.setupCard}>
        <View style={styles.sectionLabelRow}>
          <View style={styles.sectionLabelDot} />
          <Text style={[styles.sectionLabel, { fontFamily: fontFamilies.label }]}>What do they already love?</Text>
        </View>
        <View style={styles.favoritePlate}>
          <PawPrint color={colors.woodDark} size={18} strokeWidth={2.7} />
          <TextInput
            accessibilityLabel="Favorite tiny thing"
            value={draft.favoriteThing}
            placeholder="Favorite tiny thing"
            placeholderTextColor={colors.mutedInk}
            style={[styles.input, styles.favoriteInput, { fontFamily: fontFamilies.title }]}
            onChangeText={(favoriteThing) => updateDraft({ favoriteThing })}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.sectionLabelRow}>
          <View style={styles.sectionLabelDot} />
          <Text style={[styles.sectionLabel, { fontFamily: fontFamilies.label }]}>Any tiny memory to carry with them?</Text>
        </View>
        <View style={styles.favoritePlate}>
          <PawPrint color={colors.woodDark} size={18} strokeWidth={2.7} />
          <TextInput
            accessibilityLabel="First tiny memory"
            value={draft.firstMemory ?? ""}
            placeholder="A little memory with your buddy…"
            placeholderTextColor={colors.mutedInk}
            style={[styles.input, styles.favoriteInput, { fontFamily: fontFamilies.title }]}
            onChangeText={(firstMemory) => updateDraft({ firstMemory })}
          />
        </View>
      </View>

      <ActionButton
        label="Continue"
        Icon={ArrowRight}
        disabled={!canContinuePetSetup}
        onPress={() => router.push("/generation")}
      />
      {!canContinuePetSetup ? (
        <Text style={[styles.continueHint, { fontFamily: fontFamilies.body }]}>Pick a name, a mood, and a voice to continue.</Text>
      ) : null}

    </GardenSceneFrame>
  );
}

const styles = StyleSheet.create({
  setupFlow: {
    gap: spacing.lg
  },
  titleLockup: {
    gap: 6,
    paddingHorizontal: spacing.xs
  },
  eyebrowTag: {
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    backgroundColor: "#20283F",
    borderWidth: 2,
    borderBottomWidth: 3,
    borderColor: colors.cream,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4
  },
  eyebrow: {
    color: colors.skySoft,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  setupCard: {
    borderRadius: radii.panel,
    borderWidth: 3,
    borderBottomWidth: 6,
    borderColor: "rgba(255,255,255,0.84)",
    backgroundColor: "rgba(255,245,222,0.93)",
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.gamePanel
  },
  continueHint: {
    color: colors.mutedInk,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
    textAlign: "center",
    marginTop: -6
  },
  title: {
    color: colors.ink,
    fontSize: 27,
    lineHeight: 32,
    fontWeight: "900"
  },
  setupCaption: {
    color: colors.mutedInk,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    marginTop: 2
  },
  divider: {
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(216,179,130,0.4)",
    marginVertical: 2
  },
  namePlate: {
    minHeight: 58,
    borderRadius: radii.control,
    borderWidth: 3,
    borderBottomWidth: 6,
    borderColor: colors.cream,
    backgroundColor: colors.wood,
    padding: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    ...shadows.tile
  },
  namePlateIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.cream,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center"
  },
  input: {
    minHeight: 42,
    borderRadius: radii.control,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.76)",
    backgroundColor: colors.white,
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
    paddingHorizontal: spacing.md
  },
  nameInput: {
    flex: 1
  },
  sectionHint: {
    color: colors.mutedInk,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800"
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  sectionLabelDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.honey
  },
  sectionLabel: {
    color: colors.woodDark,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.3
  },
  favoritePlate: {
    minHeight: 54,
    borderRadius: radii.control,
    borderWidth: 3,
    borderBottomWidth: 6,
    borderColor: colors.cream,
    backgroundColor: colors.wood,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: 5,
    ...shadows.tile
  },
  favoriteInput: {
    flex: 1
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  }
});
