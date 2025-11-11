'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  TruckIcon, 
  CubeIcon, 
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';
import { GlobalFulfillmentStats, GlobalProcessLog } from '@/types';

export default function GlobalFulfillmentPage() {
  const [stats, setStats] = useState<GlobalFulfillmentStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // TODO: API 호출로 변경
      // const response = await fetch('/api/global-fulfillment/stats');
      // const data = await response.json();
      
      // 임시 더미 데이터
      const dummyStats: GlobalFulfillmentStats = {
        totalOrders: 156,
        pendingOrders: 12,
        inProgressOrders: 45,
        completedOrders: 89,
        delayedOrders: 8,
        exceptionOrders: 2,
        byStep: {
          drop_shipping: 12,
          preparation: 15,
          wave_management: 10,
          second_sorting: 8,
          inspection: 12,
          package_check: 6,
          weight_check: 4,
          completed: 89,
          exception: 2,
          returned: 0
        },
        byCountry: {
          CN: 120,
          JP: 25,
          KR: 8,
          US: 3
        },
        byCustomer: [
          { customerId: '1', customerName: '淘宝精品店', orderCount: 45 },
          { customerId: '2', customerName: 'Shopee Korea', orderCount: 38 },
          { customerId: '3', customerName: '楽天ストア', orderCount: 25 },
          { customerId: '4', customerName: 'AliExpress Vendor', orderCount: 20 },
          { customerId: '5', customerName: 'Other', orderCount: 28 }
        ],
        topExceptions: [
          { type: 'customs_delay', count: 8, severity: 'high' },
          { type: 'missing_item', count: 5, severity: 'medium' },
          { type: 'damaged', count: 3, severity: 'medium' },
          { type: 'weight_mismatch', count: 2, severity: 'low' },
          { type: 'wrong_address', count: 1, severity: 'low' }
        ],
        recentActivity: []
      };
      
      setStats(dummyStats);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <GlobeAltIcon className="h-8 w-8 text-blue-600" />
            해외배송 (Global Fulfillment)
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            중국 등 해외 고객사의 제품 입고부터 출고/통관/배송까지 전체 프로세스 관리
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/global-fulfillment/drop-shipping"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            + 새 주문 입고
          </Link>
          <Link
            href="/global-fulfillment/exceptions"
            className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition"
          >
            이상 처리 ({stats?.exceptionOrders})
          </Link>
        </div>
      </div>

      {/* 주요 지표 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <StatsCard
          title="전체 주문"
          value={stats?.totalOrders || 0}
          icon={<CubeIcon className="h-6 w-6 text-blue-600" />}
          bgColor="bg-blue-50"
        />
        <StatsCard
          title="대기"
          value={stats?.pendingOrders || 0}
          icon={<ClockIcon className="h-6 w-6 text-gray-600" />}
          bgColor="bg-gray-50"
        />
        <StatsCard
          title="진행중"
          value={stats?.inProgressOrders || 0}
          icon={<ArrowTrendingUpIcon className="h-6 w-6 text-yellow-600" />}
          bgColor="bg-yellow-50"
        />
        <StatsCard
          title="완료"
          value={stats?.completedOrders || 0}
          icon={<ClipboardDocumentCheckIcon className="h-6 w-6 text-green-600" />}
          bgColor="bg-green-50"
        />
        <StatsCard
          title="지연"
          value={stats?.delayedOrders || 0}
          icon={<ExclamationTriangleIcon className="h-6 w-6 text-orange-600" />}
          bgColor="bg-orange-50"
        />
        <StatsCard
          title="이상건"
          value={stats?.exceptionOrders || 0}
          icon={<ExclamationTriangleIcon className="h-6 w-6 text-red-600" />}
          bgColor="bg-red-50"
        />
      </div>

      {/* 프로세스 단계별 진행률 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <ChartBarIcon className="h-6 w-6 text-blue-600" />
          프로세스 단계별 진행률
        </h2>
        <div className="space-y-3">
          {stats && Object.entries(stats.byStep).map(([step, count]) => (
            <ProcessStepBar
              key={step}
              step={step}
              count={count}
              total={stats.totalOrders}
            />
          ))}
        </div>
      </div>

      {/* 하단 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 국가별 물류량 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">국가별 물류량</h2>
          <div className="space-y-3">
            {stats?.byCountry && Object.entries(stats.byCountry).map(([country, count]) => (
              <div key={country} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getCountryFlag(country)}</span>
                  <span className="font-medium">{getCountryName(country)}</span>
                </div>
                <span className="text-lg font-semibold text-blue-600">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 고객사별 주문량 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">고객사별 주문량</h2>
          <div className="space-y-3">
            {stats?.byCustomer.slice(0, 5).map((customer, idx) => (
              <div key={customer.customerId} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-500 w-6">#{idx + 1}</span>
                  <span className="font-medium">{customer.customerName}</span>
                </div>
                <span className="text-lg font-semibold text-blue-600">{customer.orderCount}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 통관 지연 및 오류 TOP 5 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
          통관 지연 및 오류 TOP 5
        </h2>
        <div className="space-y-3">
          {stats?.topExceptions.map((exception, idx) => (
            <div
              key={exception.type}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-4">
                <span className="text-lg font-bold text-gray-400">#{idx + 1}</span>
                <div>
                  <div className="font-medium">{getExceptionTypeLabel(exception.type)}</div>
                  <div className="text-sm text-gray-500">
                    {getExceptionTypeDescription(exception.type)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <SeverityBadge severity={exception.severity} />
                <span className="text-xl font-bold text-red-600">{exception.count}건</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 메뉴 그리드 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <MenuCard
          title="드롭시핑"
          subtitle="주문 입고 관리"
          icon={<CubeIcon className="h-8 w-8" />}
          href="/global-fulfillment/drop-shipping"
          color="green"
          count={stats?.byStep.drop_shipping}
        />
        <MenuCard
          title="상품 준비"
          subtitle="환적 준비"
          icon={<ClipboardDocumentCheckIcon className="h-8 w-8" />}
          href="/global-fulfillment/preparation"
          color="blue"
          count={stats?.byStep.preparation}
        />
        <MenuCard
          title="파도 관리"
          subtitle="출고 계획"
          icon={<ChartBarIcon className="h-8 w-8" />}
          href="/global-fulfillment/wave-management"
          color="purple"
          count={stats?.byStep.wave_management}
        />
        <MenuCard
          title="2차 정렬"
          subtitle="세부 분류"
          icon={<TruckIcon className="h-8 w-8" />}
          href="/global-fulfillment/second-sorting"
          color="indigo"
          count={stats?.byStep.second_sorting}
        />
        <MenuCard
          title="검증/검사"
          subtitle="품질 확인"
          icon={<ClipboardDocumentCheckIcon className="h-8 w-8" />}
          href="/global-fulfillment/inspection"
          color="cyan"
          count={stats?.byStep.inspection}
        />
        <MenuCard
          title="패키지 검증"
          subtitle="포장 확인"
          icon={<CubeIcon className="h-8 w-8" />}
          href="/global-fulfillment/package-check"
          color="teal"
          count={stats?.byStep.package_check}
        />
        <MenuCard
          title="무게 측정"
          subtitle="중량 검증"
          icon={<ChartBarIcon className="h-8 w-8" />}
          href="/global-fulfillment/weight-check"
          color="orange"
          count={stats?.byStep.weight_check}
        />
        <MenuCard
          title="교환/반품"
          subtitle="반품 처리"
          icon={<ArrowTrendingUpIcon className="h-8 w-8" />}
          href="/global-fulfillment/returns"
          color="yellow"
          count={stats?.byStep.returned}
        />
        <MenuCard
          title="이상 처리"
          subtitle="오류 관리"
          icon={<ExclamationTriangleIcon className="h-8 w-8" />}
          href="/global-fulfillment/exceptions"
          color="red"
          count={stats?.exceptionOrders}
        />
        <MenuCard
          title="마감 시간"
          subtitle="출고 마감"
          icon={<ClockIcon className="h-6 w-6" />}
          href="/global-fulfillment/cutoff"
          color="gray"
        />
      </div>
    </div>
  );
}

// 컴포넌트들
function StatsCard({ title, value, icon, bgColor }: any) {
  return (
    <div className={`${bgColor} rounded-lg p-4 border border-gray-200`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div>{icon}</div>
      </div>
    </div>
  );
}

function ProcessStepBar({ step, count, total }: any) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{getStepLabel(step)}</span>
        <span className="text-gray-600">{count}건 ({percentage.toFixed(1)}%)</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${getStepColor(step)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function MenuCard({ title, subtitle, icon, href, color, count }: any) {
  const colorClasses: any = {
    green: 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100',
    cyan: 'bg-cyan-50 text-cyan-600 border-cyan-200 hover:bg-cyan-100',
    teal: 'bg-teal-50 text-teal-600 border-teal-200 hover:bg-teal-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200 hover:bg-yellow-100',
    red: 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100',
    gray: 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
  };

  return (
    <Link
      href={href}
      className={`${colorClasses[color]} rounded-lg p-5 border transition cursor-pointer relative`}
    >
      <div className="flex flex-col items-start gap-3">
        {icon}
        <div>
          <h3 className="font-semibold text-lg">{title}</h3>
          <p className="text-sm opacity-80">{subtitle}</p>
        </div>
      </div>
      {count !== undefined && count > 0 && (
        <div className="absolute top-3 right-3 bg-white rounded-full px-2 py-1 text-xs font-bold shadow">
          {count}
        </div>
      )}
    </Link>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const classes: any = {
    low: 'bg-gray-100 text-gray-700',
    medium: 'bg-yellow-100 text-yellow-700',
    high: 'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-700'
  };

  const labels: any = {
    low: '낮음',
    medium: '중간',
    high: '높음',
    critical: '긴급'
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${classes[severity]}`}>
      {labels[severity]}
    </span>
  );
}

// 헬퍼 함수들
function getStepLabel(step: string): string {
  const labels: any = {
    drop_shipping: '드롭시핑',
    preparation: '상품 준비',
    wave_management: '파도 관리',
    second_sorting: '2차 정렬',
    inspection: '검증/검사',
    package_check: '패키지 검증',
    weight_check: '무게 측정',
    completed: '완료',
    exception: '이상',
    returned: '반품'
  };
  return labels[step] || step;
}

function getStepColor(step: string): string {
  const colors: any = {
    drop_shipping: 'bg-green-500',
    preparation: 'bg-blue-500',
    wave_management: 'bg-purple-500',
    second_sorting: 'bg-indigo-500',
    inspection: 'bg-cyan-500',
    package_check: 'bg-teal-500',
    weight_check: 'bg-orange-500',
    completed: 'bg-green-600',
    exception: 'bg-red-500',
    returned: 'bg-yellow-500'
  };
  return colors[step] || 'bg-gray-500';
}

function getCountryFlag(code: string): string {
  const flags: any = {
    CN: '🇨🇳',
    JP: '🇯🇵',
    KR: '🇰🇷',
    US: '🇺🇸'
  };
  return flags[code] || '🌐';
}

function getCountryName(code: string): string {
  const names: any = {
    CN: '중국',
    JP: '일본',
    KR: '한국',
    US: '미국'
  };
  return names[code] || code;
}

function getExceptionTypeLabel(type: string): string {
  const labels: any = {
    customs_delay: '통관 지연',
    missing_item: '상품 누락',
    damaged: '상품 파손',
    weight_mismatch: '중량 불일치',
    wrong_address: '주소 오류',
    duplicate: '중복 주문',
    system_error: '시스템 오류'
  };
  return labels[type] || type;
}

function getExceptionTypeDescription(type: string): string {
  const descriptions: any = {
    customs_delay: '서류 미비 또는 통관 절차 지연',
    missing_item: '주문 수량 대비 누락 발생',
    damaged: '운송 중 파손 또는 불량',
    weight_mismatch: '예상 중량과 실제 중량 차이',
    wrong_address: '배송지 주소 오류',
    duplicate: '중복 주문 발생',
    system_error: '시스템 처리 오류'
  };
  return descriptions[type] || '';
}

