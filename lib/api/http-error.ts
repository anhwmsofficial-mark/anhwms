export type ApiHttpErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR';

type ApiHttpErrorParams = {
  code: ApiHttpErrorCode | string;
  message: string;
  status: number;
  details?: unknown;
};

export class ApiHttpError extends Error {
  code: ApiHttpErrorCode | string;
  status: number;
  details?: unknown;

  constructor(params: ApiHttpErrorParams) {
    super(params.message);
    this.name = 'ApiHttpError';
    this.code = params.code;
    this.status = params.status;
    this.details = params.details;
  }
}

export function isApiHttpError(error: unknown): error is ApiHttpError {
  return error instanceof ApiHttpError;
}

export function createApiHttpError(params: ApiHttpErrorParams) {
  return new ApiHttpError(params);
}

export function unauthenticatedError(message = 'Authentication required', details?: unknown) {
  return createApiHttpError({
    code: 'UNAUTHORIZED',
    message,
    status: 401,
    details,
  });
}

export function forbiddenError(message = 'Access denied', details?: unknown) {
  return createApiHttpError({
    code: 'FORBIDDEN',
    message,
    status: 403,
    details,
  });
}

export function notFoundError(message = 'Resource not found', details?: unknown) {
  return createApiHttpError({
    code: 'NOT_FOUND',
    message,
    status: 404,
    details,
  });
}

export function getApiHttpErrorStatus(error: unknown): number | undefined {
  if (isApiHttpError(error)) return error.status;
  if (!error || typeof error !== 'object') return undefined;

  const candidate = error as { status?: unknown; statusCode?: unknown };
  if (typeof candidate.status === 'number') return candidate.status;
  if (typeof candidate.statusCode === 'number') return candidate.statusCode;
  return undefined;
}

export function getApiHttpErrorCode(error: unknown): string | undefined {
  if (isApiHttpError(error)) return error.code;
  if (!error || typeof error !== 'object') return undefined;

  const candidate = error as { code?: unknown };
  return typeof candidate.code === 'string' ? candidate.code : undefined;
}

export function isAuthError(error: unknown): boolean {
  const status = getApiHttpErrorStatus(error);
  const code = getApiHttpErrorCode(error);
  return status === 401 || status === 403 || code === 'UNAUTHORIZED' || code === 'FORBIDDEN';
}
