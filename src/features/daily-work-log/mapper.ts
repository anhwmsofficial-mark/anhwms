import type {
  DailyWorkLog,
  DailyWorkLogLine,
  DailyWorkLogListItem,
  DailyWorkLogMetaOption,
} from '@/src/features/daily-work-log/dto';

export type DailyWorkLogWarehouseRow = {
  id: string;
  name: string | null;
  code: string | null;
};

export type DailyWorkLogCreatorRow = {
  id: string;
  display_name: string | null;
  email: string | null;
};

export type DailyWorkLogClientRow = {
  id: string;
  name: string | null;
  code: string | null;
};

export type DailyWorkLogLineRow = {
  id: string;
  client_id: string;
  work_type: string;
  prev_qty: number;
  processed_qty: number;
  remain_qty: number;
  operator_name: string | null;
  memo: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  client?: DailyWorkLogClientRow | null;
};

export type DailyWorkLogRow = {
  id: string;
  tenant_id: string;
  org_id: string;
  warehouse_id: string;
  work_date: string;
  full_time_count: number;
  long_term_part_time_count: number;
  daily_worker_count: number;
  helper_count: number;
  total_worker_count: number;
  note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  warehouse?: DailyWorkLogWarehouseRow | null;
  creator?: DailyWorkLogCreatorRow | null;
  daily_work_log_lines?: DailyWorkLogLineRow[] | null;
};

export function mapMetaOption(row: { id: string; name: string | null; code?: string | null }): DailyWorkLogMetaOption {
  return {
    id: row.id,
    name: row.name || '-',
    code: row.code ?? null,
  };
}

export function mapDailyWorkLogLine(row: DailyWorkLogLineRow): DailyWorkLogLine {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client?.name || '-',
    clientCode: row.client?.code ?? null,
    workType: row.work_type as DailyWorkLogLine['workType'],
    prevQty: Number(row.prev_qty || 0),
    processedQty: Number(row.processed_qty || 0),
    remainQty: Number(row.remain_qty || 0),
    operatorName: row.operator_name || '',
    memo: row.memo || '',
    sortOrder: Number(row.sort_order || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapDailyWorkLog(row: DailyWorkLogRow): DailyWorkLog {
  const lines = (row.daily_work_log_lines || [])
    .slice()
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
    .map(mapDailyWorkLogLine);

  return {
    id: row.id,
    organizationId: row.org_id,
    tenantId: row.tenant_id,
    warehouseId: row.warehouse_id,
    warehouseName: row.warehouse?.name || '-',
    warehouseCode: row.warehouse?.code ?? null,
    workDate: row.work_date,
    fullTimeCount: Number(row.full_time_count || 0),
    longTermPartTimeCount: Number(row.long_term_part_time_count || 0),
    dailyWorkerCount: Number(row.daily_worker_count || 0),
    helperCount: Number(row.helper_count || 0),
    totalWorkerCount: Number(row.total_worker_count || 0),
    note: row.note || '',
    createdBy: row.created_by,
    createdByName: row.creator?.display_name || row.creator?.email || '-',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lines,
  };
}

export function mapDailyWorkLogListItem(row: DailyWorkLogRow): DailyWorkLogListItem {
  const lines = (row.daily_work_log_lines || []).map(mapDailyWorkLogLine);
  const operatorNames = Array.from(
    new Set(lines.map((line) => line.operatorName.trim()).filter((value) => value.length > 0)),
  );

  return {
    id: row.id,
    workDate: row.work_date,
    warehouseId: row.warehouse_id,
    warehouseName: row.warehouse?.name || '-',
    totalWorkerCount: Number(row.total_worker_count || 0),
    totalLineCount: lines.length,
    totalPrevQty: lines.reduce((sum, line) => sum + line.prevQty, 0),
    totalProcessedQty: lines.reduce((sum, line) => sum + line.processedQty, 0),
    totalRemainQty: lines.reduce((sum, line) => sum + line.remainQty, 0),
    createdByName: row.creator?.display_name || row.creator?.email || '-',
    operatorNames,
    updatedAt: row.updated_at,
  };
}
