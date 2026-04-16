import type { createTrackedAdminClient } from '@/utils/supabase/admin-client';
import type { DailyWorkLogListParamsParsed, DailyWorkLogUpsertInputParsed } from '@/src/features/daily-work-log/schema';
import type {
  DailyWorkLogMetaOption,
  DailyWorkLogServiceContext,
} from '@/src/features/daily-work-log/dto';
import type { DailyWorkLogRow } from '@/src/features/daily-work-log/mapper';

type StrictDailyWorkLogRepositoryClient = ReturnType<typeof createTrackedAdminClient>;

export type DailyWorkLogRepositoryClient = StrictDailyWorkLogRepositoryClient & {
  from: (relation: string) => any;
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

type SaveDailyWorkLogRpcResponse = {
  success?: boolean;
  daily_work_log_id?: string;
  total_worker_count?: number;
  line_count?: number;
};

const PREFERRED_WAREHOUSE_ORDER = [
  '제1센터 A동',
  '제1센터 B동',
  '제2센터 A동',
  '제2센터 B동',
] as const;

const PREFERRED_CLIENT_ORDER = [
  'YBK',
  '리부트라이트',
  '프롬디스',
  '몽페쉬',
  '율케어시스템',
  '기타',
] as const;

function sortMetaOptions(
  options: DailyWorkLogMetaOption[],
  preferredOrder: readonly string[],
) {
  const priorityMap = new Map(preferredOrder.map((name, index) => [name, index]));

  return options.slice().sort((left, right) => {
    const leftPriority = priorityMap.get(left.name);
    const rightPriority = priorityMap.get(right.name);

    if (leftPriority !== undefined && rightPriority !== undefined) {
      return leftPriority - rightPriority;
    }
    if (leftPriority !== undefined) return -1;
    if (rightPriority !== undefined) return 1;
    return left.name.localeCompare(right.name, 'ko');
  });
}

function buildDailyWorkLogSelect() {
  return `
    id,
    tenant_id,
    org_id,
    warehouse_id,
    work_date,
    full_time_count,
    long_term_part_time_count,
    daily_worker_count,
    helper_count,
    total_worker_count,
    note,
    created_by,
    created_at,
    updated_at,
    warehouse:warehouse(
      id,
      name,
      code
    ),
    creator:user_profiles!daily_work_logs_created_by_fkey(
      id,
      display_name,
      email
    ),
    daily_work_log_lines(
      id,
      client_id,
      work_type,
      prev_qty,
      processed_qty,
      remain_qty,
      operator_name,
      memo,
      sort_order,
      created_at,
      updated_at,
      client:customer_master(
        id,
        name,
        code
      )
    )
  `;
}

export async function listDailyWorkLogMeta(
  db: DailyWorkLogRepositoryClient,
  orgId: string,
): Promise<{ warehouses: DailyWorkLogMetaOption[]; clients: DailyWorkLogMetaOption[] }> {
  const looseDb = db as DailyWorkLogRepositoryClient;

  const [warehouseResult, clientResult] = await Promise.all([
    looseDb
      .from('warehouse')
      .select('id, name, code')
      .eq('org_id', orgId)
      .eq('status', 'ACTIVE')
      .order('name', { ascending: true }),
    looseDb
      .from('customer_master')
      .select('id, name, code')
      .eq('org_id', orgId)
      .eq('status', 'ACTIVE')
      .order('name', { ascending: true }),
  ]);

  if (warehouseResult.error) {
    throw new Error(warehouseResult.error.message);
  }

  if (clientResult.error) {
    throw new Error(clientResult.error.message);
  }

  return {
    warehouses: sortMetaOptions(
      (warehouseResult.data || []).map((row) => ({
        id: row.id,
        name: row.name || '-',
        code: row.code ?? null,
      })),
      PREFERRED_WAREHOUSE_ORDER,
    ),
    clients: sortMetaOptions(
      (clientResult.data || []).map((row) => ({
        id: row.id,
        name: row.name || '-',
        code: row.code ?? null,
      })),
      PREFERRED_CLIENT_ORDER,
    ),
  };
}

export async function listDailyWorkLogs(
  db: DailyWorkLogRepositoryClient,
  context: DailyWorkLogServiceContext,
  params: DailyWorkLogListParamsParsed,
): Promise<DailyWorkLogRow[]> {
  const looseDb = db as DailyWorkLogRepositoryClient;

  let query = looseDb
    .from('daily_work_logs')
    .select(buildDailyWorkLogSelect())
    .eq('org_id', context.orgId)
    .gte('work_date', params.startDate || '')
    .lte('work_date', params.endDate || '')
    .order('work_date', { ascending: false })
    .order('updated_at', { ascending: false });

  if (params.warehouseId) {
    query = query.eq('warehouse_id', params.warehouseId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as unknown as DailyWorkLogRow[];
}

export async function getDailyWorkLogById(
  db: DailyWorkLogRepositoryClient,
  context: DailyWorkLogServiceContext,
  id: string,
): Promise<DailyWorkLogRow | null> {
  const looseDb = db as DailyWorkLogRepositoryClient;

  const { data, error } = await looseDb
    .from('daily_work_logs')
    .select(buildDailyWorkLogSelect())
    .eq('id', id)
    .eq('org_id', context.orgId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as unknown as DailyWorkLogRow | null) || null;
}

export async function getDailyWorkLogByDateAndWarehouse(
  db: DailyWorkLogRepositoryClient,
  context: DailyWorkLogServiceContext,
  workDate: string,
  warehouseId: string,
): Promise<DailyWorkLogRow | null> {
  const looseDb = db as DailyWorkLogRepositoryClient;

  const { data, error } = await looseDb
    .from('daily_work_logs')
    .select(buildDailyWorkLogSelect())
    .eq('org_id', context.orgId)
    .eq('work_date', workDate)
    .eq('warehouse_id', warehouseId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as unknown as DailyWorkLogRow | null) || null;
}

export async function saveDailyWorkLog(
  db: DailyWorkLogRepositoryClient,
  context: DailyWorkLogServiceContext,
  input: DailyWorkLogUpsertInputParsed,
): Promise<SaveDailyWorkLogRpcResponse> {
  const rpcPayload = {
    p_tenant_id: context.orgId,
    p_org_id: context.orgId,
    p_daily_work_log_id: input.id ?? null,
    p_warehouse_id: input.warehouseId,
    p_work_date: input.workDate,
    p_full_time_count: input.fullTimeCount,
    p_long_term_part_time_count: input.longTermPartTimeCount,
    p_daily_worker_count: input.dailyWorkerCount,
    p_helper_count: input.helperCount,
    p_note: input.note || null,
    p_actor_id: context.userId,
    p_lines: input.lines.map((line) => ({
      line_id: line.id ?? null,
      client_id: line.clientId,
      work_type: line.workType,
      prev_qty: line.prevQty,
      processed_qty: line.processedQty,
      remain_qty: line.remainQty,
      operator_name: line.operatorName || null,
      memo: line.memo || null,
      sort_order: line.sortOrder,
    })),
  };

  const looseDb = db as DailyWorkLogRepositoryClient;
  const { data, error } = await looseDb.rpc('save_daily_work_log', rpcPayload);

  if (error) {
    throw new Error(error.message);
  }

  return (data || {}) as SaveDailyWorkLogRpcResponse;
}
