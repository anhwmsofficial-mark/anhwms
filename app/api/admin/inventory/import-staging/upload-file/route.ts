import { NextRequest } from 'next/server';
import * as XLSX from 'xlsx';
import { parseIntegerInput } from '@/utils/number-format';
import { getErrorMessage } from '@/lib/errorHandler';
import { AppApiError, ERROR_CODES } from '@/lib/api/errors';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import { createRequestLogger } from '@/lib/api/request-log';
import {
  assertProductIdsBelongToOrg,
  assertWarehouseBelongsToOrg,
  requireAdminRouteContext,
} from '@/lib/server/admin-ownership';
import { UPLOAD_POLICIES, validateUploadInput } from '@/lib/upload/validation';

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

type ProductLookupRow = {
  id: string;
  sku: string;
  barcode?: string;
  customer_id?: string | null;
};

type StagingUploadRow = {
  tenant_id: string;
  warehouse_id: string;
  product_id: string;
  occurred_at: string;
  raw_row_no: number;
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
  memo: string | null;
  source_file_name: string;
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
  const ctx = getRouteContext(request, 'POST /api/admin/inventory/import-staging/upload-file');
  let tenantId: string | null = null;
  const requestLog = createRequestLogger({
    requestId: ctx.requestId,
    route: ctx.route,
    action: 'inventory_staging_upload_file',
  });

  try {
    const { db, orgId } = await requireAdminRouteContext('inventory:adjust', request);
    const dbUntyped = db as unknown as {
      from: (table: string) => any;
    };

    const form = await request.formData();
    const warehouseId = String(form.get('warehouseId') || '').trim();
    const sourceFileName = String(form.get('sourceFileName') || '').trim();
    const dryRun = String(form.get('dryRun') || '').toLowerCase() === 'true';
    const previewLimit = Math.min(Math.max(Number(form.get('previewLimit') || 30), 1), 200);
    const resolveMapRaw = String(form.get('resolveMap') || '').trim();
    const file = form.get('file');

    if (!warehouseId) {
      throw new AppApiError({ error: 'warehouseId는 필수입니다.', code: 'BAD_REQUEST', status: 400 });
    }
    if (!file || !(file instanceof File)) {
      throw new AppApiError({ error: '업로드 파일이 필요합니다.', code: 'BAD_REQUEST', status: 400 });
    }

    const warehouse = await assertWarehouseBelongsToOrg(db, warehouseId, orgId);
    tenantId = warehouse.org_id;
    if (!tenantId) {
      throw new AppApiError({ error: '현재 조직의 창고만 사용할 수 있습니다.', code: ERROR_CODES.FORBIDDEN, status: 403 });
    }

    // 1. Validate File Constraints
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    const MAX_ROWS = 1000;
    const ALLOWED_MIME_TYPES = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
      'application/vnd.ms-excel', // xls
      'text/csv', // csv
    ];

    if (file.size > MAX_FILE_SIZE) {
      throw new AppApiError({
        error: `파일 크기는 5MB를 초과할 수 없습니다. (현재: ${(file.size / 1024 / 1024).toFixed(2)}MB)`,
        code: ERROR_CODES.FILE_TOO_LARGE,
        status: 400,
      });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
       throw new AppApiError({
        error: '지원하지 않는 파일 형식입니다. (xlsx, xls, csv만 가능)',
        code: ERROR_CODES.INVALID_FILE,
        status: 400,
      });
    }

    validateUploadInput({
      fileName: file.name || sourceFileName || 'inventory-staging.xlsx',
      mimeType: file.type,
      size: file.size,
      policy: UPLOAD_POLICIES.inventorySpreadsheet,
    });

    const bytes = new Uint8Array(await file.arrayBuffer());
    const workbook = XLSX.read(bytes, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as unknown[][];

    if (!matrix || matrix.length < 2) {
      throw new AppApiError({ error: '엑셀 데이터가 비어 있습니다.', code: ERROR_CODES.BAD_REQUEST, status: 400 });
    }

    if (matrix.length > MAX_ROWS + 1) { // header row 포함
      throw new AppApiError({
        error: `처리 가능한 최대 행 개수는 ${MAX_ROWS}개입니다. (현재: ${matrix.length - 1}개)`,
        code: ERROR_CODES.ROW_LIMIT_EXCEEDED,
        status: 400,
      });
    }

    const headers = (matrix[0] || []).map((cell) => normalizeHeader(cell));
    const skuIndex = findHeaderIndex(headers, ['sku', 'product_sku', '상품코드']);
    const barcodeIndex = findHeaderIndex(headers, ['barcode', 'product_barcode', '바코드']);
    const occurredAtIndex = findHeaderIndex(headers, ['occurred_at', 'date', '일자', '기준일']);

    if (skuIndex === -1) {
      throw new AppApiError({ error: 'SKU 컬럼을 찾을 수 없습니다.', code: 'BAD_REQUEST', status: 400 });
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
      throw new AppApiError({ error: '유효한 데이터 행이 없습니다.', code: 'BAD_REQUEST', status: 400 });
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
        throw new AppApiError({ error: 'resolveMap JSON 형식이 올바르지 않습니다.', code: 'BAD_REQUEST', status: 400 });
      }
    }

    const skuSet = Array.from(new Set(parsedRows.map((row) => row.product_sku)));
    const { data: skuProducts, error: skuError } = await db
      .from('products')
      .select('id, sku, barcode, customer_id')
      .in('sku', skuSet);
    if (skuError) {
      throw new AppApiError({ error: skuError.message, code: 'INTERNAL_ERROR', status: 500 });
    }

    const customerIds = Array.from(
      new Set(
        ((skuProducts || []) as ProductLookupRow[])
          .map((product) => String(product.customer_id || ''))
          .filter(Boolean),
      ),
    );
    const { data: customers, error: customerError } = await dbUntyped
      .from('customer_master')
      .select('id, org_id')
      .in('id', customerIds);
    if (customerError) {
      throw new AppApiError({ error: customerError.message, code: 'INTERNAL_ERROR', status: 500 });
    }
    const allowedCustomerIds = new Set(
      ((customers || []) as Array<{ id: string; org_id: string | null }>)
        .filter((customer) => customer.org_id === orgId)
        .map((customer) => String(customer.id)),
    );

    const skuMap = new Map<string, ProductLookupRow>();
    for (const product of (skuProducts || []) as ProductLookupRow[]) {
      if (!allowedCustomerIds.has(String(product.customer_id || ''))) {
        continue;
      }
      skuMap.set(String(product.sku), product);
    }

    const resolveProductIds = Array.from(new Set(Object.values(resolveMap).filter(Boolean)));
    const resolveIdSet = new Set<string>();
    if (resolveProductIds.length > 0) {
      await assertProductIdsBelongToOrg(db, resolveProductIds, orgId);
      resolveProductIds.forEach((id) => resolveIdSet.add(String(id)));
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
      .filter((row): row is StagingUploadRow => row !== null);

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
      throw new AppApiError({
        error: '적재 가능한 행이 없습니다.',
        code: 'BAD_REQUEST',
        status: 400,
        details: { unresolved: unresolved.slice(0, 50) },
      });
    }

    if (dryRun) {
      requestLog.success({ tenantId });
      return ok({
        dryRun: true,
        selectedRows: parsedRows.length,
        insertableRows: inserts.length,
        unresolvedCount: unresolved.length,
        unresolved: unresolved.slice(0, 200),
        preview,
        sourceFileName: sourceFileName || file.name,
      }, { requestId: ctx.requestId });
    }

    const { error: insertError } = await db
      .from('inventory_ledger_staging')
      .insert(inserts);
    if (insertError) {
      throw new AppApiError({ error: insertError.message, code: 'INTERNAL_ERROR', status: 500 });
    }

    requestLog.success({ tenantId });
    return ok({
      inserted: inserts.length,
      unresolvedCount: unresolved.length,
      unresolved: unresolved.slice(0, 50),
      sourceFileName: sourceFileName || file.name,
    }, { requestId: ctx.requestId });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const apiError = requestLog.failure(error, {
      error: message || '엑셀 staging 업로드 실패',
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
