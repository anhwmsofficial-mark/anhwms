import { createHash } from 'crypto';
import { NextRequest } from 'next/server';
import { getErrorMessage } from '@/lib/errorHandler';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import { createRequestLogger } from '@/lib/api/request-log';
import { requireAdminRouteContext } from '@/lib/server/admin-ownership';

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
  const ctx = getRouteContext(request, 'POST /api/admin/inventory/import-staging');
  let tenantId: string | null = null;
  let actor: string | null = null;
  const requestLog = createRequestLogger({
    requestId: ctx.requestId,
    route: ctx.route,
    action: 'inventory_staging_import',
  });

  try {
    const { db, userId, orgId } = await requireAdminRouteContext('inventory:adjust', request);
    actor = userId;
    const dbUntyped = db as unknown as {
      from: (table: string) => any;
    };
    const body = await request.json().catch(() => ({}));

    tenantId = orgId;
    const sourceFileName = body?.sourceFileName ? String(body.sourceFileName).trim() : null;
    const dryRun = Boolean(body?.dryRun);
    const limit = Math.min(Math.max(Number(body?.limit || 1000), 1), 5000);

    let query = dbUntyped
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
      await dbUntyped.from('inventory_import_runs').insert({
        tenant_id: tenantId,
        source_file_name: sourceFileName,
        dry_run: dryRun,
        requested_limit: limit,
        status: 'FAILED',
        error_message: stagingError.message,
        requested_by: userId,
      });
      return fail('INTERNAL_ERROR', stagingError.message, { status: 500 });
    }

    const rows = (stagingRows || []) as StagingMovementRow[];
    if (rows.length === 0) {
      await dbUntyped
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
          requested_by: userId,
        })
        .select('id')
        .single();
      return ok({ imported: 0, skipped: 0, dryRun });
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
      const { data: run } = await dbUntyped
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
          requested_by: userId,
          metadata: { dryRun: true },
        })
        .select('id')
        .single();
      return ok({
        dryRun: true,
        previewCount: payloads.length,
        sample: payloads.slice(0, 10),
        runId: run?.id ?? null,
      }, { requestId: ctx.requestId });
    }

    const { data: inserted, error: insertError } = await db
      .from('inventory_ledger')
      .upsert(payloads, { onConflict: 'tenant_id,idempotency_key', ignoreDuplicates: true })
      .select('id');

    if (insertError) {
      await dbUntyped.from('inventory_import_runs').insert({
        tenant_id: tenantId,
        source_file_name: sourceFileName,
        dry_run: false,
        requested_limit: limit,
        selected_count: payloads.length,
        imported_count: 0,
        skipped_count: payloads.length,
        status: 'FAILED',
        error_message: insertError.message,
        requested_by: userId,
      });
      return fail('INTERNAL_ERROR', insertError.message, { status: 500 });
    }

    const importedCount = inserted?.length || 0;
    const skippedCount = payloads.length - importedCount;
    const { data: run } = await dbUntyped
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
        requested_by: userId,
        metadata: { dryRun: false },
      })
      .select('id')
      .single();

    requestLog.success({ actor, tenantId });
    return ok({
      imported: importedCount,
      skipped: skippedCount,
      total: payloads.length,
      dryRun: false,
      runId: run?.id ?? null,
    }, { requestId: ctx.requestId });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const apiError = requestLog.failure(error, {
      error: message || 'staging import 실패',
      code: 'INTERNAL_ERROR',
      status: 500,
    }, { actor, tenantId });
    return fail(apiError.code || 'INTERNAL_ERROR', apiError.message, {
      status: apiError.status,
      requestId: ctx.requestId,
      details: apiError.details,
    });
  }
}
