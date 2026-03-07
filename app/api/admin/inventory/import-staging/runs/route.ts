import { NextRequest } from 'next/server';
import { getErrorMessage } from '@/lib/errorHandler';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import { createRequestLogger } from '@/lib/api/request-log';
import { requireAdminRouteContext } from '@/lib/server/admin-ownership';

export async function GET(request: NextRequest) {
  const ctx = getRouteContext(request, 'GET /api/admin/inventory/import-staging/runs');
  let tenantId: string | null = null;
  const requestLog = createRequestLogger({
    requestId: ctx.requestId,
    route: ctx.route,
    action: 'inventory_staging_runs',
  });

  try {
    const { db, orgId } = await requireAdminRouteContext('inventory:adjust', request);
    const dbUntyped = db as unknown as {
      from: (table: string) => any;
    };
    const { searchParams } = new URL(request.url);
    tenantId = orgId;
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 20), 1), 100);

    const { data, error } = await dbUntyped
      .from('inventory_import_runs')
      .select('id, source_file_name, dry_run, requested_limit, selected_count, imported_count, skipped_count, status, error_message, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return fail('INTERNAL_ERROR', error.message, { status: 500 });
    }

    requestLog.success({ tenantId });
    return ok(data || [], { requestId: ctx.requestId });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const apiError = requestLog.failure(error, {
      error: message || '실행 이력 조회 실패',
      code: 'INTERNAL_ERROR',
      status: 500,
    }, { tenantId });
    return fail(apiError.code || 'INTERNAL_ERROR', apiError.message, {
      status: apiError.status,
      requestId: ctx.requestId,
      details: apiError.details,
    });
  }
}
