'use client';

import { useEffect, useMemo, useState, useDeferredValue } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { useLayout } from '@/components/LayoutWrapper';
import { createClient } from '@/utils/supabase/client';
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentCheckIcon,
  DocumentDuplicateIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { formatInteger } from '@/utils/number-format';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '진행 전', color: 'bg-gray-100 text-gray-600' },
  SUBMITTED: { label: '진행 전', color: 'bg-blue-100 text-blue-700' },
  ARRIVED: { label: '진행 전', color: 'bg-indigo-100 text-indigo-700' },
  PHOTO_REQUIRED: { label: '진행 중', color: 'bg-yellow-100 text-yellow-800' },
  COUNTING: { label: '진행 중', color: 'bg-yellow-100 text-yellow-800' },
  INSPECTING: { label: '진행 중', color: 'bg-yellow-100 text-yellow-800' },
  DISCREPANCY: { label: '이슈', color: 'bg-red-100 text-red-700' },
  CONFIRMED: { label: '완료', color: 'bg-green-100 text-green-700' },
  PUTAWAY_READY: { label: '완료', color: 'bg-purple-100 text-purple-700' },
};

type StatusGroup = 'ALL' | 'IN_PROGRESS' | 'COMPLETED' | 'ISSUE';
type DateFilter = 'ALL' | 'TODAY' | 'LAST_7' | 'LAST_30';

const statusGroupFor = (status?: string) => {
  if (!status) return 'IN_PROGRESS';
  if (status === 'DISCREPANCY') return 'ISSUE';
  if (status === 'CONFIRMED' || status === 'PUTAWAY_READY') return 'COMPLETED';
  return 'IN_PROGRESS';
};

const toDateKey = (date: Date) => date.toISOString().slice(0, 10);

export default function FieldCheckListPage() {
  const { toggleSidebar } = useLayout();
  const supabase = createClient();

  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusGroup>('ALL');
  const [dateFilter, setDateFilter] = useState<DateFilter>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const formatDate = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(
      date.getDate()
    ).padStart(2, '0')}`;
  };

  const refreshData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: planRows, error: planError } = await supabase
        .from('inbound_plans')
        .select(
          'id, plan_no, status, created_at, planned_date, inbound_manager, client:client_id(name), inbound_plan_lines(expected_qty, product:products!fk_inbound_plan_lines_product(name, sku, barcode))'
        )
        .order('created_at', { ascending: false })
        .limit(100);

      if (planError) throw new Error(planError.message);
      if (!planRows || planRows.length === 0) {
        setPlans([]);
        setLastRefreshedAt(new Date());
        setLoading(false);
        return;
      }

      const planIds = planRows.map((plan: any) => plan.id);
      const { data: receiptRows, error: receiptError } = await supabase
        .from('inbound_receipts')
        .select(
          'id, plan_id, status, receipt_no, updated_at, lines:inbound_receipt_lines(accepted_qty, received_qty, damaged_qty, missing_qty, other_qty), photos:inbound_photos(count)'
        )
        .in('plan_id', planIds);

      if (receiptError) throw new Error(receiptError.message);

      const mapped = planRows.map((plan: any) => {
        const receipt = receiptRows?.find((row: any) => row.plan_id === plan.id);
        const totalExpected =
          plan.inbound_plan_lines?.reduce((sum: number, line: any) => sum + (line.expected_qty || 0), 0) || 0;
        const totalNormal =
          receipt?.lines?.reduce((sum: number, line: any) => {
            const normal = line.accepted_qty ?? line.received_qty ?? 0;
            return sum + normal;
          }, 0) || 0;
        const issueCounts =
          receipt?.lines?.reduce(
            (acc: { damaged: number; missing: number; other: number }, line: any) => {
              acc.damaged += line.damaged_qty || 0;
              acc.missing += line.missing_qty || 0;
              acc.other += line.other_qty || 0;
              return acc;
            },
            { damaged: 0, missing: 0, other: 0 }
          ) || { damaged: 0, missing: 0, other: 0 };
        const totalActual = totalNormal + issueCounts.damaged + issueCounts.missing + issueCounts.other;
        const photoCount = receipt?.photos?.[0]?.count || 0;

        let displayStatus = plan.status;
        if (receipt) displayStatus = receipt.status;
        const hasMismatch = totalExpected !== totalActual && totalActual > 0;
        if (displayStatus === 'DISCREPANCY' && !hasMismatch) {
          displayStatus = 'CONFIRMED';
        }

        return {
          ...plan,
          receipt_id: receipt?.id,
          receipt_no: receipt?.receipt_no,
          displayStatus,
          totalExpected,
          totalNormal,
          totalActual,
          issueCounts,
          photoCount,
          updated_at: receipt?.updated_at,
          hasMismatch,
        };
      });

      setPlans(mapped);
      setLastRefreshedAt(new Date());
    } catch (err: any) {
      console.error('현장입고체크 목록 로딩 실패:', err);
      setError(err?.message || '목록을 불러오는 중 오류가 발생했습니다.');
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
    const timer = setInterval(refreshData, 30000);
    return () => clearInterval(timer);
  }, []);

  const filteredPlans = useMemo(() => {
    const todayKey = toDateKey(new Date());
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

    return plans.filter((plan) => {
      const displayStatus = plan.displayStatus;
      const group = statusGroupFor(displayStatus);

      if (statusFilter !== 'ALL' && group !== statusFilter) return false;

      const baseDate = plan.planned_date || plan.created_at;
      if (dateFilter !== 'ALL' && baseDate) {
        const dateKey = toDateKey(new Date(baseDate));
        if (dateFilter === 'TODAY' && dateKey !== todayKey) return false;
        if (dateFilter === 'LAST_7') {
          const compareDate = new Date(baseDate);
          if (compareDate < sevenDaysAgo) return false;
        }
        if (dateFilter === 'LAST_30') {
          const compareDate = new Date(baseDate);
          if (compareDate < thirtyDaysAgo) return false;
        }
      }

      if (!deferredSearchTerm) return true;
      const lowerTerm = deferredSearchTerm.toLowerCase();
      const planMatch = (plan.plan_no || '').toLowerCase().includes(lowerTerm);
      const clientMatch = (plan.client?.name || '').toLowerCase().includes(lowerTerm);
      const lineMatch = (plan.inbound_plan_lines || []).some((line: any) => {
        const sku = line.product?.sku || '';
        const barcode = line.product?.barcode || '';
        const name = line.product?.name || '';
        return [sku, barcode, name].some((value) => (value || '').toLowerCase().includes(lowerTerm));
      });
      return planMatch || clientMatch || lineMatch;
    });
  }, [plans, statusFilter, dateFilter, deferredSearchTerm]);

  const handleCopy = async (planId: string) => {
    try {
      const url = `${window.location.origin}/ops/inbound/${planId}`;
      await navigator.clipboard.writeText(url);
      setCopiedId(planId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error(err);
      window.alert('URL 복사에 실패했습니다.');
    }
  };

  const renderStatusBadge = (status?: string) => {
    const meta = STATUS_MAP[status || 'DRAFT'] || STATUS_MAP.DRAFT;
    return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${meta.color}`}>{meta.label}</span>;
  };

  const renderDelayBadge = (plan: any) => {
    const isCompleted = statusGroupFor(plan.displayStatus) === 'COMPLETED';
    const dateValue = plan.planned_date || plan.created_at;
    if (!dateValue || isCompleted) return null;
    const diffHours = (Date.now() - new Date(dateValue).getTime()) / 36e5;
    if (diffHours < 24) return null;
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">지연</span>;
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="현장입고체크" onMenuClick={toggleSidebar} />
      <main className="flex-1 p-4 lg:p-8 space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <ClipboardDocumentCheckIcon className="h-4 w-4 text-orange-500" />
              <span>총 {formatInteger(filteredPlans.length)}건</span>
              {lastRefreshedAt && (
                <span className="text-xs text-gray-400">
                  마지막 갱신 {lastRefreshedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <button
              onClick={refreshData}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              새로고침
            </button>
          </div>

          <div className="grid gap-3 lg:grid-cols-[2fr,1fr,1fr]">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="입고번호/고객사/상품명/바코드 검색"
                className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:border-orange-400"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusGroup)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="ALL">전체 상태</option>
              <option value="IN_PROGRESS">진행중</option>
              <option value="COMPLETED">완료</option>
              <option value="ISSUE">이슈</option>
            </select>
            <select
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value as DateFilter)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="LAST_7">최근 7일</option>
              <option value="LAST_30">최근 30일</option>
              <option value="TODAY">오늘</option>
              <option value="ALL">전체 기간</option>
            </select>
          </div>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {loading ? (
          <div className="py-16 text-center text-gray-500">목록을 불러오는 중입니다.</div>
        ) : filteredPlans.length === 0 ? (
          <div className="py-16 text-center text-gray-400">표시할 입고 작업이 없습니다.</div>
        ) : (
          <>
            <div className="grid gap-4 lg:hidden">
              {filteredPlans.map((plan) => {
                const statusMeta = STATUS_MAP[plan.displayStatus] || STATUS_MAP.DRAFT;
                const qtyDiff = plan.totalNormal - plan.totalExpected;
                return (
                  <div key={plan.id} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-gray-900">{plan.receipt_no || plan.plan_no}</div>
                        <div className="text-xs text-gray-400">
                          {formatDate(plan.planned_date || plan.created_at)}
                        </div>
                      </div>
                      <div className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${statusMeta.color}`}>
                        {statusMeta.label}
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-gray-700">{plan.client?.name || '-'}</div>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5">
                        예정 {formatInteger(plan.totalExpected)}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                          plan.hasMismatch ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}
                      >
                        정상 {formatInteger(plan.totalNormal)}
                        {plan.hasMismatch && (
                          <span className="font-semibold">{qtyDiff > 0 ? `(+${formatInteger(qtyDiff)})` : `(${formatInteger(qtyDiff)})`}</span>
                        )}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                        사진 {formatInteger(plan.photoCount)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-0.5">
                        담당 {plan.inbound_manager || '-'}
                      </span>
                      {renderDelayBadge(plan)}
                      {plan.displayStatus === 'DISCREPANCY' && (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                          이슈
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Link
                        href={`/ops/inbound/${plan.id}`}
                        className="inline-flex items-center justify-center gap-1 rounded-lg bg-orange-500 px-2 py-2 text-xs font-semibold text-white"
                      >
                        <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                        현장
                      </Link>
                      <button
                        onClick={() => handleCopy(plan.id)}
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 px-2 py-2 text-xs font-semibold text-gray-700"
                      >
                        <DocumentDuplicateIcon className="h-4 w-4" />
                        {copiedId === plan.id ? '복사됨' : '복사'}
                      </button>
                      <Link
                        href={`/ops/inbound/${plan.id}?step=4`}
                        className="inline-flex items-center justify-center gap-1 rounded-lg bg-gray-900 px-2 py-2 text-xs font-semibold text-white"
                      >
                        수량입력
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden lg:block bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left">입고번호</th>
                    <th className="px-4 py-3 text-left">고객사</th>
                    <th className="px-4 py-3 text-left">상태</th>
                    <th className="px-4 py-3 text-left">예정/정상수량</th>
                    <th className="px-4 py-3 text-left">사진</th>
                    <th className="px-4 py-3 text-left">담당자</th>
                    <th className="px-4 py-3 text-left">우선/지연</th>
                    <th className="px-4 py-3 text-left">액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredPlans.map((plan) => {
                    const qtyDiff = plan.totalNormal - plan.totalExpected;
                    return (
                      <tr key={plan.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900">{plan.receipt_no || plan.plan_no}</div>
                          <div className="text-xs text-gray-400">{formatDate(plan.planned_date || plan.created_at)}</div>
                        </td>
                        <td className="px-4 py-3">{plan.client?.name || '-'}</td>
                        <td className="px-4 py-3">{renderStatusBadge(plan.displayStatus)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <span className="text-gray-700">{formatInteger(plan.totalExpected)}</span>
                            <span className="text-gray-400">→</span>
                            <span className={plan.hasMismatch ? 'text-red-600 font-semibold' : 'text-gray-900 font-semibold'}>
                              {formatInteger(plan.totalNormal)}
                            </span>
                            {plan.hasMismatch && (
                              <span className="text-xs text-red-500 font-semibold">
                                {qtyDiff > 0 ? `(+${formatInteger(qtyDiff)})` : `(${formatInteger(qtyDiff)})`}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">사진 {formatInteger(plan.photoCount)}장</td>
                        <td className="px-4 py-3 text-gray-600">{plan.inbound_manager || '-'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {renderDelayBadge(plan)}
                            {plan.displayStatus === 'DISCREPANCY' && (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                                이슈
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/ops/inbound/${plan.id}`}
                              className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-2 py-1.5 text-xs font-semibold text-white"
                            >
                              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                              현장
                            </Link>
                            <button
                              onClick={() => handleCopy(plan.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-semibold text-gray-700"
                            >
                              <DocumentDuplicateIcon className="h-4 w-4" />
                              {copiedId === plan.id ? '복사됨' : '복사'}
                            </button>
                            <Link
                              href={`/ops/inbound/${plan.id}?step=4`}
                              className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-2 py-1.5 text-xs font-semibold text-white"
                            >
                              수량입력
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
