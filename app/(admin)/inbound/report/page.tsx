'use client';

import { Suspense, useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

function InboundReportContent() {
  const searchParams = useSearchParams();
  const receiptId = searchParams?.get('receipt_id');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  const fetchReport = useCallback(async () => {
    // 1. Receipt & Plan 정보
    const { data: receipt } = await supabase
        .from('inbound_receipts')
        .select(`
            *,
            client:client_id (name, address_line1, contact_phone),
            warehouse:warehouse_id (name, address_line1),
            plan:plan_id (plan_no, planned_date)
        `)
        .eq('id', receiptId)
        .single();
    
    if (!receipt) {
        setLoading(false);
        return;
    }

    // 2. Receipt Lines (상품)
    const { data: lines } = await supabase
        .from('inbound_receipt_lines')
        .select(`
            *,
            product:product_id (name, sku)
        `)
        .eq('receipt_id', receiptId);

    setReport({ receipt, lines });
    setLoading(false);
  }, [receiptId, supabase]);

  useEffect(() => {
    if (receiptId) fetchReport();
  }, [receiptId, fetchReport]);

  const handlePrint = () => {
      window.print();
  };

  if (loading) return <div className="p-10 text-center">리포트 생성 중...</div>;
  if (!report) return <div className="p-10 text-center">리포트 정보를 찾을 수 없습니다.</div>;

  const { receipt, lines } = report;
  const totalReceived = lines.reduce((sum: number, l: any) => sum + l.received_qty, 0);
  const totalDamaged = lines.reduce((sum: number, l: any) => sum + l.damaged_qty, 0);

  return (
    <div className="max-w-4xl mx-auto bg-white p-10 min-h-screen print:p-0">
      {/* 인쇄 버튼 (화면에서만 보임) */}
      <div className="flex justify-end mb-8 print:hidden">
        <button 
            onClick={handlePrint}
            className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900"
        >
            🖨 인쇄 / PDF 저장
        </button>
      </div>

      {/* 리포트 헤더 */}
      <div className="border-b-2 border-gray-800 pb-6 mb-8">
          <div className="flex justify-between items-start">
              <div>
                  <h1 className="text-3xl font-bold text-gray-900">입고확인서</h1>
                  <p className="text-gray-500 mt-1">Inbound Confirmation Report</p>
              </div>
              <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">{receipt.receipt_no}</div>
                  <p className="text-sm text-gray-500">입고일자: {new Date(receipt.confirmed_at || receipt.updated_at).toLocaleDateString()}</p>
              </div>
          </div>
      </div>

      {/* 기본 정보 */}
      <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
              <h3 className="text-sm font-bold text-gray-500 uppercase mb-2">공급받는 자 (화주사)</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="font-bold text-lg">{receipt.client?.name}</p>
                  <p className="text-gray-600 text-sm mt-1">{receipt.client?.address_line1}</p>
                  <p className="text-gray-600 text-sm">{receipt.client?.contact_phone}</p>
              </div>
          </div>
          <div>
              <h3 className="text-sm font-bold text-gray-500 uppercase mb-2">공급자 (물류센터)</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="font-bold text-lg">{receipt.warehouse?.name}</p>
                  <p className="text-gray-600 text-sm mt-1">{receipt.warehouse?.address_line1}</p>
                  <p className="text-gray-600 text-sm">ANH Logistics</p>
              </div>
          </div>
      </div>

      {/* 입고 명세 */}
      <div className="mb-8">
          <table className="w-full text-left border-collapse">
              <thead>
                  <tr className="border-b-2 border-gray-800">
                      <th className="py-3 text-sm font-bold text-gray-600 w-16">No.</th>
                      <th className="py-3 text-sm font-bold text-gray-600">상품명 / SKU</th>
                      <th className="py-3 text-sm font-bold text-gray-600 text-center w-24">예정</th>
                      <th className="py-3 text-sm font-bold text-gray-600 text-center w-24">정상입고</th>
                      <th className="py-3 text-sm font-bold text-gray-600 text-center w-24 text-red-600">불량/파손</th>
                      <th className="py-3 text-sm font-bold text-gray-600 text-right w-32">비고</th>
                  </tr>
              </thead>
              <tbody>
                  {lines.map((line: any, idx: number) => (
                      <tr key={line.id} className="border-b border-gray-200">
                          <td className="py-4 text-sm text-gray-500">{idx + 1}</td>
                          <td className="py-4">
                              <p className="font-bold text-gray-900">{line.product?.name}</p>
                              <p className="text-xs text-gray-500">{line.product?.sku}</p>
                          </td>
                          <td className="py-4 text-center font-medium text-gray-600">{line.expected_qty}</td>
                          <td className="py-4 text-center font-bold text-blue-600 bg-blue-50 rounded">{line.received_qty}</td>
                          <td className="py-4 text-center font-bold text-red-600">{line.damaged_qty > 0 ? line.damaged_qty : '-'}</td>
                          <td className="py-4 text-right text-xs text-gray-500">
                              {line.missing_qty > 0 ? `미입고 ${line.missing_qty}` : ''}
                          </td>
                      </tr>
                  ))}
              </tbody>
              <tfoot>
                  <tr className="border-t-2 border-gray-800 bg-gray-50">
                      <td colSpan={3} className="py-4 px-4 font-bold text-right">합계</td>
                      <td className="py-4 text-center font-bold text-xl text-blue-800">{totalReceived}</td>
                      <td className="py-4 text-center font-bold text-xl text-red-800">{totalDamaged}</td>
                      <td></td>
                  </tr>
              </tfoot>
          </table>
      </div>

      {/* 하단 서명란 */}
      <div className="mt-16 grid grid-cols-2 gap-20">
          <div className="border-t border-gray-300 pt-4 text-center">
              <p className="text-sm text-gray-500 mb-8">담당자 확인 (물류센터)</p>
              <div className="h-16 border-b border-dashed border-gray-300 w-2/3 mx-auto"></div>
          </div>
          <div className="border-t border-gray-300 pt-4 text-center">
              <p className="text-sm text-gray-500 mb-8">화주사 확인</p>
              <div className="h-16 border-b border-dashed border-gray-300 w-2/3 mx-auto"></div>
          </div>
      </div>

      <div className="mt-10 text-center text-xs text-gray-400">
          * 본 문서는 ANH WMS 시스템에서 {new Date().toLocaleString()}에 출력되었습니다.
      </div>
    </div>
  );
}

export default function InboundReportPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">로딩 중...</div>}>
      <InboundReportContent />
    </Suspense>
  );
}
