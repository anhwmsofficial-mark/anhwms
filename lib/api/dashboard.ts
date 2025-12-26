import { createClient } from '@/utils/supabase/server';

export async function getDashboardStats() {
  const supabase = await createClient();

  // 1. 오늘의 주문 현황 (주문 수, 출고 대기 등)
  // 오늘 날짜 기준 (UTC 고려)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();

  const { count: todayOrders } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', todayStr);

  const { count: pendingShipments } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .in('status', ['APPROVED', 'ALLOCATED', 'PICKED', 'PACKED']);

  // 2. 입고 예정 및 지연
  const { count: pendingInbounds } = await supabase
    .from('inbounds')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  // 3. 재고 이슈 (품절 임박)
  const { count: lowStockItems } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .lt('quantity', 10); // 임계값 10개 미만

  // 4. 최근 중요 활동 (Audit Log)
  const { data: recentActivities } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  return {
    todayOrders: todayOrders || 0,
    pendingShipments: pendingShipments || 0,
    pendingInbounds: pendingInbounds || 0,
    lowStockItems: lowStockItems || 0,
    recentActivities: recentActivities || []
  };
}

