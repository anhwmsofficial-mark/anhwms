'use client';

import { useState, useEffect, useDeferredValue, Suspense, useMemo, useRef, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { confirmReceipt, deleteInboundPlan, getInboundDashboardPageData } from '@/app/actions/inbound';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { formatInteger } from '@/utils/number-format';
import { showError, showSuccess } from '@/lib/toast';
import InlineErrorAlert from '@/components/ui/inline-error-alert';
import { normalizeInlineError, type InlineErrorMeta } from '@/lib/api/client';

// 상태 매핑 (어드민 표시용)
const STATUS_MAP: Record<string, { label: string, color: string }> = {
    'DRAFT': { label: '진행 전', color: 'bg-gray-100 text-gray-500' },
    'SUBMITTED': { label: '진행 전', color: 'bg-blue-100 text-blue-700' },
    'ARRIVED': { label: '진행 전', color: 'bg-indigo-100 text-indigo-700' },
    'PHOTO_REQUIRED': { label: '진행 중', color: 'bg-yellow-100 text-yellow-800' },
    'COUNTING': { label: '진행 중', color: 'bg-yellow-100 text-yellow-800' },
    'INSPECTING': { label: '진행 중', color: 'bg-yellow-100 text-yellow-800' },
    'DISCREPANCY': { label: '이슈 발생', color: 'bg-red-100 text-red-700' },
    'CONFIRMED': { label: '완료', color: 'bg-green-100 text-green-700' },
    'PUTAWAY_READY': { label: '완료', color: 'bg-purple-100 text-purple-700' },
};

function InboundPageContent() {
  const [plans, setPlans] = useState<any[]>([]);
  const [filteredPlans, setFilteredPlans] = useState<any[]>([]); // 필터링된 결과
  const [stats, setStats] = useState({
      todayExpected: 0,
      pending: 0,
      issues: 0,
      recentCompleted: [] as any[]
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<InlineErrorMeta | null>(null);
  
  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 50 });
  
  // Common Codes
  const [statusOptions] = useState<any[]>([]);

  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const pageRef = useRef(page);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  const refreshData = useCallback(async (targetPage: number) => {
      setLoading(true);
      setError(null);
      try {
        const result = await getInboundDashboardPageData(targetPage, pagination.limit);
        if (!result.ok) {
          throw new Error(result.error || '입고 목록을 불러오는 중 오류가 발생했습니다.');
        }

        const payload = result.data;
        setStats(payload.stats);
        setPlans(payload.plans);
        setFilteredPlans(payload.plans);
        setPagination(payload.pagination);
      } catch (err: unknown) {
        console.error('입고 목록 로딩 실패:', err);
        setError(normalizeInlineError(err, '입고 목록을 불러오는 중 오류가 발생했습니다.'));
        setPlans([]);
        setFilteredPlans([]);
      } finally {
        setLoading(false);
      }
  }, [pagination.limit]);

  useEffect(() => {
    refreshData(pageRef.current);
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshData(pageRef.current);
        refreshTimer = null;
      }, 500);
    };

    const channel = supabase
      .channel('inbound-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inbound_receipts' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inbound_plans' }, scheduleRefresh)
      .subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [refreshData, supabase]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = 'inboundDelayAlertAt';
    const last = Number(window.localStorage.getItem(key) || 0);
    const now = Date.now();
    if (now - last > 6 * 60 * 60 * 1000) {
      fetch('/api/admin/alerts/inbound-delay').finally(() => {
        window.localStorage.setItem(key, String(now));
      });
    }
  }, []);

  useEffect(() => {
    const skuParam = searchParams?.get('sku');
    if (skuParam) {
      setSearchTerm(skuParam);
    }
  }, [searchParams]);

  useEffect(() => {
    refreshData(page);
  }, [page, refreshData]);

  // 검색/필터 로직
  useEffect(() => {
    let result = plans;

    // 1. Status Filter
    if (statusFilter !== 'ALL') {
        result = result.filter(plan => {
            const status = plan.displayStatus;
            // 단순 매핑: PENDING 그룹, COMPLETED 그룹 등 필요 시 확장
            return status === statusFilter;
        });
    }

    // 2. Search Term
    if (deferredSearchTerm) {
        const lowerTerm = deferredSearchTerm.toLowerCase();
        result = result.filter(plan => {
            const planMatch = (plan.plan_no || '').toLowerCase().includes(lowerTerm);
            const clientMatch = (plan.client?.name || '').toLowerCase().includes(lowerTerm);
            const lineMatch = (plan.inbound_plan_lines || []).some((line: any) => {
                const sku = line.product?.sku || line.product_sku || '';
                const barcode = line.product?.barcode || '';
                const name = line.product?.name || line.product_name || '';
                return [sku, barcode, name].some((v) => (v || '').toLowerCase().includes(lowerTerm));
            });
            return planMatch || clientMatch || lineMatch;
        });
    }

    setFilteredPlans(result);
  }, [plans, deferredSearchTerm, statusFilter]);

  // 삭제 핸들러 추가
  const handleDelete = async (planId: string) => {
      if (typeof window !== 'undefined' && !window.confirm('정말 삭제하시겠습니까? 관련 데이터가 모두 삭제됩니다.')) return;
      
      try {
          const result = await deleteInboundPlan(planId);
          if ('error' in result) {
              const msg = result.error || '삭제에 실패했습니다.';
              showError(msg);
              setError({ message: msg });
          } else {
              showSuccess('삭제되었습니다.');
              refreshData(pageRef.current);
          }
      } catch (e) {
          console.error(e);
          const msg = '삭제 중 오류가 발생했습니다.';
          showError(msg);
          setError({ message: msg });
      }
  };

  const handleQuickConfirm = async (receiptId: string) => {
      if (typeof window !== 'undefined' && !window.confirm('해당 건을 즉시 완료 처리하시겠습니까? (이슈가 없는 경우만 가능)')) return;
      const result = await confirmReceipt(receiptId);
      if ('error' in result) {
          const msg = result.error || '완료 처리에 실패했습니다.';
          showError(msg);
          setError({ message: msg });
      } else refreshData(pageRef.current);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* 1. 상단 통계 (Actionable Dashboard) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-100 p-5 rounded-xl hover:bg-blue-100 transition">
              <div className="text-blue-600 font-medium mb-1">📅 오늘 입고 예정</div>
              <div className="text-3xl font-bold text-gray-900">{formatInteger(stats.todayExpected)} 건</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-100 p-5 rounded-xl hover:bg-yellow-100 transition">
              <div className="text-yellow-700 font-medium mb-1">⏳ 확인 대기</div>
              <div className="text-3xl font-bold text-gray-900">{formatInteger(stats.pending)} 건</div>
          </div>
          <div className="bg-red-50 border border-red-100 p-5 rounded-xl hover:bg-red-100 transition">
              <div className="text-red-700 font-medium mb-1">🚨 이슈 발생</div>
              <div className="text-3xl font-bold text-gray-900">{formatInteger(stats.issues)} 건</div>
          </div>
          <div className="bg-gray-50 border border-gray-100 p-5 rounded-xl">
              <div className="text-gray-500 font-medium mb-1">✅ 최근 완료</div>
              <div className="text-sm text-gray-700 space-y-1 mt-2">
                  {stats.recentCompleted.length === 0 ? <span className="text-gray-400">없음</span> : 
                      stats.recentCompleted.map(r => (
                          <div key={r.id} className="flex justify-between">
                              <span className="truncate w-24">{r.receipt_no}</span>
                              <span className="text-gray-500 text-xs">{r.client?.name}</span>
                          </div>
                      ))
                  }
              </div>
          </div>
      </div>

      {/* 2. 입고 처리 리스트 (Action-Oriented) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-5 border-b border-gray-200 bg-gray-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h2 className="text-lg font-bold text-gray-900">📋 입고 작업 목록</h2>
              
              <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                  {/* 검색창 */}
                  <div className="relative w-full md:w-64">
                      <input 
                          type="text" 
                          placeholder="번호, 화주사, SKU 검색..." 
                          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          aria-label="입고 목록 검색"
                      />
                      <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  </div>

                  {/* 필터 */}
                  <select 
                      className="w-full md:w-40 text-sm border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 px-3 py-2"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      aria-label="입고 상태 필터"
                  >
                      <option value="ALL">전체 상태</option>
                      {statusOptions.map(opt => (
                          <option key={opt.code} value={opt.code}>{opt.label}</option>
                      ))}
                  </select>

                  <button 
                      onClick={() => router.push('/inbound/new')}
                      className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition whitespace-nowrap"
                      type="button"
                  >
                      + 신규 예정 등록
                  </button>
              </div>
          </div>

          <InlineErrorAlert error={error} className="rounded-none border-x-0 border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700" />

          {/* 모바일 최적화된 리스트 뷰 */}
          <div className="md:hidden divide-y divide-gray-200" aria-live="polite">
              {loading ? (
                  <div className="p-6 text-center text-gray-500">데이터를 불러오는 중...</div>
              ) : filteredPlans.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">검색 결과가 없습니다.</div>
              ) : (
                  filteredPlans.map((plan) => {
                      const statusInfo = STATUS_MAP[plan.displayStatus] || { label: plan.displayStatus, color: 'bg-gray-100 text-gray-800' };
                      const qtyDiff = plan.totalNormal - plan.totalExpected;
                      const hasIssues = (plan.issueCounts?.damaged || 0) + (plan.issueCounts?.missing || 0) + (plan.issueCounts?.other || 0) > 0;
                      
                      return (
                          <div 
                            key={plan.id} 
                            className="p-4 active:bg-gray-50 transition-colors"
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                if (plan.receipt_id) router.push(`/inbound/${plan.receipt_id}`);
                              }
                            }}
                            onClick={() => plan.receipt_id ? router.push(`/inbound/${plan.receipt_id}`) : null}
                            aria-label={`${plan.client?.name || '화주사'} 입고 상세`}
                          >
                              <div className="flex justify-between items-start mb-2">
                                  <div>
                                  <div className="text-sm font-bold text-gray-900">{plan.client?.name || '-'}</div>
                                      <div className="text-xs text-gray-500">{plan.planned_date} · {plan.plan_no}</div>
                                  </div>
                                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-bold rounded-full ${statusInfo.color}`}>
                                      {statusInfo.label}
                                  </span>
                              </div>
                              
                              <div className="flex justify-between items-center mb-3">
                                  <div className="flex items-center gap-2 text-sm">
                                      <span className="text-gray-500">수량:</span>
                                      <span className="font-medium">{formatInteger(plan.totalExpected)}</span>
                                      <span className="text-gray-300">→</span>
                                      <span className={`font-bold ${hasIssues && plan.totalNormal > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                          {plan.receipt_id ? formatInteger(plan.totalNormal) : '-'}
                                      </span>
                                      {hasIssues && plan.totalNormal > 0 && (
                                          <span className="text-xs text-red-500 font-bold">
                                              ({qtyDiff > 0 ? '+' : ''}{formatInteger(qtyDiff)})
                                          </span>
                                      )}
                                  </div>
                                  {plan.hasPhotos && <span className="text-xs text-green-600 font-medium">📷 사진있음</span>}
                              </div>
                              {(plan.issueCounts?.damaged > 0 || plan.issueCounts?.missing > 0 || plan.issueCounts?.other > 0) && (
                                <div className="flex flex-wrap gap-2 text-xs font-medium">
                                      {plan.issueCounts?.damaged > 0 && (
                                    <span className="text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded">
                                          파손 {formatInteger(plan.issueCounts.damaged)}
                                    </span>
                                  )}
                                  {plan.issueCounts?.missing > 0 && (
                                    <span className="text-orange-600 bg-orange-50 border border-orange-200 px-2 py-1 rounded">
                                          분실 {formatInteger(plan.issueCounts.missing)}
                                    </span>
                                  )}
                                  {plan.issueCounts?.other > 0 && (
                                    <span className="text-purple-600 bg-purple-50 border border-purple-200 px-2 py-1 rounded">
                                          기타 {formatInteger(plan.issueCounts.other)}
                                    </span>
                                  )}
                                </div>
                              )}

                              <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                                  {plan.receipt_id ? (
                                      <>
                                          <button 
                                              onClick={() => router.push(`/inbound/${plan.receipt_id}`)}
                                              className="flex-1 text-center py-2 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-lg border border-indigo-100 active:bg-indigo-100"
                                              type="button"
                                          >
                                              상세보기
                                          </button>
                                          <button 
                                              onClick={() => {
                                                  const url = `${window.location.origin}/ops/inbound/${plan.id}`;
                                                  window.open(url, '_blank', 'noopener,noreferrer');
                                              }}
                                              className="flex-1 text-center py-2 text-xs font-medium text-gray-700 bg-gray-50 rounded-lg border border-gray-200 active:bg-gray-100"
                                              type="button"
                                          >
                                              현장화면
                                          </button>
                                          <button
                                              onClick={() => {
                                                  const url = `${window.location.origin}/ops/inbound/${plan.id}?step=4&mode=edit`;
                                                  window.open(url, '_blank', 'noopener,noreferrer');
                                              }}
                                              className="flex-1 text-center py-2 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg border border-amber-200 active:bg-amber-100"
                                              type="button"
                                          >
                                              현장체크 수정
                                          </button>
                                      </>
                                  ) : (
                                      <button 
                                          onClick={() => {
                                              const url = `${window.location.origin}/ops/inbound/${plan.id}`;
                                              window.open(url, '_blank', 'noopener,noreferrer');
                                          }}
                                          className="flex-1 text-center py-2 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg border border-blue-100 active:bg-blue-100"
                                          type="button"
                                      >
                                          입고 시작
                                      </button>
                                  )}
                                  
                                  <div className="flex gap-2">
                                      <button
                                          onClick={() => router.push(`/inbound/${plan.id}/edit`)}
                                          className="px-3 py-2 text-xs font-medium text-blue-600 bg-white border border-blue-200 rounded-lg active:bg-blue-50"
                                          type="button"
                                      >
                                          수정
                                      </button>
                                      <button
                                          onClick={() => handleDelete(plan.id)}
                                          className="px-3 py-2 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg active:bg-red-50"
                                          type="button"
                                      >
                                          삭제
                                      </button>
                                  </div>
                              </div>
                          </div>
                      );
                  })
              )}
          </div>

          <table className="hidden md:table min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                  <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">날짜 / 번호</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">고객사</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">수량 (예정 vs 실물)</th>
                      <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">사진</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">작업</th>
                  </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                      <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-500">데이터를 불러오는 중...</td></tr>
                  ) : filteredPlans.length === 0 ? (
                      <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-500">검색 결과가 없습니다.</td></tr>
                  ) : (
                      filteredPlans.map((plan) => {
                          const statusInfo = STATUS_MAP[plan.displayStatus] || { label: plan.displayStatus, color: 'bg-gray-100 text-gray-800' };
                          const isIssue = plan.displayStatus === 'DISCREPANCY';
                          const isConfirmed = plan.displayStatus === 'CONFIRMED';
                          const qtyDiff = plan.totalNormal - plan.totalExpected;
                          const hasIssues = (plan.issueCounts?.damaged || 0) + (plan.issueCounts?.missing || 0) + (plan.issueCounts?.other || 0) > 0;
                          
                          return (
                              <tr key={plan.id} className={`hover:bg-gray-50 transition ${isIssue ? 'bg-red-50' : ''}`}>
                                  <td className="px-6 py-4">
                                      <div className="text-sm font-medium text-gray-900">{plan.planned_date}</div>
                                      <div className="text-xs text-gray-500">{plan.plan_no}</div>
                                  </td>
                                  <td className="px-6 py-4">
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                          {plan.client?.name || '-'}
                                      </span>
                                  </td>
                                  <td className="px-6 py-4">
                                      <div className="flex items-center gap-2">
                                      <div className="text-sm text-gray-500 w-12 text-right">{formatInteger(plan.totalExpected)}</div>
                                          <div className="text-gray-300">→</div>
                                          <div className={`text-sm font-bold w-12 text-right ${
                                              hasIssues && plan.totalNormal > 0 ? 'text-red-600' : 'text-gray-900'
                                          }`}>
                                          {plan.receipt_id ? formatInteger(plan.totalNormal) : '-'}
                                          </div>
                                          {hasIssues && plan.totalNormal > 0 && (
                                            <span className="text-xs text-red-500 font-bold">
                                              ({qtyDiff > 0 ? '+' : ''}{formatInteger(qtyDiff)})
                                            </span>
                                          )}
                                      </div>
                                      {(plan.issueCounts?.damaged > 0 || plan.issueCounts?.missing > 0 || plan.issueCounts?.other > 0) && (
                                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium">
                                          {plan.issueCounts?.damaged > 0 && (
                                            <span className="text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded">
                                              파손 {formatInteger(plan.issueCounts.damaged)}
                                            </span>
                                          )}
                                          {plan.issueCounts?.missing > 0 && (
                                            <span className="text-orange-600 bg-orange-50 border border-orange-200 px-2 py-1 rounded">
                                              분실 {formatInteger(plan.issueCounts.missing)}
                                            </span>
                                          )}
                                          {plan.issueCounts?.other > 0 && (
                                            <span className="text-purple-600 bg-purple-50 border border-purple-200 px-2 py-1 rounded">
                                              기타 {formatInteger(plan.issueCounts.other)}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                      {plan.receipt_id ? (
                                          plan.hasPhotos ? (
                                              <span className="text-green-500 text-lg" title={`${plan.photoCount}장 업로드됨`}>📷 ✅</span>
                                          ) : (
                                              <span className="text-gray-300 text-lg" title="사진 없음">📷 ❌</span>
                                          )
                                      ) : (
                                          <span className="text-gray-200">-</span>
                                      )}
                                  </td>
                                  <td className="px-6 py-4">
                                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-bold rounded-full ${statusInfo.color}`}>
                                          {statusInfo.label}
                                      </span>
                                  </td>
                                  <td className="px-6 py-4 text-right text-sm font-medium space-x-2">
                                      {/* 상태별 액션 버튼 */}
                                      {plan.receipt_id ? (
                                          <>
                                              <button 
                                                  onClick={() => router.push(`/inbound/${plan.receipt_id}`)}
                                                  className="text-indigo-600 hover:text-indigo-900 border border-indigo-200 px-3 py-1 rounded bg-white hover:bg-indigo-50"
                                                  type="button"
                                              >
                                                  어드민 상세
                                              </button>
                                              <button 
                                                  onClick={() => {
                                                      const url = `${window.location.origin}/ops/inbound/${plan.id}`;
                                                  navigator.clipboard
                                                    .writeText(url)
                                                    .then(() => showSuccess('현장 URL이 복사되었습니다.'))
                                                    .catch(() => showError('URL 복사에 실패했습니다.'));
                                                      window.open(url, '_blank', 'noopener,noreferrer');
                                                  }}
                                                  className="text-gray-700 hover:text-gray-900 border border-gray-200 px-3 py-1 rounded bg-white hover:bg-gray-50"
                                                  type="button"
                                              >
                                                  현장 (새창)
                                              </button>
                                              <button
                                                  onClick={() => {
                                                      const url = `${window.location.origin}/ops/inbound/${plan.id}?step=4&mode=edit`;
                                                      window.open(url, '_blank', 'noopener,noreferrer');
                                                  }}
                                                  className="text-amber-700 hover:text-amber-900 border border-amber-200 px-3 py-1 rounded bg-amber-50 hover:bg-amber-100"
                                                  type="button"
                                              >
                                                  현장체크 수정
                                              </button>
                                              
                                              {!isConfirmed && !isIssue && plan.hasPhotos && (
                                                  <button 
                                                      onClick={() => handleQuickConfirm(plan.receipt_id)}
                                                      className="text-green-600 hover:text-green-900 border border-green-200 px-3 py-1 rounded bg-white hover:bg-green-50"
                                                      type="button"
                                                  >
                                                      완료
                                                  </button>
                                              )}
                                          </>
                                      ) : (
                                          <button 
                                              onClick={() => {
                                                  // Receipt가 없을 때는 Plan ID로 접속 시도 (Ops 페이지에서 처리)
                                                  const url = `${window.location.origin}/ops/inbound/${plan.id}`;
                                                  window.open(url, '_blank', 'noopener,noreferrer');
                                              }}
                                              className="text-blue-600 hover:text-blue-900 border border-blue-200 px-3 py-1 rounded bg-white hover:bg-blue-50"
                                              type="button"
                                          >
                                              입고 시작
                                          </button>
                                      )}
                                      
                                      {/* 수정 및 삭제 버튼 */}
                                      <>
                                          <button
                                              onClick={() => router.push(`/inbound/${plan.id}/edit`)}
                                              className="text-blue-400 hover:text-blue-600 border border-blue-100 px-3 py-1 rounded bg-white hover:bg-blue-50"
                                              title="수정"
                                              type="button"
                                          >
                                              ✏️
                                          </button>
                                          <button
                                              onClick={() => handleDelete(plan.id)}
                                              className="text-red-400 hover:text-red-600 border border-red-100 px-3 py-1 rounded bg-white hover:bg-red-50"
                                              title="삭제"
                                              type="button"
                                          >
                                              🗑️
                                          </button>
                                      </>
                                  </td>
                              </tr>
                          );
                      })
                  )}
              </tbody>
          </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <div>
          총 {formatInteger(pagination.total)}건 · {pagination.page}/{pagination.totalPages} 페이지
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
          >
            이전
          </button>
          <button
            onClick={() => setPage((p) => Math.min(p + 1, pagination.totalPages))}
            disabled={page >= pagination.totalPages}
            className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
          >
            다음
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InboundPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-gray-500">로딩 중...</div>}>
      <InboundPageContent />
    </Suspense>
  );
}
