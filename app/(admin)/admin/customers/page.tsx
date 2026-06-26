'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { listCustomersAction, deactivateCustomerAction } from '@/app/actions/admin/customers';
import InlineErrorAlert from '@/components/ui/inline-error-alert';
import {
  partnerCategoryLabel,
  invoiceStatusLabel,
  domesticOverseasTypeLabel,
  legacyTypeToPartnerCategory,
  formatBrnDisplay,
  digitsOnlyBrn,
} from '@/lib/customers/schema';
import {
  BuildingOfficeIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  EnvelopeIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

interface CustomerMaster {
  id: string;
  code: string;
  name: string;
  type: string;
  partner_category?: string | null;
  country_code: string | null;
  business_reg_no?: string | null;
  ceo_name?: string | null;
  tax_invoice_email?: string | null;
  contact_email?: string | null;
  settlement_manager_name?: string | null;
  contact_name?: string | null;
  domestic_overseas_type?: string | null;
  service_type?: string | null;
  has_business_license_document?: boolean | null;
  has_bankbook_document?: boolean | null;
  has_contract_document?: boolean | null;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  contact_status?: string | null;
  invoice_available_status?: string | null;
  billing_currency: string | null;
  billing_cycle?: string | null;
  contact_phone?: string | null;
  status: string | null;
  created_at: string | null;
  brands?: any[];
}

const PARTNER_CAT_KEYS = ['CUSTOMER', 'SUPPLIER', 'CARRIER', 'OTHER'] as const;

const PARTNER_COLORS: Record<string, string> = {
  CUSTOMER: 'bg-blue-100 text-blue-800',
  SUPPLIER: 'bg-amber-100 text-amber-900',
  CARRIER: 'bg-indigo-100 text-indigo-800',
  OTHER: 'bg-gray-100 text-gray-800',
};

const INVOICE_COLORS: Record<string, string> = {
  AVAILABLE: 'bg-green-100 text-green-800',
  UNAVAILABLE: 'bg-red-100 text-red-800',
  NEEDS_REVIEW: 'bg-yellow-100 text-yellow-900',
};

function displayPartnerCategory(c: CustomerMaster): string {
  const pc = c.partner_category as keyof typeof partnerCategoryLabel | undefined;
  if (pc && partnerCategoryLabel[pc]) return partnerCategoryLabel[pc];
  const legacy = legacyTypeToPartnerCategory(c.type);
  return partnerCategoryLabel[legacy];
}

function taxEmail(c: CustomerMaster) {
  return c.tax_invoice_email || c.contact_email || '-';
}

function settlementLine(c: CustomerMaster) {
  return c.settlement_manager_name || c.contact_name || '-';
}

function yesNoBadge(value: boolean | null | undefined) {
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold ${
        value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
      }`}
    >
      {value ? '유' : '무'}
    </span>
  );
}

function contractPeriod(customer: CustomerMaster) {
  if (!customer.contract_start_date && !customer.contract_end_date) return '-';
  return `${customer.contract_start_date || '-'} ~ ${customer.contract_end_date || '-'}`;
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<CustomerMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPartnerCategory, setSelectedPartnerCategory] = useState<string>('ALL');
  const [selectedInvoiceStatus, setSelectedInvoiceStatus] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ACTIVE');

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await listCustomersAction({
        status: selectedStatus === 'ALL' ? '' : selectedStatus,
        partnerCategory: selectedPartnerCategory === 'ALL' ? '' : selectedPartnerCategory,
        invoiceStatus: selectedInvoiceStatus === 'ALL' ? '' : selectedInvoiceStatus,
        limit: 500,
      });

      if (result.ok) {
        setCustomers(((result.data.data || []) as unknown) as CustomerMaster[]);
      } else {
        console.error('Failed to fetch customers:', result.error);
        setCustomers([]);
        setError(result.error || '거래처 목록을 불러오지 못했습니다.');
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      setCustomers([]);
      setError('거래처 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, selectedPartnerCategory, selectedInvoiceStatus]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const q = searchTerm.trim().toLowerCase();
  const qDigits = digitsOnlyBrn(searchTerm);

  const filteredCustomers = customers.filter((customer) => {
    if (!q) return true;
    const hay = [
      customer.name,
      customer.code,
      customer.ceo_name,
      customer.tax_invoice_email,
      customer.contact_email,
      customer.business_reg_no,
      customer.service_type,
      customer.contact_status,
    ]
      .map((x) => String(x || '').toLowerCase())
      .join(' ');
    if (hay.includes(q)) return true;
    if (qDigits.length >= 3 && digitsOnlyBrn(String(customer.business_reg_no || '')).includes(qDigits)) return true;
    return false;
  });

  const handleDeactivate = async (id: string) => {
    if (!window.confirm('이 거래처를 비활성화할까요?')) return;
    const res = await deactivateCustomerAction(id);
    if (!res.ok) {
      setError(res.error || '비활성화에 실패했습니다.');
      return;
    }
    fetchCustomers();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <BuildingOfficeIcon className="h-8 w-8 text-blue-600" />
                거래처 관리
              </h1>
              <p className="text-sm text-gray-600 mt-1">거래처 기본·사업자·세금계산서 정보를 등록하고 관리합니다.</p>
            </div>
            <Link
              href="/admin/customers/new"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
            >
              <PlusIcon className="h-5 w-5" />
              신규 거래처 등록
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <InlineErrorAlert
          error={error ? { message: error } : null}
          className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        />

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">전체 거래처</p>
                  <p className="text-3xl font-bold text-gray-900">{customers.length}</p>
                </div>
                <BuildingOfficeIcon className="h-12 w-12 text-blue-600" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">활성</p>
                  <p className="text-3xl font-bold text-green-600">
                    {customers.filter((c) => c.status === 'ACTIVE').length}
                  </p>
                </div>
                <CheckCircleIcon className="h-12 w-12 text-green-600" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">고객사 유형</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {customers.filter((c) => (c.partner_category || legacyTypeToPartnerCategory(c.type)) === 'CUSTOMER')
                      .length}
                  </p>
                </div>
                <BuildingOfficeIcon className="h-12 w-12 text-blue-600" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">세금계산서 가능</p>
                  <p className="text-3xl font-bold text-emerald-600">
                    {customers.filter((c) => c.invoice_available_status === 'AVAILABLE').length}
                  </p>
                </div>
                <CheckCircleIcon className="h-12 w-12 text-emerald-600" />
              </div>
            </div>
          </div>
        )}

        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="거래처명, 코드, 사업자번호, 대표자명, 세금계산서 이메일…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <select
                value={selectedPartnerCategory}
                onChange={(e) => setSelectedPartnerCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ALL">전체 거래처 유형</option>
                {PARTNER_CAT_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {partnerCategoryLabel[k]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <select
                value={selectedInvoiceStatus}
                onChange={(e) => setSelectedInvoiceStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ALL">전자세금계산서 상태</option>
                <option value="AVAILABLE">{invoiceStatusLabel.AVAILABLE}</option>
                <option value="UNAVAILABLE">{invoiceStatusLabel.UNAVAILABLE}</option>
                <option value="NEEDS_REVIEW">{invoiceStatusLabel.NEEDS_REVIEW}</option>
              </select>
            </div>
            <div>
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
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

          <div className="mt-4 flex justify-end">
            <button
              onClick={fetchCustomers}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
            >
              <MagnifyingGlassIcon className="h-5 w-5" />
              조회
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">거래처명</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">국내외</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">구분</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">사업자번호</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">대표자</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">서비스형태</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">서류</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">계약기간</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">연락상태</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">상태</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">작업</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCustomers.map((customer) => {
                  const pcKey =
                    (customer.partner_category as keyof typeof partnerCategoryLabel) ||
                    legacyTypeToPartnerCategory(customer.type);
                  const inv = customer.invoice_available_status || 'NEEDS_REVIEW';
                  return (
                    <tr key={customer.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link href={`/admin/customers/${customer.id}`} className="text-sm font-medium text-blue-700 hover:underline">
                          {customer.name}
                        </Link>
                        <div className="text-xs text-gray-500">{customer.code}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {domesticOverseasTypeLabel[
                          (customer.domestic_overseas_type || 'DOMESTIC') as keyof typeof domesticOverseasTypeLabel
                        ] || '국내'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PARTNER_COLORS[pcKey] || 'bg-gray-100 text-gray-800'}`}
                        >
                          {displayPartnerCategory(customer)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800 font-mono">
                        {customer.business_reg_no ? formatBrnDisplay(customer.business_reg_no) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800">{customer.ceo_name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-800">{customer.service_type || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-800">
                        <div className="flex flex-col gap-1">
                          <span>사업자 {yesNoBadge(customer.has_business_license_document)}</span>
                          <span>통장 {yesNoBadge(customer.has_bankbook_document)}</span>
                          <span>계약 {yesNoBadge(customer.has_contract_document)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">{contractPeriod(customer)}</td>
                      <td className="px-4 py-3 text-sm text-gray-800">
                        <div>{customer.contact_status || '-'}</div>
                        <div className="text-xs text-gray-500">{settlementLine(customer)}</div>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {customer.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircleIcon className="h-4 w-4" />
                            활성
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <XCircleIcon className="h-4 w-4" />
                            비활성
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            href={`/admin/customers/${customer.id}/edit`}
                            className="text-blue-600 hover:text-blue-900 transition"
                            title="수정"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </Link>
                          <button
                            type="button"
                            className="text-red-600 hover:text-red-900 transition"
                            title="비활성화"
                            onClick={() => handleDeactivate(customer.id)}
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

          {filteredCustomers.length === 0 && (
            <div className="text-center py-12">
              <BuildingOfficeIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">거래처 없음</h3>
              <p className="mt-1 text-sm text-gray-500">조건에 맞는 거래처가 없습니다.</p>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            표시 <span className="font-medium">{filteredCustomers.length}</span>건 / 로드 {customers.length}건
          </div>
        </div>
      </div>
    </div>
  );
}
