'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { getInboundPhotos, deleteInboundPhoto } from '@/app/actions/inbound-photo';

type TabKey = 'info' | 'photos' | 'receipt';

export default function InboundAdminDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('info');
  const [receipt, setReceipt] = useState<any>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const receiptRef = useRef<HTMLDivElement | null>(null);

  const loadData = async () => {
    setLoading(true);
    const { data: receiptData } = await supabase
      .from('inbound_receipts')
      .select(`
        *,
        client:client_id(name, address_line1, address_line2, city, contact_name, contact_phone),
        plan:plan_id(plan_no, planned_date, inbound_manager, notes),
        warehouse:warehouse_id(name, address_line1, address_line2, city)
      `)
      .eq('id', id) // URL id is receipt_id
      .single();

    if (!receiptData) {
      setLoading(false);
      return;
    }
    setReceipt(receiptData);

    // 1. Receipt Lines 조회
    // 명시적 FK 사용 (500 에러 방지)
    const { data: receiptLines, error: receiptLinesError } = await supabase
      .from('inbound_receipt_lines')
      .select('*, product:products!fk_inbound_receipt_lines_product(name, sku, barcode)')
      .eq('receipt_id', receiptData.id);

    // 조인 실패 시 fallback
    let safeReceiptLines = receiptLines || [];
    if (receiptLinesError) {
        const { data: fallbackReceiptLines } = await supabase
          .from('inbound_receipt_lines')
          .select('*')
          .eq('receipt_id', receiptData.id);
        safeReceiptLines = (fallbackReceiptLines || []).map((rl: any) => ({
            ...rl,
            product: { name: '상품명 불러오기 실패', sku: '' }
        }));
    }

    // 2. Plan Lines 조회 (Receipt Lines가 없을 경우 대비)
    // 명시적 FK 사용 (500 에러 방지)
    const { data: planLines, error: planLinesError } = await supabase
        .from('inbound_plan_lines')
        .select('*, product:products!fk_inbound_plan_lines_product(name, sku, barcode)')
        .eq('plan_id', receiptData.plan_id);

    let safePlanLines = planLines || [];
    if (planLinesError) {
        const { data: fallbackPlanLines } = await supabase
          .from('inbound_plan_lines')
          .select('*')
          .eq('plan_id', receiptData.plan_id);
        safePlanLines = (fallbackPlanLines || []).map((pl: any) => ({
            ...pl,
            product: { name: '상품명 불러오기 실패', sku: '' },
            received_qty: 0
        }));
    }

    // 3. 병합 로직: Receipt Line이 있으면 그것을 쓰고, 없으면 Plan Line을 보여줌 (수량 비교 등)
    // 여기서는 간단히 리스트 표시 목적이므로, Receipt Lines가 있으면 우선 표시, 없으면 Plan Lines 표시
    // 더 나은 UX: Plan Lines를 기준으로 Receipt Status를 병기
    
    const planLineMap = new Map(safePlanLines.map((pl: any) => [pl.id, pl]));
    let displayLines = [];
    if (safePlanLines && safePlanLines.length > 0) {
        displayLines = safePlanLines.map((pl: any) => {
            const rl = safeReceiptLines?.find((r: any) => r.plan_line_id === pl.id);
            return {
                ...pl,
                receipt_line_id: rl?.id,
                received_qty: (rl?.accepted_qty ?? rl?.received_qty) || 0,
                accepted_qty: rl?.accepted_qty ?? null,
                damaged_qty: rl?.damaged_qty || 0,
                missing_qty: rl?.missing_qty || 0,
                other_qty: rl?.other_qty || 0,
                product: rl?.product || pl.product
            };
        });
    } else if (safeReceiptLines && safeReceiptLines.length > 0) {
        displayLines = safeReceiptLines.map((rl: any) => ({
            ...rl,
            product: rl.product,
            plan_line_id: rl.plan_line_id,
            expected_qty: planLineMap.get(rl.plan_line_id)?.expected_qty,
            box_count: planLineMap.get(rl.plan_line_id)?.box_count,
            pallet_text: planLineMap.get(rl.plan_line_id)?.pallet_text,
            mfg_date: planLineMap.get(rl.plan_line_id)?.mfg_date,
            expiry_date: planLineMap.get(rl.plan_line_id)?.expiry_date,
            line_notes: planLineMap.get(rl.plan_line_id)?.line_notes
        }));
    }
    
    setLines(displayLines || []);

    const { data: slotData } = await supabase
      .from('inbound_photo_slots')
      .select('*')
      .eq('receipt_id', receiptData.id)
      .order('sort_order');

    const slotsWithPhotos = await Promise.all(
      (slotData || []).map(async (slot) => {
        const photos = await getInboundPhotos(receiptData.id, slot.id);
        return { ...slot, photos };
      })
    );
    setSlots(slotsWithPhotos);
    setLoading(false);
  };

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const handleDeletePhoto = async (photoId: string) => {
    if (!receipt) return;
    if (!confirm('사진을 삭제하시겠습니까?')) return;
    await deleteInboundPhoto(photoId, receipt.id);
    await loadData();
  };

  if (loading) return <div className="p-6 text-center">로딩 중...</div>;
  if (!receipt) return <div className="p-6 text-center text-gray-500">입고 정보를 찾을 수 없습니다.</div>;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!receiptRef.current) return;
    setPdfLoading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      if (imgHeight > pageHeight) {
        let heightLeft = imgHeight - pageHeight;
        while (heightLeft > 0) {
          position -= pageHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }
      }

      pdf.save(`receipt-${receipt.receipt_no}.pdf`);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 12mm;
          }
          body * {
            visibility: hidden;
          }
          .print-receipt,
          .print-receipt * {
            visibility: visible;
          }
          .print-receipt {
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
            background: #ffffff;
            color: #000000;
          }
          .print-hide {
            display: none !important;
          }
          .print-receipt h2 {
            font-size: 16pt;
          }
          .print-receipt .print-block {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .print-receipt .print-table-row {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .print-receipt .print-table-header {
            background: #f5f5f5 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{receipt.receipt_no}</h1>
          <div className="text-sm text-gray-500">
            {receipt.client?.name} · {receipt.plan?.plan_no} · {receipt.plan?.planned_date}
          </div>
        </div>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
        >
          뒤로가기
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('info')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'info' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          기본 정보
        </button>
        <button
          onClick={() => setActiveTab('photos')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'photos' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          사진
        </button>
        <button
          onClick={() => setActiveTab('receipt')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'receipt' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          인수증
        </button>
      </div>

      {activeTab === 'info' && (
        <div className="bg-white rounded-xl border p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div><span className="text-gray-500">상태:</span> {receipt.status}</div>
            <div><span className="text-gray-500">도착:</span> {receipt.arrived_at || '-'}</div>
            <div><span className="text-gray-500">완료:</span> {receipt.confirmed_at || '-'}</div>
          </div>

          <div className="mt-6">
            <h2 className="font-bold text-gray-900 mb-2">입고 라인</h2>
            <div className="space-y-2">
              {lines.map((line) => (
                <div key={line.id} className="border rounded-lg p-3 text-sm">
                  <div className="font-medium">{line.product?.name} ({line.product?.sku})</div>
                  <div className="text-gray-500">
                    예정: {line.expected_qty} · 정상: {line.accepted_qty ?? line.received_qty ?? 0}
                    · 파손: {line.damaged_qty || 0} · 분실: {line.missing_qty || 0} · 기타: {line.other_qty || 0}
                  </div>
                </div>
              ))}
              {lines.length === 0 && <div className="text-gray-500">라인 정보가 없습니다.</div>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'photos' && (
        <div className="space-y-4">
          {slots.map((slot: any) => (
            <div key={slot.id} className="bg-white rounded-xl border p-4">
              <div className="flex justify-between items-center mb-3">
                <div className="font-bold">{slot.title}</div>
                <div className="text-xs text-gray-500">{slot.photos.length} / {slot.min_photos} 장</div>
              </div>
              {slot.photos.length === 0 ? (
                <div className="text-gray-400 text-sm">등록된 사진이 없습니다.</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {slot.photos.map((photo: any) => (
                    <div
                      key={photo.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedPhotoUrl(photo.url)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') setSelectedPhotoUrl(photo.url);
                      }}
                      className="relative border rounded-lg overflow-hidden text-left cursor-zoom-in"
                    >
                      <img src={photo.url} alt="inbound" className="w-full h-32 object-cover" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePhoto(photo.id);
                        }}
                        className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'receipt' && (
        <div className="bg-white rounded-xl border p-4 space-y-6">
          <div className="flex flex-wrap gap-2 justify-end print-hide">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              인쇄
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={pdfLoading}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
            >
              {pdfLoading ? 'PDF 생성 중...' : 'PDF 저장'}
            </button>
          </div>

          <div ref={receiptRef} className="print-receipt space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-gray-900">인수증</h2>
              <p className="text-xs text-gray-500">입고 검수 및 인수 내역</p>
            </div>
            <div className="text-sm text-gray-700">
              인수번호: <span className="font-semibold">{receipt.receipt_no}</span>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden print-block">
            <div className="grid grid-cols-1 md:grid-cols-2 text-sm">
              <div className="border-b md:border-b-0 md:border-r p-3">
                <div className="text-xs text-gray-500">거래처명</div>
                <div className="font-semibold text-gray-900">{receipt.client?.name || '-'}</div>
              </div>
              <div className="p-3">
                <div className="text-xs text-gray-500">입고지점</div>
                <div className="font-semibold text-gray-900">{receipt.warehouse?.name || '미지정'}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 text-sm border-t">
              <div className="border-b md:border-b-0 md:border-r p-3">
                <div className="text-xs text-gray-500">출하지주소</div>
                <div className="font-semibold text-gray-900">
                  {receipt.client?.address_line1 || receipt.client?.address_line2 || receipt.client?.city
                    ? [receipt.client?.address_line1, receipt.client?.address_line2, receipt.client?.city].filter(Boolean).join(' ')
                    : '미등록'}
                </div>
              </div>
              <div className="p-3">
                <div className="text-xs text-gray-500">입고지주소</div>
                <div className="font-semibold text-gray-900">
                  {receipt.warehouse?.address_line1 || receipt.warehouse?.address_line2 || receipt.warehouse?.city
                    ? [receipt.warehouse?.address_line1, receipt.warehouse?.address_line2, receipt.warehouse?.city].filter(Boolean).join(' ')
                    : '미등록'}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 text-sm border-t">
              <div className="border-b md:border-b-0 md:border-r p-3">
                <div className="text-xs text-gray-500">입고날짜</div>
                <div className="font-semibold text-gray-900">{receipt.plan?.planned_date || receipt.arrived_at || '-'}</div>
              </div>
              <div className="border-b md:border-b-0 md:border-r p-3">
                <div className="text-xs text-gray-500">관리담당자</div>
                <div className="font-semibold text-gray-900">{receipt.plan?.inbound_manager || receipt.client?.contact_name || '미지정'}</div>
              </div>
              <div className="p-3">
                <div className="text-xs text-gray-500">연락처</div>
                <div className="font-semibold text-gray-900">{receipt.client?.contact_phone || '-'}</div>
              </div>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden print-block">
            <div className="grid grid-cols-7 bg-gray-50 text-xs font-semibold text-gray-600 print-table-header">
              <div className="col-span-2 p-3 border-r">제품 정보</div>
              <div className="p-3 border-r">바코드</div>
              <div className="p-3 border-r">박스</div>
              <div className="p-3 border-r">수량</div>
              <div className="p-3 border-r">유통/제조일자</div>
              <div className="p-3">비고</div>
            </div>
            <div className="divide-y text-sm">
              {lines.map((line) => (
                <div key={line.id} className="grid grid-cols-7 print-table-row">
                  <div className="col-span-2 p-3 border-r">
                    <div className="font-semibold text-gray-900">{line.product?.name || '상품명 없음'}</div>
                  </div>
                  <div className="p-3 border-r text-gray-700">{line.product?.barcode || '-'}</div>
                  <div className="p-3 border-r text-gray-700">{line.box_count || '-'}</div>
                  <div className="p-3 border-r text-gray-700">{line.accepted_qty ?? line.received_qty ?? 0}</div>
                  <div className="p-3 border-r text-gray-700">
                    {line.mfg_date || line.expiry_date
                      ? `${line.mfg_date || '-'} / ${line.expiry_date || '-'}`
                      : '-'}
                  </div>
                  <div className="p-3 text-gray-700">
                    {(() => {
                      const baseNote = line.line_notes || line.notes || line.pallet_text || '';
                      const issueParts = [
                        line.damaged_qty > 0 ? `파손 ${line.damaged_qty}개` : null,
                        line.missing_qty > 0 ? `분실 ${line.missing_qty}개` : null,
                        line.other_qty > 0 ? `기타 ${line.other_qty}개` : null,
                      ].filter(Boolean);
                      const issueNote = issueParts.length > 0 ? issueParts.join(', ') : '';
                      const combined = [baseNote, issueNote].filter(Boolean).join(' · ');
                      return combined || '-';
                    })()}
                  </div>
                </div>
              ))}
              {lines.length === 0 && (
                <div className="p-6 text-center text-gray-400">표시할 품목이 없습니다.</div>
              )}
            </div>
          </div>

          <div className="border rounded-lg p-3 text-sm text-gray-600 print-block">
            비고: {receipt.plan?.notes || '없음'}
          </div>
          </div>
        </div>
      )}

      {selectedPhotoUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setSelectedPhotoUrl(null)}>
          <div className="relative max-h-[90vh] max-w-[95vw] overflow-auto bg-black/70 rounded-xl p-3" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setSelectedPhotoUrl(null)}
              className="absolute top-3 right-3 text-white text-2xl"
            >
              &times;
            </button>
            <img
              src={selectedPhotoUrl}
              alt="확대 사진"
              className="w-auto h-auto max-w-full max-h-[80vh] sm:max-h-none sm:max-w-none object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
