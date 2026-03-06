import { NextRequest } from 'next/server';
import { createLocationAction, listLocationsAction } from '@/app/actions/admin/locations';
import { fail, ok } from '@/lib/api/response';

// GET: 로케이션 목록 조회
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const result = await listLocationsAction(
    {
      warehouseId: searchParams.get('warehouseId') || '',
      status: searchParams.get('status') || 'ACTIVE',
      search: searchParams.get('search') || '',
    },
    request,
  );
  if (!result.ok) {
    return fail(result.code || 'INTERNAL_ERROR', result.error, { status: result.status || 500 });
  }
  return ok(result.data);
}

// POST: 로케이션 생성
export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await createLocationAction(body, request);
  if (!result.ok) {
    return fail(result.code || 'INTERNAL_ERROR', result.error, { status: result.status || 500 });
  }
  return ok(result.data, { status: 201 });
}
