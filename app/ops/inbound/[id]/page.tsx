'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { saveInboundPhoto, saveReceiptLines, confirmReceipt } from '@/app/actions/inbound';

export default function InboundProcessPage() {
  const { id } = useParams(); // plan_id
  const router = useRouter();
  const supabase = createClient();

  const [receipt, setReceipt] = useState<any>(null);
  const [slots, setSlots] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) fetchReceiptData();
  }, [id]);

  const fetchReceiptData = async () => {
    // 1. Receipt 정보 조회 (Plan ID로 연결된 Receipt 찾기)
    const { data: receiptData } = await supabase
      .from('inbound_receipts')
      .select(`
        *,
        client:client_id (name)
      `)
      .eq('plan_id', id)
      .single();

    if (!receiptData) {
      alert('입고 정보를 찾을 수 없습니다.');
      return;
    }
    setReceipt(receiptData);

    // 2. 사진 가이드 슬롯 조회
    const { data: slotData } = await supabase
      .from('inbound_photo_slots')
      .select('*')
      .eq('receipt_id', receiptData.id)
      .order('sort_order');
    
    // 업로드된 사진 카운트 매핑 필요 (View 활용)
    const { data: progressData } = await supabase
        .from('v_inbound_receipt_photo_progress')
        .select('*')
        .eq('receipt_id', receiptData.id);

    // 슬롯에 진행상황 병합
    const mergedSlots = slotData?.map(slot => {
        const progress = progressData?.find((p: any) => p.slot_id === slot.id);
        return {
            ...slot,
            uploaded_count: progress?.uploaded_count || 0,
            slot_ok: progress?.slot_ok || false
        };
    }) || [];
    setSlots(mergedSlots);

    // 3. 입고 라인 (수량 입력용) 조회
    // 아직 Receipt Line이 생성되지 않았을 수 있음 -> Plan Line에서 가져와서 보여주거나 동적 생성
    // 여기서는 Plan Line을 기준으로 보여주고, 입력 시 Receipt Line 업데이트한다고 가정
    const { data: planLines } = await supabase
      .from('inbound_plan_lines')
      .select('*, product:product_id (name)') // product join 필요
      .eq('plan_id', id);
    
    // Receipt Line이 있으면 그것을 우선, 없으면 Plan Line을 기반으로 초기값 설정
    const { data: receiptLines } = await supabase
      .from('inbound_receipt_lines')
      .select('*')
      .eq('receipt_id', receiptData.id);

    const mergedLines = planLines?.map(pl => {
        const rl = receiptLines?.find((r: any) => r.plan_line_id === pl.id);
        return {
            plan_line_id: pl.id,
            product_id: pl.product_id, // 추가
            product_name: pl.product?.name || 'Unknown Product', // pl.product?.name
            expected_qty: pl.expected_qty,
            received_qty: rl?.received_qty || 0,
            receipt_line_id: rl?.id
        };
    }) || [];
    setLines(mergedLines);
    
    setLoading(false);
  };

  const handlePhotoUpload = async (slotId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    
    setUploading(true);
    const file = event.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${receipt.id}/${slotId}/${Math.random()}.${fileExt}`;

    try {
      // 1. Storage 업로드
      const { error: uploadError } = await supabase.storage
        .from('inbound') // 버킷 이름 (생성 필요)
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // 2. DB 정보 저장 (Server Action)
      await saveInboundPhoto({
        org_id: receipt.org_id,
        receipt_id: receipt.id,
        slot_id: slotId,
        storage_bucket: 'inbound',
        storage_path: fileName,
        mime_type: file.type,
        file_size: file.size,
        uploaded_at: new Date().toISOString()
      });

      // 3. UI 갱신
      await fetchReceiptData();
      alert('사진이 업로드되었습니다.');

    } catch (error: any) {
      console.error('Upload error:', error);
      alert('업로드 실패: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleQtyChange = (index: number, qty: number) => {
    const newLines = [...lines];
    newLines[index].received_qty = qty;
    setLines(newLines);
  };

  const handleSaveQty = async () => {
    setSaving(true);
    try {
      await saveReceiptLines(receipt.id, lines);
      await fetchReceiptData(); // ID 등 갱신
      alert('수량이 저장되었습니다.');
    } catch (err: any) {
      alert('저장 실패: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    if (!confirm('검수를 완료하시겠습니까? 완료 후에는 수정할 수 없습니다.')) return;
    
    // 수량 저장 먼저 수행
    await saveReceiptLines(receipt.id, lines);

    const result = await confirmReceipt(receipt.id);
    if (result.error) {
        alert(result.error);
    } else {
        alert('입고 검수가 완료되었습니다.');
        await fetchReceiptData();
    }
  };

  if (loading) return <div className="p-6 text-center">로딩 중...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 헤더 */}
      <div className="bg-white p-4 shadow-sm sticky top-0 z-10">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{receipt.receipt_no}</h1>
            <p className="text-sm text-gray-500">{receipt.client?.name}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold 
            ${receipt.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
            {receipt.status}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-6">
        
        {/* 1. 사진 촬영 섹션 */}
        <section>
          <h2 className="text-md font-bold text-gray-800 mb-3 flex items-center">
            📸 필수 촬영 가이드
            <span className="ml-2 text-xs font-normal text-gray-500">(터치하여 업로드)</span>
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {slots.map(slot => (
              <label key={slot.id} className={`relative flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all
                ${slot.slot_ok ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-white hover:border-blue-400'}`}>
                
                <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment" 
                    className="hidden" 
                    onChange={(e) => handlePhotoUpload(slot.id, e)}
                    disabled={uploading || receipt.status === 'CONFIRMED'}
                />
                
                <div className="text-3xl mb-2">{slot.slot_ok ? '✅' : '📷'}</div>
                <div className="text-sm font-medium text-center text-gray-900">{slot.title}</div>
                <div className="text-xs text-gray-500 mt-1">
                    {slot.uploaded_count} / {slot.min_photos}장
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* 2. 입고 수량 입력 섹션 */}
        <section>
          <h2 className="text-md font-bold text-gray-800 mb-3">📦 수량 확인</h2>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {lines.map((line, idx) => (
              <div key={idx} className="p-4 border-b last:border-b-0">
                <div className="flex justify-between mb-2">
                    <span className="font-medium text-gray-900">{line.product_name}</span>
                    <span className="text-xs text-gray-500">예정: {line.expected_qty}개</span>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        className="w-10 h-10 rounded-full bg-gray-100 text-xl font-bold text-gray-600 disabled:opacity-50"
                        onClick={() => handleQtyChange(idx, Math.max(0, line.received_qty - 1))}
                        disabled={receipt.status === 'CONFIRMED'}
                    >-</button>
                    <input 
                        type="number" 
                        value={line.received_qty}
                        onChange={(e) => handleQtyChange(idx, parseInt(e.target.value) || 0)}
                        className="flex-1 text-center text-lg font-bold border-gray-300 rounded-lg py-2 disabled:bg-gray-100"
                        disabled={receipt.status === 'CONFIRMED'}
                    />
                    <button 
                        className="w-10 h-10 rounded-full bg-blue-100 text-xl font-bold text-blue-600 disabled:opacity-50"
                        onClick={() => handleQtyChange(idx, line.received_qty + 1)}
                        disabled={receipt.status === 'CONFIRMED'}
                    >+</button>
                </div>
                {line.expected_qty !== line.received_qty && (
                    <div className="mt-2 text-xs text-red-500 font-medium text-center">
                        ⚠️ 예정 수량과 {Math.abs(line.expected_qty - line.received_qty)}개 차이
                    </div>
                )}
              </div>
            ))}
          </div>
          {receipt.status !== 'CONFIRMED' && (
            <button 
                onClick={handleSaveQty}
                disabled={saving}
                className="w-full mt-4 bg-gray-800 text-white py-3 rounded-xl font-bold shadow-lg disabled:opacity-70"
            >
                {saving ? '저장 중...' : '수량 임시 저장'}
            </button>
          )}
        </section>

        {/* 3. 완료 버튼 */}
        {receipt.status !== 'CONFIRMED' && (
            <button 
                onClick={handleConfirm}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-blue-700 transition"
            >
                검수 완료 및 제출
            </button>
        )}
      </div>
    </div>
  );
}
