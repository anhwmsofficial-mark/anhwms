import { NextRequest } from 'next/server';
import { getDailyWorkLogByDateAction } from '@/app/actions/daily-work-log';

export async function GET(request: NextRequest) {
  const workDate = request.nextUrl.searchParams.get('workDate') || '';
  const warehouseId = request.nextUrl.searchParams.get('warehouseId') || '';

  const result = await getDailyWorkLogByDateAction({ workDate, warehouseId }, request);

  if (!result.ok) {
    return Response.json(
      {
        error: result.error,
        status: result.status,
        code: result.code,
        details: result.details,
      },
      { status: result.status },
    );
  }

  return Response.json({ data: result.data });
}
