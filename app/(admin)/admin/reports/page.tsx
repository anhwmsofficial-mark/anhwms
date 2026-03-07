'use client';

import { useEffect, useState } from 'react';
import InlineErrorAlert from '@/components/ui/inline-error-alert';
import { getInlineErrorMeta, normalizeInlineError, toClientApiError, type InlineErrorMeta } from '@/lib/api/client';

type Summary = {
  inbound: {
    total: number;
    monthly: number;
  };
  orders: {
    total: number;
    monthly: number;
  };
  inventory: {
    ledgerMonthly: number;
  };
};

function ReportCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: number | string;
  subtitle?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-2">{subtitle}</p>}
    </div>
  );
}

export default function ReportsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<InlineErrorMeta | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/admin/reports/summary');
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          setError(getInlineErrorMeta(toClientApiError(res.status, payload, '리포트를 불러오지 못했습니다.'), '리포트를 불러오지 못했습니다.'));
          setSummary(null);
          return;
        }
        const data = await res.json();
        setSummary(data);
      } catch (err: unknown) {
        setError(normalizeInlineError(err, '리포트를 불러오지 못했습니다.'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-bold text-gray-900">📊 통계 리포트</h1>
          <p className="text-sm text-gray-600 mt-1">운영 지표를 빠르게 확인합니다.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {loading && <p className="text-sm text-gray-500">리포트를 불러오는 중입니다...</p>}
        <InlineErrorAlert error={error} className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" />

        {summary && (
          <>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">입고 리포트</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <ReportCard title="누적 입고 건수" value={summary.inbound.total} />
                <ReportCard title="이번 달 입고 건수" value={summary.inbound.monthly} />
                <ReportCard
                  title="이번 달 재고 원장 기록"
                  value={summary.inventory.ledgerMonthly}
                />
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">주문 리포트</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <ReportCard title="누적 주문 건수" value={summary.orders.total} />
                <ReportCard title="이번 달 주문 건수" value={summary.orders.monthly} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

