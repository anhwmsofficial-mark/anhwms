import { 
  ArrowPathIcon,
  ShoppingCartIcon,
  ArchiveBoxIcon,
  TruckIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { getDashboardStatsAction } from '@/app/actions/dashboard';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';

type WeeklyTrendPoint = {
  label: string;
  processedQty: number;
  movingAverage: number | null;
  recordedDays: number;
  isPartial: boolean;
};

type MonthlyTrendPoint = {
  label: string;
  processedQty: number;
};

type SalesPoint = {
  label: string;
  outboundQty: number;
  recordedDays: number;
  actualSales: number;
  forecastQty: number;
  forecastSales: number;
  isPartial: boolean;
};

type CategoryTotal = {
  label: string;
  value: number;
};

type SystemAnnouncement = {
  title?: string | null;
  message?: string | null;
  link_url?: string | null;
} | null;

function formatNumber(value: number) {
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(value || 0);
}

function formatWon(value: number) {
  return `${new Intl.NumberFormat('ko-KR').format(Math.round(value || 0))}원`;
}

function formatSalesCompact(value: number) {
  const amount = Math.round(value || 0);
  if (amount >= 100000000) {
    const eok = amount / 100000000;
    const text = eok >= 10 ? eok.toFixed(1) : eok.toFixed(2);
    return `${text.replace(/\.?0+$/, '')}억`;
  }
  return `${new Intl.NumberFormat('ko-KR').format(Math.round(amount / 10000))}만`;
}

function buildSalesAxis(peak: number) {
  const rough = Math.max(peak, 1) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((value) => rough <= value) || magnitude * 10;
  const yMax = Math.max(step, Math.ceil(peak / step) * step);
  const tickCount = Math.max(1, Math.round(yMax / step));
  const ticks = Array.from({ length: tickCount + 1 }, (_, index) => Math.round(index * step));
  return { yMax, ticks };
}

function SalesFigure({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-gray-200 px-4 py-3">
      <p className="text-xs text-gray-500">{title}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{detail}</p>
    </div>
  );
}

function SalesOutlook({ weekly, monthly }: { weekly: SalesPoint[]; monthly: SalesPoint[] }) {
  const week = weekly.find((item) => item.isPartial) ?? weekly.at(-1);
  const month = monthly.find((item) => item.isPartial) ?? monthly.at(-1);
  if (!week || !month) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
        <ChartBarIcon className="w-5 h-5 text-gray-500" />
        매출 예상
      </h3>
      <p className="text-xs text-gray-500 mb-4">
        출고 1건당 2,415원입니다. 오전·오후 택배, 일반택배, 쿠팡택배, 밀크런, 기업출고 처리수량을 기준으로 계산합니다.
        진행 중인 주와 달은 기록된 작업일 평균에 최근 작업일수를 적용하고, 남은 평일을 넘지 않게 예상합니다.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <SalesFigure
          title="이번 주 집계"
          value={formatWon(week.actualSales)}
          detail={`${formatNumber(week.outboundQty)}건 · ${week.recordedDays}일`}
        />
        <SalesFigure
          title="이번 주 예상"
          value={formatWon(week.forecastSales)}
          detail={`예상 ${formatNumber(week.forecastQty)}건`}
        />
        <SalesFigure
          title="이번 달 집계"
          value={formatWon(month.actualSales)}
          detail={`${formatNumber(month.outboundQty)}건 · ${month.recordedDays}일`}
        />
        <SalesFigure
          title="이번 달 예상"
          value={formatWon(month.forecastSales)}
          detail={`예상 ${formatNumber(month.forecastQty)}건`}
        />
      </div>
    </div>
  );
}

function SalesBarChart({
  title,
  data,
  valueKey,
  seriesLegend,
  partialLegend,
}: {
  title: string;
  data: SalesPoint[];
  valueKey: 'actualSales' | 'forecastSales';
  seriesLegend: string;
  partialLegend: string;
}) {
  const width = 960;
  const height = 360;
  const pad = { top: 36, right: 16, bottom: 46, left: 72 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const peak = Math.max(1, ...data.map((item) => item[valueKey] || 0));
  const { yMax, ticks } = buildSalesAxis(peak);
  const slot = plotWidth / Math.max(data.length, 1);
  const barWidth = Math.min(36, slot * 0.58);
  const partial = data.find((item) => item.isPartial);
  const yOf = (value: number) => pad.top + plotHeight - (value / yMax) * plotHeight;
  const xOf = (index: number) => pad.left + slot * index + slot / 2;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <ChartBarIcon className="w-5 h-5 text-gray-500" />
        {title}
      </h3>
      {data.length === 0 ? (
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <span className="text-gray-400">표시할 데이터가 없습니다</span>
        </div>
      ) : (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-gray-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 bg-emerald-600" />
              {seriesLegend}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 bg-emerald-300" />
              {partialLegend}({partial?.recordedDays ?? 0}일)
            </span>
          </div>
          <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={title}>
            {ticks.map((tick) => {
              const y = yOf(tick);
              return (
                <g key={tick}>
                  <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                  <text x={pad.left - 8} y={y + 4} textAnchor="end" fill="#6b7280" fontSize="11">
                    {formatSalesCompact(tick)}
                  </text>
                </g>
              );
            })}
            {data.map((item, index) => {
              const value = item[valueKey] || 0;
              const x = xOf(index);
              const y = yOf(value);
              const barHeight = Math.max(0, yOf(0) - y);
              const tip = item.isPartial
                ? `${item.label} 집계 ${formatWon(item.actualSales)} / 예상 ${formatWon(item.forecastSales)}`
                : `${item.label} ${formatWon(item.actualSales)} · ${formatNumber(item.outboundQty)}건`;
              return (
                <g key={item.label}>
                  <rect
                    x={x - barWidth / 2}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    fill={item.isPartial ? '#6ee7b7' : '#059669'}
                  >
                    <title>{tip}</title>
                  </rect>
                  {value > 0 ? (
                    <text x={x} y={Math.max(14, y - 8)} textAnchor="middle" fill="#111827" fontSize="11" fontWeight="600">
                      {formatSalesCompact(value)}
                    </text>
                  ) : null}
                  <text x={x} y={height - 16} textAnchor="middle" fill="#6b7280" fontSize="11">
                    {item.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}

function WeeklyOutboundChart({ data }: { data: WeeklyTrendPoint[] }) {
  const width = 960;
  const height = 360;
  const pad = { top: 36, right: 16, bottom: 46, left: 58 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const peak = Math.max(1, ...data.map((item) => Math.max(item.processedQty || 0, item.movingAverage || 0)));
  const yMax = Math.max(5000, Math.ceil(peak / 5000) * 5000);
  const ticks = Array.from({ length: yMax / 5000 + 1 }, (_, index) => index * 5000);
  const slot = plotWidth / Math.max(data.length, 1);
  const barWidth = Math.min(36, slot * 0.58);
  const partial = data.find((item) => item.isPartial);
  const yOf = (value: number) => pad.top + plotHeight - (value / yMax) * plotHeight;
  const xOf = (index: number) => pad.left + slot * index + slot / 2;
  const averagePoints = data.flatMap((item, index) =>
    item.movingAverage == null ? [] : [`${xOf(index)},${yOf(item.movingAverage)}`],
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <ChartBarIcon className="w-5 h-5 text-gray-500" />
        최근 12주 작업량 추이
      </h3>
      {data.length === 0 ? (
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <span className="text-gray-400">표시할 데이터가 없습니다</span>
        </div>
      ) : (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-gray-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 bg-blue-600" />
              출고량
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 bg-blue-300" />
              집계 중인 주({partial?.recordedDays ?? 0}일)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 bg-orange-500" />
              4주 이동 평균
            </span>
          </div>
          <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="최근 12주 작업량 추이">
            {ticks.map((tick) => {
              const y = yOf(tick);
              return (
                <g key={tick}>
                  <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                  <text x={pad.left - 8} y={y + 4} textAnchor="end" fill="#6b7280" fontSize="11">
                    {formatNumber(tick)}
                  </text>
                </g>
              );
            })}
            {data.map((item, index) => {
              const x = xOf(index);
              const y = yOf(item.processedQty || 0);
              const barHeight = Math.max(0, yOf(0) - y);
              return (
                <g key={item.label}>
                  <rect
                    x={x - barWidth / 2}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    fill={item.isPartial ? '#93c5fd' : '#2563eb'}
                  >
                    <title>{`${item.label} ${formatNumber(item.processedQty)}`}</title>
                  </rect>
                  <text x={x} y={y - 8} textAnchor="middle" fill="#111827" fontSize="11" fontWeight="600">
                    {formatNumber(item.processedQty)}
                  </text>
                  <text x={x} y={height - 16} textAnchor="middle" fill="#6b7280" fontSize="11">
                    {item.label}
                  </text>
                </g>
              );
            })}
            {averagePoints.length > 1 ? (
              <polyline
                points={averagePoints.join(' ')}
                fill="none"
                stroke="#f97316"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
            {data.map((item, index) =>
              item.movingAverage == null ? null : (
                <circle key={`${item.label}-avg`} cx={xOf(index)} cy={yOf(item.movingAverage)} r="3.5" fill="#f97316">
                  <title>{`${item.label} 4주 이동 평균 ${formatNumber(item.movingAverage)}`}</title>
                </circle>
              ),
            )}
          </svg>
        </div>
      )}
    </div>
  );
}

function WorkloadTrendChart({
  title,
  data,
}: {
  title: string;
  data: Array<WeeklyTrendPoint | MonthlyTrendPoint>;
}) {
  const maxValue = Math.max(1, ...data.map((item) => item.processedQty || 0));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <ChartBarIcon className="w-5 h-5 text-gray-500" />
        {title}
      </h3>
      {data.length === 0 ? (
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <span className="text-gray-400">표시할 데이터가 없습니다</span>
        </div>
      ) : (
        <div className="h-64 bg-gray-50 rounded-lg border border-gray-200 p-4">
          <div className="flex items-end justify-between gap-2 h-44">
            {data.map((item) => {
              const height = ((item.processedQty || 0) / maxValue) * 160;
              return (
                <div key={item.label} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-xs font-semibold text-gray-600">{formatNumber(item.processedQty)}</div>
                  <div
                    className="w-full bg-blue-500 rounded-t"
                    style={{ height: `${height}px`, minHeight: item.processedQty > 0 ? '4px' : '0px' }}
                    title={`${item.label} ${formatNumber(item.processedQty)}`}
                  />
                  <div className="text-xs text-gray-500 text-center whitespace-nowrap">{item.label}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex justify-center gap-2 text-sm text-gray-600">
            <span className="w-3 h-3 bg-blue-500 rounded" />
            작업량
          </div>
        </div>
      )}
    </div>
  );
}

function RankingChart({ title, data }: { title: string; data: CategoryTotal[] }) {
  const maxValue = Math.max(1, ...data.map((item) => item.value || 0));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <ChartBarIcon className="w-5 h-5 text-gray-500" />
        {title}
      </h3>
      {data.length === 0 ? (
        <div className="h-56 flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <span className="text-gray-400">표시할 데이터가 없습니다</span>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((item) => (
            <div key={item.label}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-gray-700">{item.label}</span>
                <span className="font-semibold text-gray-900">{formatNumber(item.value)}</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100">
                <div
                  className="h-2 rounded-full bg-emerald-500"
                  style={{ width: `${Math.max(4, ((item.value || 0) / maxValue) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ShareChart({ title, data }: { title: string; data: CategoryTotal[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <ChartBarIcon className="w-5 h-5 text-gray-500" />
        {title}
      </h3>
      {data.length === 0 || total === 0 ? (
        <div className="h-56 flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <span className="text-gray-400">표시할 데이터가 없습니다</span>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((item) => {
            const share = (item.value / total) * 100;
            return (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-gray-700">{item.label}</span>
                  <span className="font-semibold text-gray-900">
                    {formatNumber(item.value)} ({formatNumber(share)}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${Math.max(4, share)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default async function DashboardPage() {
  const stats = await getDashboardStatsAction();
  const weeklyTrend = (stats.weeklyTrend || []) as WeeklyTrendPoint[];
  const monthlyTrend = (stats.monthlyTrend || []) as MonthlyTrendPoint[];
  const weeklySales = (stats.weeklySales || []) as SalesPoint[];
  const monthlySales = (stats.monthlySales || []) as SalesPoint[];
  const warehouseWorkloads = (stats.warehouseWorkloads || []) as CategoryTotal[];
  const topClients = (stats.topClients || []) as CategoryTotal[];
  const workTypeShares = (stats.workTypeShares || []) as CategoryTotal[];
  const systemAnnouncement = stats.systemAnnouncement as SystemAnnouncement;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">출고주요지표</h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Date().toLocaleDateString()} 기준 실시간 현황입니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Link 
            href="/admin/orders"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
          >
            <ShoppingCartIcon className="w-4 h-4" />
            주문 관리
          </Link>
          <Link
             href="/inbound"
             className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm"
          >
             <ArchiveBoxIcon className="w-4 h-4" />
             입고 관리
          </Link>
        </div>
      </div>

      {/* 핵심 지표 (Stats) */}
      <DashboardStats stats={stats} />

      <WeeklyOutboundChart data={weeklyTrend} />

      <SalesOutlook weekly={weeklySales} monthly={monthlySales} />
      <SalesBarChart
        title="최근 12주 매출"
        data={weeklySales}
        valueKey="actualSales"
        seriesLegend="매출"
        partialLegend="집계 중인 주"
      />
      <SalesBarChart
        title="최근 12개월 매출 예상"
        data={monthlySales}
        valueKey="forecastSales"
        seriesLegend="예상 매출"
        partialLegend="집계 중인 달"
      />

      {/* 메인 컨텐츠 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 좌측: 빠른 메뉴 및 차트 (Placeholder) */}
        <div className="lg:col-span-2 space-y-6">
          <WorkloadTrendChart title="최근 12개월 작업량 추이" data={monthlyTrend} />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <RankingChart title="창고별 작업량" data={warehouseWorkloads} />
            <RankingChart title="고객사 TOP10" data={topClients} />
          </div>
          <ShareChart title="작업유형 비중" data={workTypeShares} />

          {/* 빠른 바로가기 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { name: '재고 실사', href: '/admin/inventory/adjustment', icon: ArchiveBoxIcon },
              { name: '배송 조회', href: '/admin/shipping', icon: TruckIcon },
              { name: '주문 반품', href: '/admin/orders?status=RETURN_REQ', icon: ArrowPathIcon },
              { name: '통계 리포트', href: '/admin/reports', icon: ChartBarIcon },
            ].map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-md transition-all group"
              >
                <div className="p-3 bg-blue-50 text-blue-600 rounded-full mb-2 group-hover:bg-blue-100">
                  <item.icon className="w-6 h-6" />
                </div>
                <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">
                  {item.name}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* 우측: 시스템 공지 */}
        <div className="space-y-6">
          {/* 시스템 공지 */}
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
            <h3 className="font-bold text-lg mb-2">
              📢 {systemAnnouncement?.title || '시스템 공지'}
            </h3>
            <p className="text-indigo-100 text-sm mb-4">
              {systemAnnouncement?.message || '현재 등록된 공지가 없습니다.'}
            </p>
            {systemAnnouncement?.link_url && (
              <Link
                href={systemAnnouncement.link_url}
                className="inline-block px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-xs font-medium backdrop-blur-sm transition"
              >
                자세히 보기
              </Link>
            )}
          </div>
        </div>
      </div>

      <ActivityFeed activities={(stats.recentActivities as any[]) || []} />
    </div>
  );
}
