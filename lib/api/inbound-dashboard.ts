import { createClient } from '@/utils/supabase/server';
import { createTrackedAdminClient } from '@/utils/supabase/admin-client';

type TrendPoint = {
  label: string;
  processedQty: number;
};

type CategoryTotal = {
  label: string;
  value: number;
};

type InboundPlanLineRow = {
  expected_qty: number | null;
};

type InboundPlanRow = {
  id: string;
  planned_date: string;
  status: string | null;
  client?: { name: string | null; code: string | null } | null;
  inbound_plan_lines?: InboundPlanLineRow[] | null;
};

type InboundReceiptLineRow = {
  accepted_qty: number | null;
  received_qty: number | null;
  damaged_qty: number | null;
  missing_qty: number | null;
  other_qty: number | null;
};

type InboundReceiptRow = {
  id: string;
  status: string | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  arrived_at: string | null;
  client?: { name: string | null; code: string | null } | null;
  warehouse?: { name: string | null; code: string | null } | null;
  lines?: InboundReceiptLineRow[] | null;
};

export type InboundDashboardStatsData = {
  todayExpectedCount: number;
  todayExpectedQty: number;
  todayReceivedQty: number;
  weekReceivedQty: number;
  monthReceivedQty: number;
  pendingCount: number;
  issueCount: number;
  monthExpectedQty: number;
  monthIssueQty: number;
  receivingAccuracyRate: number;
  dayChangeRate: number;
  weekChangeRate: number;
  monthChangeRate: number;
  weeklyTrend: TrendPoint[];
  monthlyTrend: TrendPoint[];
  warehouseWorkloads: CategoryTotal[];
  topClients: CategoryTotal[];
  statusShares: CategoryTotal[];
};

const EMPTY_INBOUND_DASHBOARD_STATS: InboundDashboardStatsData = {
  todayExpectedCount: 0,
  todayExpectedQty: 0,
  todayReceivedQty: 0,
  weekReceivedQty: 0,
  monthReceivedQty: 0,
  pendingCount: 0,
  issueCount: 0,
  monthExpectedQty: 0,
  monthIssueQty: 0,
  receivingAccuracyRate: 0,
  dayChangeRate: 0,
  weekChangeRate: 0,
  monthChangeRate: 0,
  weeklyTrend: [],
  monthlyTrend: [],
  warehouseWorkloads: [],
  topClients: [],
  statusShares: [],
};

const INBOUND_STATUS_LABELS: Record<string, string> = {
  ARRIVED: '도착',
  PHOTO_REQUIRED: '사진 필요',
  COUNTING: '수량 확인',
  INSPECTING: '검수 중',
  DISCREPANCY: '이슈 발생',
  CONFIRMED: '확정',
  PUTAWAY_READY: '적치 대기',
  CANCELLED: '취소',
};

const PENDING_STATUSES = ['ARRIVED', 'PHOTO_REQUIRED', 'COUNTING', 'INSPECTING'];
const COMPLETED_STATUSES = ['CONFIRMED', 'PUTAWAY_READY'];

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

function getReceiptDate(row: InboundReceiptRow) {
  return (row.confirmed_at || row.arrived_at || row.updated_at || row.created_at).slice(0, 10);
}

function getExpectedQty(plan: InboundPlanRow) {
  return (plan.inbound_plan_lines || []).reduce((sum, line) => sum + Number(line.expected_qty || 0), 0);
}

function getAcceptedQty(receipt: InboundReceiptRow) {
  return (receipt.lines || []).reduce(
    (sum, line) => sum + Number(line.accepted_qty ?? line.received_qty ?? 0),
    0,
  );
}

function getIssueQty(receipt: InboundReceiptRow) {
  return (receipt.lines || []).reduce(
    (sum, line) =>
      sum + Number(line.damaged_qty || 0) + Number(line.missing_qty || 0) + Number(line.other_qty || 0),
    0,
  );
}

function rowsInDateRange<T>(rows: T[], getDate: (row: T) => string, startDate: string, endDate: string) {
  return rows.filter((row) => {
    const date = getDate(row);
    return date >= startDate && date <= endDate;
  });
}

function sumAccepted(rows: InboundReceiptRow[]) {
  return rows.reduce((sum, row) => sum + getAcceptedQty(row), 0);
}

function sumIssues(rows: InboundReceiptRow[]) {
  return rows.reduce((sum, row) => sum + getIssueQty(row), 0);
}

function sumExpected(rows: InboundPlanRow[]) {
  return rows.reduce((sum, row) => sum + getExpectedQty(row), 0);
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

function buildWeeklyTrend(receipts: InboundReceiptRow[], currentWeekStart: string): TrendPoint[] {
  return Array.from({ length: 8 }, (_, index) => {
    const startDate = shiftDate(currentWeekStart, (index - 7) * 7);
    const endDate = shiftDate(startDate, 6);
    return {
      label: `${startDate.slice(5).replace('-', '/')}~${endDate.slice(5).replace('-', '/')}`,
      processedQty: sumAccepted(rowsInDateRange(receipts, getReceiptDate, startDate, endDate)),
    };
  });
}

function buildMonthlyTrend(receipts: InboundReceiptRow[], todayIso: string): TrendPoint[] {
  return Array.from({ length: 12 }, (_, index) => {
    const monthStart = getMonthStart(todayIso, index - 11);
    const monthEnd = getMonthEnd(monthStart);
    return {
      label: monthStart.slice(2, 7).replace('-', '.'),
      processedQty: sumAccepted(rowsInDateRange(receipts, getReceiptDate, monthStart, monthEnd)),
    };
  });
}

function buildWarehouseWorkloads(receipts: InboundReceiptRow[]) {
  const totals = new Map<string, number>();
  receipts.forEach((receipt) => {
    addToMap(totals, receipt.warehouse?.name || receipt.warehouse?.code || '미지정 창고', getAcceptedQty(receipt));
  });
  return sortByValueDesc(Array.from(totals, ([label, value]) => ({ label, value })));
}

function buildClientWorkloads(receipts: InboundReceiptRow[]) {
  const totals = new Map<string, number>();
  receipts.forEach((receipt) => {
    addToMap(totals, receipt.client?.name || receipt.client?.code || '미지정 고객사', getAcceptedQty(receipt));
  });
  return sortByValueDesc(Array.from(totals, ([label, value]) => ({ label, value }))).slice(0, 10);
}

function buildStatusShares(receipts: InboundReceiptRow[]) {
  const totals = new Map<string, number>();
  receipts.forEach((receipt) => {
    const status = receipt.status || 'UNKNOWN';
    addToMap(totals, INBOUND_STATUS_LABELS[status] || status, 1);
  });
  return sortByValueDesc(Array.from(totals, ([label, value]) => ({ label, value })));
}

export async function getInboundDashboardStats(): Promise<InboundDashboardStatsData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return EMPTY_INBOUND_DASHBOARD_STATS;

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('org_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.org_id) return EMPTY_INBOUND_DASHBOARD_STATS;

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

  const db = createTrackedAdminClient({
    action: 'inbound-dashboard',
    route: 'getInboundDashboardStats',
  }) as unknown as { from: (relation: string) => any };

  const [plansResult, receiptsResult] = await Promise.all([
    db
      .from('inbound_plans')
      .select(
        `
          id,
          planned_date,
          status,
          client:client_id(name, code),
          inbound_plan_lines(expected_qty)
        `,
      )
      .eq('org_id', profile.org_id)
      .gte('planned_date', queryStartDate)
      .lte('planned_date', currentMonthEnd)
      .order('planned_date', { ascending: true }),
    db
      .from('inbound_receipts')
      .select(
        `
          id,
          status,
          arrived_at,
          confirmed_at,
          created_at,
          updated_at,
          client:client_id(name, code),
          warehouse:warehouse_id(name, code),
          lines:inbound_receipt_lines(
            accepted_qty,
            received_qty,
            damaged_qty,
            missing_qty,
            other_qty
          )
        `,
      )
      .eq('org_id', profile.org_id)
      .order('created_at', { ascending: true }),
  ]);

  if (plansResult.error || receiptsResult.error) {
    console.error('Inbound dashboard stats query failed:', {
      plansError: plansResult.error,
      receiptsError: receiptsResult.error,
    });
    return EMPTY_INBOUND_DASHBOARD_STATS;
  }

  const plans = (plansResult.data || []) as InboundPlanRow[];
  const receipts = (receiptsResult.data || []) as InboundReceiptRow[];
  const todayPlans = rowsInDateRange(plans, (plan) => plan.planned_date, todayIso, todayIso);
  const currentMonthPlans = rowsInDateRange(plans, (plan) => plan.planned_date, currentMonthStart, currentMonthEnd);
  const todayReceipts = rowsInDateRange(receipts, getReceiptDate, todayIso, todayIso);
  const yesterdayReceipts = rowsInDateRange(receipts, getReceiptDate, yesterdayIso, yesterdayIso);
  const currentWeekReceipts = rowsInDateRange(receipts, getReceiptDate, currentWeekStart, currentWeekEnd);
  const previousWeekReceipts = rowsInDateRange(receipts, getReceiptDate, previousWeekStart, previousWeekEnd);
  const currentMonthReceipts = rowsInDateRange(receipts, getReceiptDate, currentMonthStart, currentMonthEnd);
  const previousMonthReceipts = rowsInDateRange(receipts, getReceiptDate, previousMonthStart, previousMonthEnd);
  const todayReceivedQty = sumAccepted(todayReceipts);
  const weekReceivedQty = sumAccepted(currentWeekReceipts);
  const monthReceivedQty = sumAccepted(currentMonthReceipts);
  const monthExpectedQty = sumExpected(currentMonthPlans);
  const monthIssueQty = sumIssues(currentMonthReceipts);

  return {
    todayExpectedCount: todayPlans.length,
    todayExpectedQty: sumExpected(todayPlans),
    todayReceivedQty,
    weekReceivedQty,
    monthReceivedQty,
    pendingCount: receipts.filter((receipt) => PENDING_STATUSES.includes(receipt.status || '')).length,
    issueCount: receipts.filter((receipt) => receipt.status === 'DISCREPANCY' || getIssueQty(receipt) > 0).length,
    monthExpectedQty,
    monthIssueQty,
    receivingAccuracyRate: monthExpectedQty === 0 ? 0 : Number(((monthReceivedQty / monthExpectedQty) * 100).toFixed(1)),
    dayChangeRate: getChangeRate(todayReceivedQty, sumAccepted(yesterdayReceipts)),
    weekChangeRate: getChangeRate(weekReceivedQty, sumAccepted(previousWeekReceipts)),
    monthChangeRate: getChangeRate(monthReceivedQty, sumAccepted(previousMonthReceipts)),
    weeklyTrend: buildWeeklyTrend(receipts, currentWeekStart),
    monthlyTrend: buildMonthlyTrend(receipts, todayIso),
    warehouseWorkloads: buildWarehouseWorkloads(currentMonthReceipts),
    topClients: buildClientWorkloads(currentMonthReceipts),
    statusShares: buildStatusShares(
      receipts.filter((receipt) => COMPLETED_STATUSES.includes(receipt.status || '') || PENDING_STATUSES.includes(receipt.status || '') || receipt.status === 'DISCREPANCY'),
    ),
  };
}
