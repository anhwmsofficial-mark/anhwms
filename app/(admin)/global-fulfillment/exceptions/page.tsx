'use client';

import { useState } from 'react';
import {
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserIcon,
  PhotoIcon
} from '@heroicons/react/24/outline';
import { showError, showSuccess } from '@/lib/toast';

interface Exception {
  id: string;
  exceptionType: 'missing' | 'duplicate' | 'damaged' | 'delay' | 'customs' | 'address' | 'other';
  orderId: string;
  sku: string;
  productName: string;
  carrier: string;
  customerName: string;
  description: string;
  detectedAt: Date;
  detectedBy: 'system' | 'operator';
  operatorName?: string;
  priority: 'high' | 'medium' | 'low';
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  assignedTo?: string;
  resolvedAt?: Date;
  resolution?: string;
  images?: string[];
  notes?: string;
}

const SAMPLE_EXCEPTIONS: Exception[] = [
  {
    id: 'EXC-001',
    exceptionType: 'missing',
    orderId: 'TB-20250104-001',
    sku: 'SKU-CN-001',
    productName: '무선 이어폰',
    carrier: '한진택배',
    customerName: '김철수',
    description: '주문 수량 5개 중 1개 누락',
    detectedAt: new Date('2025-01-04T14:30:00'),
    detectedBy: 'operator',
    operatorName: '이영희',
    priority: 'high',
    status: 'open',
    assignedTo: '박민수',
    images: ['image1.jpg']
  },
  {
    id: 'EXC-002',
    exceptionType: 'duplicate',
    orderId: 'TB-20250104-002',
    sku: 'SKU-CN-002',
    productName: '스마트워치',
    carrier: 'CJ대한통운',
    customerName: '이영희',
    description: '2차 정렬 시 중복 스캔 감지 (3회)',
    detectedAt: new Date('2025-01-04T13:15:00'),
    detectedBy: 'system',
    priority: 'medium',
    status: 'resolved',
    assignedTo: '김철수',
    resolvedAt: new Date('2025-01-04T14:00:00'),
    resolution: '중복 스캔 오류, 정상 수량 확인 후 출고 완료'
  },
  {
    id: 'EXC-003',
    exceptionType: 'damaged',
    orderId: 'TB-20250104-003',
    sku: 'SKU-CN-003',
    productName: '블루투스 스피커',
    carrier: '顺丰速运',
    customerName: '왕웨이',
    description: '입고 검수 중 외관 파손 발견',
    detectedAt: new Date('2025-01-04T11:20:00'),
    detectedBy: 'operator',
    operatorName: '박민수',
    priority: 'high',
    status: 'investigating',
    assignedTo: '최지혜',
    images: ['image2.jpg', 'image3.jpg'],
    notes: '고객 연락 완료, 교환 진행 중'
  },
  {
    id: 'EXC-004',
    exceptionType: 'delay',
    orderId: 'TB-20250104-004',
    sku: 'SKU-CN-004',
    productName: '노트북 거치대',
    carrier: 'EMS',
    customerName: '최지혜',
    description: '통관 지연 - 서류 미비',
    detectedAt: new Date('2025-01-04T10:05:00'),
    detectedBy: 'system',
    priority: 'medium',
    status: 'investigating',
    assignedTo: '김철수'
  },
  {
    id: 'EXC-005',
    exceptionType: 'address',
    orderId: 'TB-20250104-005',
    sku: 'SKU-CN-005',
    productName: 'USB 케이블',
    carrier: '한진택배',
    customerName: '홍길동',
    description: '수취인 주소 불명확 - 재확인 필요',
    detectedAt: new Date('2025-01-03T18:30:00'),
    detectedBy: 'operator',
    operatorName: '이영희',
    priority: 'low',
    status: 'open',
    notes: '고객 연락 시도 중'
  }
];

const EXCEPTION_TYPES = [
  { value: 'missing', label: '누락', icon: '📦', color: 'red' },
  { value: 'duplicate', label: '중복', icon: '🔄', color: 'yellow' },
  { value: 'damaged', label: '파손', icon: '💔', color: 'red' },
  { value: 'delay', label: '지연', icon: '⏱️', color: 'orange' },
  { value: 'customs', label: '통관', icon: '🛃', color: 'purple' },
  { value: 'address', label: '주소', icon: '📍', color: 'blue' },
  { value: 'other', label: '기타', icon: '📝', color: 'gray' }
];

export default function ExceptionsPage() {
  
  const [exceptions, setExceptions] = useState<Exception[]>(SAMPLE_EXCEPTIONS);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedException, setSelectedException] = useState<Exception | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // 필터링
  const filteredExceptions = exceptions.filter(exc => {
    const matchSearch = searchTerm === '' ||
      exc.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exc.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exc.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exc.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchType = selectedType === 'all' || exc.exceptionType === selectedType;
    const matchStatus = selectedStatus === 'all' || exc.status === selectedStatus;
    const matchPriority = selectedPriority === 'all' || exc.priority === selectedPriority;

    return matchSearch && matchType && matchStatus && matchPriority;
  });

  // 통계
  const stats = {
    total: exceptions.length,
    open: exceptions.filter(e => e.status === 'open').length,
    investigating: exceptions.filter(e => e.status === 'investigating').length,
    resolved: exceptions.filter(e => e.status === 'resolved').length,
    highPriority: exceptions.filter(e => e.priority === 'high' && e.status !== 'closed').length
  };

  // 이상 처리 완료
  const handleResolve = (excId: string, resolution: string) => {
    setExceptions(prev =>
      prev.map(exc =>
        exc.id === excId
          ? {
              ...exc,
              status: 'resolved',
              resolvedAt: new Date(),
              resolution
            }
          : exc
      )
    );
    showSuccess('이상 건이 해결되었습니다.');
    setShowDetailModal(false);
  };

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">⚠️ 이상 처리 (Exception Handling)</h1>
          <p className="text-sm text-gray-600 mt-1">
            전체 프로세스 중 오류/누락건 집중 관리
          </p>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">전체 이상 건</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</div>
        </div>
        <div className="bg-red-50 rounded-lg shadow p-4">
          <div className="text-sm text-red-700 font-medium">긴급 처리</div>
          <div className="text-3xl font-bold text-red-600 mt-1">{stats.highPriority}</div>
          <p className="text-xs text-red-600 mt-1">🔴 높은 우선순위</p>
        </div>
        <div className="bg-yellow-50 rounded-lg shadow p-4">
          <div className="text-sm text-yellow-700 font-medium">미처리</div>
          <div className="text-3xl font-bold text-yellow-600 mt-1">{stats.open}</div>
        </div>
        <div className="bg-blue-50 rounded-lg shadow p-4">
          <div className="text-sm text-blue-700 font-medium">조사중</div>
          <div className="text-3xl font-bold text-blue-600 mt-1">{stats.investigating}</div>
        </div>
        <div className="bg-green-50 rounded-lg shadow p-4">
          <div className="text-sm text-green-700 font-medium">해결완료</div>
          <div className="text-3xl font-bold text-green-600 mt-1">{stats.resolved}</div>
        </div>
      </div>

      {/* 긴급 알림 */}
      {stats.highPriority > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-900">🔴 긴급: {stats.highPriority}건의 높은 우선순위 이상 건이 있습니다</h3>
              <p className="text-sm text-red-700">즉시 처리가 필요합니다.</p>
            </div>
          </div>
        </div>
      )}

      {/* 검색 및 필터 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-4 gap-4">
          <div className="col-span-2 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="주문번호, SKU, 고객명, 설명 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">전체 유형</option>
            {EXCEPTION_TYPES.map(type => (
              <option key={type.value} value={type.value}>
                {type.icon} {type.label}
              </option>
            ))}
          </select>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">전체 상태</option>
            <option value="open">미처리</option>
            <option value="investigating">조사중</option>
            <option value="resolved">해결완료</option>
            <option value="closed">종료</option>
          </select>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setSelectedPriority('all')}
            className={`px-4 py-2 rounded-lg transition ${
              selectedPriority === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            전체
          </button>
          <button
            onClick={() => setSelectedPriority('high')}
            className={`px-4 py-2 rounded-lg transition ${
              selectedPriority === 'high'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            🔴 높음
          </button>
          <button
            onClick={() => setSelectedPriority('medium')}
            className={`px-4 py-2 rounded-lg transition ${
              selectedPriority === 'medium'
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            🟡 중간
          </button>
          <button
            onClick={() => setSelectedPriority('low')}
            className={`px-4 py-2 rounded-lg transition ${
              selectedPriority === 'low'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            🟢 낮음
          </button>
        </div>
      </div>

      {/* 이상 건 목록 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">이상 건 목록 ({filteredExceptions.length}건)</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {filteredExceptions.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <CheckCircleIcon className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p>이상 건이 없습니다</p>
            </div>
          ) : (
            filteredExceptions.map(exc => {
              const typeInfo = EXCEPTION_TYPES.find(t => t.value === exc.exceptionType);
              
              return (
                <div
                  key={exc.id}
                  className={`p-4 hover:bg-gray-50 transition cursor-pointer ${
                    exc.priority === 'high' && exc.status !== 'resolved' ? 'bg-red-50' : ''
                  }`}
                  onClick={() => {
                    setSelectedException(exc);
                    setShowDetailModal(true);
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{typeInfo?.icon}</span>
                        <span className="font-semibold text-gray-900">{exc.orderId}</span>
                        <ExceptionTypeBadge type={exc.exceptionType} />
                        <StatusBadge status={exc.status} />
                        <PriorityBadge priority={exc.priority} />
                      </div>
                      <div className="text-sm text-gray-600 space-y-1 ml-10">
                        <div>
                          <strong>{exc.productName}</strong> (SKU: {exc.sku})
                        </div>
                        <div className="text-red-700 font-medium">
                          ⚠️ {exc.description}
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span>고객: {exc.customerName}</span>
                          <span>물류사: {exc.carrier}</span>
                          {exc.assignedTo && (
                            <span className="flex items-center gap-1">
                              <UserIcon className="h-3 w-3" />
                              담당: {exc.assignedTo}
                            </span>
                          )}
                          {exc.detectedBy === 'operator' && exc.operatorName && (
                            <span>발견: {exc.operatorName}</span>
                          )}
                          {exc.images && exc.images.length > 0 && (
                            <span className="flex items-center gap-1 text-blue-600">
                              <PhotoIcon className="h-3 w-3" />
                              사진 {exc.images.length}장
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <div>{exc.detectedAt.toLocaleString('ko-KR')}</div>
                      {exc.resolvedAt && (
                        <div className="text-green-600 mt-1">
                          ✓ {exc.resolvedAt.toLocaleDateString('ko-KR')} 해결
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 상세 모달 */}
      {showDetailModal && selectedException && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-xl font-bold">이상 건 상세 정보</h2>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedException(null);
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
                    <span className="text-gray-600">이상 ID:</span>
                    <span className="ml-2 font-mono font-semibold">{selectedException.id}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">주문번호:</span>
                    <span className="ml-2 font-semibold">{selectedException.orderId}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">상품:</span>
                    <span className="ml-2">{selectedException.productName}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">SKU:</span>
                    <span className="ml-2 font-mono text-blue-600">{selectedException.sku}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">고객:</span>
                    <span className="ml-2">{selectedException.customerName}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">물류사:</span>
                    <span className="ml-2">{selectedException.carrier}</span>
                  </div>
                </div>
              </div>

              {/* 이상 내용 */}
              <div>
                <h3 className="text-lg font-semibold mb-3">이상 내용</h3>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ExceptionTypeBadge type={selectedException.exceptionType} />
                    <PriorityBadge priority={selectedException.priority} />
                  </div>
                  <p className="text-gray-800 font-medium">{selectedException.description}</p>
                </div>
              </div>

              {/* 발견 정보 */}
              <div>
                <h3 className="text-lg font-semibold mb-3">발견 정보</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">발견 일시:</span>
                    <span className="ml-2 font-semibold">
                      {selectedException.detectedAt.toLocaleString('ko-KR')}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">발견 방법:</span>
                    <span className="ml-2">
                      {selectedException.detectedBy === 'system' ? '🤖 시스템 자동 감지' : '👤 작업자 발견'}
                    </span>
                  </div>
                  {selectedException.operatorName && (
                    <div>
                      <span className="text-gray-600">발견 작업자:</span>
                      <span className="ml-2 font-semibold">{selectedException.operatorName}</span>
                    </div>
                  )}
                  {selectedException.assignedTo && (
                    <div>
                      <span className="text-gray-600">담당자:</span>
                      <span className="ml-2 font-semibold">{selectedException.assignedTo}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 해결 정보 */}
              {selectedException.resolution && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">해결 내용</h3>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-gray-800">{selectedException.resolution}</p>
                    {selectedException.resolvedAt && (
                      <p className="text-xs text-green-600 mt-2">
                        ✓ {selectedException.resolvedAt.toLocaleString('ko-KR')} 해결 완료
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* 메모 */}
              {selectedException.notes && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">메모</h3>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-gray-800 text-sm">{selectedException.notes}</p>
                  </div>
                </div>
              )}

              {/* 해결 방법 입력 */}
              {selectedException.status !== 'resolved' && selectedException.status !== 'closed' && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">해결 처리</h3>
                  <textarea
                    placeholder="해결 방법 및 조치 내용을 입력하세요..."
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    id="resolution-input"
                  />
                  <button
                    onClick={() => {
                      const input = document.getElementById('resolution-input') as HTMLTextAreaElement;
                      if (input.value.trim()) {
                        handleResolve(selectedException.id, input.value.trim());
                      } else {
                        showError('해결 내용을 입력하세요');
                      }
                    }}
                    className="mt-3 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                  >
                    ✓ 해결 완료 처리
                  </button>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3 sticky bottom-0 bg-white">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 사용 가이드 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-3">💡 이상 처리 가이드</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>• <strong>시스템 자동 감지</strong>: 중복 스캔, 통관 지연 등은 자동으로 감지됩니다</li>
          <li>• <strong>작업자 발견</strong>: 파손, 누락 등은 작업자가 직접 등록합니다</li>
          <li>• <strong>우선순위</strong>: 🔴 높음 → 🟡 중간 → 🟢 낮음 순서로 처리하세요</li>
          <li>• <strong>담당자 지정</strong>: 각 이상 건에 담당자를 배정하여 책임을 명확히 합니다</li>
          <li>• <strong>해결 보고</strong>: 처리 완료 시 상세한 해결 내용을 기록하세요</li>
        </ul>
      </div>
    </div>
  );
}

function ExceptionTypeBadge({ type }: { type: Exception['exceptionType'] }) {
  const typeInfo = EXCEPTION_TYPES.find(t => t.value === type);
  if (!typeInfo) return null;

  const colorClasses = {
    red: 'bg-red-100 text-red-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    orange: 'bg-orange-100 text-orange-700',
    blue: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
    gray: 'bg-gray-100 text-gray-700'
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${colorClasses[typeInfo.color as keyof typeof colorClasses]}`}>
      {typeInfo.icon} {typeInfo.label}
    </span>
  );
}

function StatusBadge({ status }: { status: Exception['status'] }) {
  const styles = {
    open: 'bg-yellow-100 text-yellow-700',
    investigating: 'bg-blue-100 text-blue-700',
    resolved: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-600'
  };

  const labels = {
    open: '⚪ 미처리',
    investigating: '🔵 조사중',
    resolved: '✅ 해결완료',
    closed: '⚫ 종료'
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Exception['priority'] }) {
  const styles = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-green-100 text-green-700'
  };

  const labels = {
    high: '🔴 높음',
    medium: '🟡 중간',
    low: '🟢 낮음'
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[priority]}`}>
      {labels[priority]}
    </span>
  );
}
