import { ArrowRight, PawPrint } from "lucide-react-native";
import { router } from "expo-router";
import { Text, TextInput, View } from "react-native";

import type { PersonalityTag, TalkingStyle } from "@mongchi/shared";

import { colors, useFontFamilies } from "../../shared/design/tokens";
import { ActionButton } from "../../shared/ui/ActionButton";
import { BackButton } from "../../shared/ui/BackButton";
import { Chip } from "../../shared/ui/Chip";
import { OnboardingStoryArt } from "../../shared/ui/OnboardingStoryArt";
import { GardenSceneFrame } from "../appShell/GardenSceneFrame";
import { useTerrariumSession } from "../session/TerrariumSessionProvider";
import { petSetupScreenStyles as styles } from "./petSetupScreen.styles";
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
  const { draft, canContinuePetSetup, updateDraft, togglePersonalityTag } = useTerrariumSession();
  const setupSummary = getPetSetupSummaryPresentation(draft);
  const fontFamilies = useFontFamilies();

  return (
    <GardenSceneFrame accessibilityLabel="Pet setup" includeBottomEdge innerStyle={styles.setupFlow}>
      <BackButton accessibilityLabel="Back to photo" onPress={() => router.replace("/photo-upload")} />

      <OnboardingStoryArt accessibilityLabel="Tiny pet moving-in desk with name tag and cozy bed" style={styles.storyArt} variant="profile" />

      <View style={styles.titleLockup}>
        <View style={styles.eyebrowTag}>
          <Text style={[styles.eyebrow, { fontFamily: fontFamilies.label }]}>Moving-in papers</Text>
        </View>
        <Text accessibilityRole="header" style={[styles.title, { fontFamily: fontFamilies.display }]}>
          Give your tiny friend a name
        </Text>
        <Text style={[styles.setupCaption, { fontFamily: fontFamilies.body }]}>{setupSummary.detailLabel} · getting ready to move in</Text>
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
