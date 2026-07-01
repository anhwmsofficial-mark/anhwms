import { NextRequest } from 'next/server';
import { getDailyWorkLogListPageDataAction } from '@/app/actions/daily-work-log';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import {
  DAILY_WORK_LOG_PERIOD_PRESETS,
  type DailyWorkLogListParams,
  type DailyWorkLogPeriodPreset,
} from '@/src/features/daily-work-log/dto';

export async function GET(request: NextRequest) {
  const ctx = getRouteContext(request, 'GET /api/daily-work-logs');
  const searchParams = request.nextUrl.searchParams;
  const rawPeriod = searchParams.get('period') || undefined;
  const period = DAILY_WORK_LOG_PERIOD_PRESETS.includes(rawPeriod as DailyWorkLogPeriodPreset)
    ? (rawPeriod as DailyWorkLogPeriodPreset)
    : undefined;

  const params: DailyWorkLogListParams = {
    period,
    startDate: searchParams.get('startDate') || undefined,
    endDate: searchParams.get('endDate') || undefined,
    warehouseId: searchParams.get('warehouseId') || undefined,
    keyword: searchParams.get('keyword') || undefined,
  };

  const result = await getDailyWorkLogListPageDataAction(params, request);
  if (!result.ok) {
    return fail(result.code || 'INTERNAL_ERROR', result.error, {
      status: result.status || 500,
      requestId: ctx.requestId,
    });
  }

  return ok(result.data, { requestId: ctx.requestId });
}
