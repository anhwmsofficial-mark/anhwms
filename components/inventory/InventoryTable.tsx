'use client';

import { Product } from '@/types';
import { 
  PencilIcon, 
  TrashIcon, 
  ExclamationTriangleIcon, 
  MagnifyingGlassIcon 
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { getProductStatus, formatCurrency, INVENTORY_STATUS_LABELS, INVENTORY_STATUS_COLORS } from '@/utils/inventory-status';

interface InventoryTableProps {
  products: Product[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onOpenLedger: (product: Product) => void;
}

export default function InventoryTable({
  products,
  isLoading,
  page,
  totalPages,
  onPageChange,
  onEdit,
  onDelete,
  onOpenLedger,
}: InventoryTableProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-500 text-sm">데이터를 불러오는 중입니다...</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col items-center justify-center py-20 text-gray-500">
        <div className="bg-gray-50 p-4 rounded-full mb-4">
          <MagnifyingGlassIcon className="h-8 w-8 text-gray-400" />
        </div>
        <p className="text-lg font-medium text-gray-900">검색 결과가 없습니다</p>
        <p className="text-sm">다른 검색어나 필터를 시도해보세요.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50/50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">제품 정보</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">카테고리</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">재고 현황</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">입고 예정</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">단가</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">위치</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">상태</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">관리</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {products.map((product) => {
              const statusKey = getProductStatus(product);
              const statusColor = INVENTORY_STATUS_COLORS[statusKey];
              const statusLabel = INVENTORY_STATUS_LABELS[statusKey];

              return (
                <tr key={product.id} className="hover:bg-gray-50/80 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">{product.name}</span>
                      <span className="text-xs text-gray-500 font-mono mt-0.5">
                        {product.productDbNo || '-'}
                      </span>
                      {product.barcode && (
                        <span className="text-xs text-gray-400 font-mono mt-0.5">{product.barcode}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {product.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-sm font-semibold",
                          statusKey === 'LOW_STOCK' ? 'text-red-600' : 
                          statusKey === 'WARNING' ? 'text-amber-600' : 
                          statusKey === 'INBOUND_EXPECTED' ? 'text-blue-600' : 'text-gray-900'
                        )}>
                          {product.quantity.toLocaleString()} {product.unit}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">최소 {product.minStock} {product.unit}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {product.expectedInbound && product.expectedInbound > 0 ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        +{product.expectedInbound.toLocaleString()} {product.unit}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {formatCurrency(product.price)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-gray-300"></span>
                      {product.location}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ring-1 ring-inset",
                      statusColor.bg,
                      statusColor.text,
                      statusColor.ring
                    )}>
                      {statusKey === 'LOW_STOCK' && <ExclamationTriangleIcon className="w-3 h-3 mr-1" />}
                      {statusLabel}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => window.open(`/inbound?sku=${encodeURIComponent(product.sku)}`, '_blank')}
                        className="px-2 py-1 text-xs text-gray-600 border border-gray-200 rounded hover:bg-gray-50"
                        title="입고 현황"
                      >
                        입고
                      </button>
                      <button
                        onClick={() => onOpenLedger(product)}
                        className="px-2 py-1 text-xs text-gray-600 border border-gray-200 rounded hover:bg-gray-50"
                        title="재고 원장"
                      >
                        원장
                      </button>
                      <button
                        onClick={() => onEdit(product)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        title="수정"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDelete(product.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="삭제"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex flex-1 justify-between sm:hidden">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            이전
          </button>
          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            다음
          </button>
        </div>
        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              <span className="font-medium">{page}</span> / <span className="font-medium">{totalPages}</span> 페이지
            </p>
          </div>
          <div>
            <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
              <button
                onClick={() => onPageChange(Math.max(1, page - 1))}
                disabled={page === 1}
                className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
              >
                <span className="sr-only">Previous</span>
                <span className="text-sm">이전</span>
              </button>
              {/* Simple pagination logic - can be improved for many pages */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p = i + 1;
                if (page > 3 && totalPages > 5) p = page - 2 + i;
                if (p > totalPages) p = totalPages - (4 - i);
                if (p < 1) p = i + 1;
                
                return (
                  <button
                    key={p}
                    onClick={() => onPageChange(p)}
                    aria-current={page === p ? 'page' : undefined}
                    className={cn(
                      page === p
                        ? "relative z-10 inline-flex items-center bg-blue-600 px-4 py-2 text-sm font-semibold text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                        : "relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                    )}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
              >
                <span className="sr-only">Next</span>
                <span className="text-sm">다음</span>
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
