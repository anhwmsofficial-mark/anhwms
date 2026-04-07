import { NextRequest } from 'next/server';
import { AppApiError } from '@/lib/api/errors';
import {
  buildInventoryVolumeWorkbookBuffer,
  INVENTORY_VOLUME_EXPORT_MAX_ROWS,
} from '@/lib/inventory-volume-query';
import { requireAdminRouteContext, resolveCustomerWithinOrg } from '@/lib/server/admin-ownership';

const toIsoDate = (value?: string | null) => {
  if (!value) return null;
  const normalized = String(value).trim().replace(/\./g, '-').replace(/\//g, '-');
  if (!normalized) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  return null;
};

const sanitizeFilePart = (value: string) =>
  value
    .trim()
    .replace(/[^\w\-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

export async function GET(request: NextRequest) {
  try {
    const { db, orgId } = await requireAdminRouteContext('manage:orders', request);
    const { searchParams } = new URL(request.url);

    const customerId = String(searchParams.get('customer_id') || '').trim();
    const dateFrom = toIsoDate(searchParams.get('date_from'));
    const dateTo = toIsoDate(searchParams.get('date_to'));

    if (!customerId) {
      throw new AppApiError({ error: 'customer_id가 필요합니다.', code: 'BAD_REQUEST', status: 400 });
    }

    const customer = await resolveCustomerWithinOrg(db, customerId, orgId);

    const workbookResult = await buildInventoryVolumeWorkbookBuffer(
      db as unknown as { from: (table: string) => any },
      {
        customerId: customer.id,
        dateFrom,
        dateTo,
      },
      'sheet_name, header_order, raw_data',
      { maxRows: INVENTORY_VOLUME_EXPORT_MAX_ROWS },
    );
    if (!workbookResult.buffer) return new Response('다운로드할 데이터가 없습니다.', { status: 404 });

    const fromPart = dateFrom ? sanitizeFilePart(dateFrom) : 'all';
    const toPart = dateTo ? sanitizeFilePart(dateTo) : 'all';
    const fileName = `inventory_volume_${sanitizeFilePart(customer.id)}_${fromPart}_${toPart}.xlsx`;

    return new Response(new Uint8Array(workbookResult.buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'X-Inventory-Export-Row-Count': String(workbookResult.totalFetched),
        'X-Inventory-Export-Truncated': String(workbookResult.truncated),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '다운로드 실패';
    return new Response(message, { status: 500 });
  }
}
