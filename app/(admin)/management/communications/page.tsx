'use client';

import { useState } from 'react';
import {
  ChatBubbleLeftRightIcon,
  PhotoIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  UserIcon,
} from '@heroicons/react/24/outline';

interface Communication {
  id: string;
  type: 'memo' | 'issue' | 'photo';
  worker: string;
  task: string;
  content: string;
  status: 'open' | 'resolved';
  createdAt: Date;
  photoUrl?: string;
}

const SAMPLE_COMMUNICATIONS: Communication[] = [
  {
    id: 'COM001',
    type: 'memo',
    worker: '김철수',
    task: '입고-ASN-2025-001',
    content: '노트북 박스에 경미한 파손 있음. 제품은 이상 없음.',
    status: 'resolved',
    createdAt: new Date('2025-01-12T10:30:00'),
  },
  {
    id: 'COM002',
    type: 'issue',
    worker: '이영희',
    task: '출고-ORD-2025-002',
    content: '마우스 재고 수량 불일치. 시스템: 120개, 실제: 118개',
    status: 'open',
    createdAt: new Date('2025-01-12T14:15:00'),
  },
  {
    id: 'COM003',
    type: 'photo',
    worker: '박민수',
    task: '포장-PACK-001',
    content: '파손된 포장재 발견',
    status: 'open',
    createdAt: new Date('2025-01-12T16:45:00'),
    photoUrl: '/sample-photo.jpg',
  },
  {
    id: 'COM004',
    type: 'memo',
    worker: '최수진',
    task: '입고-ASN-2025-003',
    content: '키보드 입고 완료. 로케이션 A-2-06으로 이동 완료.',
    status: 'resolved',
    createdAt: new Date('2025-01-13T09:20:00'),
  },
  {
    id: 'COM005',
    type: 'issue',
    worker: '정민호',
    task: '스캔-QR-001',
    content: 'QR 코드 인식 불량. 재발급 필요',
    status: 'open',
    createdAt: new Date('2025-01-13T11:30:00'),
  },
];

export default function CommunicationsPage() {
  const [communications] = useState<Communication[]>(SAMPLE_COMMUNICATIONS);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // 필터링
  const filteredCommunications = communications.filter((comm) => {
    const matchType = filterType === 'all' || comm.type === filterType;
    const matchStatus = filterStatus === 'all' || comm.status === filterStatus;
    return matchType && matchStatus;
  });

  // 통계
  const stats = {
    total: communications.length,
    memo: communications.filter((c) => c.type === 'memo').length,
    issue: communications.filter((c) => c.type === 'issue').length,
    photo: communications.filter((c) => c.type === 'photo').length,
    open: communications.filter((c) => c.status === 'open').length,
    resolved: communications.filter((c) => c.status === 'resolved').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">💬 현장 커뮤니케이션</h1>
              <p className="text-sm text-gray-600 mt-1">작업 메모, 이슈, 사진 모니터링</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* 통계 카드 */}
        <div className="grid grid-cols-6 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">전체</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</div>
          </div>
          <div className="bg-blue-50 rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">메모</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{stats.memo}</div>
          </div>
          <div className="bg-red-50 rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">이슈</div>
            <div className="text-2xl font-bold text-red-600 mt-1">{stats.issue}</div>
          </div>
          <div className="bg-purple-50 rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">사진</div>
            <div className="text-2xl font-bold text-purple-600 mt-1">{stats.photo}</div>
          </div>
          <div className="bg-yellow-50 rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">미해결</div>
            <div className="text-2xl font-bold text-yellow-600 mt-1">{stats.open}</div>
          </div>
          <div className="bg-green-50 rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">해결</div>
            <div className="text-2xl font-bold text-green-600 mt-1">{stats.resolved}</div>
          </div>
        </div>

        {/* 필터 */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex gap-4">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">전체 유형</option>
              <option value="memo">메모</option>
              <option value="issue">이슈</option>
              <option value="photo">사진</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">전체 상태</option>
              <option value="open">미해결</option>
              <option value="resolved">해결</option>
            </select>
          </div>
        </div>

        {/* 커뮤니케이션 목록 */}
        <div className="space-y-4">
          {filteredCommunications.map((comm) => (
            <div key={comm.id} className="bg-white rounded-lg shadow p-4 hover:shadow-md transition">
              <div className="flex items-start gap-4">
                {/* 아이콘 */}
                <div
                  className={`p-3 rounded-lg ${
                    comm.type === 'memo'
                      ? 'bg-blue-50 text-blue-600'
                      : comm.type === 'issue'
                      ? 'bg-red-50 text-red-600'
                      : 'bg-purple-50 text-purple-600'
                  }`}
                >
                  {comm.type === 'memo' ? (
                    <ChatBubbleLeftRightIcon className="h-6 w-6" />
                  ) : comm.type === 'issue' ? (
                    <ExclamationTriangleIcon className="h-6 w-6" />
                  ) : (
                    <PhotoIcon className="h-6 w-6" />
                  )}
                </div>

                {/* 내용 */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <TypeBadge type={comm.type} />
                    <StatusBadge status={comm.status} />
                    <span className="text-xs text-gray-500">
                      {comm.createdAt.toLocaleString('ko-KR')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-2 text-sm text-gray-600">
                    <UserIcon className="h-4 w-4" />
                    <span className="font-semibold">{comm.worker}</span>
                    <span>•</span>
                    <span>{comm.task}</span>
                  </div>
                  <p className="text-gray-900">{comm.content}</p>
                  {comm.photoUrl && (
                    <div className="mt-2">
                      <div className="w-32 h-32 bg-gray-200 rounded-lg flex items-center justify-center">
                        <PhotoIcon className="h-8 w-8 text-gray-400" />
                      </div>
                    </div>
                  )}
                </div>

                {/* 액션 */}
                {comm.status === 'open' && (
                  <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm">
                    해결 완료
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 미해결 알림 */}
        {stats.open > 0 && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
            <div className="flex">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <strong>주의:</strong> 미해결 이슈 {stats.open}건이 있습니다. 확인이 필요합니다.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    memo: 'bg-blue-100 text-blue-700',
    issue: 'bg-red-100 text-red-700',
    photo: 'bg-purple-100 text-purple-700',
  };

  const labels: Record<string, string> = {
    memo: '📝 메모',
    issue: '⚠️ 이슈',
    photo: '📷 사진',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[type]}`}>
      {labels[type]}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: 'bg-yellow-100 text-yellow-700',
    resolved: 'bg-green-100 text-green-700',
  };

  const labels: Record<string, string> = {
    open: '⏳ 미해결',
    resolved: '✅ 해결',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

