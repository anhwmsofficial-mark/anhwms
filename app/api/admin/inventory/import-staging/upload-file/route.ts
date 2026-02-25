import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createAdminClient } from '@/utils/supabase/admin';
import { requirePermission } from '@/utils/rbac';
import { parseIntegerInput } from '@/utils/number-format';

export const runtime = 'nodejs';

type ParsedRow = {
  product_sku: string;
  product_barcode?: string;
  occurred_at?: string;
  opening_stock: number;
  inbound_qty: number;
  disposal_qty: number;
  damage_qty: number;
  return_b2c_qty: number;
  outbound_qty: number;
  adjustment_plus_qty: number;
  adjustment_minus_qty: number;
  bundle_break_in_qty: number;
  bundle_break_out_qty: number;
  export_pickup_qty: number;
  outbound_cancel_qty: number;
  memo?: string;
  raw_row_no: number;
};

const toInt = (value: unknown) => parseIntegerInput(value) ?? 0;

function normalizeHeader(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function findHeaderIndex(headers: string[], candidates: string[]): number {
  return headers.findIndex((h) => candidates.some((candidate) => h.includes(candidate)));
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission('inventory:adjust');
    const db = createAdminClient();

    const form = await request.formData();
    const tenantId = String(form.get('tenantId') || '').trim();
    const warehouseId = String(form.get('warehouseId') || '').trim();
    const sourceFileName = String(form.get('sourceFileName') || '').trim();
    const dryRun = String(form.get('dryRun') || '').toLowerCase() === 'true';
    const previewLimit = Math.min(Math.max(Number(form.get('previewLimit') || 30), 1), 200);
    const resolveMapRaw = String(form.get('resolveMap') || '').trim();
    const file = form.get('file');

    if (!tenantId || !warehouseId) {
      return NextResponse.json({ error: 'tenantId, warehouseId는 필수입니다.' }, { status: 400 });
    }
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: '업로드 파일이 필요합니다.' }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const workbook = XLSX.read(bytes, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as unknown[][];

    if (!matrix || matrix.length < 2) {
      return NextResponse.json({ error: '엑셀 데이터가 비어 있습니다.' }, { status: 400 });
    }

    const headers = (matrix[0] || []).map((cell) => normalizeHeader(cell));
    const skuIndex = findHeaderIndex(headers, ['sku', 'product_sku', '상품코드']);
    const barcodeIndex = findHeaderIndex(headers, ['barcode', 'product_barcode', '바코드']);
    const occurredAtIndex = findHeaderIndex(headers, ['occurred_at', 'date', '일자', '기준일']);

    if (skuIndex === -1) {
      return NextResponse.json({ error: 'SKU 컬럼을 찾을 수 없습니다.' }, { status: 400 });
    }

    const idx = {
      opening_stock: findHeaderIndex(headers, ['opening_stock', '전일재고', '초기재고']),
      inbound_qty: findHeaderIndex(headers, ['inbound_qty', '입고']),
      disposal_qty: findHeaderIndex(headers, ['disposal_qty', '폐기']),
      damage_qty: findHeaderIndex(headers, ['damage_qty', '파손']),
      return_b2c_qty: findHeaderIndex(headers, ['return_b2c_qty', '반품']),
      outbound_qty: findHeaderIndex(headers, ['outbound_qty', '택배', '출고']),
      adjustment_plus_qty: findHeaderIndex(headers, ['adjustment_plus_qty', '재고조정(+)', '조정(+)']),
      adjustment_minus_qty: findHeaderIndex(headers, ['adjustment_minus_qty', '재고조정(-)', '조정(-)']),
      bundle_break_in_qty: findHeaderIndex(headers, ['bundle_break_in_qty', '번들해체(+)']),
      bundle_break_out_qty: findHeaderIndex(headers, ['bundle_break_out_qty', '번들해체(-)']),
      export_pickup_qty: findHeaderIndex(headers, ['export_pickup_qty', '수출픽업']),
      outbound_cancel_qty: findHeaderIndex(headers, ['outbound_cancel_qty', '출고취소']),
      memo: findHeaderIndex(headers, ['memo', 'note', '비고']),
    };

    const parsedRows: ParsedRow[] = matrix
      .slice(1)
      .map((row, i) => {
        const sku = String(row[skuIndex] || '').trim();
        if (!sku) return null;
        return {
          product_sku: sku,
          product_barcode: barcodeIndex >= 0 ? String(row[barcodeIndex] || '').trim() : undefined,
          occurred_at: occurredAtIndex >= 0 ? String(row[occurredAtIndex] || '').trim() : undefined,
          opening_stock: idx.opening_stock >= 0 ? toInt(row[idx.opening_stock]) : 0,
          inbound_qty: idx.inbound_qty >= 0 ? toInt(row[idx.inbound_qty]) : 0,
          disposal_qty: idx.disposal_qty >= 0 ? toInt(row[idx.disposal_qty]) : 0,
          damage_qty: idx.damage_qty >= 0 ? toInt(row[idx.damage_qty]) : 0,
          return_b2c_qty: idx.return_b2c_qty >= 0 ? toInt(row[idx.return_b2c_qty]) : 0,
          outbound_qty: idx.outbound_qty >= 0 ? toInt(row[idx.outbound_qty]) : 0,
          adjustment_plus_qty: idx.adjustment_plus_qty >= 0 ? toInt(row[idx.adjustment_plus_qty]) : 0,
          adjustment_minus_qty: idx.adjustment_minus_qty >= 0 ? toInt(row[idx.adjustment_minus_qty]) : 0,
          bundle_break_in_qty: idx.bundle_break_in_qty >= 0 ? toInt(row[idx.bundle_break_in_qty]) : 0,
          bundle_break_out_qty: idx.bundle_break_out_qty >= 0 ? toInt(row[idx.bundle_break_out_qty]) : 0,
          export_pickup_qty: idx.export_pickup_qty >= 0 ? toInt(row[idx.export_pickup_qty]) : 0,
          outbound_cancel_qty: idx.outbound_cancel_qty >= 0 ? toInt(row[idx.outbound_cancel_qty]) : 0,
          memo: idx.memo >= 0 ? String(row[idx.memo] || '').trim() : undefined,
          raw_row_no: i + 2,
        };
      })
      .filter(Boolean) as ParsedRow[];

    if (parsedRows.length === 0) {
      return NextResponse.json({ error: '유효한 데이터 행이 없습니다.' }, { status: 400 });
    }

    let resolveMap: Record<string, string> = {};
    if (resolveMapRaw) {
      try {
        const parsed = JSON.parse(resolveMapRaw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          resolveMap = Object.fromEntries(
            Object.entries(parsed).map(([sku, productId]) => [
              String(sku || '').trim(),
              String(productId || '').trim(),
            ]),
          );
        }
      } catch {
        return NextResponse.json({ error: 'resolveMap JSON 형식이 올바르지 않습니다.' }, { status: 400 });
      }
    }

    const skuSet = Array.from(new Set(parsedRows.map((row) => row.product_sku)));
    const { data: skuProducts, error: skuError } = await db
      .from('products')
      .select('id, sku, barcode')
      .in('sku', skuSet);
    if (skuError) {
      return NextResponse.json({ error: skuError.message }, { status: 500 });
    }

    const skuMap = new Map<string, { id: string; sku: string; barcode?: string }>();
    for (const product of (skuProducts || []) as any[]) {
      skuMap.set(String(product.sku), product);
    }

    const resolveProductIds = Array.from(new Set(Object.values(resolveMap).filter(Boolean)));
    const resolveIdSet = new Set<string>();
    if (resolveProductIds.length > 0) {
      const { data: mappedProducts, error: mapError } = await db
        .from('products')
        .select('id')
        .in('id', resolveProductIds);
      if (mapError) {
        return NextResponse.json({ error: mapError.message }, { status: 500 });
      }
      for (const row of (mappedProducts || []) as any[]) {
        resolveIdSet.add(String(row.id));
      }
    }

    const unresolved: Array<{ rawRowNo: number; sku: string; reason: string }> = [];
    const inserts = parsedRows
      .map((row) => {
        const matched = skuMap.get(row.product_sku);
        const mappedProductId = resolveMap[row.product_sku];
        const resolvedFromMap = mappedProductId && resolveIdSet.has(mappedProductId) ? mappedProductId : null;
        const productId = matched?.id || resolvedFromMap;
        if (!productId) {
          unresolved.push({
            rawRowNo: row.raw_row_no,
            sku: row.product_sku,
            reason: mappedProductId ? 'resolveMap productId 미존재' : 'SKU 미매칭',
          });
          return null;
        }
        return {
          tenant_id: tenantId,
          warehouse_id: warehouseId,
          product_id: productId,
          occurred_at: row.occurred_at || new Date().toISOString(),
          raw_row_no: row.raw_row_no,
          opening_stock: row.opening_stock,
          inbound_qty: row.inbound_qty,
          disposal_qty: row.disposal_qty,
          damage_qty: row.damage_qty,
          return_b2c_qty: row.return_b2c_qty,
          outbound_qty: row.outbound_qty,
          adjustment_plus_qty: row.adjustment_plus_qty,
          adjustment_minus_qty: row.adjustment_minus_qty,
          bundle_break_in_qty: row.bundle_break_in_qty,
          bundle_break_out_qty: row.bundle_break_out_qty,
          export_pickup_qty: row.export_pickup_qty,
          outbound_cancel_qty: row.outbound_cancel_qty,
          memo: row.memo || null,
          source_file_name: sourceFileName || file.name,
        };
      })
      .filter(Boolean) as any[];

    const preview = inserts.slice(0, previewLimit).map((row) => ({
      product_id: row.product_id,
      occurred_at: row.occurred_at,
      opening_stock: row.opening_stock,
      inbound_qty: row.inbound_qty,
      disposal_qty: row.disposal_qty,
      damage_qty: row.damage_qty,
      return_b2c_qty: row.return_b2c_qty,
      outbound_qty: row.outbound_qty,
      adjustment_plus_qty: row.adjustment_plus_qty,
      adjustment_minus_qty: row.adjustment_minus_qty,
      bundle_break_in_qty: row.bundle_break_in_qty,
      bundle_break_out_qty: row.bundle_break_out_qty,
      export_pickup_qty: row.export_pickup_qty,
      outbound_cancel_qty: row.outbound_cancel_qty,
      memo: row.memo,
      source_file_name: row.source_file_name,
    }));

    if (inserts.length === 0) {
      return NextResponse.json(
        { error: '적재 가능한 행이 없습니다.', unresolved: unresolved.slice(0, 50) },
        { status: 400 },
      );
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        selectedRows: parsedRows.length,
        insertableRows: inserts.length,
        unresolvedCount: unresolved.length,
        unresolved: unresolved.slice(0, 200),
        preview,
        sourceFileName: sourceFileName || file.name,
      });
    }

    const { error: insertError } = await db.from('inventory_ledger_staging').insert(inserts);
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      inserted: inserts.length,
      unresolvedCount: unresolved.length,
      unresolved: unresolved.slice(0, 50),
      sourceFileName: sourceFileName || file.name,
    });
  } catch (error: any) {
    const status = String(error?.message || '').includes('Unauthorized') ? 403 : 500;
    return NextResponse.json(
      { error: error?.message || '엑셀 staging 업로드 실패' },
      { status },
    );
  }
}
