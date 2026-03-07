import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureAdminUserAccess, ensurePermission } from '@/lib/actions/auth';
import { AppApiError } from '@/lib/api/errors';
import { createAdminClient } from '@/utils/supabase/admin';

type DbLike = SupabaseClient | { from: (table: string) => any };

type AdminRouteContext = {
  db: SupabaseClient;
  userId: string;
  orgId: string;
  role: string | null;
};

type ReceiptOwnership = {
  id: string;
  org_id: string | null;
};

type WarehouseOwnership = {
  id: string;
  org_id: string | null;
};

type CustomerOwnership = {
  id: string;
  name: string | null;
  org_id: string | null;
};

type ProductOwnership = {
  id: string;
  customer_id: string | null;
};

function toAppApiErrorFromAction(result: {
  ok: false;
  error?: string;
  code?: string;
  status?: number;
}): never {
  throw new AppApiError({
    error: result.error || '권한 확인에 실패했습니다.',
    code: result.code || 'FORBIDDEN',
    status: result.status || 403,
  });
}

export async function requireAdminRouteContext(
  permission: string,
  request?: Request,
): Promise<AdminRouteContext> {
  const access = await ensureAdminUserAccess();
  if (!access.ok) {
    toAppApiErrorFromAction(access);
  }
  const accessData = access.data;

  const permissionResult = await ensurePermission(permission, request);
  if (!permissionResult.ok) {
    toAppApiErrorFromAction(permissionResult);
  }

  const orgId = accessData.profile.org_id;
  if (!orgId) {
    throw new AppApiError({
      error: '조직 정보가 없는 계정은 이 작업을 수행할 수 없습니다.',
      code: 'FORBIDDEN',
      status: 403,
    });
  }

  return {
    db: createAdminClient() as unknown as SupabaseClient,
    userId: accessData.user.id,
    orgId,
    role: accessData.profile.role,
  };
}

export async function assertReceiptBelongsToOrg(
  db: DbLike,
  receiptId: string,
  orgId: string,
): Promise<ReceiptOwnership> {
  const { data, error } = await db
    .from('inbound_receipts')
    .select('id, org_id')
    .eq('id', receiptId)
    .maybeSingle();

  if (error) {
    throw new AppApiError({ error: error.message, code: 'INTERNAL_ERROR', status: 500 });
  }
  if (!data) {
    throw new AppApiError({ error: '대상 인수증을 찾을 수 없습니다.', code: 'NOT_FOUND', status: 404 });
  }
  if (!data.org_id || data.org_id !== orgId) {
    throw new AppApiError({
      error: '현재 조직의 자원만 처리할 수 있습니다.',
      code: 'FORBIDDEN',
      status: 403,
    });
  }

  return data as ReceiptOwnership;
}

export async function assertWarehouseBelongsToOrg(
  db: DbLike,
  warehouseId: string,
  orgId: string,
): Promise<WarehouseOwnership> {
  const { data, error } = await db
    .from('warehouse')
    .select('id, org_id')
    .eq('id', warehouseId)
    .maybeSingle();

  if (error) {
    throw new AppApiError({ error: error.message, code: 'INTERNAL_ERROR', status: 500 });
  }
  if (!data) {
    throw new AppApiError({ error: '창고를 찾을 수 없습니다.', code: 'NOT_FOUND', status: 404 });
  }
  if (!data.org_id || data.org_id !== orgId) {
    throw new AppApiError({
      error: '현재 조직의 창고만 사용할 수 있습니다.',
      code: 'FORBIDDEN',
      status: 403,
    });
  }

  return data as WarehouseOwnership;
}

export async function resolveCustomerWithinOrg(
  db: DbLike,
  rawCustomerId: string,
  orgId: string,
): Promise<CustomerOwnership> {
  const trimmedId = rawCustomerId.trim();
  if (!trimmedId) {
    throw new AppApiError({ error: 'customer_id가 필요합니다.', code: 'BAD_REQUEST', status: 400 });
  }

  const { data: directCustomer, error: customerError } = await db
    .from('customer_master')
    .select('id, name, org_id')
    .eq('id', trimmedId)
    .maybeSingle();

  if (customerError) {
    throw new AppApiError({ error: customerError.message, code: 'INTERNAL_ERROR', status: 500 });
  }
  if (directCustomer) {
    if (!directCustomer.org_id || directCustomer.org_id !== orgId) {
      throw new AppApiError({
        error: '현재 조직의 고객사만 처리할 수 있습니다.',
        code: 'FORBIDDEN',
        status: 403,
      });
    }
    return directCustomer as CustomerOwnership;
  }

  const { data: partner, error: partnerError } = await db
    .from('partners')
    .select('id, name')
    .eq('id', trimmedId)
    .maybeSingle();

  if (partnerError) {
    throw new AppApiError({ error: partnerError.message, code: 'INTERNAL_ERROR', status: 500 });
  }
  if (!partner?.name) {
    throw new AppApiError({ error: '고객사를 찾을 수 없습니다.', code: 'NOT_FOUND', status: 404 });
  }

  const { data: mappedCustomer, error: mappedCustomerError } = await db
    .from('customer_master')
    .select('id, name, org_id')
    .eq('name', partner.name)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (mappedCustomerError) {
    throw new AppApiError({ error: mappedCustomerError.message, code: 'INTERNAL_ERROR', status: 500 });
  }
  if (!mappedCustomer) {
    throw new AppApiError({ error: '고객사를 찾을 수 없습니다.', code: 'NOT_FOUND', status: 404 });
  }
  if (!mappedCustomer.org_id || mappedCustomer.org_id !== orgId) {
    throw new AppApiError({
      error: '현재 조직의 고객사만 처리할 수 있습니다.',
      code: 'FORBIDDEN',
      status: 403,
    });
  }

  return mappedCustomer as CustomerOwnership;
}

export async function assertProductBelongsToOrg(
  db: DbLike,
  productId: string,
  orgId: string,
): Promise<ProductOwnership> {
  const { data: product, error: productError } = await db
    .from('products')
    .select('id, customer_id')
    .eq('id', productId)
    .maybeSingle();

  if (productError) {
    throw new AppApiError({ error: productError.message, code: 'INTERNAL_ERROR', status: 500 });
  }
  if (!product) {
    throw new AppApiError({ error: '상품을 찾을 수 없습니다.', code: 'NOT_FOUND', status: 404 });
  }
  if (!product.customer_id) {
    throw new AppApiError({
      error: '조직에 연결되지 않은 상품은 처리할 수 없습니다.',
      code: 'FORBIDDEN',
      status: 403,
    });
  }

  await resolveCustomerWithinOrg(db, String(product.customer_id), orgId);
  return product as ProductOwnership;
}

export async function assertProductIdsBelongToOrg(
  db: DbLike,
  productIds: string[],
  orgId: string,
) {
  const uniqueIds = Array.from(new Set(productIds.map((value) => value.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) return;

  const { data: products, error: productError } = await db
    .from('products')
    .select('id, customer_id')
    .in('id', uniqueIds);

  if (productError) {
    throw new AppApiError({ error: productError.message, code: 'INTERNAL_ERROR', status: 500 });
  }

  const productMap = new Map(
    ((products || []) as ProductOwnership[]).map((product) => [String(product.id), String(product.customer_id || '')]),
  );

  const customerIds = Array.from(new Set(Array.from(productMap.values()).filter(Boolean)));
  const { data: customers, error: customerError } = await db
    .from('customer_master')
    .select('id, org_id')
    .in('id', customerIds);

  if (customerError) {
    throw new AppApiError({ error: customerError.message, code: 'INTERNAL_ERROR', status: 500 });
  }

  const customerOrgMap = new Map(
    ((customers || []) as Array<{ id: string; org_id: string | null }>).map((customer) => [
      String(customer.id),
      String(customer.org_id || ''),
    ]),
  );

  for (const productId of uniqueIds) {
    const customerId = productMap.get(productId);
    if (!customerId) {
      throw new AppApiError({ error: '상품을 찾을 수 없습니다.', code: 'NOT_FOUND', status: 404 });
    }
    if (customerOrgMap.get(customerId) !== orgId) {
      throw new AppApiError({
        error: '현재 조직의 상품만 처리할 수 있습니다.',
        code: 'FORBIDDEN',
        status: 403,
      });
    }
  }
}
