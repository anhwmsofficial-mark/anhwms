'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { getInboundStats } from '@/app/actions/inbound-dashboard';
import { confirmReceipt } from '@/app/actions/inbound';

// 상태 매핑 (어드민 표시용)
const STATUS_MAP: Record<string, { label: string, color: string }> = {
    'DRAFT': { label: '작성중', color: 'bg-gray-100 text-gray-500' },
    'SUBMITTED': { label: '입고 예정', color: 'bg-blue-100 text-blue-700' }, // EXPECTED
    'ARRIVED': { label: '현장 도착', color: 'bg-indigo-100 text-indigo-700' }, // ARRIVED
    'PHOTO_REQUIRED': { label: '확인중', color: 'bg-yellow-100 text-yellow-800' }, // CHECKING
    'COUNTING': { label: '확인중', color: 'bg-yellow-100 text-yellow-800' }, // CHECKING
    'INSPECTING': { label: '확인중', color: 'bg-yellow-100 text-yellow-800' }, // CHECKING
    'DISCREPANCY': { label: '이슈 발생', color: 'bg-red-100 text-red-700' }, // ISSUE
    'CONFIRMED': { label: '완료됨', color: 'bg-green-100 text-green-700' }, // COMPLETED
    'PUTAWAY_READY': { label: '적치 대기', color: 'bg-purple-100 text-purple-700' },
};

export default function InboundPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [stats, setStats] = useState({
      todayExpected: 0,
      pending: 0,
      issues: 0,
      recentCompleted: [] as any[]
  });
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    refreshData();

    const channel = supabase
      .channel('inbound-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inbound_receipts' }, () => refreshData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inbound_plans' }, () => refreshData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const refreshData = async () => {
      setLoading(true);
      const [statsData, plansData] = await Promise.all([
          getInboundStats(),
          fetchDetailedPlans()
      ]);
      setStats(statsData);
      setPlans(plansData);
      setLoading(false);
  };

  const fetchDetailedPlans = async () => {
      // Plan + Receipt + Lines + Photos 조인을 흉내내기 위해
      // 실제로는 View를 만드는 것이 가장 좋으나, 여기서는 JS로 조합
      const { data: plans } = await supabase
          .from('inbound_plans')
          .select('*, client:client_id(name)')
          .order('created_at', { ascending: false })
          .limit(50); // 최근 50건만

      if (!plans) return [];

      const planIds = plans.map(p => p.id);
      
      const { data: receipts } = await supabase
          .from('inbound_receipts')
          .select('*, lines:inbound_receipt_lines(*), photos:inbound_photos(count)')
          .in('plan_id', planIds);

      return plans.map(plan => {
          const receipt = receipts?.find(r => r.plan_id === plan.id);
          
          // 수량 계산
          const totalExpected = receipt?.lines?.reduce((sum: number, l: any) => sum + l.expected_qty, 0) || 0;
          const totalReceived = receipt?.lines?.reduce((sum: number, l: any) => sum + l.received_qty, 0) || 0;
          
          // 사진 유무 (단순 count check)
          const photoCount = receipt?.photos?.[0]?.count || 0;
          const hasPhotos = photoCount > 0;

          // 표시용 상태 결정
          let displayStatus = plan.status;
          if (receipt) displayStatus = receipt.status;

          return {
              ...plan,
              receipt_id: receipt?.id,
              displayStatus,
              totalExpected,
              totalReceived,
              hasPhotos,
              photoCount
          };
      });
  };

  const handleQuickConfirm = async (receiptId: string) => {
      if (!confirm('해당 건을 즉시 완료 처리하시겠습니까? (이슈가 없는 경우만 가능)')) return;
      const result = await confirmReceipt(receiptId);
      if (result.error) alert(result.error);
      else refreshData();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* 1. 상단 통계 (Actionable Dashboard) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-100 p-5 rounded-xl cursor-pointer hover:bg-blue-100 transition">
              <div className="text-blue-600 font-medium mb-1">📅 오늘 입고 예정</div>
              <div className="text-3xl font-bold text-gray-900">{stats.todayExpected} 건</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-100 p-5 rounded-xl cursor-pointer hover:bg-yellow-100 transition">
              <div className="text-yellow-700 font-medium mb-1">⏳ 확인 대기</div>
              <div className="text-3xl font-bold text-gray-900">{stats.pending} 건</div>
          </div>
          <div className="bg-red-50 border border-red-100 p-5 rounded-xl cursor-pointer hover:bg-red-100 transition">
              <div className="text-red-700 font-medium mb-1">🚨 이슈 발생</div>
              <div className="text-3xl font-bold text-gray-900">{stats.issues} 건</div>
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
          <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h2 className="text-lg font-bold text-gray-900">📋 입고 작업 목록</h2>
              <button 
                  onClick={() => router.push('/inbound/new')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition"
              >
                  + 신규 예정 등록
              </button>
          </div>

          <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                  <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">날짜 / 번호</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">화주사</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">수량 (예정 vs 실물)</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">사진</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">작업 (Actions)</th>
                  </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                      <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-500">데이터를 불러오는 중...</td></tr>
                  ) : plans.length === 0 ? (
                      <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-500">표시할 데이터가 없습니다.</td></tr>
                  ) : (
                      plans.map((plan) => {
                          const statusInfo = STATUS_MAP[plan.displayStatus] || { label: plan.displayStatus, color: 'bg-gray-100 text-gray-800' };
                          const isIssue = plan.displayStatus === 'DISCREPANCY';
                          const isConfirmed = plan.displayStatus === 'CONFIRMED';
                          const qtyDiff = plan.totalReceived - plan.totalExpected;
                          
                          return (
                              <tr key={plan.id} className={`hover:bg-gray-50 transition ${isIssue ? 'bg-red-50' : ''}`}>
                                  <td className="px-6 py-4">
                                      <div className="text-sm font-medium text-gray-900">{plan.planned_date}</div>
                                      <div className="text-xs text-gray-500">{plan.plan_no}</div>
                                  </td>
                                  <td className="px-6 py-4">
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                          {plan.client?.name}
                                      </span>
                                  </td>
                                  <td className="px-6 py-4">
                                      <div className="flex items-center gap-2">
                                          <div className="text-sm text-gray-500 w-12 text-right">{plan.totalExpected}</div>
                                          <div className="text-gray-300">→</div>
                                          <div className={`text-sm font-bold w-12 text-right ${
                                              qtyDiff !== 0 && plan.totalReceived > 0 ? 'text-red-600' : 'text-gray-900'
                                          }`}>
                                              {plan.receipt_id ? plan.totalReceived : '-'}
                                          </div>
                                          {qtyDiff !== 0 && plan.totalReceived > 0 && (
                                              <span className="text-xs text-red-500 font-bold">
                                                  ({qtyDiff > 0 ? '+' : ''}{qtyDiff})
                                              </span>
                                          )}
                                      </div>
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
                                                  onClick={() => router.push(`/ops/inbound/${plan.id}`)}
                                                  className="text-indigo-600 hover:text-indigo-900 border border-indigo-200 px-3 py-1 rounded bg-white hover:bg-indigo-50"
                                              >
                                                  {isConfirmed ? '조회' : '검수/사진'}
                                              </button>
                                              
                                              {!isConfirmed && !isIssue && plan.hasPhotos && (
                                                  <button 
                                                      onClick={() => handleQuickConfirm(plan.receipt_id)}
                                                      className="text-green-600 hover:text-green-900 border border-green-200 px-3 py-1 rounded bg-white hover:bg-green-50"
                                                  >
                                                      완료
                                                  </button>
                                              )}
                                          </>
                                      ) : (
                                          <button 
                                              onClick={() => router.push(`/ops/inbound/${plan.id}`)}
                                              className="text-blue-600 hover:text-blue-900 border border-blue-200 px-3 py-1 rounded bg-white hover:bg-blue-50"
                                          >
                                              입고 시작
                                          </button>
                                      )}
                                  </td>
                              </tr>
                          );
                      })
                  )}
              </tbody>
          </table>
      </div>
    </div>
  );
}
