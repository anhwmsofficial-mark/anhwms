 
import { NextRequest } from 'next/server';
import { QuoteInquiryStatus } from '@/types';
import { listAdminQuoteInquiries } from '@/lib/api/adminQuoteInquiries';
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
    console.error('[GET /api/admin/quote-inquiries] error:', error);
    if (error instanceof Error && /Unauthorized:/i.test(error.message)) {
      return fail('FORBIDDEN', '견적 문의 조회 권한이 없습니다.', { status: 403 });
    }
    return fail('INTERNAL_ERROR', '견적 문의 목록 조회에 실패했습니다.', { status: 500 });
  }
}

