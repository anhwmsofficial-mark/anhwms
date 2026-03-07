import * as XLSX from 'xlsx';

export const INVENTORY_VOLUME_EXPORT_MAX_ROWS = 50000;
export const INVENTORY_VOLUME_PAGE_MAX_LIMIT = 1000;
export const INVENTORY_VOLUME_DEFAULT_PREVIEW_LIMIT = 300;
export const INVENTORY_VOLUME_BATCH_SIZE = 1000;

type InventoryVolumeFilter = {
  customerId: string;
  dateFrom?: string | null;
  dateTo?: string | null;
};

type InventoryVolumePageOptions = {
  offset: number;
  limit: number;
};

type InventoryVolumeWorkbookOptions = {
  maxRows?: number;
  batchSize?: number;
};

type InventoryVolumeRawLikeRow = {
  sheet_name: string | null;
  header_order?: string[] | null;
  raw_data?: Record<string, unknown> | null;
};

type DbLike = {
  from: (table: string) => any;
};

function createInventoryVolumeBaseQuery(db: DbLike, columns: string, filters: InventoryVolumeFilter) {
  let query = db
    .from('inventory_volume_raw')
    .select(columns)
    .eq('customer_id', filters.customerId)
    .order('record_date', { ascending: true, nullsFirst: false })
    .order('sheet_name', { ascending: true })
    .order('row_no', { ascending: true });

  if (filters.dateFrom) query = query.gte('record_date', filters.dateFrom);
  if (filters.dateTo) query = query.lte('record_date', filters.dateTo);

  return query;
}

export function parsePositiveInt(
  value: string | null,
  fallback: number,
  max: number,
  min = 0,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

export async function fetchInventoryVolumePage(
  db: DbLike,
  filters: InventoryVolumeFilter,
  columns: string,
  options: InventoryVolumePageOptions,
) {
  const safeOffset = Math.max(options.offset, 0);
  const safeLimit = Math.max(options.limit, 1);
  const query = createInventoryVolumeBaseQuery(db, columns, filters) as {
    range: (from: number, to: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
  };
  const { data, error } = await query.range(safeOffset, safeOffset + safeLimit - 1);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as Record<string, unknown>[];
}

export async function fetchInventoryVolumeRowsBatched(
  db: DbLike,
  filters: InventoryVolumeFilter,
  columns: string,
  options?: InventoryVolumeWorkbookOptions,
) {
  const maxRows = Math.max(options?.maxRows || INVENTORY_VOLUME_EXPORT_MAX_ROWS, 1);
  const batchSize = Math.max(
    Math.min(options?.batchSize || INVENTORY_VOLUME_BATCH_SIZE, maxRows),
    1,
  );

  const rows: Record<string, unknown>[] = [];
  let offset = 0;
  let truncated = false;

  while (rows.length < maxRows) {
    const remaining = maxRows - rows.length;
    const pageSize = Math.min(batchSize, remaining);
    const batch = await fetchInventoryVolumePage(db, filters, columns, {
      offset,
      limit: pageSize,
    });

    rows.push(...batch);

    if (batch.length < pageSize) {
      break;
    }

    offset += batch.length;
    if (rows.length >= maxRows) {
      truncated = true;
    }
  }

  return {
    rows,
    totalFetched: rows.length,
    truncated,
  };
}

function getSheetHeaders(row: InventoryVolumeRawLikeRow) {
  const orderedHeaders = Array.isArray(row.header_order) ? row.header_order.map(String) : [];
  if (orderedHeaders.length > 0) return orderedHeaders;
  return Object.keys(row.raw_data || {});
}

function appendRowsToWorkbook(
  workbook: XLSX.WorkBook,
  worksheets: Map<string, XLSX.WorkSheet>,
  rowBatch: InventoryVolumeRawLikeRow[],
) {
  for (const row of rowBatch) {
    const sheetName = String(row.sheet_name || 'Sheet1').slice(0, 31) || 'Sheet1';
    const rawData = row.raw_data || {};
    const headers = getSheetHeaders(row);
    let worksheet = worksheets.get(sheetName);

    if (!worksheet) {
      worksheet = XLSX.utils.aoa_to_sheet([headers]);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      worksheets.set(sheetName, worksheet);
    }

    XLSX.utils.sheet_add_aoa(
      worksheet,
      [headers.map((header) => rawData[header] ?? '')],
      { origin: -1 },
    );
  }
}

export async function buildInventoryVolumeWorkbookBuffer(
  db: DbLike,
  filters: InventoryVolumeFilter,
  columns: string,
  options?: InventoryVolumeWorkbookOptions,
) {
  const maxRows = Math.max(options?.maxRows || INVENTORY_VOLUME_EXPORT_MAX_ROWS, 1);
  const batchSize = Math.max(
    Math.min(options?.batchSize || INVENTORY_VOLUME_BATCH_SIZE, maxRows),
    1,
  );
  const workbook = XLSX.utils.book_new();
  const worksheets = new Map<string, XLSX.WorkSheet>();
  let totalFetched = 0;
  let offset = 0;
  let truncated = false;

  while (totalFetched < maxRows) {
    const remaining = maxRows - totalFetched;
    const pageSize = Math.min(batchSize, remaining);
    const batch = (await fetchInventoryVolumePage(db, filters, columns, {
      offset,
      limit: pageSize,
    })) as InventoryVolumeRawLikeRow[];

    if (batch.length === 0) {
      break;
    }

    appendRowsToWorkbook(workbook, worksheets, batch);
    totalFetched += batch.length;

    if (batch.length < pageSize) {
      break;
    }

    offset += batch.length;
    if (totalFetched >= maxRows) {
      truncated = true;
    }
  }

  if (totalFetched === 0) {
    return {
      buffer: null,
      totalFetched,
      truncated: false,
      sheetCount: 0,
    };
  }

  return {
    buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
    totalFetched,
    truncated,
    sheetCount: worksheets.size,
  };
}
