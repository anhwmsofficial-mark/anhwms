/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server';
import { callDocument } from '@/lib/cs/functionsClient';
import { requirePermission } from '@/utils/rbac';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const ctx = getRouteContext(request, 'POST /api/cs/document');
  try {
    await requirePermission('read:orders', request);
    const body = await request.json();
    const orderNo = body?.orderNo;

    if (!orderNo) {
      return fail('BAD_REQUEST', 'orderNo 필드는 필수입니다.', {
        status: 400,
        requestId: ctx.requestId,
      });
    }

    const documentType = body?.documentType;
    const data = await callDocument({ orderNo, documentType });
    return ok(data, { requestId: ctx.requestId });
  } catch (error: any) {
    const status = error?.message?.includes('Unauthorized') ? 403 : 500;
    logger.error(error as Error, { ...ctx, scope: 'api' });
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR', '문서 링크 조회 중 오류가 발생했습니다.', {
      status,
      requestId: ctx.requestId,
      details: error?.message ?? error,
    });
  }
}
