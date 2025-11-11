'use client';

import { useState } from 'react';
import { DocumentArrowDownIcon, LinkIcon } from '@heroicons/react/24/outline';

type DocumentType = 'invoice' | 'packing_list' | 'outbound';

export default function DocumentsTab() {
  const [orderNo, setOrderNo] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType>('invoice');
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (type: DocumentType) => {
    if (!orderNo.trim()) {
      setError('주문번호를 입력하세요.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setDocumentUrl(null);
    setExpiresAt(null);

    try {
      const response = await fetch('/api/cs/document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderNo, documentType: type }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: '문서 생성에 실패했습니다.' }));
        throw new Error(data.error || '문서 생성에 실패했습니다.');
      }

      const data = await response.json();
      setDocumentUrl(data.url);
      setExpiresAt(data.expiresAt ?? null);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? '문서 생성 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">문서 센터</h3>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
          <div className="lg:col-span-2 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">주문번호</label>
              <input
                type="text"
                value={orderNo}
                onChange={(e) => setOrderNo(e.target.value)}
                placeholder="예: A2025-000001"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">문서 유형</label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value as DocumentType)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="invoice">인보이스</option>
                <option value="packing_list">패킹리스트</option>
                <option value="outbound">출고증</option>
              </select>
            </div>
            <button
              onClick={() => handleGenerate(documentType)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled={isLoading}
            >
              <DocumentArrowDownIcon className="h-5 w-5" />
              {isLoading ? '생성 중...' : '문서 링크 생성'}
            </button>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="border border-dashed border-gray-300 rounded-lg p-4 h-full flex flex-col justify-center items-center text-center">
              {documentUrl ? (
                <div>
                  <p className="text-sm text-gray-600 mb-2">문서 링크가 생성되었습니다.</p>
                  <a
                    href={documentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <LinkIcon className="h-5 w-5" />
                    문서 열기
                  </a>
                  {expiresAt && (
                    <p className="mt-2 text-xs text-gray-500">만료 예정: {expiresAt}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  주문번호와 문서 유형을 선택한 뒤 링크를 생성하세요.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

