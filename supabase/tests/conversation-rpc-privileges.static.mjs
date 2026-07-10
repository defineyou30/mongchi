#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const TARGETS = [
  {
    name: "compact_conversation",
    signature: "uuid,text,timestamptz",
  },
  {
    name: "purge_expired_conversation_messages",
    signature: "integer,integer",
  },
];

const SECURITY_MIGRATION_PATTERN = /^\d{4}_conversation_rpc_security\.sql$/;
const REQUIRED_REVOKE_ROLES = ["anon", "authenticated", "public"];

function normalizeSignature(value) {
  return value
    .split(",")
    .map((part) => part.trim().toLowerCase().replace(/\s+/g, " "))
    .join(",");
}

function normalizeRoles(value) {
  return value
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean)
    .sort();
}

function maskNonExecutableSql(sql) {
  const output = [...sql];
  let index = 0;
  let mode = "normal";
  let blockDepth = 0;
  let dollarDelimiter = "";

  const mask = (position) => {
    if (output[position] !== "\n" && output[position] !== "\r") output[position] = " ";
  };
  const maskSpan = (length) => {
    for (let offset = 0; offset < length; offset += 1) mask(index + offset);
    index += length;
  };

  while (index < sql.length) {
    if (mode === "line-comment") {
      if (sql[index] === "\n" || sql[index] === "\r") {
        mode = "normal";
        index += 1;
      } else {
        maskSpan(1);
      }
      continue;
    }

    if (mode === "block-comment") {
      if (sql.startsWith("/*", index)) {
        blockDepth += 1;
        maskSpan(2);
      } else if (sql.startsWith("*/", index)) {
        blockDepth -= 1;
        maskSpan(2);
        if (blockDepth === 0) mode = "normal";
      } else {
        maskSpan(1);
      }
      continue;
    }

    if (mode === "single-quote") {
      if (sql.startsWith("''", index)) {
        maskSpan(2);
      } else if (sql[index] === "\\" && index + 1 < sql.length) {
        maskSpan(2);
      } else if (sql[index] === "'") {
        maskSpan(1);
        mode = "normal";
      } else {
        maskSpan(1);
      }
      continue;
    }

    if (mode === "quoted-identifier") {
      if (sql.startsWith('""', index)) {
        maskSpan(2);
      } else if (sql[index] === '"') {
        maskSpan(1);
        mode = "normal";
      } else {
        maskSpan(1);
      }
      continue;
    }

    if (mode === "dollar-quote") {
      if (sql.startsWith(dollarDelimiter, index)) {
        maskSpan(dollarDelimiter.length);
        mode = "normal";
        dollarDelimiter = "";
      } else {
        maskSpan(1);
      }
      continue;
    }

    if (sql.startsWith("--", index)) {
      mode = "line-comment";
      maskSpan(2);
    } else if (sql.startsWith("/*", index)) {
      mode = "block-comment";
      blockDepth = 1;
      maskSpan(2);
    } else if (sql[index] === "'") {
      mode = "single-quote";
      maskSpan(1);
    } else if (sql[index] === '"') {
      mode = "quoted-identifier";
      maskSpan(1);
    } else if (sql[index] === "$") {
      const delimiter = sql.slice(index).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)?.[0];
      if (delimiter) {
        mode = "dollar-quote";
        dollarDelimiter = delimiter;
        maskSpan(delimiter.length);
      } else {
        index += 1;
      }
    } else {
      index += 1;
    }
  }

  if (mode !== "normal" && mode !== "line-comment") {
    throw new Error(`unterminated SQL ${mode}`);
  }

  return output.join("");
}

function parsePrivilegeStatements(sql, fileName) {
  const cleanSql = maskNonExecutableSql(sql);
  const pattern =
    /\b(REVOKE|GRANT)\s+EXECUTE\s+ON\s+FUNCTION\s+public\.([a-z0-9_]+)\s*\(([^)]*)\)\s+(FROM|TO)\s+([^;]+);/gi;
  const statements = [];

  for (const match of cleanSql.matchAll(pattern)) {
    statements.push({
      action: match[1].toLowerCase(),
      functionName: match[2].toLowerCase(),
      signature: normalizeSignature(match[3]),
      direction: match[4].toLowerCase(),
      roles: normalizeRoles(match[5]),
      fileName,
    });
  }

  return statements;
}

function migrationFiles(migrationsDir) {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((fileName) => /^\d{4}_[a-z0-9_]+\.sql$/.test(fileName))
    .sort();
  const prefixes = files.map((fileName) => fileName.slice(0, 4));
  assert.equal(new Set(prefixes).size, prefixes.length, "migration prefixes must be unique");
  return files;
}

function targetKey(target) {
  return `${target.name}(${target.signature})`;
}

function snapshotPrivileges(statements) {
  const states = new Map(
    TARGETS.map((target) => [
      targetKey(target),
      { public: true, direct: new Set() },
    ]),
  );

  for (const statement of statements) {
    const key = `${statement.functionName}(${statement.signature})`;
    const state = states.get(key);
    if (!state) continue;

    for (const role of statement.roles) {
      if (role === "public") {
        state.public = statement.action === "grant";
      } else if (statement.action === "grant") {
        state.direct.add(role);
      } else {
        state.direct.delete(role);
      }
    }
  }

  return Object.fromEntries(
    [...states.entries()].map(([key, state]) => [
      key,
      {
        public: state.public,
        anon: state.public || state.direct.has("anon"),
        authenticated: state.public || state.direct.has("authenticated"),
        service_role: state.public || state.direct.has("service_role"),
        direct: [...state.direct].sort(),
      },
    ]),
  );
}

function validateSecurityMigration(sql, fileName) {
  const statements = parsePrivilegeStatements(sql, fileName).filter((statement) =>
    TARGETS.some(
      (target) =>
        statement.functionName === target.name &&
        statement.signature === target.signature,
    ),
  );

  assert.equal(statements.length, 4, `${fileName} must contain exactly four target privilege statements`);

  for (const target of TARGETS) {
    const matching = statements.filter(
      (statement) =>
        statement.functionName === target.name &&
        statement.signature === target.signature,
    );
    assert.equal(matching.length, 2, `${targetKey(target)} must have exactly one revoke and one grant`);

    const revoke = matching.find((statement) => statement.action === "revoke");
    const grant = matching.find((statement) => statement.action === "grant");
    assert.ok(revoke, `${targetKey(target)} revoke is required`);
    assert.ok(grant, `${targetKey(target)} grant is required`);
    assert.deepEqual(revoke.roles, REQUIRED_REVOKE_ROLES, `${targetKey(target)} revoke roles mismatch`);
    assert.deepEqual(grant.roles, ["service_role"], `${targetKey(target)} must only grant service_role`);
  }

  const residualSql = maskNonExecutableSql(sql)
    .replace(/\b(?:REVOKE|GRANT)\s+EXECUTE\s+ON\s+FUNCTION\s+public\.[a-z0-9_]+\s*\([^)]*\)\s+(?:FROM|TO)\s+[^;]+;/gi, "")
    .replace(/\bBEGIN\s*;/gi, "")
    .replace(/\bCOMMIT\s*;/gi, "")
    .trim();
  assert.equal(residualSql, "", `${fileName} must not alter unrelated database behavior`);

  return statements;
}

export function validateMigrations(migrationsDir) {
  const files = migrationFiles(migrationsDir);
  const allStatements = [];
  for (const fileName of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, fileName), "utf8");
    allStatements.push(...parsePrivilegeStatements(sql, fileName));
  }

  const expectedTargets = new Set(TARGETS.map(targetKey));
  const createdTargets = new Set();
  for (const fileName of files) {
    const sql = maskNonExecutableSql(fs.readFileSync(path.join(migrationsDir, fileName), "utf8"));
    for (const match of sql.matchAll(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.([a-z0-9_]+)\s*\(([^)]*)\)/gi)) {
      const rawArgs = match[2]
        .split(",")
        .map((argument) =>
          argument
            .trim()
            .replace(/\s+DEFAULT[\s\S]*$/i, "")
            .split(/\s+/)
            .slice(1)
            .join(" "),
        )
        .join(",");
      createdTargets.add(`${match[1].toLowerCase()}(${normalizeSignature(rawArgs)})`);
    }
  }
  for (const target of expectedTargets) {
    assert.ok(createdTargets.has(target), `target function declaration missing: ${target}`);
  }

  const snapshot = snapshotPrivileges(allStatements);
  for (const target of TARGETS) {
    const privileges = snapshot[targetKey(target)];
    assert.equal(privileges.public, false, `${targetKey(target)} remains executable by PUBLIC`);
    assert.equal(privileges.anon, false, `${targetKey(target)} remains executable by anon`);
    assert.equal(privileges.authenticated, false, `${targetKey(target)} remains executable by authenticated`);
    assert.equal(privileges.service_role, true, `${targetKey(target)} is not executable by service_role`);
    assert.deepEqual(privileges.direct, ["service_role"], `${targetKey(target)} has an unexpected direct grant`);
  }

  const securityFiles = files.filter((fileName) => SECURITY_MIGRATION_PATTERN.test(fileName));
  assert.equal(securityFiles.length, 1, "exactly one additive conversation RPC security migration is required");
  const securityFileName = securityFiles[0];
  const securitySql = fs.readFileSync(path.join(migrationsDir, securityFileName), "utf8");
  validateSecurityMigration(securitySql, securityFileName);

  const replaySnapshot = snapshotPrivileges([...allStatements, ...allStatements]);
  assert.deepEqual(replaySnapshot, snapshot, "replaying migrations must preserve the privilege result");

  const conversationMigration = fs.readFileSync(path.join(migrationsDir, "0006_conversations.sql"), "utf8");
  const ownerApiContract = [
    /ALTER TABLE public\.conversations ENABLE ROW LEVEL SECURITY;/,
    /ALTER TABLE public\.conversation_messages ENABLE ROW LEVEL SECURITY;/,
    /CREATE POLICY conversations_select_own ON public\.conversations\s+FOR SELECT USING \(auth\.uid\(\) = user_id AND status <> 'deleted'\);/,
    /CREATE POLICY conversation_messages_select_own ON public\.conversation_messages\s+FOR SELECT USING \(auth\.uid\(\) = user_id\);/,
  ];
  const ownerApiStatements = ownerApiContract.map((contract) => {
    const match = conversationMigration.match(contract);
    assert.ok(match, `conversation owner API contract missing: ${contract}`);
    return match[0];
  });

  return {
    files,
    securityFileName,
    snapshot,
    ownerApiHash: crypto.createHash("sha256").update(ownerApiStatements.join("\n")).digest("hex"),
  };
}

function copyMigrations(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  for (const fileName of migrationFiles(sourceDir)) {
    fs.copyFileSync(path.join(sourceDir, fileName), path.join(targetDir, fileName));
  }
}

function expectFixtureFailure(sourceDir, label, mutate) {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "mongchi-rpc-security-"));
  try {
    copyMigrations(sourceDir, fixtureDir);
    mutate(fixtureDir);
    assert.throws(() => validateMigrations(fixtureDir), undefined, label);
    process.stdout.write(`PASS adversarial=${label}\n`);
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
}

function runSelfTest(migrationsDir, securityFileName) {
  const mutateSecurity = (fixtureDir, transform) => {
    const target = path.join(fixtureDir, securityFileName);
    fs.writeFileSync(target, transform(fs.readFileSync(target, "utf8")), "utf8");
  };

  expectFixtureFailure(migrationsDir, "missing-authenticated-revoke", (fixtureDir) =>
    mutateSecurity(fixtureDir, (sql) => sql.replace(/, authenticated/g, "")),
  );
  expectFixtureFailure(migrationsDir, "missing-service-role-grant", (fixtureDir) =>
    mutateSecurity(fixtureDir, (sql) => sql.replace(/^GRANT EXECUTE[^\n]+service_role;\n?/m, "")),
  );
  expectFixtureFailure(migrationsDir, "malformed-function-signature", (fixtureDir) =>
    mutateSecurity(fixtureDir, (sql) => sql.replace("UUID, TEXT, TIMESTAMPTZ", "UUID, TEXT")),
  );
  expectFixtureFailure(migrationsDir, "misleading-success-sql", (fixtureDir) =>
    mutateSecurity(fixtureDir, (sql) => sql.replace("COMMIT;", "SELECT 'security passed';\n\nCOMMIT;")),
  );
  expectFixtureFailure(migrationsDir, "line-comment-privilege-decoy", (fixtureDir) =>
    mutateSecurity(fixtureDir, (sql) => sql.split("\n").map((line) => `-- ${line}`).join("\n")),
  );
  expectFixtureFailure(migrationsDir, "block-comment-privilege-decoy", (fixtureDir) =>
    mutateSecurity(fixtureDir, (sql) => `/*\n${sql}\n*/`),
  );
  expectFixtureFailure(migrationsDir, "single-quoted-privilege-decoy", (fixtureDir) =>
    mutateSecurity(fixtureDir, (sql) => `BEGIN;\n'${sql.replaceAll("'", "''")}';\nCOMMIT;`),
  );
  expectFixtureFailure(migrationsDir, "quoted-identifier-privilege-decoy", (fixtureDir) =>
    mutateSecurity(fixtureDir, (sql) => `BEGIN;\n"${sql.replaceAll('"', '""')}";\nCOMMIT;`),
  );
  expectFixtureFailure(migrationsDir, "dollar-quoted-privilege-decoy", (fixtureDir) =>
    mutateSecurity(fixtureDir, (sql) => `BEGIN;\n$decoy$\n${sql}\n$decoy$;\nCOMMIT;`),
  );
  expectFixtureFailure(migrationsDir, "nested-block-comment-line-closer-decoy", (fixtureDir) =>
    mutateSecurity(fixtureDir, (sql) => `/* outer\n/* nested */\n${sql}\n-- */\n`),
  );
  expectFixtureFailure(migrationsDir, "unterminated-block-comment", (fixtureDir) =>
    mutateSecurity(fixtureDir, (sql) => `/* outer\n${sql}`),
  );
  expectFixtureFailure(migrationsDir, "duplicate-migration-prefix", (fixtureDir) => {
    fs.copyFileSync(
      path.join(fixtureDir, securityFileName),
      path.join(fixtureDir, `${securityFileName.slice(0, 4)}_duplicate.sql`),
    );
  });
}

function parseArgs(argv) {
  const args = { migrationsDir: path.resolve("supabase/migrations"), selfTest: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--migrations-dir") {
      args.migrationsDir = path.resolve(argv[index + 1]);
      index += 1;
    } else if (argv[index] === "--self-test") {
      args.selfTest = true;
    } else {
      throw new Error(`unknown argument: ${argv[index]}`);
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = validateMigrations(args.migrationsDir);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (args.selfTest) runSelfTest(args.migrationsDir, result.securityFileName);
  process.stdout.write("PASS conversation RPC privilege migration contract\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`FAIL conversation RPC privilege migration contract: ${error.message}\n`);
    process.exitCode = 1;
  }
}
