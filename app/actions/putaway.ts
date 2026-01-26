'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getPutawayTasks(warehouseId?: string) {
  const supabase = await createClient();
  
  let query = supabase
    .from('putaway_tasks')
    .select(`
      *,
      product:products(name, sku, barcode),
      receipt:inbound_receipts(receipt_no, client:client_id(name)),
      to_location:location!putaway_tasks_to_location_id_fkey(code)
    `)
    .order('created_at', { ascending: true });

  if (warehouseId) {
    query = query.eq('warehouse_id', warehouseId);
  }

  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching putaway tasks:', error);
    return [];
  }

  return data;
}

export async function getLocations(warehouseId: string, search?: string) {
  const supabase = await createClient();
  
  let query = supabase
    .from('location')
    .select('id, code, type, zone, status')
    .eq('warehouse_id', warehouseId)
    .eq('status', 'ACTIVE');

  if (search) {
    query = query.ilike('code', `%${search}%`);
  }

  const { data, error } = await query.limit(20);
  
  if (error) {
    console.error('Error fetching locations:', error);
    return [];
  }

  return data;
}

export async function assignLocation(taskId: string, locationId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('putaway_tasks')
    .update({ to_location_id: locationId })
    .eq('id', taskId);

  if (error) return { error: error.message };
  revalidatePath('/inbound/putaway');
  return { success: true };
}

export async function completePutaway(taskId: string, qty: number, locationId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'Unauthorized' };

  // Transaction-like logic via RPC or sequential updates
  // Since we don't have a complex RPC for this yet, we'll do it sequentially
  // 1. Update Task
  // 2. Update Inventory
  
  const { data: task, error: taskError } = await supabase
    .from('putaway_tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (taskError || !task) return { error: 'Task not found' };

  // 1. Update Task
  const { error: updateError } = await supabase
    .from('putaway_tasks')
    .update({
      status: 'COMPLETED',
      qty_processed: qty,
      to_location_id: locationId,
      processed_by: user.id,
      completed_at: new Date().toISOString()
    })
    .eq('id', taskId);

  if (updateError) return { error: updateError.message };

  // 2. Update Inventory (Location Level)
  // Check if inventory exists
  const { data: inventory, error: invError } = await supabase
    .from('inventory')
    .select('*')
    .eq('warehouse_id', task.warehouse_id)
    .eq('location_id', locationId)
    .eq('product_id', task.product_id)
    .maybeSingle();

  let invResult;
  if (inventory) {
    // Update
    invResult = await supabase
      .from('inventory')
      .update({
        qty_on_hand: Number(inventory.qty_on_hand) + qty,
        updated_at: new Date().toISOString()
      })
      .eq('id', inventory.id);
  } else {
    // Insert
    invResult = await supabase
      .from('inventory')
      .insert({
        warehouse_id: task.warehouse_id,
        location_id: locationId,
        product_id: task.product_id,
        qty_on_hand: qty,
        qty_allocated: 0
      });
  }

  if (invResult.error) {
    // Rollback task? (Not possible easily without RPC, but rare failure)
    console.error('Inventory update failed:', invResult.error);
    return { error: 'Task completed but inventory update failed: ' + invResult.error.message };
  }

  // 3. Log to Ledger (using existing inventory_ledger)
  await supabase.from('inventory_ledger').insert({
    org_id: task.org_id,
    warehouse_id: task.warehouse_id,
    product_id: task.product_id,
    transaction_type: 'TRANSFER', // or INBOUND/PUTAWAY
    qty_change: qty,
    reference_type: 'PUTAWAY_TASK',
    reference_id: taskId,
    notes: `Putaway to ${locationId}`,
    created_by: user.id
  });

  revalidatePath('/inbound/putaway');
  return { success: true };
}
