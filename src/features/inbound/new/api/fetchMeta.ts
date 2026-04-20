import type { ClientOption, ManagerOption, WarehouseOption } from '@/src/features/inbound/new/form/schema';
import { getInboundCreateMeta } from '@/app/actions/inbound';

interface FetchMetaResult {
  userOrgId: string | null;
  clients: ClientOption[];
  warehouses: WarehouseOption[];
  managers: ManagerOption[];
  defaultWarehouseId: string;
}

export async function fetchInboundMeta(): Promise<FetchMetaResult> {
  const result = await getInboundCreateMeta();

  if ('error' in result) {
    return {
      userOrgId: null,
      clients: [],
      warehouses: [],
      managers: [],
      defaultWarehouseId: '',
    };
  }

  return {
    userOrgId: result.data.userOrgId as string | null,
    clients: result.data.clients as ClientOption[],
    warehouses: result.data.warehouses as WarehouseOption[],
    managers: result.data.managers as ManagerOption[],
    defaultWarehouseId: result.data.defaultWarehouseId as string,
  };
}
