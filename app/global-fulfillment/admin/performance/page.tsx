'use client';

import { useState } from 'react';
import {
  ChartBarIcon,
  TrophyIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  UserGroupIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';

interface PerformanceData {
  worker: string;
  department: string;
  metrics: {
    totalProcessed: number;
    avgProcessingTime: number;
    errorRate: number;
    efficiency: number;
    trend: 'up' | 'down' | 'stable';
  };
  weeklyData: {
    day: string;
    processed: number;
    errors: number;
  }[];
}

const SAMPLE_DATA: PerformanceData[] = [
  {
    worker: '김철수',
    department: '드롭시핑',
    metrics: {
      totalProcessed: 2847,
      avgProcessingTime: 3.2,
      errorRate: 1.1,
      efficiency: 98.9,
      trend: 'up'
    },
    weeklyData: [
      { day: '월', processed: 420, errors: 5 },
      { day: '화', processed: 450, errors: 3 },
      { day: '수', processed: 480, errors: 4 },
      { day: '목', processed: 465, errors: 6 },
      { day: '금', processed: 490, errors: 4 }
    ]
  },
  {
    worker: '이영희',
    department: '2차 정렬',
    metrics: {
      totalProcessed: 2634,
      avgProcessingTime: 3.5,
      errorRate: 1.9,
      efficiency: 98.1,
      trend: 'stable'
    },
    weeklyData: [
      { day: '월', processed: 380, errors: 8 },
      { day: '화', processed: 410, errors: 7 },
      { day: '수', processed: 430, errors: 9 },
      { day: '목', processed: 420, errors: 6 },
      { day: '금', processed: 440, errors: 8 }
    ]
  },
  {
    worker: '박민수',
    department: '패키지 검증',
    metrics: {
      totalProcessed: 2921,
      avgProcessingTime: 2.8,
      errorRate: 0.8,
      efficiency: 99.2,
      trend: 'up'
    },
    weeklyData: [
      { day: '월', processed: 450, errors: 2 },
      { day: '화', processed: 480, errors: 3 },
      { day: '수', processed: 500, errors: 2 },
      { day: '목', processed: 490, errors: 1 },
      { day: '금', processed: 510, errors: 2 }
    ]
  },
  {
    worker: '왕웨이',
    department: '무게 측정',
    metrics: {
      totalProcessed: 2476,
      avgProcessingTime: 3.0,
      errorRate: 1.8,
      efficiency: 98.2,
      trend: 'down'
    },
    weeklyData: [
      { day: '월', processed: 400, errors: 9 },
      { day: '화', processed: 380, errors: 7 },
      { day: '수', processed: 420, errors: 8 },
      { day: '목', processed: 390, errors: 10 },
      { day: '금', processed: 410, errors: 6 }
    ]
  },
  {
    worker: '최지혜',
    department: '교환/반품',
    metrics: {
      totalProcessed: 1854,
      avgProcessingTime: 4.5,
      errorRate: 0.5,
      efficiency: 99.5,
      trend: 'up'
    },
    weeklyData: [
      { day: '월', processed: 280, errors: 1 },
      { day: '화', processed: 300, errors: 1 },
      { day: '수', processed: 320, errors: 0 },
      { day: '목', processed: 310, errors: 2 },
      { day: '금', processed: 330, errors: 1 }
    ]
  }
];

const DEPARTMENT_STATS = [
  { name: '드롭시핑', workers: 3, avgEfficiency: 98.6, totalProcessed: 4521 },
  { name: '2차 정렬', workers: 2, avgEfficiency: 98.9, totalProcessed: 3845 },
  { name: '패키지 검증', workers: 2, avgEfficiency: 99.1, totalProcessed: 4234 },
  { name: '무게 측정', workers: 2, avgEfficiency: 98.4, totalProcessed: 3678 },
  { name: '교환/반품', workers: 1, avgEfficiency: 99.5, totalProcessed: 1854 }
];

export default function PerformancePage() {
  const [data] = useState<PerformanceData[]>(SAMPLE_DATA);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('week');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'efficiency' | 'processed' | 'errorRate'>('efficiency');

  // 필터링 및 정렬
  const filteredData = data
    .filter(d => selectedDepartment === 'all' || d.department === selectedDepartment)
    .sort((a, b) => {
      if (sortBy === 'efficiency') return b.metrics.efficiency - a.metrics.efficiency;
      if (sortBy === 'processed') return b.metrics.totalProcessed - a.metrics.totalProcessed;
      return a.metrics.errorRate - b.metrics.errorRate;
    });

  // 전체 통계
  const totalStats = {
    totalProcessed: data.reduce((sum, d) => sum + d.metrics.totalProcessed, 0),
    avgEfficiency: data.reduce((sum, d) => sum + d.metrics.efficiency, 0) / data.length,
    avgErrorRate: data.reduce((sum, d) => sum + d.metrics.errorRate, 0) / data.length,
    topPerformer: data.reduce((prev, current) => 
      prev.metrics.efficiency > current.metrics.efficiency ? prev : current
    )
  };

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📊 성과 분석</h1>
          <p className="text-sm text-gray-600 mt-1">
            작업자별, 부서별 성과 분석 및 비교
          </p>
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

      {/* 전체 통계 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <ChartBarIcon className="h-8 w-8 text-blue-600" />
            <TrophyIcon className="h-6 w-6 text-yellow-500" />
          </div>
          <div className="text-sm text-blue-700 font-medium">총 처리 건수</div>
          <div className="text-3xl font-bold text-blue-900 mt-1">
            {totalStats.totalProcessed.toLocaleString()}
          </div>
          <p className="text-xs text-blue-600 mt-2">이번 주 전체</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <ArrowTrendingUpIcon className="h-8 w-8 text-green-600" />
          </div>
          <div className="text-sm text-green-700 font-medium">평균 효율성</div>
          <div className="text-3xl font-bold text-green-900 mt-1">
            {totalStats.avgEfficiency.toFixed(1)}%
          </div>
          <p className="text-xs text-green-600 mt-2">전체 평균</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <ExclamationTriangleIcon className="h-8 w-8 text-yellow-600" />
          </div>
          <div className="text-sm text-yellow-700 font-medium">평균 오류율</div>
          <div className="text-3xl font-bold text-yellow-900 mt-1">
            {totalStats.avgErrorRate.toFixed(1)}%
          </div>
          <p className="text-xs text-yellow-600 mt-2">개선 필요</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <TrophyIcon className="h-8 w-8 text-purple-600" />
          </div>
          <div className="text-sm text-purple-700 font-medium">최우수 작업자</div>
          <div className="text-2xl font-bold text-purple-900 mt-1">
            {totalStats.topPerformer.worker}
          </div>
          <p className="text-xs text-purple-600 mt-2">
            {totalStats.topPerformer.metrics.efficiency}% 효율성
          </p>
        </div>
      </div>

      {/* 필터 및 정렬 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex gap-4">
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">전체 부서</option>
            <option value="드롭시핑">드롭시핑</option>
            <option value="2차 정렬">2차 정렬</option>
            <option value="패키지 검증">패키지 검증</option>
            <option value="무게 측정">무게 측정</option>
            <option value="교환/반품">교환/반품</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="efficiency">효율성순</option>
            <option value="processed">처리량순</option>
            <option value="errorRate">오류율순</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* 작업자별 성과 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <UserGroupIcon className="h-5 w-5" />
              작업자별 성과
            </h2>
          </div>
          <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
            {filteredData.map((worker, idx) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-gray-900">{worker.worker}</span>
                      {idx === 0 && <TrophyIcon className="h-5 w-5 text-yellow-500" />}
                      <TrendBadge trend={worker.metrics.trend} />
                    </div>
                    <span className="text-sm text-gray-600">{worker.department}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">
                      {worker.metrics.efficiency}%
                    </div>
                    <div className="text-xs text-gray-500">효율성</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="bg-blue-50 p-2 rounded">
                    <div className="text-gray-600 text-xs">처리량</div>
                    <div className="font-semibold text-blue-600">
                      {worker.metrics.totalProcessed.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-green-50 p-2 rounded">
                    <div className="text-gray-600 text-xs">평균시간</div>
                    <div className="font-semibold text-green-600">
                      {worker.metrics.avgProcessingTime}분
                    </div>
                  </div>
                  <div className="bg-yellow-50 p-2 rounded">
                    <div className="text-gray-600 text-xs">오류율</div>
                    <div className="font-semibold text-yellow-600">
                      {worker.metrics.errorRate}%
                    </div>
                  </div>
                </div>

                {/* 주간 차트 */}
                <div className="mt-4">
                  <div className="text-xs text-gray-600 mb-2">주간 처리량 추이</div>
                  <div className="flex items-end gap-2 h-20">
                    {worker.weeklyData.map((day, dayIdx) => {
                      const maxProcessed = Math.max(...worker.weeklyData.map(d => d.processed));
                      const height = (day.processed / maxProcessed) * 100;
                      return (
                        <div key={dayIdx} className="flex-1 flex flex-col items-center gap-1">
                          <div className="relative w-full">
                            <div
                              className="bg-blue-500 rounded-t transition-all duration-300 hover:bg-blue-600"
                              style={{ height: `${height}%`, minHeight: '20px' }}
                              title={`${day.processed}건`}
                            />
                            {day.errors > 0 && (
                              <div
                                className="absolute top-0 left-0 w-full bg-red-500 rounded-t opacity-50"
                                style={{ height: `${(day.errors / day.processed) * 100}%` }}
                                title={`오류 ${day.errors}건`}
                              />
                            )}
                          </div>
                          <span className="text-xs text-gray-500">{day.day}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 부서별 통계 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ChartBarIcon className="h-5 w-5" />
              부서별 통계
            </h2>
          </div>
          <div className="p-4 space-y-4">
            {DEPARTMENT_STATS.map((dept, idx) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{dept.name}</h3>
                    <p className="text-sm text-gray-600">작업자 {dept.workers}명</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-purple-600">
                      {dept.avgEfficiency}%
                    </div>
                    <div className="text-xs text-gray-500">평균 효율성</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">처리량</span>
                      <span className="font-semibold">{dept.totalProcessed.toLocaleString()}건</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full"
                        style={{ 
                          width: `${(dept.totalProcessed / Math.max(...DEPARTMENT_STATS.map(d => d.totalProcessed))) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">효율성</span>
                      <span className="font-semibold">{dept.avgEfficiency}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{ width: `${dept.avgEfficiency}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 부서별 비교 차트 */}
          <div className="p-4 border-t border-gray-200">
            <h3 className="text-sm font-semibold mb-3">부서별 처리량 비교</h3>
            <div className="space-y-2">
              {DEPARTMENT_STATS.map((dept, idx) => {
                const maxProcessed = Math.max(...DEPARTMENT_STATS.map(d => d.totalProcessed));
                const percentage = (dept.totalProcessed / maxProcessed) * 100;
                return (
                  <div key={idx}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600">{dept.name}</span>
                      <span className="font-semibold">{dept.totalProcessed.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full ${
                          idx === 0 ? 'bg-blue-500' :
                          idx === 1 ? 'bg-purple-500' :
                          idx === 2 ? 'bg-green-500' :
                          idx === 3 ? 'bg-orange-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 인사이트 */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-4 flex items-center gap-2">
          <TrophyIcon className="h-5 w-5" />
          💡 성과 인사이트
        </h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="bg-white rounded-lg p-4">
            <div className="text-green-600 font-semibold mb-2">✅ 우수 성과</div>
            <p className="text-gray-700">
              최지혜님이 <strong>99.5%</strong>의 최고 효율성을 기록했습니다. 
              오류율도 <strong>0.5%</strong>로 가장 낮습니다.
            </p>
          </div>
          <div className="bg-white rounded-lg p-4">
            <div className="text-blue-600 font-semibold mb-2">📈 개선 추세</div>
            <p className="text-gray-700">
              박민수님과 김철수님이 <strong>상승 추세</strong>를 보이고 있습니다. 
              지속적인 성과 향상이 기대됩니다.
            </p>
          </div>
          <div className="bg-white rounded-lg p-4">
            <div className="text-yellow-600 font-semibold mb-2">⚠️ 주의 필요</div>
            <p className="text-gray-700">
              왕웨이님의 효율성이 <strong>하락 추세</strong>입니다. 
              개별 면담 및 추가 교육을 권장합니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrendBadge({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up') {
    return (
      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-semibold flex items-center gap-1">
        <ArrowTrendingUpIcon className="h-3 w-3" />
        상승
      </span>
    );
  }
  if (trend === 'down') {
    return (
      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-semibold flex items-center gap-1">
        <ArrowTrendingDownIcon className="h-3 w-3" />
        하락
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-semibold">
      안정
    </span>
  );
}
