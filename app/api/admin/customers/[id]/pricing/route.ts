import { NextRequest } from 'next/server';
import { createCustomerPricingAction, listCustomerPricingAction } from '@/app/actions/admin/customer-details';
import { fail, ok } from '@/lib/api/response';

// 거래처 가격 정책 목록 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: customerId } = await params;
  const searchParams = req.nextUrl.searchParams;
  const activeOnly = searchParams.get('active') !== 'false';
  const result = await listCustomerPricingAction(customerId, { activeOnly }, req);
  if (!result.ok) {
    return fail(result.code || 'INTERNAL_ERROR', result.error, { status: result.status || 500 });
  }
  return ok(result.data);
}

// 거래처 가격 정책 추가
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: customerId } = await params;
  const body = await req.json();
  const result = await createCustomerPricingAction(customerId, body, req);
  if (!result.ok) {
    return fail(result.code || 'INTERNAL_ERROR', result.error, { status: result.status || 500 });
  }
  return ok(result.data, { status: 201 });
}

