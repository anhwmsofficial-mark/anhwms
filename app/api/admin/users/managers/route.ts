import { NextRequest } from 'next/server';
import { listManagerUsersAction } from '@/app/actions/admin/users';
import { fail, ok } from '@/lib/api/response';

export async function GET(_request: NextRequest) {
  const result = await listManagerUsersAction();
  if (!result.ok) {
    return fail(result.code || 'INTERNAL_ERROR', result.error, { status: result.status || 500 });
  }
  return ok(result.data);
}
