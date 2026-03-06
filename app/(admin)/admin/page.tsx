'use client';

import { useState, useEffect } from 'react';
import {
  ChartBarIcon,
  UserGroupIcon,
  ChatBubbleLeftRightIcon,
  TruckIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  CubeIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';

interface SystemStats {
  cs: {
    totalConversations: number;
    activeConversations: number;
    avgResponseTime: number;
    customerSatisfaction: number;
    translationCount: number;
  };
  fulfillment: {
    totalOrders: number;
    completedToday: number;
    pendingOrders: number;
    avgProcessingTime: number;
  };
  workers: {
    total: number;
    active: number;
    onLeave: number;
    avgEfficiency: number;
  };
  alerts: {
    critical: number;
    warning: number;
    info: number;
  };
}

const SAMPLE_STATS: SystemStats = {
  cs: {
    totalConversations: 156,
    activeConversations: 23,
    avgResponseTime: 2.3,
    customerSatisfaction: 94.5,
    translationCount: 1247,
  },
  fulfillment: {
    totalOrders: 245,
    completedToday: 198,
    pendingOrders: 47,
    avgProcessingTime: 4.2,
  },
  workers: {
    total: 28,
    active: 25,
    onLeave: 3,
    avgEfficiency: 96.8,
  },
  alerts: {
    critical: 3,
    warning: 8,
    info: 12,
  },
};

export default function AdminDashboardPage() {
  const [stats] = useState<SystemStats>(SAMPLE_STATS);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');

  // 실시간 업데이트
  useEffect(() => {
    const interval = setInterval(() => {
      // 실제 환경에서는 API 호출
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">👨‍💼 관리자 모드</h1>
              <p className="text-sm text-gray-600 mt-1">
                ANH WMS 전체 시스템 관리 및 모니터링
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
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* 주요 지표 */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">📊 주요 지표</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="CS 대화"
              value={stats.cs.totalConversations}
              subtitle={`활성: ${stats.cs.activeConversations}건`}
              icon={ChatBubbleLeftRightIcon}
              color="blue"
              trend={{ value: 12.5, direction: 'up' }}
            />
            <StatCard
              title="처리 완료"
              value={stats.fulfillment.completedToday}
              subtitle={`대기: ${stats.fulfillment.pendingOrders}건`}
              icon={CheckCircleIcon}
              color="green"
              trend={{ value: 8.3, direction: 'up' }}
            />
            <StatCard
              title="작업자"
              value={`${stats.workers.active}/${stats.workers.total}`}
              subtitle={`효율: ${stats.workers.avgEfficiency}%`}
              icon={UserGroupIcon}
              color="purple"
            />
            <StatCard
              title="알림"
              value={stats.alerts.critical + stats.alerts.warning}
              subtitle={`긴급: ${stats.alerts.critical}건`}
              icon={ExclamationTriangleIcon}
              color="red"
            />
          </div>
        </div>

        {/* CS 시스템 현황 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <ChatBubbleLeftRightIcon className="h-6 w-6 text-blue-600" />
              CS 시스템 현황
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-5 gap-4">
              <MetricBox
                label="전체 대화"
                value={stats.cs.totalConversations}
                unit="건"
                color="blue"
              />
              <MetricBox
                label="활성 대화"
                value={stats.cs.activeConversations}
                unit="건"
                color="green"
              />
              <MetricBox
                label="평균 응답시간"
                value={stats.cs.avgResponseTime}
                unit="분"
                color="purple"
              />
              <MetricBox
                label="고객 만족도"
                value={stats.cs.customerSatisfaction}
                unit="%"
                color="orange"
              />
              <MetricBox
                label="번역 횟수"
                value={stats.cs.translationCount}
                unit="회"
                color="indigo"
              />
            </div>
          </div>
        </div>

        {/* Global Fulfillment 현황 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <TruckIcon className="h-6 w-6 text-green-600" />
              Global Fulfillment 현황
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-4 gap-4">
              <MetricBox
                label="총 주문"
                value={stats.fulfillment.totalOrders}
                unit="건"
                color="blue"
              />
              <MetricBox
                label="완료"
                value={stats.fulfillment.completedToday}
                unit="건"
                color="green"
              />
              <MetricBox
                label="대기"
                value={stats.fulfillment.pendingOrders}
                unit="건"
                color="yellow"
              />
              <MetricBox
                label="평균 처리시간"
                value={stats.fulfillment.avgProcessingTime}
                unit="일"
                color="purple"
              />
            </div>
          </div>
        </div>

        {/* 관리 메뉴 */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">⚙️ 관리 메뉴</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MenuCard
              title="통합 대시보드"
              description="전체 시스템 실시간 모니터링"
              icon={ChartBarIcon}
              href="/admin/dashboard"
              color="blue"
            />
            <MenuCard
              title="CS 작업자 관리"
              description="CS 담당자 성과 및 관리"
              icon={UserGroupIcon}
              href="/admin/cs-workers"
              color="purple"
            />
            <MenuCard
              title="CS 성과 분석"
              description="응답률, 만족도, 효율성"
              icon={ChartBarIcon}
              href="/admin/cs-performance"
              color="green"
            />
            <MenuCard
              title="물류 작업자"
              description="물류 작업자 현황"
              icon={UserGroupIcon}
              href="/global-fulfillment/admin/workers"
              color="orange"
            />
            <MenuCard
              title="비용 분석"
              description="물류사별 비용 분석"
              icon={CurrencyDollarIcon}
              href="/global-fulfillment/admin/cost-analysis"
              color="red"
            />
            <MenuCard
              title="알림 설정"
              description="실시간 알림 규칙 관리"
              icon={ExclamationTriangleIcon}
              href="/admin/alerts"
              color="yellow"
            />
            <MenuCard
              title="시스템 설정"
              description="권한, 사용자, 설정"
              icon={CubeIcon}
              href="/admin/settings"
              color="gray"
            />
            <MenuCard
              title="통계 리포트"
              description="종합 성과 리포트"
              icon={ChartBarIcon}
              href="/admin/reports"
              color="indigo"
            />
          </div>
        </div>

        {/* 최근 알림 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />
              최근 알림
            </h2>
            <Link href="/admin/alerts" className="text-sm text-blue-600 hover:text-blue-800">
              전체 보기 →
            </Link>
          </div>
          <div className="divide-y divide-gray-200">
            <AlertItem
              type="error"
              message="CS 평균 응답시간이 3분을 초과했습니다"
              time="10분 전"
            />
            <AlertItem
              type="warning"
              message="드롭시핑 대기 건수가 50건을 초과했습니다"
              time="25분 전"
            />
            <AlertItem
              type="info"
              message="오늘 CS 대화 처리 목표를 달성했습니다"
              time="1시간 전"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// 통계 카드 컴포넌트
function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  trend,
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: any;
  color: string;
  trend?: { value: number; direction: 'up' | 'down' };
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200',
  };

  return (
    <div className={`${colors[color]} border-2 rounded-lg shadow-sm p-4`}>
      <div className="flex items-center justify-between mb-2">
        <Icon className="h-8 w-8" />
        {trend && (
          <div
            className={`flex items-center gap-1 text-xs font-semibold ${
              trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {trend.direction === 'up' ? (
              <ArrowTrendingUpIcon className="h-4 w-4" />
            ) : (
              <ArrowTrendingDownIcon className="h-4 w-4" />
            )}
            {trend.value}%
          </div>
        )}
      </div>
      <div className="text-sm font-medium opacity-90">{title}</div>
      <div className="text-3xl font-bold mt-1">{value}</div>
      {subtitle && <p className="text-xs opacity-75 mt-1">{subtitle}</p>}
    </div>
  );
}

// 지표 박스 컴포넌트
function MetricBox({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: number;
  unit: string;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    indigo: 'bg-indigo-50 text-indigo-600',
  };

  return (
    <div className={`${colors[color]} rounded-lg p-4 text-center`}>
      <div className="text-xs font-medium opacity-80">{label}</div>
      <div className="text-2xl font-bold mt-1">
        {value}
        <span className="text-sm ml-1">{unit}</span>
      </div>
    </div>
  );
}

// 메뉴 카드 컴포넌트
function MenuCard({
  title,
  description,
  icon: Icon,
  href,
  color,
}: {
  title: string;
  description: string;
  icon: any;
  href: string;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200',
    purple: 'bg-purple-50 text-purple-600 hover:bg-purple-100 border-purple-200',
    green: 'bg-green-50 text-green-600 hover:bg-green-100 border-green-200',
    orange: 'bg-orange-50 text-orange-600 hover:bg-orange-100 border-orange-200',
    red: 'bg-red-50 text-red-600 hover:bg-red-100 border-red-200',
    yellow: 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100 border-yellow-200',
    gray: 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200',
    indigo: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-indigo-200',
  };

  return (
    <Link
      href={href}
      className={`${colors[color]} border-2 rounded-lg p-6 transition flex flex-col items-center text-center group`}
    >
      <Icon className="h-12 w-12 mb-3 group-hover:scale-110 transition-transform" />
      <h3 className="font-bold text-lg mb-1">{title}</h3>
      <p className="text-xs opacity-75">{description}</p>
    </Link>
  );
}

// 알림 아이템 컴포넌트
function AlertItem({
  type,
  message,
  time,
}: {
  type: 'error' | 'warning' | 'info';
  message: string;
  time: string;
}) {
  const icons = {
    error: '🔴',
    warning: '🟡',
    info: '🔵',
  };

  const colors = {
    error: 'text-red-600',
    warning: 'text-yellow-600',
    info: 'text-blue-600',
  };

  return (
    <div className="p-4 hover:bg-gray-50 flex items-start gap-3">
      <div className="text-2xl">{icons[type]}</div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${colors[type]}`}>{message}</p>
        <p className="text-xs text-gray-500 mt-1">{time}</p>
      </div>
    </div>
  );
}

