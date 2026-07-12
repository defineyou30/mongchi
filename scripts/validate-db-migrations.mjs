import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(
  process.env.TINY_PET_VALIDATOR_ROOT ?? new URL("..", import.meta.url).pathname
);
const migrationsDir = path.join(rootDir, "services/api/migrations");
const supabaseMigrationsDir = path.join(rootDir, "supabase/migrations");
const migrationNamePattern = /^\d{4}_[a-z0-9_]+\.sql$/;
const requiredTables = [
  "api_users",
  "pets",
  "original_photos",
  "generation_jobs",
  "generated_assets",
  "care_states",
  "items",
  "reaction_catalog_versions",
  "inventories",
  "inventory_items",
  "placed_items",
  "walk_sessions",
  "recent_reactions",
  "conversations",
  "conversation_messages",
  "entitlements",
  "purchase_ledger",
  "privacy_deletion_jobs",
  "api_outbox_events",
  "api_rate_limits"
];
const requiredIndexes = [
  "pets_user_live_idx",
  "original_photos_user_pet_status_idx",
  "generation_jobs_user_pet_status_idx",
  "generated_assets_pet_state_idx",
  "reaction_catalog_versions_active_locale_idx",
  "walk_sessions_user_pet_status_idx",
  "conversations_user_pet_status_idx",
  "conversation_messages_created_at_idx",
  "entitlements_user_key_status_idx",
  "purchase_ledger_user_platform_idx",
  "privacy_deletion_jobs_user_status_idx",
  "api_outbox_events_pending_idx",
  "api_rate_limits_updated_at_idx"
];
const forbiddenPatterns = [/mock-signed/i, /mock:\/\//i, /raw[-_ ]?receipt/i, /provider[-_ ]?secret/i];
const failures = [];

if (!fs.existsSync(migrationsDir)) {
  failures.push("services/api/migrations must exist.");
} else {
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();

  if (migrationFiles.length === 0) {
    failures.push("At least one SQL migration is required.");
  }

  for (const fileName of migrationFiles) {
    if (!migrationNamePattern.test(fileName)) {
      failures.push(`${fileName} must match ${migrationNamePattern}.`);
    }
  }

  const duplicatePrefixes = migrationFiles
    .map((fileName) => fileName.slice(0, 4))
    .filter((prefix, index, prefixes) => prefixes.indexOf(prefix) !== index);

  for (const prefix of [...new Set(duplicatePrefixes)]) {
    failures.push(`Migration prefix ${prefix} is duplicated.`);
  }

  const combinedSql = migrationFiles
    .map((fileName) => fs.readFileSync(path.join(migrationsDir, fileName), "utf8"))
    .join("\n\n");

  for (const fileName of migrationFiles) {
    const sql = fs.readFileSync(path.join(migrationsDir, fileName), "utf8").trim();

    if (!/^BEGIN;/i.test(sql)) {
      failures.push(`${fileName} must start with BEGIN;`);
    }

    if (!/COMMIT;$/i.test(sql)) {
      failures.push(`${fileName} must end with COMMIT;`);
    }

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(sql)) {
        failures.push(`${fileName} contains forbidden migration content matching ${pattern}.`);
      }
    }
  }

  for (const table of requiredTables) {
    const tablePattern = new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+public\\.${table}\\b`, "i");

    if (!tablePattern.test(combinedSql)) {
      failures.push(`Required table public.${table} is missing from migrations.`);
    }
  }

  for (const index of requiredIndexes) {
    const indexPattern = new RegExp(`CREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+IF\\s+NOT\\s+EXISTS\\s+${index}\\b`, "i");

    if (!indexPattern.test(combinedSql)) {
      failures.push(`Required index ${index} is missing from migrations.`);
    }
  }

  if (!/CHECK\s*\(\s*byte_size\s*>\s*0\s*AND\s*byte_size\s*<=\s*10485760\s*\)/i.test(combinedSql)) {
    failures.push("original_photos must enforce the 10 MB upload limit.");
  }

  if (!/transaction_id\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i.test(combinedSql)) {
    failures.push("purchase_ledger must enforce unique transaction_id.");
  }
}

const serviceRoleOnlySupabaseFunctions = [
  "consume_credits(UUID, INTEGER, TEXT, TEXT, TEXT, JSONB)",
  "refund_credits(UUID, TEXT, TEXT)",
  "grant_credits(UUID, INTEGER, TEXT, TEXT, TEXT, JSONB)",
  "consume_generation_quota(UUID)",
  "refund_generation_quota(UUID)",
  "check_generation_rate_limit(UUID, INTEGER, INTEGER)",
  "grant_pet_slot(UUID, TEXT)",
  "reserve_pet_generation_slot(UUID, TEXT)",
  "refund_pet_generation_slot(UUID)",
  "create_expression_pack_job(UUID, INTEGER, TEXT, TEXT, JSONB, TEXT, TEXT[], TEXT)",
  "create_generation_job(UUID, TEXT, JSONB, TEXT, TEXT, TEXT[])",
  "claim_generation_job(UUID, UUID, INTEGER, INTEGER)",
  "advance_generation_job(UUID, UUID, TEXT, JSONB)",
  "complete_generation_job(UUID, UUID, JSONB)",
  "record_generation_asset(UUID, UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT, TIMESTAMPTZ)",
  "finalize_generation_source_cleanup(UUID, UUID)",
  "fail_generation_job(UUID, UUID, TEXT, TEXT, JSONB)",
  "compact_conversation(UUID, TEXT, TIMESTAMPTZ)",
  "purge_expired_conversation_messages(INTEGER, INTEGER)"
];

const sqlSignaturePattern = (signature) =>
  signature
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\\(/g, "\\s*\\(\\s*")
    .replace(/, /g, "\\s*,\\s*")
    .replace(/\\\)/g, "\\s*\\)");

const maskNonExecutableSql = (sql) => {
  const output = [...sql];
  let index = 0;
  let mode = "normal";
  let blockDepth = 0;
  let dollarDelimiter = "";

  const mask = (position) => {
    if (output[position] !== "\n" && output[position] !== "\r") {
      output[position] = " ";
    }
  };
  const maskSpan = (length) => {
    for (let offset = 0; offset < length; offset += 1) {
      mask(index + offset);
    }
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
        if (blockDepth === 0) {
          mode = "normal";
        }
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
    throw new Error(`unterminated SQL ${mode.replaceAll("-", " ")}`);
  }

  return output.join("");
};

if (!fs.existsSync(supabaseMigrationsDir)) {
  failures.push("supabase/migrations must exist.");
} else {
  const supabaseMigrationFiles = fs
    .readdirSync(supabaseMigrationsDir)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();

  if (supabaseMigrationFiles.length === 0) {
    failures.push("At least one Supabase SQL migration is required.");
  }

  for (const fileName of supabaseMigrationFiles) {
    if (!migrationNamePattern.test(fileName)) {
      failures.push(`Supabase migration ${fileName} must match ${migrationNamePattern}.`);
    }
  }

  const duplicateSupabasePrefixes = supabaseMigrationFiles
    .map((fileName) => fileName.slice(0, 4))
    .filter((prefix, index, prefixes) => prefixes.indexOf(prefix) !== index);

  for (const prefix of new Set(duplicateSupabasePrefixes)) {
    failures.push(`Supabase migration prefix ${prefix} is duplicated.`);
  }

  const executableSupabaseSql = [];

  for (const fileName of supabaseMigrationFiles) {
    const sql = fs.readFileSync(path.join(supabaseMigrationsDir, fileName), "utf8");
    try {
      executableSupabaseSql.push(maskNonExecutableSql(sql));
    } catch (error) {
      failures.push(`Supabase migration ${fileName} has invalid lexical structure: ${error.message}.`);
    }
  }

  const combinedSupabaseSql = executableSupabaseSql.join("\n\n");

  for (const signature of serviceRoleOnlySupabaseFunctions) {
    const signaturePattern = sqlSignaturePattern(signature);
    const revokePattern = new RegExp(
      `REVOKE\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${signaturePattern}\\s+FROM\\s+PUBLIC\\s*,\\s*anon\\s*,\\s*authenticated\\s*;`,
      "i"
    );
    const grantPattern = new RegExp(
      `GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${signaturePattern}\\s+TO\\s+service_role\\s*;`,
      "i"
    );

    if (!revokePattern.test(combinedSupabaseSql)) {
      failures.push(`Supabase SECURITY DEFINER function ${signature} must revoke execute from PUBLIC, anon, authenticated.`);
    }

    if (!grantPattern.test(combinedSupabaseSql)) {
      failures.push(`Supabase SECURITY DEFINER function ${signature} must grant execute only to service_role.`);
    }
  }

  const creditBalanceSignaturePattern = sqlSignaturePattern("get_credit_balance(UUID)");
  const creditBalanceRevokePattern = new RegExp(
    `REVOKE\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${creditBalanceSignaturePattern}\\s+FROM\\s+PUBLIC\\s*,\\s*anon\\s*;`,
    "i"
  );

  if (!creditBalanceRevokePattern.test(combinedSupabaseSql)) {
    failures.push("Supabase get_credit_balance(UUID) must revoke execute from PUBLIC and anon.");
  }
}

if (failures.length > 0) {
  console.error("Database migration validation failed:");

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log("Database migration validation passed.");
