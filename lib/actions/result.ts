import { toAppApiError } from '@/lib/api/errors';
import { isAuthError } from '@/lib/api/http-error';

export type ActionResult<T, TCode extends string = string> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number; code?: TCode; details?: unknown };

export const okResult = <T>(data: T): ActionResult<T> => ({ ok: true, data });

export const failResult = <T = never, TCode extends string = string>(
  error: string,
  options?: { status?: number; code?: TCode; details?: unknown },
): ActionResult<T, TCode | 'INTERNAL_ERROR'> => ({
  ok: false,
  error,
  status: options?.status || 500,
  code: options?.code ?? 'INTERNAL_ERROR',
  details: options?.details,
});

export const failFromError = <T = never, TCode extends string = string>(
  error: unknown,
  fallbackMessage: string,
  options?: { status?: number; code?: TCode },
): ActionResult<T, TCode | 'INTERNAL_ERROR'> => {
  const appError = toAppApiError(error, {
    error: fallbackMessage,
    code: options?.code,
    status: options?.status,
  });

  return {
    ok: false,
    error: appError.message,
    status: appError.status,
    code: appError.code as TCode | 'INTERNAL_ERROR' | undefined,
    details: appError.details,
  };
};

export const isUnauthorizedError = (error: unknown) => isAuthError(error);
