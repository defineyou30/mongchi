import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const failures = [];

const readText = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), "utf8");

const requireIncludes = (relativePath, fragments, label) => {
  const content = readText(relativePath);

  for (const fragment of fragments) {
    if (!content.includes(fragment)) {
      failures.push(`${label}: ${relativePath} must include ${JSON.stringify(fragment)}.`);
    }
  }
};

const requireExcludes = (relativePath, fragments, label) => {
  const content = readText(relativePath);

  for (const fragment of fragments) {
    if (content.includes(fragment)) {
      failures.push(`${label}: ${relativePath} must not include ${JSON.stringify(fragment)}.`);
    }
  }
};

requireIncludes(
  "docs/product-direction.md",
  [
    "premium cozy casual mobile game UI",
    "high-resolution pixel-art pet-sim hybrid",
    "tactile rounded game HUD",
    "Dome, glass, crystal, and hatch motifs are optional accents"
  ],
  "Product visual direction"
);

requireIncludes(
  "apps/mobile/src/features/appShell/GardenSceneFrame.tsx",
  ["ImageBackground", "home-garden-premium-v2-portrait.png", "SafeAreaView", "ScrollView", "wash"],
  "Raster-backed screen frame"
);

requireIncludes(
  "apps/mobile/src/shared/ui/ActionButton.tsx",
  ["borderBottomWidth", "pressed", "overflow: \"visible\""],
  "Chunky game button"
);

requireExcludes(
  "apps/mobile/src/shared/ui/ActionButton.tsx",
  ["innerFace", "gloss"],
  "Chunky game button stale translucent overlays"
);

requireIncludes(
  "apps/mobile/src/shared/ui/Chip.tsx",
  ["selectedFace", "borderBottomWidth", "shadows.tile"],
  "Tactile chip"
);

requireIncludes(
  "apps/mobile/src/shared/ui/Section.tsx",
  ["radii.panel", "rgba(255,232,199", "shadows.gamePanel"],
  "Game panel section"
);

requireIncludes(
  "apps/mobile/src/shared/ui/GameIllustrations.tsx",
  [
    'scene?: "garden" | "hatching" | "reveal" | "welcome" | "loading" | "chat"',
    "sceneMode === \"garden\"",
    "backgroundSources.pixelGarden",
    "welcome-screen-v1.png",
    "loading-screen-v1.png",
    "hatch-reveal-garden-premium-v1-portrait.png",
    "theme-fairy-garden-v1-portrait.png",
    "theme-seaside-cove-v1-portrait.png",
    "depthGlow",
    "revealHalo",
    "hatchGlow",
    "PremiumBondArt",
    "food-bowl-v3.png",
    "toy-ball-v3.png",
    "watering-can-v3.png"
  ],
  "Layered scene illustration system"
);

requireIncludes(
  "apps/mobile/src/features/petReveal/PetRevealScreen.tsx",
  ["scene=\"reveal\"", "shareCaptureHost", "namePlaque", "actionPanel", "notQuiteRightRow", 't("reveal.enter")'],
  "Pet reveal celebration"
);

requireIncludes(
  "apps/mobile/src/features/terrarium/TerrariumHomeScreen.tsx",
  [
    't("home.',
    "resourceBar",
    "scene=\"garden\"",
    "hudButtonAssets",
    "sideRailButtonAssets",
    "resourceSegment",
    "careItemIcon",
    "walkStatusBadge",
    "rewardRibbon",
    "rewardActions",
    "rewardSceneOverlay",
    "shadows.gamePanel"
  ],
  "Playable main home"
);

requireExcludes(
  "apps/mobile/src/features/terrarium/TerrariumHomeScreen.tsx",
  ["resourceChipGloss", "careButtonFace", "careButtonGloss"],
  "Playable main home stale translucent overlays"
);

requireIncludes(
  "apps/mobile/src/features/onboarding/OnboardingScreen.tsx",
  ["OnboardingStoryArt", 'variant="welcome"', "questRow", "photoNotice", 't("photoIntro.choosePhoto")'],
  "Welcome tiny-world entry"
);

requireIncludes(
  "apps/mobile/src/features/petSetup/PetSetupScreen.tsx",
  ["OnboardingStoryArt", 'variant="profile"', "setupCard", "sectionLabelRow", "sectionHint", "favoritePlate"],
  "Pet setup adoption pass"
);

requireIncludes(
  "apps/mobile/src/shared/ui/OnboardingStoryArt.tsx",
  ["storyArtSources", "profile", "photo", "welcome"],
  "Pet setup collectible portrait art"
);

requireIncludes(
  "apps/mobile/src/features/photoUpload/PhotoUploadScreen.tsx",
  ["OnboardingStoryArt", 'variant="photo"', "uploadPass", "photoPicker", "photoActions", 't("photoUpload.library")'],
  "Photo upload card HUD"
);

requireIncludes(
  "apps/mobile/src/shared/ui/OnboardingStoryArt.tsx",
  ["Image", "accessibilityLabel", "resizeMode=\"cover\"", "storyArt"],
  "Photo upload collectible card art"
);

requireIncludes(
  "apps/mobile/src/features/generation/GenerationScreen.tsx",
  ["scene=\"hatching\"", "progressBlock", "recapCard", "stepList", "failureBlock", "shadows.gamePanel"],
  "Hatching HUD"
);

requireIncludes(
  "apps/mobile/src/features/chat/ChatGateScreen.tsx",
  ["chatStage", "sceneTopBar", "petStage", "premiumGate", "inputBar", "disclosureStrip", "shadows.gamePanel", 't("chat.back")'],
  "Premium chat mood scene"
);

requireIncludes(
  "apps/mobile/src/features/shop/ShopPreviewScreen.tsx",
  [
    "ScreenHeaderRow",
    "creditHud",
    "itemPreviewPanel",
    "shopCategoryTabs",
    "shopShelf",
    "productCard",
    'backAccessibilityLabel={t("shop.back")}',
    'title={t("shop.title")}',
    "shadows.gamePanel"
  ],
  "Collectible shop shelf"
);

requireIncludes(
  "apps/mobile/src/features/inventory/InventoryScreen.tsx",
  ["sceneRoot", "sceneBackground", "itemGrid", "itemCard", "emptyState", "footerActions", "shadows.tile"],
  "Collectible inventory"
);

requireIncludes(
  "workers/ai/src/openAiImageProvider.ts",
  [
    "statePosePrompts",
    "Identity contract",
    "Multi-state contract",
    "App integration contract",
    "Scene-fit contract",
    "high-resolution cozy pixel-art pet sprite",
    "polished modern pixel pet sprite",
    "intentional visible pixel clusters",
    "legacy room-sprite styling",
    "low-resolution 8-bit or 16-bit output",
    "magenta key backgrounds",
    "flat vector mascot styling",
    "clay/plastic toy rendering"
  ],
  "AI avatar prompt direction"
);

requireIncludes(
  "workers/ai/src/openAiGenerationQualityEvaluator.ts",
  [
    "high-resolution cozy pixel-art pet sprite style",
    "intentional visible pixel clusters",
    "consistent bottom-center paw/contact anchor",
    "repeated identical poses across different states"
  ],
  "AI quality evaluator art direction"
);

requireIncludes(
  "apps/mobile/src/features/settings/SettingsScreen.tsx",
  ["ScreenHeaderRow", "settingsHero", "settingsSection", "statusNotice", "compactIconFrame", "linkGrid", 't("settings.back")', "shadows.tile"],
  "Settings visual consistency"
);

[
  "apps/mobile/src/features/onboarding/OnboardingScreen.tsx",
  "apps/mobile/src/features/petSetup/PetSetupScreen.tsx",
  "apps/mobile/src/features/photoUpload/PhotoUploadScreen.tsx",
  "apps/mobile/src/features/generation/GenerationScreen.tsx",
  "apps/mobile/src/features/petReveal/PetRevealScreen.tsx",
  "apps/mobile/src/features/terrarium/TerrariumHomeScreen.tsx",
  "apps/mobile/src/features/chat/ChatGateScreen.tsx",
  "apps/mobile/src/features/inventory/InventoryScreen.tsx",
  "apps/mobile/src/features/shop/ShopPreviewScreen.tsx",
  "apps/mobile/src/features/settings/SettingsScreen.tsx",
  "packages/shared/src/mock/mockData.ts"
].forEach((relativePath) =>
  requireExcludes(
    relativePath,
    [
      "flat onboarding",
      "Back to dome",
      "Dome extras",
      "Preview dome",
      "glass-dome",
      "glass dome",
      "dome garden",
      "dome afternoons",
      "terrarium moods"
    ],
    "Stale flat/dome-first copy"
  )
);

if (failures.length > 0) {
  console.error("Mobile visual direction validation failed:");

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log("Mobile visual direction validation passed.");
