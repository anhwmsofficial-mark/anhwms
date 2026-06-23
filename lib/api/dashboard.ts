import { createClient } from '@/utils/supabase/server';

type WeeklyTrendPoint = {
  label: string;
  startDate: string;
  endDate: string;
  processedQty: number;
};

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

type MonthlyTrendPoint = {
  label: string;
  month: string;
  processedQty: number;
};

type CategoryTotal = {
  label: string;
  value: number;
};

type DailyWorkLogDashboardLineRow = {
  prev_qty: number | null;
  processed_qty: number | null;
  remain_qty: number | null;
  work_type: string | null;
  client?: { name: string | null; code: string | null } | null;
};

type DailyWorkLogDashboardRow = {
  id: string;
  work_date: string;
  total_worker_count: number | null;
  warehouse?: { name: string | null; code: string | null } | null;
  daily_work_log_lines?: DailyWorkLogDashboardLineRow[] | null;
};

export type DashboardStatsData = {
  todayWorkload: number;
  weekWorkload: number;
  monthWorkload: number;
  totalWorkers: number;
  averageWorkers: number;
  totalPrevRemain: number;
  totalTodayProcessed: number;
  totalTodayRemain: number;
  dayChangeRate: number;
  weekChangeRate: number;
  monthChangeRate: number;
  recentActivities: unknown[];
  weeklyTrend: WeeklyTrendPoint[];
  monthlyTrend: MonthlyTrendPoint[];
  warehouseWorkloads: CategoryTotal[];
  topClients: CategoryTotal[];
  workTypeShares: CategoryTotal[];
  systemAnnouncement: unknown;
};

const EMPTY_DASHBOARD_STATS: DashboardStatsData = {
  todayWorkload: 0,
  weekWorkload: 0,
  monthWorkload: 0,
  totalWorkers: 0,
  averageWorkers: 0,
  totalPrevRemain: 0,
  totalTodayProcessed: 0,
  totalTodayRemain: 0,
  dayChangeRate: 0,
  weekChangeRate: 0,
  monthChangeRate: 0,
  recentActivities: [],
  weeklyTrend: [],
  monthlyTrend: [],
  warehouseWorkloads: [],
  topClients: [],
  workTypeShares: [],
  systemAnnouncement: null,
};

const DAILY_WORK_LOG_WORK_TYPE_LABELS: Record<string, string> = {
  MORNING_PARCEL_OUTBOUND: '오전택배출고',
  AFTERNOON_PARCEL_OUTBOUND: '오후택배출고',
  GENERAL_PARCEL: '일반택배',
  COUPANG_PARCEL: '쿠팡택배',
  MILKRUN: '밀크런',
  B2B_OUTBOUND: '기업출고',
  INSPECTION: '검수/확인',
  RETURNS: '반품/회수',
  OTHER: '기타',
};

function getKstDate(date = new Date()) {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000);
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftDate(baseIsoDate: string, offsetDays: number) {
  const [year, month, day] = baseIsoDate.split('-').map(Number);
  return toIsoDate(new Date(Date.UTC(year, month - 1, day + offsetDays)));
}

function getMonthStart(baseIsoDate: string, offsetMonths = 0) {
  const [year, month] = baseIsoDate.split('-').map(Number);
  return toIsoDate(new Date(Date.UTC(year, month - 1 + offsetMonths, 1)));
}

function getMonthEnd(monthStartIsoDate: string) {
  const [year, month] = monthStartIsoDate.split('-').map(Number);
  return toIsoDate(new Date(Date.UTC(year, month, 0)));
}

function getWeekStart(baseIsoDate: string) {
  const [year, month, day] = baseIsoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay();
  return shiftDate(baseIsoDate, dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
}

function sumProcessed(rows: DailyWorkLogDashboardRow[]) {
  return rows.reduce(
    (sum, row) =>
      sum +
      (row.daily_work_log_lines || []).reduce(
        (lineSum, line) => lineSum + Number(line.processed_qty || 0),
        0,
      ),
    0,
  );
}

function sumPrevRemain(rows: DailyWorkLogDashboardRow[]) {
  return rows.reduce(
    (sum, row) =>
      sum +
      (row.daily_work_log_lines || []).reduce((lineSum, line) => lineSum + Number(line.prev_qty || 0), 0),
    0,
  );
}

function sumRemain(rows: DailyWorkLogDashboardRow[]) {
  return rows.reduce(
    (sum, row) =>
      sum +
      (row.daily_work_log_lines || []).reduce((lineSum, line) => lineSum + Number(line.remain_qty || 0), 0),
    0,
  );
}

function getChangeRate(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function sortByValueDesc(items: CategoryTotal[]) {
  return items.slice().sort((left, right) => right.value - left.value || left.label.localeCompare(right.label, 'ko'));
}

function addToMap(map: Map<string, number>, key: string, value: number) {
  map.set(key, (map.get(key) || 0) + value);
}

function rowsInRange(rows: DailyWorkLogDashboardRow[], startDate: string, endDate: string) {
  return rows.filter((row) => row.work_date >= startDate && row.work_date <= endDate);
}

function buildWeeklyTrend(rows: DailyWorkLogDashboardRow[], currentWeekStart: string): WeeklyTrendPoint[] {
  return Array.from({ length: 8 }, (_, index) => {
    const startDate = shiftDate(currentWeekStart, (index - 7) * 7);
    const endDate = shiftDate(startDate, 6);
    return {
      label: `${startDate.slice(5).replace('-', '/')}~${endDate.slice(5).replace('-', '/')}`,
      startDate,
      endDate,
      processedQty: sumProcessed(rowsInRange(rows, startDate, endDate)),
    };
  });
}

function buildMonthlyTrend(rows: DailyWorkLogDashboardRow[], todayIso: string): MonthlyTrendPoint[] {
  return Array.from({ length: 12 }, (_, index) => {
    const monthStart = getMonthStart(todayIso, index - 11);
    const monthEnd = getMonthEnd(monthStart);
    return {
      label: monthStart.slice(2, 7).replace('-', '.'),
      month: monthStart.slice(0, 7),
      processedQty: sumProcessed(rowsInRange(rows, monthStart, monthEnd)),
    };
  });
}

function buildWarehouseWorkloads(rows: DailyWorkLogDashboardRow[]) {
  const totals = new Map<string, number>();
  rows.forEach((row) => {
    addToMap(totals, row.warehouse?.name || row.warehouse?.code || '미지정 창고', sumProcessed([row]));
  });
  return sortByValueDesc(Array.from(totals, ([label, value]) => ({ label, value })));
}

function buildClientWorkloads(rows: DailyWorkLogDashboardRow[]) {
  const totals = new Map<string, number>();
  rows.forEach((row) => {
    (row.daily_work_log_lines || []).forEach((line) => {
      addToMap(totals, line.client?.name || line.client?.code || '미지정 고객사', Number(line.processed_qty || 0));
    });
  });
  return sortByValueDesc(Array.from(totals, ([label, value]) => ({ label, value }))).slice(0, 10);
}

function buildWorkTypeShares(rows: DailyWorkLogDashboardRow[]) {
  const totals = new Map<string, number>();
  rows.forEach((row) => {
    (row.daily_work_log_lines || []).forEach((line) => {
      const label = DAILY_WORK_LOG_WORK_TYPE_LABELS[line.work_type || ''] || line.work_type || '기타';
      addToMap(totals, label, Number(line.processed_qty || 0));
    });
  });
  return sortByValueDesc(Array.from(totals, ([label, value]) => ({ label, value })));
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return EMPTY_DASHBOARD_STATS;

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('org_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.org_id) return EMPTY_DASHBOARD_STATS;

  const todayIso = toIsoDate(getKstDate());
  const yesterdayIso = shiftDate(todayIso, -1);
  const currentWeekStart = getWeekStart(todayIso);
  const currentWeekEnd = shiftDate(currentWeekStart, 6);
  const previousWeekStart = shiftDate(currentWeekStart, -7);
  const previousWeekEnd = shiftDate(currentWeekStart, -1);
  const currentMonthStart = getMonthStart(todayIso);
  const currentMonthEnd = getMonthEnd(currentMonthStart);
  const previousMonthStart = getMonthStart(todayIso, -1);
  const previousMonthEnd = getMonthEnd(previousMonthStart);
  const firstChartMonthStart = getMonthStart(todayIso, -11);
  const firstWeekStart = shiftDate(currentWeekStart, -49);
  const queryStartDate = firstChartMonthStart < firstWeekStart ? firstChartMonthStart : firstWeekStart;
  const looseSupabase = supabase as unknown as { from: (relation: string) => any };

  // 4. 최근 중요 활동 (Audit Log)
  const [{ data: workLogs }, { data: recentActivities }, systemAnnouncement] = await Promise.all([
    looseSupabase
      .from('daily_work_logs')
      .select(
        `
          id,
          work_date,
          total_worker_count,
          warehouse:warehouse(name, code),
          daily_work_log_lines(
            prev_qty,
            processed_qty,
            remain_qty,
            work_type,
            client:customer_master(name, code)
          )
        `,
      )
      .eq('org_id', profile.org_id)
      .gte('work_date', queryStartDate)
      .lte('work_date', currentMonthEnd)
      .order('work_date', { ascending: true }),
    supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5),
    getSystemAnnouncement(supabase),
  ]);

  const rows = (workLogs || []) as DailyWorkLogDashboardRow[];
  const todayRows = rowsInRange(rows, todayIso, todayIso);
  const yesterdayRows = rowsInRange(rows, yesterdayIso, yesterdayIso);
  const currentWeekRows = rowsInRange(rows, currentWeekStart, currentWeekEnd);
  const previousWeekRows = rowsInRange(rows, previousWeekStart, previousWeekEnd);
  const currentMonthRows = rowsInRange(rows, currentMonthStart, currentMonthEnd);
  const previousMonthRows = rowsInRange(rows, previousMonthStart, previousMonthEnd);
  const totalWorkers = todayRows.reduce((sum, row) => sum + Number(row.total_worker_count || 0), 0);
  const averageWorkers =
    currentMonthRows.length === 0
      ? 0
      : Number(
          (
            currentMonthRows.reduce((sum, row) => sum + Number(row.total_worker_count || 0), 0) /
            currentMonthRows.length
          ).toFixed(1),
        );
  const todayWorkload = sumProcessed(todayRows);
  const weekWorkload = sumProcessed(currentWeekRows);
  const monthWorkload = sumProcessed(currentMonthRows);

  return {
    todayWorkload,
    weekWorkload,
    monthWorkload,
    totalWorkers,
    averageWorkers,
    totalPrevRemain: sumPrevRemain(todayRows),
    totalTodayProcessed: todayWorkload,
    totalTodayRemain: sumRemain(todayRows),
    dayChangeRate: getChangeRate(todayWorkload, sumProcessed(yesterdayRows)),
    weekChangeRate: getChangeRate(weekWorkload, sumProcessed(previousWeekRows)),
    monthChangeRate: getChangeRate(monthWorkload, sumProcessed(previousMonthRows)),
    recentActivities: recentActivities || [],
    weeklyTrend: buildWeeklyTrend(rows, currentWeekStart),
    monthlyTrend: buildMonthlyTrend(rows, todayIso),
    warehouseWorkloads: buildWarehouseWorkloads(currentMonthRows),
    topClients: buildClientWorkloads(currentMonthRows),
    workTypeShares: buildWorkTypeShares(currentMonthRows),
    systemAnnouncement,
  };
}

