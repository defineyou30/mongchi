import { router } from "expo-router";
import { Pressable, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";

import type { PersonalityTag, TalkingStyle } from "@mongchi/shared";

import { GeneratedPetAssetImage, getFallbackGeneratedPetAssetId } from "../../shared/assets/generatedPetAssets";
import { colors, useFontFamilies } from "../../shared/design/tokens";
import { ActionButton } from "../../shared/ui/ActionButton";
import { BackButton } from "../../shared/ui/BackButton";
import { Chip } from "../../shared/ui/Chip";
import { MongchiIcon } from "../../shared/ui/MongchiIcon";
import { OnboardingStoryArt } from "../../shared/ui/OnboardingStoryArt";
import { GardenSceneFrame } from "../appShell/GardenSceneFrame";
import { useTerrariumSession } from "../session/TerrariumSessionProvider";
import { petSetupScreenStyles as styles } from "./petSetupScreen.styles";
import { petSpeciesOptions } from "./petSpeciesOptions";
const personalityOptions = [
  { value: "playful", labelKey: "petSetup.personality.playful" },
  { value: "calm", labelKey: "petSetup.personality.calm" },
  { value: "shy", labelKey: "petSetup.personality.shy" },
  { value: "curious", labelKey: "petSetup.personality.curious" },
  { value: "sleepy", labelKey: "petSetup.personality.sleepy" },
  { value: "affectionate", labelKey: "petSetup.personality.affectionate" }
] as const satisfies readonly { readonly value: PersonalityTag; readonly labelKey: string }[];

const talkingStyleOptions = [
  { value: "cute", labelKey: "petSetup.voice.cute" },
  { value: "gentle", labelKey: "petSetup.voice.gentle" },
  { value: "cheerful", labelKey: "petSetup.voice.cheerful" },
  { value: "comforting", labelKey: "petSetup.voice.comforting" }
] as const satisfies readonly { readonly value: TalkingStyle; readonly labelKey: string }[];

export function PetSetupScreen() {
  const { draft, canContinuePetSetup, updateDraft, togglePersonalityTag, startMockGeneration } = useTerrariumSession();
  const fontFamilies = useFontFamilies();
  const { t } = useTranslation();
  const species = draft.species === "dog" ? t("petSetup.species.dog") : t("petSetup.species.cat");
  const voice = t(`petSetup.voice.${draft.talkingStyle}`);

  return (
    <GardenSceneFrame accessibilityLabel={t("petSetup.accessibilityLabel")} includeBottomEdge innerStyle={styles.setupFlow}>
      <BackButton accessibilityLabel={t("petSetup.back")} onPress={() => router.replace("/photo-upload")} />

      <OnboardingStoryArt accessibilityLabel={t("petSetup.artAccessibilityLabel")} style={styles.storyArt} variant="profile" />

      <View style={styles.titleLockup}>
        <View style={styles.eyebrowTag}>
          <Text style={[styles.eyebrow, { fontFamily: fontFamilies.label }]}>{t("petSetup.eyebrow")}</Text>
        </View>
        <Text accessibilityRole="header" style={[styles.title, { fontFamily: fontFamilies.display }]}>
          {t("petSetup.title")}
        </Text>
        <Text style={[styles.setupCaption, { fontFamily: fontFamilies.body }]}>{t("petSetup.summary", { species, voice })}</Text>
      </View>

      <View style={styles.setupCard}>
        <View style={styles.sectionLabelRow}>
          <View style={styles.sectionLabelDot} />
          <Text style={[styles.sectionLabel, { fontFamily: fontFamilies.label }]}>{t("petSetup.speciesQuestion")}</Text>
        </View>
        <View accessibilityRole="radiogroup" style={styles.speciesRow}>
          {petSpeciesOptions.map((option) => {
            const selected = draft.species === option.value;

            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={t(option.labelKey)}
                onPress={() => updateDraft({ species: option.value })}
                style={({ pressed }) => [
                  styles.speciesOption,
                  selected ? styles.speciesOptionSelected : null,
                  pressed ? styles.speciesOptionPressed : null
                ]}
              >
                <View style={[styles.speciesIconPlate, selected ? styles.speciesIconPlateSelected : null]}>
                  <GeneratedPetAssetImage
                    accessibilityLabel={t(option.labelKey)}
                    assetId={getFallbackGeneratedPetAssetId(option.value, "idle")}
                    decorative
                    style={styles.speciesPetIcon}
                  />
                  {selected ? (
                    <View style={styles.speciesSelectedBadge}>
                      <MongchiIcon id="check" size={18} />
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.speciesLabel, { fontFamily: fontFamilies.title }]}>{t(option.labelKey)}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.divider} />

        <View style={styles.namePlate}>
          <View style={styles.namePlateIcon}>
            <MongchiIcon id="paw" size={28} />
          </View>
          <TextInput
            accessibilityLabel={t("petSetup.petName")}
            value={draft.name}
            placeholder={t("petSetup.petName")}
            placeholderTextColor={colors.mutedInk}
            autoCapitalize="words"
            style={[styles.input, styles.nameInput, { fontFamily: fontFamilies.title }]}
            onChangeText={(name) => updateDraft({ name })}
          />
        </View>
        <Text style={[styles.sectionHint, { fontFamily: fontFamilies.body }]}>{t("petSetup.nameHint")}</Text>
      </View>

      <View style={styles.setupCard}>
        <View style={styles.sectionLabelRow}>
          <View style={styles.sectionLabelDot} />
          <Text style={[styles.sectionLabel, { fontFamily: fontFamilies.label }]}>{t("petSetup.personalityQuestion")}</Text>
        </View>
        <View style={styles.chipRow}>
          {personalityOptions.map((option) => (
            <Chip
              key={option.value}
              label={t(option.labelKey)}
              selected={draft.personalityTags.includes(option.value)}
              onPress={() => togglePersonalityTag(option.value)}
            />
          ))}
        </View>

        <View style={styles.divider} />

        <View style={styles.sectionLabelRow}>
          <View style={styles.sectionLabelDot} />
          <Text style={[styles.sectionLabel, { fontFamily: fontFamilies.label }]}>{t("petSetup.voiceQuestion")}</Text>
        </View>
        <View style={styles.chipRow}>
          {talkingStyleOptions.map((option) => (
            <Chip
              key={option.value}
              label={t(option.labelKey)}
              selected={draft.talkingStyle === option.value}
              onPress={() => updateDraft({ talkingStyle: option.value })}
            />
          ))}
        </View>
      </View>

      <View style={styles.setupCard}>
        <View style={styles.sectionLabelRow}>
          <View style={styles.sectionLabelDot} />
          <Text style={[styles.sectionLabel, { fontFamily: fontFamilies.label }]}>{t("petSetup.favoriteQuestion")}</Text>
        </View>
        <View style={styles.favoritePlate}>
          <MongchiIcon id="paw" size={28} />
          <TextInput
            accessibilityLabel={t("petSetup.favoriteThing")}
            value={draft.favoriteThing}
            placeholder={t("petSetup.favoriteThing")}
            placeholderTextColor={colors.mutedInk}
            style={[styles.input, styles.favoriteInput, { fontFamily: fontFamilies.title }]}
            onChangeText={(favoriteThing) => updateDraft({ favoriteThing })}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.sectionLabelRow}>
          <View style={styles.sectionLabelDot} />
          <Text style={[styles.sectionLabel, { fontFamily: fontFamilies.label }]}>{t("petSetup.memoryQuestion")}</Text>
        </View>
        <View style={styles.favoritePlate}>
          <MongchiIcon id="paw" size={28} />
          <TextInput
            accessibilityLabel={t("petSetup.firstMemory")}
            value={draft.firstMemory ?? ""}
            placeholder={t("petSetup.firstMemoryPlaceholder")}
            placeholderTextColor={colors.mutedInk}
            style={[styles.input, styles.favoriteInput, { fontFamily: fontFamilies.title }]}
            onChangeText={(firstMemory) => updateDraft({ firstMemory })}
          />
        </View>
      </View>

      <ActionButton
        label={t("common.actions.continue")}
        iconId="forward"
        disabled={!canContinuePetSetup}
        onPress={() => {
          startMockGeneration();
          router.push("/generation");
        }}
      />
      {!canContinuePetSetup ? (
        <Text style={[styles.continueHint, { fontFamily: fontFamilies.body }]}>{t("petSetup.continueHint")}</Text>
      ) : null}

    </GardenSceneFrame>
  );
}
