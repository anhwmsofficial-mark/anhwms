import { NextRequest } from 'next/server';
import { AppApiError, toAppApiError } from '@/lib/api/errors';
import { buildInventoryExportWorkbook } from '@/lib/inventory-export';
import { requireAdminRouteContext, resolveCustomerWithinOrg } from '@/lib/server/admin-ownership';

function parseListParam(value: string | null) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function GET(request: NextRequest) {
  try {
    const { db, orgId } = await requireAdminRouteContext('manage:orders', request);
    const { searchParams } = new URL(request.url);

    const templateId = String(searchParams.get('template_id') || '').trim() || null;
    const templateCode = String(searchParams.get('template_code') || '').trim() || null;
    const requestedCustomerId = String(searchParams.get('customer_id') || '').trim() || null;
    const dateFrom = String(searchParams.get('date_from') || '').trim();
    const dateTo = String(searchParams.get('date_to') || '').trim();

    if (!dateFrom || !dateTo) {
      throw new AppApiError({
        error: 'date_from과 date_to가 필요합니다.',
        code: 'BAD_REQUEST',
        status: 400,
      });
    }

    let customerId: string | null = null;
    if (requestedCustomerId) {
      const customer = await resolveCustomerWithinOrg(db, requestedCustomerId, orgId);
      customerId = customer.id;
    }

    const workbook = await buildInventoryExportWorkbook(
      db as unknown as { from: (table: string) => any },
      {
        tenantId: orgId,
        templateId,
        templateCode,
        customerId,
        dateFrom,
        dateTo,
        excludeTypes: parseListParam(searchParams.get('exclude_types')),
        excludeHeaders: [
          ...parseListParam(searchParams.get('exclude_headers')),
          ...parseListParam(searchParams.get('exclude_columns')),
        ],
      }
    );

    return new Response(workbook.buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${workbook.fileName}"`,
        'X-Inventory-Export-Sheet-Count': String(workbook.sheetCount),
        'X-Inventory-Export-Row-Count': String(workbook.rowCount),
        'X-Inventory-Export-Template-Code': String(workbook.template.code || ''),
      },
    });
  } catch (error: unknown) {
    const appError = toAppApiError(error, {
      error: error instanceof Error ? error.message : '재고 엑셀 다운로드에 실패했습니다.',
      code: 'INTERNAL_ERROR',
      status: 500,
    });

    return Response.json(appError.toResponseBody(), {
      status: appError.status,
    });
  }
}
