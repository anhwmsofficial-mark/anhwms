'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPartnerInboundList } from '@/app/actions/partner-inbound';
import InlineErrorAlert from '@/components/ui/inline-error-alert';
import { normalizeInlineError, type InlineErrorMeta } from '@/lib/api/client';

const PAGE_SIZE = 20;

type PartnerInboundItem = {
  id: string;
  receiptNo: string;
  planNo: string;
  plannedDate: string;
  clientName: string;
};

export default function PartnerInboundListPage() {
  const router = useRouter();
  const [items, setItems] = useState<PartnerInboundItem[]>([]);
  const [customerName, setCustomerName] = useState('YBK');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<InlineErrorMeta | null>(null);

  const load = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getPartnerInboundList(targetPage, PAGE_SIZE);
      if (!result.ok) {
        throw new Error(result.error || '입고 목록을 불러오지 못했습니다.');
      }
      setCustomerName(result.data.customerName || 'YBK');
      setItems(result.data.items || []);
      setTotalPages(result.data.pagination.totalPages || 1);
      setPage(result.data.pagination.page || targetPage);
    } catch (err: unknown) {
      setError(normalizeInlineError(err, '입고 목록을 불러오지 못했습니다.'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page);
  }, [load, page]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">파트너데이터 · 입고현황</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">입고작업목록</h1>
        <p className="mt-2 text-sm text-gray-600">인수증이 있는 {customerName} 입고 건만 조회할 수 있습니다.</p>
      </div>

      <InlineErrorAlert error={error} />

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">날짜/번호</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">고객사</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">어드민상세내역</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-4 text-sm text-gray-900">
                    <div className="font-medium">{item.plannedDate || '-'}</div>
                    <div className="text-xs text-gray-500">{item.planNo || item.receiptNo || '-'}</div>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-900">{item.clientName}</td>
                  <td className="px-4 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => router.push(`/portal/inbound/${item.id}`)}
                      className="rounded border border-indigo-200 bg-white px-3 py-1 text-sm text-indigo-600 hover:bg-indigo-50"
                    >
                      어드민 상세
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-12 text-center text-sm text-gray-500">
                    {loading ? '입고 목록을 불러오는 중입니다.' : '조회할 입고 건이 없습니다.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          >
            이전
          </button>
          <span className="text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((current) => current + 1)}
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          >
            다음
          </button>
        </div>
      ) : null}
    </div>
  );
}
