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
  barcode?: string | null;
  customer_id: string | null;
  quantity?: number | null;
};

type SnapshotRow = {
  snapshot_date: string;
  product_id: string;
  opening_stock?: number | null;
  closing_stock: number | null;
};

type StockRow = {
  product_id: string;
  current_stock?: number | null;
  qty_on_hand?: number | null;
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

function getKstTodayString() {
  return new Date(Date.now() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function shiftIsoDate(dateString: string, diffDays: number) {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + diffDays));
  return date.toISOString().slice(0, 10);
}

function toSignedDelta(row: LedgerRow) {
  if (typeof row.qty_change === 'number') return row.qty_change;
  const absolute = Math.abs(Number(row.quantity || 0));
  return row.direction === 'OUT' ? -absolute : absolute;
}

async function queryProducts(db: DbLike, _orgId: string, customerId: string | null, search: string) {
  let query = db
    .from('products')
    .select('id, name, manage_name, sku, barcode, customer_id, quantity')
    .order('created_at', { ascending: false });

  if (customerId) {
    query = query.eq('customer_id', customerId);
  }

  if (search) {
    query = query.or(`manage_name.ilike.%${search}%,name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) {
    throw new AppApiError({ error: error.message, code: 'INTERNAL_ERROR', status: 500 });
  }

  return (data || []) as ProductRow[];
}

async function loadStockMap(db: DbLike, productIds: string[]) {
  const stockMap = new Map<string, number>();
  if (productIds.length === 0) return stockMap;

  const { data: stockRows, error: stockError } = await db
    .from('v_inventory_stock_current')
    .select('product_id, current_stock')
    .in('product_id', productIds);

  if (!stockError && stockRows) {
    for (const row of stockRows as StockRow[]) {
      stockMap.set(String(row.product_id), Number(row.current_stock || 0));
    }
    return stockMap;
  }

  const { data: qtyRows, error: qtyError } = await db
    .from('inventory_quantities')
    .select('product_id, qty_on_hand')
    .in('product_id', productIds);

  if (!qtyError && qtyRows) {
    for (const row of qtyRows as StockRow[]) {
      const productId = String(row.product_id);
      stockMap.set(productId, (stockMap.get(productId) || 0) + Number(row.qty_on_hand || 0));
    }
  }

  return stockMap;
}

async function fetchSnapshots(db: DbLike, orgId: string, productIds: string[], date: string) {
  const previousDate = shiftIsoDate(date, -1);

  const runCurrentSnapshotQuery = (options: { includeTenant: boolean; includeOpening: boolean }) => {
    const currentQuery = db
      .from('inventory_snapshot')
      .select(
        options.includeOpening
          ? 'snapshot_date, product_id, opening_stock, closing_stock'
          : 'snapshot_date, product_id, closing_stock'
      )
      .eq('snapshot_date', date)
      .in('product_id', productIds);

    return options.includeTenant ? currentQuery.eq('tenant_id', orgId) : currentQuery;
  };

  const runPreviousExactSnapshotQuery = (
    options: { includeTenant: boolean; includeOpening: boolean },
    scopedProductIds: string[]
  ) => {
    const previousQuery = db
      .from('inventory_snapshot')
      .select(
        options.includeOpening
          ? 'snapshot_date, product_id, opening_stock, closing_stock'
          : 'snapshot_date, product_id, closing_stock'
      )
      .eq('snapshot_date', previousDate)
      .in('product_id', scopedProductIds);

    return options.includeTenant ? previousQuery.eq('tenant_id', orgId) : previousQuery;
  };

  const runPreviousHistoricalSnapshotQuery = (
    options: { includeTenant: boolean; includeOpening: boolean },
    scopedProductIds: string[]
  ) => {
    const previousQuery = db
      .from('inventory_snapshot')
      .select(
        options.includeOpening
          ? 'snapshot_date, product_id, opening_stock, closing_stock'
          : 'snapshot_date, product_id, closing_stock'
      )
      .in('product_id', scopedProductIds)
      .lt('snapshot_date', date)
      .order('product_id', { ascending: true })
      .order('snapshot_date', { ascending: false });

    return options.includeTenant ? previousQuery.eq('tenant_id', orgId) : previousQuery;
  };

  const attempts = [
    { includeTenant: true, includeOpening: true },
    { includeTenant: false, includeOpening: true },
    { includeTenant: true, includeOpening: false },
    { includeTenant: false, includeOpening: false },
  ];

  let lastError: { message?: string } | null = null;

  for (const attempt of attempts) {
    const currentResult = await runCurrentSnapshotQuery(attempt);
    const previousExactResult = await runPreviousExactSnapshotQuery(attempt, productIds);
    const currentError = currentResult.error;
    const previousExactError = previousExactResult.error;

    if (!currentError && !previousExactError) {
      const previousExactRows = ((previousExactResult.data || []) as SnapshotRow[]).map((row) => ({
        ...row,
        opening_stock: attempt.includeOpening ? row.opening_stock ?? null : null,
      }));
      const previousExactProductIds = new Set(previousExactRows.map((row) => row.product_id));
      const missingPreviousProductIds = productIds.filter((productId) => !previousExactProductIds.has(productId));
      let previousHistoricalRows: SnapshotRow[] = [];

      if (missingPreviousProductIds.length > 0) {
        const previousHistoricalResult = await runPreviousHistoricalSnapshotQuery(attempt, missingPreviousProductIds);
        if (previousHistoricalResult.error) {
          lastError = previousHistoricalResult.error;
        } else {
          previousHistoricalRows = ((previousHistoricalResult.data || []) as SnapshotRow[]).map((row) => ({
            ...row,
            opening_stock: attempt.includeOpening ? row.opening_stock ?? null : null,
          }));
        }
      }

      if (missingPreviousProductIds.length === 0 || !lastError) {
        const currentRows = ((currentResult.data || []) as SnapshotRow[]).map((row) => ({
          ...row,
          opening_stock: attempt.includeOpening ? row.opening_stock ?? null : null,
        }));

        const seenPrevious = new Set<string>();
        const mergedPreviousRows = [...previousExactRows, ...previousHistoricalRows].filter((row) => {
          if (seenPrevious.has(row.product_id)) return false;
          seenPrevious.add(row.product_id);
          return true;
        });

        return {
          snapshots: currentRows,
          previousSnapshots: mergedPreviousRows,
        };
      }
    }

    lastError = currentError || previousExactError || lastError;

    const recoverable =
      isMissingColumnError(currentError, 'tenant_id') ||
      isMissingColumnError(previousExactError, 'tenant_id') ||
      isMissingColumnError(currentError, 'opening_stock') ||
      isMissingColumnError(previousExactError, 'opening_stock') ||
      isMissingRelationError(currentError, 'inventory_snapshot') ||
      isMissingRelationError(previousExactError, 'inventory_snapshot') ||
      String(currentError?.message || previousExactError?.message || lastError?.message || '').toLowerCase().includes('bad request');

    if (!recoverable) {
      break;
    }
  }

  const lastMessage = String(lastError?.message || '').trim().toLowerCase();
  if (!lastMessage || lastMessage === 'bad request') {
    return {
      snapshots: [] as SnapshotRow[],
      previousSnapshots: [] as SnapshotRow[],
    };
  }

  throw new AppApiError({
    error: lastError?.message || '스냅샷을 조회하지 못했습니다.',
    code: 'INTERNAL_ERROR',
    status: 500,
  });
}

async function loadDailyMeta(db: DbLike, orgId: string) {
  const [customers, templates, warehouses] = await Promise.all([
    loadCustomersForDaily(db, orgId),
    loadTemplatesForDaily(db, orgId),
    loadWarehousesForDaily(db, orgId),
  ]);

  return { customers, templates, warehouses };
}

async function fetchTransactionsForDaily(db: DbLike, orgId: string, productIds: string[], date: string) {
  if (productIds.length === 0) return [] as LedgerRow[];

  const startIso = startOfKstDayUtc(date).toISOString();
  const endIso = endOfKstDayUtc(date).toISOString();

  const attempts = [
    async () =>
      db
        .from('inventory_ledger')
        .select('product_id, movement_type, qty_change, quantity, direction, memo, notes, created_at')
        .eq('tenant_id', orgId)
        .in('product_id', productIds)
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .order('created_at', { ascending: true }),
    async () =>
      db
        .from('inventory_ledger')
        .select('product_id, movement_type, qty_change, quantity, direction, memo, notes, created_at')
        .eq('org_id', orgId)
        .in('product_id', productIds)
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .order('created_at', { ascending: true }),
    async () =>
      db
        .from('inventory_ledger')
        .select('product_id, transaction_type, qty_change, notes, created_at')
        .in('product_id', productIds)
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .order('created_at', { ascending: true }),
  ];

  let lastError: { message?: string } | null = null;

  for (let index = 0; index < attempts.length; index += 1) {
    const result = await attempts[index]();
    if (!result.error) {
      if (index < 2) {
        return (result.data || []) as LedgerRow[];
      }

      return ((result.data || []) as Array<{
        product_id: string;
        transaction_type: string | null;
        qty_change: number | null;
        notes: string | null;
        created_at: string;
      }>).map((row) => ({
        product_id: row.product_id,
        movement_type: row.transaction_type,
        qty_change: row.qty_change,
        quantity: row.qty_change ? Math.abs(Number(row.qty_change || 0)) : null,
        direction: (Number(row.qty_change || 0) >= 0 ? 'IN' : 'OUT') as 'IN' | 'OUT',
        memo: row.notes,
        notes: row.notes,
        created_at: row.created_at,
      }));
    }

    lastError = result.error;
    const recoverable =
      isMissingColumnError(result.error, 'tenant_id') ||
      isMissingColumnError(result.error, 'movement_type') ||
      isMissingColumnError(result.error, 'quantity') ||
      isMissingColumnError(result.error, 'direction') ||
      isMissingColumnError(result.error, 'memo') ||
      isMissingColumnError(result.error, 'notes') ||
      String(result.error?.message || '').toLowerCase().includes('bad request');

    if (!recoverable) {
      break;
    }
  }

  const lastMessage = String(lastError?.message || '').trim().toLowerCase();
  if (!lastMessage || lastMessage === 'bad request') {
    return [] as LedgerRow[];
  }

  throw new AppApiError({
    error: lastError?.message || '재고 원장을 조회하지 못했습니다.',
    code: 'INTERNAL_ERROR',
    status: 500,
  });
}

async function loadCustomersForDaily(db: DbLike, orgId: string) {
  const primary = await db
    .from('customer_master')
    .select('id, name, code')
    .eq('status', 'ACTIVE')
    .order('name', { ascending: true });

  if (!primary.error && primary.data) {
    return primary.data;
  }

  const fallback = await db
    .from('customer_master')
    .select('id, name, code')
    .eq('org_id', orgId)
    .order('name', { ascending: true });

  if (!fallback.error && fallback.data) {
    return fallback.data;
  }

  const partnerFallback = await db
    .from('partners')
    .select('id, name')
    .in('type', ['customer', 'both'])
    .order('name', { ascending: true });

  return partnerFallback.error ? [] : partnerFallback.data || [];
}

async function loadTemplatesForDaily(db: DbLike, orgId: string) {
  const primary = await db
    .from('export_templates')
    .select('id, code, name, vendor_id')
    .eq('tenant_id', orgId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (!primary.error) {
    const rows = primary.data || [];
    if (rows.length > 0) {
      return rows;
    }
    return [{ id: '__default_ybk__', code: 'YBK_DEFAULT', name: 'YBK 기본 템플릿', vendor_id: null }];
  }

  if (
    isMissingRelationError(primary.error, 'export_templates') ||
    isMissingColumnError(primary.error, 'vendor_id') ||
    isMissingColumnError(primary.error, 'is_active') ||
    isMissingColumnError(primary.error, 'code') ||
    isMissingColumnError(primary.error, 'tenant_id')
  ) {
    return [{ id: '__default_ybk__', code: 'YBK_DEFAULT', name: 'YBK 기본 템플릿', vendor_id: null }];
  }

  return [{ id: '__default_ybk__', code: 'YBK_DEFAULT', name: 'YBK 기본 템플릿', vendor_id: null }];
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
  const includeMetaOnError = new URL(request.url).searchParams.get('include_meta') === '1';
  try {
    const { db, orgId } = await requireAdminRouteContext('inventory:count', request);
    const dbUntyped = db as unknown as DbLike;
    const { searchParams } = new URL(request.url);

    const date = toIsoDate(searchParams.get('date'));
    const search = String(searchParams.get('search') || '').trim();
    const includeMeta = searchParams.get('include_meta') === '1';
    const rawCustomerId = String(searchParams.get('customer_id') || '').trim();
    const customerId = rawCustomerId ? (await resolveCustomerWithinOrg(dbUntyped, rawCustomerId, orgId)).id : null;

    const products = await queryProducts(dbUntyped, orgId, customerId, search);
    const productIds = products.map((product) => product.id);
    const stockMap = await loadStockMap(dbUntyped, productIds);

    let snapshots: SnapshotRow[] = [];
    let previousSnapshots: SnapshotRow[] = [];
    let transactions: LedgerRow[] = [];
    const warningMessages: string[] = [];

    if (productIds.length > 0) {
      try {
        const snapshotResult = await fetchSnapshots(dbUntyped, orgId, productIds, date);
        snapshots = snapshotResult.snapshots;
        previousSnapshots = snapshotResult.previousSnapshots;
      } catch (error) {
        warningMessages.push(
          `스냅샷 조회 fallback: ${error instanceof Error ? error.message : String(error || 'unknown error')}`
        );
      }

      try {
        transactions = await fetchTransactionsForDaily(dbUntyped, orgId, productIds, date);
      } catch (error) {
        warningMessages.push(
          `원장 조회 fallback: ${error instanceof Error ? error.message : String(error || 'unknown error')}`
        );
      }
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
      const hasLiveStock = stockMap.has(product.id);
      const liveCurrentStock = hasLiveStock ? Number(stockMap.get(product.id) || 0) : null;
      const productQuantity = typeof product.quantity === 'number' ? Number(product.quantity || 0) : null;
      const hasPreviousClosing = previousClosingMap.has(product.id);
      const movementValues = movementMap.get(product.id) || {};
      const netDelta = netDeltaMap.get(product.id) || 0;
      const openingStock = snapshot
        ? Number(snapshot.opening_stock ?? previousClosingMap.get(product.id) ?? snapshot.closing_stock ?? 0)
        : date === getKstTodayString()
        ? hasPreviousClosing
          ? Number(previousClosingMap.get(product.id) || 0)
          : hasLiveStock
          ? Number(liveCurrentStock || 0) - netDelta
          : Number(productQuantity || 0)
        : Number(previousClosingMap.get(product.id) || productQuantity || 0);
      const computedCurrentStock = snapshot
        ? Number(snapshot.closing_stock ?? openingStock + netDelta)
        : openingStock + netDelta;
      const currentStock =
        date === getKstTodayString()
          ? hasLiveStock
            ? Number(liveCurrentStock || 0)
            : hasPreviousClosing || Boolean(snapshot) || netDelta !== 0
            ? computedCurrentStock
            : Number(productQuantity || 0)
          : computedCurrentStock;

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

    const meta = includeMeta ? await loadDailyMeta(dbUntyped, orgId) : null;

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
      ...(meta
        ? {
            customers: meta.customers,
            templates: meta.templates,
            warehouses: meta.warehouses,
          }
        : {}),
      rows,
      ...(warningMessages.length > 0
        ? {
            warning: '일부 재고 집계 소스를 불러오지 못해 대체 데이터로 표시했습니다.',
            warningDetail: warningMessages.join(' | '),
          }
        : {}),
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
        ...(includeMetaOnError
          ? {
              customers: [],
              templates: [],
              warehouses: [],
            }
          : {}),
        rows: [],
        warning: isRecoverableInventorySetupError(error)
          ? '재고 집계용 DB 구성이 아직 완전히 맞지 않아 빈 결과로 대체했습니다.'
          : '재고 집계 조회 중 예외가 발생해 빈 결과로 대체했습니다.',
        warningDetail: error instanceof Error ? error.message : String(error || ''),
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
