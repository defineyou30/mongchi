import { spawnSync } from "node:child_process";

const presets = ["pet-reveal", "terrarium", "chat", "shop"];

for (const preset of presets) {
  const result = spawnSync("node", ["scripts/capture-ios-reduce-motion-hatching.mjs"], {
    encoding: "utf8",
    env: {
      ...process.env,
      TINY_PET_IOS_REDUCE_MOTION_PRESET: preset,
      TINY_PET_IOS_REDUCE_MOTION_LABEL: `reduce-motion-${preset}`
    },
    maxBuffer: 10 * 1024 * 1024,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("iOS Reduce Motion core screen evidence captured.");
