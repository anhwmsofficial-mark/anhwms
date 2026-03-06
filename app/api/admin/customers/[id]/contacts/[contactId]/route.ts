import { NextRequest } from 'next/server';
import { deactivateCustomerContactAction, updateCustomerContactAction } from '@/app/actions/admin/customer-details';
import { fail, ok } from '@/lib/api/response';

// 담당자 수정
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  const { id: customerId, contactId } = await params;
  const body = await req.json();
  const result = await updateCustomerContactAction(customerId, contactId, body, req);
  if (!result.ok) {
    return fail(result.code || 'INTERNAL_ERROR', result.error, { status: result.status || 500 });
  }
  return ok(result.data);
}

// 담당자 삭제 (실제로는 is_active = false)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  const { id: customerId, contactId } = await params;
  const result = await deactivateCustomerContactAction(customerId, contactId, req);
  if (!result.ok) {
    return fail(result.code || 'INTERNAL_ERROR', result.error, { status: result.status || 500 });
  }
  return ok(result.data);
}

