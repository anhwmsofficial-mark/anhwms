import { NextRequest } from 'next/server';
import { getInquiryActionLogs } from '@/lib/api/actionLogs';
import { requirePermission } from '@/utils/rbac';
import { fail, ok } from '@/lib/api/response';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission('manage:orders', req);
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const inquiryType = (searchParams.get('type') ?? 'external') as 'external' | 'international';

    if (!['external', 'international'].includes(inquiryType)) {
      return fail('BAD_REQUEST', 'Invalid inquiry type', { status: 400 });
    }

    const logs = await getInquiryActionLogs(id, inquiryType);
    return ok(logs, { status: 200 });
  } catch (error) {
    console.error('[GET /api/admin/quote-inquiries/[id]/activity] error:', error);
    return fail('INTERNAL_ERROR', '활동 로그 조회에 실패했습니다.', { status: 500 });
  }
}
