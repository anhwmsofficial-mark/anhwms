'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  MagnifyingGlassIcon, 
  FunnelIcon, 
  ArrowPathIcon 
} from '@heroicons/react/24/outline';
import { Order } from '@/types';

export default function AdminOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 50 });

  const statusTabs = [
    { id: 'ALL', name: '전체' },
    { id: 'CREATED', name: '신규주문' },
    { id: 'APPROVED', name: '승인됨' },
    { id: 'ALLOCATED', name: '할당됨' },
    { id: 'PACKED', name: '패킹완료' },
    { id: 'SHIPPED', name: '출고완료' },
    { id: 'CANCELLED', name: '취소됨' },
    { id: 'on_hold', name: '보류중' }, // Special filter
  ];

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let url = `/api/orders?page=${page}&limit=${pagination.limit}&`;
      if (statusFilter !== 'ALL' && statusFilter !== 'on_hold') {
        url += `status=${statusFilter}`;
      }
      // 보류 필터는 API에서 지원해야 하지만, 일단 클라이언트 사이드 필터링으로 구현하거나 API 확장 필요
      // 여기선 status 필터만 API로 보냄
      
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setOrders(data.data || []);
      if (data.pagination) {
        setPagination((prev) => ({ ...prev, ...data.pagination }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter, page]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  // 클라이언트 사이드 필터링 (검색어, 보류 등)
  const filteredOrders = orders.filter(order => {
    // 1. 검색어
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      order.orderNo.toLowerCase().includes(searchLower) ||
      order.receiver?.name.toLowerCase().includes(searchLower) ||
      order.trackingNo?.toLowerCase().includes(searchLower);

    // 2. 보류 필터 (특수)
    if (statusFilter === 'on_hold') {
      return matchesSearch && order.onHold;
    }

    return matchesSearch;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">주문 관리</h1>
          <p className="text-sm text-gray-500 mt-1">전체 주문 내역을 조회하고 관리합니다.</p>
        </div>
        <button 
          onClick={fetchOrders}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium transition"
        >
          <ArrowPathIcon className="w-4 h-4" />
          새로고침
        </button>
      </div>

      {/* 필터 & 검색 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="border-b border-gray-200 p-4">
          <div className="flex flex-wrap gap-2">
            {statusTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`
                  px-4 py-2 rounded-full text-sm font-medium transition-colors
                  ${statusFilter === tab.id 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}
                `}
              >
                {tab.name}
              </button>
            ))}
          </div>
        </div>
        <div className="p-4 flex gap-4">
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="주문번호, 수취인명, 송장번호 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          {/* 고급 필터 버튼 (Placeholder) */}
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">
            <FunnelIcon className="w-4 h-4" />
            필터
          </button>
        </div>
      </div>

      {/* 주문 목록 테이블 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">주문번호</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상품명</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">수취인</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">배송사/송장</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">주문일시</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex justify-center items-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    로딩 중...
                  </div>
                </td>
              </tr>
            ) : filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  검색 결과가 없습니다.
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => (
                <tr 
                  key={order.id} 
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/admin/orders/${order.id}`)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-blue-600 hover:underline">{order.orderNo}</div>
                    {order.onHold && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 mt-1">
                        ⛔ 보류됨
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`
                      inline-flex px-2.5 py-1 rounded-full text-xs font-medium
                      ${getStatusColor(order.status)}
                    `}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 truncate max-w-xs" title={order.productName}>
                      {order.productName}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{order.receiver?.name}</div>
                    <div className="text-xs text-gray-500">{order.countryCode}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{order.logisticsCompany || '-'}</div>
                    <div className="text-xs text-gray-500 font-mono">{order.trackingNo || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <div>
          총 {pagination.total.toLocaleString()}건 · {pagination.page}/{pagination.totalPages} 페이지
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
          >
            이전
          </button>
          <button
            onClick={() => setPage((p) => Math.min(p + 1, pagination.totalPages))}
            disabled={page >= pagination.totalPages}
            className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
          >
            다음
          </button>
        </div>
      </div>
    </div>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case 'CREATED': return 'bg-gray-100 text-gray-800';
    case 'APPROVED': return 'bg-blue-100 text-blue-800';
    case 'ALLOCATED': return 'bg-indigo-100 text-indigo-800';
    case 'PICKED': return 'bg-purple-100 text-purple-800';
    case 'PACKED': return 'bg-yellow-100 text-yellow-800';
    case 'SHIPPED': return 'bg-green-100 text-green-800';
    case 'DELIVERED': return 'bg-teal-100 text-teal-800';
    case 'CANCELLED': return 'bg-red-100 text-red-800';
    case 'RETURN_REQ': return 'bg-orange-100 text-orange-800';
    default: return 'bg-gray-100 text-gray-600';
  }
}

