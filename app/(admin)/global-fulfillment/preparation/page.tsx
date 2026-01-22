'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import { useLayout } from '@/components/LayoutWrapper';
import {
  ClipboardDocumentCheckIcon,
  QrCodeIcon,
  TruckIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  PhotoIcon,
  MapPinIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import BarcodeInput from '@/components/BarcodeInput';

interface PreparationItem {
  id: string;
  orderId: string;
  sku: string;
  productName: string;
  quantity: number;
  destination: string;
  destinationCountry: string;
  transshipmentPoint?: string;
  productCondition: 'normal' | 'defective' | 'missing';
  needsRelabel: boolean;
  needsAssembly: boolean;
  assemblyItems?: string[];
  approvalRequired: boolean;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  customerNotes?: string;
  status: 'pending' | 'checking' | 'ready' | 'approved' | 'shipping';
  checkedBy?: string;
  checkedAt?: Date;
  images?: string[];
}

const SAMPLE_ITEMS: PreparationItem[] = [
  {
    id: 'PREP-001',
    orderId: 'TB-20250104-001',
    sku: 'SKU-CN-001',
    productName: '무선 이어폰',
    quantity: 5,
    destination: '서울특별시 강남구',
    destinationCountry: 'KR',
    transshipmentPoint: '인천창고',
    productCondition: 'normal',
    needsRelabel: true,
    needsAssembly: false,
    approvalRequired: true,
    approvalStatus: 'pending',
    customerNotes: '급송 요청',
    status: 'checking'
  },
  {
    id: 'PREP-002',
    orderId: 'TB-20250104-002',
    sku: 'SKU-CN-002',
    productName: '스마트워치 + 충전기 세트',
    quantity: 3,
    destination: '경기도 성남시',
    destinationCountry: 'KR',
    transshipmentPoint: '인천창고',
    productCondition: 'normal',
    needsRelabel: false,
    needsAssembly: true,
    assemblyItems: ['스마트워치 본체', '충전기', '설명서'],
    approvalRequired: false,
    status: 'ready'
  },
  {
    id: 'PREP-003',
    orderId: 'TB-20250104-003',
    sku: 'SKU-CN-003',
    productName: '블루투스 스피커',
    quantity: 2,
    destination: '도쿄',
    destinationCountry: 'JP',
    transshipmentPoint: '인천창고 → 나리타',
    productCondition: 'defective',
    needsRelabel: true,
    needsAssembly: false,
    approvalRequired: true,
    approvalStatus: 'rejected',
    customerNotes: '불량 확인됨, 교환 필요',
    status: 'pending',
    images: ['defect.jpg']
  }
];

export default function PreparationPage() {
  const { toggleSidebar } = useLayout();
  const [items, setItems] = useState<PreparationItem[]>(SAMPLE_ITEMS);
  const [scanMode, setScanMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCondition, setFilterCondition] = useState('all');

  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.productName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
    const matchesCondition = filterCondition === 'all' || item.productCondition === filterCondition;

    return matchesSearch && matchesStatus && matchesCondition;
  });

  const handleBarcodeScan = (barcode: string) => {
    console.log('바코드 스캔:', barcode);
    // TODO: 바코드로 상품 조회 및 상태 업데이트
  };

  const handleUpdateStatus = (itemId: string, newStatus: PreparationItem['status']) => {
    setItems(items.map(item =>
      item.id === itemId ? { ...item, status: newStatus } : item
    ));
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, React.ReactElement> = {
      'pending': <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">대기중</span>,
      'checking': <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">검수중</span>,
      'ready': <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">준비완료</span>,
      'approved': <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">승인됨</span>,
      'shipping': <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">출고중</span>,
    };
    return badges[status] || null;
  };

  const getConditionBadge = (condition: string) => {
    const badges: Record<string, React.ReactElement> = {
      'normal': <span className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs">✓ 정상</span>,
      'defective': <span className="px-2 py-1 bg-red-50 text-red-700 rounded text-xs">✗ 불량</span>,
      'missing': <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded text-xs">⚠ 누락</span>,
    };
    return badges[condition] || null;
  };

  const stats = {
    total: items.length,
    pending: items.filter(i => i.status === 'pending').length,
    checking: items.filter(i => i.status === 'checking').length,
    ready: items.filter(i => i.status === 'ready').length,
    defective: items.filter(i => i.productCondition === 'defective').length,
    needsApproval: items.filter(i => i.approvalRequired && i.approvalStatus === 'pending').length,
  };

  return (
    <div className="flex flex-col h-screen">
      <Header title="📋 상품 준비" onMenuClick={toggleSidebar} />
      
      <main className="flex-1 overflow-y-auto bg-gray-50 p-4 lg:p-6">
        <div className="space-y-6">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">상품 준비 (Preparation)</h1>
              <p className="text-sm text-gray-600 mt-1">
                환적 전 상품 상태 확인, 재라벨링, 조립 작업 관리
              </p>
            </div>
            <button
              onClick={() => setScanMode(!scanMode)}
              className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                scanMode
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100'
              }`}
            >
              <QrCodeIcon className="h-5 w-5" />
              {scanMode ? '스캔 모드 ON' : '바코드 스캔'}
            </button>
          </div>

          {/* 통계 카드 */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">전체</div>
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">대기중</div>
              <div className="text-2xl font-bold text-gray-500">{stats.pending}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">검수중</div>
              <div className="text-2xl font-bold text-yellow-600">{stats.checking}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">준비완료</div>
              <div className="text-2xl font-bold text-blue-600">{stats.ready}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">불량</div>
              <div className="text-2xl font-bold text-red-600">{stats.defective}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">승인대기</div>
              <div className="text-2xl font-bold text-purple-600">{stats.needsApproval}</div>
            </div>
          </div>

          {/* 바코드 스캔 모드 */}
          {scanMode && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <QrCodeIcon className="h-6 w-6 text-green-600" />
                바코드/QR 스캔 모드
              </h3>
              <BarcodeInput onScan={handleBarcodeScan} />
            </div>
          )}

          {/* 검색 및 필터 */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="flex-1 relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="주문번호, SKU, 상품명 검색..."
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
                <option value="pending">대기중</option>
                <option value="checking">검수중</option>
                <option value="ready">준비완료</option>
                <option value="approved">승인됨</option>
                <option value="shipping">출고중</option>
              </select>
              <select
                value={filterCondition}
                onChange={(e) => setFilterCondition(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="all">전체 상태</option>
                <option value="normal">정상</option>
                <option value="defective">불량</option>
                <option value="missing">누락</option>
              </select>
            </div>
          </div>

          {/* 상품 목록 */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">주문번호</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상품명</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">수량</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상품상태</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">목적지</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium">{item.orderId}</td>
                      <td className="px-4 py-3 text-sm font-mono text-blue-600">{item.sku}</td>
                      <td className="px-4 py-3 text-sm">
                        <div>{item.productName}</div>
                        <div className="flex gap-2 mt-1">
                          {item.needsRelabel && (
                            <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded">재라벨</span>
                          )}
                          {item.needsAssembly && (
                            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">조립</span>
                          )}
                          {item.approvalRequired && (
                            <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded">승인필요</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-center font-semibold">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm">{getStatusBadge(item.status)}</td>
                      <td className="px-4 py-3 text-sm">{getConditionBadge(item.productCondition)}</td>
                      <td className="px-4 py-3 text-sm">
                        <div>{item.destination}</div>
                        <div className="text-xs text-gray-500">{item.destinationCountry}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex gap-2">
                          {item.status === 'pending' && (
                            <button
                              onClick={() => handleUpdateStatus(item.id, 'checking')}
                              className="px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-xs"
                            >
                              검수 시작
                            </button>
                          )}
                          {item.status === 'checking' && (
                            <button
                              onClick={() => handleUpdateStatus(item.id, 'ready')}
                              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                            >
                              준비 완료
                            </button>
                          )}
                          {item.status === 'ready' && item.approvalRequired && !item.approvalStatus && (
                            <button
                              onClick={() => handleUpdateStatus(item.id, 'approved')}
                              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                            >
                              승인
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 사용 가이드 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold text-blue-900 mb-3">💡 상품 준비 프로세스</h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li>• <strong>검수 시작</strong>: 상품 상태 확인, 재라벨링/조립 필요 여부 판단</li>
              <li>• <strong>재라벨링</strong>: 국가별 규격에 맞는 라벨로 교체</li>
              <li>• <strong>조립 작업</strong>: 세트 상품의 경우 구성품 조립</li>
              <li>• <strong>불량 처리</strong>: 불량 상품은 별도 관리 및 고객 승인 필요</li>
              <li>• <strong>준비 완료</strong>: 환적 준비가 완료된 상품을 다음 단계로 이동</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
