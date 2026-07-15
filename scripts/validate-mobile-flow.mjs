import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const failures = [];

const readSource = (relativePath) => {
  const absolutePath = resolve(ROOT, relativePath);

  if (!existsSync(absolutePath)) {
    failures.push(`${relativePath} is missing`);
    return "";
  }

  return readFileSync(absolutePath, "utf8");
};

const assertIncludes = (relativePath, fragments, label) => {
  const source = readSource(relativePath);

  for (const fragment of fragments) {
    if (!source.includes(fragment)) {
      failures.push(`${label}: ${relativePath} does not include ${JSON.stringify(fragment)}`);
    }
  }
};

const assertExcludes = (relativePath, fragments, label) => {
  const source = readSource(relativePath);

  for (const fragment of fragments) {
    if (source.includes(fragment)) {
      failures.push(`${label}: ${relativePath} should not include ${JSON.stringify(fragment)}`);
    }
  }
};

const routeContracts = [
  { path: "apps/mobile/app/index.tsx", component: "SplashScreen" },
  { path: "apps/mobile/app/onboarding/index.tsx", component: "OnboardingScreen" },
  { path: "apps/mobile/app/pet-setup/index.tsx", component: "PetSetupScreen" },
  { path: "apps/mobile/app/photo-upload/index.tsx", component: "PhotoUploadScreen" },
  { path: "apps/mobile/app/generation/index.tsx", component: "GenerationScreen" },
  { path: "apps/mobile/app/pet-reveal/index.tsx", component: "PetRevealScreen" },
  { path: "apps/mobile/app/terrarium/index.tsx", component: "TerrariumHomeScreen" },
  { path: "apps/mobile/app/chat/index.tsx", component: "ChatGateScreen" },
  { path: "apps/mobile/app/inventory/index.tsx", component: "InventoryScreen" },
  { path: "apps/mobile/app/shop/index.tsx", component: "ShopPreviewScreen" },
  { path: "apps/mobile/app/settings/index.tsx", component: "SettingsScreen" },
  { path: "apps/mobile/app/privacy/index.tsx", component: "PrivacyScreen" },
  { path: "apps/mobile/app/terms/index.tsx", component: "TermsScreen" },
  { path: "apps/mobile/app/support/index.tsx", component: "SupportScreen" }
];

for (const route of routeContracts) {
  assertIncludes(route.path, [route.component], "route contract");
}

const flowContracts = [
  {
    label: "splash restore routing",
    path: "apps/mobile/src/features/onboarding/SplashScreen.tsx",
    fragments: ["getConfiguredQaScreenPresetRoute", "getConfiguredStoreScreenshotPresetRoute", "getInitialPetLaunchRoute"]
  },
  {
    label: "initial launch route resolution",
    path: "apps/mobile/src/features/onboarding/initialPetLaunchRoute.ts",
    fragments: ['return "/terrarium"', 'return "/pet-reveal"', 'return "/generation"', 'return "/pet-setup"', 'return hasSeenWelcome ? "/onboarding" : "/welcome"']
  },
  {
    label: "welcome to photo upload",
    path: "apps/mobile/src/features/onboarding/OnboardingScreen.tsx",
    fragments: ['label={t("photoIntro.choosePhoto")}', 'router.push("/photo-upload")']
  },
  {
    label: "photo upload to pet setup",
    path: "apps/mobile/src/features/photoUpload/PhotoUploadScreen.tsx",
    fragments: ['label={t("photoUpload.library")}', 'label={t("common.actions.camera")}', 'label={t("common.actions.continue")}', 'router.push("/pet-setup")']
  },
  {
    label: "pet setup to generation",
    path: "apps/mobile/src/features/petSetup/PetSetupScreen.tsx",
    fragments: ['label={t("common.actions.continue")}', "startMockGeneration", 'router.push("/generation")']
  },
  {
    label: "generation to reveal",
    path: "apps/mobile/src/features/generation/GenerationScreen.tsx",
    fragments: [
      'label={t("generation.reveal")}',
      'router.push("/pet-reveal")',
      'label={t("common.actions.continue")}',
      'label={t("common.actions.chooseAnotherPhoto")}',
      'router.push("/photo-upload")'
    ]
  },
  {
    label: "reveal to terrarium",
    path: "apps/mobile/src/features/petReveal/PetRevealScreen.tsx",
    fragments: [
      'label={t("reveal.enter")}',
      "acceptGeneratedPet",
      'router.replace("/terrarium")',
      't("common.actions.reportIssue")',
      'router.push("/support")'
    ]
  },
  {
    label: "terrarium hub actions",
    path: "apps/mobile/src/features/terrarium/TerrariumHomeScreen.tsx",
    fragments: [
      'router.push("/chat")',
      'router.push("/settings")',
      'action: "walk", label: "Walk"',
      "action === \"walk\" && activeWalk?.status === \"walking\"",
      "cooldownBadgeLabel",
      'router.push("/shop")'
    ]
  },
  {
    label: "premium chat gate",
    path: "apps/mobile/src/features/chat/ChatGateScreen.tsx",
    fragments: [
      't("chat.disclosure")',
      "startApiPremiumChatThread",
      "sendApiPremiumChatTurn",
      "getShortChatReplyText",
      "getPremiumChatAccessPresentation",
      "premiumChatAccess.ctaLabel",
      "premiumGate",
      "isLiveChatEnabled",
      't("chat.unavailableTitle")',
      't("chat.inputAccessibilityLabel")',
      't("chat.back")',
      'router.replace("/terrarium")'
    ]
  },
  {
    label: "premium chat access presentation",
    path: "apps/mobile/src/features/chat/chatGatePresentation.ts",
    fragments: [
      "getPremiumChatAccessPresentation",
      "getLocalizedText",
      '"en-US"',
      '"ko-KR"',
      '"es-MX"'
    ]
  },
  {
    label: "inventory to shop",
    path: "apps/mobile/src/features/inventory/InventoryScreen.tsx",
    fragments: [
      'label={t("common.actions.backHome")}',
      'router.push("/terrarium")',
      'label={t("inventory.shop")}',
      'router.push("/shop")',
      "getHomeDockActionForItem",
      "openTray"
    ]
  },
  {
    label: "shop return path",
    path: "apps/mobile/src/features/shop/ShopPreviewScreen.tsx",
    fragments: [
      'backAccessibilityLabel={t("shop.back")}',
      'router.replace("/terrarium")',
      "creditHud",
      "itemPreviewPanel",
      "shopCategoryTabs",
      "shopShelf",
      "productCard",
      "commerceProducts",
      "isPremiumPassProduct(product)",
      'router.push("/credits")',
      'edges={["top", "right", "bottom", "left"]}',
      'resizeMode="cover"',
      "minimumFontScale={0.72}",
      'selectedTab === "customize"',
      "ExpressionPackShelf"
    ]
  },
  {
    label: "shop two-tab route contract",
    path: "apps/mobile/src/features/shop/shopRouteParams.ts",
    fragments: ['export type ShopTabId = "care" | "customize";']
  },
  {
    label: "settings legal support paths",
    path: "apps/mobile/src/features/settings/SettingsScreen.tsx",
    fragments: [
      "apiSyncStatus",
      "apiErrorMessage",
      't("settings.status.attention")',
      't("settings.status.inProgress")',
      'router.push("/privacy")',
      'router.push("/terms")',
      'router.push("/support")',
      'backAccessibilityLabel={t("settings.back")}',
      'onBack={() => router.replace("/terrarium")}'
    ]
  },
  {
    label: "QA settings privacy preset contract",
    path: "apps/mobile/src/features/session/qaScreenSession.ts",
    fragments: [
      'qaScreenPresets = ["settings-privacy-error", "settings-privacy-progress"]',
      '"settings-privacy-error": "/settings"',
      '"settings-privacy-progress": "/settings"',
      "Original photo deletion could not finish. Try again.",
      'status: "syncing"'
    ]
  },
  {
    label: "QA screen preset session wiring",
    path: "apps/mobile/src/features/session/TerrariumSessionProvider.tsx",
    fragments: [
      "getConfiguredQaScreenPreset",
      "createQaScreenSession",
      "getQaScreenApiState",
      "qaScreenPreset"
    ]
  },
  {
    label: "safe generation issue report controls",
    path: "apps/mobile/src/features/legal/SupportScreen.tsx",
    fragments: [
      "generationIssueIcons",
      'category: "wrong_pet"',
      'category: "unsafe_or_scary"',
      'category: "poor_quality"',
      "reportGenerationIssue",
      'recordMobileEvent("generation_issue_reported"',
      'label={selected ? t("legal.support.saved") : t("legal.support.report")}'
    ]
  },
  {
    label: "generation issue report API client contract",
    path: "apps/mobile/src/shared/api/mobileApiClient.ts",
    fragments: [
      "reportGenerationIssue",
      '"/v1/generation-issue-reports"',
      "GenerationIssueReportRequest",
      "GenerationIssueReportResponse"
    ]
  },
  {
    label: "generation issue report API route contract",
    path: "services/api/src/httpRouter.ts",
    fragments: [
      'resource === "generation-issue-reports"',
      "service.reportGenerationIssue",
      "GenerationIssueReportRequest"
    ]
  },
  {
    label: "walk timer session contract",
    path: "packages/shared/src/__tests__/prototypeSession.test.ts",
    fragments: ["sends the pet walking and clears the path automatically after the timer", "startPrototypeWalk", "refreshPrototypeWalk"]
  },
  {
    label: "premium chat API session helper",
    path: "apps/mobile/src/features/session/apiPremiumChatSession.test.ts",
    fragments: ["startApiPremiumChatThread", "sendApiPremiumChatTurn", "disclosureAccepted: true", "empty_message"]
  },
  {
    label: "inventory placement API client contract",
    path: "apps/mobile/src/shared/api/mobileApiClient.ts",
    fragments: [
      "placeInventoryItem",
      "removePlacedItem",
      '"/v1/inventory/placements"',
      "`/v1/inventory/placements/${encodePathSegment(itemId)}`"
    ]
  },
  {
    label: "inventory placement API route contract",
    path: "services/api/src/httpRouter.ts",
    fragments: [
      'resource === "inventory" && id === "placements"',
      "service.placeInventoryItem",
      "service.removePlacedItem"
    ]
  }
];

assertExcludes(
  "apps/mobile/src/features/shop/ShopPreviewScreen.tsx",
  ["getPremiumPassShopPresentation", "shopSummary.plusLabel"],
  "shop chat-pass exclusion"
);

for (const contract of flowContracts) {
  assertIncludes(contract.path, contract.fragments, contract.label);
}

assertExcludes(
  "apps/mobile/src/features/generation/GenerationScreen.tsx",
  ['label="Preview failure state"', "failMockGeneration"],
  "hatching production UI"
);

assertExcludes(
  "apps/mobile/src/features/petReveal/PetRevealScreen.tsx",
  ['t("common.actions.tryAgain")', "retryMockGeneration", 'router.push("/generation")'],
  "accepted pet reveal must not offer an unfunded remake"
);

if (failures.length > 0) {
  console.error("Mobile flow validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  "Mobile flow validation passed for Welcome -> Photo upload -> Pet setup -> Hatching -> Reveal -> Terrarium -> Chat/Shop."
);
