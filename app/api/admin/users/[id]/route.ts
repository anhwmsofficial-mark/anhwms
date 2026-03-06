import { NextRequest } from 'next/server';
import { deleteUserAction, updateUserAction, userMutationAction } from '@/app/actions/admin/users';
import { fail, getRouteContext, ok } from '@/lib/api/response';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = getRouteContext(request, 'PUT /api/admin/users/[id]');
  const body = await request.json();
  const { id } = await params;
  const result = await updateUserAction(id, body, request);
  if (!result.ok) {
    return fail(result.code || 'INTERNAL_ERROR', result.error, {
      status: result.status || 500,
      requestId: ctx.requestId,
    });
  }
  return ok(result.data, { requestId: ctx.requestId });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = getRouteContext(request, 'DELETE /api/admin/users/[id]');
  const { id } = await params;
  const result = await deleteUserAction(id, request);
  if (!result.ok) {
    return fail(result.code || 'INTERNAL_ERROR', result.error, {
      status: result.status || 500,
      requestId: ctx.requestId,
    });
  }
  return ok(result.data, { requestId: ctx.requestId });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = getRouteContext(request, 'POST /api/admin/users/[id]');
  const { id } = await params;
  const body = await request.json();
  const action = body?.action;
  if (!action || !['restore', 'unlock'].includes(action)) {
    return fail('BAD_REQUEST', 'Invalid action', { status: 400, requestId: ctx.requestId });
  }
  const result = await userMutationAction(id, action, request);
  if (!result.ok) {
    return fail(result.code || 'INTERNAL_ERROR', result.error, {
      status: result.status || 500,
      requestId: ctx.requestId,
    });
  }
  return ok(result.data, { requestId: ctx.requestId });
}

