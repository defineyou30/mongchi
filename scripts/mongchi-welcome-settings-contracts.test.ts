import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "..");
const mobileSourceRoot = resolve(repositoryRoot, "apps/mobile/src");
const registryPath = resolve(mobileSourceRoot, "shared/ui/mongchiIconAssets.ts");
const manifestPath = resolve(repositoryRoot, "apps/mobile/assets/generated/ui/utility-icons/v1/manifest.json");
const readMobileSource = (relativePath: string) => readFileSync(resolve(mobileSourceRoot, relativePath), "utf8");

const registryKeys = (source: string): string[] =>
  [...source.matchAll(/^\s{2}(?:"([^"]+)"|([a-z][a-z-]*)):\s*require\(/gm)]
    .map((match) => match[1] ?? match[2])
    .filter((key): key is string => typeof key === "string");

describe("Mongchi Welcome and Settings icon contracts", () => {
  it("maps all 48 manifest keys exactly once and detects a missing registry key", () => {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { keys: string[] };
    const source = readFileSync(registryPath, "utf8");
    const keys = registryKeys(source);

    expect(manifest.keys).toHaveLength(48);
    expect(keys).toEqual(manifest.keys);

    const missingLastKeySource = source.replace(/^\s{2}more:\s*require\([^\n]+\n/m, "");
    expect(registryKeys(missingLastKeySource)).not.toEqual(manifest.keys);
  });

  it("forbids Lucide, vector, SF symbol, and emoji presentation glyphs", () => {
    for (const relativePath of [
      "features/onboarding/WelcomeOnboardingScreen.tsx",
      "features/onboarding/OnboardingScreen.tsx",
      "features/settings/SettingsScreen.tsx",
      "shared/ui/BackButton.tsx"
    ]) {
      const source = readMobileSource(relativePath);
      expect(source, relativePath).not.toMatch(/lucide-react-native|react-native-vector-icons|SFSymbol|SymbolView/);
      expect(source, relativePath).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    }
  });

  it("uses the shared pixel-gloss icon set throughout pet creation and the first-home welcome", () => {
    const flowIconIdsBySource = {
      "features/photoUpload/PhotoUploadScreen.tsx": ["add-photo", "camera", "check", "forward"],
      "features/petSetup/PetSetupScreen.tsx": ["paw", "forward"],
      "features/generation/GenerationScreen.tsx": ["sparkles", "affection", "gift", "alert", "forward", "refresh"],
      "features/petReveal/PetRevealScreen.tsx": ["forward", "share"]
    } as const;

    for (const [relativePath, iconIds] of Object.entries(flowIconIdsBySource)) {
      const source = readMobileSource(relativePath);

      expect(source, relativePath).not.toContain("lucide-react-native");
      for (const iconId of iconIds) {
        expect(source, `${relativePath} should use ${iconId}`).toContain(`\"${iconId}\"`);
      }
    }

    const homeSource = readMobileSource("features/terrarium/TerrariumHomeScreen.tsx");
    const welcomeModalStart = homeSource.indexOf('<Modal animationType="fade" transparent visible={welcomeVisible}');
    const welcomeModalEnd = homeSource.indexOf("</Modal>", welcomeModalStart);
    const welcomeModalSource = homeSource.slice(welcomeModalStart, welcomeModalEnd);

    expect(welcomeModalStart).toBeGreaterThanOrEqual(0);
    expect(welcomeModalEnd).toBeGreaterThan(welcomeModalStart);
    expect(welcomeModalSource).toContain('id="food"');
    expect(welcomeModalSource).toContain('id="chat"');
    expect(welcomeModalSource).toContain('id="streak"');
    expect(welcomeModalSource).not.toMatch(/<Utensils|<MessageCircle|<Flame/);
  });

  it("keeps the welcome promise progressive, dog-only, and routed to photo intro", () => {
    const source = readMobileSource("features/onboarding/WelcomeOnboardingScreen.tsx");
    const englishResource = readMobileSource("localization/resources/en-US.ts");
    const welcomeResourceStart = englishResource.indexOf("  welcome: {");
    const welcomeResourceEnd = englishResource.indexOf("  photoIntro: {", welcomeResourceStart);
    const welcomeResource = englishResource.slice(welcomeResourceStart, welcomeResourceEnd);

    expect(welcomeResourceStart).toBeGreaterThanOrEqual(0);
    expect(welcomeResourceEnd).toBeGreaterThan(welcomeResourceStart);
    expect(welcomeResource.match(/step: "Step [123]"/g)).toHaveLength(3);
    expect(welcomeResource).not.toMatch(/cat|kitten|feline/i);
    expect(welcomeResource.match(/body: "/g)).toHaveLength(3);
    expect(source.match(/welcome\.slides\.(first|second|third)\.body/g)).toHaveLength(3);
    expect(source).toContain("router.replace(\"/onboarding\")");
    expect(source).toContain("markWelcomeOnboardingSeen");
  });
});
