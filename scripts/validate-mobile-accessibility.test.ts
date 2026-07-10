import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const validatorPath = path.join(rootDir, "scripts/validate-mobile-accessibility.mjs");
const tempDirs: string[] = [];

const validate = (paths: readonly string[]) =>
  execFileSync(process.execPath, [validatorPath, ...paths], {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

const writeFixture = (source: string) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mongchi-a11y-"));
  const fixturePath = path.join(tempDir, "Fixture.tsx");
  tempDirs.push(tempDir);
  fs.writeFileSync(fixturePath, source, "utf8");
  return fixturePath;
};

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
});

describe("mobile accessibility validator", () => {
  it("accepts dynamic labels, child text names and native disabled semantics", () => {
    const fixturePath = writeFixture(`
      import { Pressable, Text } from "react-native";
      export function Fixture({ label, disabled }: { readonly label: string; readonly disabled: boolean }) {
        return <>
          <Pressable accessibilityRole="button" accessibilityLabel={label} />
          <Pressable accessibilityRole="button" disabled={disabled}><Text>Continue</Text></Pressable>
        </>;
      }
    `);

    expect(validate([fixturePath])).toContain("Mobile accessibility validation passed.");
  });

  it("rejects empty literal labels and a modal without modal semantics", () => {
    const fixturePath = writeFixture(`
      import { Modal, Pressable, View } from "react-native";
      export function Fixture() {
        return <Modal visible><View><Pressable accessibilityRole="button" accessibilityLabel="" /></View></Modal>;
      }
    `);

    expect(() => validate([fixturePath])).toThrowError(/accessibilityLabel|missing labeled modal accessibility semantics/);
  });

  it("accepts nested modal semantics and an explicitly hidden event wrapper", () => {
    const fixturePath = writeFixture(`
      import { Modal, Pressable, Text, View } from "react-native";
      export function Fixture() {
        return <Modal visible><View accessibilityViewIsModal accessibilityLabel="Confirmation dialog">
          <Pressable accessible={false} onPress={(event) => event.stopPropagation()}><Text>Wrapper</Text></Pressable>
          <Pressable accessibilityRole="button"><Text>Confirm</Text></Pressable>
        </View></Modal>;
      }
    `);

    expect(validate([fixturePath])).toContain("Mobile accessibility validation passed.");
  });

  it("rejects modal semantics without an explicit modal label", () => {
    const fixturePath = writeFixture(`
      import { Modal, View } from "react-native";
      export function Fixture() {
        return <Modal visible><View accessibilityViewIsModal><View /></View></Modal>;
      }
    `);

    expect(() => validate([fixturePath])).toThrowError(/missing labeled modal accessibility semantics/);
  });

  it("validates the shared dialog and control source as a focused contract", () => {
    expect(
      validate([
        "apps/mobile/src/shared/ui/AppDialog.tsx",
        "apps/mobile/src/shared/ui/ActionButton.tsx",
        "apps/mobile/src/shared/ui/Chip.tsx"
      ])
    ).toContain("Mobile accessibility validation passed.");
  });

  it("requires every LottieAnimation to choose exactly one safe semantic mode", () => {
    const fixturePath = writeFixture(`
      export function Fixture({ label }: { readonly label: string }) {
        return <>
          <LottieAnimation decorative source={fixture} style={style} />
          <LottieAnimation accessibilityLabel="Pet moving in" source={fixture} style={style} />
          <LottieAnimation accessibilityLabel={\`\${label} is moving in\`} source={fixture} style={style} />
          <LottieAnimation source={fixture} style={style} />
          <LottieAnimation decorative accessibilityLabel="Pet moving in" source={fixture} style={style} />
          <LottieAnimation accessibilityLabel="" source={fixture} style={style} />
          <LottieAnimation accessibilityLabel={" "} source={fixture} style={style} />
          <LottieAnimation accessibilityLabel={label} source={fixture} style={style} />
          <LottieAnimation decorative={label === "yes"} source={fixture} style={style} />
        </>;
      }
    `);

    expect(() => validate([fixturePath])).toThrowError(/LottieAnimation must choose exactly one safe semantic mode|LottieAnimation accessibilityLabel must be statically non-empty/);
  });
});

describe("shared control target sizes", () => {
  it("keeps every shared press target at least 44 points high", () => {
    const sourcePaths = [
      "apps/mobile/src/shared/ui/ActionButton.tsx",
      "apps/mobile/src/shared/ui/Chip.tsx",
      "apps/mobile/src/shared/ui/AppDialog.tsx"
    ];

    for (const sourcePath of sourcePaths) {
      const content = fs.readFileSync(path.join(rootDir, sourcePath), "utf8");
      const minHeights = [...content.matchAll(/minHeight:\s*(\d+)/g)].map((match) => Number(match[1]));
      expect(minHeights.length, `${sourcePath} must declare a minimum press target`).toBeGreaterThan(0);
      expect(minHeights.every((height) => height >= 44), `${sourcePath} has a target below 44pt`).toBe(true);
    }
  });

  it("keeps the dialog primary action text legible on its apple-green fill", () => {
    const dialogSource = fs.readFileSync(path.join(rootDir, "apps/mobile/src/shared/ui/AppDialog.tsx"), "utf8");

    expect(dialogSource).toMatch(/primaryButtonText:\s*\{\s*color:\s*colors\.ink/);
  });
});
