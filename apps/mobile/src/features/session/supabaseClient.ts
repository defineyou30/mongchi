import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

// babel-preset-expo's inline-env-vars plugin only recognizes a literal
// `process.env.EXPO_PUBLIC_X` member access at build time -- a computed
// lookup like `process.env[key]` (what this file used to do via a shared
// `readEnvVar(key)` helper) is never inlined, so these two vars came back
// `undefined` in every release build (see
// scripts/validate-mobile-env-inlining.mjs for the guard that now catches
// this class of bug). Each var therefore gets its own literal read.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const normalizeEnvVar = (value: string | undefined): string | null => {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
};

export const getConfiguredSupabaseUrl = (): string | null => normalizeEnvVar(SUPABASE_URL);

export const getConfiguredSupabaseAnonKey = (): string | null => normalizeEnvVar(SUPABASE_ANON_KEY);

let cachedClient: SupabaseClient | null = null;
let cachedClientKey: string | null = null;

/**
 * Lazily creates (and memoizes) the Supabase client from env config. Doubles
 * as the "are we in supabase mode" detector: callers branch on a non-null
 * result to pick the supabase generation flow over the local-mock flow.
 * Returns null when EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY are not configured.
 */
export const getSupabaseClient = (): SupabaseClient | null => {
  const supabaseUrl = getConfiguredSupabaseUrl();
  const supabaseAnonKey = getConfiguredSupabaseAnonKey();

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const cacheKey = `${supabaseUrl}::${supabaseAnonKey}`;

  if (cachedClient && cachedClientKey === cacheKey) {
    return cachedClient;
  }

  cachedClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  });
  cachedClientKey = cacheKey;

  return cachedClient;
};

/** Test-only: clears the memoized client so tests can reconfigure env vars. */
export const resetSupabaseClientForTests = (): void => {
  cachedClient = null;
  cachedClientKey = null;
};
