import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { guardSmartstoreDetail, smartstoreErrorResponse } from '@/src/features/smartstore-detail/guard';
import { changePublishLimit } from '@/src/features/smartstore-detail/service';

export async function POST(request: NextRequest) {
  const access = await guardSmartstoreDetail(request, '/api/operations/smartstore-detail/limit');
  if (access.error) return access.error;
  try {
    const body = await request.json() as { publishLimit?: number | null };
    const publishLimit = body.publishLimit;
    if (publishLimit !== 1 && publishLimit !== 5 && publishLimit !== null) {
      return fail('BAD_REQUEST', '반영 범위는 1개, 5개 또는 전체만 선택할 수 있습니다.', { status: 400 });
    }
    const result = await changePublishLimit({
      publishLimit,
      audit: access.audit || undefined,
    });
    return ok(result);
  } catch (error) {
    return smartstoreErrorResponse(error);
  }
}
