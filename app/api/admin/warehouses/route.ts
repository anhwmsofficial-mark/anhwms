 
import { NextRequest } from 'next/server';
import { createWarehouseAction, listWarehousesAction } from '@/app/actions/admin/warehouses';
import { fail, ok } from '@/lib/api/response';

// GET: 창고 목록 조회
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const result = await listWarehousesAction(
    {
      page: Number(searchParams.get('page') || 1),
      limit: Number(searchParams.get('limit') || 20),
      search: searchParams.get('search') || '',
      type: searchParams.get('type') || '',
      status: searchParams.get('status') || 'ACTIVE',
    },
    request,
  );
  if (!result.ok) {
    return fail(result.code || 'INTERNAL_ERROR', result.error, { status: result.status || 500 });
  }
  return ok(result.data);
}

// POST: 창고 생성
export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await createWarehouseAction(body, request);
  if (!result.ok) {
    return fail(result.code || 'INTERNAL_ERROR', result.error, { status: result.status || 500 });
  }
  return ok(result.data, { status: 201 });
}

