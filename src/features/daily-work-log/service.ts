import 'server-only';

import { AppApiError } from '@/lib/api/errors';
import {
  DAILY_WORK_LOG_WORK_TYPE_LABELS,
  type DailyWorkLog,
  type DailyWorkLogListParams,
  type DailyWorkLogListResult,
  type DailyWorkLogMeta,
  type DailyWorkLogServiceContext,
  type DailyWorkLogUpsertInput,
} from '@/src/features/daily-work-log/dto';
import { mapDailyWorkLog, mapDailyWorkLogListItem } from '@/src/features/daily-work-log/mapper';
import {
  getDailyWorkLogByDateAndWarehouse,
  getDailyWorkLogById,
  listDailyWorkLogMeta,
  listDailyWorkLogs,
  saveDailyWorkLog,
  type DailyWorkLogRepositoryClient,
} from '@/src/features/daily-work-log/repository';
import {
  DailyWorkLogLookupSchema,
  parseDailyWorkLogInput,
  parseDailyWorkLogListParams,
} from '@/src/features/daily-work-log/schema';
import { assertWarehouseBelongsToOrg, resolveCustomerWithinOrg } from '@/lib/server/admin-ownership';

function getKstDate(date = new Date()) {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000);
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftDate(baseIsoDate: string, offsetDays: number) {
  const [year, month, day] = baseIsoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + offsetDays));
  return toIsoDate(date);
}

function getDateRange(period: DailyWorkLogListResult['filters']['period'], startDate?: string, endDate?: string) {
  const today = toIsoDate(getKstDate());

  if (period === 'custom') {
    return {
      startDate: startDate || today,
      endDate: endDate || today,
    };
  }

  if (period === 'day') {
    return {
      startDate: today,
      endDate: today,
    };
  }

  if (period === 'week') {
    const now = getKstDate();
    const dayOfWeek = now.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    return {
      startDate: shiftDate(today, mondayOffset),
      endDate: shiftDate(today, mondayOffset + 6),
    };
  }

  if (period === 'year') {
    const [year] = today.split('-');
    return {
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    };
  }

  const [year, month] = today.split('-');
  const start = `${year}-${month}-01`;
  const endDateObject = new Date(Date.UTC(Number(year), Number(month), 0));
  return {
    startDate: start,
    endDate: toIsoDate(endDateObject),
  };
}

function matchesKeyword(log: DailyWorkLogListResult['items'][number], keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) return true;

  return (
    log.warehouseName.toLowerCase().includes(normalizedKeyword) ||
    log.createdByName.toLowerCase().includes(normalizedKeyword) ||
    log.operatorNames.some((name) => name.toLowerCase().includes(normalizedKeyword))
  );
}

function normalizeSaveError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error || '');

  if (message.includes('DUPLICATE_WORK_LOG')) {
    throw new AppApiError({
      error: '같은 작업일자와 창고의 작업일지가 이미 존재합니다.',
      code: 'CONFLICT',
      status: 409,
    });
  }

  if (message.includes('NOT_FOUND')) {
    throw new AppApiError({
      error: '작업일지를 찾을 수 없습니다.',
      code: 'NOT_FOUND',
      status: 404,
    });
  }

  if (message.includes('TENANT_MISMATCH')) {
    throw new AppApiError({
      error: '현재 조직의 작업일지만 처리할 수 있습니다.',
      code: 'FORBIDDEN',
      status: 403,
    });
  }

  throw new AppApiError({
    error: message || '일일 작업일지 저장 중 오류가 발생했습니다.',
    code: 'INTERNAL_ERROR',
    status: 500,
  });
}

export async function getDailyWorkLogMetaService(
  db: DailyWorkLogRepositoryClient,
  context: DailyWorkLogServiceContext,
): Promise<DailyWorkLogMeta> {
  const meta = await listDailyWorkLogMeta(db, context.orgId);

  return {
    ...meta,
    workTypes: Object.entries(DAILY_WORK_LOG_WORK_TYPE_LABELS).map(([value, label]) => ({
      value: value as keyof typeof DAILY_WORK_LOG_WORK_TYPE_LABELS,
      label,
    })),
  };
}

export async function listDailyWorkLogsService(
  db: DailyWorkLogRepositoryClient,
  context: DailyWorkLogServiceContext,
  params: DailyWorkLogListParams,
): Promise<DailyWorkLogListResult> {
  const parsed = parseDailyWorkLogListParams(params);
  const range = getDateRange(parsed.period, parsed.startDate, parsed.endDate);
  const rows = await listDailyWorkLogs(db, context, {
    ...parsed,
    startDate: range.startDate,
    endDate: range.endDate,
  });

  const items = rows.map(mapDailyWorkLogListItem).filter((item) => matchesKeyword(item, parsed.keyword));

  return {
    items,
    summary: {
      totalLogs: items.length,
      totalWorkers: items.reduce((sum, item) => sum + item.totalWorkerCount, 0),
      totalLineCount: items.reduce((sum, item) => sum + item.totalLineCount, 0),
      totalPrevQty: items.reduce((sum, item) => sum + item.totalPrevQty, 0),
      totalProcessedQty: items.reduce((sum, item) => sum + item.totalProcessedQty, 0),
      totalRemainQty: items.reduce((sum, item) => sum + item.totalRemainQty, 0),
    },
    filters: {
      period: parsed.period,
      startDate: range.startDate,
      endDate: range.endDate,
      warehouseId: parsed.warehouseId,
      keyword: parsed.keyword,
    },
  };
}

export async function getDailyWorkLogByIdService(
  db: DailyWorkLogRepositoryClient,
  context: DailyWorkLogServiceContext,
  id: string,
): Promise<DailyWorkLog> {
  const row = await getDailyWorkLogById(db, context, id);

  if (!row) {
    throw new AppApiError({
      error: '작업일지를 찾을 수 없습니다.',
      code: 'NOT_FOUND',
      status: 404,
    });
  }

  return mapDailyWorkLog(row);
}

export async function getDailyWorkLogByDateService(
  db: DailyWorkLogRepositoryClient,
  context: DailyWorkLogServiceContext,
  params: { workDate: string; warehouseId: string },
): Promise<DailyWorkLog | null> {
  const parsed = DailyWorkLogLookupSchema.parse(params);
  const row = await getDailyWorkLogByDateAndWarehouse(db, context, parsed.workDate, parsed.warehouseId);

  return row ? mapDailyWorkLog(row) : null;
}

async function validateDailyWorkLogReferences(
  db: DailyWorkLogRepositoryClient,
  context: DailyWorkLogServiceContext,
  input: ReturnType<typeof parseDailyWorkLogInput>,
) {
  await assertWarehouseBelongsToOrg(db, input.warehouseId, context.orgId);

  const clientIds = Array.from(new Set(input.lines.map((line) => line.clientId)));
  await Promise.all(clientIds.map((clientId) => resolveCustomerWithinOrg(db, clientId, context.orgId)));
}

export async function createDailyWorkLogService(
  db: DailyWorkLogRepositoryClient,
  context: DailyWorkLogServiceContext,
  input: DailyWorkLogUpsertInput,
): Promise<DailyWorkLog> {
  const parsed = parseDailyWorkLogInput(input);
  await validateDailyWorkLogReferences(db, context, parsed);

  const existing = await getDailyWorkLogByDateAndWarehouse(db, context, parsed.workDate, parsed.warehouseId);
  if (existing) {
    throw new AppApiError({
      error: '같은 작업일자와 창고의 작업일지가 이미 존재합니다.',
      code: 'CONFLICT',
      status: 409,
      details: { id: existing.id },
    });
  }

  try {
    const saved = await saveDailyWorkLog(db, context, parsed);
    if (!saved.success || !saved.daily_work_log_id) {
      throw new Error('일일 작업일지 저장 결과가 올바르지 않습니다.');
    }
    return await getDailyWorkLogByIdService(db, context, saved.daily_work_log_id);
  } catch (error: unknown) {
    normalizeSaveError(error);
  }
}

export async function updateDailyWorkLogService(
  db: DailyWorkLogRepositoryClient,
  context: DailyWorkLogServiceContext,
  id: string,
  input: DailyWorkLogUpsertInput,
): Promise<DailyWorkLog> {
  const parsed = parseDailyWorkLogInput({
    ...input,
    id,
  });
  await validateDailyWorkLogReferences(db, context, parsed);

  const current = await getDailyWorkLogById(db, context, id);
  if (!current) {
    throw new AppApiError({
      error: '작업일지를 찾을 수 없습니다.',
      code: 'NOT_FOUND',
      status: 404,
    });
  }

  try {
    const saved = await saveDailyWorkLog(db, context, parsed);
    if (!saved.success || !saved.daily_work_log_id) {
      throw new Error('일일 작업일지 저장 결과가 올바르지 않습니다.');
    }
    return await getDailyWorkLogByIdService(db, context, saved.daily_work_log_id);
  } catch (error: unknown) {
    normalizeSaveError(error);
  }
}
