import { NextRequest } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { requirePermission } from '@/utils/rbac';
import { parseIntegerInput } from '@/utils/number-format';
import { getErrorMessage } from '@/lib/errorHandler';
import { fail, ok } from '@/lib/api/response';

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
  try {
    await requirePermission('inventory:adjust', request);
    const db = createAdminClient();
    const dbUntyped = db as unknown as {
      from: (table: string) => any;
    };
    const body = await request.json().catch(() => ({}));

    const tenantId = String(body?.tenantId || '').trim();
    const warehouseId = String(body?.warehouseId || '').trim();
    const sourceFileName = body?.sourceFileName ? String(body.sourceFileName).trim() : null;
    const rows = Array.isArray(body?.rows) ? (body.rows as UploadRow[]) : [];

    if (!tenantId || !warehouseId) {
      return fail('BAD_REQUEST', 'tenantId, warehouseId는 필수입니다.', { status: 400 });
    }
    if (rows.length === 0) {
      return fail('BAD_REQUEST', 'rows가 비어 있습니다.', { status: 400 });
    }

    const inserts = rows
      .map((row, idx) => {
        const productId = String(row.productId || '').trim();
        if (!productId) return null;
        const insertRow: StagingInsertRow = {
          tenant_id: tenantId,
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

    return ok({
      inserted: inserts.length,
      sourceFileName,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message.includes('Unauthorized') ? 403 : 500;
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR', message || 'staging 업로드 실패', { status });
  }
}
