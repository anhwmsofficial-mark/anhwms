'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import { useLayout } from '@/components/LayoutWrapper';
import {
  TruckIcon,
  QrCodeIcon,
  MapPinIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  CubeIcon
} from '@heroicons/react/24/outline';
import BarcodeInput from '@/components/BarcodeInput';

interface SortingItem {
  id: string;
  orderId: string;
  sku: string;
  productName: string;
  quantity: number;
  waveId: string;
  carrier: string;
  destinationZone: string;
  storageLocation?: string;
  sortedBy?: string;
  sortedAt?: Date;
  status: 'pending' | 'sorting' | 'sorted' | 'relocated';
}

const SAMPLE_ITEMS: SortingItem[] = [
  {
    id: 'SORT-001',
    orderId: 'ORD-2025-001',
    sku: 'SKU-CN-001',
    productName: '무선 이어폰',
    quantity: 5,
    waveId: 'W-2025-001',
    carrier: 'CJ대한통운',
    destinationZone: 'Zone-A1',
    status: 'sorting'
  },
  {
    id: 'SORT-002',
    orderId: 'ORD-2025-002',
    sku: 'SKU-CN-002',
    productName: '스마트워치',
    quantity: 3,
    waveId: 'W-2025-001',
    carrier: 'CJ대한통운',
    destinationZone: 'Zone-A1',
    storageLocation: 'A1-R05-S02',
    sortedBy: '김철수',
    sortedAt: new Date(),
    status: 'sorted'
  },
  {
    id: 'SORT-003',
    orderId: 'ORD-2025-003',
    sku: 'SKU-CN-003',
    productName: '블루투스 스피커',
    quantity: 2,
    waveId: 'W-2025-002',
    carrier: '顺丰速运',
    destinationZone: 'Zone-B2',
    status: 'pending'
  }
];

export default function SecondSortingPage() {
  const { toggleSidebar } = useLayout();
  const [items, setItems] = useState<SortingItem[]>(SAMPLE_ITEMS);
  const [scanMode, setScanMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterZone, setFilterZone] = useState('all');

  const zones = ['all', ...Array.from(new Set(items.map(i => i.destinationZone)))];
  
  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.productName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
    const matchesZone = filterZone === 'all' || item.destinationZone === filterZone;

    return matchesSearch && matchesStatus && matchesZone;
  });

  const handleBarcodeScan = (barcode: string) => {
    console.log('바코드 스캔:', barcode);
    // TODO: 바코드로 상품 조회 및 정렬 처리
  };

  const handleSort = (itemId: string, location: string) => {
    setItems(items.map(item =>
      item.id === itemId ? { 
        ...item, 
        status: 'sorted',
        storageLocation: location,
        sortedBy: '현재 사용자',
        sortedAt: new Date()
      } : item
    ));
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, React.ReactElement> = {
      'pending': <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">대기</span>,
      'sorting': <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">정렬중</span>,
      'sorted': <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">완료</span>,
      'relocated': <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">재배치</span>,
    };
    return badges[status] || null;
  };

  const stats = {
    total: items.length,
    pending: items.filter(i => i.status === 'pending').length,
    sorting: items.filter(i => i.status === 'sorting').length,
    sorted: items.filter(i => i.status === 'sorted').length,
  };

  return (
    <div className="flex flex-col h-screen">
      <Header title="🚚 2차 정렬" onMenuClick={toggleSidebar} />
      
      <main className="flex-1 overflow-y-auto bg-gray-50 p-4 lg:p-6">
        <div className="space-y-6">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">2차 정렬 (Second Sorting)</h1>
              <p className="text-sm text-gray-600 mt-1">
                물류사별, 목적지별 세부 분류 및 위치 할당
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

          {/* 통계 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">전체</div>
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">대기</div>
              <div className="text-2xl font-bold text-gray-500">{stats.pending}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">정렬중</div>
              <div className="text-2xl font-bold text-yellow-600">{stats.sorting}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">완료</div>
              <div className="text-2xl font-bold text-green-600">{stats.sorted}</div>
            </div>
          </div>

          {/* 바코드 스캔 */}
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
                <option value="pending">대기</option>
                <option value="sorting">정렬중</option>
                <option value="sorted">완료</option>
                <option value="relocated">재배치</option>
              </select>
              <select
                value={filterZone}
                onChange={(e) => setFilterZone(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                {zones.map(zone => (
                  <option key={zone} value={zone}>
                    {zone === 'all' ? '전체 구역' : zone}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 정렬 목록 */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">주문번호</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상품명</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">수량</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Wave</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">물류사</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">구역</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">위치</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium">{item.orderId}</td>
                      <td className="px-4 py-3 text-sm font-mono text-blue-600">{item.sku}</td>
                      <td className="px-4 py-3 text-sm">{item.productName}</td>
                      <td className="px-4 py-3 text-sm text-center font-semibold">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-semibold">
                          {item.waveId}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{item.carrier}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                          {item.destinationZone}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono">
                        {item.storageLocation || <span className="text-gray-400">미할당</span>}
                      </td>
                      <td className="px-4 py-3 text-sm">{getStatusBadge(item.status)}</td>
                      <td className="px-4 py-3 text-sm">
                        {item.status !== 'sorted' && (
                          <button
                            onClick={() => {
                              const location = prompt('보관 위치 입력 (예: A1-R05-S02):');
                              if (location) handleSort(item.id, location);
                            }}
                            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                          >
                            정렬 완료
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 가이드 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold text-blue-900 mb-3">💡 2차 정렬 프로세스</h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li>• <strong>구역 할당</strong>: Wave와 물류사별로 자동 구역 할당</li>
              <li>• <strong>위치 지정</strong>: 각 상품의 임시 보관 위치 지정</li>
              <li>• <strong>바코드 확인</strong>: 스캔하여 올바른 구역에 배치되었는지 확인</li>
              <li>• <strong>출고 대기</strong>: 정렬 완료 후 출고 프로세스로 이동</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
