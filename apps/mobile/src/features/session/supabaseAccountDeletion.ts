const RETRYABLE_DELETE_CODES = [
  "storage_delete_failed",
  "auth_delete_failed",
  "network_or_server_error",
  "unexpected_response"
] as const;

type RetryableDeleteCode = (typeof RETRYABLE_DELETE_CODES)[number];

export type DeleteSupabaseAccountResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: "unauthorized";
      readonly retryable: false;
      readonly code: "unauthorized";
      readonly status: 401;
    }
  | {
      readonly ok: false;
      readonly reason: "network_or_server_error";
      readonly retryable: true;
      readonly code: RetryableDeleteCode;
      readonly status: number;
    };

type FunctionInvocation = {
  readonly data: unknown;
  readonly error: unknown;
  readonly response?: Response;
};

type DeleteAccountFunctionClient = {
  readonly functions: {
    readonly invoke: (
      name: string,
      init: { readonly body: Readonly<Record<string, never>> }
    ) => Promise<FunctionInvocation>;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isRetryableDeleteCode = (value: unknown): value is RetryableDeleteCode =>
  typeof value === "string" && RETRYABLE_DELETE_CODES.some((code) => code === value);

const retryableFailure = (code: RetryableDeleteCode, status: number): DeleteSupabaseAccountResult => ({
  ok: false,
  reason: "network_or_server_error",
  retryable: true,
  code,
  status
});

const parseRetryableCode = (body: unknown): RetryableDeleteCode => {
  if (!isRecord(body) || body.ok !== false || !isRecord(body.error)) {
    return "unexpected_response";
  }

  if (body.error.retryable !== true || !isRetryableDeleteCode(body.error.code)) {
    return "unexpected_response";
  }

  return body.error.code;
};

const parseErrorResponse = async (response: Response): Promise<RetryableDeleteCode> => {
  try {
    const body: unknown = await response.json();
    return parseRetryableCode(body);
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof TypeError) return "unexpected_response";
    throw error;
  }
};

export const deleteSupabaseAccountData = async (
  client: DeleteAccountFunctionClient
): Promise<DeleteSupabaseAccountResult> => {
  try {
    const invoked = await client.functions.invoke("delete-account", { body: {} });

    if (invoked.error) {
      const status = invoked.response?.status ?? 0;

      if (status === 401) {
        await invoked.response?.body?.cancel();
        return { ok: false, reason: "unauthorized", retryable: false, code: "unauthorized", status: 401 };
      }

      const code = invoked.response ? await parseErrorResponse(invoked.response) : "network_or_server_error";
      return retryableFailure(code, status);
    }

    if (isRecord(invoked.data) && invoked.data.ok === true) {
      return { ok: true };
    }

    return retryableFailure(parseRetryableCode(invoked.data), invoked.response?.status ?? 200);
  } catch (error) {
    if (error instanceof Error) return retryableFailure("network_or_server_error", 0);
    throw error;
  }
};
