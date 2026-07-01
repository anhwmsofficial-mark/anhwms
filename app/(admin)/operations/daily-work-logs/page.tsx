import { getDailyWorkLogListPageDataAction } from '@/app/actions/daily-work-log';
import {
  DAILY_WORK_LOG_PERIOD_PRESETS,
  type DailyWorkLogListParams,
  type DailyWorkLogPeriodPreset,
} from '@/src/features/daily-work-log/dto';
import DailyWorkLogListPage from '@/src/features/daily-work-log/ui/DailyWorkLogListPage';

export const dynamic = 'force-dynamic';

export default async function OperationsDailyWorkLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await searchParams;

  const rawPeriod = typeof resolvedParams.period === 'string' ? resolvedParams.period : undefined;
  const period = DAILY_WORK_LOG_PERIOD_PRESETS.includes(rawPeriod as DailyWorkLogPeriodPreset)
    ? (rawPeriod as DailyWorkLogPeriodPreset)
    : undefined;

  const params: DailyWorkLogListParams = {
    period,
    startDate: typeof resolvedParams.startDate === 'string' ? resolvedParams.startDate : undefined,
    endDate: typeof resolvedParams.endDate === 'string' ? resolvedParams.endDate : undefined,
    warehouseId: typeof resolvedParams.warehouseId === 'string' ? resolvedParams.warehouseId : undefined,
    keyword: typeof resolvedParams.keyword === 'string' ? resolvedParams.keyword : undefined,
  };

  const pageDataResult = await getDailyWorkLogListPageDataAction(params);
  const meta = pageDataResult.ok ? pageDataResult.data.meta : { warehouses: [], clients: [], workTypes: [] };
  const list = pageDataResult.ok
    ? pageDataResult.data.list
    : {
        items: [],
        summary: {
          totalLogs: 0,
          totalWorkers: 0,
          totalLineCount: 0,
          totalPrevQty: 0,
          totalProcessedQty: 0,
          totalRemainQty: 0,
        },
        filters: {
          period: 'recent30' as const,
          startDate: '',
          endDate: '',
          warehouseId: '',
          keyword: '',
        },
      };

  return (
    <DailyWorkLogListPage
      title="일일 작업일지"
      entryBasePath="/operations/daily-work-logs"
      backUrl="/operations"
      meta={meta}
      initialData={list}
      errorMessage={!pageDataResult.ok ? pageDataResult.error : null}
    />
  );
}
