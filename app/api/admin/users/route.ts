import { NextRequest } from 'next/server';
import { createUserAction, listUserOrgsAction, listUsersAction } from '@/app/actions/admin/users';
import { fail, getRouteContext, ok } from '@/lib/api/response';

export async function GET() {
  const [usersResult, orgsResult] = await Promise.all([listUsersAction(), listUserOrgsAction()]);
  if (!usersResult.ok) {
    return fail(usersResult.code || 'INTERNAL_ERROR', usersResult.error, { status: usersResult.status || 500 });
  }
  if (!orgsResult.ok) {
    return fail(orgsResult.code || 'INTERNAL_ERROR', orgsResult.error, { status: orgsResult.status || 500 });
  }
  return ok({
    users: usersResult.data.users,
    orgs: orgsResult.data.orgs,
  });
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

