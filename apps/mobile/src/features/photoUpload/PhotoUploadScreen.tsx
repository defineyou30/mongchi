import { useEffect } from "react";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Image, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { validateLocalPhotoCandidate } from "@mongchi/shared";

import { recordMobileEvent } from "../../shared/analytics/mobileAnalytics";
import { GeneratedPetAssetImage, getFallbackGeneratedPetAssetId } from "../../shared/assets/generatedPetAssets";
import { useFontFamilies } from "../../shared/design/tokens";
import { ActionButton } from "../../shared/ui/ActionButton";
import { useAppDialog } from "../../shared/ui/AppDialog";
import { BackButton } from "../../shared/ui/BackButton";
import { MongchiIcon } from "../../shared/ui/MongchiIcon";
import { OnboardingStoryArt } from "../../shared/ui/OnboardingStoryArt";
import { GardenSceneFrame } from "../appShell/GardenSceneFrame";
import { useTerrariumSession } from "../session/TerrariumSessionProvider";
import { photoUploadScreenStyles as styles } from "./photoUploadScreen.styles";

export function PhotoUploadScreen() {
  const { showDialog } = useAppDialog();
  const { t } = useTranslation();
  const fontFamilies = useFontFamilies();
  const { activePet, photo, canContinuePhotoStep, setConsentAccepted, setMockPhotoSelected, setSelectedPhotoUri } = useTerrariumSession();

  const selectedPhotoUri = photo.selectedPhotoUri?.startsWith("sample://") ? null : photo.selectedPhotoUri;
  const selected = photo.selectedMockPhoto || !!photo.selectedPhotoUri;

  // Onboarding funnel start: fires on every entry to this screen (including
  // a return visit after "Choose another photo" from a generation failure),
  // not just the very first ever. Fire-and-forget; never affects render.
  useEffect(() => {
    recordMobileEvent("onboarding_started", {});
  }, []);

  const acceptPickedAsset = (asset: ImagePicker.ImagePickerAsset, source: "library" | "camera") => {
    const validation = validateLocalPhotoCandidate({
      uri: asset.uri,
      byteSize: asset.fileSize ?? null,
      mimeType: asset.mimeType ?? null
    });

    if (!validation.ok) {
      showDialog({
        title: t("photoUpload.errors.invalidTitle"),
        message: validation.issue === "too_large" ? t("photoUpload.errors.tooLarge") : t("photoUpload.errors.invalidType")
      });
      return;
    }

    setSelectedPhotoUri(asset.uri, source, {
      byteSize: asset.fileSize ?? null,
      mimeType: asset.mimeType ?? null
    });
    setConsentAccepted(true);
  };

  const handleLibraryPick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      showDialog({ title: t("photoUpload.errors.libraryTitle"), message: t("photoUpload.errors.libraryMessage") });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: false,
      quality: 0.9,
      exif: false
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];

    acceptPickedAsset(asset, "library");
  };

  const handleCameraPick = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      showDialog({ title: t("photoUpload.errors.cameraTitle"), message: t("photoUpload.errors.cameraMessage") });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.9,
      exif: false
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    acceptPickedAsset(result.assets[0], "camera");
  };

  const handleSamplePick = () => {
    setMockPhotoSelected(true);
    setConsentAccepted(true);
  };

  const photoActionControls = (
    <View style={styles.photoActions}>
      <ActionButton
        label={t("photoUpload.library")}
        iconId="gallery"
        size="compact"
        style={styles.photoAction}
        onPress={handleLibraryPick}
      />
      <ActionButton
        label={t("common.actions.camera")}
        iconId="camera"
        size="compact"
        variant="secondary"
        onPress={handleCameraPick}
      />
    </View>
  );

  const handleContinue = () => {
    router.push("/pet-setup");
  };

  const createPetButton = (
    <ActionButton
      label={t("common.actions.continue")}
      iconId="forward"
      disabled={!canContinuePhotoStep}
      onPress={handleContinue}
    />
  );

  return (
    <GardenSceneFrame accessibilityLabel={t("photoUpload.accessibilityLabel")} includeBottomEdge innerStyle={styles.photoFlow}>
      <BackButton accessibilityLabel={t("photoUpload.back")} onPress={() => router.replace("/onboarding")} />

      <View style={styles.uploadPass}>
        <Text accessibilityRole="header" style={[styles.title, { fontFamily: fontFamilies.display }]}>
          {t("photoUpload.title")}
        </Text>
      </View>

      <OnboardingStoryArt accessibilityLabel={t("photoUpload.artAccessibilityLabel")} style={styles.storyArt} variant="photo" />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={selected ? t("photoUpload.changeSelected") : t("photoUpload.choosePhoto")}
        accessibilityState={{ selected }}
        style={[styles.photoPicker, selected ? styles.photoPickerSelected : null]}
        onPress={handleLibraryPick}
      >
        {selectedPhotoUri ? (
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel={t("photoUpload.selectedPreview", { petName: activePet.name })}
            source={{ uri: selectedPhotoUri }}
            style={styles.photoPreview}
          />
        ) : (
          <GeneratedPetAssetImage
            accessibilityLabel={selected ? t("photoUpload.selectedSamplePreview", { petName: activePet.name }) : t("photoUpload.samplePreview")}
            assetId={getFallbackGeneratedPetAssetId(activePet.species, "idle")}
            style={styles.photoPreview}
          />
        )}
        <View style={styles.photoCopy}>
          <Text style={[styles.photoTitle, { fontFamily: fontFamilies.title }]}>
            {selected ? (photo.source === "sample" ? t("photoUpload.sampleSelected") : t("photoUpload.photoSelected")) : t("photoUpload.choosePhoto")}
          </Text>
          <Text style={[styles.photoBody, { fontFamily: fontFamilies.body }]}>{t("photoUpload.purpose")}</Text>
        </View>
        <MongchiIcon id={selected ? "check" : "add-photo"} size={28} />
      </Pressable>

      {photoActionControls}
      {createPetButton}
      <Pressable
        accessibilityLabel={t("photoUpload.sampleAccessibilityLabel")}
        accessibilityRole="button"
        hitSlop={8}
        style={styles.sampleLinkRow}
        onPress={handleSamplePick}
      >
        <Text style={[styles.sampleLinkText, { fontFamily: fontFamilies.label }]}>{t("photoUpload.sampleAction")}</Text>
      </Pressable>
      <Text style={[styles.privacyNotice, { fontFamily: fontFamilies.body }]}>{t("photoUpload.privacy")}</Text>
    </GardenSceneFrame>
  );
}
