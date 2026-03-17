import 'server-only';

import ExcelJS from 'exceljs';
import { AppApiError } from '@/lib/api/errors';
import { INVENTORY_MOVEMENT_DEFINITIONS, INVENTORY_MOVEMENT_LABEL_MAP } from '@/lib/inventory-definitions';

type DbLike = { from: (table: string) => any };

type ExportColumnSource =
  | 'MANAGE_NAME'
  | 'OPENING_STOCK'
  | 'TOTAL_SUM'
  | 'CLOSING_STOCK'
  | 'NOTE'
  | 'TRANSACTION_TYPE';

type ExportTemplateRow = {
  id: string;
  tenant_id: string;
  vendor_id: string | null;
  code: string;
  name: string;
  description: string | null;
  sheet_name: string | null;
  is_active: boolean | null;
};

type ExportTemplateColumnRow = {
  id: string;
  template_id: string;
  sort_order: number;
  source: ExportColumnSource;
  transaction_type: string | null;
  header_name: string | null;
  width: number | null;
  number_format: string | null;
  is_visible: boolean | null;
};

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
  opening_stock: number | null;
  total_in?: number | null;
  total_out?: number | null;
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

type CustomerRow = {
  id: string;
};

type StockRow = {
  product_id: string;
  current_stock?: number | null;
  qty_on_hand?: number | null;
};

type InventoryExportOptions = {
  tenantId: string;
  templateId?: string | null;
  templateCode?: string | null;
  customerId?: string | null;
  dateFrom: string;
  dateTo: string;
  excludeTypes?: string[];
  excludeHeaders?: string[];
};

type WorkbookBuildResult = {
  buffer: Buffer;
  fileName: string;
  template: ExportTemplateRow;
  sheetCount: number;
  rowCount: number;
};

type ResolvedTemplate = {
  template: ExportTemplateRow;
  columns: ExportTemplateColumnRow[];
};

type SheetRow = {
  manageName: string;
  openingStock: number;
  totalSum: number;
  closingStock: number;
  note: string;
  movementValues: Record<string, number>;
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const BUILTIN_YBK_TEMPLATE_ID = '__default_ybk__';
const BUILTIN_YBK_TEMPLATE_CODE = 'YBK_DEFAULT';

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

function parseIsoDate(value: string, fieldName: string) {
  const normalized = String(value || '').trim().replace(/\./g, '-').replace(/\//g, '-');
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
    error: `${fieldName}는 YYYY-MM-DD 또는 MM/DD/YYYY 형식이어야 합니다.`,
    code: 'BAD_REQUEST',
    status: 400,
  });
}

function normalizeMatchKey(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[()_\-+]/g, '');
}

function sanitizeFilePart(value: string) {
  return value
    .trim()
    .replace(/[^\w\-가-힣]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function dateRangeInclusive(dateFrom: string, dateTo: string) {
  const [fromYear, fromMonth, fromDay] = dateFrom.split('-').map(Number);
  const [toYear, toMonth, toDay] = dateTo.split('-').map(Number);
  const startMs = Date.UTC(fromYear, fromMonth - 1, fromDay);
  const endMs = Date.UTC(toYear, toMonth - 1, toDay);

  if (startMs > endMs) {
    throw new AppApiError({
      error: 'date_from은 date_to보다 이후일 수 없습니다.',
      code: 'BAD_REQUEST',
      status: 400,
    });
  }

  const dates: string[] = [];
  for (let currentMs = startMs; currentMs <= endMs; currentMs += 24 * 60 * 60 * 1000) {
    const current = new Date(currentMs);
    const year = current.getUTCFullYear();
    const month = `${current.getUTCMonth() + 1}`.padStart(2, '0');
    const day = `${current.getUTCDate()}`.padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
  }

  return dates;
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

function toSignedDelta(row: LedgerRow) {
  if (typeof row.qty_change === 'number') return row.qty_change;
  const absolute = Math.abs(Number(row.quantity || 0));
  return row.direction === 'OUT' ? -absolute : absolute;
}

function groupKey(date: string, productId: string) {
  return `${date}::${productId}`;
}

function resolveTemplateHeader(column: ExportTemplateColumnRow) {
  if (column.header_name?.trim()) return column.header_name.trim();
  if (column.source === 'MANAGE_NAME') return '관리명';
  if (column.source === 'OPENING_STOCK') return '전일재고';
  if (column.source === 'TOTAL_SUM') return '총합계';
  if (column.source === 'CLOSING_STOCK') return '마감재고';
  if (column.source === 'NOTE') return '비고';
  if (column.source === 'TRANSACTION_TYPE' && column.transaction_type) {
    return INVENTORY_MOVEMENT_LABEL_MAP[column.transaction_type as keyof typeof INVENTORY_MOVEMENT_LABEL_MAP] || column.transaction_type;
  }
  return '컬럼';
}

function buildBuiltinYbkTemplate(): ResolvedTemplate {
  const template: ExportTemplateRow = {
    id: BUILTIN_YBK_TEMPLATE_ID,
    tenant_id: 'builtin',
    vendor_id: null,
    code: BUILTIN_YBK_TEMPLATE_CODE,
    name: 'YBK 기본 템플릿',
    description: 'DB 템플릿이 없어도 사용할 수 있는 기본 YBK 템플릿',
    sheet_name: '재고현황',
    is_active: true,
  };

  const fixedColumns: ExportTemplateColumnRow[] = [
    {
      id: `${BUILTIN_YBK_TEMPLATE_ID}:MANAGE_NAME`,
      template_id: BUILTIN_YBK_TEMPLATE_ID,
      sort_order: 10,
      source: 'MANAGE_NAME',
      transaction_type: null,
      header_name: '관리명',
      width: 28,
      number_format: null,
      is_visible: true,
    },
    {
      id: `${BUILTIN_YBK_TEMPLATE_ID}:OPENING_STOCK`,
      template_id: BUILTIN_YBK_TEMPLATE_ID,
      sort_order: 20,
      source: 'OPENING_STOCK',
      transaction_type: null,
      header_name: '전일재고',
      width: 14,
      number_format: '#,##0',
      is_visible: true,
    },
  ];

  const movementColumns: ExportTemplateColumnRow[] = INVENTORY_MOVEMENT_DEFINITIONS.map((item, index) => ({
    id: `${BUILTIN_YBK_TEMPLATE_ID}:TRANSACTION_TYPE:${item.type}`,
    template_id: BUILTIN_YBK_TEMPLATE_ID,
    sort_order: 30 + index * 10,
    source: 'TRANSACTION_TYPE',
    transaction_type: item.type,
    header_name: item.label,
    width: 14,
    number_format: '#,##0',
    is_visible: true,
  }));

  const tailColumns: ExportTemplateColumnRow[] = [
    {
      id: `${BUILTIN_YBK_TEMPLATE_ID}:TOTAL_SUM`,
      template_id: BUILTIN_YBK_TEMPLATE_ID,
      sort_order: 970,
      source: 'TOTAL_SUM',
      transaction_type: null,
      header_name: '총합계',
      width: 14,
      number_format: '#,##0',
      is_visible: true,
    },
    {
      id: `${BUILTIN_YBK_TEMPLATE_ID}:CLOSING_STOCK`,
      template_id: BUILTIN_YBK_TEMPLATE_ID,
      sort_order: 980,
      source: 'CLOSING_STOCK',
      transaction_type: null,
      header_name: '마감재고',
      width: 14,
      number_format: '#,##0',
      is_visible: true,
    },
    {
      id: `${BUILTIN_YBK_TEMPLATE_ID}:NOTE`,
      template_id: BUILTIN_YBK_TEMPLATE_ID,
      sort_order: 990,
      source: 'NOTE',
      transaction_type: null,
      header_name: '비고',
      width: 30,
      number_format: null,
      is_visible: true,
    },
  ];

  return {
    template,
    columns: [...fixedColumns, ...movementColumns, ...tailColumns],
  };
}

async function resolveTemplate(
  db: DbLike,
  tenantId: string,
  templateId?: string | null,
  templateCode?: string | null
): Promise<ResolvedTemplate> {
  if (templateId === BUILTIN_YBK_TEMPLATE_ID || templateCode === BUILTIN_YBK_TEMPLATE_CODE) {
    return buildBuiltinYbkTemplate();
  }

  let templateQuery = db
    .from('export_templates')
    .select('id, tenant_id, vendor_id, code, name, description, sheet_name, is_active')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .limit(1);

  if (templateId) {
    templateQuery = templateQuery.eq('id', templateId);
  } else if (templateCode) {
    templateQuery = templateQuery.eq('code', templateCode);
  } else {
    throw new AppApiError({
      error: 'template_id 또는 template_code가 필요합니다.',
      code: 'BAD_REQUEST',
      status: 400,
    });
  }

  const { data: templateData, error: templateError } = await templateQuery.maybeSingle();
  if (templateError) {
    if (isMissingRelationError(templateError, 'export_templates')) {
      throw new AppApiError({
        error: '엑셀 템플릿 테이블이 아직 준비되지 않았습니다. 마이그레이션 적용 후 다시 시도해주세요.',
        code: 'BAD_REQUEST',
        status: 400,
      });
    }
    throw new AppApiError({
      error: templateError.message || '엑셀 템플릿을 조회하지 못했습니다.',
      code: 'INTERNAL_ERROR',
      status: 500,
    });
  }
  if (!templateData) {
    throw new AppApiError({
      error: '엑셀 템플릿을 찾을 수 없습니다.',
      code: 'NOT_FOUND',
      status: 404,
    });
  }

  const template = templateData as ExportTemplateRow;
  const { data: columnsData, error: columnsError } = await db
    .from('export_template_columns')
    .select('id, template_id, sort_order, source, transaction_type, header_name, width, number_format, is_visible')
    .eq('template_id', template.id)
    .eq('is_visible', true)
    .order('sort_order', { ascending: true });

  if (columnsError) {
    if (isMissingRelationError(columnsError, 'export_template_columns')) {
      throw new AppApiError({
        error: '엑셀 템플릿 컬럼 테이블이 아직 준비되지 않았습니다. 마이그레이션 적용 후 다시 시도해주세요.',
        code: 'BAD_REQUEST',
        status: 400,
      });
    }
    throw new AppApiError({
      error: columnsError.message || '엑셀 템플릿 컬럼을 조회하지 못했습니다.',
      code: 'INTERNAL_ERROR',
      status: 500,
    });
  }

  const columns = ((columnsData || []) as ExportTemplateColumnRow[]).filter((column) => Boolean(column.is_visible));
  if (columns.length === 0) {
    throw new AppApiError({
      error: '표시 가능한 템플릿 컬럼이 없습니다.',
      code: 'NOT_FOUND',
      status: 404,
    });
  }

  return { template, columns };
}

async function resolveScopedProductIds(db: DbLike, tenantId: string, customerId?: string | null) {
  if (customerId) {
    const { data: products, error } = await db
      .from('products')
      .select('id, name, manage_name, sku, barcode, customer_id, quantity')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new AppApiError({ error: error.message, code: 'INTERNAL_ERROR', status: 500 });
    }

    return (products || []) as ProductRow[];
  }

  const { data: customers, error: customerError } = await db
    .from('customer_master')
    .select('id')
    .eq('org_id', tenantId);

  if (customerError) {
    throw new AppApiError({ error: customerError.message, code: 'INTERNAL_ERROR', status: 500 });
  }

  const customerIds = ((customers || []) as CustomerRow[]).map((row) => row.id).filter(Boolean);
  if (customerIds.length === 0) return [];

  const { data: products, error: productError } = await db
    .from('products')
    .select('id, name, manage_name, sku, barcode, customer_id, quantity')
    .in('customer_id', customerIds)
    .order('created_at', { ascending: false });

  if (productError) {
    throw new AppApiError({ error: productError.message, code: 'INTERNAL_ERROR', status: 500 });
  }

  return (products || []) as ProductRow[];
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

function applyColumnExclusions(
  columns: ExportTemplateColumnRow[],
  excludeTypes: string[],
  excludeHeaders: string[]
) {
  const excludedTypeKeys = new Set(excludeTypes.map((value) => normalizeMatchKey(value)));
  const excludedHeaderKeys = new Set(excludeHeaders.map((value) => normalizeMatchKey(value)));

  return columns.filter((column) => {
    const header = resolveTemplateHeader(column);
    const sourceKey = normalizeMatchKey(column.source);
    const transactionTypeKey = normalizeMatchKey(column.transaction_type);
    const headerKey = normalizeMatchKey(header);

    if (
      excludedHeaderKeys.has(headerKey) ||
      excludedHeaderKeys.has(sourceKey) ||
      (column.transaction_type && excludedHeaderKeys.has(transactionTypeKey))
    ) {
      return false;
    }

    if (column.transaction_type && excludedTypeKeys.has(transactionTypeKey)) {
      return false;
    }

    return true;
  });
}

async function fetchSnapshots(
  db: DbLike,
  tenantId: string,
  productIds: string[],
  dateFrom: string,
  dateTo: string
) {
  if (productIds.length === 0) {
    return {
      currentRangeSnapshots: [] as SnapshotRow[],
      previousSnapshots: [] as SnapshotRow[],
    };
  }

  const [currentWithOpening, previousWithOpening] = await Promise.all([
    db
      .from('inventory_snapshot')
      .select('snapshot_date, product_id, opening_stock, total_in, total_out, closing_stock')
      .eq('tenant_id', tenantId)
      .in('product_id', productIds)
      .gte('snapshot_date', dateFrom)
      .lte('snapshot_date', dateTo)
      .order('snapshot_date', { ascending: true }),
    db
      .from('inventory_snapshot')
      .select('snapshot_date, product_id, opening_stock, total_in, total_out, closing_stock')
      .eq('tenant_id', tenantId)
      .in('product_id', productIds)
      .lt('snapshot_date', dateFrom)
      .order('product_id', { ascending: true })
      .order('snapshot_date', { ascending: false }),
  ]);

  const currentMissingOpening = isMissingColumnError(currentWithOpening.error, 'opening_stock');
  const previousMissingOpening = isMissingColumnError(previousWithOpening.error, 'opening_stock');

  if (!currentMissingOpening && currentWithOpening.error) {
    throw new AppApiError({ error: currentWithOpening.error.message, code: 'INTERNAL_ERROR', status: 500 });
  }
  if (!previousMissingOpening && previousWithOpening.error) {
    throw new AppApiError({ error: previousWithOpening.error.message, code: 'INTERNAL_ERROR', status: 500 });
  }

  if (!currentMissingOpening && !previousMissingOpening) {
    return {
      currentRangeSnapshots: (currentWithOpening.data || []) as SnapshotRow[],
      previousSnapshots: (previousWithOpening.data || []) as SnapshotRow[],
    };
  }

  const [currentFallback, previousFallback] = await Promise.all([
    db
      .from('inventory_snapshot')
      .select('snapshot_date, product_id, closing_stock')
      .eq('tenant_id', tenantId)
      .in('product_id', productIds)
      .gte('snapshot_date', dateFrom)
      .lte('snapshot_date', dateTo)
      .order('snapshot_date', { ascending: true }),
    db
      .from('inventory_snapshot')
      .select('snapshot_date, product_id, closing_stock')
      .eq('tenant_id', tenantId)
      .in('product_id', productIds)
      .lt('snapshot_date', dateFrom)
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
    currentRangeSnapshots: ((currentFallback.data || []) as SnapshotRow[]).map((row) => ({ ...row, opening_stock: null })),
    previousSnapshots: ((previousFallback.data || []) as SnapshotRow[]).map((row) => ({ ...row, opening_stock: null })),
  };
}

async function fetchTransactions(
  db: DbLike,
  tenantId: string,
  productIds: string[],
  dateFrom: string,
  dateTo: string
) {
  if (productIds.length === 0) return [] as LedgerRow[];

  const { data, error } = await db
    .from('inventory_ledger')
    .select('product_id, movement_type, qty_change, quantity, direction, memo, notes, created_at')
    .eq('tenant_id', tenantId)
    .in('product_id', productIds)
    .gte('created_at', startOfKstDayUtc(dateFrom).toISOString())
    .lte('created_at', endOfKstDayUtc(dateTo).toISOString())
    .order('created_at', { ascending: true });

  if (error) {
    throw new AppApiError({ error: error.message, code: 'INTERNAL_ERROR', status: 500 });
  }

  return (data || []) as LedgerRow[];
}

function buildSheetRows(params: {
  dates: string[];
  products: ProductRow[];
  snapshots: SnapshotRow[];
  previousSnapshots: SnapshotRow[];
  transactions: LedgerRow[];
  stockMap: Map<string, number>;
}) {
  const snapshotByKey = new Map<string, SnapshotRow>();
  for (const snapshot of params.snapshots) {
    snapshotByKey.set(groupKey(snapshot.snapshot_date, snapshot.product_id), snapshot);
  }

  const previousClosingMap = new Map<string, number>();
  for (const snapshot of params.previousSnapshots) {
    if (!previousClosingMap.has(snapshot.product_id)) {
      previousClosingMap.set(snapshot.product_id, Number(snapshot.closing_stock || 0));
    }
  }

  const transactionByKey = new Map<string, LedgerRow[]>();
  for (const transaction of params.transactions) {
    const localDate = new Date(new Date(transaction.created_at).getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
    const key = groupKey(localDate, transaction.product_id);
    const existing = transactionByKey.get(key) || [];
    existing.push(transaction);
    transactionByKey.set(key, existing);
  }

  const rowsByDate = new Map<string, Array<{ productId: string; row: SheetRow }>>();
  const runningClosingMap = new Map<string, number>(previousClosingMap);
  const today = getKstTodayString();

  for (const date of params.dates) {
    const dayRows: Array<{ productId: string; row: SheetRow }> = [];

    for (const product of params.products) {
      const key = groupKey(date, product.id);
      const snapshot = snapshotByKey.get(key);
      const transactions = transactionByKey.get(key) || [];
      const liveCurrentStock = params.stockMap.has(product.id)
        ? Number(params.stockMap.get(product.id) || 0)
        : Number(product.quantity || 0);

      const openingStock = snapshot
        ? Number(snapshot.opening_stock ?? runningClosingMap.get(product.id) ?? snapshot.closing_stock ?? 0)
        : date === today
        ? liveCurrentStock - transactions.reduce((sum, transaction) => sum + toSignedDelta(transaction), 0)
        : Number(runningClosingMap.get(product.id) || 0);

      const movementValues: Record<string, number> = {};
      const notes = new Set<string>();

      for (const transaction of transactions) {
        const movementType = String(transaction.movement_type || '').trim();
        if (!movementType) continue;
        movementValues[movementType] = (movementValues[movementType] || 0) + toSignedDelta(transaction);

        const memo = String(transaction.memo || transaction.notes || '').trim();
        if (memo) notes.add(memo);
      }

      const totalSum = transactions.reduce((sum, transaction) => sum + toSignedDelta(transaction), 0);
      const closingStock = snapshot
        ? date === today
          ? liveCurrentStock
          : Number(snapshot.closing_stock ?? openingStock + totalSum)
        : date === today
        ? liveCurrentStock
        : openingStock + totalSum;

      runningClosingMap.set(product.id, closingStock);

      dayRows.push({
        productId: product.id,
        row: {
          manageName: String(product.manage_name || product.name || product.sku || product.id),
          openingStock,
          totalSum,
          closingStock,
          note: Array.from(notes).join(' / '),
          movementValues,
        },
      });
    }

    rowsByDate.set(date, dayRows);
  }

  return rowsByDate;
}

function configureWorksheetColumns(worksheet: ExcelJS.Worksheet, columns: ExportTemplateColumnRow[]) {
  worksheet.columns = columns.map((column) => {
    const source = column.source;
    let key: string = source;
    if (source === 'TRANSACTION_TYPE') {
      key = `movement:${String(column.transaction_type || '')}`;
    }

    return {
      header: resolveTemplateHeader(column),
      key,
      width: column.width || (source === 'MANAGE_NAME' ? 28 : source === 'NOTE' ? 30 : 14),
      style:
        source === 'MANAGE_NAME' || source === 'NOTE'
          ? { alignment: { vertical: 'middle', horizontal: 'left' as const } }
          : { numFmt: column.number_format || '#,##0', alignment: { vertical: 'middle', horizontal: 'right' as const } },
    };
  });

  const headerRow = worksheet.getRow(1);
  headerRow.height = 22;
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F4E78' },
  };

  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };
}

function applyWorksheetBorders(worksheet: ExcelJS.Worksheet) {
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      };
    });
  });
}

export async function buildInventoryExportWorkbook(
  db: DbLike,
  options: InventoryExportOptions
): Promise<WorkbookBuildResult> {
  const dateFrom = parseIsoDate(options.dateFrom, 'date_from');
  const dateTo = parseIsoDate(options.dateTo, 'date_to');
  const excludeTypes = options.excludeTypes || [];
  const excludeHeaders = options.excludeHeaders || [];

  const { template, columns: templateColumns } = await resolveTemplate(
    db,
    options.tenantId,
    options.templateId,
    options.templateCode
  );
  const effectiveCustomerId = options.customerId || template.vendor_id || null;
  if (options.customerId && template.vendor_id && options.customerId !== template.vendor_id) {
    throw new AppApiError({
      error: '선택한 템플릿은 다른 업체 전용입니다.',
      code: 'BAD_REQUEST',
      status: 400,
    });
  }

  const filteredColumns = applyColumnExclusions(templateColumns, excludeTypes, excludeHeaders);
  if (filteredColumns.length === 0) {
    throw new AppApiError({
      error: '제외 조건 적용 후 남은 엑셀 컬럼이 없습니다.',
      code: 'BAD_REQUEST',
      status: 400,
    });
  }

  const products = await resolveScopedProductIds(db, options.tenantId, effectiveCustomerId);
  if (products.length === 0) {
    throw new AppApiError({
      error: '내보낼 품목이 없습니다.',
      code: 'NOT_FOUND',
      status: 404,
    });
  }

  const productIds = products.map((product) => product.id);
  const stockMap = await loadStockMap(db, productIds);
  const dates = dateRangeInclusive(dateFrom, dateTo);
  const { currentRangeSnapshots, previousSnapshots } = await fetchSnapshots(
    db,
    options.tenantId,
    productIds,
    dateFrom,
    dateTo
  );
  const transactions = await fetchTransactions(db, options.tenantId, productIds, dateFrom, dateTo);
  const rowsByDate = buildSheetRows({
    dates,
    products,
    snapshots: currentRangeSnapshots,
    previousSnapshots,
    transactions,
    stockMap,
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ANH_WMS';
  workbook.lastModifiedBy = 'ANH_WMS';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.subject = 'Inventory Export';
  workbook.title = template.name || 'Inventory Export';

  let rowCount = 0;

  for (const date of dates) {
    const worksheet = workbook.addWorksheet(date);
    configureWorksheetColumns(worksheet, filteredColumns);

    const dayRows = rowsByDate.get(date) || [];
    for (const { row } of dayRows) {
      const record: Record<string, string | number> = {};

      for (const column of filteredColumns) {
        if (column.source === 'MANAGE_NAME') {
          record.MANAGE_NAME = row.manageName;
        } else if (column.source === 'OPENING_STOCK') {
          record.OPENING_STOCK = row.openingStock;
        } else if (column.source === 'TOTAL_SUM') {
          record.TOTAL_SUM = row.totalSum;
        } else if (column.source === 'CLOSING_STOCK') {
          record.CLOSING_STOCK = row.closingStock;
        } else if (column.source === 'NOTE') {
          record.NOTE = row.note;
        } else if (column.source === 'TRANSACTION_TYPE' && column.transaction_type) {
          record[`movement:${column.transaction_type}`] = row.movementValues[column.transaction_type] || 0;
        }
      }

      worksheet.addRow(record);
      rowCount += 1;
    }

    if (worksheet.rowCount > 1) {
      for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
        worksheet.getRow(rowNumber).height = 20;
      }
    }

    applyWorksheetBorders(worksheet);
  }

  const fromPart = sanitizeFilePart(dateFrom);
  const toPart = sanitizeFilePart(dateTo);
  const templatePart = sanitizeFilePart(template.code || template.name || 'inventory');
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  return {
    buffer,
    fileName: `inventory_export_${templatePart}_${fromPart}_${toPart}.xlsx`,
    template,
    sheetCount: dates.length,
    rowCount,
  };
}
