import { Platform } from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getActiveAppLocale } from "../../localization/config";
import { reporter } from "../../shared/errors/reporter";
import { withRequestTimeout } from "../../shared/api/requestTimeout";
import { ensureSupabaseSession } from "./supabaseGenerationSession";

const submitSupportFeedbackTimeoutMs = 15_000;

export type SupportFeedbackCategory = "generation_issue" | "feedback" | "support";

export interface SubmitSupportFeedbackInput {
  category: SupportFeedbackCategory;
  subcategory?: string;
  message?: string;
  contact?: string;
  context?: Record<string, unknown>;
}

export type SubmitSupportFeedbackOutcome =
  | { ok: true }
  | { ok: false; reason: "rate_limited" }
  | { ok: false; reason: "request_failed" };

interface SubmitSupportFeedbackRpcRow {
  outcome: "submitted" | "rate_limited";
}

const isSubmitSupportFeedbackRpcRow = (value: unknown): value is SubmitSupportFeedbackRpcRow => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const outcome = (value as Partial<SubmitSupportFeedbackRpcRow>).outcome;

  return outcome === "submitted" || outcome === "rate_limited";
};

/**
 * Best-effort submit for both SupportScreen's generation-issue report
 * buttons and its free-text feedback box (0024_support_feedback.sql's
 * submit_support_feedback RPC). Deliberately never throws and always
 * resolves -- report/feedback UX is meant to feel gentle and complete from
 * the player's point of view even if the server round-trip fails (see
 * TerrariumSessionProvider's reportGenerationIssue and submitSupportFeedback,
 * which show their local "saved" confirmation regardless of this call's
 * outcome). A caller that wants to react to a genuine failure can still
 * branch on the returned `reason`.
 */
export const submitSupportFeedbackToSupabase = async (
  client: SupabaseClient,
  input: SubmitSupportFeedbackInput
): Promise<SubmitSupportFeedbackOutcome> => {
  try {
    const session = await ensureSupabaseSession(client);

    if (!session.ok) {
      return { ok: false, reason: "request_failed" };
    }

    const response = await withRequestTimeout(
      client.rpc("submit_support_feedback", {
        p_category: input.category,
        p_subcategory: input.subcategory ?? null,
        p_message: input.message ?? null,
        p_contact: input.contact ?? null,
        p_context: input.context ?? {},
        p_app_version: null,
        p_locale: getActiveAppLocale(),
        p_platform: Platform.OS
      }),
      submitSupportFeedbackTimeoutMs
    );

    if (response.error || !isSubmitSupportFeedbackRpcRow(response.data)) {
      return { ok: false, reason: "request_failed" };
    }

    if (response.data.outcome === "rate_limited") {
      return { ok: false, reason: "rate_limited" };
    }

    return { ok: true };
  } catch (cause) {
    reporter.captureMessage("support: feedback submit failed", {
      cause: cause instanceof Error ? cause.message : String(cause),
      category: input.category
    });
    return { ok: false, reason: "request_failed" };
  }
};
