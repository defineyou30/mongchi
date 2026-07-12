const MAX_OPENAI_ERROR_DETAIL_LENGTH = 300;

const extractMessage = (value: unknown): string | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const error = (value as { error?: unknown }).error;

  if (!error || typeof error !== "object") {
    return null;
  }

  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message.trim().length > 0
    ? message.trim()
    : null;
};

export const readOpenAiErrorDetail = async (
  response: Response,
): Promise<string> => {
  const body = (await response.text().catch(() => "")).trim();

  if (!body) {
    return "";
  }

  let detail = body;

  try {
    detail = extractMessage(JSON.parse(body)) ?? body;
  } catch {
    detail = body;
  }

  return detail.slice(0, MAX_OPENAI_ERROR_DETAIL_LENGTH);
};
