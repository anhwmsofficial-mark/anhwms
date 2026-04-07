import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { logAudit } from '@/utils/audit';
import { DirectionSchema, LedgerMovementInputSchema } from '@/lib/schemas/inventoryLedger';
import { getErrorMessage } from '@/lib/errorHandler';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import { createRequestLogger } from '@/lib/api/request-log';
import { INVENTORY_MOVEMENT_DIRECTION_MAP } from '@/lib/inventory-definitions';
import {
  assertProductBelongsToOrg,
  assertWarehouseBelongsToOrg,
  requireAdminRouteContext,
} from '@/lib/server/admin-ownership';

export async function POST(request: NextRequest) {
  const ctx = getRouteContext(request, 'POST /api/admin/inventory/movements');
  let actor: string | null = null;
  let tenantId: string | null = null;
  const requestLog = createRequestLogger({
    requestId: ctx.requestId,
    route: ctx.route,
    action: 'inventory_movement_create',
  });

  try {
    const adminContext = await requireAdminRouteContext('inventory:adjust', request);
    const supabase = await createClient();
    const dbUntyped = supabase as unknown as {
      from: (table: string) => any;
    };
    actor = adminContext.userId;

    const rawBody = await request.json();
    const parsed = LedgerMovementInputSchema.safeParse(rawBody);
    if (!parsed.success) {
      return fail('BAD_REQUEST', '유효하지 않은 요청입니다.', {
        status: 400,
        details: parsed.error.flatten(),
      });
    }

    const input = parsed.data;
    const warehouse = await assertWarehouseBelongsToOrg(dbUntyped, input.warehouseId, adminContext.orgId);
    await assertProductBelongsToOrg(dbUntyped, input.productId, adminContext.orgId);
    tenantId = warehouse.org_id || adminContext.orgId;
    const resolvedDirection =
      input.direction ??
      DirectionSchema.parse(INVENTORY_MOVEMENT_DIRECTION_MAP[input.movementType] === 'IN' ? 'IN' : 'OUT');

    const qtyChange = resolvedDirection === 'IN' ? input.quantity : -input.quantity;

    const { data: currentQtyRow, error: currentQtyError } = await dbUntyped
      .from('inventory_quantities')
      .select('qty_on_hand, qty_available, qty_allocated')
      .eq('warehouse_id', input.warehouseId)
      .eq('product_id', input.productId)
      .maybeSingle();

    if (currentQtyError) {
      return fail('INTERNAL_ERROR', currentQtyError.message, { status: 500 });
    }

    const currentOnHand = currentQtyRow?.qty_on_hand ?? 0;
    const currentAvailable = currentQtyRow?.qty_available ?? 0;
    const currentAllocated = currentQtyRow?.qty_allocated ?? 0;
    const nextOnHand = currentOnHand + qtyChange;
    const nextAvailable = Math.max(0, currentAvailable + qtyChange);

    if (nextOnHand < 0) {
      return fail('BAD_REQUEST', '재고는 음수가 될 수 없습니다.', { status: 400 });
    }

    const { data: ledgerRow, error: ledgerError } = await dbUntyped
      .from('inventory_ledger')
      .insert({
        org_id: tenantId,
        tenant_id: tenantId,
        warehouse_id: input.warehouseId,
        product_id: input.productId,
        transaction_type:
          input.movementType === 'INBOUND'
            ? 'INBOUND'
            : input.movementType === 'OUTBOUND'
            ? 'OUTBOUND'
            : input.movementType === 'TRANSFER'
            ? 'TRANSFER'
            : input.movementType === 'RETURN_B2C' || input.movementType === 'OUTBOUND_CANCEL_IN'
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
        created_by: adminContext.userId,
      })
      .select('id')
      .single();

    if (ledgerError) {
      const duplicate = ledgerError.message?.toLowerCase().includes('uq_inventory_ledger_tenant_idempotency');
      return fail(duplicate ? 'CONFLICT' : 'INTERNAL_ERROR', duplicate ? '중복 요청입니다. (idempotency_key)' : ledgerError.message, {
        status: duplicate ? 409 : 500,
      });
    }

    const { error: qtyError } = await dbUntyped
      .from('inventory_quantities')
      .upsert(
        {
          org_id: tenantId,
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
      return fail('INTERNAL_ERROR', qtyError.message, { status: 500 });
    }

    await dbUntyped
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

    requestLog.success({ actor, tenantId });
    return ok({
      ledgerId: ledgerRow.id,
      currentStock: nextOnHand,
    }, { requestId: ctx.requestId });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const apiError = requestLog.failure(error, {
      error: message || '재고 이동 저장 실패',
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
