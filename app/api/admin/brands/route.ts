import { NextRequest } from 'next/server';
import { createBrandAction, listBrandsAction } from '@/app/actions/admin/brands';
import { fail, ok } from '@/lib/api/response';

// GET: 브랜드 목록 조회
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const result = await listBrandsAction(
    {
      page: Number(searchParams.get('page') || 1),
      limit: Number(searchParams.get('limit') || 20),
      search: searchParams.get('search') || '',
      customer_id: searchParams.get('customer_id') || '',
      status: searchParams.get('status') || 'ACTIVE',
    },
    request,
  );
  if (!result.ok) {
    return fail(result.code || 'INTERNAL_ERROR', result.error, { status: result.status || 500 });
  }
  return ok(result.data);
}

// POST: 브랜드 생성
export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await createBrandAction(body, request);
  if (!result.ok) {
    return fail(result.code || 'INTERNAL_ERROR', result.error, { status: result.status || 500 });
  }
  return ok(result.data, { status: 201 });
}

