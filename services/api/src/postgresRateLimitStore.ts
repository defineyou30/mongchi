import type { ApiDatabaseMigrationClient } from "./dbMigrations";
import type { ApiNodeRateLimitStore, ApiNodeRateLimitStoreInput, ApiNodeRateLimitStoreResult } from "./nodeServer";

interface ApiRateLimitRow {
  windowStart: number | string;
  count: number | string;
}

const normalizePositiveInteger = (value: number | string): number | null => {
  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);

  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
};

const upsertRateLimitSql = `
INSERT INTO public.api_rate_limits (
  key,
  window_start_ms,
  count,
  updated_at
) VALUES (
  $1,
  $2,
  1,
  now()
)
ON CONFLICT (key) DO UPDATE SET
  window_start_ms = CASE
    WHEN $2 - public.api_rate_limits.window_start_ms >= $3 THEN $2
    ELSE public.api_rate_limits.window_start_ms
  END,
  count = CASE
    WHEN $2 - public.api_rate_limits.window_start_ms >= $3 THEN 1
    ELSE public.api_rate_limits.count + 1
  END,
  updated_at = now()
RETURNING
  window_start_ms AS "windowStart",
  count;
`;

export const createPostgresApiRateLimitStore = (client: ApiDatabaseMigrationClient): ApiNodeRateLimitStore => ({
  increment: async ({
    key,
    windowMs,
    nowMs
  }: ApiNodeRateLimitStoreInput): Promise<ApiNodeRateLimitStoreResult> => {
    const result = await client.query<ApiRateLimitRow>(upsertRateLimitSql, [key, nowMs, windowMs]);
    const row = result.rows[0];
    const windowStart = row ? normalizePositiveInteger(row.windowStart) : null;
    const count = row ? normalizePositiveInteger(row.count) : null;

    if (windowStart === null || count === null || count < 1) {
      throw new Error("Postgres API rate-limit store returned an invalid row.");
    }

    return {
      windowStart,
      count
    };
  }
});
