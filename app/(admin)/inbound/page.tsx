'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function InboundPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    fetchPlans();

    // Supabase Realtime 구독 설정
    // inbound_receipts 테이블의 변경사항을 감지하여 목록 자동 갱신
    const channel = supabase
      .channel('inbound-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE 모두 감지
          schema: 'public',
          table: 'inbound_receipts'
        },
        (payload) => {
          console.log('Realtime change received:', payload);
          // 변경이 감지되면 목록 새로고침
          // 최적화를 위해 payload 내용을 보고 로컬 state만 업데이트할 수도 있지만,
          // 데이터 정합성을 위해 전체 다시 로드가 안전함
          fetchPlans();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchPlans = async () => {
    // 1. Inbound Plans 조회
    const { data: plansData, error } = await supabase
      .from('inbound_plans')
      .select(`
        *,
        client:client_id (name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
        console.error(error);
        setLoading(false);
        return;
    }

    // 2. 연결된 Receipt 정보 조회 (상태 표시용)
    // Supabase Join이 복잡할 수 있으므로 별도 조회 후 병합하거나 View 사용 추천
    // 여기서는 plan_id 목록으로 receipt 조회
    const planIds = plansData.map(p => p.id);
    const { data: receiptsData } = await supabase
        .from('inbound_receipts')
        .select('plan_id, status, receipt_no, total_box_count, confirmed_at')
        .in('plan_id', planIds);

    // 데이터 병합
    const mergedPlans = plansData.map(plan => {
        const receipt = receiptsData?.find(r => r.plan_id === plan.id);
        return {
            ...plan,
            receipt_status: receipt?.status || 'PENDING', // Receipt가 아직 없으면 PENDING
            receipt_no: receipt?.receipt_no,
            confirmed_at: receipt?.confirmed_at
        };
    });

    setPlans(mergedPlans);
    setLoading(false);
  };

  // 통계 계산
  const stats = {
      submitted: plans.filter(p => p.receipt_status === 'ARRIVED' || p.status === 'SUBMITTED').length,
      processing: plans.filter(p => ['COUNTING', 'INSPECTING', 'PHOTO_REQUIRED'].includes(p.receipt_status)).length,
      issue: plans.filter(p => p.receipt_status === 'DISCREPANCY').length,
      completed: plans.filter(p => p.receipt_status === 'CONFIRMED').length
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">입고 관리 (Inbound)</h1>
        <button
          onClick={() => router.push('/admin/inbound/new')}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          + 입고 예정 등록
        </button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">입고 대기</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {stats.submitted} 건
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">검수 진행 중</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            {stats.processing} 건
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">이슈 발생</div>
          <div className="text-2xl font-bold text-red-600 mt-1">
            {stats.issue} 건
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500">입고 완료</div>
          <div className="text-2xl font-bold text-green-600 mt-1">
            {stats.completed} 건
          </div>
        </div>
      </div>

      {/* 입고 예정 목록 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">입고번호</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">화주사</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">입고예정일</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">진행 상태</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">완료일시</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">관리</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                  로딩 중...
                </td>
              </tr>
            ) : plans.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                  등록된 입고 예정이 없습니다.
                </td>
              </tr>
            ) : (
              plans.map((plan) => (
                <tr key={plan.id} className="hover:bg-gray-50 animate-fade-in">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                    {plan.plan_no}
                    {plan.receipt_no && <span className="block text-xs text-gray-400">{plan.receipt_no}</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {plan.client?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {plan.planned_date}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${plan.receipt_status === 'ARRIVED' ? 'bg-gray-100 text-gray-800' : 
                        plan.receipt_status === 'CONFIRMED' ? 'bg-green-100 text-green-800' : 
                        ['COUNTING', 'INSPECTING', 'PHOTO_REQUIRED'].includes(plan.receipt_status) ? 'bg-blue-100 text-blue-800' :
                        plan.receipt_status === 'DISCREPANCY' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'}`}>
                      {plan.receipt_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {plan.confirmed_at ? new Date(plan.confirmed_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button className="text-blue-600 hover:text-blue-900 mr-4">상세</button>
                    {/* 현장 뷰로 이동 (테스트용) */}
                    <a href={`/ops/inbound/${plan.id}`} className="text-indigo-600 hover:text-indigo-900">
                      현장작업 &rarr;
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
