import { NextRequest } from 'next/server';
import { requireAdminRouteContext } from '@/lib/server/admin-ownership';
import { fail, ok } from '@/lib/api/response';
import { ERROR_CODES } from '@/lib/api/errors';

export async function GET(request: NextRequest) {
  try {
    // 1. Admin Context 확보 (Service Role DB + Org ID)
    // - createAdminClient 직접 호출 대신 requireAdminRouteContext 사용
    // - ensureAdminUserAccess + ensurePermission이 내부적으로 수행됨
    const { db, orgId } = await requireAdminRouteContext('manage:orders', request);
    
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('product_id');

    if (!productId) {
      return fail(ERROR_CODES.BAD_REQUEST, 'product_id가 필요합니다.', { status: 400 });
    }

    // 2. Tenant Scoped Query
    // - Admin Client를 사용하더라도 tenant_id 조건을 강제하여 논리적 격리 수행
    // - 추후 RLS 기반 User Client로 전환 시에도 안전함
    const { data, error } = await db
      .from('inventory_ledger')
      .select('movement_type, direction, quantity, transaction_type, qty_change, balance_after, reference_type, reference_id, memo, notes, created_at')
      .eq('product_id', productId)
      .eq('tenant_id', orgId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return fail(ERROR_CODES.INTERNAL_ERROR, error.message, { status: 500 });
    }

    return ok(data || []);
  } catch (error: any) {
    return fail(
      error.code || ERROR_CODES.INTERNAL_ERROR,
      error.message || '재고 수불부 조회 실패',
      { status: error.status || 500 }
    );
  }
}
