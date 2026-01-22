'use client';

import { useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

type SearchType = 'shipment' | 'outbound' | 'inbound';

interface StatusItem {
  id?: string;
  status?: string;
  productName?: string;
  quantity?: number;
  unit?: string;
  location?: string;
  outboundDate?: string;
  inboundDate?: string;
  createdAt?: string;
  trackingNo?: string;
  logisticsCompany?: string;
}

export default function StatusSyncTab() {
  const [searchType, setSearchType] = useState<SearchType>('shipment');
  const [searchValue, setSearchValue] = useState('');
  const [results, setResults] = useState<StatusItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchValue.trim()) {
      setError('조회할 번호를 입력하세요.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/cs/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: searchType,
          params:
            searchType === 'shipment'
              ? { orderNo: searchValue, trackingNo: searchValue }
              : searchType === 'outbound'
              ? { orderNo: searchValue, productName: searchValue }
              : { asnNo: searchValue, productName: searchValue },
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: '조회에 실패했습니다.' }));
        throw new Error(data.error || '조회에 실패했습니다.');
      }

      const data = await response.json();
      const items = data?.items ?? [];
      setResults(items);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? '조회 중 오류가 발생했습니다.');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderRows = () => {
    if (results.length === 0) {
      return (
        <tr>
          <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
            {isLoading ? '조회 중...' : '검색 결과가 없습니다'}
          </td>
        </tr>
      );
    }

    return results.map((result, idx) => (
      <tr key={result.id ?? idx} className="hover:bg-gray-50">
        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{result.id ?? '-'}</td>
        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{result.status ?? '-'}</td>
        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{result.productName ?? result.trackingNo ?? '-'}</td>
        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
          {result.quantity ? `${result.quantity}${result.unit ?? ''}` : result.logisticsCompany ?? '-'}
        </td>
        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
          {result.outboundDate || result.inboundDate || result.createdAt || '-'}
        </td>
      </tr>
    ));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">상태 조회</h3>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}
        
        {/* 검색 입력 */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <select
            value={searchType}
            onChange={(e) => {
              setSearchType(e.target.value as SearchType);
              setResults([]);
              setError(null);
            }}
            className="rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="shipment">배송/운송장</option>
            <option value="outbound">출고</option>
            <option value="inbound">입고</option>
          </select>
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSearch()}
            placeholder="주문/운송장/SKU/ASN을 입력하세요"
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSearch}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            disabled={isLoading}
          >
            <MagnifyingGlassIcon className="h-5 w-5" />
            {isLoading ? '조회 중...' : '조회'}
          </button>
        </div>

        {/* 결과 테이블 */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID/번호</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">항목</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">수량/정보</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">일자</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">{renderRows()}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

