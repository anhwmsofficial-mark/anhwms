'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { getInboundPhotos, deleteInboundPhoto } from '@/app/actions/inbound-photo';

type TabKey = 'info' | 'photos';

export default function InboundAdminDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('info');
  const [receipt, setReceipt] = useState<any>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);

  const loadData = async () => {
    setLoading(true);
    const { data: receiptData } = await supabase
      .from('inbound_receipts')
      .select('*, client:client_id(name), plan:plan_id(plan_no, planned_date)')
      .eq('id', id) // URL id is receipt_id
      .single();

    if (!receiptData) {
      setLoading(false);
      return;
    }
    setReceipt(receiptData);

    // 1. Receipt Lines 조회
    // 명시적 FK 사용 (500 에러 방지)
    const { data: receiptLines } = await supabase
      .from('inbound_receipt_lines')
      .select('*, product:products!fk_inbound_receipt_lines_product(name, sku)')
      .eq('receipt_id', receiptData.id);

    // 2. Plan Lines 조회 (Receipt Lines가 없을 경우 대비)
    // 명시적 FK 사용 (500 에러 방지)
    const { data: planLines } = await supabase
        .from('inbound_plan_lines')
        .select('*, product:products!fk_inbound_plan_lines_product(name, sku)')
        .eq('plan_id', receiptData.plan_id);

    // 3. 병합 로직: Receipt Line이 있으면 그것을 쓰고, 없으면 Plan Line을 보여줌 (수량 비교 등)
    // 여기서는 간단히 리스트 표시 목적이므로, Receipt Lines가 있으면 우선 표시, 없으면 Plan Lines 표시
    // 더 나은 UX: Plan Lines를 기준으로 Receipt Status를 병기
    
    let displayLines = [];
    if (receiptLines && receiptLines.length > 0) {
        displayLines = receiptLines;
    } else if (planLines && planLines.length > 0) {
        displayLines = planLines.map(pl => ({
            ...pl,
            received_qty: 0, // 아직 입고 전
            product: pl.product // product 정보 유지
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

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
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
                  <div className="text-gray-500">예정: {line.expected_qty} · 실물: {line.received_qty}</div>
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
                    <div key={photo.id} className="relative border rounded-lg overflow-hidden">
                      <img src={photo.url} alt="inbound" className="w-full h-32 object-cover" />
                      <button
                        onClick={() => handleDeletePhoto(photo.id)}
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
    </div>
  );
}
