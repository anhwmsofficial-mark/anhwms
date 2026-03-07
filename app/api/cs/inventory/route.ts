import { NextRequest } from 'next/server';
import { callInventoryBySku } from '@/lib/cs/functionsClient';
import { toAppApiError } from '@/lib/api/errors';
import { requirePermission } from '@/utils/rbac';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { getErrorMessage } from '@/lib/errorHandler';

type InventoryRequestBody = {
  sku?: string;
};

export async function POST(request: NextRequest) {
  const ctx = getRouteContext(request, 'POST /api/cs/inventory');
  try {
    await requirePermission('read:orders', request);
    const body = await request.json() as InventoryRequestBody;
    const sku = body?.sku;

    if (!sku) {
      return fail('BAD_REQUEST', 'sku 필드는 필수입니다.', {
        status: 400,
        requestId: ctx.requestId,
      });
    }

    const data = await callInventoryBySku({ sku });
    return ok(data, { requestId: ctx.requestId });
  } catch (error: unknown) {
    logger.error(error as Error, { ...ctx, scope: 'api' });
    const apiError = toAppApiError(error, {
      error: '재고 조회 중 오류가 발생했습니다.',
      code: 'INTERNAL_ERROR',
      status: 500,
    });
    return fail(apiError.code || 'INTERNAL_ERROR', '재고 조회 중 오류가 발생했습니다.', {
      status: apiError.status,
      requestId: ctx.requestId,
      details: getErrorMessage(error),
    });
  }
}
