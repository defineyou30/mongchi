import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const IOS_ROOT = resolve(ROOT, "apps/mobile/ios");

if (!existsSync(resolve(IOS_ROOT, "Podfile"))) {
  console.error("apps/mobile/ios/Podfile is missing. Run npx expo prebuild --platform ios --npm first.");
  process.exit(1);
}

const runText = (command, args, options = {}) =>
  spawnSync(command, args, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024, ...options });

const rbenvPod = runText("rbenv", ["which", "pod"]);
const podCommand = rbenvPod.status === 0 && rbenvPod.stdout.trim() ? rbenvPod.stdout.trim() : "pod";
const podEnv = {
  ...process.env,
  RUBYOPT: [process.env.RUBYOPT, "-rlogger"].filter(Boolean).join(" ")
};

const result = spawnSync(podCommand, ["install"], {
  cwd: IOS_ROOT,
  env: podEnv,
  stdio: "inherit"
});

process.exit(result.status ?? 1);
