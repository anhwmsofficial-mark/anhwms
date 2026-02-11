'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

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

  const loadShare = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/share/inventory?slug=${encodeURIComponent(slug)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || '공유 데이터를 불러오지 못했습니다.');
      if (data.requiresPassword) {
        setRequiresPassword(true);
        setShareMeta(data.share || null);
      } else {
        setRequiresPassword(false);
        setRows((data.rows || []) as SharedRow[]);
        setShareMeta((data.share || null) as ShareMeta | null);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '공유 데이터를 불러오지 못했습니다.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [slug]);

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
        body: JSON.stringify({ slug, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || '비밀번호 확인 실패');
      setRows((data.rows || []) as SharedRow[]);
      setShareMeta((data.share || null) as ShareMeta | null);
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
    const params = new URLSearchParams();
    params.set('slug', slug);
    if (password) params.set('password', password);
    window.open(`/api/share/inventory/download?${params.toString()}`, '_blank');
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
