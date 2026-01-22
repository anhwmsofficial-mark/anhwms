'use client';

import { useState, useEffect } from 'react';
import { Order } from '@/types';
import StatusBadge from '@/components/StatusBadge';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

export default function SyncTab() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    try {
      setLoading(true);
      const res = await fetch('/api/orders');
      const data = await res.json();
      setOrders(data);
    } catch (error) {
      console.error('주문 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredOrders = orders.filter((order) => {
    const matchSearch = order.orderNo
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchStatus =
      statusFilter === 'ALL' || order.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    CREATED: orders.filter((o) => o.status === 'CREATED').length,
    PUSHED: orders.filter((o) => o.status === 'PUSHED').length,
    SYNCED: orders.filter((o) => o.status === 'SYNCED').length,
    FAILED: orders.filter((o) => o.status === 'FAILED').length,
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'CREATED':
        return 'bg-gray-100 text-gray-800';
      case 'PUSHED':
        return 'bg-yellow-100 text-yellow-800';
      case 'SYNCED':
        return 'bg-green-100 text-green-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'CREATED':
        return '생성됨';
      case 'PUSHED':
        return '전송 중';
      case 'SYNCED':
        return '연동 완료';
      case 'FAILED':
        return '실패';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div
          className={`bg-gray-50 rounded-lg shadow p-6 cursor-pointer transition-all ${
            statusFilter === 'CREATED' ? 'ring-2 ring-gray-500' : ''
          }`}
          onClick={() =>
            setStatusFilter(statusFilter === 'CREATED' ? 'ALL' : 'CREATED')
          }
        >
          <p className="text-sm text-gray-600 font-medium">생성됨</p>
          <p className="text-3xl font-bold text-gray-900">{stats.CREATED}</p>
        </div>

        <div
          className={`bg-yellow-50 rounded-lg shadow p-6 cursor-pointer transition-all ${
            statusFilter === 'PUSHED' ? 'ring-2 ring-yellow-500' : ''
          }`}
          onClick={() =>
            setStatusFilter(statusFilter === 'PUSHED' ? 'ALL' : 'PUSHED')
          }
        >
          <p className="text-sm text-yellow-600 font-medium">전송 중</p>
          <p className="text-3xl font-bold text-yellow-900">{stats.PUSHED}</p>
        </div>

        <div
          className={`bg-green-50 rounded-lg shadow p-6 cursor-pointer transition-all ${
            statusFilter === 'SYNCED' ? 'ring-2 ring-green-500' : ''
          }`}
          onClick={() =>
            setStatusFilter(statusFilter === 'SYNCED' ? 'ALL' : 'SYNCED')
          }
        >
          <p className="text-sm text-green-600 font-medium">연동 완료</p>
          <p className="text-3xl font-bold text-green-900">{stats.SYNCED}</p>
        </div>

        <div
          className={`bg-red-50 rounded-lg shadow p-6 cursor-pointer transition-all ${
            statusFilter === 'FAILED' ? 'ring-2 ring-red-500' : ''
          }`}
          onClick={() =>
            setStatusFilter(statusFilter === 'FAILED' ? 'ALL' : 'FAILED')
          }
        >
          <p className="text-sm text-red-600 font-medium">실패</p>
          <p className="text-3xl font-bold text-red-900">{stats.FAILED}</p>
        </div>
      </div>

      {/* 검색 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-2">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="주문번호 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 outline-none text-sm"
          />
        </div>
      </div>

      {/* 주문 목록 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">
            송장 연동 현황
            {statusFilter !== 'ALL' && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                (필터: {getStatusLabel(statusFilter)})
              </span>
            )}
          </h3>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            {searchTerm
              ? '검색 결과가 없습니다'
              : '주문 데이터가 없습니다'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    주문번호
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    상태
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    배송사
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    송장번호
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    수취인
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    등록일시
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {order.orderNo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded ${getStatusBadgeColor(
                          order.status
                        )}`}
                      >
                        {getStatusLabel(order.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {order.logisticsCompany || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-mono">
                      {order.trackingNo || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {order.receiver?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(order.createdAt).toLocaleString('ko-KR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

