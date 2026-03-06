import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClientOption, ManagerOption, WarehouseOption } from '@/src/features/inbound/new/form/schema';
import { listCustomersAction } from '@/app/actions/admin/customers';
import { listManagerUsersAction } from '@/app/actions/admin/users';

interface FetchMetaResult {
  userOrgId: string | null;
  clients: ClientOption[];
  warehouses: WarehouseOption[];
  managers: ManagerOption[];
  defaultWarehouseId: string;
}

export async function fetchInboundMeta(supabase: SupabaseClient): Promise<FetchMetaResult> {
  let userOrgId: string | null = null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: orgs } = await supabase.from('org').select('id').limit(1);
    if (orgs && orgs.length > 0) userOrgId = orgs[0].id;
  }

  const customersResult = await listCustomersAction({ status: 'ACTIVE', limit: 2000 });
  const clientList: ClientOption[] = customersResult.ok
    ? (customersResult.data.data || []).map((row: any) => ({
        id: String(row.id ?? row.customer_id ?? ''),
        name: String(row.name ?? row.customer_name ?? row.code ?? ''),
      }))
    : [];

  const { data: whData } = await supabase
    .from('warehouse')
    .select('id, name')
    .eq('status', 'ACTIVE')
    .eq('type', 'ANH_OWNED')
    .order('name');

  const warehouses = whData || [];
  const defaultWarehouseId = whData && whData.length > 0 ? whData[0].id : '';

  let managers: ManagerOption[] = [];
  try {
    const result = await listManagerUsersAction();
    if (result.ok) {
      managers = result.data.data || [];
    }
  } catch (e) {
    console.error('Failed to fetch managers', e);
  }

  return {
    userOrgId,
    clients: clientList,
    warehouses,
    managers,
    defaultWarehouseId,
  };
}
