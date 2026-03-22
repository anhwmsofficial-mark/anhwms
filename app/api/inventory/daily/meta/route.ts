import { NextRequest } from 'next/server';
import { toAppApiError } from '@/lib/api/errors';
import {
  buildInventoryDailyMovementMeta,
  isAuthorizationError,
  isRecoverableInventorySetupError,
  loadInventoryDailyMeta,
  type InventoryDailyDbLike,
} from '@/lib/inventory/daily-query';
import { requireAdminRouteContext } from '@/lib/server/admin-ownership';

export async function GET(request: NextRequest) {
  try {
    const { db, orgId } = await requireAdminRouteContext('inventory:count', request);
    const meta = await loadInventoryDailyMeta(db as unknown as InventoryDailyDbLike, orgId);

    return Response.json(meta);
  } catch (error: unknown) {
    if (!isAuthorizationError(error)) {
      return Response.json({
        ...buildInventoryDailyMovementMeta(),
        customers: [],
        templates: [],
        warehouses: [],
        warning: isRecoverableInventorySetupError(error)
          ? '재고 집계용 메타 구성이 아직 완전히 맞지 않아 빈 결과로 대체했습니다.'
          : '재고 집계 메타 조회 중 예외가 발생해 빈 결과로 대체했습니다.',
        warningDetail: error instanceof Error ? error.message : String(error || ''),
      });
    }

    const appError = toAppApiError(error, {
      error: error instanceof Error ? error.message : '재고 메타 정보를 조회하지 못했습니다.',
      code: 'INTERNAL_ERROR',
      status: 500,
    });

    return Response.json(appError.toResponseBody(), {
      status: appError.status,
    });
  }
}
