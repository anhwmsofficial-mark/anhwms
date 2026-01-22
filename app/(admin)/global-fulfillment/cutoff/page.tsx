'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { useLayout } from '@/components/LayoutWrapper';
import {
  ClockIcon,
  BellIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlusIcon,
  PencilIcon,
  TruckIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

interface Cutoff {
  id: string;
  cutoffName: string;
  carrier: string;
  cutoffTime: string;
  warehouseLocation: string;
  countryCode: string;
  isActive: boolean;
  reminderMinutesBefore: number;
  pendingOrders: number;
  completedToday: number;
  targetDaily: number;
}

const SAMPLE_CUTOFFS: Cutoff[] = [
  {
    id: '1',
    cutoffName: 'CJ 일일 마감',
    carrier: 'CJ대한통운',
    cutoffTime: '18:00',
    warehouseLocation: '인천창고',
    countryCode: 'KR',
    isActive: true,
    reminderMinutesBefore: 60,
    pendingOrders: 23,
    completedToday: 487,
    targetDaily: 500
  },
  {
    id: '2',
    cutoffName: '顺丰 일일 마감',
    carrier: '顺丰速运',
    cutoffTime: '17:00',
    warehouseLocation: '인천창고',
    countryCode: 'CN',
    isActive: true,
    reminderMinutesBefore: 60,
    pendingOrders: 8,
    completedToday: 312,
    targetDaily: 320
  },
  {
    id: '3',
    cutoffName: '한진 일일 마감',
    carrier: '한진택배',
    cutoffTime: '18:30',
    warehouseLocation: '인천창고',
    countryCode: 'KR',
    isActive: true,
    reminderMinutesBefore: 60,
    pendingOrders: 34,
    completedToday: 542,
    targetDaily: 550
  },
  {
    id: '4',
    cutoffName: 'EMS 일일 마감',
    carrier: 'EMS 우편',
    cutoffTime: '16:30',
    warehouseLocation: '인천창고',
    countryCode: 'KR',
    isActive: true,
    reminderMinutesBefore: 30,
    pendingOrders: 2,
    completedToday: 148,
    targetDaily: 150
  },
  {
    id: '5',
    cutoffName: '롯데 주말 마감',
    carrier: '롯데택배',
    cutoffTime: '14:00',
    warehouseLocation: '인천창고',
    countryCode: 'KR',
    isActive: false,
    reminderMinutesBefore: 120,
    pendingOrders: 0,
    completedToday: 0,
    targetDaily: 200
  }
];

export default function CutoffPage() {
  const { toggleSidebar } = useLayout();
  const [cutoffs, setCutoffs] = useState<Cutoff[]>(SAMPLE_CUTOFFS);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const getTimeUntilCutoff = (cutoffTime: string): { hours: number; minutes: number; isPast: boolean } => {
    const [hours, minutes] = cutoffTime.split(':').map(Number);
    const cutoffDate = new Date();
    cutoffDate.setHours(hours, minutes, 0, 0);

    const diff = cutoffDate.getTime() - currentTime.getTime();
    const isPast = diff < 0;
    const absDiff = Math.abs(diff);

    return {
      hours: Math.floor(absDiff / (1000 * 60 * 60)),
      minutes: Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60)),
      isPast
    };
  };

  const getCutoffStatus = (cutoffTime: string, reminderMinutes: number) => {
    const { hours, minutes, isPast } = getTimeUntilCutoff(cutoffTime);
    const totalMinutes = hours * 60 + minutes;

    if (isPast) return 'completed';
    if (totalMinutes <= reminderMinutes / 2) return 'critical';
    if (totalMinutes <= reminderMinutes) return 'warning';
    return 'normal';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'bg-red-100 border-red-500 text-red-900';
      case 'warning': return 'bg-yellow-100 border-yellow-500 text-yellow-900';
      case 'completed': return 'bg-gray-100 border-gray-500 text-gray-600';
      default: return 'bg-green-100 border-green-500 text-green-900';
    }
  };

  const totalPendingOrders = cutoffs.filter(c => c.isActive).reduce((sum, c) => sum + c.pendingOrders, 0);
  const totalCompletedToday = cutoffs.filter(c => c.isActive).reduce((sum, c) => sum + c.completedToday, 0);
  const totalTarget = cutoffs.filter(c => c.isActive).reduce((sum, c) => sum + c.targetDaily, 0);
  const completionRate = totalTarget > 0 ? (totalCompletedToday / totalTarget) * 100 : 0;

  return (
    <div className="flex flex-col h-screen">
      <Header title="⏰ 마감 시간" onMenuClick={toggleSidebar} />
      
      <main className="flex-1 overflow-y-auto bg-gray-50 p-4 lg:p-6">
        <div className="space-y-6">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">마감 시간 (Cut-off Time)</h1>
              <p className="text-sm text-gray-600 mt-1">
                물류사별 출고 마감 시간 관리 및 알림
              </p>
            </div>
            <div className="text-right bg-white rounded-lg shadow px-6 py-3">
              <div className="text-sm text-gray-600">현재 시간</div>
              <div className="text-2xl font-bold text-gray-900">
                {currentTime.toLocaleTimeString('ko-KR')}
              </div>
            </div>
          </div>

          {/* 전체 통계 */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-600">활성 마감</div>
                <ClockIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {cutoffs.filter(c => c.isActive).length}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-600">대기 주문</div>
                <ExclamationTriangleIcon className="h-5 w-5 text-orange-600" />
              </div>
              <div className="text-3xl font-bold text-orange-600">
                {totalPendingOrders}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-600">오늘 완료</div>
                <CheckCircleIcon className="h-5 w-5 text-green-600" />
              </div>
              <div className="text-3xl font-bold text-green-600">
                {totalCompletedToday}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-600">달성률</div>
                <ChartBarIcon className="h-5 w-5 text-purple-600" />
              </div>
              <div className="text-3xl font-bold text-purple-600">
                {completionRate.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* 마감 시간 목록 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {cutoffs.map((cutoff) => {
              const { hours, minutes, isPast } = getTimeUntilCutoff(cutoff.cutoffTime);
              const status = getCutoffStatus(cutoff.cutoffTime, cutoff.reminderMinutesBefore);
              const progressPercent = cutoff.targetDaily > 0 
                ? (cutoff.completedToday / cutoff.targetDaily) * 100 
                : 0;

              return (
                <div
                  key={cutoff.id}
                  className={`rounded-xl shadow-lg border-l-4 overflow-hidden ${getStatusColor(status)} ${
                    !cutoff.isActive ? 'opacity-50' : ''
                  }`}
                >
                  <div className="bg-white p-6">
                    {/* 헤더 */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-bold text-gray-900">{cutoff.cutoffName}</h3>
                          {!cutoff.isActive && (
                            <span className="px-2 py-1 bg-gray-200 text-gray-600 rounded text-xs font-semibold">
                              비활성
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <TruckIcon className="h-4 w-4" />
                          {cutoff.carrier}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-gray-900">{cutoff.cutoffTime}</div>
                        <div className="text-xs text-gray-500">마감 시간</div>
                      </div>
                    </div>

                    {/* 시간 표시 */}
                    {cutoff.isActive && (
                      <div className="mb-4">
                        {isPast ? (
                          <div className="flex items-center gap-2 text-gray-600">
                            <CheckCircleIcon className="h-5 w-5" />
                            <span className="font-semibold">마감 완료</span>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <ClockIcon className={`h-5 w-5 ${
                                status === 'critical' ? 'text-red-600' :
                                status === 'warning' ? 'text-yellow-600' :
                                'text-green-600'
                              }`} />
                              <span className={`text-2xl font-bold ${
                                status === 'critical' ? 'text-red-600' :
                                status === 'warning' ? 'text-yellow-600' :
                                'text-green-600'
                              }`}>
                                {hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')}
                              </span>
                              <span className="text-sm text-gray-600">남음</span>
                            </div>
                            {status === 'critical' && (
                              <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700 flex items-center gap-2">
                                <BellIcon className="h-4 w-4" />
                                <span className="font-semibold">긴급! 마감 임박</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 진행 상태 */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">진행 상황</span>
                        <span className="font-semibold text-gray-900">
                          {cutoff.completedToday} / {cutoff.targetDaily} ({progressPercent.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full transition-all ${
                            progressPercent >= 100 ? 'bg-green-500' :
                            progressPercent >= 80 ? 'bg-blue-500' :
                            'bg-yellow-500'
                          }`}
                          style={{ width: `${Math.min(100, progressPercent)}%` }}
                        />
                      </div>
                    </div>

                    {/* 대기 주문 */}
                    {cutoff.pendingOrders > 0 && (
                      <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <div className="text-xs text-orange-700 font-semibold">대기중인 주문</div>
                          <div className="text-2xl font-bold text-orange-900">{cutoff.pendingOrders}건</div>
                        </div>
                        <button className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-semibold">
                          처리하기
                        </button>
                      </div>
                    )}

                    {/* 알림 설정 */}
                    <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-600">
                      <div className="flex items-center gap-2">
                        <BellIcon className="h-4 w-4" />
                        <span>알림: 마감 {cutoff.reminderMinutesBefore}분 전</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 사용 가이드 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold text-blue-900 mb-3">💡 마감 시간 관리 가이드</h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li>• <strong>실시간 모니터링</strong>: 각 물류사의 마감 시간까지 남은 시간 실시간 표시</li>
              <li>• <strong>알림 시스템</strong>: 설정한 시간 전에 자동으로 알림 발송</li>
              <li>• <strong>진행 상황 추적</strong>: 일일 목표 대비 완료율 시각화</li>
              <li>• <strong>대기 주문 관리</strong>: 마감 전 처리해야 할 주문 강조 표시</li>
              <li>• <strong>우선순위</strong>: 마감 시간이 가까운 순서로 자동 정렬</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
