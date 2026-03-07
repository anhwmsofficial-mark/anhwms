import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/utils/rbac';
import { getErrorMessage } from '@/lib/errorHandler';
import { fail, getRouteContext } from '@/lib/api/response';
import { createRequestLogger } from '@/lib/api/request-log';

export async function GET(request: NextRequest) {
  const ctx = getRouteContext(request, 'GET /api/admin/inventory/import-staging/template');
  const requestLog = createRequestLogger({
    requestId: ctx.requestId,
    route: ctx.route,
    action: 'inventory_staging_template_download',
  });

  try {
    await requirePermission('inventory:adjust', request);

    const header = [
      'sku',
      'barcode',
      'occurred_at',
      'opening_stock',
      'inbound_qty',
      'disposal_qty',
      'damage_qty',
      'return_b2c_qty',
      'outbound_qty',
      'adjustment_plus_qty',
      'adjustment_minus_qty',
      'bundle_break_in_qty',
      'bundle_break_out_qty',
      'export_pickup_qty',
      'outbound_cancel_qty',
      'memo',
    ];

    const sample = [
      'ABC-EAR-BK',
      '880000000001',
      '2026-02-25T00:00:00Z',
      '100',
      '20',
      '2',
      '1',
      '3',
      '15',
      '0',
      '0',
      '0',
      '0',
      '0',
      '1',
      '샘플 데이터',
    ];

    const csv = [header.join(','), sample.join(',')].join('\n');
    requestLog.success();
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="inventory_ledger_staging_template.csv"',
      },
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const apiError = requestLog.failure(error, {
      error: message || '템플릿 다운로드 실패',
      code: 'INTERNAL_ERROR',
      status: 500,
    });
    return fail(apiError.code || 'INTERNAL_ERROR', apiError.message, {
      status: apiError.status,
      requestId: ctx.requestId,
      details: apiError.details,
    });
  }
}
