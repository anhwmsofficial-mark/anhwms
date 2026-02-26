import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { requirePermission } from '@/utils/rbac';
import { createClient } from '@/utils/supabase/server';

type StagingMovementRow = {
  tenant_id: string;
  warehouse_id: string;
  product_id: string;
  occurred_at: string;
  raw_row_no: number | null;
  memo: string | null;
  source_file_name: string | null;
  movement_type: string;
  direction: 'IN' | 'OUT';
  quantity: number;
};

export async function POST(request: NextRequest) {
  try {
    await requirePermission('inventory:adjust', request);
    const serverClient = await createClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();
    const db = createAdminClient();
    const body = await request.json().catch(() => ({}));

    const tenantId = String(body?.tenantId || '').trim();
    const sourceFileName = body?.sourceFileName ? String(body.sourceFileName).trim() : null;
    const dryRun = Boolean(body?.dryRun);
    const limit = Math.min(Math.max(Number(body?.limit || 1000), 1), 5000);

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId는 필수입니다.' }, { status: 400 });
    }

    let query = db
      .from('v_inventory_ledger_staging_movements')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('occurred_at', { ascending: true })
      .limit(limit);

    if (sourceFileName) {
      query = query.eq('source_file_name', sourceFileName);
    }

    const { data: stagingRows, error: stagingError } = await query;
    if (stagingError) {
      await db.from('inventory_import_runs').insert({
        tenant_id: tenantId,
        source_file_name: sourceFileName,
        dry_run: dryRun,
        requested_limit: limit,
        status: 'FAILED',
        error_message: stagingError.message,
        requested_by: user?.id ?? null,
      });
      return NextResponse.json({ error: stagingError.message }, { status: 500 });
    }

    const rows = (stagingRows || []) as StagingMovementRow[];
    if (rows.length === 0) {
      const { data: run } = await db
        .from('inventory_import_runs')
        .insert({
          tenant_id: tenantId,
          source_file_name: sourceFileName,
          dry_run: dryRun,
          requested_limit: limit,
          selected_count: 0,
          imported_count: 0,
          skipped_count: 0,
          status: 'SUCCESS',
          requested_by: user?.id ?? null,
        })
        .select('id')
        .single();
      return NextResponse.json({ success: true, imported: 0, skipped: 0, dryRun });
    }

    const payloads = rows.map((row) => {
      const idempotencyKey = createHash('md5')
        .update(
          [
            row.tenant_id,
            row.warehouse_id,
            row.product_id,
            row.occurred_at,
            row.raw_row_no ?? '',
            row.movement_type,
            row.direction,
            String(row.quantity),
            row.source_file_name ?? '',
          ].join('|'),
        )
        .digest('hex');

      const qtyChange = row.direction === 'IN' ? row.quantity : -row.quantity;

      return {
        org_id: row.tenant_id,
        tenant_id: row.tenant_id,
        warehouse_id: row.warehouse_id,
        product_id: row.product_id,
        transaction_type:
          row.movement_type === 'INBOUND'
            ? 'INBOUND'
            : row.movement_type === 'OUTBOUND'
            ? 'OUTBOUND'
            : row.movement_type === 'TRANSFER'
            ? 'TRANSFER'
            : row.movement_type === 'RETURN_B2C' || row.movement_type === 'OUTBOUND_CANCEL'
            ? 'RETURN'
            : 'ADJUSTMENT',
        movement_type: row.movement_type,
        direction: row.direction,
        quantity: row.quantity,
        qty_change: qtyChange,
        reference_type: 'EXCEL_IMPORT',
        reference_id: null,
        memo: row.memo ?? null,
        notes: row.memo ?? null,
        idempotency_key: idempotencyKey,
        created_at: row.occurred_at,
      };
    });

    if (dryRun) {
      const { data: run } = await db
        .from('inventory_import_runs')
        .insert({
          tenant_id: tenantId,
          source_file_name: sourceFileName,
          dry_run: true,
          requested_limit: limit,
          selected_count: payloads.length,
          imported_count: payloads.length,
          skipped_count: 0,
          status: 'SUCCESS',
          requested_by: user?.id ?? null,
          metadata: { dryRun: true },
        })
        .select('id')
        .single();
      return NextResponse.json({
        success: true,
        dryRun: true,
        previewCount: payloads.length,
        sample: payloads.slice(0, 10),
        runId: run?.id ?? null,
      });
    }

    const { data: inserted, error: insertError } = await db
      .from('inventory_ledger')
      .upsert(payloads, { onConflict: 'tenant_id,idempotency_key', ignoreDuplicates: true })
      .select('id');

    if (insertError) {
      await db.from('inventory_import_runs').insert({
        tenant_id: tenantId,
        source_file_name: sourceFileName,
        dry_run: false,
        requested_limit: limit,
        selected_count: payloads.length,
        imported_count: 0,
        skipped_count: payloads.length,
        status: 'FAILED',
        error_message: insertError.message,
        requested_by: user?.id ?? null,
      });
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const importedCount = inserted?.length || 0;
    const skippedCount = payloads.length - importedCount;
    const { data: run } = await db
      .from('inventory_import_runs')
      .insert({
        tenant_id: tenantId,
        source_file_name: sourceFileName,
        dry_run: false,
        requested_limit: limit,
        selected_count: payloads.length,
        imported_count: importedCount,
        skipped_count: skippedCount,
        status: 'SUCCESS',
        requested_by: user?.id ?? null,
        metadata: { dryRun: false },
      })
      .select('id')
      .single();

    return NextResponse.json({
      success: true,
      imported: importedCount,
      skipped: skippedCount,
      total: payloads.length,
      dryRun: false,
      runId: run?.id ?? null,
    });
  } catch (error: any) {
    const status = String(error?.message || '').includes('Unauthorized') ? 403 : 500;
    return NextResponse.json(
      { error: error?.message || 'staging import 실패' },
      { status },
    );
  }
}
