import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requirePermission } from '@/utils/rbac';
import { logAudit } from '@/utils/audit';
import { DirectionSchema, LedgerMovementInputSchema } from '@/lib/schemas/inventoryLedger';

export async function POST(request: NextRequest) {
  try {
    await requirePermission('inventory:adjust', request);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const rawBody = await request.json();
    const parsed = LedgerMovementInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: '유효하지 않은 요청입니다.', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const input = parsed.data;
    const resolvedDirection =
      input.direction ??
      DirectionSchema.parse(
        ['INVENTORY_INIT', 'INBOUND', 'OUTBOUND_CANCEL', 'RETURN_B2C', 'ADJUSTMENT_PLUS', 'BUNDLE_BREAK_IN'].includes(
          input.movementType,
        )
          ? 'IN'
          : 'OUT',
      );

    const qtyChange = resolvedDirection === 'IN' ? input.quantity : -input.quantity;

    const { data: currentQtyRow, error: currentQtyError } = await supabase
      .from('inventory_quantities')
      .select('qty_on_hand, qty_available, qty_allocated')
      .eq('warehouse_id', input.warehouseId)
      .eq('product_id', input.productId)
      .maybeSingle();

    if (currentQtyError) {
      return NextResponse.json({ error: currentQtyError.message }, { status: 500 });
    }

    const currentOnHand = currentQtyRow?.qty_on_hand ?? 0;
    const currentAvailable = currentQtyRow?.qty_available ?? 0;
    const currentAllocated = currentQtyRow?.qty_allocated ?? 0;
    const nextOnHand = currentOnHand + qtyChange;
    const nextAvailable = Math.max(0, currentAvailable + qtyChange);

    if (nextOnHand < 0) {
      return NextResponse.json({ error: '재고는 음수가 될 수 없습니다.' }, { status: 400 });
    }

    const { data: ledgerRow, error: ledgerError } = await supabase
      .from('inventory_ledger')
      .insert({
        org_id: input.tenantId,
        tenant_id: input.tenantId,
        warehouse_id: input.warehouseId,
        product_id: input.productId,
        transaction_type:
          input.movementType === 'INBOUND'
            ? 'INBOUND'
            : input.movementType === 'OUTBOUND'
            ? 'OUTBOUND'
            : input.movementType === 'TRANSFER'
            ? 'TRANSFER'
            : input.movementType === 'RETURN_B2C' || input.movementType === 'OUTBOUND_CANCEL'
            ? 'RETURN'
            : 'ADJUSTMENT',
        movement_type: input.movementType,
        direction: resolvedDirection,
        quantity: input.quantity,
        qty_change: qtyChange,
        balance_after: nextOnHand,
        reference_type: input.referenceType ?? 'MANUAL',
        reference_id: input.referenceId ?? null,
        memo: input.memo ?? null,
        notes: input.memo ?? null,
        idempotency_key: input.idempotencyKey ?? null,
        created_by: user?.id ?? null,
      })
      .select('id')
      .single();

    if (ledgerError) {
      const duplicate = ledgerError.message?.toLowerCase().includes('uq_inventory_ledger_tenant_idempotency');
      return NextResponse.json(
        { error: duplicate ? '중복 요청입니다. (idempotency_key)' : ledgerError.message },
        { status: duplicate ? 409 : 500 },
      );
    }

    const { error: qtyError } = await supabase
      .from('inventory_quantities')
      .upsert(
        {
          org_id: input.tenantId,
          warehouse_id: input.warehouseId,
          product_id: input.productId,
          qty_on_hand: nextOnHand,
          qty_available: nextAvailable,
          qty_allocated: currentAllocated,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'warehouse_id,product_id' },
      );

    if (qtyError) {
      return NextResponse.json({ error: qtyError.message }, { status: 500 });
    }

    await supabase
      .from('products')
      .update({ quantity: nextOnHand, updated_at: new Date().toISOString() })
      .eq('id', input.productId);

    await logAudit({
      actionType: 'UPDATE',
      resourceType: 'inventory',
      resourceId: ledgerRow.id,
      oldValue: { qty_on_hand: currentOnHand },
      newValue: { qty_on_hand: nextOnHand, movement_type: input.movementType, quantity: input.quantity },
      reason: input.memo ?? `Inventory movement: ${input.movementType}`,
    });

    return NextResponse.json({
      success: true,
      ledgerId: ledgerRow.id,
      currentStock: nextOnHand,
    });
  } catch (error: any) {
    const status = String(error?.message || '').includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ error: error?.message || '재고 이동 저장 실패' }, { status });
  }
}
