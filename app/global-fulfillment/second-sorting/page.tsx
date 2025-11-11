'use client';

import { useState } from 'react';
import {
  MagnifyingGlassIcon,
  QrCodeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  TruckIcon,
  CubeIcon,
  ClipboardDocumentListIcon,
  ArrowDownTrayIcon,
  ChartBarIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import BarcodeInput from '@/components/BarcodeInput';

interface Order {
  id: string;
  orderId: string;
  sku: string;
  productName: string;
  quantity: number;
  scannedQty: number;
  carrier: string;
  receiverName: string;
  palletId?: string;
  status: 'pending' | 'sorting' | 'complete' | 'error';
  issues?: string[];
  worker?: string;
  scanTime?: Date;
}

interface Pallet {
  id: string;
  carrier: string;
  orders: string[]; // Order IDs
  totalItems: number;
  status: 'open' | 'closed';
  createdAt: Date;
  closedAt?: Date;
}

interface SKUGroup {
  sku: string;
  productName: string;
  totalQty: number;
  scannedQty: number;
  orderCount: number;
}

// 샘플 데이터
const SAMPLE_ORDERS: Order[] = [
  {
    id: 'ORD-001',
    orderId: 'TB-20250104-001',
    sku: 'SKU-CN-001',
    productName: '무선 이어폰',
    quantity: 5,
    scannedQty: 0,
    carrier: 'hanjin',
    receiverName: '김철수',
    status: 'pending'
  },
  {
    id: 'ORD-002',
    orderId: 'TB-20250104-002',
    sku: 'SKU-CN-002',
    productName: '스마트워치',
    quantity: 3,
    scannedQty: 0,
    carrier: 'cj',
    receiverName: '이영희',
    status: 'pending'
  },
  {
    id: 'ORD-003',
    orderId: 'TB-20250104-003',
    sku: 'SKU-CN-001',
    productName: '무선 이어폰',
    quantity: 2,
    scannedQty: 0,
    carrier: 'hanjin',
    receiverName: '박민수',
    status: 'pending'
  },
  {
    id: 'ORD-004',
    orderId: 'TB-20250104-004',
    sku: 'SKU-CN-003',
    productName: '블루투스 스피커',
    quantity: 4,
    scannedQty: 0,
    carrier: 'shunfeng',
    receiverName: '왕웨이',
    status: 'pending'
  },
  {
    id: 'ORD-005',
    orderId: 'TB-20250104-005',
    sku: 'SKU-CN-002',
    productName: '스마트워치',
    quantity: 1,
    scannedQty: 0,
    carrier: 'cj',
    receiverName: '최지혜',
    status: 'pending'
  },
  {
    id: 'ORD-006',
    orderId: 'TB-20250104-006',
    sku: 'SKU-CN-001',
    productName: '무선 이어폰',
    quantity: 3,
    scannedQty: 0,
    carrier: 'hanjin',
    receiverName: '정민호',
    status: 'pending'
  },
  {
    id: 'ORD-007',
    orderId: 'TB-20250104-007',
    sku: 'SKU-CN-004',
    productName: '노트북 거치대',
    quantity: 2,
    scannedQty: 0,
    carrier: 'lotte',
    receiverName: '강서연',
    status: 'pending'
  },
  {
    id: 'ORD-008',
    orderId: 'TB-20250104-008',
    sku: 'SKU-CN-003',
    productName: '블루투스 스피커',
    quantity: 1,
    scannedQty: 0,
    carrier: 'shunfeng',
    receiverName: '리웨이',
    status: 'pending'
  }
];

const CARRIERS = [
  { value: 'hanjin', label: '한진택배', color: 'bg-blue-100 text-blue-700' },
  { value: 'cj', label: 'CJ대한통운', color: 'bg-green-100 text-green-700' },
  { value: 'lotte', label: '롯데택배', color: 'bg-purple-100 text-purple-700' },
  { value: 'shunfeng', label: '顺丰速运', color: 'bg-red-100 text-red-700' },
  { value: 'ems', label: 'EMS', color: 'bg-yellow-100 text-yellow-700' },
];

export default function SecondSortingPage() {
  const [orders, setOrders] = useState<Order[]>(SAMPLE_ORDERS);
  const [pallets, setPallets] = useState<Pallet[]>([]);
  const [scanMode, setScanMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCarrier, setSelectedCarrier] = useState<string>('all');
  const [currentScan, setCurrentScan] = useState<string>('');
  const [viewMode, setViewMode] = useState<'list' | 'sku'>('list');
  const [currentWorker] = useState('작업자A');

  // 바코드 스캔 처리
  const handleBarcodeScan = (barcode: string) => {
    setCurrentScan(barcode);

    // 주문 찾기 (주문번호 또는 SKU로)
    const order = orders.find(
      o => o.orderId === barcode || o.sku === barcode
    );

    if (!order) {
      alert(`❌ 주문을 찾을 수 없습니다: ${barcode}`);
      return;
    }

    // 스캔 수량 증가
    setOrders(prev =>
      prev.map(o => {
        if (o.id === order.id) {
          const newScannedQty = o.scannedQty + 1;
          const issues: string[] = [];

          // 중복 체크
          if (newScannedQty > o.quantity) {
            issues.push('중복 스캔 감지');
          }

          // 상태 업데이트
          let status: Order['status'] = 'sorting';
          if (newScannedQty === o.quantity) {
            status = 'complete';
          } else if (newScannedQty > o.quantity) {
            status = 'error';
          }

          return {
            ...o,
            scannedQty: newScannedQty,
            status,
            issues: issues.length > 0 ? issues : undefined,
            worker: currentWorker,
            scanTime: new Date()
          };
        }
        return o;
      })
    );

    // 파렛트에 자동 할당
    assignToPallet(order);
  };

  // 파렛트 할당
  const assignToPallet = (order: Order) => {
    setPallets(prev => {
      // 같은 물류사의 열린 파렛트 찾기
      const existingPallet = prev.find(
        p => p.carrier === order.carrier && p.status === 'open'
      );

      if (existingPallet) {
        // 기존 파렛트에 추가
        if (!existingPallet.orders.includes(order.id)) {
          return prev.map(p =>
            p.id === existingPallet.id
              ? {
                  ...p,
                  orders: [...p.orders, order.id],
                  totalItems: p.totalItems + order.quantity
                }
              : p
          );
        }
        return prev;
      } else {
        // 새 파렛트 생성
        const newPallet: Pallet = {
          id: `PLT-${order.carrier.toUpperCase()}-${Date.now()}`,
          carrier: order.carrier,
          orders: [order.id],
          totalItems: order.quantity,
          status: 'open',
          createdAt: new Date()
        };
        return [...prev, newPallet];
      }
    });

    // 주문에 파렛트 ID 할당
    setOrders(prev =>
      prev.map(o =>
        o.id === order.id
          ? { ...o, palletId: `PLT-${order.carrier}` }
          : o
      )
    );
  };

  // 파렛트 닫기
  const closePallet = (palletId: string) => {
    setPallets(prev =>
      prev.map(p =>
        p.id === palletId ? { ...p, status: 'closed', closedAt: new Date() } : p
      )
    );
  };

  // 필터링된 주문 목록
  const filteredOrders = orders.filter(order => {
    const matchSearch =
      searchTerm === '' ||
      order.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.productName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchCarrier =
      selectedCarrier === 'all' || order.carrier === selectedCarrier;

    return matchSearch && matchCarrier;
  });

  // 통계
  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    sorting: orders.filter(o => o.status === 'sorting').length,
    complete: orders.filter(o => o.status === 'complete').length,
    error: orders.filter(o => o.status === 'error').length,
    totalItems: orders.reduce((sum, o) => sum + o.quantity, 0),
    scannedItems: orders.reduce((sum, o) => sum + o.scannedQty, 0)
  };

  // SKU별 그룹핑
  const skuGroups: SKUGroup[] = Object.values(
    orders.reduce((acc, order) => {
      if (!acc[order.sku]) {
        acc[order.sku] = {
          sku: order.sku,
          productName: order.productName,
          totalQty: 0,
          scannedQty: 0,
          orderCount: 0
        };
      }
      acc[order.sku].totalQty += order.quantity;
      acc[order.sku].scannedQty += order.scannedQty;
      acc[order.sku].orderCount += 1;
      return acc;
    }, {} as Record<string, SKUGroup>)
  );

  // 물류사별 통계
  const carrierStats = CARRIERS.map(carrier => {
    const carrierOrders = orders.filter(o => o.carrier === carrier.value);
    return {
      ...carrier,
      total: carrierOrders.length,
      complete: carrierOrders.filter(o => o.status === 'complete').length,
      totalItems: carrierOrders.reduce((sum, o) => sum + o.quantity, 0),
      scannedItems: carrierOrders.reduce((sum, o) => sum + o.scannedQty, 0)
    };
  }).filter(c => c.total > 0);

  // 누락 및 중복 검출
  const issues = orders.filter(o => o.issues && o.issues.length > 0);

  // Excel 내보내기
  const exportToExcel = () => {
    const csv = [
      ['주문번호', 'SKU', '상품명', '수량', '스캔수량', '물류사', '수취인', '상태', '작업자', '스캔시간'].join(','),
      ...orders.map(o => [
        o.orderId,
        o.sku,
        o.productName,
        o.quantity,
        o.scannedQty,
        CARRIERS.find(c => c.value === o.carrier)?.label || o.carrier,
        o.receiverName,
        o.status,
        o.worker || '-',
        o.scanTime ? o.scanTime.toLocaleString('ko-KR') : '-'
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `2차정렬_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">2차 정렬 (Second Sorting)</h1>
          <p className="text-sm text-gray-600 mt-1">
            배송번호 스캔 기반 자동 매칭 및 수취인별 패키지 구성
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToExcel}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
            Excel 내보내기
          </button>
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
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">전체 주문</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</div>
          <div className="text-xs text-gray-500 mt-1">총 {stats.totalItems}개 상품</div>
        </div>
        <div className="bg-gray-50 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">대기</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{stats.pending}</div>
          <div className="text-xs text-gray-500 mt-1">⚪ Pending</div>
        </div>
        <div className="bg-yellow-50 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">진행중</div>
          <div className="text-2xl font-bold text-yellow-600 mt-1">{stats.sorting}</div>
          <div className="text-xs text-yellow-600 mt-1">🟡 Sorting</div>
        </div>
        <div className="bg-green-50 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">완료</div>
          <div className="text-2xl font-bold text-green-600 mt-1">{stats.complete}</div>
          <div className="text-xs text-green-600 mt-1">🟢 Complete</div>
        </div>
        <div className="bg-red-50 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">오류</div>
          <div className="text-2xl font-bold text-red-600 mt-1">{stats.error}</div>
          <div className="text-xs text-red-600 mt-1">🔴 Error</div>
        </div>
      </div>

      {/* 진행률 바 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">전체 진행률</span>
            <span className="text-xs text-gray-500">작업자: {currentWorker}</span>
          </div>
          <span className="text-sm font-semibold text-gray-900">
            {stats.scannedItems} / {stats.totalItems} ({Math.round((stats.scannedItems / stats.totalItems) * 100)}%)
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-blue-600 h-3 rounded-full transition-all duration-500"
            style={{ width: `${(stats.scannedItems / stats.totalItems) * 100}%` }}
          />
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
          {currentScan && (
            <div className="mt-4 p-3 bg-white border border-green-300 rounded">
              <p className="text-sm text-gray-600">마지막 스캔:</p>
              <p className="font-mono font-semibold text-lg">{currentScan}</p>
            </div>
          )}
        </div>
      )}

      {/* 이상 건 알림 */}
      {issues.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
            <h3 className="font-semibold text-red-900">
              이상 건 감지 ({issues.length}건)
            </h3>
          </div>
          <div className="space-y-2">
            {issues.map(order => (
              <div key={order.id} className="bg-white p-3 rounded border border-red-300">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold">{order.orderId}</span>
                    <span className="text-sm text-gray-600 ml-3">{order.sku}</span>
                  </div>
                  <div className="text-sm text-red-600">
                    {order.issues?.join(', ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 물류사별 통계 */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <ChartBarIcon className="h-5 w-5" />
          물류사별 진행 상황
        </h3>
        <div className="grid grid-cols-5 gap-3">
          {carrierStats.map(carrier => (
            <div key={carrier.value} className={`rounded-lg p-3 ${carrier.color.replace('text-', 'border-')} border-2`}>
              <div className="text-sm font-semibold mb-1">{carrier.label}</div>
              <div className="text-xs text-gray-600 mb-2">
                {carrier.complete} / {carrier.total} 건
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${carrier.color.replace('text-', 'bg-')}`}
                  style={{ width: `${(carrier.complete / carrier.total) * 100}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {carrier.scannedItems} / {carrier.totalItems} 개
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 보기 모드 선택 */}
      <div className="flex gap-2">
        <button
          onClick={() => setViewMode('list')}
          className={`px-4 py-2 rounded-lg transition ${
            viewMode === 'list'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          주문별 보기
        </button>
        <button
          onClick={() => setViewMode('sku')}
          className={`px-4 py-2 rounded-lg transition ${
            viewMode === 'sku'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          SKU별 보기
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* 주문/SKU 목록 */}
        <div className="col-span-2">
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  {viewMode === 'list' ? '주문 목록' : 'SKU별 그룹'}
                </h2>
                <div className="flex gap-2">
                  <select
                    value={selectedCarrier}
                    onChange={(e) => setSelectedCarrier(e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="all">전체 물류사</option>
                    {CARRIERS.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="주문번호, SKU, 상품명 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {viewMode === 'list' ? (
              <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
                {filteredOrders.map(order => (
                  <div
                    key={order.id}
                    className={`p-4 hover:bg-gray-50 transition ${
                      order.status === 'error' ? 'bg-red-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-semibold text-gray-900">{order.orderId}</span>
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            CARRIERS.find(c => c.value === order.carrier)?.color || 'bg-gray-100 text-gray-700'
                          }`}>
                            {CARRIERS.find(c => c.value === order.carrier)?.label}
                          </span>
                          <StatusBadge status={order.status} />
                        </div>
                        <div className="text-sm text-gray-600">
                          <span className="font-mono text-blue-600">{order.sku}</span>
                          <span className="mx-2">•</span>
                          <span>{order.productName}</span>
                          <span className="mx-2">•</span>
                          <span>수취인: {order.receiverName}</span>
                        </div>
                        {order.worker && (
                          <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <UserIcon className="h-3 w-3" />
                            {order.worker}
                            {order.scanTime && ` • ${order.scanTime.toLocaleTimeString('ko-KR')}`}
                          </div>
                        )}
                        {order.palletId && (
                          <div className="text-xs text-purple-600 mt-1">
                            📦 파렛트: {order.palletId}
                          </div>
                        )}
                        {order.issues && order.issues.length > 0 && (
                          <div className="text-xs text-red-600 mt-1 flex items-center gap-1">
                            <ExclamationTriangleIcon className="h-4 w-4" />
                            {order.issues.join(', ')}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-gray-900">
                          {order.scannedQty} / {order.quantity}
                        </div>
                        <div className="text-xs text-gray-500">스캔 수량</div>
                        {order.status === 'complete' && (
                          <CheckCircleIcon className="h-6 w-6 text-green-600 mt-2 ml-auto" />
                        )}
                        {order.status === 'error' && (
                          <XCircleIcon className="h-6 w-6 text-red-600 mt-2 ml-auto" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
                {skuGroups.map(group => {
                  const progress = (group.scannedQty / group.totalQty) * 100;
                  return (
                    <div key={group.sku} className="p-4 hover:bg-gray-50 transition">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-semibold text-gray-900 mb-1">{group.productName}</div>
                          <div className="text-sm text-gray-600">
                            <span className="font-mono text-blue-600">{group.sku}</span>
                            <span className="mx-2">•</span>
                            <span>{group.orderCount}개 주문</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-gray-900">
                            {group.scannedQty} / {group.totalQty}
                          </div>
                          <div className="text-xs text-gray-500">총 수량</div>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            progress === 100 ? 'bg-green-600' : 'bg-blue-600'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 파렛트 구성 */}
        <div>
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <CubeIcon className="h-5 w-5" />
                파렛트 구성
              </h2>
              <p className="text-xs text-gray-600 mt-1">
                물류사별 자동 분류 • {pallets.length}개
              </p>
            </div>

            <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
              {pallets.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <CubeIcon className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">파렛트가 없습니다</p>
                  <p className="text-xs">스캔하면 자동 생성됩니다</p>
                </div>
              )}

              {pallets.map(pallet => {
                const carrier = CARRIERS.find(c => c.value === pallet.carrier);
                const palletOrders = orders.filter(o => pallet.orders.includes(o.id));

                return (
                  <div
                    key={pallet.id}
                    className={`border-2 rounded-lg p-4 ${
                      pallet.status === 'closed'
                        ? 'border-gray-300 bg-gray-50'
                        : 'border-purple-300 bg-purple-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-semibold text-gray-900 text-sm">{pallet.id}</div>
                        <div className={`text-xs px-2 py-0.5 rounded inline-block mt-1 ${carrier?.color}`}>
                          {carrier?.label}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{pallet.orders.length}건</div>
                        <div className="text-xs text-gray-500">{pallet.totalItems}개</div>
                      </div>
                    </div>

                    <div className="space-y-1 mb-3">
                      {palletOrders.slice(0, 3).map(order => (
                        <div key={order.id} className="text-xs text-gray-700 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                          {order.orderId} ({order.quantity}개)
                        </div>
                      ))}
                      {palletOrders.length > 3 && (
                        <div className="text-xs text-gray-500">
                          외 {palletOrders.length - 3}건...
                        </div>
                      )}
                    </div>

                    <div className="text-xs text-gray-500 mb-2">
                      생성: {pallet.createdAt.toLocaleTimeString('ko-KR')}
                      {pallet.closedAt && (
                        <> • 마감: {pallet.closedAt.toLocaleTimeString('ko-KR')}</>
                      )}
                    </div>

                    {pallet.status === 'open' ? (
                      <button
                        onClick={() => closePallet(pallet.id)}
                        className="w-full px-3 py-1.5 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 transition"
                      >
                        파렛트 마감
                      </button>
                    ) : (
                      <div className="w-full px-3 py-1.5 bg-gray-400 text-white rounded text-sm text-center">
                        ✓ 마감 완료
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 사용 가이드 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-3">💡 사용 가이드</h3>
        <div className="grid grid-cols-2 gap-4">
          <ul className="space-y-2 text-sm text-blue-800">
            <li>• <strong>바코드 스캔</strong>: 주문번호 또는 SKU를 스캔하여 자동 매칭</li>
            <li>• <strong>자동 분류</strong>: 물류사별로 자동으로 파렛트에 할당됩니다</li>
            <li>• <strong>중복 감지</strong>: 같은 상품을 여러 번 스캔하면 자동으로 감지합니다</li>
            <li>• <strong>파렛트 마감</strong>: 파렛트를 마감하면 출고 준비 상태가 됩니다</li>
          </ul>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>• <strong>SKU별 보기</strong>: 같은 상품을 그룹으로 확인할 수 있습니다</li>
            <li>• <strong>물류사별 통계</strong>: 각 물류사의 진행 상황을 실시간으로 확인</li>
            <li>• <strong>Excel 내보내기</strong>: 전체 데이터를 CSV 파일로 다운로드</li>
            <li>• <strong>작업자 추적</strong>: 누가 언제 스캔했는지 기록됩니다</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Order['status'] }) {
  const styles = {
    pending: 'bg-gray-100 text-gray-700',
    sorting: 'bg-yellow-100 text-yellow-700',
    complete: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700'
  };

  const labels = {
    pending: '⚪ 대기',
    sorting: '🟡 진행',
    complete: '🟢 완료',
    error: '🔴 오류'
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
