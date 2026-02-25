import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { requirePermission } from '@/utils/rbac';
import { parseIntegerInput } from '@/utils/number-format';

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

const toInt = (value: unknown) => parseIntegerInput(value) ?? 0;

export async function POST(request: NextRequest) {
  try {
    await requirePermission('inventory:adjust');
    const db = createAdminClient();
    const body = await request.json().catch(() => ({}));

    const tenantId = String(body?.tenantId || '').trim();
    const warehouseId = String(body?.warehouseId || '').trim();
    const sourceFileName = body?.sourceFileName ? String(body.sourceFileName).trim() : null;
    const rows = Array.isArray(body?.rows) ? (body.rows as UploadRow[]) : [];

    if (!tenantId || !warehouseId) {
      return NextResponse.json({ error: 'tenantId, warehouseId는 필수입니다.' }, { status: 400 });
    }
    if (rows.length === 0) {
      return NextResponse.json({ error: 'rows가 비어 있습니다.' }, { status: 400 });
    }

    const inserts = rows
      .map((row, idx) => {
        const productId = String(row.productId || '').trim();
        if (!productId) return null;
        return {
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
      })
      .filter(Boolean) as any[];

    if (inserts.length === 0) {
      return NextResponse.json({ error: '유효한 productId가 포함된 행이 없습니다.' }, { status: 400 });
    }

    const { error } = await db.from('inventory_ledger_staging').insert(inserts);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      inserted: inserts.length,
      sourceFileName,
    });
  } catch (error: any) {
    const status = String(error?.message || '').includes('Unauthorized') ? 403 : 500;
    return NextResponse.json(
      { error: error?.message || 'staging 업로드 실패' },
      { status },
    );
  }
}
