import { NextRequest } from 'next/server';
import { AppApiError, toAppApiError } from '@/lib/api/errors';
import {
  INVENTORY_MOVEMENT_DEFINITIONS,
  INVENTORY_MOVEMENT_LABEL_MAP,
  type InventoryMovementType,
} from '@/lib/inventory-definitions';
import { requireAdminRouteContext, resolveCustomerWithinOrg } from '@/lib/server/admin-ownership';

type DbLike = { from: (table: string) => any };

type ProductRow = {
  id: string;
  name: string | null;
  manage_name: string | null;
  sku: string | null;
  customer_id: string | null;
};

type SnapshotRow = {
  snapshot_date: string;
  product_id: string;
  opening_stock?: number | null;
  closing_stock: number | null;
};

type LedgerRow = {
  product_id: string;
  movement_type: string | null;
  qty_change: number | null;
  quantity: number | null;
  direction: 'IN' | 'OUT' | null;
  memo: string | null;
  notes: string | null;
  created_at: string;
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function isMissingColumnError(error: { message?: string } | null | undefined, columnName: string) {
  return Boolean(
    error?.message &&
      (error.message.includes(`column "${columnName}" does not exist`) ||
        error.message.includes(`column '${columnName}' does not exist`) ||
        error.message.includes(`column ${columnName} does not exist`))
  );
}

function isMissingRelationError(error: { message?: string } | null | undefined, relationName: string) {
  return Boolean(
    error?.message &&
      (error.message.includes(`relation "${relationName}" does not exist`) ||
        error.message.includes(`relation '${relationName}' does not exist`))
  );
}

function isRecoverableInventorySetupError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { message?: unknown; code?: unknown };
  const message = String(candidate.message || '').toLowerCase();
  const code = String(candidate.code || '').toUpperCase();

  return (
    code.startsWith('PGRST') ||
    message.includes('schema cache') ||
    message.includes('does not exist') ||
    message.includes("could not find the '") ||
    message.includes('column') ||
    message.includes('relation') ||
    message.includes('inventory_snapshot') ||
    message.includes('inventory_ledger') ||
    message.includes('export_templates') ||
    message.includes('warehouse')
  );
}

function isAuthorizationError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { status?: unknown; code?: unknown; message?: unknown };
  const status = Number(candidate.status);
  const code = String(candidate.code || '').toUpperCase();
  const message = String(candidate.message || '').toLowerCase();

  return (
    status === 401 ||
    status === 403 ||
    code === 'UNAUTHORIZED' ||
    code === 'FORBIDDEN' ||
    message.includes('forbidden') ||
    message.includes('unauthorized')
  );
}

function safeDailyFallbackDate(request: NextRequest) {
  try {
    return toIsoDate(new URL(request.url).searchParams.get('date'));
  } catch {
    const nowKst = new Date(Date.now() + KST_OFFSET_MS);
    return nowKst.toISOString().slice(0, 10);
  }
}

function toIsoDate(value?: string | null) {
  const normalized = String(value || '').trim().replace(/\./g, '-').replace(/\//g, '-');
  if (!normalized) {
    const date = new Date(Date.now() + KST_OFFSET_MS);
    return date.toISOString().slice(0, 10);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }
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
  throw new AppApiError({
    error: 'date는 YYYY-MM-DD 또는 MM/DD/YYYY 형식이어야 합니다.',
    code: 'BAD_REQUEST',
    status: 400,
  });
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

async function queryProducts(db: DbLike, orgId: string, customerId: string | null, search: string) {
  let query = db.from('products').select('id, name, manage_name, sku, customer_id').order('manage_name', { ascending: true });

  if (customerId) {
    query = query.eq('customer_id', customerId);
  } else {
    const { data: customers, error: customerError } = await db.from('customer_master').select('id').eq('org_id', orgId);

    if (customerError) {
      throw new AppApiError({ error: customerError.message, code: 'INTERNAL_ERROR', status: 500 });
    }

    const customerIds = ((customers || []) as Array<{ id: string }>).map((row) => row.id);
    if (customerIds.length === 0) return [] as ProductRow[];
    query = query.in('customer_id', customerIds);
  }

  if (search) {
    query = query.or(`manage_name.ilike.%${search}%,name.ilike.%${search}%,sku.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) {
    throw new AppApiError({ error: error.message, code: 'INTERNAL_ERROR', status: 500 });
  }

  return (data || []) as ProductRow[];
}

async function fetchSnapshots(db: DbLike, orgId: string, productIds: string[], date: string) {
  const [currentWithOpening, previousWithOpening] = await Promise.all([
    db
      .from('inventory_snapshot')
      .select('snapshot_date, product_id, opening_stock, closing_stock')
      .eq('tenant_id', orgId)
      .eq('snapshot_date', date)
      .in('product_id', productIds),
    db
      .from('inventory_snapshot')
      .select('snapshot_date, product_id, opening_stock, closing_stock')
      .eq('tenant_id', orgId)
      .in('product_id', productIds)
      .lt('snapshot_date', date)
      .order('product_id', { ascending: true })
      .order('snapshot_date', { ascending: false }),
  ]);

  const currentMissingOpening = isMissingColumnError(currentWithOpening.error, 'opening_stock');
  const previousMissingOpening = isMissingColumnError(previousWithOpening.error, 'opening_stock');

  if (!currentMissingOpening && currentWithOpening.error) {
    throw new AppApiError({
      error: currentWithOpening.error.message,
      code: 'INTERNAL_ERROR',
      status: 500,
    });
  }
  if (!previousMissingOpening && previousWithOpening.error) {
    throw new AppApiError({
      error: previousWithOpening.error.message,
      code: 'INTERNAL_ERROR',
      status: 500,
    });
  }

  if (!currentMissingOpening && !previousMissingOpening) {
    return {
      snapshots: (currentWithOpening.data || []) as SnapshotRow[],
      previousSnapshots: (previousWithOpening.data || []) as SnapshotRow[],
    };
  }

  const [currentFallback, previousFallback] = await Promise.all([
    db
      .from('inventory_snapshot')
      .select('snapshot_date, product_id, closing_stock')
      .eq('tenant_id', orgId)
      .eq('snapshot_date', date)
      .in('product_id', productIds),
    db
      .from('inventory_snapshot')
      .select('snapshot_date, product_id, closing_stock')
      .eq('tenant_id', orgId)
      .in('product_id', productIds)
      .lt('snapshot_date', date)
      .order('product_id', { ascending: true })
      .order('snapshot_date', { ascending: false }),
  ]);

  if (currentFallback.error || previousFallback.error) {
    throw new AppApiError({
      error: currentFallback.error?.message || previousFallback.error?.message || '스냅샷을 조회하지 못했습니다.',
      code: 'INTERNAL_ERROR',
      status: 500,
    });
  }

  return {
    snapshots: ((currentFallback.data || []) as SnapshotRow[]).map((row) => ({ ...row, opening_stock: null })),
    previousSnapshots: ((previousFallback.data || []) as SnapshotRow[]).map((row) => ({ ...row, opening_stock: null })),
  };
}

async function loadCustomersForDaily(db: DbLike, orgId: string) {
  const { data, error } = await db.from('customer_master').select('id, name').eq('org_id', orgId).order('name', { ascending: true });
  if (error) {
    return [];
  }
  return data || [];
}

async function loadTemplatesForDaily(db: DbLike, orgId: string) {
  const primary = await db
    .from('export_templates')
    .select('id, code, name, vendor_id')
    .eq('tenant_id', orgId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (!primary.error) {
    return primary.data || [];
  }

  if (
    isMissingRelationError(primary.error, 'export_templates') ||
    isMissingColumnError(primary.error, 'vendor_id') ||
    isMissingColumnError(primary.error, 'is_active') ||
    isMissingColumnError(primary.error, 'code') ||
    isMissingColumnError(primary.error, 'tenant_id')
  ) {
    return [];
  }

  return [];
}

async function loadWarehousesForDaily(db: DbLike, orgId: string) {
  const primary = await db
    .from('warehouse')
    .select('id, name')
    .eq('org_id', orgId)
    .eq('status', 'ACTIVE')
    .order('name', { ascending: true });

  if (!primary.error) {
    return primary.data || [];
  }

  if (isMissingColumnError(primary.error, 'status')) {
    const fallback = await db
      .from('warehouse')
      .select('id, name')
      .eq('org_id', orgId)
      .order('name', { ascending: true });

    if (!fallback.error) {
      return fallback.data || [];
    }
  }

  return [];
}

export async function GET(request: NextRequest) {
  try {
    const { db, orgId } = await requireAdminRouteContext('inventory:count', request);
    const dbUntyped = db as unknown as DbLike;
    const { searchParams } = new URL(request.url);

    const date = toIsoDate(searchParams.get('date'));
    const search = String(searchParams.get('search') || '').trim();
    const rawCustomerId = String(searchParams.get('customer_id') || '').trim();
    const customerId = rawCustomerId ? (await resolveCustomerWithinOrg(dbUntyped, rawCustomerId, orgId)).id : null;

    const products = await queryProducts(dbUntyped, orgId, customerId, search);
    const productIds = products.map((product) => product.id);

    let snapshots: SnapshotRow[] = [];
    let previousSnapshots: SnapshotRow[] = [];
    let transactions: LedgerRow[] = [];

    if (productIds.length > 0) {
      const [snapshotResult, ledgerResult] = await Promise.all([
        fetchSnapshots(dbUntyped, orgId, productIds, date),
        dbUntyped
          .from('inventory_ledger')
          .select('product_id, movement_type, qty_change, quantity, direction, memo, notes, created_at')
          .eq('tenant_id', orgId)
          .in('product_id', productIds)
          .gte('created_at', startOfKstDayUtc(date).toISOString())
          .lte('created_at', endOfKstDayUtc(date).toISOString())
          .order('created_at', { ascending: true }),
      ]);

      snapshots = snapshotResult.snapshots;
      previousSnapshots = snapshotResult.previousSnapshots;

      if (ledgerResult.error) {
        throw new AppApiError({
          error: ledgerResult.error.message,
          code: 'INTERNAL_ERROR',
          status: 500,
        });
      }

      transactions = (ledgerResult.data || []) as LedgerRow[];
    }

    const snapshotMap = new Map<string, SnapshotRow>();
    for (const snapshot of snapshots) {
      snapshotMap.set(snapshot.product_id, snapshot);
    }

    const previousClosingMap = new Map<string, number>();
    for (const snapshot of previousSnapshots) {
      if (!previousClosingMap.has(snapshot.product_id)) {
        previousClosingMap.set(snapshot.product_id, Number(snapshot.closing_stock || 0));
      }
    }

    const movementMap = new Map<string, Record<string, number>>();
    const noteMap = new Map<string, string[]>();
    const netDeltaMap = new Map<string, number>();

    for (const transaction of transactions) {
      const productMovement = movementMap.get(transaction.product_id) || {};
      const type = String(transaction.movement_type || '').trim();
      const signedDelta = toSignedDelta(transaction);
      if (type) {
        productMovement[type] = (productMovement[type] || 0) + Math.abs(signedDelta);
        movementMap.set(transaction.product_id, productMovement);
      }

      netDeltaMap.set(transaction.product_id, (netDeltaMap.get(transaction.product_id) || 0) + signedDelta);

      const memo = String(transaction.memo || transaction.notes || '').trim();
      if (memo) {
        const currentNotes = noteMap.get(transaction.product_id) || [];
        currentNotes.push(memo);
        noteMap.set(transaction.product_id, currentNotes);
      }
    }

    const rows = products.map((product) => {
      const snapshot = snapshotMap.get(product.id);
      const openingStock = snapshot
        ? Number(snapshot.opening_stock ?? previousClosingMap.get(product.id) ?? snapshot.closing_stock ?? 0)
        : Number(previousClosingMap.get(product.id) || 0);
      const movementValues = movementMap.get(product.id) || {};
      const netDelta = netDeltaMap.get(product.id) || 0;
      const currentStock = snapshot
        ? Number(snapshot.closing_stock ?? openingStock + netDelta)
        : openingStock + netDelta;

      return {
        productId: product.id,
        manageName: String(product.manage_name || product.name || product.sku || product.id),
        sku: product.sku,
        openingStock,
        currentStock,
        note: Array.from(new Set(noteMap.get(product.id) || [])).join(' / '),
        movements: INVENTORY_MOVEMENT_DEFINITIONS.reduce<Record<string, number>>((acc, item) => {
          acc[item.type] = Number(movementValues[item.type] || 0);
          return acc;
        }, {}),
      };
    });

    const [customers, templates, warehouses] = await Promise.all([
      loadCustomersForDaily(dbUntyped, orgId),
      loadTemplatesForDaily(dbUntyped, orgId),
      loadWarehousesForDaily(dbUntyped, orgId),
    ]);

    return Response.json({
      date,
      movementTypes: INVENTORY_MOVEMENT_DEFINITIONS.map((item) => ({
        type: item.type,
        label: item.label,
        direction: item.direction,
      })),
      movementLabels: INVENTORY_MOVEMENT_DEFINITIONS.reduce<Record<string, string>>((acc, item) => {
        acc[item.type] = INVENTORY_MOVEMENT_LABEL_MAP[item.type as InventoryMovementType];
        return acc;
      }, {}),
      customers,
      templates,
      warehouses,
      rows,
    });
  } catch (error: unknown) {
    if (!isAuthorizationError(error)) {
      return Response.json({
        date: safeDailyFallbackDate(request),
        movementTypes: INVENTORY_MOVEMENT_DEFINITIONS.map((item) => ({
          type: item.type,
          label: item.label,
          direction: item.direction,
        })),
        movementLabels: INVENTORY_MOVEMENT_DEFINITIONS.reduce<Record<string, string>>((acc, item) => {
          acc[item.type] = INVENTORY_MOVEMENT_LABEL_MAP[item.type as InventoryMovementType];
          return acc;
        }, {}),
        customers: [],
        templates: [],
        warehouses: [],
        rows: [],
        warning: isRecoverableInventorySetupError(error)
          ? '재고 집계용 DB 구성이 아직 완전히 맞지 않아 빈 결과로 대체했습니다.'
          : '재고 집계 조회 중 예외가 발생해 빈 결과로 대체했습니다.',
      });
    }

    const appError = toAppApiError(error, {
      error: error instanceof Error ? error.message : '재고 일일 현황을 조회하지 못했습니다.',
      code: 'INTERNAL_ERROR',
      status: 500,
    });

    return Response.json(appError.toResponseBody(), {
      status: appError.status,
    });
  }
}
