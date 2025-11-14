'use client';

import { useState } from 'react';
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  UserGroupIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface KPIData {
  date: string;
  inboundProcessed: number;
  outboundProcessed: number;
  accuracyRate: number;
  avgProcessingTime: number;
}

const SAMPLE_KPI: KPIData[] = [
  {
    date: '2025-01-08',
    inboundProcessed: 12,
    outboundProcessed: 25,
    accuracyRate: 98.5,
    avgProcessingTime: 3.2,
  },
  {
    date: '2025-01-09',
    inboundProcessed: 15,
    outboundProcessed: 28,
    accuracyRate: 97.8,
    avgProcessingTime: 3.5,
  },
  {
    date: '2025-01-10',
    inboundProcessed: 18,
    outboundProcessed: 32,
    accuracyRate: 99.1,
    avgProcessingTime: 3.0,
  },
  {
    date: '2025-01-11',
    inboundProcessed: 14,
    outboundProcessed: 29,
    accuracyRate: 98.8,
    avgProcessingTime: 3.1,
  },
  {
    date: '2025-01-12',
    inboundProcessed: 16,
    outboundProcessed: 31,
    accuracyRate: 99.3,
    avgProcessingTime: 2.9,
  },
];

export default function KPIPage() {
  const [data] = useState<KPIData[]>(SAMPLE_KPI);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('week');

  // 통계 계산
  const stats = {
    totalInbound: data.reduce((sum, d) => sum + d.inboundProcessed, 0),
    totalOutbound: data.reduce((sum, d) => sum + d.outboundProcessed, 0),
    avgAccuracy: data.reduce((sum, d) => sum + d.accuracyRate, 0) / data.length,
    avgProcessingTime: data.reduce((sum, d) => sum + d.avgProcessingTime, 0) / data.length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">📈 KPI 리포트</h1>
              <p className="text-sm text-gray-600 mt-1">핵심 성과 지표 분석</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedPeriod('week')}
                className={`px-4 py-2 rounded-lg transition ${
                  selectedPeriod === 'week'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                주간
              </button>
              <button
                onClick={() => setSelectedPeriod('month')}
                className={`px-4 py-2 rounded-lg transition ${
                  selectedPeriod === 'month'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                월간
              </button>
              <button
                onClick={() => setSelectedPeriod('quarter')}
                className={`px-4 py-2 rounded-lg transition ${
                  selectedPeriod === 'quarter'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                분기
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* 주요 KPI */}
        <div className="grid grid-cols-4 gap-4">
          <KPICard
            title="입고 처리"
            value={stats.totalInbound}
            unit="건"
            icon={ArrowTrendingUpIcon}
            color="blue"
            trend={{ value: 15.2, direction: 'up' }}
          />
          <KPICard
            title="출고 처리"
            value={stats.totalOutbound}
            unit="건"
            icon={ArrowTrendingUpIcon}
            color="green"
            trend={{ value: 12.8, direction: 'up' }}
          />
          <KPICard
            title="정확도"
            value={stats.avgAccuracy.toFixed(1)}
            unit="%"
            icon={CheckCircleIcon}
            color="purple"
            trend={{ value: 1.2, direction: 'up' }}
          />
          <KPICard
            title="평균 처리시간"
            value={stats.avgProcessingTime.toFixed(1)}
            unit="시간"
            icon={ClockIcon}
            color="orange"
            trend={{ value: 5.3, direction: 'down' }}
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* 일별 처리량 */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold">일별 입출고 처리량</h2>
            </div>
            <div className="p-6">
              <div className="flex items-end justify-between gap-2 h-64">
                {data.map((day, idx) => {
                  const maxValue = Math.max(
                    ...data.map((d) => d.inboundProcessed + d.outboundProcessed)
                  );
                  const inboundHeight = (day.inboundProcessed / maxValue) * 100;
                  const outboundHeight = (day.outboundProcessed / maxValue) * 100;

                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                      <div className="text-xs font-semibold text-gray-600">
                        {day.inboundProcessed + day.outboundProcessed}
                      </div>
                      <div className="w-full flex gap-1">
                        <div
                          className="flex-1 bg-blue-500 rounded-t hover:bg-blue-600 transition"
                          style={{ height: `${inboundHeight * 2}px`, minHeight: '20px' }}
                          title={`입고: ${day.inboundProcessed}`}
                        />
                        <div
                          className="flex-1 bg-green-500 rounded-t hover:bg-green-600 transition"
                          style={{ height: `${outboundHeight * 2}px`, minHeight: '20px' }}
                          title={`출고: ${day.outboundProcessed}`}
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(day.date).toLocaleDateString('ko-KR', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-500 rounded"></div>
                  <span>입고</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span>출고</span>
                </div>
              </div>
            </div>
          </div>

          {/* 정확도 추이 */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold">일별 정확도 추이</h2>
            </div>
            <div className="p-6">
              <div className="flex items-end justify-between gap-2 h-64">
                {data.map((day, idx) => {
                  const height = day.accuracyRate;
                  const isExcellent = day.accuracyRate >= 99;

                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center">
                      <div
                        className={`text-xs font-semibold mb-2 ${
                          isExcellent ? 'text-green-600' : 'text-blue-600'
                        }`}
                      >
                        {day.accuracyRate}%
                      </div>
                      <div
                        className={`w-full rounded-t transition ${
                          isExcellent
                            ? 'bg-green-500 hover:bg-green-600'
                            : 'bg-blue-500 hover:bg-blue-600'
                        }`}
                        style={{ height: `${height * 2}px`, minHeight: '40px' }}
                      />
                      <div className="text-xs text-gray-500 mt-2">
                        {new Date(day.date).toLocaleDateString('ko-KR', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 평균 처리시간 */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold">평균 처리시간 추이</h2>
            </div>
            <div className="p-6">
              <div className="flex items-end justify-between gap-2 h-64">
                {data.map((day, idx) => {
                  const maxTime = Math.max(...data.map((d) => d.avgProcessingTime));
                  const height = (day.avgProcessingTime / maxTime) * 100;
                  const isGood = day.avgProcessingTime <= 3.0;

                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center">
                      <div
                        className={`text-xs font-semibold mb-2 ${
                          isGood ? 'text-green-600' : 'text-orange-600'
                        }`}
                      >
                        {day.avgProcessingTime}h
                      </div>
                      <div
                        className={`w-full rounded-t transition ${
                          isGood
                            ? 'bg-green-500 hover:bg-green-600'
                            : 'bg-orange-500 hover:bg-orange-600'
                        }`}
                        style={{ height: `${height * 2}px`, minHeight: '40px' }}
                      />
                      <div className="text-xs text-gray-500 mt-2">
                        {new Date(day.date).toLocaleDateString('ko-KR', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 성과 요약 */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-lg p-6">
            <h3 className="font-semibold text-green-900 mb-4 flex items-center gap-2">
              <CheckCircleIcon className="h-5 w-5" />
              💡 성과 요약
            </h3>
            <div className="space-y-3 text-sm">
              <div className="bg-white rounded-lg p-3">
                <div className="text-green-600 font-semibold mb-1">✅ 강점</div>
                <ul className="text-gray-700 space-y-1 text-xs">
                  <li>• 정확도 평균 <strong>{stats.avgAccuracy.toFixed(1)}%</strong> 우수</li>
                  <li>• 입출고 처리량 안정적</li>
                  <li>• 처리시간 지속적 개선</li>
                </ul>
              </div>
              <div className="bg-white rounded-lg p-3">
                <div className="text-blue-600 font-semibold mb-1">📊 목표</div>
                <ul className="text-gray-700 space-y-1 text-xs">
                  <li>• 정확도 99% 이상 유지</li>
                  <li>• 평균 처리시간 3시간 이내</li>
                  <li>• 일 처리량 50건 달성</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({
  title,
  value,
  unit,
  icon: Icon,
  color,
  trend,
}: {
  title: string;
  value: number | string;
  unit: string;
  icon: any;
  color: string;
  trend?: { value: number; direction: 'up' | 'down' };
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200',
  };

  return (
    <div className={`${colors[color]} border-2 rounded-lg shadow-sm p-4`}>
      <div className="flex items-center justify-between mb-2">
        <Icon className="h-6 w-6" />
        {trend && (
          <div
            className={`flex items-center gap-1 text-xs font-semibold ${
              (trend.direction === 'up' && title !== '평균 처리시간') ||
              (trend.direction === 'down' && title === '평균 처리시간')
                ? 'text-green-600'
                : 'text-red-600'
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
      <div className="text-xs font-medium opacity-90">{title}</div>
      <div className="text-2xl font-bold mt-1">
        {value}
        <span className="text-sm ml-1">{unit}</span>
      </div>
    </div>
  );
}

