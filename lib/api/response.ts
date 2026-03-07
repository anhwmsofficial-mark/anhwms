import { NextRequest, NextResponse } from 'next/server';

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR'
  | 'SCHEMA_MISMATCH';

type ApiSuccess<T> = {
  ok: true;
  data: T;
  requestId: string;
};

type ApiFailure = {
  ok: false;
  error: string;
  message: string;
  status: number;
  code: ApiErrorCode | string;
  details?: unknown;
  legacy?: {
    code: ApiErrorCode | string;
    message: string;
    details?: unknown;
  };
  requestId: string;
};

export type ApiResponseBody<T> = ApiSuccess<T> | ApiFailure;

export function getRequestId(request?: NextRequest): string {
  return (
    request?.headers.get('x-request-id') ||
    request?.headers.get('x-correlation-id') ||
    crypto.randomUUID()
  );
}

export function ok<T>(
  data: T,
  options?: {
    status?: number;
    requestId?: string;
    headers?: HeadersInit;
  },
) {
  const body: ApiSuccess<T> = {
    ok: true,
    data,
    requestId: options?.requestId || crypto.randomUUID(),
  };
  return NextResponse.json<ApiResponseBody<T>>(body, {
    status: options?.status || 200,
    headers: options?.headers,
  });
}

export function fail<T = never>(
  code: ApiErrorCode | string,
  message: string,
  options?: {
    status?: number;
    requestId?: string;
    details?: unknown;
    headers?: HeadersInit;
  },
) {
  const status = options?.status || 500;
  const body: ApiFailure = {
    ok: false,
    error: message,
    message,
    status,
    code,
    details: options?.details,
    legacy: { code, message, details: options?.details },
    requestId: options?.requestId || crypto.randomUUID(),
  };
  return NextResponse.json<ApiResponseBody<T>>(body, {
    status,
    headers: options?.headers,
  });
}

export function getRouteContext(request: NextRequest, route: string) {
  const requestId = getRequestId(request);
  return {
    requestId,
    route,
    method: request.method,
  };
}
