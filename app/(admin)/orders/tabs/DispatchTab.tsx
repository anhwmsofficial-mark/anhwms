'use client';

import { useState, useEffect } from 'react';
import { Order } from '@/types';
import { getCarrierName, getCarrierColor } from '@/services/logistics/assign';
import { TruckIcon } from '@heroicons/react/24/outline';

export default function DispatchTab() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'CJ' | 'ANH' | 'INTL'>('ALL');

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

  const filteredOrders =
    filter === 'ALL'
      ? orders
      : orders.filter((o) => o.logisticsCompany === filter);

  const stats = {
    total: orders.length,
    CJ: orders.filter((o) => o.logisticsCompany === 'CJ').length,
    ANH: orders.filter((o) => o.logisticsCompany === 'ANH').length,
    INTL: orders.filter((o) => o.logisticsCompany === 'INTL').length,
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
          className={`bg-white rounded-lg shadow p-6 cursor-pointer transition-all ${
            filter === 'ALL' ? 'ring-2 ring-blue-500' : ''
          }`}
          onClick={() => setFilter('ALL')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">전체</p>
              <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <TruckIcon className="h-8 w-8 text-gray-400" />
          </div>
        </div>

        <div
          className={`bg-red-50 rounded-lg shadow p-6 cursor-pointer transition-all ${
            filter === 'CJ' ? 'ring-2 ring-red-500' : ''
          }`}
          onClick={() => setFilter('CJ')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600 font-medium">
                CJ 대한통운
              </p>
              <p className="text-3xl font-bold text-red-900">{stats.CJ}</p>
            </div>
            <TruckIcon className="h-8 w-8 text-red-400" />
          </div>
        </div>

        <div
          className={`bg-blue-50 rounded-lg shadow p-6 cursor-pointer transition-all ${
            filter === 'ANH' ? 'ring-2 ring-blue-500' : ''
          }`}
          onClick={() => setFilter('ANH')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">ANH 물류</p>
              <p className="text-3xl font-bold text-blue-900">{stats.ANH}</p>
            </div>
            <TruckIcon className="h-8 w-8 text-blue-400" />
          </div>
        </div>

        <div
          className={`bg-purple-50 rounded-lg shadow p-6 cursor-pointer transition-all ${
            filter === 'INTL' ? 'ring-2 ring-purple-500' : ''
          }`}
          onClick={() => setFilter('INTL')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-600 font-medium">
                국제 배송
              </p>
              <p className="text-3xl font-bold text-purple-900">
                {stats.INTL}
              </p>
            </div>
            <TruckIcon className="h-8 w-8 text-purple-400" />
          </div>
        </div>
      </div>

      {/* 주문 목록 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">
            배송사 배정 내역
            {filter !== 'ALL' && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                (필터: {getCarrierName(filter)})
              </span>
            )}
          </h3>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            주문 데이터가 없습니다
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
                    수취인
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    국가
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    배송사
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    상품명
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {order.receiver?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      <span className="px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-800 rounded">
                        {order.countryCode || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded ${getCarrierColor(
                          order.logisticsCompany || 'INTL'
                        )}`}
                      >
                        {getCarrierName(order.logisticsCompany || 'INTL')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {order.productName || '-'}
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

