import { spawnSync } from "node:child_process";

const steps = [
  ["npm", ["test"]],
  ["npm", ["run", "typecheck"]],
  ["npm", ["--workspace", "@mongchi/mobile", "run", "typecheck"]],
  ["npm", ["run", "validate:mobile-assets"]],
  ["npm", ["run", "validate:mobile-asset-contact-sheet"]],
  ["npm", ["run", "validate:mobile-visual-assets"]],
  ["npm", ["run", "validate:mobile-visual-direction"]],
  ["npm", ["run", "validate:mobile-flow"]],
  ["npm", ["run", "validate:mobile-accessibility"]],
  ["npm", ["run", "validate:mobile-secret-boundaries"]],
  ["npm", ["run", "validate:privacy-sdk-boundaries"]],
  ["npm", ["run", "validate:mobile-copy"]],
  ["npm", ["run", "validate:product-direction"]],
  ["npm", ["run", "validate:plant-growth-design"]],
  ["npm", ["run", "validate:plant-stage-assets"]],
  ["npm", ["run", "validate:care-economy-design"]],
  ["npm", ["run", "validate:pet-avatar-prompt-design"]],
  ["npm", ["run", "validate:pet-avatar-fallback-assets"]],
  ["npm", ["run", "validate:ios-manual-qa"]],
  ["npm", ["run", "validate:ios-reduce-motion-evidence"]],
  ["npm", ["run", "validate:ios-settings-privacy-evidence"]],
  ["npm", ["run", "validate:ios-dev-client-readiness"]],
  ["npm", ["run", "validate:native-store-config"]],
  ["npm", ["run", "validate:store-compliance"]],
  ["npm", ["run", "validate:store-listing"]],
  ["npm", ["run", "validate:store-metadata-alignment"]],
  ["npm", ["run", "validate:ios-store-screenshots"]],
  ["npm", ["run", "validate:ios-store-contact-sheet"]],
  ["npm", ["run", "validate:ios-final-screenshot-freshness"]],
  ["npm", ["run", "validate:ios-large-text-evidence"]],
  ["npm", ["run", "validate:release-config"]],
  ["npm", ["run", "validate:final-release-runbook"]],
  ["npm", ["run", "validate:final-release-plan"]],
  ["npm", ["run", "validate:env-examples"]],
  ["npm", ["run", "validate:db-migrations"]],
  ["npm", ["run", "validate:ios"]]
];

for (const [command, args] of steps) {
  const label = [command, ...args].join(" ");
  console.log(`\n> ${label}`);

  const result = spawnSync(command, args, {
    env: process.env,
    shell: false,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    console.error(`\niOS preflight failed at: ${label}`);
    process.exit(result.status ?? 1);
  }
}

console.log("\niOS preflight validation passed.");
