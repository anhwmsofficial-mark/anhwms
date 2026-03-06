'use client';

import { useState } from 'react';
import { mockWorkOrders, getOpsStats } from '@/lib/mockData';
import {
  ClockIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  CubeIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

export default function OpsBoard() {
  const [workOrders] = useState(mockWorkOrders);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'schedule'>('list');
  
  const opsStats = getOpsStats();

  // 필터링
  const filteredOrders = workOrders.filter((order) => {
    const matchesSearch = 
      order.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.assignee && order.assignee.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesType = filterType === 'all' || order.type === filterType;
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const badges: Record<string, React.ReactElement> = {
      'planned': <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">📋 계획</span>,
      'in-progress': <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">🔄 진행중</span>,
      'completed': <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">✅ 완료</span>,
      'overdue': <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">⚠️ 지연</span>,
      'on-hold': <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-700">⏸️ 보류</span>,
    };
    return badges[status] || null;
  };

  const getTypeBadge = (type: string) => {
    const badges: Record<string, React.ReactElement> = {
      'inbound': <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-50 text-green-700">⬇️ 입고</span>,
      'outbound': <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700">⬆️ 출고</span>,
      'packing': <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-50 text-purple-700">📦 포장</span>,
    };
    return badges[type] || null;
  };

  // 날짜별 그룹핑
  const groupByDate = () => {
    const groups: Record<string, typeof filteredOrders> = {};
    
    filteredOrders.forEach(order => {
      if (!order.dueDate || isNaN(order.dueDate.getTime())) return;
      
      const dateKey = order.dueDate.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short'
      });
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(order);
    });
    
    return groups;
  };

  const formatDateTime = (date: Date) => {
    if (!date || isNaN(date.getTime())) return '-';
    return date.toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* 오늘 날짜 헤더 */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl shadow-lg p-5 text-white">
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
            <p className="text-orange-100 mt-1">오늘의 작업 스케줄</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{filteredOrders.length}</div>
            <div className="text-orange-100 text-sm">총 작업</div>
          </div>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 입고 통계 */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">⬇️ 입고 작업</h3>
            <ArrowDownTrayIcon className="h-5 w-5 text-green-600" />
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <div className="text-xs text-gray-500">계획</div>
              <div className="text-lg font-bold text-gray-700">{opsStats.inbound.planned}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">진행</div>
              <div className="text-lg font-bold text-blue-600">{opsStats.inbound.inProgress}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">완료</div>
              <div className="text-lg font-bold text-green-600">{opsStats.inbound.completed}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">지연</div>
              <div className="text-lg font-bold text-red-600">{opsStats.inbound.overdue}</div>
            </div>
          </div>
        </div>

        {/* 출고 통계 */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">⬆️ 출고 작업</h3>
            <ArrowUpTrayIcon className="h-5 w-5 text-blue-600" />
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <div className="text-xs text-gray-500">계획</div>
              <div className="text-lg font-bold text-gray-700">{opsStats.outbound.planned}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">진행</div>
              <div className="text-lg font-bold text-blue-600">{opsStats.outbound.inProgress}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">완료</div>
              <div className="text-lg font-bold text-green-600">{opsStats.outbound.completed}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">지연</div>
              <div className="text-lg font-bold text-red-600">{opsStats.outbound.overdue}</div>
            </div>
          </div>
        </div>

        {/* 포장 통계 */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">📦 포장 작업</h3>
            <CubeIcon className="h-5 w-5 text-purple-600" />
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <div className="text-xs text-gray-500">계획</div>
              <div className="text-lg font-bold text-gray-700">{opsStats.packing.planned}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">진행</div>
              <div className="text-lg font-bold text-blue-600">{opsStats.packing.inProgress}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">완료</div>
              <div className="text-lg font-bold text-green-600">{opsStats.packing.completed}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">지연</div>
              <div className="text-lg font-bold text-red-600">{opsStats.packing.overdue}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="작업명, 제품명, 담당자로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">전체 작업</option>
            <option value="inbound">입고</option>
            <option value="outbound">출고</option>
            <option value="packing">포장</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">전체 상태</option>
            <option value="planned">계획</option>
            <option value="in-progress">진행중</option>
            <option value="completed">완료</option>
            <option value="overdue">지연</option>
            <option value="on-hold">보류</option>
          </select>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg transition ${
                viewMode === 'list'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              목록
            </button>
            <button
              onClick={() => setViewMode('schedule')}
              className={`px-4 py-2 rounded-lg transition ${
                viewMode === 'schedule'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              스케줄
            </button>
          </div>
        </div>
      </div>

      {/* 작업 지시 목록 */}
      {viewMode === 'list' ? (
        <div className="space-y-3">
          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
              <ClockIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>검색 결과가 없습니다</p>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-lg shadow p-5 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{order.title}</h3>
                      {getTypeBadge(order.type)}
                      {getStatusBadge(order.status)}
                    </div>
                    <p className="text-sm text-gray-600">{order.description}</p>
                    {/* 시간 정보 추가 */}
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <div className="flex items-center gap-1 text-gray-600">
                        <ClockIcon className="h-4 w-4" />
                        <span>마감: <strong className="text-gray-900">{formatDateTime(order.dueDate)}</strong></span>
                      </div>
                      {order.startedAt && (
                        <div className="text-blue-600">
                          시작: {formatDateTime(order.startedAt)}
                        </div>
                      )}
                      {order.completedAt && (
                        <div className="text-green-600">
                          완료: {formatDateTime(order.completedAt)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-xs text-gray-600">제품</div>
                    <div className="font-semibold text-gray-900">{order.productName}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-xs text-gray-600">수량</div>
                    <div className="font-semibold text-gray-900">{order.quantity}{order.unit}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-xs text-gray-600">위치</div>
                    <div className="font-semibold text-gray-900">{order.location}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-xs text-gray-600">담당자</div>
                    <div className="font-semibold text-gray-900">{order.assignee || '미배정'}</div>
                  </div>
                </div>

                {order.note && (
                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded text-sm text-yellow-800">
                    📌 {order.note}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        /* 스케줄 뷰 */
        <div className="space-y-6">
          {Object.entries(groupByDate()).map(([dateKey, orders]) => (
            <div key={dateKey} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="bg-gradient-to-r from-orange-100 to-yellow-100 px-6 py-4 border-b-2 border-orange-200">
                <h3 className="text-lg font-bold text-gray-900">📅 {dateKey}</h3>
                <p className="text-sm text-gray-600 mt-1">{orders.length}개 작업</p>
              </div>
              <div className="p-4 space-y-3">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="border-l-4 border-orange-400 bg-gray-50 p-4 rounded-r-lg hover:bg-gray-100 transition"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg font-bold text-orange-600">
                            {(!order.dueDate || isNaN(order.dueDate.getTime())) 
                              ? '-' 
                              : order.dueDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
                            }
                          </span>
                          {getTypeBadge(order.type)}
                          {getStatusBadge(order.status)}
                        </div>
                        <h4 className="font-semibold text-gray-900">{order.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">{order.productName} • {order.quantity}{order.unit}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-600">{order.assignee || '미배정'}</div>
                        <div className="text-xs text-gray-500 mt-1">{order.location}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

