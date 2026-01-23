'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { getInboundStats } from '@/app/actions/inbound-dashboard';
import { confirmReceipt, deleteInboundPlan } from '@/app/actions/inbound';

// ... (STATUS_MAP은 그대로)

export default function InboundPage() {
  // ... (상태 변수들은 그대로)

  // fetchDetailedPlans 수정: inbound_plans 조회 시 inbound_plan_lines 포함
  const fetchDetailedPlans = async () => {
      const { data: plans } = await supabase
          .from('inbound_plans')
          .select('*, client:client_id(name), inbound_plan_lines(*)') // inbound_plan_lines 추가
          .order('created_at', { ascending: false })
          .limit(50);

      if (!plans) return [];

      const planIds = plans.map(p => p.id);
      
      const { data: receipts } = await supabase
          .from('inbound_receipts')
          .select('*, lines:inbound_receipt_lines(*), photos:inbound_photos(count)')
          .in('plan_id', planIds);

      return plans.map(plan => {
          const receipt = receipts?.find(r => r.plan_id === plan.id);
          
          // 수량 계산 수정: 예정 수량은 Plan 기준, 실 수량은 Receipt 기준
          const totalExpected = plan.inbound_plan_lines?.reduce((sum: number, l: any) => sum + l.expected_qty, 0) || 0;
          const totalReceived = receipt?.lines?.reduce((sum: number, l: any) => sum + l.received_qty, 0) || 0;
          
          const photoCount = receipt?.photos?.[0]?.count || 0;
          const hasPhotos = photoCount > 0;

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

  // 삭제 핸들러 추가
  const handleDelete = async (planId: string) => {
      if (!confirm('정말 삭제하시겠습니까? 관련 데이터가 모두 삭제됩니다.')) return;
      
      try {
          const result = await deleteInboundPlan(planId);
          if (result.error) {
              alert(result.error);
          } else {
              alert('삭제되었습니다.');
              refreshData();
          }
      } catch (e) {
          console.error(e);
          alert('삭제 중 오류가 발생했습니다.');
      }
  };

  const handleQuickConfirm = async (receiptId: string) => {
      // ... (기존 코드)

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
                                                  onClick={() => router.push(`/inbound/${plan.receipt_id}`)}
                                                  className="text-indigo-600 hover:text-indigo-900 border border-indigo-200 px-3 py-1 rounded bg-white hover:bg-indigo-50"
                                              >
                                                  어드민 상세
                                              </button>
                                              <button 
                                                  onClick={() => {
                                                      const url = `${window.location.origin}/ops/inbound/${plan.id}`;
                                                      navigator.clipboard.writeText(url).then(() => alert('현장 URL이 복사되었습니다: ' + url));
                                                      window.open(url, '_blank');
                                                  }}
                                                  className="text-gray-700 hover:text-gray-900 border border-gray-200 px-3 py-1 rounded bg-white hover:bg-gray-50"
                                              >
                                                  현장 (새창)
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
                                              onClick={() => {
                                                  // Receipt가 없을 때는 Plan ID로 접속 시도 (Ops 페이지에서 처리)
                                                  const url = `${window.location.origin}/ops/inbound/${plan.id}`;
                                                  window.open(url, '_blank');
                                              }}
                                              className="text-blue-600 hover:text-blue-900 border border-blue-200 px-3 py-1 rounded bg-white hover:bg-blue-50"
                                          >
                                              입고 시작
                                          </button>
                                      )}
                                      
                                      {/* 삭제 버튼 */}
                                      {!plan.receipt_id || (plan.displayStatus !== 'CONFIRMED' && plan.displayStatus !== 'PUTAWAY_READY') ? (
                                          <button
                                              onClick={() => handleDelete(plan.id)}
                                              className="text-red-400 hover:text-red-600 border border-red-100 px-3 py-1 rounded bg-white hover:bg-red-50"
                                              title="삭제"
                                          >
                                              🗑️
                                          </button>
                                      ) : null}
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
