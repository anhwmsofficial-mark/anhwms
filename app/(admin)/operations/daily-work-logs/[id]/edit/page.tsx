import { notFound } from 'next/navigation';
import { getDailyWorkLogDetailAction, getDailyWorkLogMetaAction } from '@/app/actions/daily-work-log';
import DailyWorkLogFormPage from '@/src/features/daily-work-log/ui/DailyWorkLogFormPage';

export default async function EditDailyWorkLogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const [metaResult, detailResult] = await Promise.all([
    getDailyWorkLogMetaAction(),
    getDailyWorkLogDetailAction(resolvedParams.id),
  ]);

  if (!detailResult.ok) {
    notFound();
  }

  return (
    <DailyWorkLogFormPage
      mode="edit"
      meta={metaResult.ok ? metaResult.data : { warehouses: [], clients: [], workTypes: [] }}
      initialValue={detailResult.data}
    />
  );
}
