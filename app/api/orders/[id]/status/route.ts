import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requirePermission } from '@/utils/rbac';
import { logAudit } from '@/utils/audit';
import { fail, getRouteContext, ok } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { canTransitionOrderStatus } from '@/lib/domain/orderState';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getRouteContext(req, 'POST /api/orders/[id]/status');
  try {
    const { id } = await params;
    const body = await req.json();
    const { status, reason, onHold } = body;

    if (!id) {
      return fail('BAD_REQUEST', 'Order ID required', { status: 400, requestId: ctx.requestId });
    }

    // 1. 권한 체크
    // 상태 변경은 staff 이상, 취소/보류는 manager 이상 권장되나 여기서는 update:order_status로 통일 후 로직 분기
    await requirePermission('update:order_status', req);

    const supabase = await createClient();

    // 2. 현재 주문 조회
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !order) {
      return fail('NOT_FOUND', 'Order not found', { status: 404, requestId: ctx.requestId });
    }

    const currentStatus = order.status;
    const updates: any = { updated_at: new Date().toISOString() };
    let actionType: 'UPDATE' | 'CANCEL' | 'HOLD' = 'UPDATE';

    // 3. 보류(Hold) 처리 로직
    if (typeof onHold === 'boolean') {
      if (onHold) {
        // 보류 설정
        updates.on_hold = true;
        updates.hold_reason = reason;
        actionType = 'HOLD';
      } else {
        // 보류 해제
        updates.on_hold = false;
        updates.hold_reason = null; // 기록을 남기려면 별도 히스토리 테이블 권장, 여기선 현재 상태만
        actionType = 'HOLD'; // Unhold
      }
    }

    // 4. 상태 변경(Status Change) 로직
    if (status && status !== currentStatus) {
      // 취소(CANCELLED)는 별도 처리
      if (status === 'CANCELLED') {
        if (['SHIPPED', 'DELIVERED'].includes(currentStatus)) {
          return fail(
            'VALIDATION_ERROR',
            'Cannot cancel shipped/delivered order. Use Return Request.',
            { status: 400, requestId: ctx.requestId }
          );
        }
        updates.status = 'CANCELLED';
        updates.cancelled_at = new Date().toISOString();
        const { data: { user } } = await supabase.auth.getUser();
        updates.cancelled_by = user?.id;
        updates.cancelled_reason = reason;
        actionType = 'CANCEL';
      } else {
        if (!canTransitionOrderStatus(currentStatus, status)) {
          return fail(
            'VALIDATION_ERROR',
            `Invalid status transition: ${currentStatus} -> ${status}`,
            { status: 400, requestId: ctx.requestId }
          );
        }
        updates.status = status;
      }
    }

    if (Object.keys(updates).length <= 1) {
      return ok({ message: 'No changes detected' }, { requestId: ctx.requestId });
    }

    // 5. DB 업데이트
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // 6. Audit Log
    await logAudit({
      actionType: actionType === 'CANCEL' ? 'DELETE' : 'UPDATE', // Audit type mapping
      resourceType: 'orders',
      resourceId: id,
      oldValue: order,
      newValue: updatedOrder,
      reason: reason || (actionType === 'HOLD' ? `Hold changed to ${onHold}` : `Status changed to ${status}`)
    });

    return ok(updatedOrder, { requestId: ctx.requestId });

  } catch (error: any) {
    logger.error(error as Error, { ...ctx, scope: 'api' });
    const status = error?.message?.includes('Unauthorized') ? 403 : 500;
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR', error?.message || '업데이트 실패', {
      status,
      requestId: ctx.requestId,
    });
  }
}

