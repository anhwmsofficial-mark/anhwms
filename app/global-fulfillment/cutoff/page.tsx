'use client';

import { useState, useEffect } from 'react';
import {
  ClockIcon,
  BellIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlusIcon,
  PencilIcon
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
  const [cutoffs, setCutoffs] = useState<Cutoff[]>(SAMPLE_CUTOFFS);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);

  // 실시간 시계
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 남은 시간 계산
  const getTimeUntilCutoff = (cutoffTime: string) => {
    const now = new Date();
    const [hours, minutes] = cutoffTime.split(':').map(Number);
    const cutoff = new Date();
    cutoff.setHours(hours, minutes, 0, 0);

    if (cutoff < now) {
      cutoff.setDate(cutoff.getDate() + 1);
    }

    const diff = cutoff.getTime() - now.getTime();
    const hoursLeft = Math.floor(diff / (1000 * 60 * 60));
    const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return { hoursLeft, minutesLeft, diff };
  };

  // 마감 상태 판정
  const getCutoffStatus = (cutoffTime: string, reminderMinutes: number, isActive: boolean) => {
    if (!isActive) return 'inactive';
    
    const { diff } = getTimeUntilCutoff(cutoffTime);
    const minutesLeft = diff / (1000 * 60);

    if (minutesLeft < 0) return 'passed';
    if (minutesLeft <= reminderMinutes) return 'urgent';
    if (minutesLeft <= reminderMinutes * 2) return 'warning';
    return 'normal';
  };

  // 전체 통계
  const totalStats = {
    activeCutoffs: cutoffs.filter(c => c.isActive).length,
    totalPending: cutoffs.reduce((sum, c) => sum + c.pendingOrders, 0),
    totalCompleted: cutoffs.reduce((sum, c) => sum + c.completedToday, 0),
    urgentCount: cutoffs.filter(c => getCutoffStatus(c.cutoffTime, c.reminderMinutesBefore, c.isActive) === 'urgent').length
  };

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">⏰ 마감 시간 (Cut-off)</h1>
          <p className="text-sm text-gray-600 mt-1">
            운송사별 마감 시간 관리 및 미처리건 모니터링
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm text-gray-600">현재 시각</div>
            <div className="text-2xl font-bold text-blue-600">
              {currentTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
          >
            <PlusIcon className="h-5 w-5" />
            마감 시간 추가
          </button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg shadow p-4">
          <div className="text-sm text-blue-700 font-medium">활성 마감</div>
          <div className="text-3xl font-bold text-blue-900 mt-1">{totalStats.activeCutoffs}</div>
          <p className="text-xs text-blue-600 mt-1">운영 중</p>
        </div>
        <div className="bg-yellow-50 rounded-lg shadow p-4">
          <div className="text-sm text-yellow-700 font-medium">미처리 건수</div>
          <div className="text-3xl font-bold text-yellow-900 mt-1">{totalStats.totalPending}</div>
          <p className="text-xs text-yellow-600 mt-1">마감 전 처리 필요</p>
        </div>
        <div className="bg-green-50 rounded-lg shadow p-4">
          <div className="text-sm text-green-700 font-medium">오늘 완료</div>
          <div className="text-3xl font-bold text-green-900 mt-1">{totalStats.totalCompleted}</div>
          <p className="text-xs text-green-600 mt-1">전체 처리량</p>
        </div>
        <div className="bg-red-50 rounded-lg shadow p-4">
          <div className="text-sm text-red-700 font-medium">긴급 마감</div>
          <div className="text-3xl font-bold text-red-900 mt-1">{totalStats.urgentCount}</div>
          <p className="text-xs text-red-600 mt-1">임박한 마감</p>
        </div>
      </div>

      {/* 긴급 알림 */}
      {totalStats.urgentCount > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 animate-pulse">
          <div className="flex items-center gap-3">
            <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-900">⚠️ 긴급: {totalStats.urgentCount}개 마감 시간 임박!</h3>
              <p className="text-sm text-red-700">
                {cutoffs
                  .filter(c => getCutoffStatus(c.cutoffTime, c.reminderMinutesBefore, c.isActive) === 'urgent')
                  .map(c => `${c.carrier} (${c.pendingOrders}건 대기)`)
                  .join(', ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 마감 시간 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cutoffs.map((cutoff) => {
          const status = getCutoffStatus(cutoff.cutoffTime, cutoff.reminderMinutesBefore, cutoff.isActive);
          const { hoursLeft, minutesLeft } = getTimeUntilCutoff(cutoff.cutoffTime);
          const completionRate = (cutoff.completedToday / cutoff.targetDaily) * 100;

          return (
            <div
              key={cutoff.id}
              className={`rounded-lg shadow-lg p-6 border-t-4 transition-all ${
                status === 'urgent' ? 'bg-red-50 border-red-500 ring-2 ring-red-300' :
                status === 'warning' ? 'bg-yellow-50 border-yellow-500' :
                status === 'passed' ? 'bg-gray-50 border-gray-400' :
                status === 'inactive' ? 'bg-gray-100 border-gray-300' :
                'bg-white border-blue-500'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <ClockIcon className={`h-8 w-8 ${
                  status === 'urgent' ? 'text-red-600' :
                  status === 'warning' ? 'text-yellow-600' :
                  status === 'passed' ? 'text-gray-400' :
                  status === 'inactive' ? 'text-gray-400' :
                  'text-blue-600'
                }`} />
                <div className="flex gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    cutoff.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {cutoff.isActive ? '✓ 활성' : '⚫ 비활성'}
                  </span>
                  {status === 'urgent' && (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 animate-pulse">
                      🔴 긴급
                    </span>
                  )}
                </div>
              </div>

              <h3 className="text-lg font-bold text-gray-900 mb-1">{cutoff.cutoffName}</h3>
              <p className="text-sm text-gray-600 mb-4">{cutoff.carrier}</p>

              {/* 마감 시간 */}
              <div className="bg-white rounded-lg p-4 mb-4 border-2 border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">마감 시각</span>
                  <span className={`text-3xl font-bold ${
                    status === 'urgent' ? 'text-red-600' :
                    status === 'warning' ? 'text-yellow-600' :
                    'text-blue-600'
                  }`}>
                    {cutoff.cutoffTime}
                  </span>
                </div>
                {cutoff.isActive && status !== 'passed' && (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {hoursLeft}시간 {minutesLeft}분 남음
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      알림: {cutoff.reminderMinutesBefore}분 전
                    </div>
                  </div>
                )}
                {status === 'passed' && (
                  <div className="text-center text-gray-500 font-semibold">
                    오늘 마감 완료 (내일 {cutoff.cutoffTime})
                  </div>
                )}
              </div>

              {/* 진행 상황 */}
              <div className="space-y-3 mb-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">미처리</span>
                    <span className={`font-bold ${
                      cutoff.pendingOrders > 10 ? 'text-red-600' :
                      cutoff.pendingOrders > 5 ? 'text-yellow-600' :
                      'text-green-600'
                    }`}>
                      {cutoff.pendingOrders}건
                    </span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">오늘 완료</span>
                    <span className="font-semibold">
                      {cutoff.completedToday} / {cutoff.targetDaily}건 ({completionRate.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        completionRate >= 100 ? 'bg-green-500' :
                        completionRate >= 80 ? 'bg-blue-500' :
                        'bg-yellow-500'
                      }`}
                      style={{ width: `${Math.min(completionRate, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* 추가 정보 */}
              <div className="space-y-2 text-sm mb-4 pb-4 border-b border-gray-200">
                <div className="flex justify-between">
                  <span className="text-gray-600">창고</span>
                  <span className="font-medium">{cutoff.warehouseLocation}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">국가</span>
                  <span className="font-medium">{cutoff.countryCode}</span>
                </div>
              </div>

              {/* 액션 버튼 */}
              <div className="flex gap-2">
                <button className="flex-1 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition text-sm font-medium flex items-center justify-center gap-1">
                  <PencilIcon className="h-4 w-4" />
                  편집
                </button>
                {cutoff.pendingOrders > 0 && (
                  <button className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition text-sm font-medium">
                    미처리 확인
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 운송사별 마감 시간 안내 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ClockIcon className="h-5 w-5" />
            운송사별 마감 시간 안내
          </h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 mb-3">🇰🇷 국내 운송사</h3>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="font-medium">한진택배</span>
                <span className="text-blue-600 font-bold">18:30</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="font-medium">CJ대한통운</span>
                <span className="text-blue-600 font-bold">18:00</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="font-medium">롯데택배</span>
                <span className="text-blue-600 font-bold">17:30</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="font-medium">EMS 우편</span>
                <span className="text-blue-600 font-bold">16:30</span>
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 mb-3">🌏 국제 운송사</h3>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="font-medium">顺丰速运</span>
                <span className="text-blue-600 font-bold">17:00</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="font-medium">DHL Express</span>
                <span className="text-blue-600 font-bold">16:00</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="font-medium">FedEx</span>
                <span className="text-blue-600 font-bold">16:00</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="font-medium">UPS</span>
                <span className="text-blue-600 font-bold">15:30</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 사용 가이드 */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
        <h3 className="font-semibold text-orange-900 mb-3 flex items-center gap-2">
          <BellIcon className="h-6 w-6" />
          💡 마감 시간 관리 가이드 (发货截止时间)
        </h3>
        <ul className="space-y-2 text-sm text-orange-800">
          <li>• <strong>실시간 모니터링</strong>: 마감 시간까지 남은 시간을 실시간으로 확인하세요</li>
          <li>• <strong>알림 설정</strong>: 마감 전 지정된 시간(예: 60분)에 자동 알림이 발송됩니다</li>
          <li>• <strong>미처리 건 확인</strong>: 각 운송사별 미처리 건수를 확인하고 마감 전 완료하세요</li>
          <li>• <strong>목표 달성률</strong>: 일일 목표 대비 처리율을 실시간으로 추적합니다</li>
          <li>• <strong>긴급 마감</strong>: 빨간색으로 표시된 긴급 마감 건은 우선 처리하세요</li>
        </ul>
      </div>
    </div>
  );
}
