import { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/api/response';
import { guardSmartstoreDetail, smartstoreErrorResponse } from '@/src/features/smartstore-detail/guard';
import { recordCenterPublish } from '@/src/features/smartstore-detail/service';

type ResultInput = {
  channelProductNo?: string;
  status?: string;
  beforeHtml?: string | null;
  errorMessage?: string | null;
};

export async function POST(request: NextRequest) {
  const access = await guardSmartstoreDetail(request, '/api/operations/smartstore-detail/record');
  if (access.error) return access.error;
  try {
    const body = await request.json() as { jobId?: string; results?: ResultInput[] };
    const jobId = String(body.jobId || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(jobId)) return fail('BAD_REQUEST', '작업 ID가 필요합니다.', { status: 400 });
    const results = Array.isArray(body.results) ? body.results : [];
    const job = await recordCenterPublish({
      jobId,
      actorId: access.actorId || '',
      audit: access.audit || undefined,
      results: results.map((result) => ({
        channelProductNo: String(result.channelProductNo || ''),
        status: result.status === 'published' ? 'published' : 'failed',
        beforeHtml: result.beforeHtml ?? null,
        errorMessage: result.errorMessage ?? null,
      })),
    });
    return ok(job);
  } catch (error) {
    return smartstoreErrorResponse(error);
  }
}
