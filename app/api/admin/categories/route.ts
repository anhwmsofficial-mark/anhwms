import { NextRequest } from 'next/server';
import { listProductCategoriesAction } from '@/app/actions/admin/categories';
import { fail, ok } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const result = await listProductCategoriesAction(request);
  if (!result.ok) {
    return fail(result.code || 'INTERNAL_ERROR', result.error, { status: result.status || 500 });
  }
  return ok(result.data);
}
