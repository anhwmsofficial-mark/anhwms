import { NextRequest } from 'next/server';
import { toAppApiError } from '@/lib/api/errors';
import {
  isAuthorizationError,
  isRecoverableInventorySetupError,
  loadInventoryDailyRows,
  safeDailyFallbackDate,
  toIsoDate,
  type InventoryDailyDbLike,
} from '@/lib/inventory/daily-query';
import { requireAdminRouteContext, resolveCustomerWithinOrg } from '@/lib/server/admin-ownership';

export async function GET(request: NextRequest) {
  try {
    const { db, orgId } = await requireAdminRouteContext('inventory:count', request);
    const dbUntyped = db as unknown as InventoryDailyDbLike;
    const { searchParams } = new URL(request.url);

    const date = toIsoDate(searchParams.get('date'));
    const search = String(searchParams.get('search') || '').trim();
    const rawCustomerId = String(searchParams.get('customer_id') || '').trim();
    const customerId = rawCustomerId ? (await resolveCustomerWithinOrg(dbUntyped, rawCustomerId, orgId)).id : null;

    const rowsData = await loadInventoryDailyRows(dbUntyped, orgId, { date, search, customerId });
    return Response.json(rowsData);
  } catch (error: unknown) {
    if (!isAuthorizationError(error)) {
      return Response.json({
        date: safeDailyFallbackDate(request),
        rows: [],
        warning: isRecoverableInventorySetupError(error)
          ? '재고 집계용 DB 구성이 아직 완전히 맞지 않아 빈 결과로 대체했습니다.'
          : '재고 집계 조회 중 예외가 발생해 빈 결과로 대체했습니다.',
        warningDetail: error instanceof Error ? error.message : String(error || ''),
      });
    }

    const appError = toAppApiError(error, {
      error: error instanceof Error ? error.message : '재고 일일 행 데이터를 조회하지 못했습니다.',
      code: 'INTERNAL_ERROR',
      status: 500,
    });

    return Response.json(appError.toResponseBody(), {
      status: appError.status,
    });
  }
}
