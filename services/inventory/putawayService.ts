import { logger } from '@/lib/logger';
import type { SupabaseClient } from '@supabase/supabase-js';

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
}
