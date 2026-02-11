import { NextRequest } from 'next/server';
import * as XLSX from 'xlsx';
import { createAdminClient } from '@/utils/supabase/admin';
import { verifyPassword } from '@/lib/share';

type ShareRow = {
  customer_id: string;
  date_from: string | null;
  date_to: string | null;
  expires_at: string | null;
  password_hash: string | null;
  password_salt: string | null;
};

type VolumeRawRow = {
  sheet_name: string | null;
  header_order: string[] | null;
  raw_data: Record<string, unknown> | null;
  record_date: string | null;
  row_no: number | null;
};

function isExpired(expiresAt?: string | null) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = String(searchParams.get('slug') || '').trim();
  const password = String(searchParams.get('password') || '').trim();

  if (!slug) {
    return new Response('slug가 필요합니다.', { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('inventory_volume_share')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !data) {
    return new Response('공유 링크를 찾을 수 없습니다.', { status: 404 });
  }

  const share = data as ShareRow;
  if (isExpired(share.expires_at)) {
    return new Response('공유 링크가 만료되었습니다.', { status: 410 });
  }

  if (share.password_hash && share.password_salt) {
    if (!password) {
      return new Response('비밀번호가 필요합니다.', { status: 401 });
    }
    const ok = verifyPassword(password, share.password_salt, share.password_hash);
    if (!ok) {
      return new Response('비밀번호가 올바르지 않습니다.', { status: 401 });
    }
  }

  let query = db
    .from('inventory_volume_raw')
    .select('sheet_name, header_order, raw_data, record_date, row_no')
    .eq('customer_id', share.customer_id)
    .order('record_date', { ascending: true, nullsFirst: false })
    .order('sheet_name', { ascending: true })
    .order('row_no', { ascending: true })
    .limit(50000);

  if (share.date_from) query = query.gte('record_date', share.date_from);
  if (share.date_to) query = query.lte('record_date', share.date_to);

  const rowsRes = await query;
  if (rowsRes.error) {
    return new Response(rowsRes.error.message, { status: 500 });
  }
  if (!rowsRes.data || !rowsRes.data.length) {
    return new Response('다운로드할 데이터가 없습니다.', { status: 404 });
  }

  const sheetMap = new Map<string, Record<string, unknown>[]>();
  const headersMap = new Map<string, string[]>();

  (rowsRes.data as VolumeRawRow[]).forEach((row) => {
    const sheetName = String(row.sheet_name || 'Sheet1');
    const headerOrder = Array.isArray(row.header_order) ? row.header_order.map(String) : [];
    if (!sheetMap.has(sheetName)) sheetMap.set(sheetName, []);
    if (!headersMap.has(sheetName)) headersMap.set(sheetName, headerOrder);
    sheetMap.get(sheetName)!.push(row.raw_data || {});
  });

  const workbook = XLSX.utils.book_new();
  for (const [sheetName, rows] of sheetMap.entries()) {
    const headers = headersMap.get(sheetName) || Object.keys(rows[0] || {});
    const aoa: unknown[][] = [headers];
    rows.forEach((raw) => aoa.push(headers.map((h) => raw[h] ?? '')));
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(workbook, ws, sheetName.slice(0, 31) || 'Sheet1');
  }

  const output = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return new Response(output, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="inventory_shared_${slug}.xlsx"`,
    },
  });
}
