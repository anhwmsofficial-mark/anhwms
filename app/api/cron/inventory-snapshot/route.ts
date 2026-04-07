import { createTrackedAdminClient } from '@/utils/supabase/admin-client';
import { fail, ok } from '@/lib/api/response';
import { requireCronSecret } from '@/lib/auth/cronGuard';
import { getErrorMessage } from '@/lib/errorHandler';

type DbLike = {
  from: (table: string) => any;
};

type OrgRow = {
  id: string;
};

type ProductRow = {
  id: string;
};

type LedgerRow = {
  product_id: string;
  qty_change: number | null;
  quantity: number | null;
  direction: 'IN' | 'OUT' | null;
  created_at: string;
};

type SnapshotRow = {
  product_id: string;
  closing_stock: number | null;
  snapshot_date: string;
};

const JOB_NAME = 'inventory_snapshot';
const MAX_ATTEMPTS = 3;
const RETRY_MINUTES = 15;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function isMissingColumnError(error: { message?: string } | null | undefined, columnName: string) {
  return Boolean(
    error?.message &&
      (error.message.includes(`column "${columnName}" does not exist`) ||
        error.message.includes(`column '${columnName}' does not exist`) ||
        error.message.includes(`column ${columnName} does not exist`))
  );
}

function toIsoDate(value?: string | null) {
  const normalized = String(value || '').trim().replace(/\./g, '-').replace(/\//g, '-');
  if (!normalized) {
    const nowKst = new Date(Date.now() + KST_OFFSET_MS);
    nowKst.setUTCDate(nowKst.getUTCDate() - 1);
    return nowKst.toISOString().slice(0, 10);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;

  const yearFirstMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (yearFirstMatch) {
    const [, year, month, day] = yearFirstMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const monthFirstMatch = normalized.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (monthFirstMatch) {
    const [, month, day, year] = monthFirstMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  throw new Error('date는 YYYY-MM-DD 또는 MM/DD/YYYY 형식이어야 합니다.');
}

function startOfKstDayUtc(dateString: string) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - KST_OFFSET_MS);
}

function endOfKstDayUtc(dateString: string) {
  return new Date(startOfKstDayUtc(dateString).getTime() + 24 * 60 * 60 * 1000 - 1);
}

function toSignedDelta(row: LedgerRow) {
  if (typeof row.qty_change === 'number') return row.qty_change;
  const absolute = Math.abs(Number(row.quantity || 0));
  return row.direction === 'OUT' ? -absolute : absolute;
}

async function loadScopedProductIds(db: DbLike, tenantId: string) {
  const { data: customers, error: customerError } = await db
    .from('customer_master')
    .select('id')
    .eq('org_id', tenantId);

  if (customerError) {
    throw new Error(customerError.message);
  }

  const customerIds = ((customers || []) as Array<{ id: string }>).map((row) => row.id);
  if (customerIds.length === 0) return [] as string[];

  const { data: products, error: productError } = await db
    .from('products')
    .select('id')
    .in('customer_id', customerIds);

  if (productError) {
    throw new Error(productError.message);
  }

  return ((products || []) as ProductRow[]).map((row) => row.id);
}

async function loadLedgerRows(db: DbLike, tenantId: string, productIds: string[], endOfDayIso: string) {
  if (productIds.length === 0) return [] as LedgerRow[];

  const { data, error } = await db
    .from('inventory_ledger')
    .select('product_id, qty_change, quantity, direction, created_at')
    .eq('tenant_id', tenantId)
    .in('product_id', productIds)
    .lte('created_at', endOfDayIso)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as LedgerRow[];
}

async function loadDayLedgerRows(db: DbLike, tenantId: string, productIds: string[], dayStartIso: string, dayEndIso: string) {
  if (productIds.length === 0) return [] as LedgerRow[];

  const { data, error } = await db
    .from('inventory_ledger')
    .select('product_id, qty_change, quantity, direction, created_at')
    .eq('tenant_id', tenantId)
    .in('product_id', productIds)
    .gte('created_at', dayStartIso)
    .lte('created_at', dayEndIso)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as LedgerRow[];
}

async function loadLatestSnapshotsBeforeDate(db: DbLike, tenantId: string, productIds: string[], date: string) {
  if (productIds.length === 0) return new Map<string, number>();

  const { data, error } = await db
    .from('inventory_snapshot')
    .select('product_id, snapshot_date, closing_stock')
    .eq('tenant_id', tenantId)
    .in('product_id', productIds)
    .lt('snapshot_date', date)
    .order('product_id', { ascending: true })
    .order('snapshot_date', { ascending: false });

  if (error) {
    if (isMissingColumnError(error, 'snapshot_date') || isMissingColumnError(error, 'closing_stock')) {
      return new Map<string, number>();
    }
    throw new Error(error.message);
  }

  const map = new Map<string, number>();
  for (const row of (data || []) as SnapshotRow[]) {
    if (!map.has(row.product_id)) {
      map.set(row.product_id, Number(row.closing_stock || 0));
    }
  }
  return map;
}

async function loadLedgerClosingBeforeDayStart(db: DbLike, tenantId: string, productIds: string[], dayStartIso: string) {
  if (productIds.length === 0) return new Map<string, number>();

  const ledgerRows = await loadLedgerRows(db, tenantId, productIds, new Date(new Date(dayStartIso).getTime() - 1).toISOString());
  const map = new Map<string, number>();

  for (const productId of productIds) {
    map.set(productId, 0);
  }

  for (const row of ledgerRows) {
    map.set(row.product_id, (map.get(row.product_id) || 0) + toSignedDelta(row));
  }

  return map;
}

async function upsertSnapshots(
  db: DbLike,
  params: {
    date: string;
    tenantId: string;
    rows: Array<{
      product_id: string;
      opening_stock: number;
      total_in: number;
      total_out: number;
      closing_stock: number;
    }>;
  }
) {
  const fullPayload = params.rows.map((row) => ({
    snapshot_date: params.date,
    tenant_id: params.tenantId,
    product_id: row.product_id,
    opening_stock: row.opening_stock,
    total_in: row.total_in,
    total_out: row.total_out,
    closing_stock: row.closing_stock,
    updated_at: new Date().toISOString(),
  }));

  const { error: fullError } = await db
    .from('inventory_snapshot')
    .upsert(fullPayload, { onConflict: 'snapshot_date,tenant_id,product_id' });

  if (!fullError) {
    return { mode: 'full' as const };
  }

  const optionalColumnMissing =
    isMissingColumnError(fullError, 'opening_stock') ||
    isMissingColumnError(fullError, 'total_in') ||
    isMissingColumnError(fullError, 'total_out');

  if (!optionalColumnMissing) {
    throw new Error(fullError.message);
  }

  const fallbackPayload = params.rows.map((row) => ({
    snapshot_date: params.date,
    tenant_id: params.tenantId,
    product_id: row.product_id,
    closing_stock: row.closing_stock,
    updated_at: new Date().toISOString(),
  }));

  const { error: fallbackError } = await db
    .from('inventory_snapshot')
    .upsert(fallbackPayload, { onConflict: 'snapshot_date,tenant_id,product_id' });

  if (fallbackError) {
    throw new Error(fallbackError.message);
  }

  return { mode: 'closing_only' as const };
}

export async function GET(request: Request) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const startedAt = new Date();
  const db = createTrackedAdminClient({ route: 'cron_inventory_snapshot' });
  const dbUntyped = db as unknown as DbLike;
  let attempts = 1;
  let lastRun: { status?: string | null; attempts?: number | null; next_retry_at?: string | null } | null = null;

  try {
    const { searchParams } = new URL(request.url);
    const date = toIsoDate(searchParams.get('date'));
    const requestedTenantId = String(searchParams.get('tenant_id') || '').trim() || null;

    const { data } = await dbUntyped
      .from('cron_job_runs')
      .select('status, attempts, next_retry_at, started_at')
      .eq('job_name', JOB_NAME)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    lastRun = (data as unknown as { status?: string | null; attempts?: number | null; next_retry_at?: string | null } | null) || null;

    if (lastRun?.status === 'failed' && lastRun?.next_retry_at) {
      const nextRetryAt = new Date(lastRun.next_retry_at);
      if (Number.isFinite(nextRetryAt.getTime()) && nextRetryAt > new Date()) {
        await dbUntyped.from('cron_job_runs').insert({
          job_name: JOB_NAME,
          status: 'skipped',
          attempts: lastRun.attempts || 1,
          started_at: startedAt.toISOString(),
          finished_at: new Date().toISOString(),
          error_message: 'Backoff window active',
          meta: { reason: 'backoff', date, tenant_id: requestedTenantId },
        });
        return fail('BAD_REQUEST', 'Backoff active', { status: 429 });
      }
    }

    attempts =
      lastRun?.status === 'failed'
        ? Math.min((lastRun.attempts || 1) + 1, MAX_ATTEMPTS)
        : 1;

    const { data: orgRows, error: orgError } = requestedTenantId
      ? await dbUntyped.from('org').select('id').eq('id', requestedTenantId).limit(1)
      : await dbUntyped.from('org').select('id').eq('status', 'ACTIVE').order('created_at', { ascending: true });

    if (orgError) {
      throw new Error(orgError.message);
    }

    const orgIds = ((orgRows || []) as OrgRow[]).map((row) => row.id);
    const dayStartIso = startOfKstDayUtc(date).toISOString();
    const dayEndIso = endOfKstDayUtc(date).toISOString();

    let processedTenants = 0;
    let processedProducts = 0;
    let upsertedRows = 0;
    const modes = new Set<string>();

    for (const tenantId of orgIds) {
      const productIds = await loadScopedProductIds(dbUntyped, tenantId);
      if (productIds.length === 0) {
        processedTenants += 1;
        continue;
      }

      const dayLedgerRows = await loadDayLedgerRows(dbUntyped, tenantId, productIds, dayStartIso, dayEndIso);
      const previousSnapshotMap = await loadLatestSnapshotsBeforeDate(dbUntyped, tenantId, productIds, date);
      const missingBaselineProductIds = productIds.filter((productId) => !previousSnapshotMap.has(productId));
      const baselineFromLedgerMap = await loadLedgerClosingBeforeDayStart(
        dbUntyped,
        tenantId,
        missingBaselineProductIds,
        dayStartIso
      );

      const openingByProduct = new Map<string, number>();
      const dailyDeltaByProduct = new Map<string, number>();
      const totalInByProduct = new Map<string, number>();
      const totalOutByProduct = new Map<string, number>();

      for (const productId of productIds) {
        openingByProduct.set(
          productId,
          previousSnapshotMap.has(productId)
            ? Number(previousSnapshotMap.get(productId) || 0)
            : Number(baselineFromLedgerMap.get(productId) || 0)
        );
        dailyDeltaByProduct.set(productId, 0);
        totalInByProduct.set(productId, 0);
        totalOutByProduct.set(productId, 0);
      }

      for (const row of dayLedgerRows) {
        const delta = toSignedDelta(row);
        const productId = row.product_id;
        dailyDeltaByProduct.set(productId, (dailyDeltaByProduct.get(productId) || 0) + delta);
        if (delta >= 0) {
          totalInByProduct.set(productId, (totalInByProduct.get(productId) || 0) + delta);
        } else {
          totalOutByProduct.set(productId, (totalOutByProduct.get(productId) || 0) + Math.abs(delta));
        }
      }

      const snapshotRows = productIds.map((productId) => {
        const openingStock = Number(openingByProduct.get(productId) || 0);
        const dailyDelta = Number(dailyDeltaByProduct.get(productId) || 0);
        const closingStock = openingStock + dailyDelta;

        return {
          product_id: productId,
          opening_stock: openingStock,
          total_in: Number(totalInByProduct.get(productId) || 0),
          total_out: Number(totalOutByProduct.get(productId) || 0),
          closing_stock: closingStock,
        };
      });

      const result = await upsertSnapshots(dbUntyped, {
        date,
        tenantId,
        rows: snapshotRows,
      });

      modes.add(result.mode);
      processedTenants += 1;
      processedProducts += productIds.length;
      upsertedRows += snapshotRows.length;
    }

    await dbUntyped.from('cron_job_runs').insert({
      job_name: JOB_NAME,
      status: 'success',
      attempts,
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      meta: {
        date,
        tenant_id: requestedTenantId,
        processedTenants,
        processedProducts,
        upsertedRows,
        snapshotMode: Array.from(modes),
      },
    });

    return ok({
      job: JOB_NAME,
      date,
      processedTenants,
      processedProducts,
      upsertedRows,
      snapshotMode: Array.from(modes),
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const nextRetryAt = new Date(Date.now() + RETRY_MINUTES * 60 * 1000);

    await dbUntyped.from('cron_job_runs').insert({
      job_name: JOB_NAME,
      status: 'failed',
      attempts,
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      next_retry_at: nextRetryAt.toISOString(),
      error_message: message || '재고 스냅샷 크론 실패',
    });

    return fail('INTERNAL_ERROR', message || '재고 스냅샷 크론 실패', { status: 500 });
  }
}
