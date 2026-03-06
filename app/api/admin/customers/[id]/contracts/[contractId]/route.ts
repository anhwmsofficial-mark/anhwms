import { NextRequest } from 'next/server';
import { deleteCustomerContractAction, updateCustomerContractAction } from '@/app/actions/admin/customer-details';
import { fail, ok } from '@/lib/api/response';

// 계약 수정
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contractId: string }> }
) {
  const { id: customerId, contractId } = await params;
  const body = await req.json();
  const result = await updateCustomerContractAction(customerId, contractId, body, req);
  if (!result.ok) {
    return fail(result.code || 'INTERNAL_ERROR', result.error, { status: result.status || 500 });
  }
  return ok(result.data);
}

// 계약 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contractId: string }> }
) {
  const { id: customerId, contractId } = await params;
  const result = await deleteCustomerContractAction(customerId, contractId, req);
  if (!result.ok) {
    return fail(result.code || 'INTERNAL_ERROR', result.error, { status: result.status || 500 });
  }
  return ok(result.data);
}

