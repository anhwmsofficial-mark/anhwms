'use client';

import Header from '@/components/Header';
import { getDashboardStats } from '@/lib/mockData';
import { 
  CubeIcon, 
  ExclamationTriangleIcon, 
  ArrowDownTrayIcon, 
  ArrowUpTrayIcon 
} from '@heroicons/react/24/outline';

export default function Home() {
  const stats = getDashboardStats();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="flex flex-col">
      <Header title="대시보드" />
      
      <main className="flex-1 p-8">
        {/* 통계 카드 */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">총 제품 수</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalProducts}</p>
              </div>
              <div className="rounded-full bg-blue-100 p-3">
                <CubeIcon className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">총 재고 수량</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalStock}</p>
              </div>
              <div className="rounded-full bg-green-100 p-3">
                <CubeIcon className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">재고 부족 품목</p>
                <p className="text-3xl font-bold text-red-600 mt-2">{stats.lowStockItems}</p>
              </div>
              <div className="rounded-full bg-red-100 p-3">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">금일 입/출고</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.totalInboundToday}/{stats.totalOutboundToday}
                </p>
              </div>
              <div className="rounded-full bg-purple-100 p-3">
                <ArrowDownTrayIcon className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* 최근 입고 내역 */}
          <div className="bg-white rounded-lg shadow">
            <div className="border-b border-gray-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <ArrowDownTrayIcon className="h-5 w-5 text-green-600" />
                <h3 className="text-lg font-semibold text-gray-900">최근 입고 내역</h3>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {stats.recentInbounds.map((inbound) => (
                  <div key={inbound.id} className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div>
                      <p className="font-medium text-gray-900">{inbound.productName}</p>
                      <p className="text-sm text-gray-500">{inbound.supplierName}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">+{inbound.quantity}{inbound.unit}</p>
                      <p className="text-xs text-gray-500">{formatDate(inbound.inboundDate)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 최근 출고 내역 */}
          <div className="bg-white rounded-lg shadow">
            <div className="border-b border-gray-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <ArrowUpTrayIcon className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">최근 출고 내역</h3>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {stats.recentOutbounds.map((outbound) => (
                  <div key={outbound.id} className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div>
                      <p className="font-medium text-gray-900">{outbound.productName}</p>
                      <p className="text-sm text-gray-500">{outbound.customerName}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-blue-600">-{outbound.quantity}{outbound.unit}</p>
                      <p className="text-xs text-gray-500">{formatDate(outbound.outboundDate)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 재고 부족 경고 */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center gap-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
              <h3 className="text-lg font-semibold text-gray-900">재고 부족 품목</h3>
            </div>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      제품명
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      SKU
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      현재 재고
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      최소 재고
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      위치
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stats.lowStockProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {product.name}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.sku}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <span className="text-red-600 font-semibold">{product.quantity}{product.unit}</span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.minStock}{product.unit}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.location}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
