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
};

type MonthlyTrendPoint = {
  label: string;
  processedQty: number;
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
  const warehouseWorkloads = (stats.warehouseWorkloads || []) as CategoryTotal[];
  const topClients = (stats.topClients || []) as CategoryTotal[];
  const workTypeShares = (stats.workTypeShares || []) as CategoryTotal[];
  const systemAnnouncement = stats.systemAnnouncement as SystemAnnouncement;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">운영 대시보드</h1>
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
             href="/admin/inbound"
             className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm"
          >
             <ArchiveBoxIcon className="w-4 h-4" />
             입고 관리
          </Link>
        </div>
      </div>

      {/* 핵심 지표 (Stats) */}
      <DashboardStats stats={stats} />

      {/* 메인 컨텐츠 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 좌측: 빠른 메뉴 및 차트 (Placeholder) */}
        <div className="lg:col-span-2 space-y-6">
          <WorkloadTrendChart title="최근 8주 작업량 추이" data={weeklyTrend} />
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

        {/* 우측: 실시간 로그 */}
        <div className="space-y-6">
          <ActivityFeed activities={(stats.recentActivities as any[]) || []} />
          
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
    </div>
  );
}
