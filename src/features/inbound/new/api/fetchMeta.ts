import type { ClientOption, ManagerOption, WarehouseOption } from '@/src/features/inbound/new/form/schema';

interface FetchMetaResult {
  userOrgId: string | null;
  clients: ClientOption[];
  warehouses: WarehouseOption[];
  managers: ManagerOption[];
  defaultWarehouseId: string;
}

export async function fetchInboundMeta(): Promise<FetchMetaResult> {
  const response = await fetch('/api/inbound/create-meta', {
    method: 'GET',
    cache: 'no-store',
  });
  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.ok) {
    return {
      userOrgId: null,
      clients: [],
      warehouses: [],
      managers: [],
      defaultWarehouseId: '',
    };
  }

  const data = result.data || {};
  return {
    userOrgId: data.userOrgId as string | null,
    clients: data.clients as ClientOption[],
    warehouses: data.warehouses as WarehouseOption[],
    managers: data.managers as ManagerOption[],
    defaultWarehouseId: data.defaultWarehouseId as string,
  };
}
