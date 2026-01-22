'use client';

import { useState } from 'react';
import {
  CubeIcon,
  MagnifyingGlassIcon,
  ScaleIcon,
  CheckCircleIcon,
  ClockIcon,
  PhotoIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';

interface PackingTask {
  id: string;
  orderNo: string;
  product: string;
  quantity: number;
  unit: string;
  status: 'pending' | 'in-progress' | 'completed';
  assignee?: string;
  weight?: number;
  dimensions?: string;
  startedAt?: Date;
  completedAt?: Date;
}

const SAMPLE_PACKING: PackingTask[] = [
  {
    id: 'PACK001',
    orderNo: 'ORD-2025-001',
    product: '노트북 A',
    quantity: 10,
    unit: '개',
    status: 'completed',
    assignee: '송하늘',
    weight: 15.5,
    dimensions: '60x40x30cm',
    startedAt: new Date('2025-01-12T09:00:00'),
    completedAt: new Date('2025-01-12T10:30:00'),
  },
  {
    id: 'PACK002',
    orderNo: 'ORD-2025-002',
    product: '무선 마우스',
    quantity: 25,
    unit: '개',
    status: 'in-progress',
    assignee: '윤서연',
    startedAt: new Date('2025-01-12T14:00:00'),
  },
  {
    id: 'PACK003',
    orderNo: 'ORD-2025-003',
    product: 'USB 케이블',
    quantity: 50,
    unit: '개',
    status: 'pending',
  },
  {
    id: 'PACK004',
    orderNo: 'ORD-2025-004',
    product: '모니터 27인치',
    quantity: 5,
    unit: '개',
    status: 'pending',
  },
];

export default function PackingTab() {
  const [tasks, setTasks] = useState<PackingTask[]>(SAMPLE_PACKING);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // 필터링
  const filteredTasks = tasks.filter((task) => {
    const matchSearch =
      searchTerm === '' ||
      task.orderNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.product.toLowerCase().includes(searchTerm.toLowerCase());

    const matchStatus = filterStatus === 'all' || task.status === filterStatus;

    return matchSearch && matchStatus;
  });

  // 통계
  const stats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    inProgress: tasks.filter((t) => t.status === 'in-progress').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
  };

  return (
    <div className="space-y-6">
      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">전체 작업</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</div>
        </div>
        <div className="bg-yellow-50 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">대기</div>
          <div className="text-2xl font-bold text-yellow-600 mt-1">{stats.pending}</div>
        </div>
        <div className="bg-blue-50 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">진행 중</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">{stats.inProgress}</div>
        </div>
        <div className="bg-green-50 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">완료</div>
          <div className="text-2xl font-bold text-green-600 mt-1">{stats.completed}</div>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="주문번호, 품목명 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">전체 상태</option>
            <option value="pending">대기</option>
            <option value="in-progress">진행 중</option>
            <option value="completed">완료</option>
          </select>
        </div>
      </div>

      {/* 포장 작업 목록 */}
      <div className="space-y-4">
        {filteredTasks.map((task) => (
          <div
            key={task.id}
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">{task.orderNo}</h3>
                  <StatusBadge status={task.status} />
                </div>
                <p className="text-gray-600">{task.product}</p>
                <p className="text-sm text-gray-500">
                  수량: <strong>{task.quantity}{task.unit}</strong>
                </p>
              </div>
              {task.status === 'pending' && (
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                  작업 시작
                </button>
              )}
              {task.status === 'in-progress' && (
                <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
                  완료 처리
                </button>
              )}
            </div>

            {/* 작업 정보 */}
            {(task.status === 'in-progress' || task.status === 'completed') && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {task.assignee && (
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-xs text-gray-600">작업자</div>
                    <div className="font-semibold text-gray-900">{task.assignee}</div>
                  </div>
                )}
                {task.weight && (
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-xs text-gray-600 flex items-center gap-1">
                      <ScaleIcon className="h-3 w-3" />
                      무게
                    </div>
                    <div className="font-semibold text-gray-900">{task.weight}kg</div>
                  </div>
                )}
                {task.dimensions && (
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-xs text-gray-600">치수</div>
                    <div className="font-semibold text-gray-900">{task.dimensions}</div>
                  </div>
                )}
                {task.completedAt && (
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-xs text-gray-600 flex items-center gap-1">
                      <ClockIcon className="h-3 w-3" />
                      완료 시간
                    </div>
                    <div className="font-semibold text-gray-900">
                      {task.completedAt.toLocaleTimeString('ko-KR')}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 액션 버튼 */}
            {task.status === 'in-progress' && (
              <div className="flex gap-2">
                <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition text-sm">
                  <PhotoIcon className="h-4 w-4" />
                  사진 첨부
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition text-sm">
                  <ChatBubbleLeftRightIcon className="h-4 w-4" />
                  메모 작성
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    'in-progress': 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
  };

  const labels: Record<string, string> = {
    pending: '⏳ 대기',
    'in-progress': '🔄 진행 중',
    completed: '✅ 완료',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

