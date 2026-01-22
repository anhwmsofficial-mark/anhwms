'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import { useLayout } from '@/components/LayoutWrapper';
import {
  PlusIcon,
  TruckIcon,
  MagnifyingGlassIcon,
  ChartBarIcon,
  ClockIcon,
  XMarkIcon,
  CheckCircleIcon,
  CubeIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
  PencilIcon
} from '@heroicons/react/24/outline';

interface Wave {
  id: string;
  waveNumber: string;
  waveName: string;
  waveType: 'standard' | '2B' | 'pallet';
  shippingMethod: 'air' | 'sea' | 'express';
  carrier: string;
  status: 'planned' | 'in_progress' | 'sorting' | 'completed' | 'cancelled';
  totalOrders: number;
  completedOrders: number;
  plannedShipDate: Date;
  cutoffTime: string;
  createdAt: Date;
}

const SAMPLE_WAVES: Wave[] = [
  {
    id: 'w1',
    waveNumber: 'W-2025-001',
    waveName: '2025년 1월 1차 항공',
    waveType: 'standard',
    shippingMethod: 'air',
    carrier: 'CJ대한통운',
    status: 'in_progress',
    totalOrders: 25,
    completedOrders: 18,
    plannedShipDate: new Date('2025-01-16'),
    cutoffTime: '18:00',
    createdAt: new Date()
  },
  {
    id: 'w2',
    waveNumber: 'W-2025-002',
    waveName: '2025년 1월 중국 특송',
    waveType: '2B',
    shippingMethod: 'express',
    carrier: '顺丰速运',
    status: 'planned',
    totalOrders: 40,
    completedOrders: 0,
    plannedShipDate: new Date('2025-01-17'),
    cutoffTime: '17:00',
    createdAt: new Date()
  },
  {
    id: 'w3',
    waveNumber: 'W-2025-003',
    waveName: '한진택배 일반 배송',
    waveType: 'standard',
    shippingMethod: 'sea',
    carrier: '한진택배',
    status: 'sorting',
    totalOrders: 35,
    completedOrders: 30,
    plannedShipDate: new Date('2025-01-15'),
    cutoffTime: '18:30',
    createdAt: new Date()
  },
  {
    id: 'w4',
    waveNumber: 'W-2025-004',
    waveName: 'EMS 국제특송',
    waveType: 'pallet',
    shippingMethod: 'express',
    carrier: 'EMS',
    status: 'completed',
    totalOrders: 60,
    completedOrders: 60,
    plannedShipDate: new Date('2025-01-14'),
    cutoffTime: '16:30',
    createdAt: new Date()
  }
];

export default function WaveManagementPage() {
  const { toggleSidebar } = useLayout();
  const [waves, setWaves] = useState<Wave[]>(SAMPLE_WAVES);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);

  const filteredWaves = waves.filter(wave => {
    const matchesSearch = 
      wave.waveNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wave.waveName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wave.carrier.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || wave.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const badges: Record<string, React.ReactElement> = {
      'planned': <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">계획</span>,
      'in_progress': <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">진행중</span>,
      'sorting': <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">정렬중</span>,
      'completed': <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">완료</span>,
      'cancelled': <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">취소</span>,
    };
    return badges[status] || null;
  };

  const getShippingMethodBadge = (method: string) => {
    const badges: Record<string, string> = {
      'air': '✈️ 항공',
      'sea': '🚢 해운',
      'express': '⚡ 특송',
    };
    return badges[method] || method;
  };

  const stats = {
    total: waves.length,
    planned: waves.filter(w => w.status === 'planned').length,
    inProgress: waves.filter(w => w.status === 'in_progress').length,
    completed: waves.filter(w => w.status === 'completed').length,
    totalOrders: waves.reduce((sum, w) => sum + w.totalOrders, 0),
    completedOrders: waves.reduce((sum, w) => sum + w.completedOrders, 0),
  };

  const handleUpdateStatus = (waveId: string, newStatus: Wave['status']) => {
    setWaves(waves.map(wave =>
      wave.id === waveId ? { ...wave, status: newStatus } : wave
    ));
  };

  return (
    <div className="flex flex-col h-screen">
      <Header title="📊 파도 관리" onMenuClick={toggleSidebar} />
      
      <main className="flex-1 overflow-y-auto bg-gray-50 p-4 lg:p-6">
        <div className="space-y-6">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">파도 관리 (Wave Management)</h1>
              <p className="text-sm text-gray-600 mt-1">
                출고 계획 및 배치(Wave) 생성, 물류사별 묶음 출고 관리
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <PlusIcon className="h-5 w-5" />
              새 Wave 생성
            </button>
          </div>

          {/* 통계 카드 */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">전체 Wave</div>
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">계획</div>
              <div className="text-2xl font-bold text-gray-500">{stats.planned}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">진행중</div>
              <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">완료</div>
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">총 주문</div>
              <div className="text-2xl font-bold text-purple-600">{stats.totalOrders}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">완료 주문</div>
              <div className="text-2xl font-bold text-green-600">{stats.completedOrders}</div>
            </div>
          </div>

          {/* 검색 및 필터 */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="flex-1 relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Wave 번호, 이름, 물류사 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="all">전체 상태</option>
                <option value="planned">계획</option>
                <option value="in_progress">진행중</option>
                <option value="sorting">정렬중</option>
                <option value="completed">완료</option>
                <option value="cancelled">취소</option>
              </select>
            </div>
          </div>

          {/* Wave 목록 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredWaves.map((wave) => {
              const completionRate = wave.totalOrders > 0 
                ? (wave.completedOrders / wave.totalOrders) * 100 
                : 0;
              
              return (
                <div key={wave.id} className="bg-white rounded-lg shadow hover:shadow-lg transition">
                  <div className="p-6">
                    {/* Wave 헤더 */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-bold text-gray-900">{wave.waveNumber}</h3>
                          {getStatusBadge(wave.status)}
                        </div>
                        <p className="text-sm text-gray-600">{wave.waveName}</p>
                      </div>
                      <button className="p-2 hover:bg-gray-100 rounded-lg">
                        <PencilIcon className="h-5 w-5 text-gray-400" />
                      </button>
                    </div>

                    {/* Wave 정보 */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-xs text-gray-600 mb-1">물류사</div>
                        <div className="font-semibold text-gray-900 flex items-center gap-1">
                          <TruckIcon className="h-4 w-4" />
                          {wave.carrier}
                        </div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-xs text-gray-600 mb-1">배송방법</div>
                        <div className="font-semibold text-gray-900">
                          {getShippingMethodBadge(wave.shippingMethod)}
                        </div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-xs text-gray-600 mb-1">출고 예정</div>
                        <div className="font-semibold text-gray-900 flex items-center gap-1">
                          <CalendarIcon className="h-4 w-4" />
                          {wave.plannedShipDate.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-xs text-gray-600 mb-1">마감 시간</div>
                        <div className="font-semibold text-gray-900 flex items-center gap-1">
                          <ClockIcon className="h-4 w-4" />
                          {wave.cutoffTime}
                        </div>
                      </div>
                    </div>

                    {/* 진행률 */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">진행률</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {wave.completedOrders} / {wave.totalOrders} ({completionRate.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            completionRate === 100 ? 'bg-green-500' :
                            completionRate >= 50 ? 'bg-blue-500' :
                            'bg-yellow-500'
                          }`}
                          style={{ width: `${completionRate}%` }}
                        />
                      </div>
                    </div>

                    {/* 액션 버튼 */}
                    <div className="flex gap-2">
                      {wave.status === 'planned' && (
                        <button
                          onClick={() => handleUpdateStatus(wave.id, 'in_progress')}
                          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
                        >
                          작업 시작
                        </button>
                      )}
                      {wave.status === 'in_progress' && (
                        <button
                          onClick={() => handleUpdateStatus(wave.id, 'sorting')}
                          className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm font-semibold"
                        >
                          정렬 시작
                        </button>
                      )}
                      {wave.status === 'sorting' && (
                        <button
                          onClick={() => handleUpdateStatus(wave.id, 'completed')}
                          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold"
                        >
                          완료 처리
                        </button>
                      )}
                      {wave.status !== 'completed' && wave.status !== 'cancelled' && (
                        <button
                          onClick={() => handleUpdateStatus(wave.id, 'cancelled')}
                          className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 text-sm font-semibold"
                        >
                          취소
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 사용 가이드 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold text-blue-900 mb-3">💡 Wave 관리 프로세스</h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li>• <strong>Wave 생성</strong>: 물류사, 배송방법, 출고일자를 지정하여 배치 생성</li>
              <li>• <strong>주문 할당</strong>: Wave에 해당하는 주문들을 자동 또는 수동으로 할당</li>
              <li>• <strong>피킹 최적화</strong>: Wave 단위로 동선을 최적화하여 피킹 효율 향상</li>
              <li>• <strong>정렬 작업</strong>: 물류사별, 목적지별로 상품 분류</li>
              <li>• <strong>출고 처리</strong>: Wave 단위로 일괄 출고하여 물류사에 인계</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
