'use client';

import { useState } from 'react';
import {
  TagIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  GlobeAltIcon,
  CheckCircleIcon,
  XCircleIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import { Brand } from '@/types/extended';
import Link from 'next/link';

// 샘플 데이터 (현재 사용 안 함 - API에서 로드)
const SAMPLE_BRANDS: Brand[] = [];

export default function AdminBrandsPage() {
  const [brands] = useState<Brand[]>(SAMPLE_BRANDS);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // 필터링
  const filteredBrands = brands.filter(brand => {
    const matchesSearch = 
      brand.nameKo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      brand.nameEn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      brand.code.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = selectedStatus === 'ALL' || brand.status === selectedStatus;
    
    return matchesSearch && matchesStatus;
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
                <span>브랜드 관리</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <TagIcon className="h-8 w-8 text-purple-600" />
                브랜드 관리
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                고객사가 운영하는 브랜드 마스터 관리
              </p>
            </div>
            <button
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
            >
              <PlusIcon className="h-5 w-5" />
              신규 브랜드 등록
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
                <p className="text-sm text-gray-600">전체 브랜드</p>
                <p className="text-3xl font-bold text-gray-900">{brands.length}</p>
              </div>
              <TagIcon className="h-12 w-12 text-purple-600" />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">활성 브랜드</p>
                <p className="text-3xl font-bold text-green-600">
                  {brands.filter(b => b.status === 'ACTIVE').length}
                </p>
              </div>
              <CheckCircleIcon className="h-12 w-12 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">기본 브랜드</p>
                <p className="text-3xl font-bold text-blue-600">
                  {brands.filter(b => b.isDefaultBrand).length}
                </p>
              </div>
              <StarIcon className="h-12 w-12 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">글로벌 브랜드</p>
                <p className="text-3xl font-bold text-indigo-600">
                  {brands.filter(b => b.nameEn || b.nameZh).length}
                </p>
              </div>
              <GlobeAltIcon className="h-12 w-12 text-indigo-600" />
            </div>
          </div>
        </div>

        {/* 필터 & 검색 */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 검색 */}
            <div className="md:col-span-2">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="브랜드명, 코드 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>

            {/* 상태 필터 */}
            <div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="ALL">전체 상태</option>
                <option value="ACTIVE">활성</option>
                <option value="INACTIVE">비활성</option>
              </select>
            </div>
          </div>
        </div>

        {/* 브랜드 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBrands.map((brand) => (
            <div key={brand.id} className="bg-white rounded-lg shadow hover:shadow-lg transition">
              {/* 카드 헤더 */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">
                        {brand.nameKo || brand.nameEn}
                      </h3>
                      {brand.isDefaultBrand && (
                        <StarIcon className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500">코드: {brand.code}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="text-purple-600 hover:text-purple-900 transition"
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

                {/* 다국어 이름 */}
                {(brand.nameEn || brand.nameZh) && (
                  <div className="space-y-1 mb-4">
                    {brand.nameEn && (
                      <p className="text-sm text-gray-600">
                        🇺🇸 {brand.nameEn}
                      </p>
                    )}
                    {brand.nameZh && (
                      <p className="text-sm text-gray-600">
                        🇨🇳 {brand.nameZh}
                      </p>
                    )}
                  </div>
                )}

                {/* 설명 */}
                {brand.description && (
                  <p className="text-sm text-gray-600 mb-4">
                    {brand.description}
                  </p>
                )}

                {/* 웹사이트 */}
                {brand.websiteUrl && (
                  <a
                    href={brand.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <GlobeAltIcon className="h-4 w-4" />
                    {brand.websiteUrl}
                  </a>
                )}
              </div>

              {/* 카드 바디 */}
              <div className="p-6">
                {/* 운영 설정 */}
                <div className="space-y-2 mb-4">
                  <h4 className="text-sm font-semibold text-gray-700">운영 설정</h4>
                  <div className="flex flex-wrap gap-2">
                    {brand.allowBackorder && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        백오더 허용
                      </span>
                    )}
                    {brand.autoAllocate && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                        자동 할당
                      </span>
                    )}
                    {brand.requireLotTracking && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                        로트 추적
                      </span>
                    )}
                  </div>
                </div>

                {/* 상태 */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">상태</span>
                  {brand.status === 'ACTIVE' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircleIcon className="h-4 w-4" />
                      활성
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      <XCircleIcon className="h-4 w-4" />
                      비활성
                    </span>
                  )}
                </div>
              </div>

              {/* 카드 푸터 */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>생성: {brand.createdAt.toLocaleDateString()}</span>
                  <span>수정: {brand.updatedAt.toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredBrands.length === 0 && (
          <div className="bg-white rounded-lg shadow text-center py-12">
            <TagIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">브랜드 없음</h3>
            <p className="mt-1 text-sm text-gray-500">
              검색 조건에 맞는 브랜드가 없습니다.
            </p>
          </div>
        )}

        {/* 페이지 정보 */}
        <div className="mt-6 text-sm text-gray-700">
          총 <span className="font-medium">{filteredBrands.length}</span>개 브랜드
        </div>
      </div>
    </div>
  );
}

