'use client';

import { useState } from 'react';
import {
  BuildingStorefrontIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';
import { Warehouse } from '@/types/extended';
import Link from 'next/link';

// 샘플 데이터 (현재 사용 안 함 - API에서 로드)
const SAMPLE_WAREHOUSES: Warehouse[] = [];

const TYPE_LABELS: Record<string, string> = {
  ANH_OWNED: 'ANH 소유',
  CLIENT_OWNED: '고객사 소유',
  PARTNER_OVERSEAS: '해외 파트너',
  RETURNS_CENTER: '반품센터',
};

const TYPE_COLORS: Record<string, string> = {
  ANH_OWNED: 'bg-blue-100 text-blue-800',
  CLIENT_OWNED: 'bg-purple-100 text-purple-800',
  PARTNER_OVERSEAS: 'bg-green-100 text-green-800',
  RETURNS_CENTER: 'bg-orange-100 text-orange-800',
};

export default function AdminWarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>(SAMPLE_WAREHOUSES);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // 필터링
  const filteredWarehouses = warehouses.filter(warehouse => {
    const matchesSearch = 
      warehouse.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      warehouse.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      warehouse.city?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = selectedType === 'ALL' || warehouse.type === selectedType;
    const matchesStatus = selectedStatus === 'ALL' || warehouse.status === selectedStatus;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <Link href="/admin" className="hover:text-blue-600">
                  관리자 모드
                </Link>
                <span>/</span>
                <span>창고 관리</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <BuildingStorefrontIcon className="h-8 w-8 text-green-600" />
                창고 관리
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                물류센터 및 반품센터 마스터 관리
              </p>
            </div>
            <button
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
            >
              <PlusIcon className="h-5 w-5" />
              신규 창고 등록
            </button>
          </div>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">전체 창고</p>
                <p className="text-3xl font-bold text-gray-900">{warehouses.length}</p>
              </div>
              <BuildingStorefrontIcon className="h-12 w-12 text-green-600" />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">활성 창고</p>
                <p className="text-3xl font-bold text-green-600">
                  {warehouses.filter(w => w.status === 'ACTIVE').length}
                </p>
              </div>
              <CheckCircleIcon className="h-12 w-12 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">ANH 소유</p>
                <p className="text-3xl font-bold text-blue-600">
                  {warehouses.filter(w => w.type === 'ANH_OWNED').length}
                </p>
              </div>
              <BuildingStorefrontIcon className="h-12 w-12 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">반품센터</p>
                <p className="text-3xl font-bold text-orange-600">
                  {warehouses.filter(w => w.isReturnsCenter).length}
                </p>
              </div>
              <TruckIcon className="h-12 w-12 text-orange-600" />
            </div>
          </div>
        </div>

        {/* 필터 & 검색 */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 검색 */}
            <div className="md:col-span-2">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="창고명, 코드, 도시 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
            </div>

            {/* 유형 필터 */}
            <div>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="ALL">전체 유형</option>
                {Object.entries(TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            {/* 상태 필터 */}
            <div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="ALL">전체 상태</option>
                <option value="ACTIVE">활성</option>
                <option value="INACTIVE">비활성</option>
                <option value="MAINTENANCE">점검중</option>
              </select>
            </div>
          </div>
        </div>

        {/* 창고 리스트 */}
        <div className="space-y-4">
          {filteredWarehouses.map((warehouse) => (
            <div key={warehouse.id} className="bg-white rounded-lg shadow hover:shadow-lg transition overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 p-6">
                {/* 기본 정보 */}
                <div className="lg:col-span-2">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-1">
                        {warehouse.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        코드: {warehouse.code}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="text-green-600 hover:text-green-900 transition"
                        title="수정"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      <button
                        className="text-red-600 hover:text-red-900 transition"
                        title="삭제"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  {/* 유형 */}
                  <div className="mb-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${TYPE_COLORS[warehouse.type]}`}>
                      {TYPE_LABELS[warehouse.type]}
                    </span>
                  </div>

                  {/* 주소 */}
                  <div className="flex items-start gap-2 text-sm text-gray-600">
                    <MapPinIcon className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p>{warehouse.addressLine1}</p>
                      {warehouse.addressLine2 && <p>{warehouse.addressLine2}</p>}
                      <p className="text-gray-500 mt-1">
                        {warehouse.city}, {warehouse.countryCode}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 운영 설정 */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">운영 설정</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {warehouse.allowInbound ? (
                        <CheckCircleIcon className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircleIcon className="h-5 w-5 text-red-500" />
                      )}
                      <span className="text-sm text-gray-700">입고 허용</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {warehouse.allowOutbound ? (
                        <CheckCircleIcon className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircleIcon className="h-5 w-5 text-red-500" />
                      )}
                      <span className="text-sm text-gray-700">출고 허용</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {warehouse.allowCrossDock ? (
                        <CheckCircleIcon className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircleIcon className="h-5 w-5 text-red-500" />
                      )}
                      <span className="text-sm text-gray-700">크로스독</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {warehouse.isReturnsCenter ? (
                        <CheckCircleIcon className="h-5 w-5 text-orange-500" />
                      ) : (
                        <XCircleIcon className="h-5 w-5 text-gray-300" />
                      )}
                      <span className="text-sm text-gray-700">반품센터</span>
                    </div>
                  </div>
                </div>

                {/* 운영 시간 */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">운영 시간</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <ClockIcon className="h-5 w-5 text-gray-400" />
                      <span>{warehouse.timezone}</span>
                    </div>
                    {warehouse.cutoffTime && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">당일 출고 마감:</span> {warehouse.cutoffTime}
                      </div>
                    )}
                  </div>
                </div>

                {/* 상태 */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">상태</h4>
                  {warehouse.status === 'ACTIVE' ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                      <CheckCircleIcon className="h-4 w-4" />
                      활성
                    </span>
                  ) : warehouse.status === 'MAINTENANCE' ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                      <ClockIcon className="h-4 w-4" />
                      점검중
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                      <XCircleIcon className="h-4 w-4" />
                      비활성
                    </span>
                  )}
                </div>
              </div>

              {/* 푸터 */}
              <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>생성: {warehouse.createdAt.toLocaleDateString()}</span>
                  <span>수정: {warehouse.updatedAt.toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredWarehouses.length === 0 && (
          <div className="bg-white rounded-lg shadow text-center py-12">
            <BuildingStorefrontIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">창고 없음</h3>
            <p className="mt-1 text-sm text-gray-500">
              검색 조건에 맞는 창고가 없습니다.
            </p>
          </div>
        )}

        {/* 페이지 정보 */}
        <div className="mt-6 text-sm text-gray-700">
          총 <span className="font-medium">{filteredWarehouses.length}</span>개 창고
        </div>
      </div>
    </div>
  );
}

