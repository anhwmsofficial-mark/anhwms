import { getDailyWorkLogMetaAction } from '@/app/actions/daily-work-log';
import DailyWorkLogFormPage from '@/src/features/daily-work-log/ui/DailyWorkLogFormPage';

export default async function NewDailyWorkLogPage() {
  const metaResult = await getDailyWorkLogMetaAction();

  return (
    <DailyWorkLogFormPage
      mode="create"
      meta={metaResult.ok ? metaResult.data : { warehouses: [], clients: [], workTypes: [] }}
    />
  );
}
