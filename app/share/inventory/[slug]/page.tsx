'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  formatClientApiErrorMessage,
  getPermissionErrorMessage,
  isForbiddenError,
  isUnauthenticatedError,
  toClientApiError,
  unwrapApiData,
} from '@/lib/api/client';

type ShareMeta = {
  date_from?: string | null;
  date_to?: string | null;
  expires_at?: string | null;
};

type SharedRow = {
  sheet_name?: string | null;
  record_date?: string | null;
  row_no?: number | null;
  item_name?: string | null;
  opening_stock_raw?: string | null;
  closing_stock_raw?: string | null;
  raw_data?: Record<string, unknown>;
  header_order?: string[];
};

type SharePagination = {
  mode?: 'cursor' | 'legacy';
  cursor?: number;
  limit?: number;
  nextCursor?: number | null;
  hasMore?: boolean;
  returnedRows?: number;
  truncated?: boolean;
};

export default function InventorySharePage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [rows, setRows] = useState<SharedRow[]>([]);
  const [shareMeta, setShareMeta] = useState<ShareMeta | null>(null);
  const [pagination, setPagination] = useState<SharePagination | null>(null);

  const getUiErrorMessage = useCallback((status: number, payload: unknown, fallback: string) => {
    const apiError = toClientApiError(status, payload, fallback);
    if (isUnauthenticatedError(apiError) || isForbiddenError(apiError)) {
      return getPermissionErrorMessage(apiError);
    }
    return formatClientApiErrorMessage(apiError, fallback);
  }, []);

  const loadShare = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        slug,
        limit: '300',
        cursor: '0',
      });
      const res = await fetch(`/api/share/inventory?${params.toString()}`);
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(getUiErrorMessage(res.status, payload, '공유 데이터를 불러오지 못했습니다.'));
      const data = unwrapApiData<any>(payload);
      if (data.requiresPassword) {
        setRequiresPassword(true);
        setShareMeta(data.share || null);
        setPagination(null);
      } else {
        setRequiresPassword(false);
        setRows((data.rows || []) as SharedRow[]);
        setShareMeta((data.share || null) as ShareMeta | null);
        setPagination((data.pagination || null) as SharePagination | null);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '공유 데이터를 불러오지 못했습니다.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [getUiErrorMessage, slug]);

  useEffect(() => {
    if (slug) {
      void loadShare();
    }
  }, [slug, loadShare]);

  const handleVerify = async () => {
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch('/api/share/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, password, limit: 300, cursor: 0 }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(getUiErrorMessage(res.status, payload, '비밀번호 확인 실패'));
      const data = unwrapApiData<any>(payload);
      setRows((data.rows || []) as SharedRow[]);
      setShareMeta((data.share || null) as ShareMeta | null);
      setPagination((data.pagination || null) as SharePagination | null);
      setRequiresPassword(false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '비밀번호 확인 실패';
      setError(message);
    } finally {
      setVerifying(false);
    }
  };

  const headerOrder = useMemo(() => {
    const first = rows.find((r) => Array.isArray(r.header_order) && r.header_order.length > 0);
    if (first?.header_order) return first.header_order;
    const raw = rows.find((r) => r.raw_data)?.raw_data || {};
    return Object.keys(raw);
  }, [rows]);

  const topRows = useMemo(() => rows.slice(0, 300), [rows]);

  const handleDownload = () => {
    void (async () => {
      try {
        const response = await fetch('/api/share/inventory/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, password }),
        });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || '다운로드에 실패했습니다.');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `inventory_shared_${slug}.xlsx`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : '다운로드에 실패했습니다.';
        setError(message);
      }
    })();
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">로딩 중...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-600">{error}</div>;
  }

  if (requiresPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-sm bg-white border rounded-xl shadow-sm p-6 space-y-4">
          <h1 className="text-lg font-bold text-gray-900">물동량 공유 데이터</h1>
          <p className="text-sm text-gray-500">이 링크는 비밀번호 보호 중입니다.</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleVerify}
            disabled={verifying}
            className="w-full rounded-lg bg-blue-600 text-white py-2 text-sm font-semibold disabled:opacity-60"
          >
            {verifying ? '확인 중...' : '열기'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">YBK 물동량 공유</h1>
            <p className="text-sm text-gray-500">
              기간: {shareMeta?.date_from || '전체'} ~ {shareMeta?.date_to || '전체'}
              {shareMeta?.expires_at ? ` / 만료: ${new Date(shareMeta.expires_at).toLocaleString()}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownload}
            className="rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm text-indigo-700 hover:bg-indigo-100"
          >
            엑셀 다운로드
          </button>
        </div>

        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b text-sm font-semibold text-gray-800">
            데이터 미리보기 (최대 300행)
          </div>
          {pagination?.hasMore && (
            <div className="px-4 py-2 border-b bg-amber-50 text-xs text-amber-800">
              대량 데이터 보호를 위해 미리보기 {pagination.returnedRows || rows.length}행만 조회했습니다. 전체 데이터는 엑셀 다운로드를 이용해 주세요.
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">시트</th>
                  <th className="px-3 py-2 text-left">일자</th>
                  <th className="px-3 py-2 text-left">행</th>
                  <th className="px-3 py-2 text-left">관리명</th>
                  <th className="px-3 py-2 text-right">전영재고</th>
                  <th className="px-3 py-2 text-right">마감재고</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {topRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-gray-400">
                      데이터 없음
                    </td>
                  </tr>
                ) : (
                  topRows.map((row, idx) => (
                    <tr key={`${row.sheet_name}-${row.row_no}-${idx}`}>
                      <td className="px-3 py-2">{row.sheet_name || '-'}</td>
                      <td className="px-3 py-2">{row.record_date || '-'}</td>
                      <td className="px-3 py-2">{row.row_no || '-'}</td>
                      <td className="px-3 py-2">{row.item_name || '-'}</td>
                      <td className="px-3 py-2 text-right">{row.opening_stock_raw || '-'}</td>
                      <td className="px-3 py-2 text-right">{row.closing_stock_raw || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {headerOrder.length > 0 && (
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm font-semibold text-gray-800 mb-2">원본 헤더 순서</p>
            <p className="text-xs text-gray-600 break-all">{headerOrder.join(' | ')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
