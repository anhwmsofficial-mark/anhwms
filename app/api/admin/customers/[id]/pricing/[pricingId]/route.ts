import { NextRequest } from 'next/server';
import { deleteCustomerPricingAction, updateCustomerPricingAction } from '@/app/actions/admin/customer-details';
import { fail, ok } from '@/lib/api/response';

// 가격 정책 수정
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pricingId: string }> }
) {
  const { id: customerId, pricingId } = await params;
  const body = await req.json();
  const result = await updateCustomerPricingAction(customerId, pricingId, body, req);
  if (!result.ok) {
    return fail(result.code || 'INTERNAL_ERROR', result.error, { status: result.status || 500 });
  }
  return ok(result.data);
}

// 가격 정책 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pricingId: string }> }
) {
  const { id: customerId, pricingId } = await params;
  const result = await deleteCustomerPricingAction(customerId, pricingId, req);
  if (!result.ok) {
    return fail(result.code || 'INTERNAL_ERROR', result.error, { status: result.status || 500 });
  }
  return ok(result.data);
}

