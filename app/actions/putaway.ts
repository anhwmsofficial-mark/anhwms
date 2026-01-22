'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// 입고 완료된 건 조회 (적치 대기)
export async function getPutawayTasks(orgId: string) {
    const supabase = await createClient();
    const { data } = await supabase
        .from('inbound_receipts')
        .select(`
            *,
            lines:inbound_receipt_lines(
                id, product_id, received_qty,
                product:product_id(name, sku, location_code)
            )
        `)
        .eq('status', 'PUTAWAY_READY') // 적치 대기 대상
        .eq('org_id', orgId)
        .order('confirmed_at', { ascending: false });
    
    return data || [];
}

// 로케이션 적치 처리 (간소화)
export async function completePutaway(receiptId: string, locationData: any[]) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: receipt } = await supabase.from('inbound_receipts').select('org_id').eq('id', receiptId).single();
    
    // 1. 재고 위치 업데이트 (inventory_quantities 등)
    // 실제로는 ledger 추가 기록이나 quantity 테이블 location 필드 업데이트가 필요
    // 여기서는 로그만 남기고 상태 변경
    
    // 2. 상태 변경 (PUTAWAY_COMPLETED 등. 현재는 PUTAWAY_READY 상태가 없으므로 CONFIRMED에서 완료처리)
    // 비즈니스 로직에 따라 상태를 추가하거나 완료 플래그를 찍을 수 있음.
    
    // 적치 완료 처리: 상태를 CONFIRMED로 유지 (리스트에서 제거 목적)
    const { error } = await supabase
        .from('inbound_receipts')
        .update({ status: 'CONFIRMED' })
        .eq('id', receiptId);

    if (error) return { error: error.message };

    if (receipt) {
        await supabase.from('inbound_events').insert({
            org_id: receipt.org_id,
            receipt_id: receiptId,
            event_type: 'PUTAWAY_COMPLETED',
            payload: { locations: locationData || [] },
            actor_id: user?.id
        });
    }

    revalidatePath('/admin/inbound/putaway');
    return { success: true };
}
