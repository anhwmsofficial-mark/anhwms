'use client';

import { useState, useEffect } from 'react';
import {
  DocumentTextIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  XMarkIcon,
  CheckIcon,
  ClockIcon,
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  CalendarIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import { ExternalQuoteInquiry, QuoteInquiryStatus } from '@/types';

const STATUS_LABELS: Record<QuoteInquiryStatus, string> = {
  new: '신규',
  in_progress: '진행중',
  quoted: '견적 제공',
  closed_won: '수주',
  closed_lost: '미수주',
};

const STATUS_COLORS: Record<QuoteInquiryStatus, string> = {
  new: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  quoted: 'bg-purple-100 text-purple-800',
  closed_won: 'bg-green-100 text-green-800',
  closed_lost: 'bg-gray-100 text-gray-800',
};

const MONTHLY_RANGE_LABELS: Record<string, string> = {
  '0_1000': '1,000건 미만',
  '1000_2000': '1,000 ~ 2,000건',
  '2000_3000': '2,000 ~ 3,000건',
  '3000_5000': '3,000 ~ 5,000건',
  '5000_10000': '5,000 ~ 10,000건',
  '10000_30000': '10,000 ~ 30,000건',
  '30000_plus': '30,000건 이상',
};

export default function QuoteInquiriesPage() {
  const [inquiries, setInquiries] = useState<ExternalQuoteInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<QuoteInquiryStatus | 'ALL'>('ALL');
  const [selectedInquiry, setSelectedInquiry] = useState<ExternalQuoteInquiry | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  useEffect(() => {
    fetchInquiries();
  }, [selectedStatus]);

  const fetchInquiries = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (selectedStatus !== 'ALL') {
        params.append('status', selectedStatus);
      }

      const response = await fetch(`/api/admin/quote-inquiries?${params}`);
      const result = await response.json();

      if (response.ok) {
        setInquiries(result.data || []);
      } else {
        console.error('Failed to fetch inquiries:', result.error);
      }
    } catch (error) {
      console.error('Error fetching inquiries:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateInquiryStatus = async (id: string, status: QuoteInquiryStatus) => {
    try {
      const response = await fetch(`/api/admin/quote-inquiries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        await fetchInquiries();
        if (selectedInquiry?.id === id) {
          const updatedInquiry = { ...selectedInquiry, status };
          setSelectedInquiry(updatedInquiry);
        }
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const filteredInquiries = inquiries.filter((inquiry) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      inquiry.companyName.toLowerCase().includes(searchLower) ||
      inquiry.contactName.toLowerCase().includes(searchLower) ||
      inquiry.email.toLowerCase().includes(searchLower) ||
      inquiry.phone?.toLowerCase().includes(searchLower)
    );
  });

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <DocumentTextIcon className="h-8 w-8 text-blue-600" />
                견적 문의 관리
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                웹 폼으로 접수된 풀필먼트 견적 문의 현황
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {/* 통계 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
              {(['new', 'in_progress', 'quoted', 'closed_won', 'closed_lost'] as QuoteInquiryStatus[]).map(
                (status) => (
                  <div key={status} className="bg-white p-6 rounded-lg shadow">
                    <div className="text-center">
                      <p className="text-sm text-gray-600 mb-2">{STATUS_LABELS[status]}</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {inquiries.filter((i) => i.status === status).length}
                      </p>
                    </div>
                  </div>
                ),
              )}
            </div>

            {/* 필터 & 검색 */}
            <div className="bg-white p-6 rounded-lg shadow mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 검색 */}
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="회사명, 담당자, 이메일, 연락처 검색"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* 상태 필터 */}
                <div className="relative">
                  <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value as QuoteInquiryStatus | 'ALL')}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  >
                    <option value="ALL">전체 상태</option>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 테이블 */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        상태
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        회사명
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        담당자
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        연락처
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        월 출고량
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        요청일
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        액션
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredInquiries.length > 0 ? (
                      filteredInquiries.map((inquiry) => (
                        <tr key={inquiry.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                STATUS_COLORS[inquiry.status]
                              }`}
                            >
                              {STATUS_LABELS[inquiry.status]}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {inquiry.companyName}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{inquiry.contactName}</div>
                            <div className="text-sm text-gray-500">{inquiry.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {inquiry.phone || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {MONTHLY_RANGE_LABELS[inquiry.monthlyOutboundRange]}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(inquiry.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button
                              onClick={() => {
                                setSelectedInquiry(inquiry);
                                setIsDetailOpen(true);
                              }}
                              className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                            >
                              <EyeIcon className="h-4 w-4" />
                              상세
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                          검색 결과가 없습니다
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 상세 모달 */}
      {isDetailOpen && selectedInquiry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* 모달 헤더 */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-gray-900">견적 문의 상세</h3>
              <button
                onClick={() => setIsDetailOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* 모달 컨텐츠 */}
            <div className="p-6 space-y-6">
              {/* 상태 변경 */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  상태 변경
                </label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => updateInquiryStatus(selectedInquiry.id, value as QuoteInquiryStatus)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                        selectedInquiry.status === value
                          ? STATUS_COLORS[value as QuoteInquiryStatus]
                          : 'bg-white text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 기본 정보 */}
              <div>
                <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <UserIcon className="h-5 w-5 text-blue-600" />
                  기본 정보
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">회사명</p>
                    <p className="text-base font-semibold text-gray-900">
                      {selectedInquiry.companyName}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">담당자명</p>
                    <p className="text-base font-semibold text-gray-900">
                      {selectedInquiry.contactName}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">이메일</p>
                    <p className="text-base text-gray-900">{selectedInquiry.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">연락처</p>
                    <p className="text-base text-gray-900">{selectedInquiry.phone || '-'}</p>
                  </div>
                </div>
              </div>

              {/* 물량 정보 */}
              <div>
                <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <ChatBubbleLeftRightIcon className="h-5 w-5 text-blue-600" />
                  물량 및 상품 정보
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">월 출고량</p>
                    <p className="text-base font-semibold text-gray-900">
                      {MONTHLY_RANGE_LABELS[selectedInquiry.monthlyOutboundRange]}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">SKU 수량</p>
                    <p className="text-base font-semibold text-gray-900">
                      {selectedInquiry.skuCount || '-'}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-gray-600 mb-2">상품군</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedInquiry.productCategories.length > 0 ? (
                        selectedInquiry.productCategories.map((cat, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                          >
                            {cat}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-500">없음</span>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-gray-600 mb-2">추가 작업</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedInquiry.extraServices.length > 0 ? (
                        selectedInquiry.extraServices.map((svc, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                          >
                            {svc}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-500">없음</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 추가 메모 */}
              {selectedInquiry.memo && (
                <div>
                  <h4 className="text-lg font-bold text-gray-900 mb-4">추가 메모</h4>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedInquiry.memo}</p>
                  </div>
                </div>
              )}

              {/* 메타 정보 */}
              <div className="border-t pt-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">요청 일시</p>
                    <p className="text-gray-900 font-medium">
                      {formatDate(selectedInquiry.createdAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">유입 경로</p>
                    <p className="text-gray-900 font-medium">{selectedInquiry.source || '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

