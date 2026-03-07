import { logger } from '@/lib/logger';
import { toAppApiError } from '@/lib/api/errors';

type RequestLogResult = 'success' | 'failure';

type RequestLogOptions = {
  requestId: string;
  route: string;
  action: string;
  actor?: string | null;
  tenantId?: string | null;
};

type RequestLogOverrides = {
  actor?: string | null;
  tenantId?: string | null;
  result?: RequestLogResult;
  status?: number;
  code?: string;
  details?: unknown;
};

function buildPayload(
  options: RequestLogOptions,
  startedAt: number,
  overrides?: RequestLogOverrides,
) {
  return {
    requestId: options.requestId,
    actor: overrides?.actor ?? options.actor ?? null,
    tenantId: overrides?.tenantId ?? options.tenantId ?? null,
    route: options.route,
    action: options.action,
    result: overrides?.result ?? 'success',
    duration: Date.now() - startedAt,
    ...(typeof overrides?.status === 'number' ? { status: overrides.status } : {}),
    ...(typeof overrides?.code === 'string' ? { code: overrides.code } : {}),
    ...(overrides?.details !== undefined ? { details: overrides.details } : {}),
  };
}

export function createRequestLogger(options: RequestLogOptions) {
  const startedAt = Date.now();

  return {
    success(overrides?: Omit<RequestLogOverrides, 'result'>) {
      logger.info('api.request.completed', buildPayload(options, startedAt, overrides));
    },
    failure(
      error: unknown,
      fallback: { error: string; code?: string; status?: number },
      overrides?: Omit<RequestLogOverrides, 'result' | 'status' | 'code' | 'details'>,
    ) {
      const apiError = toAppApiError(error, fallback);
      logger.error(
        error instanceof Error ? error : new Error(apiError.message),
        buildPayload(options, startedAt, {
          ...overrides,
          result: 'failure',
          status: apiError.status,
          code: apiError.code,
          details: apiError.details,
        }),
      );
      return apiError;
    },
  };
}
