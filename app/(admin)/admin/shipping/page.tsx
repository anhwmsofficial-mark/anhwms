'use client';

import { useState } from 'react';
import {
  TruckIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  GlobeAltIcon,
  CheckCircleIcon,
  XCircleIcon,
  CreditCardIcon,
} from '@heroicons/react/24/outline';
import { ShippingCarrier, ShippingAccount } from '@/types/extended';
import Link from 'next/link';

// 샘플 데이터 (현재 사용 안 함 - API에서 로드)
const SAMPLE_CARRIERS: ShippingCarrier[] = [];


const SAMPLE_ACCOUNTS: ShippingAccount[] = [];

export default function AdminShippingPage() {
  const [carriers, setCarriers] = useState<ShippingCarrier[]>(SAMPLE_CARRIERS);
  const [accounts, setAccounts] = useState<ShippingAccount[]>(SAMPLE_ACCOUNTS);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState<'carriers' | 'accounts'>('carriers');

  // 필터링 - 배송사
  const filteredCarriers = carriers.filter(carrier =>
    carrier.nameKo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    carrier.nameEn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    carrier.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 필터링 - 계정
  const filteredAccounts = accounts.filter(account =>
    account.accountCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.accountName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                <span>배송 관리</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <TruckIcon className="h-8 w-8 text-indigo-600" />
                배송 관리
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                배송사 마스터 및 배송 계정 관리
              </p>
            </div>
            <button
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
            >
              <PlusIcon className="h-5 w-5" />
              {selectedTab === 'carriers' ? '신규 배송사 등록' : '신규 계정 등록'}
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
                <p className="text-sm text-gray-600">전체 배송사</p>
                <p className="text-3xl font-bold text-gray-900">{carriers.length}</p>
              </div>
              <TruckIcon className="h-12 w-12 text-indigo-600" />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">국내 배송사</p>
                <p className="text-3xl font-bold text-blue-600">
                  {carriers.filter(c => c.isDomestic).length}
                </p>
              </div>
              <CheckCircleIcon className="h-12 w-12 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">국제 배송사</p>
                <p className="text-3xl font-bold text-green-600">
                  {carriers.filter(c => c.isInternational).length}
                </p>
              </div>
              <GlobeAltIcon className="h-12 w-12 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">배송 계정</p>
                <p className="text-3xl font-bold text-purple-600">{accounts.length}</p>
              </div>
              <CreditCardIcon className="h-12 w-12 text-purple-600" />
            </div>
          </div>
        </div>

        {/* 탭 & 검색 */}
        <div className="bg-white rounded-lg shadow mb-6">
          {/* 탭 */}
          <div className="border-b border-gray-200">
            <nav className="flex gap-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setSelectedTab('carriers')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  selectedTab === 'carriers'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                배송사 마스터
              </button>
              <button
                onClick={() => setSelectedTab('accounts')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  selectedTab === 'accounts'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                배송 계정
              </button>
            </nav>
          </div>

          {/* 검색 */}
          <div className="p-6">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder={selectedTab === 'carriers' ? '배송사명, 코드 검색...' : '계정 코드, 계정명 검색...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* 배송사 리스트 */}
        {selectedTab === 'carriers' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCarriers.map((carrier) => (
              <div key={carrier.id} className="bg-white rounded-lg shadow hover:shadow-lg transition">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-1">
                        {carrier.nameKo}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {carrier.nameEn} ({carrier.code})
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="text-indigo-600 hover:text-indigo-900 transition"
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

                  {/* 서비스 유형 */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {carrier.isDomestic && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        국내 배송
                      </span>
                    )}
                    {carrier.isInternational && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                        국제 배송
                      </span>
                    )}
                    <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">
                      {carrier.countryCode}
                    </span>
                  </div>

                  {/* 상태 */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <span className="text-sm text-gray-600">상태</span>
                    {carrier.status === 'ACTIVE' ? (
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
              </div>
            ))}
          </div>
        )}

        {/* 배송 계정 리스트 */}
        {selectedTab === 'accounts' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      계정 정보
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      배송사
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      소유
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      계약 요금
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      유효 기간
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      상태
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAccounts.map((account) => {
                    const carrier = carriers.find(c => c.id === account.carrierId);
                    return (
                      <tr key={account.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {account.accountName}
                          </div>
                          <div className="text-sm text-gray-500">
                            코드: {account.accountCode}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {carrier?.nameKo}
                          </div>
                          <div className="text-sm text-gray-500">
                            {carrier?.code}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {account.isAnhOwned ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              ANH 소유
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              고객사 소유
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {account.contractRate?.toLocaleString()} {account.rateCurrency}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {account.validFrom && new Date(account.validFrom).toLocaleDateString()}
                          </div>
                          <div className="text-sm text-gray-500">
                            ~ {account.validTo && new Date(account.validTo).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {account.status === 'ACTIVE' ? (
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
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              className="text-indigo-600 hover:text-indigo-900 transition"
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
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 빈 상태 */}
        {selectedTab === 'carriers' && filteredCarriers.length === 0 && (
          <div className="bg-white rounded-lg shadow text-center py-12">
            <TruckIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">배송사 없음</h3>
            <p className="mt-1 text-sm text-gray-500">
              검색 조건에 맞는 배송사가 없습니다.
            </p>
          </div>
        )}

        {selectedTab === 'accounts' && filteredAccounts.length === 0 && (
          <div className="bg-white rounded-lg shadow text-center py-12">
            <CreditCardIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">배송 계정 없음</h3>
            <p className="mt-1 text-sm text-gray-500">
              검색 조건에 맞는 배송 계정이 없습니다.
            </p>
          </div>
        )}

        {/* 페이지 정보 */}
        <div className="mt-6 text-sm text-gray-700">
          {selectedTab === 'carriers' ? (
            <span>총 <span className="font-medium">{filteredCarriers.length}</span>개 배송사</span>
          ) : (
            <span>총 <span className="font-medium">{filteredAccounts.length}</span>개 배송 계정</span>
          )}
        </div>
      </div>
    </div>
  );
}

