 
import { NextRequest } from 'next/server';
import { QuoteInquiryStatus } from '@/types';
import { listAdminQuoteInquiries } from '@/lib/api/adminQuoteInquiries';
import { toAppApiError } from '@/lib/api/errors';
import { requirePermission } from '@/utils/rbac';
import { fail, ok } from '@/lib/api/response';

export async function GET(req: NextRequest) {
  try {
    await requirePermission('manage:orders', req);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') as QuoteInquiryStatus | null;
    const allInquiries = await listAdminQuoteInquiries({ status });
    return ok(allInquiries, { status: 200 });
  } catch (error) {
    const apiError = toAppApiError(error, {
      error: '견적 문의 목록 조회에 실패했습니다.',
      code: 'INTERNAL_ERROR',
      status: 500,
    });
    return fail(apiError.code || 'INTERNAL_ERROR', apiError.message, {
      status: apiError.status,
      details: apiError.details,
    });
  }
}

