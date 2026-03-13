import { logger } from '@/lib/logger';
import type { SupabaseClient } from '@supabase/supabase-js';

type PutawayTaskRow = {
  id: string;
  org_id: string;
  warehouse_id: string;
  receipt_id: string;
  receipt_line_id: string | null;
  product_id: string;
  qty_expected: number | string | null;
  qty_processed: number | string | null;
  status: string | null;
};

type InventoryQuantitySnapshot = {
  qty_on_hand: number | string | null;
};

type LegacyInventoryRow = {
  location_id: string | null;
  qty_on_hand: number | string | null;
};

type PutawayTaskProgressRow = {
  id: string;
  qty_expected: number | string | null;
  qty_processed: number | string | null;
  status: string | null;
};

function toSafeNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function runPutawayShadowValidation(
  db: SupabaseClient,
  task: PutawayTaskRow,
  qty: number,
  locationId: string,
  userId: string,
) {
  try {
    const [inventoryQuantitiesResult, legacyInventoryResult, relatedTasksResult] = await Promise.all([
      db
        .from('inventory_quantities')
        .select('qty_on_hand')
        .eq('warehouse_id', task.warehouse_id)
        .eq('product_id', task.product_id)
        .maybeSingle(),
      db
        .from('inventory')
        .select('location_id, qty_on_hand')
        .eq('warehouse_id', task.warehouse_id)
        .eq('product_id', task.product_id),
      db
        .from('putaway_tasks')
        .select('id, qty_expected, qty_processed, status')
        .eq('receipt_id', task.receipt_id)
        .eq('product_id', task.product_id),
    ]);

    if (inventoryQuantitiesResult.error) {
      throw inventoryQuantitiesResult.error;
    }
    if (legacyInventoryResult.error) {
      throw legacyInventoryResult.error;
    }
    if (relatedTasksResult.error) {
      throw relatedTasksResult.error;
    }

    const inventoryQuantities = inventoryQuantitiesResult.data as InventoryQuantitySnapshot | null;
    const legacyInventoryRows = (legacyInventoryResult.data || []) as LegacyInventoryRow[];
    const relatedTasks = (relatedTasksResult.data || []) as PutawayTaskProgressRow[];

    const warehouseOnHand = toSafeNumber(inventoryQuantities?.qty_on_hand);
    const legacyOnHand = legacyInventoryRows.reduce((sum, row) => sum + toSafeNumber(row.qty_on_hand), 0);
    const targetLocationOnHand = legacyInventoryRows
      .filter((row) => row.location_id === locationId)
      .reduce((sum, row) => sum + toSafeNumber(row.qty_on_hand), 0);
    const completedQtyTotal = relatedTasks
      .filter((row) => row.status === 'COMPLETED')
      .reduce((sum, row) => sum + toSafeNumber(row.qty_processed), 0);
    const expectedQtyTotal = relatedTasks.reduce((sum, row) => sum + toSafeNumber(row.qty_expected), 0);

    const mismatches: Array<{ code: string; details: Record<string, unknown> }> = [];

    if (task.status === 'COMPLETED') {
      mismatches.push({
        code: 'task-already-completed',
        details: {
          taskStatusBeforeUpdate: task.status,
          requestedQty: qty,
        },
      });
    }

    if (qty > toSafeNumber(task.qty_expected)) {
      mismatches.push({
        code: 'task-qty-exceeds-expected',
        details: {
          requestedQty: qty,
          qtyExpected: toSafeNumber(task.qty_expected),
        },
      });
    }

    if (completedQtyTotal > expectedQtyTotal) {
      mismatches.push({
        code: 'completed-qty-exceeds-expected-total',
        details: {
          completedQtyTotal,
          expectedQtyTotal,
        },
      });
    }

    // Shadow validation only: compare legacy location-based stock with warehouse-level totals.
    if (legacyOnHand !== warehouseOnHand) {
      mismatches.push({
        code: 'warehouse-on-hand-drift',
        details: {
          legacyOnHand,
          warehouseOnHand,
        },
      });
    }

    if (mismatches.length === 0) {
      return;
    }

    logger.warn('Putaway shadow validation detected mismatches', {
      scope: 'putaway',
      action: 'shadowValidation',
      taskId: task.id,
      receiptId: task.receipt_id,
      receiptLineId: task.receipt_line_id,
      productId: task.product_id,
      warehouseId: task.warehouse_id,
      locationId,
      userId,
      requestedQty: qty,
      targetLocationOnHand,
      warehouseOnHand,
      legacyOnHand,
      completedQtyTotal,
      expectedQtyTotal,
      mismatches,
    });
  } catch (error) {
    logger.error(error as Error, {
      scope: 'putaway',
      action: 'shadowValidation',
      taskId: task.id,
      receiptId: task.receipt_id,
      productId: task.product_id,
      warehouseId: task.warehouse_id,
      locationId,
      userId,
    });
  }
}

export async function getPutawayTasksService(db: SupabaseClient, warehouseId?: string) {
  let query = db
    .from('putaway_tasks')
    .select(
      `
      *,
      product:products(name, sku, barcode),
      receipt:inbound_receipts(receipt_no, client:client_id(name)),
      to_location:location!putaway_tasks_to_location_id_fkey(code)
    `,
    )
    .order('created_at', { ascending: true });

  if (warehouseId) {
    query = query.eq('warehouse_id', warehouseId);
  }

  const { data, error } = await query;
  if (error) {
    logger.error(error, { scope: 'putaway', action: 'getPutawayTasks' });
    return [];
  }

  return data;
}

export async function getLocationsService(db: SupabaseClient, warehouseId: string, search?: string) {
  let query = db
    .from('location')
    .select('id, code, type, zone, status')
    .eq('warehouse_id', warehouseId)
    .eq('status', 'ACTIVE');

  if (search) {
    query = query.ilike('code', `%${search}%`);
  }

  const { data, error } = await query.limit(20);
  if (error) {
    logger.error(error, { scope: 'putaway', action: 'getLocations' });
    return [];
  }

  return data;
}

export async function assignLocationService(db: SupabaseClient, taskId: string, locationId: string) {
  const { error } = await db
    .from('putaway_tasks')
    .update({ to_location_id: locationId })
    .eq('id', taskId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function completePutawayService(
  db: SupabaseClient,
  taskId: string,
  qty: number,
  locationId: string,
  userId: string,
) {
  const { data: task, error: taskError } = await db
    .from('putaway_tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (taskError || !task) {
    throw new Error('Task not found');
  }

  const taskRow = task as PutawayTaskRow;

  const { error: updateError } = await db
    .from('putaway_tasks')
    .update({
      status: 'COMPLETED',
      qty_processed: qty,
      to_location_id: locationId,
      processed_by: userId,
      completed_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { data: inventory, error: invError } = await db
    .from('inventory')
    .select('*')
    .eq('warehouse_id', task.warehouse_id)
    .eq('location_id', locationId)
    .eq('product_id', task.product_id)
    .maybeSingle();

  if (invError) {
    throw new Error(invError.message);
  }

  let invResult;
  if (inventory) {
    invResult = await db
      .from('inventory')
      .update({
        qty_on_hand: Number(inventory.qty_on_hand) + qty,
        updated_at: new Date().toISOString(),
      })
      .eq('id', inventory.id);
  } else {
    invResult = await db.from('inventory').insert({
      warehouse_id: task.warehouse_id,
      location_id: locationId,
      product_id: task.product_id,
      qty_on_hand: qty,
      qty_allocated: 0,
    });
  }

  if (invResult.error) {
    logger.error(invResult.error, { scope: 'putaway', action: 'updateInventory' });
    throw new Error(`Task completed but inventory update failed: ${invResult.error.message}`);
  }

  await db.from('inventory_ledger').insert({
    org_id: task.org_id,
    warehouse_id: task.warehouse_id,
    product_id: task.product_id,
    transaction_type: 'TRANSFER',
    qty_change: qty,
    reference_type: 'PUTAWAY_TASK',
    reference_id: taskId,
    notes: `Putaway to ${locationId}`,
    created_by: userId,
  });

  await runPutawayShadowValidation(db, taskRow, qty, locationId, userId);
}
