import { getErrorMessage } from '@/lib/errorHandler';
import { isAuthError } from '@/lib/api/http-error';

export type ActionResult<T, C extends string = string> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number; code?: C };

export const okResult = <T>(data: T): ActionResult<T> => ({ ok: true, data });

export const failResult = <T = never, C extends string = string>(
  error: string,
  options?: { status?: number; code?: C },
): ActionResult<T, C> => ({
  ok: false,
  error,
  status: options?.status,
  code: options?.code,
});

export const failFromError = <T = never, C extends string = string>(
  error: unknown,
  fallback: string,
  options?: { status?: number; code?: C },
): ActionResult<T, C> => failResult(getErrorMessage(error) || fallback, options);

export const isUnauthorizedError = (error: unknown) =>
  isAuthError(error);
