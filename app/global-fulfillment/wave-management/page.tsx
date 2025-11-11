'use client';

import { useState, useEffect } from 'react';
import {
  PlusIcon,
  TruckIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ChartBarIcon,
  ClockIcon,
  XMarkIcon,
  CheckCircleIcon,
  CubeIcon,
  CalendarIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { GlobalWave } from '@/types';

interface Order {
  id: string;
  orderId: string;
  sku: string;
  productName: string;
  quantity: number;
  destinationCountry: string;
  carrier?: string;
  waveId?: string;
}

interface WaveStatistics {
  totalWaves: number;
  activeWaves: number;
  completedToday: number;
  totalOrders: number;
  readyToShip: number;
  avgCompletionRate: number;
}

// 샘플 데이터
const SAMPLE_WAVES: GlobalWave[] = [
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
    plannedShipDate: new Date('2025-11-05'),
    cutoffTime: '18:00',
    createdAt: new Date(),
    updatedAt: new Date()
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
    plannedShipDate: new Date('2025-11-06'),
    cutoffTime: '17:00',
    createdAt: new Date(),
    updatedAt: new Date()
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
    plannedShipDate: new Date('2025-11-05'),
    cutoffTime: '18:30',
    createdAt: new Date(),
    updatedAt: new Date()
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
    plannedShipDate: new Date('2025-11-04'),
    cutoffTime: '16:30',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

const SAMPLE_ORDERS: Order[] = [
  { id: '1', orderId: 'TB-001', sku: 'SKU-001', productName: '무선 이어폰', quantity: 5, destinationCountry: 'KR' },
  { id: '2', orderId: 'TB-002', sku: 'SKU-002', productName: '스마트워치', quantity: 3, destinationCountry: 'CN' },
  { id: '3', orderId: 'TB-003', sku: 'SKU-001', productName: '무선 이어폰', quantity: 2, destinationCountry: 'KR' },
  { id: '4', orderId: 'TB-004', sku: 'SKU-003', productName: '블루투스 스피커', quantity: 4, destinationCountry: 'JP' },
  { id: '5', orderId: 'TB-005', sku: 'SKU-002', productName: '스마트워치', quantity: 1, destinationCountry: 'CN' }
];

export default function WaveManagementPage() {
  const [waves, setWaves] = useState<GlobalWave[]>(SAMPLE_WAVES);
  const [unassignedOrders, setUnassignedOrders] = useState<Order[]>(SAMPLE_ORDERS);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedWave, setSelectedWave] = useState<GlobalWave | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // 통계 계산
  const statistics: WaveStatistics = {
    totalWaves: waves.length,
    activeWaves: waves.filter(w => w.status === 'in_progress' || w.status === 'sorting').length,
    completedToday: waves.filter(w => w.status === 'completed' && 
      w.updatedAt?.toDateString() === new Date().toDateString()).length,
    totalOrders: waves.reduce((sum, w) => sum + w.totalOrders, 0),
    readyToShip: waves.filter(w => w.status === 'completed').reduce((sum, w) => sum + w.totalOrders, 0),
    avgCompletionRate: waves.length > 0 
      ? waves.reduce((sum, w) => sum + (w.completedOrders / w.totalOrders) * 100, 0) / waves.length 
      : 0
  };

  // 필터링된 Wave 목록
  const filteredWaves = waves.filter(wave => {
    const matchStatus = filterStatus === 'all' || wave.status === filterStatus;
    const matchSearch = searchTerm === '' ||
      wave.waveNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (wave.waveName && wave.waveName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (wave.carrier && wave.carrier.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchStatus && matchSearch;
  });

  // Wave 생성
  const handleCreateWave = (waveData: any) => {
    const newWave: GlobalWave = {
      id: `w${Date.now()}`,
      waveNumber: `W-${new Date().getFullYear()}-${String(waves.length + 1).padStart(3, '0')}`,
      waveName: waveData.name,
      waveType: waveData.type,
      shippingMethod: waveData.shippingMethod,
      carrier: waveData.carrier,
      status: 'planned',
      totalOrders: 0,
      completedOrders: 0,
      plannedShipDate: new Date(waveData.shipDate),
      cutoffTime: waveData.cutoffTime,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    setWaves([...waves, newWave]);
    setShowCreateModal(false);
  };

  // 주문을 Wave에 할당
  const assignOrderToWave = (orderId: string, waveId: string) => {
    setUnassignedOrders(prev => prev.map(o => 
      o.id === orderId ? { ...o, waveId } : o
    ));
    setWaves(prev => prev.map(w => 
      w.id === waveId ? { ...w, totalOrders: w.totalOrders + 1 } : w
    ));
  };

  // SKU별 자동 분류
  const autoAssignBySKU = () => {
    // 간단한 예시: SKU-001은 첫 번째 Wave에, SKU-002는 두 번째 Wave에 할당
    const skuWaveMap: { [key: string]: string } = {
      'SKU-001': waves[0]?.id || '',
      'SKU-002': waves[1]?.id || '',
      'SKU-003': waves[0]?.id || ''
    };

    unassignedOrders.forEach(order => {
      if (!order.waveId && skuWaveMap[order.sku]) {
        assignOrderToWave(order.id, skuWaveMap[order.sku]);
      }
    });
    
    alert('✅ SKU 기반 자동 분류가 완료되었습니다!');
  };

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">출고 계획 (Wave Management)</h1>
          <p className="text-sm text-gray-600 mt-1">
            출고 일정 및 분류 계획을 자동화하고 운송채널별로 묶음 처리합니다
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={autoAssignBySKU}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
          >
            <ChartBarIcon className="h-5 w-5" />
            SKU 자동분류
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
          >
            <PlusIcon className="h-5 w-5" />
            새 Wave 생성
          </button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-6 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">전체 Wave</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{statistics.totalWaves}</div>
            </div>
            <CubeIcon className="h-10 w-10 text-gray-400" />
          </div>
        </div>

        <div className="bg-yellow-50 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">진행중</div>
              <div className="text-2xl font-bold text-yellow-600 mt-1">{statistics.activeWaves}</div>
            </div>
            <ClockIcon className="h-10 w-10 text-yellow-400" />
          </div>
        </div>

        <div className="bg-green-50 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">오늘 완료</div>
              <div className="text-2xl font-bold text-green-600 mt-1">{statistics.completedToday}</div>
            </div>
            <CheckCircleIcon className="h-10 w-10 text-green-400" />
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">총 주문</div>
              <div className="text-2xl font-bold text-blue-600 mt-1">{statistics.totalOrders}</div>
            </div>
            <TruckIcon className="h-10 w-10 text-blue-400" />
          </div>
        </div>

        <div className="bg-purple-50 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">출고 대기</div>
              <div className="text-2xl font-bold text-purple-600 mt-1">{statistics.readyToShip}</div>
            </div>
            <CubeIcon className="h-10 w-10 text-purple-400" />
          </div>
        </div>

        <div className="bg-indigo-50 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">평균 달성률</div>
              <div className="text-2xl font-bold text-indigo-600 mt-1">
                {statistics.avgCompletionRate.toFixed(0)}%
              </div>
            </div>
            <ChartBarIcon className="h-10 w-10 text-indigo-400" />
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
              placeholder="Wave 번호, 이름, 운송사 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">전체 상태</option>
            <option value="planned">계획됨</option>
            <option value="in_progress">진행중</option>
            <option value="sorting">분류중</option>
            <option value="completed">완료</option>
            <option value="shipped">출고됨</option>
          </select>
        </div>
      </div>

      {/* 미할당 주문 알림 */}
      {unassignedOrders.filter(o => !o.waveId).length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ExclamationTriangleIcon className="h-6 w-6 text-orange-600" />
            <div>
              <div className="font-semibold text-orange-900">
                미할당 주문: {unassignedOrders.filter(o => !o.waveId).length}건
              </div>
              <div className="text-sm text-orange-700">
                Wave에 할당되지 않은 주문이 있습니다
              </div>
            </div>
          </div>
          <button
            onClick={autoAssignBySKU}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition text-sm"
          >
            자동 할당
          </button>
        </div>
      )}

      {/* Wave 카드 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredWaves.map((wave) => (
          <WaveCard 
            key={wave.id} 
            wave={wave} 
            onViewDetail={() => {
              setSelectedWave(wave);
              setShowDetailModal(true);
            }}
          />
        ))}
      </div>

      {/* Wave 생성 모달 */}
      {showCreateModal && (
        <CreateWaveModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateWave}
        />
      )}

      {/* Wave 상세 모달 */}
      {showDetailModal && selectedWave && (
        <WaveDetailModal
          wave={selectedWave}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedWave(null);
          }}
        />
      )}

      {/* 가이드 */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
        <h3 className="font-semibold text-purple-900 mb-3">💡 Wave 관리 가이드</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="font-semibold text-purple-800 mb-2">Wave 타입</h4>
            <ul className="space-y-1 text-sm text-purple-700">
              <li>• <strong>Standard</strong>: 일반 출고 (혼합 배송)</li>
              <li>• <strong>2B</strong>: 2개 박스 단위 묶음</li>
              <li>• <strong>2S</strong>: 2개 세트 단위 묶음</li>
              <li>• <strong>Pallet</strong>: 팔레트 단위 대량 출고</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-purple-800 mb-2">주요 기능</h4>
            <ul className="space-y-1 text-sm text-purple-700">
              <li>• <strong>SKU 자동분류</strong>: SKU별 자동 Wave 할당</li>
              <li>• <strong>운송채널별 묶음</strong>: 물류사별 자동 그룹핑</li>
              <li>• <strong>마감시간 관리</strong>: Wave별 출고 마감 시간 설정</li>
              <li>• <strong>실시간 모니터링</strong>: 진행 상황 실시간 추적</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function WaveCard({ wave, onViewDetail }: { wave: GlobalWave; onViewDetail: () => void }) {
  const progress = wave.totalOrders > 0 ? (wave.completedOrders / wave.totalOrders) * 100 : 0;
  const shipDate = wave.plannedShipDate ? new Date(wave.plannedShipDate) : new Date();
  const today = new Date();
  const daysUntilShip = Math.ceil((shipDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-500 hover:shadow-xl transition">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{wave.waveNumber}</h3>
          <p className="text-sm text-gray-600">{wave.waveName}</p>
        </div>
        <WaveStatusBadge status={wave.status} />
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">운송 방식</span>
          <span className="font-medium">{getShippingMethodLabel(wave.shippingMethod || '')}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">운송사</span>
          <span className="font-medium">{wave.carrier}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Wave 타입</span>
          <WaveTypeBadge type={wave.waveType} />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">출고 예정일</span>
          <div className="text-right">
            <div className="font-medium">
              {shipDate.toLocaleDateString('ko-KR')} {wave.cutoffTime}
            </div>
            {daysUntilShip >= 0 && (
              <div className={`text-xs ${daysUntilShip <= 1 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                {daysUntilShip === 0 ? '오늘 출고' : `D-${daysUntilShip}`}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 진행률 */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-600">진행률</span>
          <span className="font-semibold">
            {wave.completedOrders} / {wave.totalOrders} ({progress.toFixed(0)}%)
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              progress === 100 ? 'bg-green-600' : 
              progress >= 50 ? 'bg-blue-600' : 'bg-yellow-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-2">
        <button 
          onClick={onViewDetail}
          className="flex-1 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition text-sm font-medium"
        >
          상세보기
        </button>
        <button className="flex-1 px-4 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition text-sm font-medium">
          주문 추가
        </button>
      </div>
    </div>
  );
}

function WaveStatusBadge({ status }: { status: string }) {
  const classes: any = {
    planned: 'bg-gray-100 text-gray-700',
    in_progress: 'bg-yellow-100 text-yellow-700',
    sorting: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    shipped: 'bg-purple-100 text-purple-700'
  };

  const labels: any = {
    planned: '⚪ 계획됨',
    in_progress: '🟡 진행중',
    sorting: '🔵 분류중',
    completed: '🟢 완료',
    shipped: '🟣 출고됨'
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${classes[status]}`}>
      {labels[status] || status}
    </span>
  );
}

function WaveTypeBadge({ type }: { type: string }) {
  const classes: any = {
    standard: 'bg-blue-100 text-blue-700',
    '2B': 'bg-purple-100 text-purple-700',
    '2S': 'bg-indigo-100 text-indigo-700',
    pallet: 'bg-orange-100 text-orange-700'
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${classes[type] || 'bg-gray-100 text-gray-700'}`}>
      {type}
    </span>
  );
}

function getShippingMethodLabel(method: string): string {
  const labels: any = {
    air: '✈️ 항공',
    sea: '🚢 해운',
    express: '⚡ 특송'
  };
  return labels[method] || method;
}

function CreateWaveModal({ onClose, onCreate }: { onClose: () => void; onCreate: (data: any) => void }) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'standard',
    shippingMethod: 'air',
    carrier: '',
    shipDate: new Date().toISOString().split('T')[0],
    cutoffTime: '18:00'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">새 Wave 생성</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Wave 이름
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="예: 2025년 1월 1차 항공"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Wave 타입
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="standard">Standard (일반)</option>
              <option value="2B">2B (2박스)</option>
              <option value="2S">2S (2세트)</option>
              <option value="pallet">Pallet (팔레트)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              운송 방식
            </label>
            <select
              value={formData.shippingMethod}
              onChange={(e) => setFormData({ ...formData, shippingMethod: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="air">항공</option>
              <option value="sea">해운</option>
              <option value="express">특송</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              운송사
            </label>
            <input
              type="text"
              required
              value={formData.carrier}
              onChange={(e) => setFormData({ ...formData, carrier: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="예: CJ대한통운"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                출고 예정일
              </label>
              <input
                type="date"
                required
                value={formData.shipDate}
                onChange={(e) => setFormData({ ...formData, shipDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                마감 시간
              </label>
              <input
                type="time"
                required
                value={formData.cutoffTime}
                onChange={(e) => setFormData({ ...formData, cutoffTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              생성
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function WaveDetailModal({ wave, onClose }: { wave: GlobalWave; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">{wave.waveNumber}</h2>
            <p className="text-sm text-gray-600">{wave.waveName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-4">
          {/* 기본 정보 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold mb-3">기본 정보</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-600">상태:</span>
                <span className="ml-2"><WaveStatusBadge status={wave.status} /></span>
              </div>
              <div>
                <span className="text-gray-600">Wave 타입:</span>
                <span className="ml-2"><WaveTypeBadge type={wave.waveType} /></span>
              </div>
              <div>
                <span className="text-gray-600">운송 방식:</span>
                <span className="ml-2 font-medium">{getShippingMethodLabel(wave.shippingMethod || '')}</span>
              </div>
              <div>
                <span className="text-gray-600">운송사:</span>
                <span className="ml-2 font-medium">{wave.carrier}</span>
              </div>
              <div>
                <span className="text-gray-600">출고 예정일:</span>
                <span className="ml-2 font-medium">
                  {wave.plannedShipDate?.toLocaleDateString('ko-KR')}
                </span>
              </div>
              <div>
                <span className="text-gray-600">마감 시간:</span>
                <span className="ml-2 font-medium">{wave.cutoffTime}</span>
              </div>
            </div>
          </div>

          {/* 진행 상황 */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-semibold mb-3">진행 상황</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">완료된 주문</span>
                <span className="font-semibold">
                  {wave.completedOrders} / {wave.totalOrders}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all"
                  style={{ width: `${(wave.completedOrders / wave.totalOrders) * 100}%` }}
                />
              </div>
              <div className="text-right text-sm text-gray-600">
                {((wave.completedOrders / wave.totalOrders) * 100).toFixed(1)}% 완료
              </div>
            </div>
          </div>

          {/* 타임라인 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold mb-3">타임라인</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="h-5 w-5 text-green-600" />
                <span className="text-gray-600">생성일:</span>
                <span className="font-medium">
                  {wave.createdAt?.toLocaleString('ko-KR') || '-'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ClockIcon className="h-5 w-5 text-blue-600" />
                <span className="text-gray-600">최종 수정:</span>
                <span className="font-medium">
                  {wave.updatedAt?.toLocaleString('ko-KR') || '-'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-purple-600" />
                <span className="text-gray-600">예상 출고:</span>
                <span className="font-medium">
                  {wave.plannedShipDate?.toLocaleString('ko-KR')} {wave.cutoffTime}
                </span>
              </div>
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="flex gap-2 pt-4">
            <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              주문 추가
            </button>
            <button className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
              Batch 인쇄
            </button>
            <button 
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
