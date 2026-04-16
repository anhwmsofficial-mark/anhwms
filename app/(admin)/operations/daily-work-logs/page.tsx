import { getDailyWorkLogMetaAction, listDailyWorkLogsAction } from '@/app/actions/daily-work-log';
import DailyWorkLogListPage from '@/src/features/daily-work-log/ui/DailyWorkLogListPage';

export default async function OperationsDailyWorkLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await searchParams;
  const params = {
    period: typeof resolvedParams.period === 'string' ? resolvedParams.period : undefined,
    startDate: typeof resolvedParams.startDate === 'string' ? resolvedParams.startDate : undefined,
    endDate: typeof resolvedParams.endDate === 'string' ? resolvedParams.endDate : undefined,
    warehouseId: typeof resolvedParams.warehouseId === 'string' ? resolvedParams.warehouseId : undefined,
    keyword: typeof resolvedParams.keyword === 'string' ? resolvedParams.keyword : undefined,
  };

  const [metaResult, listResult] = await Promise.all([
    getDailyWorkLogMetaAction(),
    listDailyWorkLogsAction(params),
  ]);

  return (
    <DailyWorkLogListPage
      title="일일 작업일지"
      entryBasePath="/operations/daily-work-logs"
      backUrl="/operations"
      meta={metaResult.ok ? metaResult.data : { warehouses: [], clients: [], workTypes: [] }}
      initialData={
        listResult.ok
          ? listResult.data
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
                period: 'month',
                startDate: '',
                endDate: '',
                warehouseId: '',
                keyword: '',
              },
            }
      }
      errorMessage={!listResult.ok ? listResult.error : !metaResult.ok ? metaResult.error : null}
    />
  );
}
