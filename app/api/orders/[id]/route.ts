import { NextRequest } from 'next/server';
import { getOrder } from '@/lib/api/orders';
import { requirePermission } from '@/utils/rbac';
import { toAppApiError } from '@/lib/api/errors';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { getErrorMessage } from '@/lib/errorHandler';

/**
 * 주문 상세 조회 API
 * GET /api/orders/[id]
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getRouteContext(req, 'GET /api/orders/[id]');
  try {
    await requirePermission('read:orders', req);
    const { id } = await params;
    const order = await getOrder(id);
    return ok(order, { requestId: ctx.requestId });
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

