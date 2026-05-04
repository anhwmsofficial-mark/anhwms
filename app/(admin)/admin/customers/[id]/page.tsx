'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  BuildingOfficeIcon,
  UserGroupIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  ClockIcon,
  PlusIcon,
  ArrowLeftIcon,
  PhoneIcon,
  EnvelopeIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';
import InlineErrorAlert from '@/components/ui/inline-error-alert';
import {
  CustomerContact,
  CustomerContract,
  CustomerPricing,
  CustomerActivity,
} from '@/types';
import { getCustomerByIdAction } from '@/app/actions/admin/customers';
import {
  formatBrnDisplay,
  invoiceStatusLabel,
  legacyTypeToPartnerCategory,
  partnerCategoryLabel,
} from '@/lib/customers/schema';

type TabType = 'info' | 'contacts' | 'contracts' | 'pricing' | 'activities';

interface CustomerInfo {
  id: string;
  code: string;
  name: string;
  type: string;
  partnerCategory?: string | null;
  countryCode: string;
  businessRegNo?: string;
  ceoName?: string | null;
  addressLine1?: string | null;
  businessType?: string | null;
  businessItem?: string | null;
  taxInvoiceEmail?: string | null;
  settlementManagerName?: string | null;
  settlementManagerPhone?: string | null;
  settlementBasisMemo?: string | null;
  invoiceAvailableStatus?: string | null;
  billingCurrency: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  status: string;
}

type CustomerActionRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  partner_category?: string | null;
  country_code: string | null;
  business_reg_no?: string | null;
  ceo_name?: string | null;
  address_line1?: string | null;
  business_type?: string | null;
  business_item?: string | null;
  tax_invoice_email?: string | null;
  settlement_manager_name?: string | null;
  settlement_manager_phone?: string | null;
  settlement_basis_memo?: string | null;
  invoice_available_status?: string | null;
  billing_currency?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  status?: string | null;
};

const toCustomerInfo = (row: CustomerActionRow): CustomerInfo => ({
  id: row.id,
  code: row.code,
  name: row.name,
  type: row.type,
  partnerCategory: row.partner_category,
  countryCode: row.country_code || '-',
  businessRegNo: row.business_reg_no || undefined,
  ceoName: row.ceo_name,
  addressLine1: row.address_line1,
  businessType: row.business_type,
  businessItem: row.business_item,
  taxInvoiceEmail: row.tax_invoice_email,
  settlementManagerName: row.settlement_manager_name,
  settlementManagerPhone: row.settlement_manager_phone,
  settlementBasisMemo: row.settlement_basis_memo,
  invoiceAvailableStatus: row.invoice_available_status,
  billingCurrency: row.billing_currency || '-',
  contactName: row.contact_name || undefined,
  contactEmail: row.contact_email || undefined,
  contactPhone: row.contact_phone || undefined,
  status: row.status || 'INACTIVE',
});

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = String((params as Record<string, string | string[] | undefined> | null)?.id || '');

  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [contacts, setContacts] = useState<CustomerContact[]>([]);
  const [contracts, setContracts] = useState<CustomerContract[]>([]);
  const [pricings, setPricings] = useState<CustomerPricing[]>([]);
  const [activities, setActivities] = useState<CustomerActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomer = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getCustomerByIdAction(customerId);
      if (!result.ok) {
        setCustomer(null);
        setError(result.error || '거래처 정보를 불러오지 못했습니다.');
        return;
      }

      setCustomer(toCustomerInfo(result.data as CustomerActionRow));
    } catch (error) {
      console.error('Error fetching customer:', error);
      setCustomer(null);
      setError('거래처 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  const fetchContacts = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/customers/${customerId}/contacts`);
      const result = await response.json();
      if (response.ok) {
        setContacts(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
    }
  }, [customerId]);

  const fetchContracts = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/customers/${customerId}/contracts`);
      const result = await response.json();
      if (response.ok) {
        setContracts(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching contracts:', error);
    }
  }, [customerId]);

  const fetchPricing = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/customers/${customerId}/pricing`);
      const result = await response.json();
      if (response.ok) {
        setPricings(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching pricing:', error);
    }
  }, [customerId]);

  const fetchActivities = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/customers/${customerId}/activities`);
      const result = await response.json();
      if (response.ok) {
        setActivities(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
  }, [customerId]);

  // 데이터 로드
  useEffect(() => {
    fetchCustomer();
  }, [fetchCustomer]);

  useEffect(() => {
    if (activeTab === 'contacts') fetchContacts();
    if (activeTab === 'contracts') fetchContracts();
    if (activeTab === 'pricing') fetchPricing();
    if (activeTab === 'activities') fetchActivities();
  }, [activeTab, fetchActivities, fetchContacts, fetchContracts, fetchPricing]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <InlineErrorAlert
            error={error ? { message: error } : null}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          />
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'info' as TabType, name: '기본 정보', icon: BuildingOfficeIcon },
    { id: 'contacts' as TabType, name: '담당자', icon: UserGroupIcon },
    { id: 'contracts' as TabType, name: '계약', icon: DocumentTextIcon },
    { id: 'pricing' as TabType, name: '가격 정책', icon: CurrencyDollarIcon },
    { id: 'activities' as TabType, name: '활동 이력', icon: ClockIcon },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button
            onClick={() => router.push('/admin/customers')}
            className="mb-4 flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeftIcon className="w-5 h-5 mr-2" />
            목록으로 돌아가기
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{customer.name}</h1>
              <p className="mt-1 text-sm text-gray-500">거래처 코드: {customer.code}</p>
            </div>
            <div className="flex items-center space-x-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                customer.status === 'ACTIVE' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {customer.status === 'ACTIVE' ? '활성' : '비활성'}
              </span>
              <button
                onClick={() => router.push(`/admin/customers/${customerId}/edit`)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
              >
                <PencilIcon className="w-5 h-5 mr-2" />
                수정
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } flex items-center whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  <Icon className="w-5 h-5 mr-2" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <InlineErrorAlert
          error={error ? { message: error } : null}
          className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        />
        {activeTab === 'info' && <InfoTab customer={customer} />}
        {activeTab === 'contacts' && <ContactsTab contacts={contacts} customerId={customerId} onRefresh={fetchContacts} />}
        {activeTab === 'contracts' && <ContractsTab contracts={contracts} customerId={customerId} onRefresh={fetchContracts} />}
        {activeTab === 'pricing' && <PricingTab pricings={pricings} customerId={customerId} onRefresh={fetchPricing} />}
        {activeTab === 'activities' && <ActivitiesTab activities={activities} customerId={customerId} onRefresh={fetchActivities} />}
      </div>
    </div>
  );
}

// 기본 정보 탭
function InfoTab({ customer }: { customer: CustomerInfo }) {
  const pc =
    (customer.partnerCategory as keyof typeof partnerCategoryLabel) ||
    legacyTypeToPartnerCategory(customer.type);
  const inv = (customer.invoiceAvailableStatus || 'NEEDS_REVIEW') as keyof typeof invoiceStatusLabel;
  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">기본 정보</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">거래처 코드</label>
            <p className="text-gray-900">{customer.code}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">거래처명</label>
            <p className="text-gray-900">{customer.name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">거래처 유형</label>
            <p className="text-gray-900">{partnerCategoryLabel[pc] || customer.type}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">국가</label>
            <p className="text-gray-900">{customer.countryCode}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">결제 통화</label>
            <p className="text-gray-900">{customer.billingCurrency}</p>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">사업자 정보</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {customer.businessRegNo ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">사업자등록번호</label>
              <p className="text-gray-900 font-mono">{formatBrnDisplay(customer.businessRegNo)}</p>
            </div>
          ) : null}
          {customer.ceoName ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">대표자명</label>
              <p className="text-gray-900">{customer.ceoName}</p>
            </div>
          ) : null}
          {customer.addressLine1 ? (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">사업장 주소</label>
              <p className="text-gray-900">{customer.addressLine1}</p>
            </div>
          ) : null}
          {customer.businessType ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">업태</label>
              <p className="text-gray-900">{customer.businessType}</p>
            </div>
          ) : null}
          {customer.businessItem ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">종목</label>
              <p className="text-gray-900">{customer.businessItem}</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">세금계산서·정산</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">세금계산서 수신 이메일</label>
            <p className="text-gray-900 flex items-center">
              <EnvelopeIcon className="w-4 h-4 mr-2 text-gray-400" />
              {customer.taxInvoiceEmail || customer.contactEmail || '-'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">전자세금계산서 발행</label>
            <p className="text-gray-900">{invoiceStatusLabel[inv] || invoiceStatusLabel.NEEDS_REVIEW}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">정산 담당자</label>
            <p className="text-gray-900">{customer.settlementManagerName || customer.contactName || '-'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">정산 담당 연락처</label>
            <p className="text-gray-900 flex items-center">
              <PhoneIcon className="w-4 h-4 mr-2 text-gray-400" />
              {customer.settlementManagerPhone || customer.contactPhone || '-'}
            </p>
          </div>
          {customer.settlementBasisMemo ? (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">정산 기준 메모</label>
              <p className="text-gray-900 whitespace-pre-wrap">{customer.settlementBasisMemo}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// 담당자 탭
function ContactsTab({ 
  contacts, 
  customerId: _customerId, 
  onRefresh: _onRefresh 
}: { 
  contacts: CustomerContact[]; 
  customerId: string; 
  onRefresh: () => void;
}) {
  void _customerId;
  void _onRefresh;
  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">담당자 목록</h2>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center">
          <PlusIcon className="w-5 h-5 mr-2" />
          담당자 추가
        </button>
      </div>

      {contacts.length === 0 ? (
        <p className="text-gray-500 text-center py-8">등록된 담당자가 없습니다.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {contacts.map((contact) => (
            <div key={contact.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-gray-900">{contact.name}</h3>
                  {contact.title && <p className="text-sm text-gray-500">{contact.title}</p>}
                </div>
                {contact.isPrimary && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">주 담당자</span>
                )}
              </div>
              
              <div className="mt-3 space-y-1">
                {contact.email && (
                  <p className="text-sm text-gray-600 flex items-center">
                    <EnvelopeIcon className="w-4 h-4 mr-2" />
                    {contact.email}
                  </p>
                )}
                {contact.phone && (
                  <p className="text-sm text-gray-600 flex items-center">
                    <PhoneIcon className="w-4 h-4 mr-2" />
                    {contact.phone}
                  </p>
                )}
              </div>

              <div className="mt-3">
                <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">{contact.role}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 계약 탭
function ContractsTab({ 
  contracts, 
  customerId: _customerId, 
  onRefresh: _onRefresh 
}: { 
  contracts: CustomerContract[]; 
  customerId: string; 
  onRefresh: () => void;
}) {
  void _customerId;
  void _onRefresh;
  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">계약 목록</h2>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center">
          <PlusIcon className="w-5 h-5 mr-2" />
          계약 추가
        </button>
      </div>

      {contracts.length === 0 ? (
        <p className="text-gray-500 text-center py-8">등록된 계약이 없습니다.</p>
      ) : (
        <div className="space-y-4">
          {contracts.map((contract) => (
            <div key={contract.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-gray-900">{contract.contractName}</h3>
                  <p className="text-sm text-gray-500">{contract.contractNo}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  contract.status === 'ACTIVE' 
                    ? 'bg-green-100 text-green-800' 
                    : contract.status === 'EXPIRING_SOON'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {contract.status}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">계약 유형:</span>
                  <span className="ml-2 text-gray-900">{contract.contractType}</span>
                </div>
                <div>
                  <span className="text-gray-500">계약 금액:</span>
                  <span className="ml-2 text-gray-900">
                    {contract.contractAmount?.toLocaleString()} {contract.currency}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">계약 시작:</span>
                  <span className="ml-2 text-gray-900">
                    {new Date(contract.contractStart).toLocaleDateString()}
                  </span>
                </div>
                {contract.contractEnd && (
                  <div>
                    <span className="text-gray-500">계약 종료:</span>
                    <span className="ml-2 text-gray-900">
                      {new Date(contract.contractEnd).toLocaleDateString()}
                      {contract.isExpiringSoon && (
                        <span className="ml-2 text-yellow-600 text-xs">
                          (D-{contract.daysUntilExpiry})
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 가격 정책 탭
function PricingTab({ 
  pricings, 
  customerId: _customerId, 
  onRefresh: _onRefresh 
}: { 
  pricings: CustomerPricing[]; 
  customerId: string; 
  onRefresh: () => void;
}) {
  void _customerId;
  void _onRefresh;
  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">가격 정책 목록</h2>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center">
          <PlusIcon className="w-5 h-5 mr-2" />
          가격 정책 추가
        </button>
      </div>

      {pricings.length === 0 ? (
        <p className="text-gray-500 text-center py-8">등록된 가격 정책이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  서비스 유형
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  단가
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  단위
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  유효기간
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pricings.map((pricing) => (
                <tr key={pricing.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{pricing.pricingType}</div>
                    {pricing.serviceName && (
                      <div className="text-sm text-gray-500">{pricing.serviceName}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {pricing.unitPrice.toLocaleString()} {pricing.currency}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {pricing.unit}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(pricing.effectiveFrom).toLocaleDateString()} ~
                    {pricing.effectiveTo ? new Date(pricing.effectiveTo).toLocaleDateString() : '무기한'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      pricing.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {pricing.isActive ? '활성' : '비활성'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// 활동 이력 탭
function ActivitiesTab({ 
  activities, 
  customerId: _customerId, 
  onRefresh: _onRefresh 
}: { 
  activities: CustomerActivity[]; 
  customerId: string; 
  onRefresh: () => void;
}) {
  void _customerId;
  void _onRefresh;
  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">활동 이력</h2>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center">
          <PlusIcon className="w-5 h-5 mr-2" />
          활동 기록 추가
        </button>
      </div>

      {activities.length === 0 ? (
        <p className="text-gray-500 text-center py-8">기록된 활동이 없습니다.</p>
      ) : (
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="border-l-4 border-blue-500 pl-4 py-2">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                      {activity.activityType}
                    </span>
                    {activity.priority !== 'NORMAL' && (
                      <span className={`px-2 py-1 text-xs rounded ${
                        activity.priority === 'URGENT' 
                          ? 'bg-red-100 text-red-800'
                          : activity.priority === 'HIGH'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {activity.priority}
                      </span>
                    )}
                  </div>
                  
                  <h3 className="font-semibold text-gray-900">{activity.subject}</h3>
                  
                  {activity.description && (
                    <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
                  )}

                  {activity.requiresFollowup && !activity.followupCompleted && (
                    <div className="mt-2 flex items-center text-sm text-orange-600">
                      <ClockIcon className="w-4 h-4 mr-1" />
                      팔로업 필요
                      {activity.followupDueDate && (
                        <span className="ml-2">
                          (기한: {new Date(activity.followupDueDate).toLocaleDateString()})
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="text-right text-sm text-gray-500">
                  <div>{new Date(activity.activityDate).toLocaleDateString()}</div>
                  {activity.performedByUser && (
                    <div className="text-xs">{activity.performedByUser.username}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

