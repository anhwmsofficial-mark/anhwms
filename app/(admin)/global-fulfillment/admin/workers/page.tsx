'use client';

import { useState } from 'react';
import {
  MagnifyingGlassIcon,
  PencilIcon,
  PlusIcon,
  XCircleIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

interface Worker {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'operator';
  department: string;
  status: 'active' | 'inactive' | 'onleave';
  stats: {
    totalProcessed: number;
    todayProcessed: number;
    avgProcessingTime: number;
    errorRate: number;
    efficiency: number;
  };
  workHours: {
    start: string;
    end: string;
  };
  joinDate: Date;
}

const SAMPLE_WORKERS: Worker[] = [
  {
    id: 'W001',
    name: '김철수',
    email: 'kim@anh.com',
    role: 'manager',
    department: '드롭시핑',
    status: 'active',
    stats: {
      totalProcessed: 2847,
      todayProcessed: 45,
      avgProcessingTime: 3.2,
      errorRate: 1.1,
      efficiency: 98.9
    },
    workHours: { start: '09:00', end: '18:00' },
    joinDate: new Date('2024-01-15')
  },
  {
    id: 'W002',
    name: '이영희',
    email: 'lee@anh.com',
    role: 'operator',
    department: '2차 정렬',
    status: 'active',
    stats: {
      totalProcessed: 2634,
      todayProcessed: 38,
      avgProcessingTime: 3.5,
      errorRate: 1.9,
      efficiency: 98.1
    },
    workHours: { start: '09:00', end: '18:00' },
    joinDate: new Date('2024-02-20')
  },
  {
    id: 'W003',
    name: '박민수',
    email: 'park@anh.com',
    role: 'operator',
    department: '패키지 검증',
    status: 'active',
    stats: {
      totalProcessed: 2921,
      todayProcessed: 52,
      avgProcessingTime: 2.8,
      errorRate: 0.8,
      efficiency: 99.2
    },
    workHours: { start: '09:00', end: '18:00' },
    joinDate: new Date('2023-11-10')
  },
  {
    id: 'W004',
    name: '왕웨이',
    email: 'wang@anh.com',
    role: 'operator',
    department: '무게 측정',
    status: 'active',
    stats: {
      totalProcessed: 2476,
      todayProcessed: 41,
      avgProcessingTime: 3.0,
      errorRate: 1.8,
      efficiency: 98.2
    },
    workHours: { start: '10:00', end: '19:00' },
    joinDate: new Date('2024-03-05')
  },
  {
    id: 'W005',
    name: '최지혜',
    email: 'choi@anh.com',
    role: 'operator',
    department: '교환/반품',
    status: 'onleave',
    stats: {
      totalProcessed: 1854,
      todayProcessed: 0,
      avgProcessingTime: 4.5,
      errorRate: 0.5,
      efficiency: 99.5
    },
    workHours: { start: '09:00', end: '18:00' },
    joinDate: new Date('2024-04-12')
  }
];

export default function WorkersPage() {
  const [workers] = useState<Worker[]>(SAMPLE_WORKERS);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // 필터링
  const filteredWorkers = workers.filter(worker => {
    const matchSearch = searchTerm === '' ||
      worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      worker.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      worker.department.toLowerCase().includes(searchTerm.toLowerCase());

    const matchRole = selectedRole === 'all' || worker.role === selectedRole;

    return matchSearch && matchRole;
  });

  // 통계
  const stats = {
    total: workers.length,
    active: workers.filter(w => w.status === 'active').length,
    inactive: workers.filter(w => w.status === 'inactive').length,
    onleave: workers.filter(w => w.status === 'onleave').length,
    avgEfficiency: workers.reduce((sum, w) => sum + w.stats.efficiency, 0) / workers.length
  };

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">작업자 관리</h1>
          <p className="text-sm text-gray-600 mt-1">
            해외배송 작업자 현황 및 성과 관리
          </p>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2">
          <PlusIcon className="h-5 w-5" />
          작업자 추가
        </button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">전체 작업자</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</div>
        </div>
        <div className="bg-green-50 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">근무중</div>
          <div className="text-2xl font-bold text-green-600 mt-1">{stats.active}</div>
        </div>
        <div className="bg-yellow-50 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">휴가</div>
          <div className="text-2xl font-bold text-yellow-600 mt-1">{stats.onleave}</div>
        </div>
        <div className="bg-gray-50 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">비활성</div>
          <div className="text-2xl font-bold text-gray-600 mt-1">{stats.inactive}</div>
        </div>
        <div className="bg-blue-50 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">평균 효율성</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">{stats.avgEfficiency.toFixed(1)}%</div>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="이름, 이메일, 부서 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">전체 역할</option>
            <option value="admin">관리자</option>
            <option value="manager">매니저</option>
            <option value="operator">작업자</option>
          </select>
        </div>
      </div>

      {/* 작업자 목록 */}
      <div className="bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">작업자</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">역할</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">부서</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">오늘 처리</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">총 처리</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">오류율</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">효율성</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">작업시간</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredWorkers.map(worker => (
                <tr key={worker.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-semibold text-gray-900">{worker.name}</div>
                      <div className="text-xs text-gray-500">{worker.email}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={worker.role} />
                  </td>
                  <td className="px-4 py-3 text-sm">{worker.department}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={worker.status} />
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-blue-600">
                    {worker.stats.todayProcessed}건
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {worker.stats.totalProcessed.toLocaleString()}건
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`font-semibold ${
                      worker.stats.errorRate <= 1 ? 'text-green-600' :
                      worker.stats.errorRate <= 2 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {worker.stats.errorRate}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`font-semibold ${
                      worker.stats.efficiency >= 99 ? 'text-green-600' :
                      worker.stats.efficiency >= 98 ? 'text-blue-600' :
                      'text-yellow-600'
                    }`}>
                      {worker.stats.efficiency}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {worker.workHours.start} - {worker.workHours.end}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => {
                        setSelectedWorker(worker);
                        setShowDetailModal(true);
                      }}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <ChartBarIcon className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 상세 모달 */}
      {showDetailModal && selectedWorker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold">작업자 상세 정보</h2>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedWorker(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* 기본 정보 */}
              <div>
                <h3 className="text-lg font-semibold mb-3">기본 정보</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">이름:</span>
                    <span className="ml-2 font-semibold">{selectedWorker.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">이메일:</span>
                    <span className="ml-2">{selectedWorker.email}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">부서:</span>
                    <span className="ml-2">{selectedWorker.department}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">입사일:</span>
                    <span className="ml-2">{selectedWorker.joinDate.toLocaleDateString('ko-KR')}</span>
                  </div>
                </div>
              </div>

              {/* 성과 지표 */}
              <div>
                <h3 className="text-lg font-semibold mb-3">성과 지표</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">총 처리 건수</div>
                    <div className="text-2xl font-bold text-blue-600 mt-1">
                      {selectedWorker.stats.totalProcessed.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">오늘 처리 건수</div>
                    <div className="text-2xl font-bold text-green-600 mt-1">
                      {selectedWorker.stats.todayProcessed}
                    </div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">평균 처리 시간</div>
                    <div className="text-2xl font-bold text-purple-600 mt-1">
                      {selectedWorker.stats.avgProcessingTime}분
                    </div>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">오류율</div>
                    <div className="text-2xl font-bold text-yellow-600 mt-1">
                      {selectedWorker.stats.errorRate}%
                    </div>
                  </div>
                </div>
              </div>

              {/* 효율성 */}
              <div>
                <h3 className="text-lg font-semibold mb-3">효율성 평가</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">종합 효율성</span>
                    <span className="text-2xl font-bold text-blue-600">
                      {selectedWorker.stats.efficiency}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-blue-600 h-3 rounded-full"
                      style={{ width: `${selectedWorker.stats.efficiency}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    {selectedWorker.stats.efficiency >= 99 ? '🏆 우수한 성과를 보이고 있습니다' :
                     selectedWorker.stats.efficiency >= 98 ? '✅ 양호한 수준입니다' :
                     '⚠️ 개선이 필요합니다'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                닫기
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                <PencilIcon className="h-4 w-4" />
                정보 수정
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RoleBadge({ role }: { role: Worker['role'] }) {
  const styles = {
    admin: 'bg-red-100 text-red-700',
    manager: 'bg-purple-100 text-purple-700',
    operator: 'bg-blue-100 text-blue-700'
  };

  const labels = {
    admin: '관리자',
    manager: '매니저',
    operator: '작업자'
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[role]}`}>
      {labels[role]}
    </span>
  );
}

function StatusBadge({ status }: { status: Worker['status'] }) {
  const styles = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-700',
    onleave: 'bg-yellow-100 text-yellow-700'
  };

  const labels = {
    active: '✅ 근무중',
    inactive: '⚫ 비활성',
    onleave: '🏖️ 휴가'
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

