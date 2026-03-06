type LegacyErrorShape = {
  ok?: boolean;
  error?: string | { code?: string; message?: string; details?: unknown };
  code?: string;
  message?: string;
  details?: unknown;
};

export async function parseApiError(
  response: Response,
  fallbackMessage = "요청 처리에 실패했습니다."
): Promise<{ error: string; code: string; details?: unknown }> {
  let payload: LegacyErrorShape | null = null;

  try {
    payload = (await response.json()) as LegacyErrorShape;
  } catch {
    payload = null;
  }

  const flatError =
    typeof payload?.error === "string"
      ? payload.error
      : typeof payload?.message === "string"
      ? payload.message
      : undefined;

  const nestedError =
    typeof payload?.error === "object" && payload.error
      ? payload.error.message
      : undefined;

  const code =
    (typeof payload?.code === "string" && payload.code) ||
    (typeof payload?.error === "object" && payload.error?.code) ||
    "UNKNOWN_ERROR";

  const details =
    (typeof payload?.error === "object" && payload.error?.details) || payload?.details;

  return {
    error: flatError || nestedError || `${fallbackMessage} (${response.status})`,
    code,
    ...(details !== undefined ? { details } : {}),
  };
}
