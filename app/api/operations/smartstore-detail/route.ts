import { NextRequest } from 'next/server';
import { ok } from '@/lib/api/response';
import { guardSmartstoreDetail, smartstoreErrorResponse } from '@/src/features/smartstore-detail/guard';
import { getSmartstoreOverview } from '@/src/features/smartstore-detail/service';

export async function GET(request: NextRequest) {
  const access = await guardSmartstoreDetail(request, '/api/operations/smartstore-detail');
  if (access.error) return access.error;
  try {
    const overview = await getSmartstoreOverview(access.audit || undefined);
    return ok(overview);
  } catch (error) {
    return smartstoreErrorResponse(error);
  }
}
