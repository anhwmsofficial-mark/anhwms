import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requirePermission } from '@/utils/rbac';
import { logAudit } from '@/utils/audit';

/**
 * 재고 조정 API (Inventory Adjustment)
 * POST /api/inventory/adjust
 */
export async function POST(req: NextRequest) {
  try {
    // 1. 권한 체크 (재고 조정은 민감 작업이므로 manager 이상 권장)
    await requirePermission('update:inventory');

    const body = await req.json();
    const { productId, adjustType, quantity, reason, warehouseId } = body;
    // adjustType: 'INCREASE' | 'DECREASE' | 'SET'

    if (!productId || !adjustType || quantity === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('id, name, sku, location')
      .eq('id', productId)
      .single();
    if (fetchError || !product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

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
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 400 });
    }

    const { data: warehouseInfo } = await supabase
      .from('warehouse')
      .select('id, org_id')
      .eq('id', targetWarehouseId)
      .single();
    if (!warehouseInfo) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 });
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
      newQuantity = quantity;
      changeAmount = quantity - currentQty;
    } else if (adjustType === 'INCREASE') {
      changeAmount = Math.abs(quantity);
      newQuantity = currentQty + changeAmount;
    } else if (adjustType === 'DECREASE') {
      changeAmount = -Math.abs(quantity);
      newQuantity = currentQty + changeAmount;
    }

    if (changeAmount === 0) {
      return NextResponse.json({ message: 'No change in quantity' });
    }

    if (newQuantity < 0) {
      return NextResponse.json({ error: 'Stock cannot be negative' }, { status: 400 });
    }

    const { data: ledgerEntry, error: ledgerError } = await supabase
      .from('inventory_ledger')
      .insert({
        org_id: warehouseInfo.org_id,
        warehouse_id: targetWarehouseId,
        product_id: productId,
        transaction_type: 'ADJUSTMENT',
        qty_change: changeAmount,
        balance_after: newQuantity,
        reference_type: 'ADJUSTMENT',
        reference_id: null,
        notes: reason,
        created_by: user?.id,
      })
      .select()
      .single();

    if (ledgerError) throw ledgerError;

    // 4. 현재고 업데이트 (warehouse-level)
    const nextAvailable = Math.max(0, currentAvailable + changeAmount);
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
    await supabase
      .from('products')
      .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
      .eq('id', productId);

    // 6. Audit Log (관리자 감사용)
    await logAudit({
      actionType: 'UPDATE',
      resourceType: 'inventory',
      resourceId: productId,
      oldValue: { quantity: currentQty },
      newValue: { quantity: newQuantity },
      reason: `Stock Adjustment (${adjustType}): ${reason}`
    });

    return NextResponse.json({ 
      success: true, 
      currentStock: newQuantity,
      ledgerId: ledgerEntry.id 
    });

  } catch (error: any) {
    console.error('Inventory Adjust Error:', error);
    const status = error.message.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json(
      { error: error.message || '재고 조정 실패' },
      { status }
    );
  }
}

