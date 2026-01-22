'use server';

import { createClient } from '@/utils/supabase/server';

export async function getInboundStats() {
    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];

    // 1. 오늘 입고 예정 (Plans where planned_date = today)
    const { count: todayExpected, error: expectedError } = await supabase
        .from('inbound_plans')
        .select('*', { count: 'exact', head: true })
        .eq('planned_date', today);
    
    // 2. 확인 대기 (Receipts where status is active but not confirmed or issue)
    const { count: pending, error: pendingError } = await supabase
        .from('inbound_receipts')
        .select('*', { count: 'exact', head: true })
        .in('status', ['ARRIVED', 'PHOTO_REQUIRED', 'COUNTING', 'INSPECTING']);

    // 3. 이슈 발생 (Receipts with status DISCREPANCY)
    const { count: issues, error: issueError } = await supabase
        .from('inbound_receipts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'DISCREPANCY');

    // 4. 최근 완료 (Last 5 confirmed receipts)
    const { data: recentCompleted, error: recentError } = await supabase
        .from('inbound_receipts')
        .select(`
            id, 
            receipt_no, 
            confirmed_at, 
            client:client_id(name)
        `)
        .eq('status', 'CONFIRMED')
        .order('confirmed_at', { ascending: false })
        .limit(5);

    if (expectedError || pendingError || issueError || recentError) {
        console.error('Stats Error:', expectedError, pendingError, issueError, recentError);
    }

    return {
        todayExpected: todayExpected || 0,
        pending: pending || 0,
        issues: issues || 0,
        recentCompleted: recentCompleted || []
    };
}
