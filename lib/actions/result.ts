import { AppApiError, toAppApiError } from '@/lib/api/errors';
import { isAuthError } from '@/lib/api/http-error';

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number; code: string; details?: unknown };

export const okResult = <T>(data: T): ActionResult<T> => ({ ok: true, data });

export const failResult = <T = never>(
  error: string,
  options?: { status?: number; code?: string; details?: unknown },
): ActionResult<T> => ({
  ok: false,
  error,
  status: options?.status || 500,
  code: options?.code || 'INTERNAL_ERROR',
  details: options?.details,
});

export const failFromError = <T = never>(
  error: unknown,
  fallbackMessage: string,
  options?: { status?: number; code?: string },
): ActionResult<T> => {
  const appError = toAppApiError(error, {
    error: fallbackMessage,
    code: options?.code,
    status: options?.status,
  });

  return {
    ok: false,
    error: appError.message,
    status: appError.status,
    code: appError.code,
    details: appError.details,
  };
};

export const isUnauthorizedError = (error: unknown) => isAuthError(error);
