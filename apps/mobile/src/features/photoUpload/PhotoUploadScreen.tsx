import { ArrowRight, Camera, Check, ImagePlus } from "lucide-react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { validateLocalPhotoCandidate } from "@mongchi/shared";

import { GeneratedPetAssetImage, getFallbackGeneratedPetAssetId } from "../../shared/assets/generatedPetAssets";
import { colors, radii, shadows, spacing, useFontFamilies } from "../../shared/design/tokens";
import { ActionButton } from "../../shared/ui/ActionButton";
import { useAppDialog } from "../../shared/ui/AppDialog";
import { BackButton } from "../../shared/ui/BackButton";
import { PhotoUploadArt } from "../../shared/ui/GameIllustrations";
import { GardenSceneFrame } from "../appShell/GardenSceneFrame";
import { useTerrariumSession } from "../session/TerrariumSessionProvider";

export function PhotoUploadScreen() {
  const { showDialog } = useAppDialog();
  const fontFamilies = useFontFamilies();
  const { activePet, photo, canContinuePhotoStep, setConsentAccepted, setMockPhotoSelected, setSelectedPhotoUri, startMockGeneration } =
    useTerrariumSession();

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
    // Kick generation off in the background the moment the photo is
    // confirmed, so the 60-90s wait is spent behind the setup screen instead
    // of on a dedicated waiting screen. Fire-and-forget: startMockGeneration
    // manages its own in-flight guard (see hasActiveGenerationJob in
    // TerrariumSessionProvider), so navigating away immediately can't start a
    // duplicate job, and GenerationScreen's auto-start effect is the fallback
    // if this call never got a chance to fire.
    startMockGeneration();
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
    <GardenSceneFrame accessibilityLabel="Pet photo upload" innerStyle={styles.photoFlow}>
      <BackButton accessibilityLabel="Back to welcome" onPress={() => router.replace("/onboarding")} />

      <View style={styles.uploadPass}>
        <View style={styles.uploadPassIcon}>
          <ImagePlus color={colors.violet} size={22} strokeWidth={2.8} />
        </View>
        <Text accessibilityRole="header" style={[styles.title, { fontFamily: fontFamilies.display }]}>
          Pick one pet photo
        </Text>
      </View>

      <PhotoUploadArt showDecorations={false} showSlots={false} species={activePet.species} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={selected ? "Change selected pet photo" : "Choose pet photo"}
        accessibilityState={{ selected }}
        style={[styles.photoPicker, selected ? styles.photoPickerSelected : null]}
        onPress={handleLibraryPick}
      >
        {photo.selectedPhotoUri ? (
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel={`${activePet.name}'s selected pet photo preview`}
            source={{ uri: photo.selectedPhotoUri }}
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
          <Text style={[styles.photoBody, { fontFamily: fontFamilies.body }]}>One clear dog or cat photo. Used only to create your tiny friend.</Text>
        </View>
        {selected ? <Check color={colors.leaf} size={24} strokeWidth={3} /> : <ImagePlus color={colors.ink} size={24} />}
      </Pressable>

      {photoActionControls}
      {createPetButton}
      <Pressable accessibilityRole="button" hitSlop={8} style={styles.sampleLinkRow} onPress={handleSamplePick}>
        <Text style={[styles.sampleLinkText, { fontFamily: fontFamilies.label }]}>No photo handy? Meet a sample friend</Text>
      </Pressable>
      <Text style={[styles.privacyNotice, { fontFamily: fontFamilies.body }]}>Only used to create your tiny friend. You can delete the original anytime.</Text>
    </GardenSceneFrame>
  );
}

const styles = StyleSheet.create({
  photoFlow: {
    gap: spacing.md
  },
  uploadPass: {
    borderRadius: radii.panel,
    borderWidth: 3,
    borderBottomWidth: 6,
    borderColor: "rgba(255,255,255,0.84)",
    backgroundColor: "rgba(255,245,222,0.93)",
    padding: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    ...shadows.gamePanel
  },
  uploadPassIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.cream,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.tile
  },
  title: {
    flex: 1,
    minWidth: 0,
    color: colors.ink,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "900"
  },
  photoPicker: {
    minHeight: 112,
    borderRadius: radii.panel,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.84)",
    backgroundColor: "rgba(255,245,222,0.9)",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    ...shadows.gamePanel
  },
  photoPickerSelected: {
    borderColor: colors.leaf,
    backgroundColor: "rgba(244,255,240,0.92)"
  },
  photoPreview: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.sky,
    borderWidth: 3,
    borderBottomWidth: 5,
    borderColor: colors.cream
  },
  photoCopy: {
    flex: 1,
    gap: spacing.xs
  },
  photoActions: {
    gap: spacing.sm
  },
  photoAction: {
    flex: 1
  },
  photoTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900"
  },
  photoBody: {
    color: colors.mutedInk,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600"
  },
  sampleLinkRow: {
    alignSelf: "center"
  },
  sampleLinkText: {
    color: colors.skyDeep,
    fontSize: 13,
    fontWeight: "800",
    textDecorationLine: "underline"
  },
  privacyNotice: {
    color: colors.mutedInk,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    textAlign: "center"
  }
});
