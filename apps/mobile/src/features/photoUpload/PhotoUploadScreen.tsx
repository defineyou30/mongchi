import { ArrowRight, Camera, Check, ImagePlus } from "lucide-react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Image, Pressable, Text, View } from "react-native";

import { validateLocalPhotoCandidate } from "@mongchi/shared";

import { GeneratedPetAssetImage, getFallbackGeneratedPetAssetId } from "../../shared/assets/generatedPetAssets";
import { colors, useFontFamilies } from "../../shared/design/tokens";
import { ActionButton } from "../../shared/ui/ActionButton";
import { useAppDialog } from "../../shared/ui/AppDialog";
import { BackButton } from "../../shared/ui/BackButton";
import { OnboardingStoryArt } from "../../shared/ui/OnboardingStoryArt";
import { GardenSceneFrame } from "../appShell/GardenSceneFrame";
import { useTerrariumSession } from "../session/TerrariumSessionProvider";
import { photoUploadScreenStyles as styles } from "./photoUploadScreen.styles";

export function PhotoUploadScreen() {
  const { showDialog } = useAppDialog();
  const fontFamilies = useFontFamilies();
  const { activePet, photo, canContinuePhotoStep, setConsentAccepted, setMockPhotoSelected, setSelectedPhotoUri } = useTerrariumSession();

  const selectedPhotoUri = photo.selectedPhotoUri?.startsWith("sample://") ? null : photo.selectedPhotoUri;
  const selected = photo.selectedMockPhoto || !!photo.selectedPhotoUri;

  const acceptPickedAsset = (asset: ImagePicker.ImagePickerAsset, source: "library" | "camera") => {
    const validation = validateLocalPhotoCandidate({
      uri: asset.uri,
      byteSize: asset.fileSize ?? null,
      mimeType: asset.mimeType ?? null
    });

    if (!validation.ok) {
      showDialog({ title: "Photo cannot be used", message: validation.messageSafe });
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
      showDialog({ title: "Photo access needed", message: "Choose one pet photo so the app can create your tiny friend." });
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
      showDialog({ title: "Camera access needed", message: "Camera access is only used when you choose to take a pet photo." });
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
        label="Photo library"
        Icon={ImagePlus}
        size="compact"
        style={styles.photoAction}
        onPress={handleLibraryPick}
      />
      <ActionButton
        label="Camera"
        Icon={Camera}
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
      label="Continue"
      Icon={ArrowRight}
      disabled={!canContinuePhotoStep}
      onPress={handleContinue}
    />
  );

  return (
    <GardenSceneFrame accessibilityLabel="Pet photo upload" includeBottomEdge innerStyle={styles.photoFlow}>
      <BackButton accessibilityLabel="Back to photo intro" onPress={() => router.replace("/onboarding")} />

      <View style={styles.uploadPass}>
        <Text accessibilityRole="header" style={[styles.title, { fontFamily: fontFamilies.display }]}>
          Pick their one best photo
        </Text>
      </View>

      <OnboardingStoryArt accessibilityLabel="Safe pet photo selection board" style={styles.storyArt} variant="photo" />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={selected ? "Change selected pet photo" : "Choose pet photo"}
        accessibilityState={{ selected }}
        style={[styles.photoPicker, selected ? styles.photoPickerSelected : null]}
        onPress={handleLibraryPick}
      >
        {selectedPhotoUri ? (
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel={`${activePet.name}'s selected pet photo preview`}
            source={{ uri: selectedPhotoUri }}
            style={styles.photoPreview}
          />
        ) : (
          <GeneratedPetAssetImage
            accessibilityLabel={selected ? `${activePet.name}'s selected sample pet photo preview` : "Sample pet photo preview"}
            assetId={getFallbackGeneratedPetAssetId(activePet.species, "idle")}
            style={styles.photoPreview}
          />
        )}
        <View style={styles.photoCopy}>
          <Text style={[styles.photoTitle, { fontFamily: fontFamilies.title }]}>
            {selected ? (photo.source === "sample" ? "Sample photo selected" : "Pet photo selected") : "Choose pet photo"}
          </Text>
          <Text style={[styles.photoBody, { fontFamily: fontFamilies.body }]}>Used to create the tiny friend who lives in your garden.</Text>
        </View>
        {selected ? <Check color={colors.leaf} size={24} strokeWidth={3} /> : <ImagePlus color={colors.ink} size={24} />}
      </Pressable>

      {photoActionControls}
      {createPetButton}
      <Pressable
        accessibilityLabel="Meet a sample friend"
        accessibilityRole="button"
        hitSlop={8}
        style={styles.sampleLinkRow}
        onPress={handleSamplePick}
      >
        <Text style={[styles.sampleLinkText, { fontFamily: fontFamilies.label }]}>No photo handy? Meet a sample friend</Text>
      </Pressable>
      <Text style={[styles.privacyNotice, { fontFamily: fontFamilies.body }]}>Only used to create your tiny friend. You can delete the original after move-in.</Text>
    </GardenSceneFrame>
  );
}
