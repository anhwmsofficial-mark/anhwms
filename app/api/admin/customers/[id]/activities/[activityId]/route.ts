import { NextRequest } from 'next/server';
import { deleteCustomerActivityAction, updateCustomerActivityAction } from '@/app/actions/admin/customer-details';
import { fail, ok } from '@/lib/api/response';

// 활동 이력 수정
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  const { id: customerId, activityId } = await params;
  const body = await req.json();
  const result = await updateCustomerActivityAction(customerId, activityId, body, req);
  if (!result.ok) {
    return fail(result.code || 'INTERNAL_ERROR', result.error, { status: result.status || 500 });
  }
  return ok(result.data);
}

// 활동 이력 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  const { id: customerId, activityId } = await params;
  const result = await deleteCustomerActivityAction(customerId, activityId, req);
  if (!result.ok) {
    return fail(result.code || 'INTERNAL_ERROR', result.error, { status: result.status || 500 });
  }
  return ok(result.data);
}

