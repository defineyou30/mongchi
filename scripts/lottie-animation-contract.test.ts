import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mobileRoot = path.join(rootDir, "apps/mobile");
const tscPath = path.join(rootDir, "node_modules/.bin/tsc");
const lottieModulePath = path.join(mobileRoot, "src/shared/ui/LottieAnimation");

type TypecheckResult =
  | { readonly kind: "passed" }
  | { readonly kind: "failed"; readonly output: string };

function typecheckLottieContract(body: string): TypecheckResult {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "mongchi-lottie-contract-"));
  const fixturePath = path.join(fixtureDir, "fixture.tsx");

  fs.writeFileSync(
    fixturePath,
    `import { LottieAnimation } from ${JSON.stringify(lottieModulePath)};
     const source = { uri: "fixture.json" };
     const style = { height: 96, width: 96 };
     ${body}`,
    "utf8"
  );

  try {
    execFileSync(
      tscPath,
      [
        "--allowSyntheticDefaultImports",
        "--esModuleInterop",
        "--ignoreConfig",
        "--jsx",
        "preserve",
        "--module",
        "esnext",
        "--moduleResolution",
        "bundler",
        "--noEmit",
        "--pretty",
        "false",
        "--skipLibCheck",
        "--strict",
        "--target",
        "esnext",
        fixturePath
      ],
      { cwd: mobileRoot, encoding: "utf8", stdio: "pipe" }
    );
    return { kind: "passed" };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "stderr" in error && "stdout" in error) {
      const stderr = typeof error.stderr === "string" ? error.stderr : "";
      const stdout = typeof error.stdout === "string" ? error.stdout : "";
      return { kind: "failed", output: `${stdout}${stderr}` };
    }

    throw error;
  } finally {
    fs.rmSync(fixtureDir, { force: true, recursive: true });
  }
}

describe("LottieAnimation TypeScript contract", () => {
  it("typechecks exactly one non-empty semantic mode", () => {
    const labeled = typecheckLottieContract(
      'export const labeled = <LottieAnimation accessibilityLabel="Pet moving in" source={source} style={style} />;'
    );
    const decorative = typecheckLottieContract(
      "export const decorative = <LottieAnimation decorative source={source} style={style} />;"
    );
    const neither = typecheckLottieContract("export const neither = <LottieAnimation source={source} style={style} />;");
    const both = typecheckLottieContract(
      'export const both = <LottieAnimation accessibilityLabel="Pet moving in" decorative source={source} style={style} />;'
    );
    const empty = typecheckLottieContract('export const empty = <LottieAnimation accessibilityLabel="" source={source} style={style} />;');

    expect(labeled).toEqual({ kind: "passed" });
    expect(decorative).toEqual({ kind: "passed" });
    expect(neither.kind).toBe("failed");
    expect(both.kind).toBe("failed");
    expect(empty.kind).toBe("failed");
  });
});
