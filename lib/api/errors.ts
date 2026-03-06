export class AppApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(params: { error: string; code: string; status?: number; details?: unknown }) {
    super(params.error);
    this.name = "AppApiError";
    this.code = params.code;
    this.status = params.status ?? 500;
    this.details = params.details;
  }

  toResponseBody() {
    return {
      error: this.message,
      code: this.code,
      ...(this.details !== undefined ? { details: this.details } : {}),
    };
  }
}

export const toAppApiError = (
  error: unknown,
  fallback: { error: string; code?: string; status?: number } = { error: "알 수 없는 오류가 발생했습니다." }
) => {
  if (error instanceof AppApiError) return error;
  if (error instanceof Error) {
    const isForbidden = error.message.includes("Unauthorized");
    return new AppApiError({
      error: error.message || fallback.error,
      code: isForbidden ? "FORBIDDEN" : fallback.code || "INTERNAL_ERROR",
      status: isForbidden ? 403 : fallback.status ?? 500,
    });
  }
  return new AppApiError({
    error: fallback.error,
    code: fallback.code || "INTERNAL_ERROR",
    status: fallback.status ?? 500,
  });
};
