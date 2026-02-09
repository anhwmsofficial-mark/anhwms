'use client';

import { useState, useEffect } from 'react';
import { Order, LogisticsApiLog } from '@/types';
import {
  ExclamationCircleIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

export default function LogsTab() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [logs, setLogs] = useState<LogisticsApiLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    try {
      setLoading(true);
      const res = await fetch('/api/orders');
      const data = await res.json();
      // 실패 주문만 필터
      const failedOrders = (data.data || []).filter(
        (o: Order) => o.status === 'FAILED' || o.status === 'CREATED'
      );
      setOrders(failedOrders);
    } catch (error) {
      console.error('주문 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadLogs(orderId: string) {
    try {
      setLogsLoading(true);
      const res = await fetch(`/api/orders/${orderId}/logs`);
      const data = await res.json();
      setLogs(data);
    } catch (error) {
      console.error('로그 조회 실패:', error);
    } finally {
      setLogsLoading(false);
    }
  }

  const handleOrderClick = (order: Order) => {
    setSelectedOrder(order);
    loadLogs(order.id);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'S':
        return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
      case 'E':
        return <ExclamationCircleIcon className="h-5 w-5 text-yellow-600" />;
      case 'F':
        return <ExclamationCircleIcon className="h-5 w-5 text-red-600" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-600" />;
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 좌측: 실패 주문 목록 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-red-50">
          <h3 className="text-lg font-bold text-red-900 flex items-center gap-2">
            <ExclamationCircleIcon className="h-6 w-6" />
            처리 필요 주문 ({orders.length}건)
          </h3>
          <p className="text-sm text-red-700 mt-1">
            실패 또는 미처리 주문을 클릭하여 상세 로그를 확인하세요
          </p>
        </div>

        {orders.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <CheckCircleIcon className="h-16 w-16 text-green-400 mx-auto mb-4" />
            <p>처리 필요한 주문이 없습니다</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
            {orders.map((order) => (
              <div
                key={order.id}
                onClick={() => handleOrderClick(order)}
                className={`
                  p-4 cursor-pointer hover:bg-gray-50 transition-colors
                  ${
                    selectedOrder?.id === order.id
                      ? 'bg-blue-50 border-l-4 border-blue-500'
                      : ''
                  }
                `}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono font-bold text-gray-900">
                      {order.orderNo}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {order.receiver?.name} | {order.logisticsCompany}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(order.createdAt).toLocaleString('ko-KR')}
                    </p>
                  </div>
                  <span
                    className={`
                    px-2 py-1 text-xs font-semibold rounded
                    ${
                      order.status === 'FAILED'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }
                  `}
                  >
                    {order.status}
                  </span>
                </div>
                {order.remark && (
                  <p className="text-xs text-gray-500 mt-2 italic">
                    비고: {order.remark}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 우측: 선택된 주문의 로그 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-bold text-gray-900">API 처리 로그</h3>
          {selectedOrder && (
            <p className="text-sm text-gray-600 mt-1 font-mono">
              {selectedOrder.orderNo}
            </p>
          )}
        </div>

        {!selectedOrder ? (
          <div className="p-12 text-center text-gray-500">
            좌측에서 주문을 선택하세요
          </div>
        ) : logsLoading ? (
          <div className="flex items-center justify-center p-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">로그를 불러오는 중...</p>
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            API 로그가 없습니다
          </div>
        ) : (
          <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className="p-4">
                <div className="flex items-start gap-3">
                  {getStatusIcon(log.status)}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-gray-900">
                        {log.adapter} - {log.direction}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(log.createdAt).toLocaleString('ko-KR')}
                      </span>
                    </div>

                    {log.httpCode && (
                      <p className="text-sm text-gray-600 mb-2">
                        HTTP Status: {log.httpCode}
                      </p>
                    )}

                    {log.body != null ? (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800">
                          상세 보기
                        </summary>
                        <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-x-auto">
                          {JSON.stringify(log.body, null, 2)}
                        </pre>
                      </details>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

