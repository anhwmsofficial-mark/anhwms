import { isApiHttpError } from '@/lib/api/http-error';

export const ERROR_CODES = {
  // Common
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  
  // Business - Inventory
  STOCK_SHORTAGE: 'STOCK_SHORTAGE',
  INVALID_FILE: 'INVALID_FILE',
  TENANT_MISMATCH: 'TENANT_MISMATCH',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  ROW_LIMIT_EXCEEDED: 'ROW_LIMIT_EXCEEDED',
  TOO_MANY_ROWS: 'TOO_MANY_ROWS', // Alias for ROW_LIMIT_EXCEEDED if needed
} as const;

export type AppErrorCode = keyof typeof ERROR_CODES | string;

export class AppApiError extends Error {
  code: AppErrorCode;
  status: number;
  details?: unknown;

  constructor(params: { error: string; code: AppErrorCode; status?: number; details?: unknown }) {
    super(params.error);
    this.name = "AppApiError";
    this.code = params.code;
    this.status = params.status ?? 500;
    this.details = params.details;
  }

  toResponseBody() {
    return {
      error: this.message,
      message: this.message,
      status: this.status,
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
  if (isApiHttpError(error)) {
    return new AppApiError({
      error: error.message,
      code: error.code,
      status: error.status,
      details: error.details,
    });
  }
  if (error && typeof error === 'object') {
    const candidate = error as { message?: unknown; code?: unknown; status?: unknown; details?: unknown };
    if (typeof candidate.message === 'string' && (typeof candidate.code === 'string' || typeof candidate.status === 'number')) {
      return new AppApiError({
        error: candidate.message || fallback.error,
        code: typeof candidate.code === 'string' ? candidate.code : fallback.code || 'INTERNAL_ERROR',
        status: typeof candidate.status === 'number' ? candidate.status : fallback.status ?? 500,
        details: candidate.details,
      });
    }
  }
  if (error instanceof Error) {
    return new AppApiError({
      error: error.message || fallback.error,
      code: fallback.code || "INTERNAL_ERROR",
      status: fallback.status ?? 500,
    });
  }
  return new AppApiError({
    error: fallback.error,
    code: fallback.code || "INTERNAL_ERROR",
    status: fallback.status ?? 500,
  });
};
