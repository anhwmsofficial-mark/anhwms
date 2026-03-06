'use client';

import { useState } from 'react';
import {
  ChartBarIcon,
  DocumentTextIcon,
  CubeIcon,
  ChatBubbleLeftRightIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';

interface DashboardStats {
  today: {
    inbound: { total: number; completed: number; pending: number };
    outbound: { total: number; completed: number; pending: number };
    inventory: { total: number; lowStock: number; available: number };
  };
  documents: {
    asn: { total: number; pending: number; confirmed: number };
    orders: { total: number; processing: number; completed: number };
  };
  communications: {
    unread: number;
    issues: number;
    resolved: number;
  };
}

const SAMPLE_STATS: DashboardStats = {
  today: {
    inbound: { total: 15, completed: 12, pending: 3 },
    outbound: { total: 28, completed: 22, pending: 6 },
    inventory: { total: 4567, lowStock: 12, available: 4321 },
  },
  documents: {
    asn: { total: 18, pending: 5, confirmed: 13 },
    orders: { total: 35, processing: 8, completed: 27 },
  },
  communications: {
    unread: 7,
    issues: 3,
    resolved: 15,
  },
};

export default function ManagementDashboardPage() {
  const [stats] = useState<DashboardStats>(SAMPLE_STATS);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">👔 관리팀 대시보드</h1>
              <p className="text-sm text-gray-600 mt-1">
                입출고 문서 및 재고 관리
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedPeriod('today')}
                className={`px-4 py-2 rounded-lg transition ${
                  selectedPeriod === 'today'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                오늘
              </button>
              <button
                onClick={() => setSelectedPeriod('week')}
                className={`px-4 py-2 rounded-lg transition ${
                  selectedPeriod === 'week'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                이번 주
              </button>
              <button
                onClick={() => setSelectedPeriod('month')}
                className={`px-4 py-2 rounded-lg transition ${
                  selectedPeriod === 'month'
                    ? 'bg-green-600 text-white'
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
          <h2 className="text-xl font-semibold text-gray-900 mb-4">📊 오늘의 현황</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="입고 처리"
              value={stats.today.inbound.completed}
              subtitle={`대기: ${stats.today.inbound.pending}건`}
              icon={ArrowDownTrayIcon}
              color="blue"
              trend={{ value: 15, direction: 'up' }}
            />
            <StatCard
              title="출고 처리"
              value={stats.today.outbound.completed}
              subtitle={`대기: ${stats.today.outbound.pending}건`}
              icon={ArrowUpTrayIcon}
              color="green"
              trend={{ value: 12, direction: 'up' }}
            />
            <StatCard
              title="재고"
              value={stats.today.inventory.available}
              subtitle={`저재고: ${stats.today.inventory.lowStock}건`}
              icon={CubeIcon}
              color="purple"
            />
            <StatCard
              title="미처리 이슈"
              value={stats.communications.issues}
              subtitle={`해결: ${stats.communications.resolved}건`}
              icon={ExclamationTriangleIcon}
              color="red"
            />
          </div>
        </div>

        {/* 문서 현황 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <DocumentTextIcon className="h-6 w-6 text-green-600" />
              문서 현황
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-6">
              <DocumentStatusBox
                title="ASN (입고예정서)"
                total={stats.documents.asn.total}
                pending={stats.documents.asn.pending}
                completed={stats.documents.asn.confirmed}
                color="blue"
              />
              <DocumentStatusBox
                title="출고 주문서"
                total={stats.documents.orders.total}
                pending={stats.documents.orders.processing}
                completed={stats.documents.orders.completed}
                color="green"
              />
            </div>
          </div>
        </div>

        {/* 관리 메뉴 */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">⚙️ 관리 메뉴</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MenuCard
              title="문서 관리"
              description="ASN, 주문서 관리"
              icon={DocumentTextIcon}
              href="/management/documents"
              color="blue"
            />
            <MenuCard
              title="재고 관리"
              description="SKU, 로케이션"
              icon={CubeIcon}
              href="/management/inventory"
              color="purple"
            />
            <MenuCard
              title="KPI 리포트"
              description="성과 지표 분석"
              icon={ChartBarIcon}
              href="/management/kpi"
              color="green"
            />
            <MenuCard
              title="현장 커뮤니케이션"
              description="메모, 이슈 모니터링"
              icon={ChatBubbleLeftRightIcon}
              href="/management/communications"
              color="orange"
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
            <Link href="/management/communications" className="text-sm text-green-600 hover:text-green-800">
              전체 보기 →
            </Link>
          </div>
          <div className="divide-y divide-gray-200">
            <AlertItem
              type="warning"
              message="키보드 재고가 최소 수량 이하입니다 (현재: 8개)"
              time="10분 전"
            />
            <AlertItem
              type="info"
              message="ASN-2025-001 입고가 완료되었습니다"
              time="25분 전"
            />
            <AlertItem
              type="info"
              message="출고 주문서 ORD-2025-045가 처리되었습니다"
              time="1시간 전"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

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

function DocumentStatusBox({
  title,
  total,
  pending,
  completed,
  color,
}: {
  title: string;
  total: number;
  pending: number;
  completed: number;
  color: string;
}) {
  const percentage = total > 0 ? (completed / total) * 100 : 0;
  const colors: Record<string, string> = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
  };

  return (
    <div className="border-2 border-gray-200 rounded-lg p-4">
      <h3 className="font-semibold text-gray-900 mb-3">{title}</h3>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">전체</span>
          <span className="font-semibold">{total}건</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">처리 대기</span>
          <span className="font-semibold text-yellow-600">{pending}건</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">완료</span>
          <span className="font-semibold text-green-600">{completed}건</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 mt-3">
          <div
            className={`${colors[color]} h-3 rounded-full transition-all duration-500`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="text-xs text-gray-500 text-center">{percentage.toFixed(0)}% 완료</div>
      </div>
    </div>
  );
}

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

