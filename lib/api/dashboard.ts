import { createClient } from '@/utils/supabase/server';

type WeeklyTrendPoint = {
  date: string;
  orders: number;
  inbounds: number;
  outbounds: number;
};

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;
type DateRow = { created_at: string };

async function getWeeklyProcessingTrend(supabase: ServerSupabaseClient): Promise<WeeklyTrendPoint[]> {
  const today = new Date();
  const start = new Date();
  start.setDate(today.getDate() - 6);
  start.setHours(0, 0, 0, 0);

  const dateKeys: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    const cursor = new Date(start);
    cursor.setDate(start.getDate() + i);
    dateKeys.push(cursor.toISOString().slice(0, 10));
  }

  const baseMap: Record<string, WeeklyTrendPoint> = {};
  dateKeys.forEach((key) => {
    baseMap[key] = { date: key, orders: 0, inbounds: 0, outbounds: 0 };
  });

  const since = start.toISOString();

  const [{ data: orders }, { data: inbounds }, { data: outbounds }] = await Promise.all([
    supabase.from('orders').select('created_at').gte('created_at', since),
    supabase.from('inbounds').select('created_at').gte('created_at', since),
    supabase.from('outbounds').select('created_at').gte('created_at', since),
  ]);

  (orders as DateRow[] | null || []).forEach((row) => {
    const key = new Date(row.created_at).toISOString().slice(0, 10);
    if (baseMap[key]) baseMap[key].orders += 1;
  });

  (inbounds as DateRow[] | null || []).forEach((row) => {
    const key = new Date(row.created_at).toISOString().slice(0, 10);
    if (baseMap[key]) baseMap[key].inbounds += 1;
  });

  (outbounds as DateRow[] | null || []).forEach((row) => {
    const key = new Date(row.created_at).toISOString().slice(0, 10);
    if (baseMap[key]) baseMap[key].outbounds += 1;
  });

  return dateKeys.map((key) => baseMap[key]);
}

async function getSystemAnnouncement(supabase: ServerSupabaseClient) {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from('system_announcements')
    .select('*')
    .eq('is_active', true)
    .lte('starts_at', now)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data || null;
}

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

  const [weeklyTrend, systemAnnouncement] = await Promise.all([
    getWeeklyProcessingTrend(supabase),
    getSystemAnnouncement(supabase),
  ]);

  return {
    todayOrders: todayOrders || 0,
    pendingShipments: pendingShipments || 0,
    pendingInbounds: pendingInbounds || 0,
    lowStockItems: lowStockItems || 0,
    recentActivities: recentActivities || [],
    weeklyTrend,
    systemAnnouncement,
  };
}

