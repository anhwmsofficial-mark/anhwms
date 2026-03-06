import { NextRequest } from 'next/server';
import { createUserAction, listUsersAction } from '@/app/actions/admin/users';
import { fail, getRouteContext, ok } from '@/lib/api/response';

export async function GET() {
  const result = await listUsersAction();
  if (!result.ok) {
    return fail(result.code || 'INTERNAL_ERROR', result.error, { status: result.status || 500 });
  }
  return ok(result.data);
}

export async function POST(request: NextRequest) {
  const ctx = getRouteContext(request, 'POST /api/admin/users');
  const body = await request.json();
  const result = await createUserAction(body);
  if (!result.ok) {
    return fail(result.code || 'INTERNAL_ERROR', result.error, {
      status: result.status || 500,
      requestId: ctx.requestId,
    });
  }
  return ok(result.data, { status: 201, requestId: ctx.requestId });
}

