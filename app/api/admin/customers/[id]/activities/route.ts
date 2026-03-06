import { NextRequest } from 'next/server';
import { createCustomerActivityAction, listCustomerActivitiesAction } from '@/app/actions/admin/customer-details';
import { fail, ok } from '@/lib/api/response';

// 거래처 활동 이력 목록 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: customerId } = await params;
  const searchParams = req.nextUrl.searchParams;
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit') || '50', 10) : 50;
  const result = await listCustomerActivitiesAction(customerId, { limit }, req);
  if (!result.ok) {
    return fail(result.code || 'INTERNAL_ERROR', result.error, { status: result.status || 500 });
  }
  return ok(result.data);
}

// 거래처 활동 이력 추가
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: customerId } = await params;
  const body = await req.json();
  const result = await createCustomerActivityAction(customerId, body, req);
  if (!result.ok) {
    return fail(result.code || 'INTERNAL_ERROR', result.error, { status: result.status || 500 });
  }
  return ok(result.data, { status: 201 });
}

