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
    const { productId, adjustType, quantity, reason, location } = body;
    // adjustType: 'INCREASE' | 'DECREASE' | 'SET'

    if (!productId || !adjustType || quantity === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // 2. 현재 재고 조회 (Lock 고려 필요하나 MVP는 단순 조회)
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (fetchError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    let changeAmount = 0;
    let newQuantity = 0;

    if (adjustType === 'SET') {
      newQuantity = quantity;
      changeAmount = quantity - product.quantity;
    } else if (adjustType === 'INCREASE') {
      changeAmount = Math.abs(quantity);
      newQuantity = product.quantity + changeAmount;
    } else if (adjustType === 'DECREASE') {
      changeAmount = -Math.abs(quantity);
      newQuantity = product.quantity + changeAmount;
    }

    if (changeAmount === 0) {
      return NextResponse.json({ message: 'No change in quantity' });
    }

    if (newQuantity < 0) {
      return NextResponse.json({ error: 'Stock cannot be negative' }, { status: 400 });
    }

    // 3. 재고 수불부(Ledger)에 기록 (트리거가 실제 products 테이블 업데이트)
    // migrations/10_inventory_ledger.sql 참조
    const { data: ledgerEntry, error: ledgerError } = await supabase
      .from('inventory_ledger')
      .insert({
        product_id: productId,
        type: 'ADJUSTMENT',
        quantity_change: changeAmount,
        quantity_after: newQuantity,
        location: location || product.location,
        reason: reason,
        actor_id: user?.id
      })
      .select()
      .single();

    if (ledgerError) throw ledgerError;

    // 4. Audit Log (관리자 감사용)
    await logAudit({
      actionType: 'UPDATE',
      resourceType: 'inventory',
      resourceId: productId,
      oldValue: { quantity: product.quantity },
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

