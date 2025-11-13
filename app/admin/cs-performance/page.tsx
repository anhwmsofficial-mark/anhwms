'use client';

import { useState } from 'react';
import {
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  CheckCircleIcon,
  LanguageIcon,
  UserGroupIcon,
  CalendarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';

interface PerformanceData {
  date: string;
  conversations: number;
  avgResponseTime: number;
  customerSatisfaction: number;
  translationCount: number;
  resolutionRate: number;
}

const SAMPLE_DATA: PerformanceData[] = [
  {
    date: '2025-01-01',
    conversations: 145,
    avgResponseTime: 2.1,
    customerSatisfaction: 94.2,
    translationCount: 320,
    resolutionRate: 89.5,
  },
  {
    date: '2025-01-02',
    conversations: 158,
    avgResponseTime: 1.9,
    customerSatisfaction: 95.1,
    translationCount: 355,
    resolutionRate: 91.2,
  },
  {
    date: '2025-01-03',
    conversations: 172,
    avgResponseTime: 2.3,
    customerSatisfaction: 93.8,
    translationCount: 380,
    resolutionRate: 88.7,
  },
  {
    date: '2025-01-04',
    conversations: 156,
    avgResponseTime: 2.0,
    customerSatisfaction: 94.5,
    translationCount: 340,
    resolutionRate: 90.1,
  },
];

export default function CSPerformancePage() {
  const [data] = useState<PerformanceData[]>(SAMPLE_DATA);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('week');

  // 통계 계산
  const stats = {
    totalConversations: data.reduce((sum, d) => sum + d.conversations, 0),
    avgResponseTime: data.reduce((sum, d) => sum + d.avgResponseTime, 0) / data.length,
    avgSatisfaction: data.reduce((sum, d) => sum + d.customerSatisfaction, 0) / data.length,
    totalTranslations: data.reduce((sum, d) => sum + d.translationCount, 0),
    avgResolutionRate: data.reduce((sum, d) => sum + d.resolutionRate, 0) / data.length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">📊 CS 성과 분석</h1>
              <p className="text-sm text-gray-600 mt-1">응답률, 만족도, 효율성 분석</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedPeriod('week')}
                className={`px-4 py-2 rounded-lg transition ${
                  selectedPeriod === 'week'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                주간
              </button>
              <button
                onClick={() => setSelectedPeriod('month')}
                className={`px-4 py-2 rounded-lg transition ${
                  selectedPeriod === 'month'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                월간
              </button>
              <button
                onClick={() => setSelectedPeriod('quarter')}
                className={`px-4 py-2 rounded-lg transition ${
                  selectedPeriod === 'quarter'
                    ? 'bg-blue-600 text-white'
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
        {/* 전체 통계 */}
        <div className="grid grid-cols-5 gap-4">
          <StatCard
            title="총 대화"
            value={stats.totalConversations}
            unit="건"
            icon={ChatBubbleLeftRightIcon}
            color="blue"
            trend={{ value: 8.5, direction: 'up' }}
          />
          <StatCard
            title="평균 응답시간"
            value={stats.avgResponseTime.toFixed(1)}
            unit="분"
            icon={ClockIcon}
            color="purple"
            trend={{ value: 5.2, direction: 'down' }}
          />
          <StatCard
            title="고객 만족도"
            value={stats.avgSatisfaction.toFixed(1)}
            unit="%"
            icon={CheckCircleIcon}
            color="green"
            trend={{ value: 2.1, direction: 'up' }}
          />
          <StatCard
            title="총 번역"
            value={stats.totalTranslations}
            unit="회"
            icon={LanguageIcon}
            color="orange"
            trend={{ value: 12.3, direction: 'up' }}
          />
          <StatCard
            title="해결률"
            value={stats.avgResolutionRate.toFixed(1)}
            unit="%"
            icon={ChartBarIcon}
            color="indigo"
            trend={{ value: 1.8, direction: 'up' }}
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* 일별 대화 추이 */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <ChatBubbleLeftRightIcon className="h-5 w-5" />
                일별 대화 건수
              </h2>
            </div>
            <div className="p-6">
              <div className="flex items-end justify-between gap-2 h-64">
                {data.map((day, idx) => {
                  const maxConversations = Math.max(...data.map((d) => d.conversations));
                  const height = (day.conversations / maxConversations) * 100;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center">
                      <div className="text-sm font-semibold text-blue-600 mb-2">
                        {day.conversations}
                      </div>
                      <div
                        className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t hover:from-blue-700 hover:to-blue-500 transition-all cursor-pointer"
                        style={{ height: `${height}%`, minHeight: '40px' }}
                      />
                      <div className="mt-2 text-xs text-gray-600">
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

          {/* 평균 응답시간 추이 */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <ClockIcon className="h-5 w-5" />
                평균 응답시간 추이
              </h2>
            </div>
            <div className="p-6">
              <div className="flex items-end justify-between gap-2 h-64">
                {data.map((day, idx) => {
                  const maxTime = Math.max(...data.map((d) => d.avgResponseTime));
                  const height = (day.avgResponseTime / maxTime) * 100;
                  const isGood = day.avgResponseTime <= 2.0;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center">
                      <div
                        className={`text-sm font-semibold mb-2 ${
                          isGood ? 'text-green-600' : 'text-yellow-600'
                        }`}
                      >
                        {day.avgResponseTime}분
                      </div>
                      <div
                        className={`w-full rounded-t transition-all cursor-pointer ${
                          isGood
                            ? 'bg-gradient-to-t from-green-600 to-green-400 hover:from-green-700 hover:to-green-500'
                            : 'bg-gradient-to-t from-yellow-600 to-yellow-400 hover:from-yellow-700 hover:to-yellow-500'
                        }`}
                        style={{ height: `${height}%`, minHeight: '40px' }}
                      />
                      <div className="mt-2 text-xs text-gray-600">
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

          {/* 고객 만족도 추이 */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <CheckCircleIcon className="h-5 w-5" />
                고객 만족도 추이
              </h2>
            </div>
            <div className="p-6">
              <div className="flex items-end justify-between gap-2 h-64">
                {data.map((day, idx) => {
                  const height = day.customerSatisfaction;
                  const isExcellent = day.customerSatisfaction >= 95;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center">
                      <div
                        className={`text-sm font-semibold mb-2 ${
                          isExcellent ? 'text-green-600' : 'text-blue-600'
                        }`}
                      >
                        {day.customerSatisfaction}%
                      </div>
                      <div
                        className={`w-full rounded-t transition-all cursor-pointer ${
                          isExcellent
                            ? 'bg-gradient-to-t from-green-600 to-green-400 hover:from-green-700 hover:to-green-500'
                            : 'bg-gradient-to-t from-blue-600 to-blue-400 hover:from-blue-700 hover:to-blue-500'
                        }`}
                        style={{ height: `${height}%`, minHeight: '40px' }}
                      />
                      <div className="mt-2 text-xs text-gray-600">
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

          {/* 번역 사용 추이 */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <LanguageIcon className="h-5 w-5" />
                번역 사용 추이
              </h2>
            </div>
            <div className="p-6">
              <div className="flex items-end justify-between gap-2 h-64">
                {data.map((day, idx) => {
                  const maxTranslations = Math.max(...data.map((d) => d.translationCount));
                  const height = (day.translationCount / maxTranslations) * 100;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center">
                      <div className="text-sm font-semibold text-orange-600 mb-2">
                        {day.translationCount}
                      </div>
                      <div
                        className="w-full bg-gradient-to-t from-orange-600 to-orange-400 rounded-t hover:from-orange-700 hover:to-orange-500 transition-all cursor-pointer"
                        style={{ height: `${height}%`, minHeight: '40px' }}
                      />
                      <div className="mt-2 text-xs text-gray-600">
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
        </div>

        {/* 성과 요약 */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-4 flex items-center gap-2">
            <ChartBarIcon className="h-5 w-5" />
            💡 성과 분석 요약
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4">
              <div className="text-green-600 font-semibold mb-1 flex items-center gap-2">
                <CheckCircleIcon className="h-5 w-5" />✅ 강점
              </div>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• 고객 만족도 <strong>{stats.avgSatisfaction.toFixed(1)}%</strong> 양호</li>
                <li>• 번역 기능 활발히 사용 중</li>
                <li>• 해결률 <strong>{stats.avgResolutionRate.toFixed(1)}%</strong> 우수</li>
              </ul>
            </div>
            <div className="bg-white rounded-lg p-4">
              <div className="text-yellow-600 font-semibold mb-1 flex items-center gap-2">
                <ClockIcon className="h-5 w-5" />
                ⚠️ 개선 필요
              </div>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• 응답시간 편차 조정 필요</li>
                <li>• 피크타임 인력 보강 검토</li>
                <li>• 템플릿 활용도 증대</li>
              </ul>
            </div>
            <div className="bg-white rounded-lg p-4">
              <div className="text-blue-600 font-semibold mb-1 flex items-center gap-2">
                <ChartBarIcon className="h-5 w-5" />
                📊 목표
              </div>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• 평균 응답시간 2분 이내</li>
                <li>• 고객 만족도 95% 이상</li>
                <li>• 해결률 92% 목표</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
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
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  };

  return (
    <div className={`${colors[color]} border-2 rounded-lg shadow-sm p-4`}>
      <div className="flex items-center justify-between mb-2">
        <Icon className="h-6 w-6" />
        {trend && (
          <div
            className={`flex items-center gap-1 text-xs font-semibold ${
              (trend.direction === 'up' && title !== '평균 응답시간') ||
              (trend.direction === 'down' && title === '평균 응답시간')
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

