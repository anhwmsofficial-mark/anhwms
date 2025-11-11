'use client';

import { useState } from 'react';
import {
  MagnifyingGlassIcon,
  QrCodeIcon,
  PhotoIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  TrashIcon,
  TruckIcon,
  ClipboardDocumentCheckIcon
} from '@heroicons/react/24/outline';
import BarcodeInput from '@/components/BarcodeInput';

interface ReturnRequest {
  id: string;
  orderId: string;
  trackingNumber: string;
  sku: string;
  productName: string;
  quantity: number;
  customerName: string;
  carrier: string;
  requestType: 'return' | 'exchange';
  requestDate: Date;
  reason: string;
  reasonDetail?: string;
  inspectionResult?: 'normal' | 'defective' | 'missing' | 'damaged';
  inspectionNotes?: string;
  images?: string[];
  action?: 'restock' | 'dispose' | 'exchange' | 'refund';
  status: 'received' | 'inspecting' | 'approved' | 'rejected' | 'completed';
  refundAmount?: number;
  completedAt?: Date;
}

// 반품 사유 목록
const RETURN_REASONS = [
  { value: 'defective', label: '불량/하자', icon: '🔧' },
  { value: 'wrong_item', label: '오배송', icon: '📦' },
  { value: 'size_mismatch', label: '사이즈 불일치', icon: '📏' },
  { value: 'simple_change', label: '단순 변심', icon: '💭' },
  { value: 'damaged', label: '파손/손상', icon: '💔' },
  { value: 'missing', label: '미배송/분실', icon: '❓' },
  { value: 'other', label: '기타', icon: '📝' }
];

// 처리 방법
const ACTIONS = [
  { value: 'restock', label: '재고 복귀', icon: '📦', color: 'bg-blue-100 text-blue-700' },
  { value: 'dispose', label: '폐기 처리', icon: '🗑️', color: 'bg-red-100 text-red-700' },
  { value: 'exchange', label: '교환 발송', icon: '🔄', color: 'bg-green-100 text-green-700' },
  { value: 'refund', label: '환불 처리', icon: '💰', color: 'bg-purple-100 text-purple-700' }
];

// 샘플 데이터
const SAMPLE_REQUESTS: ReturnRequest[] = [
  {
    id: 'RTN-001',
    orderId: 'TB-20250104-001',
    trackingNumber: 'HJ-2025-001234',
    sku: 'SKU-CN-001',
    productName: '무선 이어폰',
    quantity: 1,
    customerName: '김철수',
    carrier: 'hanjin',
    requestType: 'return',
    requestDate: new Date('2025-01-04T10:30:00'),
    reason: 'defective',
    reasonDetail: '충전이 안 됩니다',
    status: 'received'
  },
  {
    id: 'RTN-002',
    orderId: 'TB-20250104-002',
    trackingNumber: 'CJ-2025-567890',
    sku: 'SKU-CN-002',
    productName: '스마트워치',
    quantity: 1,
    customerName: '이영희',
    carrier: 'cj',
    requestType: 'exchange',
    requestDate: new Date('2025-01-04T11:00:00'),
    reason: 'size_mismatch',
    reasonDetail: '사이즈가 작아요',
    status: 'received'
  },
  {
    id: 'RTN-003',
    orderId: 'TB-20250103-015',
    trackingNumber: 'HJ-2025-001200',
    sku: 'SKU-CN-003',
    productName: '블루투스 스피커',
    quantity: 1,
    customerName: '박민수',
    carrier: 'hanjin',
    requestType: 'return',
    requestDate: new Date('2025-01-03T15:20:00'),
    reason: 'simple_change',
    reasonDetail: '마음이 바뀌었습니다',
    status: 'inspecting',
    inspectionResult: 'normal'
  }
];

export default function ReturnsPage() {
  const [requests, setRequests] = useState<ReturnRequest[]>(SAMPLE_REQUESTS);
  const [scanMode, setScanMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<ReturnRequest | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);

  // 바코드 스캔 처리
  const handleBarcodeScan = (barcode: string) => {
    const request = requests.find(
      r => r.id === barcode || r.orderId === barcode || r.trackingNumber === barcode
    );

    if (!request) {
      alert(`❌ 반품/교환 요청을 찾을 수 없습니다: ${barcode}`);
      return;
    }

    setSelectedRequest(request);
    setShowDetailModal(true);
  };

  // 검수 결과 업데이트
  const handleInspectionResult = (
    requestId: string,
    result: 'normal' | 'defective' | 'missing' | 'damaged',
    notes: string
  ) => {
    setRequests(prev =>
      prev.map(r =>
        r.id === requestId
          ? {
              ...r,
              inspectionResult: result,
              inspectionNotes: notes,
              status: 'inspecting'
            }
          : r
      )
    );
  };

  // 처리 방법 선택
  const handleActionSelect = (requestId: string, action: ReturnRequest['action']) => {
    setRequests(prev =>
      prev.map(r =>
        r.id === requestId
          ? { ...r, action }
          : r
      )
    );
  };

  // 승인/거절
  const handleApproval = (requestId: string, approve: boolean) => {
    setRequests(prev =>
      prev.map(r =>
        r.id === requestId
          ? {
              ...r,
              status: approve ? 'approved' : 'rejected'
            }
          : r
      )
    );

    if (approve) {
      alert('✅ 반품/교환이 승인되었습니다.');
    } else {
      alert('❌ 반품/교환이 거절되었습니다.');
    }
  };

  // 처리 완료
  const handleComplete = (requestId: string) => {
    const request = requests.find(r => r.id === requestId);
    if (!request || !request.action) {
      alert('처리 방법을 선택하세요');
      return;
    }

    setRequests(prev =>
      prev.map(r =>
        r.id === requestId
          ? {
              ...r,
              status: 'completed',
              completedAt: new Date(),
              refundAmount: r.action === 'refund' ? Math.floor(Math.random() * 50000) + 10000 : undefined
            }
          : r
      )
    );

    alert(`✅ ${request.requestType === 'return' ? '반품' : '교환'} 처리가 완료되었습니다.`);
    setShowDetailModal(false);
    setSelectedRequest(null);
  };

  // 이미지 업로드 처리
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setImageFiles(prev => [...prev, ...files]);
  };

  // 필터링
  const filteredRequests = requests.filter(request => {
    const searchLower = searchTerm.toLowerCase();
    return (
      searchTerm === '' ||
      request.orderId.toLowerCase().includes(searchLower) ||
      request.trackingNumber.toLowerCase().includes(searchLower) ||
      request.sku.toLowerCase().includes(searchLower) ||
      request.customerName.toLowerCase().includes(searchLower)
    );
  });

  // 통계
  const stats = {
    total: requests.length,
    received: requests.filter(r => r.status === 'received').length,
    inspecting: requests.filter(r => r.status === 'inspecting').length,
    approved: requests.filter(r => r.status === 'approved').length,
    completed: requests.filter(r => r.status === 'completed').length,
    returns: requests.filter(r => r.requestType === 'return').length,
    exchanges: requests.filter(r => r.requestType === 'exchange').length
  };

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">교환 / 반품 (Exchange / Return)</h1>
          <p className="text-sm text-gray-600 mt-1">
            반품 또는 교환 요청건 처리 및 관리
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
          <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</div>
        </div>
        <div className="bg-blue-50 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">접수</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">{stats.received}</div>
        </div>
        <div className="bg-yellow-50 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">검수중</div>
          <div className="text-2xl font-bold text-yellow-600 mt-1">{stats.inspecting}</div>
        </div>
        <div className="bg-green-50 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">승인</div>
          <div className="text-2xl font-bold text-green-600 mt-1">{stats.approved}</div>
        </div>
        <div className="bg-purple-50 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">완료</div>
          <div className="text-2xl font-bold text-purple-600 mt-1">{stats.completed}</div>
        </div>
        <div className="bg-orange-50 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">반품</div>
          <div className="text-2xl font-bold text-orange-600 mt-1">{stats.returns}</div>
        </div>
        <div className="bg-teal-50 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">교환</div>
          <div className="text-2xl font-bold text-teal-600 mt-1">{stats.exchanges}</div>
        </div>
      </div>

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

      {/* 검색 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="주문번호, 운송장 번호, SKU, 고객명 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* 요청 목록 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">반품/교환 요청 목록</h2>
        </div>

        <div className="divide-y divide-gray-200">
          {filteredRequests.map(request => {
            const reasonInfo = RETURN_REASONS.find(r => r.value === request.reason);
            const actionInfo = request.action ? ACTIONS.find(a => a.value === request.action) : null;

            return (
              <div
                key={request.id}
                className="p-4 hover:bg-gray-50 transition cursor-pointer"
                onClick={() => {
                  setSelectedRequest(request);
                  setShowDetailModal(true);
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-semibold text-gray-900">{request.orderId}</span>
                      <TypeBadge type={request.requestType} />
                      <StatusBadge status={request.status} />
                      {actionInfo && (
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${actionInfo.color}`}>
                          {actionInfo.icon} {actionInfo.label}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>
                        <strong>{request.productName}</strong> ({request.quantity}개) • SKU: {request.sku}
                      </div>
                      <div>고객: {request.customerName} • 운송장: {request.trackingNumber}</div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                          {reasonInfo?.icon} {reasonInfo?.label}
                        </span>
                        {request.reasonDetail && (
                          <span className="text-xs text-gray-500">"{request.reasonDetail}"</span>
                        )}
                      </div>
                      {request.inspectionResult && (
                        <div className="text-xs">
                          검수 결과: <InspectionBadge result={request.inspectionResult} />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">
                      {request.requestDate.toLocaleString('ko-KR')}
                    </div>
                    {request.status === 'completed' && request.completedAt && (
                      <div className="text-xs text-green-600 mt-1">
                        ✓ {request.completedAt.toLocaleDateString('ko-KR')} 완료
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredRequests.length === 0 && (
            <div className="p-12 text-center text-gray-400">
              <ArrowPathIcon className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p>반품/교환 요청이 없습니다</p>
            </div>
          )}
        </div>
      </div>

      {/* 상세 모달 */}
      {showDetailModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h2 className="text-xl font-bold">
                  {selectedRequest.requestType === 'return' ? '반품' : '교환'} 상세 정보
                </h2>
                <p className="text-sm text-gray-600">{selectedRequest.orderId}</p>
              </div>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedRequest(null);
                  setImageFiles([]);
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
                <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">주문번호:</span>
                    <span className="font-semibold">{selectedRequest.orderId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">운송장:</span>
                    <span className="font-mono">{selectedRequest.trackingNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">상품:</span>
                    <span className="font-semibold">{selectedRequest.productName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">SKU:</span>
                    <span className="font-mono text-blue-600">{selectedRequest.sku}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">수량:</span>
                    <span>{selectedRequest.quantity}개</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">고객:</span>
                    <span>{selectedRequest.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">접수일:</span>
                    <span>{selectedRequest.requestDate.toLocaleString('ko-KR')}</span>
                  </div>
                </div>
              </div>

              {/* 반품/교환 사유 */}
              <div>
                <h3 className="text-lg font-semibold mb-3">사유</h3>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {RETURN_REASONS.find(r => r.value === selectedRequest.reason)?.icon}
                    <span className="font-semibold">
                      {RETURN_REASONS.find(r => r.value === selectedRequest.reason)?.label}
                    </span>
                  </div>
                  {selectedRequest.reasonDetail && (
                    <p className="text-sm text-gray-700">"{selectedRequest.reasonDetail}"</p>
                  )}
                </div>
              </div>

              {/* 검수 결과 */}
              {selectedRequest.status !== 'received' && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">검수 결과</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        상품 상태 *
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { value: 'normal', label: '정상', icon: '✅', color: 'green' },
                          { value: 'defective', label: '불량', icon: '🔧', color: 'red' },
                          { value: 'damaged', label: '파손', icon: '💔', color: 'orange' },
                          { value: 'missing', label: '분실', icon: '❓', color: 'gray' }
                        ].map(option => (
                          <button
                            key={option.value}
                            onClick={() =>
                              handleInspectionResult(
                                selectedRequest.id,
                                option.value as any,
                                selectedRequest.inspectionNotes || ''
                              )
                            }
                            className={`p-3 rounded-lg border-2 text-sm font-semibold transition ${
                              selectedRequest.inspectionResult === option.value
                                ? `border-${option.color}-500 bg-${option.color}-50 text-${option.color}-700`
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="text-2xl mb-1">{option.icon}</div>
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        검수 메모
                      </label>
                      <textarea
                        value={selectedRequest.inspectionNotes || ''}
                        onChange={(e) => {
                          setRequests(prev =>
                            prev.map(r =>
                              r.id === selectedRequest.id
                                ? { ...r, inspectionNotes: e.target.value }
                                : r
                            )
                          );
                          setSelectedRequest({ ...selectedRequest, inspectionNotes: e.target.value });
                        }}
                        rows={3}
                        placeholder="검수 결과에 대한 상세 메모..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 사진 첨부 */}
              <div>
                <h3 className="text-lg font-semibold mb-3">사진 첨부</h3>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                  />
                  <label htmlFor="image-upload" className="cursor-pointer">
                    <PhotoIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">클릭하여 사진 업로드</p>
                    <p className="text-xs text-gray-400">불량/파손 사진, 반품 상품 사진 등</p>
                  </label>
                  {imageFiles.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2 justify-center">
                      {imageFiles.map((file, idx) => (
                        <div key={idx} className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                          📷 {file.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 처리 방법 선택 */}
              {selectedRequest.inspectionResult && selectedRequest.status !== 'completed' && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">처리 방법</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {ACTIONS.map(action => (
                      <button
                        key={action.value}
                        onClick={() => handleActionSelect(selectedRequest.id, action.value as any)}
                        className={`p-4 rounded-lg border-2 transition ${
                          selectedRequest.action === action.value
                            ? `${action.color} border-opacity-50`
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-3xl mb-2">{action.icon}</div>
                        <div className="font-semibold">{action.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 액션 버튼 */}
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3 sticky bottom-0 bg-white">
              {selectedRequest.status === 'received' && (
                <button
                  onClick={() => {
                    setRequests(prev =>
                      prev.map(r =>
                        r.id === selectedRequest.id ? { ...r, status: 'inspecting' } : r
                      )
                    );
                    setSelectedRequest({ ...selectedRequest, status: 'inspecting' });
                  }}
                  className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition"
                >
                  검수 시작
                </button>
              )}

              {selectedRequest.status === 'inspecting' && selectedRequest.inspectionResult && (
                <>
                  <button
                    onClick={() => handleApproval(selectedRequest.id, false)}
                    className="px-6 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition"
                  >
                    거절
                  </button>
                  <button
                    onClick={() => handleApproval(selectedRequest.id, true)}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                  >
                    승인
                  </button>
                </>
              )}

              {selectedRequest.status === 'approved' && selectedRequest.action && (
                <button
                  onClick={() => handleComplete(selectedRequest.id)}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  처리 완료
                </button>
              )}

              {selectedRequest.status === 'completed' && (
                <div className="px-6 py-2 bg-green-100 text-green-700 rounded-lg font-semibold">
                  ✓ 처리 완료
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 사용 가이드 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-3">💡 사용 가이드</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>• <strong>바코드 스캔</strong>: 주문번호 또는 운송장 번호를 스캔하여 빠른 조회</li>
          <li>• <strong>검수 진행</strong>: 반품 상품의 상태를 확인하고 정상/불량/파손/분실 판정</li>
          <li>• <strong>사진 첨부</strong>: 불량이나 파손 상품의 증빙 사진 업로드</li>
          <li>• <strong>처리 방법 선택</strong>: 재고 복귀, 폐기, 교환 발송, 환불 중 선택</li>
          <li>• <strong>자동 재고 반영</strong>: 재고 복귀 선택 시 자동으로 재고에 반영됩니다</li>
        </ul>
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: 'return' | 'exchange' }) {
  const styles = {
    return: 'bg-orange-100 text-orange-700',
    exchange: 'bg-teal-100 text-teal-700'
  };

  const labels = {
    return: '🔙 반품',
    exchange: '🔄 교환'
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${styles[type]}`}>
      {labels[type]}
    </span>
  );
}

function StatusBadge({ status }: { status: ReturnRequest['status'] }) {
  const styles = {
    received: 'bg-blue-100 text-blue-700',
    inspecting: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    completed: 'bg-purple-100 text-purple-700'
  };

  const labels = {
    received: '📥 접수',
    inspecting: '🔍 검수중',
    approved: '✅ 승인',
    rejected: '❌ 거절',
    completed: '✓ 완료'
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function InspectionBadge({ result }: { result: 'normal' | 'defective' | 'missing' | 'damaged' }) {
  const styles = {
    normal: 'bg-green-100 text-green-700',
    defective: 'bg-red-100 text-red-700',
    damaged: 'bg-orange-100 text-orange-700',
    missing: 'bg-gray-100 text-gray-700'
  };

  const labels = {
    normal: '✅ 정상',
    defective: '🔧 불량',
    damaged: '💔 파손',
    missing: '❓ 분실'
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${styles[result]}`}>
      {labels[result]}
    </span>
  );
}
