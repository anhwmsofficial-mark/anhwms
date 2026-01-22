'use client';

import { useState } from 'react';
import {
  UserGroupIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  PlusIcon,
  XCircleIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  LanguageIcon,
} from '@heroicons/react/24/outline';

interface CSWorker {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'cs_manager' | 'cs_agent';
  department: string;
  status: 'active' | 'inactive' | 'onleave';
  stats: {
    totalConversations: number;
    todayConversations: number;
    avgResponseTime: number;
    customerSatisfaction: number;
    translationCount: number;
    efficiency: number;
  };
  languages: string[];
  workHours: {
    start: string;
    end: string;
  };
  joinDate: Date;
}

const SAMPLE_WORKERS: CSWorker[] = [
  {
    id: 'CS001',
    name: '김민지',
    email: 'minji@anh.com',
    role: 'cs_manager',
    department: 'CS팀',
    status: 'active',
    stats: {
      totalConversations: 1847,
      todayConversations: 32,
      avgResponseTime: 1.8,
      customerSatisfaction: 96.5,
      translationCount: 450,
      efficiency: 97.8,
    },
    languages: ['한국어', '중국어'],
    workHours: { start: '09:00', end: '18:00' },
    joinDate: new Date('2024-01-15'),
  },
  {
    id: 'CS002',
    name: '이수진',
    email: 'sujin@anh.com',
    role: 'cs_agent',
    department: 'CS팀',
    status: 'active',
    stats: {
      totalConversations: 1634,
      todayConversations: 28,
      avgResponseTime: 2.1,
      customerSatisfaction: 95.2,
      translationCount: 380,
      efficiency: 96.5,
    },
    languages: ['한국어', '중국어', '영어'],
    workHours: { start: '09:00', end: '18:00' },
    joinDate: new Date('2024-02-20'),
  },
  {
    id: 'CS003',
    name: '왕리',
    email: 'wangli@anh.com',
    role: 'cs_agent',
    department: 'CS팀',
    status: 'active',
    stats: {
      totalConversations: 1921,
      todayConversations: 35,
      avgResponseTime: 1.6,
      customerSatisfaction: 97.8,
      translationCount: 520,
      efficiency: 98.2,
    },
    languages: ['중국어', '한국어'],
    workHours: { start: '10:00', end: '19:00' },
    joinDate: new Date('2023-11-10'),
  },
  {
    id: 'CS004',
    name: '박서연',
    email: 'seoyeon@anh.com',
    role: 'cs_agent',
    department: 'CS팀',
    status: 'active',
    stats: {
      totalConversations: 1476,
      todayConversations: 24,
      avgResponseTime: 2.4,
      customerSatisfaction: 94.1,
      translationCount: 310,
      efficiency: 95.3,
    },
    languages: ['한국어', '일본어'],
    workHours: { start: '10:00', end: '19:00' },
    joinDate: new Date('2024-03-05'),
  },
  {
    id: 'CS005',
    name: '최유진',
    email: 'yujin@anh.com',
    role: 'cs_agent',
    department: 'CS팀',
    status: 'onleave',
    stats: {
      totalConversations: 1254,
      todayConversations: 0,
      avgResponseTime: 2.0,
      customerSatisfaction: 95.5,
      translationCount: 280,
      efficiency: 96.0,
    },
    languages: ['한국어', '중국어'],
    workHours: { start: '09:00', end: '18:00' },
    joinDate: new Date('2024-04-12'),
  },
];

export default function CSWorkersPage() {
  const [workers, setWorkers] = useState<CSWorker[]>(SAMPLE_WORKERS);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedWorker, setSelectedWorker] = useState<CSWorker | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // 필터링
  const filteredWorkers = workers.filter((worker) => {
    const matchSearch =
      searchTerm === '' ||
      worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      worker.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      worker.department.toLowerCase().includes(searchTerm.toLowerCase());

    const matchRole = selectedRole === 'all' || worker.role === selectedRole;

    return matchSearch && matchRole;
  });

  // 통계
  const stats = {
    total: workers.length,
    active: workers.filter((w) => w.status === 'active').length,
    inactive: workers.filter((w) => w.status === 'inactive').length,
    onleave: workers.filter((w) => w.status === 'onleave').length,
    avgSatisfaction:
      workers.reduce((sum, w) => sum + w.stats.customerSatisfaction, 0) / workers.length,
    avgResponseTime:
      workers.reduce((sum, w) => sum + w.stats.avgResponseTime, 0) / workers.length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">👥 CS 작업자 관리</h1>
              <p className="text-sm text-gray-600 mt-1">CS 담당자 현황 및 성과 관리</p>
            </div>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2">
              <PlusIcon className="h-5 w-5" />
              작업자 추가
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* 통계 카드 */}
        <div className="grid grid-cols-6 gap-4">
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
            <div className="text-sm text-gray-600">평균 만족도</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {stats.avgSatisfaction.toFixed(1)}%
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">평균 응답</div>
            <div className="text-2xl font-bold text-purple-600 mt-1">
              {stats.avgResponseTime.toFixed(1)}분
            </div>
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
              <option value="cs_manager">CS 매니저</option>
              <option value="cs_agent">CS 상담원</option>
            </select>
          </div>
        </div>

        {/* 작업자 목록 */}
        <div className="bg-white rounded-lg shadow">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    작업자
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    역할
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    언어
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    상태
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    오늘 대화
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    총 대화
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    평균 응답
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    만족도
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    번역 횟수
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    작업시간
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    액션
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredWorkers.map((worker) => (
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
                    <td className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap gap-1">
                        {worker.languages.map((lang) => (
                          <span
                            key={lang}
                            className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs"
                          >
                            {lang}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={worker.status} />
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-blue-600">
                      {worker.stats.todayConversations}건
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {worker.stats.totalConversations.toLocaleString()}건
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`font-semibold ${
                          worker.stats.avgResponseTime <= 2
                            ? 'text-green-600'
                            : worker.stats.avgResponseTime <= 3
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}
                      >
                        {worker.stats.avgResponseTime}분
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`font-semibold ${
                          worker.stats.customerSatisfaction >= 96
                            ? 'text-green-600'
                            : worker.stats.customerSatisfaction >= 93
                            ? 'text-blue-600'
                            : 'text-yellow-600'
                        }`}
                      >
                        {worker.stats.customerSatisfaction}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {worker.stats.translationCount}회
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
                <h2 className="text-xl font-bold">CS 작업자 상세 정보</h2>
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
                      <span className="ml-2">
                        {selectedWorker.joinDate.toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-600">언어:</span>
                      <span className="ml-2">{selectedWorker.languages.join(', ')}</span>
                    </div>
                  </div>
                </div>

                {/* 성과 지표 */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">성과 지표</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <ChatBubbleLeftRightIcon className="h-5 w-5 text-blue-600" />
                        <div className="text-sm text-gray-600">총 대화 건수</div>
                      </div>
                      <div className="text-2xl font-bold text-blue-600 mt-1">
                        {selectedWorker.stats.totalConversations.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <ChatBubbleLeftRightIcon className="h-5 w-5 text-green-600" />
                        <div className="text-sm text-gray-600">오늘 대화</div>
                      </div>
                      <div className="text-2xl font-bold text-green-600 mt-1">
                        {selectedWorker.stats.todayConversations}
                      </div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <ClockIcon className="h-5 w-5 text-purple-600" />
                        <div className="text-sm text-gray-600">평균 응답시간</div>
                      </div>
                      <div className="text-2xl font-bold text-purple-600 mt-1">
                        {selectedWorker.stats.avgResponseTime}분
                      </div>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <ChartBarIcon className="h-5 w-5 text-orange-600" />
                        <div className="text-sm text-gray-600">고객 만족도</div>
                      </div>
                      <div className="text-2xl font-bold text-orange-600 mt-1">
                        {selectedWorker.stats.customerSatisfaction}%
                      </div>
                    </div>
                    <div className="bg-indigo-50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <LanguageIcon className="h-5 w-5 text-indigo-600" />
                        <div className="text-sm text-gray-600">번역 횟수</div>
                      </div>
                      <div className="text-2xl font-bold text-indigo-600 mt-1">
                        {selectedWorker.stats.translationCount}
                      </div>
                    </div>
                    <div className="bg-pink-50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <ChartBarIcon className="h-5 w-5 text-pink-600" />
                        <div className="text-sm text-gray-600">효율성</div>
                      </div>
                      <div className="text-2xl font-bold text-pink-600 mt-1">
                        {selectedWorker.stats.efficiency}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* 종합 평가 */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">종합 평가</h3>
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg">
                    <div className="text-center">
                      <div className="text-4xl mb-2">
                        {selectedWorker.stats.efficiency >= 97
                          ? '🏆'
                          : selectedWorker.stats.efficiency >= 95
                          ? '✅'
                          : '⚠️'}
                      </div>
                      <p className="text-lg font-semibold text-gray-900">
                        {selectedWorker.stats.efficiency >= 97
                          ? '우수한 성과를 보이고 있습니다'
                          : selectedWorker.stats.efficiency >= 95
                          ? '양호한 수준입니다'
                          : '개선이 필요합니다'}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        고객 만족도 {selectedWorker.stats.customerSatisfaction}% | 평균 응답{' '}
                        {selectedWorker.stats.avgResponseTime}분
                      </p>
                    </div>
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
    </div>
  );
}

function RoleBadge({ role }: { role: CSWorker['role'] }) {
  const styles = {
    admin: 'bg-red-100 text-red-700',
    cs_manager: 'bg-purple-100 text-purple-700',
    cs_agent: 'bg-blue-100 text-blue-700',
  };

  const labels = {
    admin: '관리자',
    cs_manager: 'CS 매니저',
    cs_agent: 'CS 상담원',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[role]}`}>
      {labels[role]}
    </span>
  );
}

function StatusBadge({ status }: { status: CSWorker['status'] }) {
  const styles = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-700',
    onleave: 'bg-yellow-100 text-yellow-700',
  };

  const labels = {
    active: '✅ 근무중',
    inactive: '⚫ 비활성',
    onleave: '🏖️ 휴가',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

