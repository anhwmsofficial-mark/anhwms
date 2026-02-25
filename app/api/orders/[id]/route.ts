/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server';
import { getOrder } from '@/lib/api/orders';
import { requirePermission } from '@/utils/rbac';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import { logger } from '@/lib/logger';

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
  } catch (error: any) {
    const status = error?.message?.includes('Unauthorized') ? 403 : 500;
    logger.error(error as Error, { ...ctx, scope: 'api' });
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR', error.message || '조회 실패', {
      status,
      requestId: ctx.requestId,
    });
  }
}

