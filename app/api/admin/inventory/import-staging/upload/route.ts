import { NextRequest } from 'next/server';
import { parseIntegerInput } from '@/utils/number-format';
import { getErrorMessage } from '@/lib/errorHandler';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import { createRequestLogger } from '@/lib/api/request-log';
import {
  assertProductIdsBelongToOrg,
  assertWarehouseBelongsToOrg,
  requireAdminRouteContext,
} from '@/lib/server/admin-ownership';

type UploadRow = {
  productId: string;
  occurredAt?: string;
  rawRowNo?: number;
  openingStock?: number;
  inboundQty?: number;
  disposalQty?: number;
  damageQty?: number;
  returnB2cQty?: number;
  outboundQty?: number;
  adjustmentPlusQty?: number;
  adjustmentMinusQty?: number;
  bundleBreakInQty?: number;
  bundleBreakOutQty?: number;
  exportPickupQty?: number;
  outboundCancelQty?: number;
  memo?: string;
};

type StagingInsertRow = {
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
  source_file_name: string | null;
};

const toInt = (value: unknown) => parseIntegerInput(value) ?? 0;

export async function POST(request: NextRequest) {
  const ctx = getRouteContext(request, 'POST /api/admin/inventory/import-staging/upload');
  let tenantId: string | null = null;
  const requestLog = createRequestLogger({
    requestId: ctx.requestId,
    route: ctx.route,
    action: 'inventory_staging_upload',
  });

  try {
    const { db, orgId } = await requireAdminRouteContext('inventory:adjust', request);
    const dbUntyped = db as unknown as {
      from: (table: string) => any;
    };
    const body = await request.json().catch(() => ({}));

    const warehouseId = String(body?.warehouseId || '').trim();
    const sourceFileName = body?.sourceFileName ? String(body.sourceFileName).trim() : null;
    const rows = Array.isArray(body?.rows) ? (body.rows as UploadRow[]) : [];

    if (!warehouseId) {
      return fail('BAD_REQUEST', 'warehouseId는 필수입니다.', { status: 400 });
    }
    if (rows.length === 0) {
      return fail('BAD_REQUEST', 'rows가 비어 있습니다.', { status: 400 });
    }

    const warehouse = await assertWarehouseBelongsToOrg(dbUntyped, warehouseId, orgId);
    tenantId = warehouse.org_id || orgId;
    if (!tenantId) {
      return fail('FORBIDDEN', '현재 조직의 창고만 사용할 수 있습니다.', { status: 403 });
    }
    const effectiveTenantId = tenantId;
    await assertProductIdsBelongToOrg(
      dbUntyped,
      rows.map((row) => String(row.productId || '').trim()).filter(Boolean),
      orgId,
    );

    const inserts = rows
      .map((row, idx) => {
        const productId = String(row.productId || '').trim();
        if (!productId) return null;
        const insertRow: StagingInsertRow = {
          tenant_id: effectiveTenantId,
          warehouse_id: warehouseId,
          product_id: productId,
          occurred_at: row.occurredAt || new Date().toISOString(),
          raw_row_no: row.rawRowNo ?? idx + 1,
          opening_stock: toInt(row.openingStock),
          inbound_qty: toInt(row.inboundQty),
          disposal_qty: toInt(row.disposalQty),
          damage_qty: toInt(row.damageQty),
          return_b2c_qty: toInt(row.returnB2cQty),
          outbound_qty: toInt(row.outboundQty),
          adjustment_plus_qty: toInt(row.adjustmentPlusQty),
          adjustment_minus_qty: toInt(row.adjustmentMinusQty),
          bundle_break_in_qty: toInt(row.bundleBreakInQty),
          bundle_break_out_qty: toInt(row.bundleBreakOutQty),
          export_pickup_qty: toInt(row.exportPickupQty),
          outbound_cancel_qty: toInt(row.outboundCancelQty),
          memo: row.memo || null,
          source_file_name: sourceFileName,
        };
        return insertRow;
      })
      .filter((row): row is StagingInsertRow => row !== null);

    if (inserts.length === 0) {
      return fail('BAD_REQUEST', '유효한 productId가 포함된 행이 없습니다.', { status: 400 });
    }

    const { error } = await dbUntyped.from('inventory_ledger_staging').insert(inserts as unknown);
    if (error) {
      return fail('INTERNAL_ERROR', error.message, { status: 500 });
    }

    requestLog.success({ tenantId });
    return ok({
      inserted: inserts.length,
      sourceFileName,
    }, { requestId: ctx.requestId });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const apiError = requestLog.failure(error, {
      error: message || 'staging 업로드 실패',
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
