import { NextRequest } from 'next/server';
import { getLogisticsLogs } from '@/lib/api/orders';
import { requirePermission } from '@/utils/rbac';
import { toAppApiError } from '@/lib/api/errors';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { getErrorMessage } from '@/lib/errorHandler';

/**
 * 주문별 물류 API 로그 조회
 * GET /api/orders/[id]/logs
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getRouteContext(req, 'GET /api/orders/[id]/logs');
  try {
    await requirePermission('read:orders', req);
    const { id } = await params;
    const logs = await getLogisticsLogs(id);
    return ok(logs, { requestId: ctx.requestId });
  } catch (error: unknown) {
    logger.error(error as Error, { ...ctx, scope: 'api' });
    const apiError = toAppApiError(error, {
      error: getErrorMessage(error) || '조회 실패',
      code: 'INTERNAL_ERROR',
      status: 500,
    });
    return fail(apiError.code || 'INTERNAL_ERROR', apiError.message, {
      status: apiError.status,
      requestId: ctx.requestId,
      details: apiError.details,
    });
  }
}

