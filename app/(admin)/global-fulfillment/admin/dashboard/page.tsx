'use client';

import { useState, useEffect } from 'react';
import {
  ChartBarIcon,
  TruckIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon
} from '@heroicons/react/24/outline';

interface DashboardStats {
  today: {
    dropShipping: { total: number; completed: number; pending: number };
    sorting: { total: number; completed: number; pending: number };
    packageCheck: { total: number; completed: number; pending: number };
    weightCheck: { total: number; completed: number; pending: number; avgWeight: number; totalCost: number };
    returns: { total: number; approved: number; rejected: number };
  };
  week: {
    totalOrders: number;
    totalShipped: number;
    totalReturns: number;
    totalCost: number;
    avgProcessingTime: number;
  };
  carriers: {
    name: string;
    orders: number;
    cost: number;
    avgDeliveryDays: number;
  }[];
  workers: {
    name: string;
    processed: number;
    errors: number;
    efficiency: number;
  }[];
  alerts: {
    type: 'error' | 'warning' | 'info';
    message: string;
    time: Date;
  }[];
}

// 샘플 데이터
const SAMPLE_STATS: DashboardStats = {
  today: {
    dropShipping: { total: 245, completed: 198, pending: 47 },
    sorting: { total: 198, completed: 176, pending: 22 },
    packageCheck: { total: 176, completed: 165, pending: 11 },
    weightCheck: { total: 165, completed: 159, pending: 6, avgWeight: 1.35, totalCost: 4250000 },
    returns: { total: 18, approved: 12, rejected: 6 }
  },
  week: {
    totalOrders: 1543,
    totalShipped: 1489,
    totalReturns: 54,
    totalCost: 28950000,
    avgProcessingTime: 4.2
  },
  carriers: [
    { name: '한진택배', orders: 542, cost: 9850000, avgDeliveryDays: 2.3 },
    { name: 'CJ대한통운', orders: 487, cost: 9120000, avgDeliveryDays: 2.1 },
    { name: '顺丰速运', orders: 312, cost: 7450000, avgDeliveryDays: 3.5 },
    { name: 'EMS', orders: 148, cost: 2530000, avgDeliveryDays: 4.2 }
  ],
  workers: [
    { name: '김철수', processed: 289, errors: 3, efficiency: 98.9 },
    { name: '이영희', processed: 267, errors: 5, efficiency: 98.1 },
    { name: '박민수', processed: 245, errors: 2, efficiency: 99.2 },
    { name: '왕웨이', processed: 223, errors: 4, efficiency: 98.2 },
    { name: '최지혜', processed: 198, errors: 1, efficiency: 99.5 }
  ],
  alerts: [
    { type: 'error', message: '드롭시핑 오류 건 12개 발생', time: new Date('2025-01-04T14:30:00') },
    { type: 'warning', message: '2차 정렬 지연 - 평균 처리시간 초과', time: new Date('2025-01-04T13:15:00') },
    { type: 'warning', message: '한진택배 운임 상승 5% 감지', time: new Date('2025-01-04T11:20:00') },
    { type: 'info', message: '오늘 반품 승인율 66.7% (평균 대비 -10%)', time: new Date('2025-01-04T10:05:00') }
  ]
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>(SAMPLE_STATS);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');

  // 실시간 업데이트 시뮬레이션
  useEffect(() => {
    const interval = setInterval(() => {
      // 실제 환경에서는 API 호출
      // const data = await fetch('/api/global-fulfillment/admin/stats');
    }, 30000); // 30초마다 업데이트

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">👨‍💼 관리자 통합 대시보드</h1>
          <p className="text-sm text-gray-600 mt-1">
            해외배송 전체 프로세스 실시간 모니터링 및 관리
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedPeriod('today')}
            className={`px-4 py-2 rounded-lg transition ${
              selectedPeriod === 'today'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            오늘
          </button>
          <button
            onClick={() => setSelectedPeriod('week')}
            className={`px-4 py-2 rounded-lg transition ${
              selectedPeriod === 'week'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            이번 주
          </button>
          <button
            onClick={() => setSelectedPeriod('month')}
            className={`px-4 py-2 rounded-lg transition ${
              selectedPeriod === 'month'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            이번 달
          </button>
        </div>
      </div>

      {/* 주요 지표 */}
      <div className="grid grid-cols-5 gap-4">
        <StatCard
          title="총 주문"
          value={stats.week.totalOrders}
          icon={CubeIcon}
          color="blue"
          trend={{ value: 12.5, direction: 'up' }}
        />
        <StatCard
          title="출고 완료"
          value={stats.week.totalShipped}
          icon={CheckCircleIcon}
          color="green"
          trend={{ value: 8.3, direction: 'up' }}
        />
        <StatCard
          title="반품 건수"
          value={stats.week.totalReturns}
          icon={ExclamationTriangleIcon}
          color="red"
          trend={{ value: 3.2, direction: 'down' }}
        />
        <StatCard
          title="총 운임"
          value={`${(stats.week.totalCost / 1000000).toFixed(1)}M`}
          icon={CurrencyDollarIcon}
          color="purple"
          suffix="원"
          trend={{ value: 5.1, direction: 'up' }}
        />
        <StatCard
          title="평균 처리시간"
          value={stats.week.avgProcessingTime.toFixed(1)}
          icon={ClockIcon}
          color="orange"
          suffix="일"
          trend={{ value: 0.3, direction: 'down' }}
        />
      </div>

      {/* 알림 */}
      {stats.alerts.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />
              실시간 알림
            </h2>
            <span className="text-sm text-gray-500">최근 4시간</span>
          </div>
          <div className="divide-y divide-gray-200">
            {stats.alerts.map((alert, idx) => (
              <div key={idx} className="p-4 flex items-start gap-3 hover:bg-gray-50">
                <div className={`mt-0.5 ${
                  alert.type === 'error' ? 'text-red-600' :
                  alert.type === 'warning' ? 'text-yellow-600' :
                  'text-blue-600'
                }`}>
                  {alert.type === 'error' ? '🔴' : alert.type === 'warning' ? '🟡' : '🔵'}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{alert.message}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {alert.time.toLocaleTimeString('ko-KR')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* 프로세스별 현황 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">오늘 프로세스별 현황</h2>
          </div>
          <div className="p-4 space-y-4">
            <ProcessItem
              name="드롭시핑"
              total={stats.today.dropShipping.total}
              completed={stats.today.dropShipping.completed}
              pending={stats.today.dropShipping.pending}
              color="blue"
            />
            <ProcessItem
              name="2차 정렬"
              total={stats.today.sorting.total}
              completed={stats.today.sorting.completed}
              pending={stats.today.sorting.pending}
              color="purple"
            />
            <ProcessItem
              name="패키지 검증"
              total={stats.today.packageCheck.total}
              completed={stats.today.packageCheck.completed}
              pending={stats.today.packageCheck.pending}
              color="green"
            />
            <ProcessItem
              name="무게 측정"
              total={stats.today.weightCheck.total}
              completed={stats.today.weightCheck.completed}
              pending={stats.today.weightCheck.pending}
              color="orange"
              extra={`평균 ${stats.today.weightCheck.avgWeight}kg | ₩${(stats.today.weightCheck.totalCost / 1000).toLocaleString()}K`}
            />
            <ProcessItem
              name="교환/반품"
              total={stats.today.returns.total}
              completed={stats.today.returns.approved}
              pending={stats.today.returns.rejected}
              color="red"
              extra={`승인: ${stats.today.returns.approved} | 거절: ${stats.today.returns.rejected}`}
            />
          </div>
        </div>

        {/* 물류사별 통계 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <TruckIcon className="h-5 w-5" />
              물류사별 통계 (이번 주)
            </h2>
          </div>
          <div className="p-4">
            <div className="space-y-4">
              {stats.carriers.map((carrier, idx) => (
                <div key={idx} className="border-b border-gray-100 pb-3 last:border-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-900">{carrier.name}</span>
                    <span className="text-sm text-gray-600">{carrier.orders}건</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">운임:</span>
                      <span className="ml-2 font-semibold text-purple-600">
                        ₩{(carrier.cost / 1000).toLocaleString()}K
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">평균 배송일:</span>
                      <span className="ml-2 font-semibold text-blue-600">
                        {carrier.avgDeliveryDays}일
                      </span>
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${(carrier.orders / stats.week.totalShipped) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 작업자별 성과 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <UserGroupIcon className="h-5 w-5" />
            작업자별 성과 (이번 주 TOP 5)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">순위</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">작업자</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">처리 건수</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">오류 건수</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">효율성</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">평가</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stats.workers.map((worker, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="text-lg font-bold text-gray-900">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}위`}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{worker.name}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="font-semibold text-blue-600">{worker.processed}</span>건
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`font-semibold ${worker.errors <= 2 ? 'text-green-600' : 'text-red-600'}`}>
                      {worker.errors}
                    </span>건
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="font-semibold text-purple-600">{worker.efficiency}%</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      worker.efficiency >= 99 ? 'bg-green-100 text-green-700' :
                      worker.efficiency >= 98 ? 'bg-blue-100 text-blue-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {worker.efficiency >= 99 ? '우수' : worker.efficiency >= 98 ? '양호' : '보통'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 빠른 액션 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">빠른 액션</h2>
        <div className="grid grid-cols-4 gap-4">
          <QuickActionButton
            icon={ChartBarIcon}
            label="성과 분석 보기"
            href="/global-fulfillment/admin/performance"
            color="blue"
          />
          <QuickActionButton
            icon={CurrencyDollarIcon}
            label="비용 분석 보기"
            href="/global-fulfillment/admin/cost-analysis"
            color="purple"
          />
          <QuickActionButton
            icon={UserGroupIcon}
            label="작업자 관리"
            href="/global-fulfillment/admin/workers"
            color="green"
          />
          <QuickActionButton
            icon={ExclamationTriangleIcon}
            label="알림 설정"
            href="/global-fulfillment/admin/alerts"
            color="orange"
          />
        </div>
      </div>
    </div>
  );
}

// 통계 카드 컴포넌트
function StatCard({
  title,
  value,
  icon: Icon,
  color,
  suffix,
  trend
}: {
  title: string;
  value: number | string;
  icon: any;
  color: string;
  suffix?: string;
  trend?: { value: number; direction: 'up' | 'down' };
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600'
  };

  return (
    <div className={`${colors[color]} rounded-lg shadow p-4`}>
      <div className="flex items-center justify-between mb-2">
        <Icon className="h-6 w-6" />
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-semibold ${
            trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
          }`}>
            {trend.direction === 'up' ? (
              <ArrowTrendingUpIcon className="h-4 w-4" />
            ) : (
              <ArrowTrendingDownIcon className="h-4 w-4" />
            )}
            {trend.value}%
          </div>
        )}
      </div>
      <div className="text-sm font-medium opacity-80">{title}</div>
      <div className="text-2xl font-bold mt-1">
        {value}
        {suffix && <span className="text-sm ml-1">{suffix}</span>}
      </div>
    </div>
  );
}

// 프로세스 아이템 컴포넌트
function ProcessItem({
  name,
  total,
  completed,
  pending,
  color,
  extra
}: {
  name: string;
  total: number;
  completed: number;
  pending: number;
  color: string;
  extra?: string;
}) {
  const percentage = total > 0 ? (completed / total) * 100 : 0;

  const colors: Record<string, string> = {
    blue: 'bg-blue-600',
    purple: 'bg-purple-600',
    green: 'bg-green-600',
    orange: 'bg-orange-600',
    red: 'bg-red-600'
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-gray-900">{name}</span>
        <span className="text-sm text-gray-600">
          {completed}/{total} ({percentage.toFixed(0)}%)
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3 mb-1">
        <div
          className={`${colors[color]} h-3 rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {extra && <p className="text-xs text-gray-500 mt-1">{extra}</p>}
      <p className="text-xs text-gray-500">대기: {pending}건</p>
    </div>
  );
}

// 빠른 액션 버튼
function QuickActionButton({
  icon: Icon,
  label,
  href,
  color
}: {
  icon: any;
  label: string;
  href: string;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
    purple: 'bg-purple-50 text-purple-600 hover:bg-purple-100',
    green: 'bg-green-50 text-green-600 hover:bg-green-100',
    orange: 'bg-orange-50 text-orange-600 hover:bg-orange-100'
  };

  return (
    <a
      href={href}
      className={`${colors[color]} p-4 rounded-lg transition flex flex-col items-center gap-2 text-center`}
    >
      <Icon className="h-8 w-8" />
      <span className="text-sm font-semibold">{label}</span>
    </a>
  );
}

