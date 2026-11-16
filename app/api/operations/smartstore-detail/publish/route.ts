import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { guardSmartstoreDetail, smartstoreErrorResponse } from '@/src/features/smartstore-detail/guard';
import { publishDetailJob } from '@/src/features/smartstore-detail/service';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const access = await guardSmartstoreDetail(request, '/api/operations/smartstore-detail/publish');
  if (access.error) return access.error;
  try {
    const body = await request.json() as { jobId?: string };
    const jobId = String(body.jobId || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(jobId)) return fail('BAD_REQUEST', '작업 ID가 필요합니다.', { status: 400 });
    const job = await publishDetailJob({
      jobId,
      actorId: access.actorId || '',
      audit: access.audit || undefined,
    });
    return ok(job);
  } catch (error) {
    return smartstoreErrorResponse(error);
  }
}
