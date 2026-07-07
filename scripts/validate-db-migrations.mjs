import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const migrationsDir = path.join(rootDir, "services/api/migrations");
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

if (failures.length > 0) {
  console.error("Database migration validation failed:");

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log("Database migration validation passed.");
