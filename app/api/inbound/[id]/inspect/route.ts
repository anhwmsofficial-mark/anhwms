import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requirePermission } from '@/utils/rbac';
import { logAudit } from '@/utils/audit';
import { toAppApiError } from '@/lib/api/errors';
import { fail, ok } from '@/lib/api/response';

/**
 * 입고 검수 처리 API
 * POST /api/inbound/[id]/inspect
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params; // inbound_id
    const body = await req.json();
    const { 
      receivedQty, 
      rejectedQty, 
      condition, 
      note, 
      photos, 
      completeInbound 
    } = body;

    // 1. 권한 체크 (입고 처리는 staff 이상)
    await requirePermission('inventory:count', req); // 또는 inventory:inspect

    const supabase = await createClient();
    const db = supabase as unknown as { from: (table: string) => any };
    const { data: { user } } = await supabase.auth.getUser();

    // 2. 입고 건 조회
    const { data: inbound, error: fetchError } = await db
      .from('inbounds')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !inbound) {
      return fail('NOT_FOUND', 'Inbound order not found', { status: 404 });
    }

    if (inbound.status === 'completed') {
        return fail('BAD_REQUEST', 'Already completed', { status: 400 });
    }

    // 3. 검수 기록 저장
    const { error: inspectError } = await db
      .from('inbound_inspections')
      .insert({
        inbound_id: id,
        product_id: inbound.product_id,
        expected_qty: inbound.quantity,
        received_qty: receivedQty,
        rejected_qty: rejectedQty || 0,
        condition: condition || 'GOOD',
        inspector_id: user?.id,
        note,
        photos
      });

    if (inspectError) throw inspectError;

    // 4. 입고 상태 업데이트 (부분 검수 또는 완료)
    const updates: any = {
        received_quantity: (inbound.received_quantity || 0) + receivedQty,
        updated_at: new Date().toISOString()
    };

    // 검수 상태 판단
    if (rejectedQty > 0 || condition !== 'GOOD') {
        updates.inspection_status = 'PARTIAL'; // 또는 이슈 있음 표시
    } else {
        updates.inspection_status = 'PASSED';
    }

    // 완료 처리 요청 시
    if (completeInbound) {
        updates.status = 'completed';
        updates.actual_arrival_date = new Date().toISOString();
        
        // 최종 상태 결정 (전량 입고 vs 부분 입고)
        if (updates.received_quantity < inbound.quantity) {
             updates.inspection_status = 'PARTIAL'; 
        }
    }

    const { data: updatedInbound, error: updateError } = await db
        .from('inbounds')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (updateError) throw updateError;

    // 5. Audit Log
    await logAudit({
        actionType: 'UPDATE',
        resourceType: 'inventory', // 입고도 재고 관련
        resourceId: id,
        oldValue: inbound,
        newValue: updatedInbound,
        reason: `Inbound Inspection: Received ${receivedQty}, Rejected ${rejectedQty}`
    });

    return ok({ success: true, inbound: updatedInbound });

  } catch (error: unknown) {
    const apiError = toAppApiError(error, {
      error: '검수 처리 실패',
      code: 'INTERNAL_ERROR',
      status: 500,
    });
    return fail(apiError.code || 'INTERNAL_ERROR', apiError.message, {
      status: apiError.status,
      details: apiError.details,
    });
  }
}

