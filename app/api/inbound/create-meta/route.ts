import { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { createTrackedAdminClient } from '@/utils/supabase/admin-client';
import { createClient } from '@/utils/supabase/server';

type InboundSelectOption = {
  id: string;
  name: string;
  code?: string | null;
};

function isSeededDailyWorkLogCustomer(code: string | null | undefined) {
  return Boolean(code?.startsWith('DWL_CLIENT_'));
}

function dedupeCustomerOptions(options: InboundSelectOption[]) {
  const byName = new Map<string, InboundSelectOption>();

  for (const option of options) {
    const existing = byName.get(option.name);
    if (!existing) {
      byName.set(option.name, option);
      continue;
    }

    const existingIsSeed = isSeededDailyWorkLogCustomer(existing.code);
    const nextIsSeed = isSeededDailyWorkLogCustomer(option.code);

    if (existingIsSeed && !nextIsSeed) {
      byName.set(option.name, option);
      continue;
    }

    if (existingIsSeed === nextIsSeed) {
      const existingCode = existing.code ?? '';
      const nextCode = option.code ?? '';
      if (nextCode.localeCompare(existingCode, 'en') < 0) {
        byName.set(option.name, option);
      }
    }
  }

  return Array.from(byName.values());
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return fail('UNAUTHORIZED', '인증이 필요합니다.', { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, can_access_admin, can_manage_inventory, status, org_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return fail('FORBIDDEN', '권한 정보를 확인할 수 없습니다.', { status: 403 });
    }

    if (profile.status && profile.status !== 'active') {
      return fail('FORBIDDEN', '계정이 비활성화되었습니다.', { status: 403 });
    }

    const allowedRoles = ['admin', 'manager', 'staff', 'operator'];
    const allowed =
      profile.can_manage_inventory ||
      profile.can_access_admin ||
      allowedRoles.includes(profile.role);

    if (!allowed) {
      return fail('FORBIDDEN', '재고/입고 권한이 없습니다.', { status: 403 });
    }

    const orgId = profile.org_id;
    if (!orgId) {
      return fail('FORBIDDEN', '사용자 조직 정보가 없습니다.', { status: 403 });
    }

    const db = createTrackedAdminClient({
      route: '/api/inbound/create-meta',
      action: 'GET',
      requestId: request.headers.get('x-request-id') || undefined,
    }) as any;

    const [customersResult, warehousesResult, managersResult] = await Promise.all([
      db
        .from('customer_master')
        .select('id, name, code')
        .eq('org_id', orgId)
        .eq('status', 'ACTIVE')
        .order('name', { ascending: true }),
      db
        .from('warehouse')
        .select('id, name')
        .eq('org_id', orgId)
        .eq('status', 'ACTIVE')
        .eq('type', 'ANH_OWNED')
        .order('name', { ascending: true }),
      db
        .from('user_profiles')
        .select('id, display_name, full_name, email, role, status, deleted_at, can_manage_orders, can_access_admin')
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('display_name', { ascending: true }),
    ]);

    if (customersResult.error) throw customersResult.error;
    if (warehousesResult.error) throw warehousesResult.error;
    if (managersResult.error) throw managersResult.error;

    const clients = dedupeCustomerOptions(
      (customersResult.data || []).map((row: { id: string; name: string | null; code?: string | null }) => ({
        id: String(row.id),
        name: String(row.name || '-'),
        code: row.code ?? null,
      })),
    ).map((row) => ({
      id: row.id,
      name: row.name,
    }));

    const warehouses = (warehousesResult.data || []).map((row: { id: string; name: string | null }) => ({
      id: String(row.id),
      name: String(row.name || '-'),
    }));

    const managers = (managersResult.data || [])
      .filter((manager: any) =>
        ['admin', 'manager', 'operator', 'staff'].includes(String(manager.role || '')) ||
        manager.can_manage_orders === true ||
        manager.can_access_admin === true,
      )
      .map((manager: any) => ({
        id: String(manager.id),
        name: manager.display_name || manager.full_name || manager.email?.split('@')[0] || 'Unknown',
      }));

    return ok({
      userOrgId: orgId,
      clients,
      warehouses,
      managers,
      defaultWarehouseId: warehouses[0]?.id || '',
    });
  } catch (error: any) {
    logger.error(error, { scope: 'inbound', action: 'GET /api/inbound/create-meta' });
    return fail('INTERNAL_ERROR', error?.message || '입고 등록 메타를 불러오는 중 오류가 발생했습니다.', {
      status: 500,
    });
  }
}
