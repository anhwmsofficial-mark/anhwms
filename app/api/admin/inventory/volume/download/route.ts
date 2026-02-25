import { NextRequest } from 'next/server';
import * as XLSX from 'xlsx';
import { createAdminClient } from '@/utils/supabase/admin';
import { requirePermission } from '@/utils/rbac';

type InventoryVolumeRawRow = {
  sheet_name: string | null;
  record_date: string | null;
  row_no: number | null;
  header_order: string[] | null;
  raw_data: Record<string, unknown> | null;
};

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
    await requirePermission('manage:orders', request);
    const db = createAdminClient();
    const { searchParams } = new URL(request.url);

    const customerId = String(searchParams.get('customer_id') || '').trim();
    const dateFrom = toIsoDate(searchParams.get('date_from'));
    const dateTo = toIsoDate(searchParams.get('date_to'));

    if (!customerId) {
      return new Response('customer_id가 필요합니다.', { status: 400 });
    }

    let query = db
      .from('inventory_volume_raw')
      .select('sheet_name, record_date, row_no, header_order, raw_data')
      .eq('customer_id', customerId)
      .order('record_date', { ascending: true, nullsFirst: false })
      .order('sheet_name', { ascending: true })
      .order('row_no', { ascending: true })
      .limit(50000);

    if (dateFrom) query = query.gte('record_date', dateFrom);
    if (dateTo) query = query.lte('record_date', dateTo);

    const { data, error } = await query;
    if (error) return new Response(error.message, { status: 500 });
    if (!data || !data.length) return new Response('다운로드할 데이터가 없습니다.', { status: 404 });

    const sheetMap = new Map<string, Record<string, unknown>[]>();
    const headersMap = new Map<string, string[]>();

    (data as InventoryVolumeRawRow[]).forEach((row) => {
      const sheetName = String(row.sheet_name || 'Sheet1');
      const headerOrder = Array.isArray(row.header_order) ? row.header_order.map(String) : [];
      if (!headersMap.has(sheetName)) {
        headersMap.set(sheetName, headerOrder);
      }
      if (!sheetMap.has(sheetName)) {
        sheetMap.set(sheetName, []);
      }
      sheetMap.get(sheetName)!.push(row.raw_data || {});
    });

    const workbook = XLSX.utils.book_new();
    for (const [sheetName, rows] of sheetMap.entries()) {
      const headers = headersMap.get(sheetName) || Object.keys(rows[0] || {});
      const aoa: unknown[][] = [headers];
      rows.forEach((raw: Record<string, unknown>) => {
        aoa.push(headers.map((h) => (raw?.[h] ?? '')));
      });
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      XLSX.utils.book_append_sheet(workbook, ws, sheetName.slice(0, 31) || 'Sheet1');
    }

    const output = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const fromPart = dateFrom ? sanitizeFilePart(dateFrom) : 'all';
    const toPart = dateTo ? sanitizeFilePart(dateTo) : 'all';
    const fileName = `inventory_volume_${sanitizeFilePart(customerId)}_${fromPart}_${toPart}.xlsx`;

    return new Response(output, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '다운로드 실패';
    return new Response(message, { status: 500 });
  }
}
