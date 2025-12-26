import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requirePermission } from '@/utils/rbac';
import { logAudit } from '@/utils/audit';
import { Order } from '@/types';

// 상태 전이 규칙 (허용되는 다음 상태)
const STATE_TRANSITIONS: Record<string, string[]> = {
  'CREATED': ['APPROVED', 'CANCELLED', 'FAILED'],
  'APPROVED': ['ALLOCATED', 'CANCELLED', 'on_hold'],
  'ALLOCATED': ['PICKED', 'CANCELLED', 'on_hold'],
  'PICKED': ['PACKED', 'CANCELLED'], // 피킹 후 취소는 주의 필요
  'PACKED': ['SHIPPED', 'CANCELLED'], // 패킹 후 취소는 재고 복구 필요
  'SHIPPED': ['DELIVERED', 'RETURN_REQ'], // 배송 중 취소 불가
  'DELIVERED': ['RETURN_REQ'],
  'CANCELLED': [], // 종결 상태
  'FAILED': ['CREATED'], // 재시도
  'SYNCED': ['APPROVED', 'CANCELLED'], // 레거시 호환
  'PUSHED': ['SYNCED', 'FAILED'], // 레거시 호환
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status, reason, onHold } = body;

    if (!id) {
      return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
    }

    // 1. 권한 체크
    // 상태 변경은 staff 이상, 취소/보류는 manager 이상 권장되나 여기서는 update:order_status로 통일 후 로직 분기
    await requirePermission('update:order_status');

    const supabase = await createClient();

    // 2. 현재 주문 조회
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
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
      // 4-1. 상태 전이 유효성 검사
      // 관리자 오버라이드(override=true) 파라미터가 있다면 무시 가능하나, 기본은 검사
      const allowedNext = STATE_TRANSITIONS[currentStatus] || [];
      // SYNCED, PUSHED 등 레거시 상태에 대한 유연한 처리 필요시 로직 추가
      
      // 취소(CANCELLED)는 별도 처리
      if (status === 'CANCELLED') {
        if (['SHIPPED', 'DELIVERED'].includes(currentStatus)) {
          return NextResponse.json(
            { error: 'Cannot cancel shipped/delivered order. Use Return Request.' },
            { status: 400 }
          );
        }
        updates.status = 'CANCELLED';
        updates.cancelled_at = new Date().toISOString();
        const { data: { user } } = await supabase.auth.getUser();
        updates.cancelled_by = user?.id;
        updates.cancelled_reason = reason;
        actionType = 'CANCEL';
      } else {
        // 일반 상태 변경
        /* 
           엄격한 상태 전이 규칙 적용 시:
           if (!allowedNext.includes(status) && !body.override) { ... error ... }
           현재는 유연하게 허용하되 로그만 남김
        */
        updates.status = status;
      }
    }

    if (Object.keys(updates).length <= 1) {
      return NextResponse.json({ message: 'No changes detected' });
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

    return NextResponse.json(updatedOrder);

  } catch (error: any) {
    console.error('Update Order Status Error:', error);
    const status = error.message.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json(
      { error: error.message || '업데이트 실패' },
      { status }
    );
  }
}

