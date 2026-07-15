import { beforeEach, describe, expect, it, vi } from "vitest";

const { ensureSupabaseSessionMock } = vi.hoisted(() => ({
  ensureSupabaseSessionMock: vi.fn()
}));

vi.mock("./supabaseGenerationSession", () => ({
  ensureSupabaseSession: ensureSupabaseSessionMock
}));

vi.mock("../../shared/errors/reporter", () => ({
  reporter: { captureMessage: vi.fn() }
}));

vi.mock("../../localization/config", () => ({
  getActiveAppLocale: vi.fn(() => "en-US")
}));

vi.mock("react-native", () => ({
  Platform: { OS: "ios" }
}));

import { submitSupportFeedbackToSupabase } from "./supabaseSupportSession";
import { reporter } from "../../shared/errors/reporter";

interface FakeRpcOptions {
  data?: unknown;
  error?: { message: string } | null;
  throws?: Error;
}

const createFakeClient = (options: FakeRpcOptions = {}) => {
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });

      if (options.throws) {
        throw options.throws;
      }

      return {
        data: options.data ?? { outcome: "submitted" },
        error: options.error ?? null
      };
    })
  };

  return { client, rpcCalls };
};

beforeEach(() => {
  ensureSupabaseSessionMock.mockReset();
  ensureSupabaseSessionMock.mockResolvedValue({ ok: true, userId: "user_support_001" });
});

describe("submitSupportFeedbackToSupabase", () => {
  it("submits a generation-issue report with subcategory and context, no message", async () => {
    const { client, rpcCalls } = createFakeClient();

    const result = await submitSupportFeedbackToSupabase(client as never, {
      category: "generation_issue",
      subcategory: "wrong_pet",
      context: { petId: "pet_001", generationJobId: "job_001" }
    });

    expect(result).toEqual({ ok: true });
    expect(rpcCalls).toEqual([
      {
        fn: "submit_support_feedback",
        args: {
          p_category: "generation_issue",
          p_subcategory: "wrong_pet",
          p_message: null,
          p_contact: null,
          p_context: { petId: "pet_001", generationJobId: "job_001" },
          p_app_version: null,
          p_locale: "en-US",
          p_platform: "ios"
        }
      }
    ]);
  });

  it("submits free-text feedback with an optional contact", async () => {
    const { client, rpcCalls } = createFakeClient();

    const result = await submitSupportFeedbackToSupabase(client as never, {
      category: "feedback",
      message: "The garden feels so cozy!",
      contact: "friend@example.com"
    });

    expect(result).toEqual({ ok: true });
    expect(rpcCalls[0]?.args).toMatchObject({
      p_category: "feedback",
      p_message: "The garden feels so cozy!",
      p_contact: "friend@example.com"
    });
  });

  it("surfaces a rate_limited outcome without treating it as a hard failure", async () => {
    const { client } = createFakeClient({ data: { outcome: "rate_limited" } });

    const result = await submitSupportFeedbackToSupabase(client as never, {
      category: "feedback",
      message: "Just checking in"
    });

    expect(result).toEqual({ ok: false, reason: "rate_limited" });
  });

  it("maps an RPC error to a retryable request_failed outcome", async () => {
    const { client } = createFakeClient({ error: { message: "connection reset" } });

    const result = await submitSupportFeedbackToSupabase(client as never, {
      category: "feedback",
      message: "Hello"
    });

    expect(result).toEqual({ ok: false, reason: "request_failed" });
  });

  it("rejects malformed RPC data as request_failed", async () => {
    const { client } = createFakeClient({ data: { outcome: "unexpected" } });

    const result = await submitSupportFeedbackToSupabase(client as never, {
      category: "feedback",
      message: "Hello"
    });

    expect(result).toEqual({ ok: false, reason: "request_failed" });
  });

  it("never throws when the client itself throws, and reports the failure", async () => {
    const { client } = createFakeClient({ throws: new Error("socket closed") });

    const result = await submitSupportFeedbackToSupabase(client as never, {
      category: "generation_issue",
      subcategory: "poor_quality"
    });

    expect(result).toEqual({ ok: false, reason: "request_failed" });
    expect(reporter.captureMessage).toHaveBeenCalled();
  });

  it("resolves request_failed without calling the RPC when the session cannot be ensured", async () => {
    ensureSupabaseSessionMock.mockResolvedValueOnce({
      ok: false,
      error: { status: 0, code: "supabase_anonymous_sign_in_failed", messageSafe: "no", retryable: true }
    });
    const { client, rpcCalls } = createFakeClient();

    const result = await submitSupportFeedbackToSupabase(client as never, {
      category: "feedback",
      message: "Hello"
    });

    expect(result).toEqual({ ok: false, reason: "request_failed" });
    expect(rpcCalls).toHaveLength(0);
  });
});
