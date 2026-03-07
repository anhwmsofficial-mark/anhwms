import { NextRequest } from 'next/server';
import { createCustomerAction, listCustomersAction } from '@/app/actions/admin/customers';
import { fail, ok } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';

// GET: 고객사 목록 조회
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const result = await listCustomersAction({
    page: Number(searchParams.get('page') || 1),
    limit: Number(searchParams.get('limit') || 20),
    search: searchParams.get('search') || '',
    type: searchParams.get('type') || '',
    status: searchParams.get('status') || 'ACTIVE',
  }, request);

  if (!result.ok) {
    return fail(result.code || ERROR_CODES.INTERNAL_ERROR, result.error, { status: result.status || 500 });
  }

  return ok(result.data);
}

// POST: 고객사 생성
export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await createCustomerAction(body, request);

  if (!result.ok) {
    return fail(result.code || ERROR_CODES.INTERNAL_ERROR, result.error, { status: result.status || 500 });
  }

  return ok(result.data, { status: 201 });
}

