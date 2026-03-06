'use client';

import { useState } from 'react';
import { mockMyTasks } from '@/lib/mockData';
import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  QrCodeIcon,
  MapPinIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';

export default function MyTasksTab() {
  const [tasks, setTasks] = useState(mockMyTasks);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');

  // 필터링
  const filteredTasks = tasks.filter((task) => {
    if (filterStatus === 'all') return true;
    return task.status === filterStatus;
  });

  // 우선순위 색상
  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'high': 'text-red-600 bg-red-50 border-red-200',
      'medium': 'text-yellow-600 bg-yellow-50 border-yellow-200',
      'low': 'text-green-600 bg-green-50 border-green-200',
    };
    return colors[priority] || colors['medium'];
  };

  const getPriorityLabel = (priority: string) => {
    const labels: Record<string, string> = {
      'high': '🔴 높음',
      'medium': '🟡 보통',
      'low': '🟢 낮음',
    };
    return labels[priority] || '보통';
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, React.ReactElement> = {
      'planned': <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">📋 예정</span>,
      'in-progress': <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">🔄 진행중</span>,
      'completed': <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">✅ 완료</span>,
    };
    return badges[status] || null;
  };

  const handleStartTask = (taskId: string) => {
    setTasks(tasks.map(task =>
      task.id === taskId ? { ...task, status: 'in-progress' as const } : task
    ));
  };

  const handleCompleteTask = (taskId: string) => {
    setTasks(tasks.map(task =>
      task.id === taskId ? { ...task, status: 'completed' as const } : task
    ));
  };

  // 시간순 정렬
  const sortedTasks = [...filteredTasks].sort((a, b) => 
    new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );

  // 타임라인 그룹핑 (오늘, 내일, 이번 주)
  const groupByTimeline = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const groups: Record<string, typeof sortedTasks> = {
      '오늘': [],
      '내일': [],
      '이번 주': [],
      '그 이후': [],
    };

    sortedTasks.forEach(task => {
      const taskDate = new Date(task.dueDate);
      const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());

      if (taskDay.getTime() === today.getTime()) {
        groups['오늘'].push(task);
      } else if (taskDay.getTime() === tomorrow.getTime()) {
        groups['내일'].push(task);
      } else if (taskDay < weekEnd) {
        groups['이번 주'].push(task);
      } else {
        groups['그 이후'].push(task);
      }
    });

    return groups;
  };

  const formatTime = (date: Date) => {
    if (!date || isNaN(new Date(date).getTime())) return '-';
    return new Date(date).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateTime = (date: Date) => {
    if (!date || isNaN(new Date(date).getTime())) return '-';
    return new Date(date).toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* 오늘 날짜 헤더 */}
      <div className="bg-gradient-to-r from-green-500 to-blue-500 rounded-xl shadow-lg p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">
              {new Date().toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long'
              })}
            </h2>
            <p className="text-green-100 mt-1">나의 작업 스케줄</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{tasks.filter(t => t.status !== 'completed').length}</div>
            <div className="text-green-100 text-sm">남은 작업</div>
          </div>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-lg p-5 border-2 border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <ClockIcon className="h-6 w-6 text-gray-600" />
            <span className="text-sm text-gray-600">예정된 작업</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {tasks.filter(t => t.status === 'planned').length}
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-5 border-2 border-blue-200">
          <div className="flex items-center gap-3 mb-2">
            <ExclamationCircleIcon className="h-6 w-6 text-blue-600" />
            <span className="text-sm text-gray-600">진행중인 작업</span>
          </div>
          <div className="text-3xl font-bold text-blue-600">
            {tasks.filter(t => t.status === 'in-progress').length}
          </div>
        </div>

        <div className="bg-green-50 rounded-lg p-5 border-2 border-green-200">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircleIcon className="h-6 w-6 text-green-600" />
            <span className="text-sm text-gray-600">완료된 작업</span>
          </div>
          <div className="text-3xl font-bold text-green-600">
            {tasks.filter(t => t.status === 'completed').length}
          </div>
        </div>
      </div>

      {/* 필터 및 뷰 선택 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="flex-1 md:flex-none px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          >
            <option value="all">전체 작업</option>
            <option value="planned">예정</option>
            <option value="in-progress">진행중</option>
            <option value="completed">완료</option>
          </select>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg transition ${
                viewMode === 'list'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              목록
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-4 py-2 rounded-lg transition ${
                viewMode === 'timeline'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              타임라인
            </button>
          </div>
        </div>
      </div>

      {/* 작업 목록 */}
      {viewMode === 'list' ? (
        <div className="space-y-4">
          {filteredTasks.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
              <CheckCircleIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>작업이 없습니다</p>
            </div>
          ) : (
            filteredTasks.map((task) => (
            <div
              key={task.id}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition"
            >
              {/* 헤더 */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xl font-bold text-gray-900">{task.title}</h3>
                    {getStatusBadge(task.status)}
                  </div>
                  <p className="text-sm text-gray-600">{task.description}</p>
                </div>
                <div className={`px-3 py-1 rounded-lg border-2 font-semibold text-sm ${getPriorityColor(task.priority)}`}>
                  {getPriorityLabel(task.priority)}
                </div>
              </div>

              {/* 상세 정보 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-xs text-gray-600 mb-1">제품</div>
                  <div className="font-semibold text-gray-900">{task.productName}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-xs text-gray-600 mb-1">수량</div>
                  <div className="font-semibold text-gray-900">{task.quantity}{task.unit}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                    <MapPinIcon className="h-3 w-3" />
                    위치
                  </div>
                  <div className="font-semibold text-gray-900">{task.location}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" />
                    완료 예정
                  </div>
                  <div className="font-semibold text-gray-900">
                    {formatDateTime(task.dueDate)}
                  </div>
                </div>
              </div>

              {/* 진행 상황 바 (마감 시간 기준) */}
              {task.status !== 'completed' && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-600">남은 시간</span>
                    <span className="font-semibold text-gray-900">
                      {(() => {
                        const now = new Date();
                        const due = new Date(task.dueDate);
                        const diff = due.getTime() - now.getTime();
                        const hours = Math.floor(diff / (1000 * 60 * 60));
                        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                        if (diff < 0) return '지연됨';
                        if (hours > 24) return `${Math.floor(hours / 24)}일 ${hours % 24}시간`;
                        if (hours > 0) return `${hours}시간 ${minutes}분`;
                        return `${minutes}분`;
                      })()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        (() => {
                          const now = new Date();
                          const due = new Date(task.dueDate);
                          const diff = due.getTime() - now.getTime();
                          if (diff < 0) return 'bg-red-500';
                          if (diff < 60 * 60 * 1000) return 'bg-orange-500';
                          return 'bg-green-500';
                        })()
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            0,
                            ((new Date(task.dueDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)) * 100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* 바코드/QR 코드 */}
              <div className="bg-blue-50 p-3 rounded-lg mb-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-600 mb-1">바코드/QR 코드</div>
                  <div className="font-mono font-semibold text-blue-900">
                    {task.barcode} / {task.qrCode}
                  </div>
                </div>
                <QrCodeIcon className="h-8 w-8 text-blue-600" />
              </div>

              {/* 액션 버튼 */}
              <div className="flex gap-2">
                {task.status === 'planned' && (
                  <button
                    onClick={() => handleStartTask(task.id)}
                    className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
                  >
                    작업 시작
                  </button>
                )}
                {task.status === 'in-progress' && (
                  <button
                    onClick={() => handleCompleteTask(task.id)}
                    className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
                  >
                    완료 처리
                  </button>
                )}
                {task.status === 'completed' && (
                  <div className="flex-1 py-2 bg-green-100 text-green-700 rounded-lg text-center font-semibold">
                    ✅ 완료됨
                  </div>
                )}
                <button className="px-4 py-2 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition">
                  상세
                </button>
              </div>
            </div>
          ))
        )}
        </div>
      ) : (
        /* 타임라인 뷰 */
        <div className="space-y-6">
          {Object.entries(groupByTimeline()).map(([timeLabel, tasks]) => (
            tasks.length > 0 && (
              <div key={timeLabel} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="bg-gradient-to-r from-green-100 to-blue-100 px-6 py-4 border-b-2 border-green-200">
                  <h3 className="text-lg font-bold text-gray-900">⏰ {timeLabel}</h3>
                  <p className="text-sm text-gray-600 mt-1">{tasks.length}개 작업</p>
                </div>
                <div className="p-4">
                  <div className="relative">
                    {/* 타임라인 라인 */}
                    <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                    
                    <div className="space-y-4">
                      {tasks.map((task) => (
                        <div key={task.id} className="relative pl-16">
                          {/* 타임라인 점 */}
                          <div className={`absolute left-6 top-4 w-4 h-4 rounded-full border-2 ${
                            task.status === 'completed' ? 'bg-green-500 border-green-500' :
                            task.status === 'in-progress' ? 'bg-blue-500 border-blue-500' :
                            'bg-gray-300 border-gray-300'
                          }`}></div>

                          {/* 시간 표시 */}
                          <div className="absolute left-0 top-3 w-12 text-right">
                            <div className="text-sm font-bold text-gray-900">
                              {formatTime(task.dueDate)}
                            </div>
                          </div>

                          {/* 작업 카드 */}
                          <div className={`border-l-4 ${
                            task.priority === 'high' ? 'border-red-400' :
                            task.priority === 'medium' ? 'border-yellow-400' :
                            'border-green-400'
                          } bg-gray-50 p-4 rounded-r-lg hover:bg-gray-100 transition`}>
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold text-gray-900">{task.title}</h4>
                                  {getStatusBadge(task.status)}
                                  <span className={`px-2 py-0.5 text-xs font-semibold rounded ${getPriorityColor(task.priority)}`}>
                                    {getPriorityLabel(task.priority)}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600">{task.productName} • {task.quantity}{task.unit} • {task.location}</p>
                              </div>
                              <div className="flex gap-2 ml-4">
                                {task.status === 'planned' && (
                                  <button
                                    onClick={() => handleStartTask(task.id)}
                                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                                  >
                                    시작
                                  </button>
                                )}
                                {task.status === 'in-progress' && (
                                  <button
                                    onClick={() => handleCompleteTask(task.id)}
                                    className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition"
                                  >
                                    완료
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}

