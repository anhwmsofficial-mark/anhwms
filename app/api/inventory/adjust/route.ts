/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requirePermission } from '@/utils/rbac';
import { logAudit } from '@/utils/audit';
import { parseIntegerInput } from '@/utils/number-format';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import { logger } from '@/lib/logger';

/**
 * 재고 조정 API (Inventory Adjustment)
 * POST /api/inventory/adjust
 */
export async function POST(req: NextRequest) {
  const ctx = getRouteContext(req, 'POST /api/inventory/adjust');
  try {
    // 1. 권한 체크 (재고 조정은 민감 작업이므로 manager 이상 권장)
    await requirePermission('inventory:adjust');

    const body = await req.json();
    const { productId, adjustType, quantity, reason, warehouseId } = body;
    // adjustType: 'INCREASE' | 'DECREASE' | 'SET'

    const parsedQty = parseIntegerInput(quantity);
    if (!productId || !adjustType || parsedQty === null) {
      return fail('BAD_REQUEST', 'Missing required fields', { status: 400, requestId: ctx.requestId });
    }
    if (!['INCREASE', 'DECREASE', 'SET'].includes(adjustType)) {
      return fail('VALIDATION_ERROR', 'Invalid adjustType', { status: 400, requestId: ctx.requestId });
    }
    if (parsedQty < 0) {
      return fail('VALIDATION_ERROR', 'quantity must be >= 0', { status: 400, requestId: ctx.requestId });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('id, name, sku, location')
      .eq('id', productId)
      .single();
    if (fetchError || !product) {
      return fail('NOT_FOUND', 'Product not found', { status: 404, requestId: ctx.requestId });
    }

    let targetWarehouseId = warehouseId as string | undefined;
    if (!targetWarehouseId) {
      const { data: warehouse } = await supabase
        .from('warehouse')
        .select('id')
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      targetWarehouseId = warehouse?.id;
    }
    if (!targetWarehouseId) {
      return fail('BAD_REQUEST', 'Warehouse not found', { status: 400, requestId: ctx.requestId });
    }

    const { data: warehouseInfo } = await supabase
      .from('warehouse')
      .select('id, org_id')
      .eq('id', targetWarehouseId)
      .single();
    if (!warehouseInfo) {
      return fail('NOT_FOUND', 'Warehouse not found', { status: 404, requestId: ctx.requestId });
    }

    const { data: qtyRow } = await supabase
      .from('inventory_quantities')
      .select('qty_on_hand, qty_available, qty_allocated')
      .eq('warehouse_id', targetWarehouseId)
      .eq('product_id', productId)
      .maybeSingle();

    const currentQty = qtyRow?.qty_on_hand ?? 0;
    const currentAvailable = qtyRow?.qty_available ?? 0;
    const currentAllocated = qtyRow?.qty_allocated ?? 0;

    let changeAmount = 0;
    let newQuantity = 0;

    if (adjustType === 'SET') {
      newQuantity = parsedQty;
      changeAmount = parsedQty - currentQty;
    } else if (adjustType === 'INCREASE') {
      changeAmount = Math.abs(parsedQty);
      newQuantity = currentQty + changeAmount;
    } else if (adjustType === 'DECREASE') {
      changeAmount = -Math.abs(parsedQty);
      newQuantity = currentQty + changeAmount;
    }

    if (changeAmount === 0) {
      return ok({ message: 'No change in quantity' }, { requestId: ctx.requestId });
    }

    if (adjustType === 'DECREASE' && Math.abs(changeAmount) > currentAvailable) {
      return fail('VALIDATION_ERROR', 'Insufficient available stock for decrease', {
        status: 400,
        requestId: ctx.requestId,
        details: {
          currentAvailable,
          requestedDecrease: Math.abs(changeAmount),
        },
      });
    }

    if (newQuantity < 0) {
      return fail('VALIDATION_ERROR', 'Stock cannot be negative', {
        status: 400,
        requestId: ctx.requestId,
      });
    }

    if (adjustType === 'SET' && newQuantity < currentAllocated) {
      return fail('VALIDATION_ERROR', 'SET quantity cannot be lower than allocated stock', {
        status: 400,
        requestId: ctx.requestId,
        details: {
          currentAllocated,
          requestedOnHand: newQuantity,
        },
      });
    }

    const { data: ledgerEntry, error: ledgerError } = await supabase
      .from('inventory_ledger')
      .insert({
        org_id: warehouseInfo.org_id,
        tenant_id: warehouseInfo.org_id,
        warehouse_id: targetWarehouseId,
        product_id: productId,
        transaction_type: 'ADJUSTMENT',
        movement_type:
          adjustType === 'INCREASE' ? 'ADJUSTMENT_PLUS' : adjustType === 'DECREASE' ? 'ADJUSTMENT_MINUS' : (changeAmount >= 0 ? 'ADJUSTMENT_PLUS' : 'ADJUSTMENT_MINUS'),
        direction: changeAmount >= 0 ? 'IN' : 'OUT',
        quantity: Math.abs(changeAmount),
        qty_change: changeAmount,
        balance_after: newQuantity,
        reference_type: 'ADJUSTMENT',
        reference_id: null,
        memo: reason,
        notes: reason,
        created_by: user?.id,
      })
      .select()
      .single();

    if (ledgerError) throw ledgerError;

    // 4. 현재고 업데이트 (warehouse-level)
    const nextAvailable = newQuantity - currentAllocated;
    if (nextAvailable < 0) {
      return fail('VALIDATION_ERROR', 'Available stock cannot be negative after adjustment', {
        status: 400,
        requestId: ctx.requestId,
        details: {
          newQuantity,
          currentAllocated,
          nextAvailable,
        },
      });
    }
    const { error: qtyError } = await supabase
      .from('inventory_quantities')
      .upsert({
        org_id: warehouseInfo.org_id,
        warehouse_id: targetWarehouseId,
        product_id: productId,
        qty_on_hand: newQuantity,
        qty_available: nextAvailable,
        qty_allocated: currentAllocated,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'warehouse_id,product_id' });
    if (qtyError) throw qtyError;

    // 5. products.quantity 동기화 (legacy)
    const { error: productSyncError } = await supabase
      .from('products')
      .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
      .eq('id', productId);
    if (productSyncError) throw productSyncError;

    // 6. Audit Log (관리자 감사용)
    await logAudit({
      actionType: 'UPDATE',
      resourceType: 'inventory',
      resourceId: productId,
      oldValue: { quantity: currentQty },
      newValue: { quantity: newQuantity },
      reason: `Stock Adjustment (${adjustType}): ${reason}`
    });

    return ok({
      success: true, 
      currentStock: newQuantity,
      ledgerId: ledgerEntry.id 
    }, { requestId: ctx.requestId });

  } catch (error: any) {
    logger.error(error as Error, { ...ctx, scope: 'api' });
    const status = error.message.includes('Unauthorized') ? 403 : 500;
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR', error.message || '재고 조정 실패', {
      status,
      requestId: ctx.requestId,
    });
  }
}

