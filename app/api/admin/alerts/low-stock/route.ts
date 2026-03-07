import { NextRequest } from 'next/server';
import { createTrackedAdminClient } from '@/utils/supabase/admin-client';
import { checkLowStock } from '@/lib/alerts/lowStock';
import { requirePermission } from '@/utils/rbac';
import { getErrorMessage } from '@/lib/errorHandler';
import { fail, ok } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  try {
    await requirePermission('manage:orders', request);
    const db = createTrackedAdminClient({ route: 'low_stock' });
    const result = await checkLowStock(db as any);
    return ok(result);
  } catch (error: unknown) {
    return fail('INTERNAL_ERROR', getErrorMessage(error) || '재고 부족 경보 실패', { status: 500 });
  }
}
