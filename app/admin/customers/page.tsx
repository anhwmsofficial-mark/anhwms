'use client';

import { useState, useEffect } from 'react';
import {
  BuildingOfficeIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

interface CustomerMaster {
  id: string;
  code: string;
  name: string;
  type: string;
  country_code: string;
  business_reg_no?: string;
  billing_currency: string;
  billing_cycle?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  status: string;
  created_at: string;
  updated_at: string;
  brands?: any[];
}

const TYPE_LABELS: Record<string, string> = {
  DIRECT_BRAND: '직접 브랜드',
  AGENCY: '대행사',
  MULTI_BRAND: '멀티브랜드',
  FORWARDER: '포워더',
  LOGISTICS_PARTNER: '물류 파트너',
};

const TYPE_COLORS: Record<string, string> = {
  DIRECT_BRAND: 'bg-blue-100 text-blue-800',
  AGENCY: 'bg-purple-100 text-purple-800',
  MULTI_BRAND: 'bg-green-100 text-green-800',
  FORWARDER: 'bg-yellow-100 text-yellow-800',
  LOGISTICS_PARTNER: 'bg-gray-100 text-gray-800',
};

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<CustomerMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ACTIVE');

  // 데이터 로드
  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        status: selectedStatus === 'ALL' ? '' : selectedStatus,
        type: selectedType === 'ALL' ? '' : selectedType,
        search: searchTerm,
      });

      const response = await fetch(`/api/admin/customers?${params}`);
      const result = await response.json();

      if (response.ok) {
        setCustomers(result.data || []);
      } else {
        console.error('Failed to fetch customers:', result.error);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  // 필터링
  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = 
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.contact_email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <BuildingOfficeIcon className="h-8 w-8 text-blue-600" />
                고객사 관리
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                화주사, 브랜드사, 포워더 등 고객사 마스터 관리
              </p>
            </div>
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
            >
              <PlusIcon className="h-5 w-5" />
              신규 고객사 등록
            </button>
          </div>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 로딩 상태 */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {/* 통계 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">전체 고객사</p>
                    <p className="text-3xl font-bold text-gray-900">{customers.length}</p>
                  </div>
                  <BuildingOfficeIcon className="h-12 w-12 text-blue-600" />
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">활성 고객사</p>
                    <p className="text-3xl font-bold text-green-600">
                      {customers.filter(c => c.status === 'ACTIVE').length}
                    </p>
                  </div>
                  <CheckCircleIcon className="h-12 w-12 text-green-600" />
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">직접 브랜드</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {customers.filter(c => c.type === 'DIRECT_BRAND').length}
                    </p>
                  </div>
                  <BuildingOfficeIcon className="h-12 w-12 text-blue-600" />
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">멀티브랜드</p>
                    <p className="text-3xl font-bold text-purple-600">
                      {customers.filter(c => c.type === 'MULTI_BRAND').length}
                    </p>
                  </div>
                  <BuildingOfficeIcon className="h-12 w-12 text-purple-600" />
                </div>
              </div>
            </div>
          </>
        )}

        {/* 필터 & 검색 */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 검색 */}
            <div className="md:col-span-2">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="고객사명, 코드, 담당자, 이메일 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* 유형 필터 */}
            <div>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  fetchCustomers();
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ALL">전체 상태</option>
                <option value="ACTIVE">활성</option>
                <option value="INACTIVE">비활성</option>
                <option value="SUSPENDED">정지</option>
              </select>
            </div>
          </div>
          
          {/* 검색 버튼 */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={fetchCustomers}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
            >
              <MagnifyingGlassIcon className="h-5 w-5" />
              검색
            </button>
          </div>
        </div>

        {/* 고객사 리스트 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    고객사 정보
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    유형
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    연락처
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    주소
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    정산 조건
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
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {customer.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          코드: {customer.code}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[customer.type]}`}>
                        {TYPE_LABELS[customer.type]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 flex items-center gap-2">
                        <EnvelopeIcon className="h-4 w-4 text-gray-400" />
                        {customer.contact_email || '-'}
                      </div>
                      <div className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                        <PhoneIcon className="h-4 w-4 text-gray-400" />
                        {customer.contact_phone || '-'}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        담당: {customer.contact_name || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 flex items-start gap-2">
                        <MapPinIcon className="h-4 w-4 text-gray-400 mt-0.5" />
                        <span>{customer.country_code}</span>
                      </div>
                      {customer.business_reg_no && (
                        <div className="text-sm text-gray-500 mt-1">
                          사업자번호: {customer.business_reg_no}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {customer.billing_currency} / {customer.billing_cycle || 'MONTHLY'}
                      </div>
                      <div className="text-sm text-gray-500">
                        브랜드: {customer.brands?.[0]?.count || 0}개
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {customer.status === 'ACTIVE' ? (
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
                          className="text-blue-600 hover:text-blue-900 transition"
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
                ))}
              </tbody>
            </table>
          </div>

          {filteredCustomers.length === 0 && (
            <div className="text-center py-12">
              <BuildingOfficeIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">고객사 없음</h3>
              <p className="mt-1 text-sm text-gray-500">
                검색 조건에 맞는 고객사가 없습니다.
              </p>
            </div>
          )}
        </div>

        {/* 페이지네이션 (추후 구현) */}
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            총 <span className="font-medium">{filteredCustomers.length}</span>개 고객사
          </div>
        </div>
      </div>
    </div>
  );
}

