'use client';

import { useState } from 'react';
import {
  CubeIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  MapPinIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  minStock: number;
  location: string;
  status: 'normal' | 'low' | 'out';
  lastUpdated: Date;
}

const SAMPLE_INVENTORY: InventoryItem[] = [
  {
    id: 'INV001',
    sku: 'LAP-001',
    name: '노트북 A',
    category: '전자제품',
    quantity: 45,
    unit: '개',
    minStock: 10,
    location: 'A-1-01',
    status: 'normal',
    lastUpdated: new Date('2025-01-12'),
  },
  {
    id: 'INV002',
    sku: 'MOU-001',
    name: '무선 마우스',
    category: '전자제품',
    quantity: 120,
    unit: '개',
    minStock: 30,
    location: 'A-2-05',
    status: 'normal',
    lastUpdated: new Date('2025-01-12'),
  },
  {
    id: 'INV003',
    sku: 'KEY-001',
    name: '키보드',
    category: '전자제품',
    quantity: 8,
    unit: '개',
    minStock: 15,
    location: 'A-2-06',
    status: 'low',
    lastUpdated: new Date('2025-01-13'),
  },
  {
    id: 'INV004',
    sku: 'MON-001',
    name: '모니터 27인치',
    category: '전자제품',
    quantity: 32,
    unit: '개',
    minStock: 10,
    location: 'B-1-03',
    status: 'normal',
    lastUpdated: new Date('2025-01-11'),
  },
  {
    id: 'INV005',
    sku: 'CAB-001',
    name: 'USB 케이블',
    category: '액세서리',
    quantity: 0,
    unit: '개',
    minStock: 50,
    location: 'C-1-01',
    status: 'out',
    lastUpdated: new Date('2025-01-10'),
  },
];

export default function InventoryPage() {
  const [inventory] = useState<InventoryItem[]>(SAMPLE_INVENTORY);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // 필터링
  const filteredInventory = inventory.filter((item) => {
    const matchSearch =
      searchTerm === '' ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.location.toLowerCase().includes(searchTerm.toLowerCase());

    const matchStatus = filterStatus === 'all' || item.status === filterStatus;

    return matchSearch && matchStatus;
  });

  // 통계
  const stats = {
    total: inventory.length,
    totalQuantity: inventory.reduce((sum, item) => sum + item.quantity, 0),
    normal: inventory.filter((i) => i.status === 'normal').length,
    low: inventory.filter((i) => i.status === 'low').length,
    out: inventory.filter((i) => i.status === 'out').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">📦 재고/로케이션 관리</h1>
              <p className="text-sm text-gray-600 mt-1">SKU별 재고 현황 및 위치 관리</p>
            </div>
            <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2">
              <ArrowPathIcon className="h-5 w-5" />
              재고 조정
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* 통계 카드 */}
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">총 품목</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</div>
          </div>
          <div className="bg-blue-50 rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">총 재고</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{stats.totalQuantity}</div>
          </div>
          <div className="bg-green-50 rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">정상</div>
            <div className="text-2xl font-bold text-green-600 mt-1">{stats.normal}</div>
          </div>
          <div className="bg-yellow-50 rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">저재고</div>
            <div className="text-2xl font-bold text-yellow-600 mt-1">{stats.low}</div>
          </div>
          <div className="bg-red-50 rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">품절</div>
            <div className="text-2xl font-bold text-red-600 mt-1">{stats.out}</div>
          </div>
        </div>

        {/* 검색 및 필터 */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="SKU, 품목명, 로케이션 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">전체 상태</option>
              <option value="normal">정상</option>
              <option value="low">저재고</option>
              <option value="out">품절</option>
            </select>
          </div>
        </div>

        {/* 재고 목록 */}
        <div className="bg-white rounded-lg shadow">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    SKU
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    품목명
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    카테고리
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    재고 수량
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    최소 재고
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    로케이션
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    상태
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    최종 업데이트
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredInventory.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-900">{item.sku}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.category}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-sm font-semibold ${
                          item.quantity === 0
                            ? 'text-red-600'
                            : item.quantity <= item.minStock
                            ? 'text-yellow-600'
                            : 'text-green-600'
                        }`}
                      >
                        {item.quantity}
                        {item.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {item.minStock}
                      {item.unit}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-sm text-blue-600">
                        <MapPinIcon className="h-4 w-4" />
                        {item.location}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {item.lastUpdated.toLocaleDateString('ko-KR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 저재고/품절 알림 */}
        {(stats.low > 0 || stats.out > 0) && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
            <div className="flex">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <strong>주의:</strong> 저재고 품목 {stats.low}개, 품절 품목 {stats.out}개가
                  있습니다. 재입고가 필요합니다.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    normal: 'bg-green-100 text-green-700',
    low: 'bg-yellow-100 text-yellow-700',
    out: 'bg-red-100 text-red-700',
  };

  const labels: Record<string, string> = {
    normal: '✅ 정상',
    low: '⚠️ 저재고',
    out: '❌ 품절',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

