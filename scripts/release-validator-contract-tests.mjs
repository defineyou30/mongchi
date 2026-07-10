import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const validatorScripts = {
  assets: path.join(repoRoot, "scripts/validate-mobile-assets.mjs"),
  database: path.join(repoRoot, "scripts/validate-db-migrations.mjs"),
  env: path.join(repoRoot, "scripts/validate-env-examples.mjs"),
  final: path.join(repoRoot, "scripts/validate-final-release-readiness.mjs")
};

const makeTempRoot = (t, label) => {
  const root = mkdtempSync(path.join(tmpdir(), `mongchi-${label}-`));
  t.after(() => rmSync(root, { force: true, recursive: true }));
  return root;
};

const copyDirectory = (source, destination) => {
  mkdirSync(path.dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true });
};

const copyFile = (source, destination) => {
  mkdirSync(path.dirname(destination), { recursive: true });
  copyFileSync(source, destination);
};

const linkAssetTree = (root) => {
  const sourceAssets = path.join(repoRoot, "apps/mobile/assets");
  const targetAssets = path.join(root, "apps/mobile/assets");
  mkdirSync(targetAssets, { recursive: true });

  for (const entry of readdirSync(sourceAssets)) {
    const source = path.join(sourceAssets, entry);
    const target = path.join(targetAssets, entry);

    if (entry !== "generated") {
      symlinkSync(source, target, statSync(source).isDirectory() ? "dir" : "file");
      continue;
    }

    mkdirSync(target, { recursive: true });
    for (const generatedEntry of readdirSync(source)) {
      const generatedSource = path.join(source, generatedEntry);
      symlinkSync(
        generatedSource,
        path.join(target, generatedEntry),
        statSync(generatedSource).isDirectory() ? "dir" : "file"
      );
    }
  }
};

const makeMobileFixture = (t) => {
  const root = makeTempRoot(t, "assets");
  copyDirectory(path.join(repoRoot, "apps/mobile/src"), path.join(root, "apps/mobile/src"));
  copyFile(
    path.join(repoRoot, "packages/shared/src/mock/mockData.ts"),
    path.join(root, "packages/shared/src/mock/mockData.ts")
  );
  linkAssetTree(root);
  return root;
};

const makeEnvFixture = (t) => {
  const root = makeTempRoot(t, "env");
  copyFile(path.join(repoRoot, "apps/mobile/.env.example"), path.join(root, "apps/mobile/.env.example"));
  copyFile(path.join(repoRoot, "services/api/.env.example"), path.join(root, "services/api/.env.example"));
  copyDirectory(path.join(repoRoot, "apps/mobile/src"), path.join(root, "apps/mobile/src"));
  copyDirectory(path.join(repoRoot, "services/api/src"), path.join(root, "services/api/src"));
  copyDirectory(path.join(repoRoot, "workers/ai/src"), path.join(root, "workers/ai/src"));
  return root;
};

const makeDatabaseFixture = (t) => {
  const root = makeTempRoot(t, "database");
  copyDirectory(path.join(repoRoot, "services/api/migrations"), path.join(root, "services/api/migrations"));
  copyDirectory(path.join(repoRoot, "supabase/migrations"), path.join(root, "supabase/migrations"));
  return root;
};

const compactPrivilegePattern = /^(?:REVOKE|GRANT) EXECUTE ON FUNCTION public\.compact_conversation.*\n/gm;

const mutateCompactPrivileges = (root, transform) => {
  const migrationPath = path.join(root, "supabase/migrations/0008_conversation_rpc_security.sql");
  const source = readFileSync(migrationPath, "utf8");
  const statements = source.match(compactPrivilegePattern) ?? [];
  assert.equal(statements.length, 2, "fixture must contain compact_conversation revoke and grant");
  writeFileSync(migrationPath, transform(source, statements.map((statement) => statement.trim())), "utf8");
};

const makeExecutable = (filePath, source) => {
  writeFileSync(filePath, source, "utf8");
  chmodSync(filePath, 0o755);
};

const makeFinalFixture = (t) => {
  const root = makeTempRoot(t, "final");
  const bin = path.join(root, "bin");
  mkdirSync(bin, { recursive: true });
  copyFile(path.join(repoRoot, "package.json"), path.join(root, "package.json"));

  makeExecutable(
    path.join(bin, "git"),
    `#!/bin/sh
if [ "\${FAKE_GIT_DIRTY:-}" = "1" ]; then
  echo " M user-file.txt"
fi
exit "\${FAKE_GIT_EXIT:-0}"
`
  );

  const childSource = `#!/bin/sh
if [ "\${FAKE_CHILD_HANG:-}" = "1" ]; then
  sleep 2
fi
if [ -n "\${FAKE_CHILD_STDOUT:-}" ]; then
  echo "\$FAKE_CHILD_STDOUT"
fi
exit "\${FAKE_CHILD_EXIT:-0}"
`;
  makeExecutable(path.join(bin, "npm"), childSource);
  makeExecutable(path.join(bin, "node"), childSource);

  return { bin, root };
};

const runValidator = (script, root, env = {}) =>
  spawnSync(process.execPath, [script], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      TINY_PET_VALIDATOR_ROOT: root,
      ...env
    },
    timeout: 10_000
  });

test("mobile asset validator reads the live mapping and runtime manifests", (t) => {
  const root = makeMobileFixture(t);
  const result = runValidator(validatorScripts.assets, root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Mobile asset validation passed/);
});

test("mobile asset validator fails when a runtime catalog mapping is missing", (t) => {
  const root = makeMobileFixture(t);
  const mappingPath = path.join(root, "apps/mobile/src/shared/assets/gameItemCatalogMapping.ts");
  const source = readFileSync(mappingPath, "utf8").replace(/^\s*item_food_bowl_basic:.*\n/m, "");
  writeFileSync(mappingPath, source, "utf8");

  const result = runValidator(validatorScripts.assets, root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /does not map runtime catalog item item_food_bowl_basic/);
});

test("mobile asset validator rejects a stale generated manifest entry", (t) => {
  const root = makeMobileFixture(t);
  copyFile(
    path.join(repoRoot, "apps/mobile/assets/generated/brand/app-logo-v1.png"),
    path.join(root, "apps/mobile/assets/generated/stale-generated-fixture.png")
  );

  const result = runValidator(validatorScripts.assets, root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /stale-generated-fixture\.png is a stale generated PNG/);
});

test("env validator accepts the documented weather screenshot key", (t) => {
  const root = makeEnvFixture(t);
  const result = runValidator(validatorScripts.env, root);
  assert.equal(result.status, 0, result.stderr);
});

test("env validator rejects a missing weather screenshot key", (t) => {
  const root = makeEnvFixture(t);
  const envPath = path.join(root, "apps/mobile/.env.example");
  const source = readFileSync(envPath, "utf8").replace(
    /^EXPO_PUBLIC_TINY_PET_STORE_SCREENSHOT_WEATHER_CONDITION=.*\n/m,
    ""
  );
  writeFileSync(envPath, source, "utf8");

  const result = runValidator(validatorScripts.env, root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /must document EXPO_PUBLIC_TINY_PET_STORE_SCREENSHOT_WEATHER_CONDITION/);
});

test("database validator accepts locked Supabase SECURITY DEFINER functions", (t) => {
  const root = makeDatabaseFixture(t);
  const result = runValidator(validatorScripts.database, root);
  assert.equal(result.status, 0, result.stderr);
});

test("database validator rejects a missing Supabase revoke", (t) => {
  const root = makeDatabaseFixture(t);
  const migrationPath = path.join(root, "supabase/migrations/0008_conversation_rpc_security.sql");
  const source = readFileSync(migrationPath, "utf8").replace(
    /^REVOKE EXECUTE ON FUNCTION public\.compact_conversation.*\n/m,
    ""
  );
  writeFileSync(migrationPath, source, "utf8");

  const result = runValidator(validatorScripts.database, root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /compact_conversation.*must revoke execute/);
});

test("database validator rejects exact compact privileges hidden by line comments", (t) => {
  const root = makeDatabaseFixture(t);
  mutateCompactPrivileges(root, (source) => source.replace(compactPrivilegePattern, (statement) => `-- ${statement}`));

  const result = runValidator(validatorScripts.database, root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /compact_conversation.*must revoke execute/);
  assert.match(result.stderr, /compact_conversation.*must grant execute/);
});

test("database validator rejects compact privileges hidden by a nested block comment", (t) => {
  const root = makeDatabaseFixture(t);
  mutateCompactPrivileges(root, (source, statements) =>
    source.replace(compactPrivilegePattern, "").replace(
      "COMMIT;",
      `/* outer\n/* nested */\n${statements.join("\n")}\n-- */\nCOMMIT;`
    )
  );

  const result = runValidator(validatorScripts.database, root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /compact_conversation.*must revoke execute/);
});

for (const fixture of [
  {
    label: "single-quoted string",
    render: (statements) => `SELECT '${statements.join(" ").replaceAll("'", "''")}';`
  },
  {
    label: "quoted identifier",
    render: (statements) => `SELECT "${statements.join(" ").replaceAll('"', '""')}";`
  },
  {
    label: "dollar-quoted body",
    render: (statements) => `$privilege_decoy$\n${statements.join("\n")}\n$privilege_decoy$;`
  }
]) {
  test(`database validator rejects compact privilege decoys inside a ${fixture.label}`, (t) => {
    const root = makeDatabaseFixture(t);
    mutateCompactPrivileges(root, (source, statements) =>
      source.replace(compactPrivilegePattern, "").replace("COMMIT;", `${fixture.render(statements)}\nCOMMIT;`)
    );

    const result = runValidator(validatorScripts.database, root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /compact_conversation.*must revoke execute/);
  });
}

test("database validator fails closed on an unterminated block comment", (t) => {
  const root = makeDatabaseFixture(t);
  mutateCompactPrivileges(root, (source) => source.replace(compactPrivilegePattern, "").replace("COMMIT;", "/* never closed\nCOMMIT;"));

  const result = runValidator(validatorScripts.database, root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unterminated SQL block comment/);
});

test("final release dry-run is explicitly a non-release simulation", (t) => {
  const { root } = makeFinalFixture(t);
  const result = runValidator(validatorScripts.final, root, {
    TINY_PET_FINAL_RELEASE_DRY_RUN: "true"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /SIMULATION ONLY — NOT RELEASE-READY/);
  assert.match(result.stdout, /No child gate was executed/);
  assert.doesNotMatch(result.stdout, /dry run passed/i);
});

test("actual-mode fixture executes every child gate without claiming release readiness", (t) => {
  const { bin, root } = makeFinalFixture(t);
  const result = runValidator(validatorScripts.final, root, {
    PATH: bin,
    TINY_PET_FINAL_RELEASE_ALLOW_ANDROID: "true",
    TINY_PET_FINAL_RELEASE_STEP_TIMEOUT_MS: "1000"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /fixture contract passed after executing all 8 child gates — NOT RELEASE-READY/);
  assert.doesNotMatch(result.stdout, /Final release readiness validation passed/);
});

test("actual final release rejects a dirty worktree", (t) => {
  const { bin, root } = makeFinalFixture(t);
  const result = runValidator(validatorScripts.final, root, {
    FAKE_GIT_DIRTY: "1",
    PATH: bin,
    TINY_PET_FINAL_RELEASE_ALLOW_ANDROID: "true"
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /worktree is dirty/);
});

test("actual final release trusts exit status instead of misleading success stdout", (t) => {
  const { bin, root } = makeFinalFixture(t);
  const result = runValidator(validatorScripts.final, root, {
    FAKE_CHILD_EXIT: "7",
    FAKE_CHILD_STDOUT: "Final release readiness validation passed.",
    PATH: bin,
    TINY_PET_FINAL_RELEASE_ALLOW_ANDROID: "true"
  });

  assert.equal(result.status, 7);
  assert.match(result.stderr, /failed at: iOS intermediate preflight/);
  assert.doesNotMatch(result.stdout, /fixture contract passed after executing all 8 child gates/);
});

test("actual final release fails when a required executable is missing", (t) => {
  const { bin, root } = makeFinalFixture(t);
  rmSync(path.join(bin, "npm"));
  const result = runValidator(validatorScripts.final, root, {
    PATH: bin,
    TINY_PET_FINAL_RELEASE_ALLOW_ANDROID: "true"
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /required executable npm was not found/);
});

test("actual final release terminates a hung child at the configured timeout", (t) => {
  const { bin, root } = makeFinalFixture(t);
  const result = runValidator(validatorScripts.final, root, {
    FAKE_CHILD_HANG: "1",
    PATH: bin,
    TINY_PET_FINAL_RELEASE_ALLOW_ANDROID: "true",
    TINY_PET_FINAL_RELEASE_STEP_TIMEOUT_MS: "100"
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /child gate exceeded 100 ms/);
});

test("fixture cleanup removes every temporary root", (t) => {
  const root = makeTempRoot(t, "cleanup");
  const nested = path.join(root, "nested");
  mkdirSync(nested);
  rmSync(root, { force: true, recursive: true });
  assert.equal(existsSync(root), false);
});
