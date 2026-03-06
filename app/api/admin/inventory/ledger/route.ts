import { NextRequest } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { requirePermission } from '@/utils/rbac';
import { fail, ok } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  await requirePermission('manage:orders', request);
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('product_id');
  if (!productId) {
    return fail('BAD_REQUEST', 'product_id가 필요합니다.', { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('inventory_ledger')
    .select('movement_type, direction, quantity, transaction_type, qty_change, balance_after, reference_type, reference_id, memo, notes, created_at')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return fail('INTERNAL_ERROR', error.message, { status: 500 });
  }

  return ok(data || []);
}
