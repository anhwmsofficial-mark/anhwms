/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server';
import { getLogisticsLogs } from '@/lib/api/orders';
import { requirePermission } from '@/utils/rbac';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import { logger } from '@/lib/logger';

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
  } catch (error: any) {
    const status = error?.message?.includes('Unauthorized') ? 403 : 500;
    logger.error(error as Error, { ...ctx, scope: 'api' });
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR', error.message || '조회 실패', {
      status,
      requestId: ctx.requestId,
    });
  }
}

