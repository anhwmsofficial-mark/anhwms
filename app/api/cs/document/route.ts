import { NextRequest } from 'next/server';
import { callDocument } from '@/lib/cs/functionsClient';
import { toAppApiError } from '@/lib/api/errors';
import { requirePermission } from '@/utils/rbac';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { getErrorMessage } from '@/lib/errorHandler';

type DocumentRequestBody = {
  orderNo?: string;
  documentType?: string;
};

type DocumentType = 'invoice' | 'packing_list' | 'outbound';

function toDocumentType(value: unknown): DocumentType | undefined {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'invoice' || normalized === 'packing_list' || normalized === 'outbound') {
    return normalized;
  }
  return undefined;
}

export async function POST(request: NextRequest) {
  const ctx = getRouteContext(request, 'POST /api/cs/document');
  try {
    await requirePermission('read:orders', request);
    const body = await request.json() as DocumentRequestBody;
    const orderNo = body?.orderNo;

    if (!orderNo) {
      return fail('BAD_REQUEST', 'orderNo 필드는 필수입니다.', {
        status: 400,
        requestId: ctx.requestId,
      });
    }

    const documentType = toDocumentType(body?.documentType);
    const data = await callDocument({ orderNo, documentType });
    return ok(data, { requestId: ctx.requestId });
  } catch (error: unknown) {
    logger.error(error as Error, { ...ctx, scope: 'api' });
    const apiError = toAppApiError(error, {
      error: '문서 링크 조회 중 오류가 발생했습니다.',
      code: 'INTERNAL_ERROR',
      status: 500,
    });
    return fail(apiError.code || 'INTERNAL_ERROR', '문서 링크 조회 중 오류가 발생했습니다.', {
      status: apiError.status,
      requestId: ctx.requestId,
      details: getErrorMessage(error),
    });
  }
}
