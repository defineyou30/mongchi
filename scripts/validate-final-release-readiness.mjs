import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const validatorRootOverride = process.env.TINY_PET_VALIDATOR_ROOT;
const rootDir = path.resolve(validatorRootOverride ?? new URL("..", import.meta.url).pathname);
const fixtureRoot = validatorRootOverride !== undefined;
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
const scripts = packageJson.scripts ?? {};
const dryRun = process.env.TINY_PET_FINAL_RELEASE_DRY_RUN === "true";
const allowAndroid = process.env.TINY_PET_FINAL_RELEASE_ALLOW_ANDROID === "true";
const timeoutInput = process.env.TINY_PET_FINAL_RELEASE_STEP_TIMEOUT_MS ?? "900000";
const stepTimeoutMs = Number(timeoutInput);

const steps = [
  {
    label: "clean release worktree",
    command: "git",
    args: ["status", "--porcelain"],
    requireEmptyStdout: true
  },
  {
    label: "iOS intermediate preflight",
    command: "npm",
    args: ["run", "validate:ios-preflight"],
    script: "validate:ios-preflight"
  },
  {
    label: "final plant stage asset PNG coverage",
    command: "npm",
    args: ["run", "validate:plant-stage-assets"],
    env: { TINY_PET_REQUIRE_FINAL_PLANT_STAGE_ASSETS: "true" },
    script: "validate:plant-stage-assets"
  },
  {
    label: "production release config",
    command: "npm",
    args: ["run", "validate:production-release-config"],
    script: "validate:production-release-config"
  },
  {
    label: "strict iOS/Android store screenshot coverage",
    command: "node",
    args: ["scripts/validate-store-screenshots.mjs"],
    env: { TINY_PET_REQUIRE_STORE_SCREENSHOTS: "all" }
  },
  {
    label: "final screenshot freshness after UI/art changes",
    command: "npm",
    args: ["run", "validate:final-screenshot-freshness"],
    script: "validate:final-screenshot-freshness"
  },
  {
    label: "final Android store contact sheet",
    command: "npm",
    args: ["run", "validate:android-store-contact-sheet"],
    script: "validate:android-store-contact-sheet",
    requiresAndroid: true
  },
  {
    label: "final Android export validation",
    command: "npm",
    args: ["run", "validate:android"],
    script: "validate:android",
    requiresAndroid: true
  }
];

const failures = [];

if (!Number.isSafeInteger(stepTimeoutMs) || stepTimeoutMs < 100 || stepTimeoutMs > 3_600_000) {
  failures.push("TINY_PET_FINAL_RELEASE_STEP_TIMEOUT_MS must be an integer from 100 to 3600000.");
}

for (const step of steps) {
  if (step.script && !scripts[step.script]) {
    failures.push(`Missing package script: ${step.script}`);
  }
}

if (!dryRun && !allowAndroid) {
  failures.push(
    "Set TINY_PET_FINAL_RELEASE_ALLOW_ANDROID=true to run final release validation because it includes Android validation."
  );
}

if (failures.length > 0) {
  console.error("Final release readiness validation could not start:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

if (dryRun) {
  console.log("FINAL RELEASE SIMULATION ONLY — NOT RELEASE-READY");
  console.log("No child gate was executed. Planned actual-run steps:");
  for (const [index, step] of steps.entries()) {
    const envPrefix = step.env
      ? `${Object.entries(step.env)
          .map(([key, value]) => `${key}=${value}`)
          .join(" ")} `
      : "";
    console.log(`${index + 1}. ${step.label}: ${envPrefix}${[step.command, ...step.args].join(" ")}`);
  }
  console.log(
    "Actual final run requires TINY_PET_FINAL_RELEASE_ALLOW_ANDROID=true and real production env values."
  );
  console.log("Release readiness simulation completed; this is not a release pass.");
  process.exit(0);
}

for (const step of steps) {
  const label = [step.command, ...step.args].join(" ");
  const env = { ...process.env, ...(step.env ?? {}) };
  console.log(`\n> ${step.label}`);
  console.log(`> ${label}`);

  const result = spawnSync(step.command, step.args, {
    cwd: rootDir,
    env,
    shell: false,
    stdio: step.requireEmptyStdout ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: step.requireEmptyStdout ? "utf8" : undefined,
    timeout: stepTimeoutMs,
    killSignal: "SIGTERM"
  });

  if (result.error) {
    const errorCode = result.error.code ?? "UNKNOWN";
    const reason =
      errorCode === "ENOENT"
        ? `required executable ${step.command} was not found`
        : errorCode === "ETIMEDOUT"
          ? `child gate exceeded ${stepTimeoutMs} ms`
          : `child gate could not start (${errorCode})`;
    console.error(`\nFinal release readiness failed at: ${step.label} — ${reason}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`\nFinal release readiness failed at: ${step.label}`);
    process.exit(result.status ?? 1);
  }

  if (step.requireEmptyStdout && result.stdout.trim().length > 0) {
    console.error(`\nFinal release readiness failed at: ${step.label} — worktree is dirty.`);
    process.exit(1);
  }
}

if (fixtureRoot) {
  console.log(`\nFinal release fixture contract passed after executing all ${steps.length} child gates — NOT RELEASE-READY.`);
} else {
  console.log(`\nFinal release readiness validation passed after executing all ${steps.length} child gates.`);
}
