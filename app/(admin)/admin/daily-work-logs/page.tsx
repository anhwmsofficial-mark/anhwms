import { redirect } from 'next/navigation';

export default async function AdminDailyWorkLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await searchParams;
  const nextParams = new URLSearchParams();

  Object.entries(resolvedParams).forEach(([key, value]) => {
    if (typeof value === 'string' && value.trim()) {
      nextParams.set(key, value);
    }
  });

  const suffix = nextParams.toString();
  redirect(`/operations/daily-work-logs${suffix ? `?${suffix}` : ''}`);
}
