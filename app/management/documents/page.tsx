'use client';

import { useState } from 'react';
import {
  DocumentTextIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';

interface Document {
  id: string;
  type: 'asn' | 'order';
  documentNo: string;
  partner: string;
  product: string;
  quantity: number;
  unit: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  date: Date;
  note?: string;
}

const SAMPLE_DOCUMENTS: Document[] = [
  {
    id: 'ASN001',
    type: 'asn',
    documentNo: 'ASN-2025-001',
    partner: '테크 공급업체',
    product: '노트북 A',
    quantity: 50,
    unit: '개',
    status: 'completed',
    date: new Date('2025-01-10'),
  },
  {
    id: 'ASN002',
    type: 'asn',
    documentNo: 'ASN-2025-002',
    partner: '테크 공급업체',
    product: '무선 마우스',
    quantity: 100,
    unit: '개',
    status: 'processing',
    date: new Date('2025-01-12'),
  },
  {
    id: 'ASN003',
    type: 'asn',
    documentNo: 'ASN-2025-003',
    partner: '테크 공급업체',
    product: '키보드',
    quantity: 30,
    unit: '개',
    status: 'pending',
    date: new Date('2025-01-15'),
    note: '입고 예정일 확인 필요',
  },
  {
    id: 'ORD001',
    type: 'order',
    documentNo: 'ORD-2025-001',
    partner: 'ABC 전자',
    product: '노트북 A',
    quantity: 10,
    unit: '개',
    status: 'completed',
    date: new Date('2025-01-11'),
  },
  {
    id: 'ORD002',
    type: 'order',
    documentNo: 'ORD-2025-002',
    partner: 'ABC 전자',
    product: '무선 마우스',
    quantity: 25,
    unit: '개',
    status: 'processing',
    date: new Date('2025-01-12'),
  },
  {
    id: 'ORD003',
    type: 'order',
    documentNo: 'ORD-2025-003',
    partner: 'XYZ 유통',
    product: 'USB 케이블',
    quantity: 50,
    unit: '개',
    status: 'pending',
    date: new Date('2025-01-13'),
  },
];

export default function DocumentsPage() {
  const [documents] = useState<Document[]>(SAMPLE_DOCUMENTS);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'asn' | 'order'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // 필터링
  const filteredDocuments = documents.filter((doc) => {
    const matchSearch =
      searchTerm === '' ||
      doc.documentNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.partner.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.product.toLowerCase().includes(searchTerm.toLowerCase());

    const matchType = filterType === 'all' || doc.type === filterType;
    const matchStatus = filterStatus === 'all' || doc.status === filterStatus;

    return matchSearch && matchType && matchStatus;
  });

  // 통계
  const stats = {
    asn: {
      total: documents.filter((d) => d.type === 'asn').length,
      pending: documents.filter((d) => d.type === 'asn' && d.status === 'pending').length,
      processing: documents.filter((d) => d.type === 'asn' && d.status === 'processing').length,
      completed: documents.filter((d) => d.type === 'asn' && d.status === 'completed').length,
    },
    order: {
      total: documents.filter((d) => d.type === 'order').length,
      pending: documents.filter((d) => d.type === 'order' && d.status === 'pending').length,
      processing: documents.filter((d) => d.type === 'order' && d.status === 'processing').length,
      completed: documents.filter((d) => d.type === 'order' && d.status === 'completed').length,
    },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">📄 문서 관리</h1>
              <p className="text-sm text-gray-600 mt-1">ASN (입고예정서) 및 출고 주문서 관리</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* 통계 카드 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold text-blue-600 mb-3 flex items-center gap-2">
              <ArrowDownTrayIcon className="h-5 w-5" />
              ASN (입고예정서)
            </h3>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <div className="text-xs text-gray-600">전체</div>
                <div className="text-xl font-bold text-gray-900">{stats.asn.total}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600">대기</div>
                <div className="text-xl font-bold text-yellow-600">{stats.asn.pending}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600">처리중</div>
                <div className="text-xl font-bold text-blue-600">{stats.asn.processing}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600">완료</div>
                <div className="text-xl font-bold text-green-600">{stats.asn.completed}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold text-green-600 mb-3 flex items-center gap-2">
              <ArrowUpTrayIcon className="h-5 w-5" />
              출고 주문서
            </h3>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <div className="text-xs text-gray-600">전체</div>
                <div className="text-xl font-bold text-gray-900">{stats.order.total}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600">대기</div>
                <div className="text-xl font-bold text-yellow-600">{stats.order.pending}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600">처리중</div>
                <div className="text-xl font-bold text-blue-600">{stats.order.processing}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600">완료</div>
                <div className="text-xl font-bold text-green-600">{stats.order.completed}</div>
              </div>
            </div>
          </div>
        </div>

        {/* 검색 및 필터 */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="문서번호, 거래처, 품목 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="all">전체 문서</option>
                <option value="asn">ASN (입고)</option>
                <option value="order">주문서 (출고)</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="all">전체 상태</option>
                <option value="pending">대기</option>
                <option value="processing">처리중</option>
                <option value="completed">완료</option>
                <option value="cancelled">취소</option>
              </select>
            </div>
          </div>
        </div>

        {/* 문서 목록 */}
        <div className="bg-white rounded-lg shadow">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    구분
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    문서번호
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    거래처
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    품목
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    수량
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    상태
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    일자
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    액션
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <TypeBadge type={doc.type} />
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{doc.documentNo}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{doc.partner}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{doc.product}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="font-semibold text-blue-600">
                        {doc.quantity}
                        {doc.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={doc.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {doc.date.toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-green-600 hover:text-green-800">
                        <EyeIcon className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: 'asn' | 'order' }) {
  const styles = {
    asn: 'bg-blue-100 text-blue-700',
    order: 'bg-green-100 text-green-700',
  };

  const labels = {
    asn: '📥 입고',
    order: '📤 출고',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[type]}`}>
      {labels[type]}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    processing: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-gray-100 text-gray-700',
  };

  const labels: Record<string, string> = {
    pending: '⏳ 대기',
    processing: '🔄 처리중',
    completed: '✅ 완료',
    cancelled: '❌ 취소',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

