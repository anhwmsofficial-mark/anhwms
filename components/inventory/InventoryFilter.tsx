'use client';

import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { INVENTORY_STATUS_LABELS } from '@/utils/inventory-status';
import { ProductCategory } from '@/types';

interface InventoryFilterProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
  selectedStatus: string;
  onStatusChange: (value: string) => void;
  categories: ProductCategory[];
  lowStockCount: number;
  inboundExpectedCount: number;
  onAddProduct: () => void;
  onBulkUpload: () => void;
  onVolumeUpload: () => void;
}


export default function InventoryFilter({
  searchTerm,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedStatus,
  onStatusChange,
  categories,
  lowStockCount,
  inboundExpectedCount,
  onAddProduct,
  onBulkUpload,
  onVolumeUpload,
}: InventoryFilterProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
        {/* 검색 및 필터 그룹 */}
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          <div className="relative flex-1 min-w-[280px]">
            <input
              type="text"
              placeholder="제품명, SKU, 바코드..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-11 pr-4 text-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            />
            <MagnifyingGlassIcon className="absolute left-3.5 top-3 h-5 w-5 text-gray-400" />
          </div>
          
          <div className="flex gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm hover:border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">전체 카테고리</option>
              {categories.map(category => (
                <option key={category.code} value={category.nameKo}>
                  {category.nameKo} ({category.nameEn})
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => onStatusChange(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm hover:border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">모든 상태</option>
              {Object.entries(INVENTORY_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex flex-col md:flex-row items-start md:items-center gap-3 w-full lg:w-auto">
          <div className="flex gap-2 text-xs">
            <span className="px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
              재고부족 {lowStockCount}
            </span>
            <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              입고예정 {inboundExpectedCount}
            </span>
          </div>
          <button
            onClick={onBulkUpload}
            className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-700 hover:bg-green-100 transition-all w-full md:w-auto justify-center"
          >
            엑셀 대량등록
          </button>
          <button
            onClick={onVolumeUpload}
            className="flex items-center gap-2 rounded-lg border border-purple-300 bg-purple-50 px-4 py-2.5 text-sm font-medium text-purple-700 hover:bg-purple-100 transition-all w-full md:w-auto justify-center"
          >
            물동량 업로드
          </button>
          <button
            onClick={onAddProduct}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-all shadow-sm hover:shadow-md active:scale-95 w-full md:w-auto justify-center"
          >
            <span className="w-5 h-5 flex items-center justify-center text-lg leading-none">+</span>
            제품 추가
          </button>
        </div>
      </div>
    </div>
  );
}
