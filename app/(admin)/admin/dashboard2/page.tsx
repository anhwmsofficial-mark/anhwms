import {
  ArchiveBoxArrowDownIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
  ScaleIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { getInboundDashboardStatsAction } from '@/app/actions/dashboard';
import { StatCard } from '@/components/dashboard/DashboardStats';

type TrendPoint = {
  label: string;
  processedQty: number;
};

type CategoryTotal = {
  label: string;
  value: number;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(value || 0);
}

function formatPercent(value: number) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatNumber(value)}%`;
}

function getRateType(value: number) {
  if (value > 0) return 'success' as const;
  if (value < 0) return 'warning' as const;
  return 'neutral' as const;
}

function getRateIcon(value: number) {
  return value < 0 ? ArrowTrendingDownIcon : ArrowTrendingUpIcon;
}

function WorkloadTrendChart({ title, data }: { title: string; data: TrendPoint[] }) {
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
                    className="w-full bg-emerald-500 rounded-t"
                    style={{ height: `${height}px`, minHeight: item.processedQty > 0 ? '4px' : '0px' }}
                    title={`${item.label} ${formatNumber(item.processedQty)}`}
                  />
                  <div className="text-xs text-gray-500 text-center whitespace-nowrap">{item.label}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex justify-center gap-2 text-sm text-gray-600">
            <span className="w-3 h-3 bg-emerald-500 rounded" />
            실입고 수량
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
                  className="h-2 rounded-full bg-blue-500"
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

export default async function InboundDashboardPage() {
  const stats = await getInboundDashboardStatsAction();
  const cards = [
    {
      title: '오늘 입고 예정',
      value: `${formatNumber(stats.todayExpectedCount)}건`,
      subValue: `예정 수량 ${formatNumber(stats.todayExpectedQty)}`,
      icon: CalendarDaysIcon,
    },
    {
      title: '오늘 실입고',
      value: formatNumber(stats.todayReceivedQty),
      subValue: '오늘 입고 검수 수량',
      icon: ArchiveBoxArrowDownIcon,
    },
    {
      title: '이번주 실입고',
      value: formatNumber(stats.weekReceivedQty),
      subValue: '주간 누적 실입고 수량',
      icon: ClipboardDocumentCheckIcon,
    },
    {
      title: '이번달 실입고',
      value: formatNumber(stats.monthReceivedQty),
      subValue: '월간 누적 실입고 수량',
      icon: ChartBarIcon,
    },
    {
      title: '확인 대기',
      value: formatNumber(stats.pendingCount),
      subValue: '진행 중 입고 건수',
      type: stats.pendingCount > 0 ? ('warning' as const) : ('neutral' as const),
      icon: ScaleIcon,
    },
    {
      title: '이슈 발생',
      value: formatNumber(stats.issueCount),
      subValue: `이슈 수량 ${formatNumber(stats.monthIssueQty)}`,
      type: stats.issueCount > 0 ? ('danger' as const) : ('success' as const),
      icon: ExclamationTriangleIcon,
    },
    {
      title: '월 예정 수량',
      value: formatNumber(stats.monthExpectedQty),
      subValue: '이번달 입고 예정 합계',
      icon: CalendarDaysIcon,
    },
    {
      title: '입고 정확률',
      value: `${formatNumber(stats.receivingAccuracyRate)}%`,
      subValue: '월 실입고 / 월 예정',
      type: stats.receivingAccuracyRate >= 100 ? ('success' as const) : ('neutral' as const),
      icon: ScaleIcon,
    },
    {
      title: '전일 대비',
      value: formatPercent(stats.dayChangeRate),
      subValue: '오늘 실입고 증감률',
      type: getRateType(stats.dayChangeRate),
      icon: getRateIcon(stats.dayChangeRate),
    },
    {
      title: '전주 대비',
      value: formatPercent(stats.weekChangeRate),
      subValue: '이번주 실입고 증감률',
      type: getRateType(stats.weekChangeRate),
      icon: getRateIcon(stats.weekChangeRate),
    },
    {
      title: '전월 대비',
      value: formatPercent(stats.monthChangeRate),
      subValue: '이번달 실입고 증감률',
      type: getRateType(stats.monthChangeRate),
      icon: getRateIcon(stats.monthChangeRate),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">입고주요지표</h1>
          <p className="text-sm text-gray-500 mt-1">{new Date().toLocaleDateString()} 기준 입고 현황입니다.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/inbound"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
          >
            <ArchiveBoxArrowDownIcon className="w-4 h-4" />
            입고 내역
          </Link>
          <Link
            href="/inbound/new"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm"
          >
            <ClipboardDocumentCheckIcon className="w-4 h-4" />
            신규 예정 등록
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <WorkloadTrendChart title="최근 8주 입고량 추이" data={stats.weeklyTrend} />
          <WorkloadTrendChart title="최근 12개월 입고량 추이" data={stats.monthlyTrend} />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <RankingChart title="창고별 입고량" data={stats.warehouseWorkloads} />
            <RankingChart title="고객사 TOP10" data={stats.topClients} />
          </div>
        </div>

        <div className="space-y-6">
          <ShareChart title="입고 상태 비중" data={stats.statusShares} />
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">빠른 이동</h3>
            <div className="grid grid-cols-1 gap-3">
              <Link href="/inbound" className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:border-blue-500 hover:text-blue-700">
                입고 작업 목록
              </Link>
              <Link href="/inbound/new" className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:border-blue-500 hover:text-blue-700">
                신규 입고 예정 등록
              </Link>
              <Link href="/admin/dashboard" className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:border-blue-500 hover:text-blue-700">
                출고주요지표 보기
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
