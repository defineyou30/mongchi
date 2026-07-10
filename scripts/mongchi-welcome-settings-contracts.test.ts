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

  it("keeps the welcome promise progressive, dog-only, and routed to photo intro", () => {
    const source = readMobileSource("features/onboarding/WelcomeOnboardingScreen.tsx");

    expect(source.match(/step: "Step [123]"/g)).toHaveLength(3);
    expect(source).not.toMatch(/cat|kitten|feline/i);
    expect(source.match(/^\s{4}body: "/gm)).toHaveLength(3);
    expect(source).toContain("router.replace(\"/onboarding\")");
    expect(source).toContain("markWelcomeOnboardingSeen");
  });
});
