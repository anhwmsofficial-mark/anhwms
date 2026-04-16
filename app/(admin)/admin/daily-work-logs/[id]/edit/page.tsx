import { redirect } from 'next/navigation';

export default async function AdminEditDailyWorkLogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  redirect(`/operations/daily-work-logs/${resolvedParams.id}/edit`);
}
