import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createAdminClient } from '@/utils/supabase/admin';
import { requirePermission } from '@/utils/rbac';

type InventoryVolumeInsertRow = {
  customer_id: string;
  sheet_name: string;
  record_date: string | null;
  row_no: number;
  item_name: string | null;
  opening_stock_raw: string | null;
  closing_stock_raw: string | null;
  header_order: string[];
  raw_data: Record<string, unknown>;
  source_file: string;
};

const normalizeHeader = (value: unknown) => String(value || '').trim();

const normalizeKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()_\-]/g, '');

const tryParseDateFromSheetName = (sheetName: string): string | null => {
  const raw = String(sheetName || '').trim();
  if (!raw) return null;

  const ymd = raw.match(/(20\d{2})[.\-/년\s]?(\d{1,2})[.\-/월\s]?(\d{1,2})/);
  if (!ymd) return null;

  const year = ymd[1];
  const month = ymd[2].padStart(2, '0');
  const day = ymd[3].padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toIsoDate = (value?: string | null) => {
  if (!value) return null;
  const normalized = String(value).trim().replace(/\./g, '-').replace(/\//g, '-');
  if (!normalized) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  return null;
};

const getCellByAliases = (row: Record<string, unknown>, aliases: string[]) => {
  const entries = Object.entries(row);
  for (const alias of aliases) {
    const target = normalizeKey(alias);
    const found = entries.find(([key]) => normalizeKey(key) === target);
    if (found) return found[1];
  }
  return null;
};

export async function GET(request: NextRequest) {
  try {
    await requirePermission('manage:orders', request);
    const db = createAdminClient();
    const { searchParams } = new URL(request.url);

    const customerId = searchParams.get('customer_id');
    const dateFrom = toIsoDate(searchParams.get('date_from'));
    const dateTo = toIsoDate(searchParams.get('date_to'));
    const limit = Math.min(Number(searchParams.get('limit') || 200), 1000);

    let query = db
      .from('inventory_volume_raw')
      .select('id, customer_id, sheet_name, record_date, row_no, item_name, opening_stock_raw, closing_stock_raw, source_file, created_at')
      .order('record_date', { ascending: false, nullsFirst: false })
      .order('row_no', { ascending: true })
      .limit(limit);

    if (customerId) query = query.eq('customer_id', customerId);
    if (dateFrom) query = query.gte('record_date', dateFrom);
    if (dateTo) query = query.lte('record_date', dateTo);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data: data || [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '물동량 조회 실패';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission('manage:orders', request);
    const db = createAdminClient();
    const form = await request.formData();

    const customerId = String(form.get('customer_id') || '').trim();
    const recordDateInput = toIsoDate(String(form.get('record_date') || '').trim() || null);
    const file = form.get('file');

    if (!customerId) {
      return NextResponse.json({ error: 'customer_id는 필수입니다.' }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: '엑셀 파일이 필요합니다.' }, { status: 400 });
    }

    const fileName = file.name || 'inventory-volume.xlsx';
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    if (!workbook.SheetNames.length) {
      return NextResponse.json({ error: '엑셀 시트가 비어있습니다.' }, { status: 400 });
    }

    const rowsForInsert: InventoryVolumeInsertRow[] = [];
    const headersBySheet: Record<string, string[]> = {};

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      const rawRows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
        header: 1,
        defval: '',
        blankrows: false,
      });

      if (!rawRows.length) continue;

      const firstRow = (rawRows[0] || []).map(normalizeHeader);
      const headerOrder = firstRow.map((header, idx) => header || `COL_${idx + 1}`);
      headersBySheet[sheetName] = headerOrder;

      const sheetRecordDate = recordDateInput || tryParseDateFromSheetName(sheetName);

      rawRows.slice(1).forEach((row, index) => {
        const hasValue = (row || []).some((cell) => String(cell ?? '').trim() !== '');
        if (!hasValue) return;

        const rawData: Record<string, unknown> = {};
        headerOrder.forEach((header, colIndex) => {
          rawData[header] = row[colIndex] ?? '';
        });

        const itemName = String(getCellByAliases(rawData, ['관리병', '관리명']) || '').trim() || null;
        const openingStock = String(getCellByAliases(rawData, ['전영재고']) || '').trim() || null;
        const closingStock = String(getCellByAliases(rawData, ['마감재고']) || '').trim() || null;

        rowsForInsert.push({
          customer_id: customerId,
          sheet_name: sheetName,
          record_date: sheetRecordDate,
          row_no: index + 2,
          item_name: itemName,
          opening_stock_raw: openingStock,
          closing_stock_raw: closingStock,
          header_order: headerOrder,
          raw_data: rawData,
          source_file: fileName,
        });
      });
    }

    if (!rowsForInsert.length) {
      return NextResponse.json(
        { error: '업로드할 데이터 행이 없습니다. (헤더 제외 최소 1행 필요)' },
        { status: 400 }
      );
    }

    const chunkSize = 500;
    for (let i = 0; i < rowsForInsert.length; i += chunkSize) {
      const chunk = rowsForInsert.slice(i, i + chunkSize);
      const { error } = await db.from('inventory_volume_raw').insert(chunk);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      data: {
        insertedCount: rowsForInsert.length,
        sheetCount: Object.keys(headersBySheet).length,
        headersBySheet,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '물동량 업로드 실패';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
