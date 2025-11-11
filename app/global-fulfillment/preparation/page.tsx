'use client';

import { useState } from 'react';
import {
  ClipboardDocumentCheckIcon,
  QrCodeIcon,
  TruckIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  PhotoIcon,
  MapPinIcon
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
  },
  {
    id: 'PREP-004',
    orderId: 'TB-20250104-004',
    sku: 'SKU-CN-004',
    productName: 'USB 케이블 10팩',
    quantity: 10,
    destination: '상하이',
    destinationCountry: 'CN',
    transshipmentPoint: '인천창고 → 상하이',
    productCondition: 'normal',
    needsRelabel: false,
    needsAssembly: false,
    approvalRequired: false,
    status: 'approved'
  },
  {
    id: 'PREP-005',
    orderId: 'TB-20250104-005',
    sku: 'SKU-CN-005',
    productName: '노트북 거치대',
    quantity: 1,
    destination: '부산광역시',
    destinationCountry: 'KR',
    productCondition: 'missing',
    needsRelabel: false,
    needsAssembly: false,
    approvalRequired: true,
    approvalStatus: 'pending',
    customerNotes: '상품 누락, 재입고 대기',
    status: 'pending'
  }
];

const TRANSSHIPMENT_POINTS = [
  { value: 'incheon', label: '인천창고', country: 'KR' },
  { value: 'incheon-narita', label: '인천창고 → 나리타', country: 'JP' },
  { value: 'incheon-shanghai', label: '인천창고 → 상하이', country: 'CN' },
  { value: 'incheon-beijing', label: '인천창고 → 베이징', country: 'CN' },
  { value: 'incheon-hongkong', label: '인천창고 → 홍콩', country: 'HK' }
];

export default function PreparationPage() {
  const [items, setItems] = useState<PreparationItem[]>(SAMPLE_ITEMS);
  const [scanMode, setScanMode] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PreparationItem | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // 바코드 스캔 처리
  const handleBarcodeScan = (barcode: string) => {
    const item = items.find(
      i => i.id === barcode || i.orderId === barcode || i.sku === barcode
    );

    if (!item) {
      alert(`❌ 상품을 찾을 수 없습니다: ${barcode}`);
      return;
    }

    setSelectedItem(item);
    setShowDetailModal(true);
  };

  // 상태 업데이트
  const updateItemStatus = (itemId: string, newStatus: PreparationItem['status']) => {
    setItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? {
              ...item,
              status: newStatus,
              checkedBy: newStatus === 'ready' ? '김철수' : item.checkedBy,
              checkedAt: newStatus === 'ready' ? new Date() : item.checkedAt
            }
          : item
      )
    );
  };

  // 승인 처리
  const handleApproval = (itemId: string, approved: boolean) => {
    setItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? {
              ...item,
              approvalStatus: approved ? 'approved' : 'rejected',
              status: approved ? 'approved' : 'pending'
            }
          : item
      )
    );
    alert(approved ? '✅ 승인되었습니다' : '❌ 거절되었습니다');
  };

  // 통계
  const stats = {
    total: items.length,
    pending: items.filter(i => i.status === 'pending').length,
    checking: items.filter(i => i.status === 'checking').length,
    ready: items.filter(i => i.status === 'ready').length,
    approved: items.filter(i => i.status === 'approved').length,
    needsApproval: items.filter(i => i.approvalRequired && i.approvalStatus === 'pending').length,
    defective: items.filter(i => i.productCondition !== 'normal').length
  };

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📦 상품 준비 및 환적 (Preparation & Transshipment)</h1>
          <p className="text-sm text-gray-600 mt-1">
            입고된 상품의 상태 확인 및 재포장, 국내외 배송 전처리
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
      <div className="grid grid-cols-7 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">전체</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</div>
        </div>
        <div className="bg-gray-50 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">대기</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{stats.pending}</div>
        </div>
        <div className="bg-yellow-50 rounded-lg shadow p-4">
          <div className="text-sm text-yellow-700 font-medium">확인중</div>
          <div className="text-3xl font-bold text-yellow-600 mt-1">{stats.checking}</div>
        </div>
        <div className="bg-blue-50 rounded-lg shadow p-4">
          <div className="text-sm text-blue-700 font-medium">준비완료</div>
          <div className="text-3xl font-bold text-blue-600 mt-1">{stats.ready}</div>
        </div>
        <div className="bg-green-50 rounded-lg shadow p-4">
          <div className="text-sm text-green-700 font-medium">승인됨</div>
          <div className="text-3xl font-bold text-green-600 mt-1">{stats.approved}</div>
        </div>
        <div className="bg-purple-50 rounded-lg shadow p-4">
          <div className="text-sm text-purple-700 font-medium">승인대기</div>
          <div className="text-3xl font-bold text-purple-600 mt-1">{stats.needsApproval}</div>
        </div>
        <div className="bg-red-50 rounded-lg shadow p-4">
          <div className="text-sm text-red-700 font-medium">이상품</div>
          <div className="text-3xl font-bold text-red-600 mt-1">{stats.defective}</div>
        </div>
      </div>

      {/* 승인 대기 알림 */}
      {stats.needsApproval > 0 && (
        <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <ExclamationTriangleIcon className="h-8 w-8 text-purple-600" />
            <div>
              <h3 className="font-semibold text-purple-900">📋 {stats.needsApproval}건의 승인 대기 중</h3>
              <p className="text-sm text-purple-700">고객 승인이 필요한 상품이 있습니다.</p>
            </div>
          </div>
        </div>
      )}

      {/* 바코드 스캔 모드 */}
      {scanMode && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <QrCodeIcon className="h-6 w-6 text-green-600" />
            바코드 스캔 모드
          </h3>
          <BarcodeInput onScan={handleBarcodeScan} />
        </div>
      )}

      {/* 상품 목록 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">상품 준비 목록</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {items.map(item => (
            <div
              key={item.id}
              className={`p-4 hover:bg-gray-50 transition ${
                item.productCondition !== 'normal' ? 'bg-red-50' :
                item.approvalRequired && item.approvalStatus === 'pending' ? 'bg-purple-50' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-semibold text-gray-900">{item.orderId}</span>
                    <StatusBadge status={item.status} />
                    {item.approvalRequired && (
                      <ApprovalBadge status={item.approvalStatus} />
                    )}
                    {item.productCondition !== 'normal' && (
                      <ConditionBadge condition={item.productCondition} />
                    )}
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>
                      <strong>{item.productName}</strong> • SKU: {item.sku} • 수량: {item.quantity}개
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="flex items-center gap-1">
                        <MapPinIcon className="h-3 w-3" />
                        {item.destination} ({item.destinationCountry})
                      </span>
                      {item.transshipmentPoint && (
                        <span className="flex items-center gap-1">
                          <TruckIcon className="h-3 w-3" />
                          환적: {item.transshipmentPoint}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-3 text-xs">
                      {item.needsRelabel && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-semibold">
                          🏷️ 라벨 재부착
                        </span>
                      )}
                      {item.needsAssembly && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded font-semibold">
                          🔧 세트 조립
                        </span>
                      )}
                      {item.images && item.images.length > 0 && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded font-semibold flex items-center gap-1">
                          <PhotoIcon className="h-3 w-3" />
                          사진 {item.images.length}
                        </span>
                      )}
                    </div>
                    {item.customerNotes && (
                      <div className="text-xs text-orange-600 font-medium">
                        💬 {item.customerNotes}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {item.status === 'pending' && (
                    <button
                      onClick={() => updateItemStatus(item.id, 'checking')}
                      className="px-4 py-2 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
                    >
                      확인 시작
                    </button>
                  )}
                  {item.status === 'checking' && (
                    <button
                      onClick={() => updateItemStatus(item.id, 'ready')}
                      className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      준비 완료
                    </button>
                  )}
                  {item.status === 'ready' && item.approvalRequired && item.approvalStatus === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproval(item.id, true)}
                        className="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                      >
                        승인
                      </button>
                      <button
                        onClick={() => handleApproval(item.id, false)}
                        className="px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                      >
                        거절
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setSelectedItem(item);
                      setShowDetailModal(true);
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
                  >
                    상세보기
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 환적지 안내 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TruckIcon className="h-5 w-5" />
            환적지 안내
          </h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4">
            {TRANSSHIPMENT_POINTS.map((point, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="font-medium">{point.label}</span>
                <span className="text-sm text-gray-600">{point.country}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 사용 가이드 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-3">💡 상품 준비 가이드</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>• <strong>상태 확인</strong>: 입고된 상품의 정상/불량/분실 여부를 확인하세요</li>
          <li>• <strong>라벨 재부착</strong>: 필요 시 국내외 배송을 위한 라벨을 재부착하세요</li>
          <li>• <strong>세트 조립</strong>: 여러 상품을 하나의 세트로 조립하세요</li>
          <li>• <strong>환적지 선택</strong>: 목적지에 따라 적절한 환적 경로를 선택하세요</li>
          <li>• <strong>고객 승인</strong>: 출고 전 승인이 필요한 경우 고객에게 확인 요청하세요</li>
        </ul>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: PreparationItem['status'] }) {
  const styles = {
    pending: 'bg-gray-100 text-gray-700',
    checking: 'bg-yellow-100 text-yellow-700',
    ready: 'bg-blue-100 text-blue-700',
    approved: 'bg-green-100 text-green-700',
    shipping: 'bg-purple-100 text-purple-700'
  };

  const labels = {
    pending: '⚪ 대기',
    checking: '🟡 확인중',
    ready: '🔵 준비완료',
    approved: '✅ 승인됨',
    shipping: '🚚 배송중'
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function ApprovalBadge({ status }: { status?: 'pending' | 'approved' | 'rejected' }) {
  if (!status) return null;

  const styles = {
    pending: 'bg-purple-100 text-purple-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700'
  };

  const labels = {
    pending: '📋 승인대기',
    approved: '✅ 승인완료',
    rejected: '❌ 승인거절'
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function ConditionBadge({ condition }: { condition: PreparationItem['productCondition'] }) {
  const styles = {
    normal: 'bg-green-100 text-green-700',
    defective: 'bg-red-100 text-red-700',
    missing: 'bg-orange-100 text-orange-700'
  };

  const labels = {
    normal: '✅ 정상',
    defective: '🔧 불량',
    missing: '❓ 누락'
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[condition]}`}>
      {labels[condition]}
    </span>
  );
}
