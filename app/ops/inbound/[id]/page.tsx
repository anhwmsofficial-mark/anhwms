'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { saveInboundPhoto, saveReceiptLines, confirmReceipt } from '@/app/actions/inbound';
import { getInboundPhotos, deleteInboundPhoto } from '@/app/actions/inbound-photo';
// @ts-ignore
import BarcodeScanner from '@/components/BarcodeScanner';

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

  // 모달 상태들
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [slotPhotos, setSlotPhotos] = useState<any[]>([]);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [qtyModalOpen, setQtyModalOpen] = useState(false);
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null);
  
  // 바코드 스캔 상태
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    if (id) fetchReceiptData();
  }, [id]);

  const fetchReceiptData = async () => {
    // 1. Receipt 정보 조회
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
    
    const { data: progressData } = await supabase
        .from('v_inbound_receipt_photo_progress')
        .select('*')
        .eq('receipt_id', receiptData.id);

    const mergedSlots = slotData?.map(slot => {
        const progress = progressData?.find((p: any) => p.slot_id === slot.id);
        return {
            ...slot,
            uploaded_count: progress?.uploaded_count || 0,
            slot_ok: progress?.slot_ok || false
        };
    }) || [];
    setSlots(mergedSlots);

    // 3. 입고 라인 (SKU + Barcode 정보 포함)
    const { data: planLines } = await supabase
      .from('inbound_plan_lines')
      .select('*, product:product_id (name, sku, barcode)') // Barcode 추가 조회
      .eq('plan_id', id);
    
    const { data: receiptLines } = await supabase
      .from('inbound_receipt_lines')
      .select('*')
      .eq('receipt_id', receiptData.id);

    const mergedLines = planLines?.map(pl => {
        const rl = receiptLines?.find((r: any) => r.plan_line_id === pl.id);
        return {
            plan_line_id: pl.id,
            product_id: pl.product_id,
            product_name: pl.product?.name || 'Unknown Product',
            product_sku: pl.product?.sku,
            product_barcode: pl.product?.barcode, // 바코드 정보
            expected_qty: pl.expected_qty,
            received_qty: rl?.received_qty || 0,
            damaged_qty: rl?.damaged_qty || 0,
            missing_qty: rl?.missing_qty || 0,
            receipt_line_id: rl?.id
        };
    }) || [];
    setLines(mergedLines);
    
    setLoading(false);
  };

  // ... (기존 핸들러: handlePhotoUpload, loadSlotPhotos, deletePhoto, qtyModal 등 유지) ...
  const handlePhotoUpload = async (slotId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    setUploading(true);
    const file = event.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${receipt.id}/${slotId}/${Math.random()}.${fileExt}`;
    try {
      const { error: uploadError } = await supabase.storage.from('inbound').upload(fileName, file);
      if (uploadError) throw uploadError;
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
      await fetchReceiptData();
      if (selectedSlot === slotId) loadSlotPhotos(slotId);
    } catch (error: any) {
      console.error(error);
      alert('업로드 실패: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const loadSlotPhotos = async (slotId: string) => {
      setPhotoLoading(true);
      const photos = await getInboundPhotos(receipt.id, slotId);
      setSlotPhotos(photos);
      setPhotoLoading(false);
  };

  const openPhotoModal = (slotId: string) => {
      setSelectedSlot(slotId);
      loadSlotPhotos(slotId);
  };

  const handleDeletePhoto = async (photoId: string) => {
      if (!confirm('사진을 삭제하시겠습니까?')) return;
      await deleteInboundPhoto(photoId, receipt.id);
      await fetchReceiptData();
      if (selectedSlot) loadSlotPhotos(selectedSlot);
  };

  const openQtyModal = (index: number) => {
      setSelectedLineIndex(index);
      setQtyModalOpen(true);
  };

  const handleQtyDetailChange = (field: 'received_qty' | 'damaged_qty' | 'missing_qty', value: number) => {
      if (selectedLineIndex === null) return;
      const newLines = [...lines];
      newLines[selectedLineIndex] = { ...newLines[selectedLineIndex], [field]: value };
      setLines(newLines);
  };

  const handleSaveQty = async () => {
    setSaving(true);
    try {
      await saveReceiptLines(receipt.id, lines);
      await fetchReceiptData();
      alert('수량이 저장되었습니다.');
    } catch (err: any) {
      alert('저장 실패: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    if (!confirm('검수를 완료하시겠습니까? 완료 후에는 수정할 수 없습니다.')) return;
    await saveReceiptLines(receipt.id, lines);
    const result = await confirmReceipt(receipt.id);
    if (result.error) {
        alert(result.error);
    } else {
        alert('입고 검수가 완료되었습니다.');
        await fetchReceiptData();
    }
  };

  // 바코드 스캔 핸들러
  const handleScan = (data: string | null) => {
      if (data) {
          // 바코드 매칭 (SKU 또는 Barcode 필드)
          const matchedIndex = lines.findIndex(l => 
              l.product_barcode === data || l.product_sku === data
          );

          if (matchedIndex !== -1) {
              // 매칭된 상품 수량 +1
              const newLines = [...lines];
              newLines[matchedIndex].received_qty += 1;
              setLines(newLines);
              
              setScannerOpen(false); // 스캔 성공 시 닫기 (연속 스캔 모드 고려 가능)
              alert(`[${newLines[matchedIndex].product_name}] 스캔 확인 (+1)`);
          } else {
              alert(`일치하는 상품이 없습니다. (${data})`);
              setScannerOpen(false);
          }
      }
  };

  if (loading) return <div className="p-6 text-center">로딩 중...</div>;
  const currentLine = selectedLineIndex !== null ? lines[selectedLineIndex] : null;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 헤더 */}
      <div className="bg-white p-4 shadow-sm sticky top-0 z-10 flex justify-between items-center">
        <div>
            <h1 className="text-lg font-bold text-gray-900">{receipt.receipt_no}</h1>
            <p className="text-sm text-gray-500">{receipt.client?.name}</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => setScannerOpen(true)}
                className="bg-gray-900 text-white p-2 rounded-lg"
                disabled={receipt.status === 'CONFIRMED'}
            >
                📷 스캔
            </button>
            <span className={`px-3 py-2 rounded-full text-xs font-bold flex items-center
                ${receipt.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                {receipt.status}
            </span>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* 사진 섹션 (기존 유지) */}
        <section>
          <h2 className="text-md font-bold text-gray-800 mb-3 flex items-center">
            📸 필수 촬영 가이드
            <span className="ml-2 text-xs font-normal text-gray-500">(카메라:촬영 / 아이콘:조회)</span>
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {slots.map(slot => (
              <div key={slot.id} className={`relative flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all
                ${slot.slot_ok ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-white'}`}>
                
                <label className="absolute inset-0 z-10 cursor-pointer" onClick={(e) => {
                    if (receipt.status === 'CONFIRMED') e.preventDefault();
                }}>
                    <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment" 
                        className="hidden" 
                        onChange={(e) => handlePhotoUpload(slot.id, e)}
                        disabled={uploading || receipt.status === 'CONFIRMED'}
                    />
                </label>

                {slot.uploaded_count > 0 && (
                    <button 
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openPhotoModal(slot.id);
                        }}
                        className="absolute top-2 right-2 z-20 bg-gray-100 rounded-full p-1 hover:bg-gray-200"
                    >
                        🔍
                    </button>
                )}
                
                <div className="text-3xl mb-2">{slot.slot_ok ? '✅' : '📷'}</div>
                <div className="text-sm font-medium text-center text-gray-900">{slot.title}</div>
                <div className="text-xs text-gray-500 mt-1">
                    {slot.uploaded_count} / {slot.min_photos}장
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 수량 섹션 */}
        <section>
          <h2 className="text-md font-bold text-gray-800 mb-3 flex justify-between items-end">
            <span>📦 수량 확인 및 입력</span>
            <span className="text-xs font-normal text-gray-500">항목을 눌러 수량을 입력하세요</span>
          </h2>
          
          <div className="space-y-3">
            {lines.length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center text-gray-500 border border-dashed border-gray-300">
                    <p>등록된 입고 품목이 없습니다.</p>
                    <p className="text-xs mt-1">(관리자 페이지에서 품목이 정상 등록되었는지 확인해주세요)</p>
                </div>
            ) : (
                lines.map((line, idx) => {
                    const isCompleted = line.received_qty + line.damaged_qty + line.missing_qty >= line.expected_qty;
                    const isPerfect = isCompleted && line.damaged_qty === 0 && line.missing_qty === 0 && line.received_qty === line.expected_qty;
                    
                    return (
                      <div 
                        key={idx} 
                        className={`bg-white rounded-xl p-4 shadow-sm border-2 transition-all active:scale-[0.98] ${
                            isPerfect ? 'border-green-500 bg-green-50' : 
                            isCompleted ? 'border-orange-300 bg-orange-50' : 'border-transparent'
                        }`}
                        onClick={() => openQtyModal(idx)}
                      >
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h3 className="font-bold text-gray-900 text-lg leading-tight">{line.product_name}</h3>
                                <p className="text-sm text-gray-500 font-mono mt-1">{line.product_sku}</p>
                            </div>
                            {isPerfect && <span className="text-2xl">✅</span>}
                        </div>

                        <div className="flex items-center gap-2">
                            {/* 입력란 시각화 (Click trigger) */}
                            <div className="flex-1 bg-gray-100 rounded-lg p-3 flex flex-col items-center justify-center border border-gray-200">
                                <span className="text-xs text-gray-500 mb-1">실수량 (입력)</span>
                                <span className={`text-2xl font-bold ${line.received_qty > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                                    {line.received_qty > 0 ? line.received_qty : '-'}
                                </span>
                            </div>
                            
                            <div className="text-gray-400 font-bold">/</div>

                            <div className="flex-1 bg-white rounded-lg p-3 flex flex-col items-center justify-center border border-gray-200">
                                <span className="text-xs text-gray-500 mb-1">예정 수량</span>
                                <span className="text-2xl font-bold text-gray-900">{line.expected_qty}</span>
                            </div>
                        </div>

                        {(line.damaged_qty > 0 || line.missing_qty > 0) && (
                            <div className="mt-3 text-xs flex gap-2">
                                {line.damaged_qty > 0 && <span className="text-red-600 bg-red-100 px-2 py-1 rounded">파손 {line.damaged_qty}</span>}
                                {line.missing_qty > 0 && <span className="text-orange-600 bg-orange-100 px-2 py-1 rounded">분실 {line.missing_qty}</span>}
                            </div>
                        )}
                      </div>
                    );
                })
            )}
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

        {/* 완료 버튼 */}
        {receipt.status !== 'CONFIRMED' && (
            <button 
                onClick={handleConfirm}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-blue-700 transition"
            >
                검수 완료 및 제출
            </button>
        )}
      </div>

      {/* 모달들 (사진, 수량) */}
      {selectedSlot && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex flex-col">
              <div className="flex justify-between items-center p-4 text-white">
                  <h3 className="font-bold">촬영된 사진</h3>
                  <button onClick={() => setSelectedSlot(null)} className="text-2xl">&times;</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-4">
                  {photoLoading ? (
                      <div className="col-span-2 text-center text-white">로딩 중...</div>
                  ) : slotPhotos.length === 0 ? (
                      <div className="col-span-2 text-center text-gray-400">사진이 없습니다.</div>
                  ) : (
                      slotPhotos.map(photo => (
                          <div key={photo.id} className="relative aspect-square bg-gray-800 rounded-lg overflow-hidden">
                              <img src={photo.url} alt="증빙" className="w-full h-full object-cover" />
                              {receipt.status !== 'CONFIRMED' && (
                                <button 
                                    onClick={() => handleDeletePhoto(photo.id)}
                                    className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-md"
                                >
                                    🗑
                                </button>
                              )}
                              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 text-center">
                                  {new Date(photo.uploaded_at).toLocaleTimeString()}
                              </div>
                          </div>
                      ))
                  )}
              </div>
          </div>
      )}

      {qtyModalOpen && currentLine && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-end sm:items-center justify-center">
              <div className="bg-white w-full sm:w-96 rounded-t-2xl sm:rounded-2xl p-6">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-bold truncate max-w-[200px]">{currentLine.product_name}</h3>
                      <button onClick={() => setQtyModalOpen(false)} className="text-gray-500 text-2xl">&times;</button>
                  </div>
                  
                  <div className="space-y-6">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">✅ 정상 입고</label>
                          <div className="flex items-center gap-3">
                              <button 
                                  className="w-12 h-12 rounded-xl bg-gray-100 text-2xl font-bold"
                                  onClick={() => handleQtyDetailChange('received_qty', Math.max(0, currentLine.received_qty - 1))}
                              >-</button>
                              <input 
                                  type="number" 
                                  className="flex-1 text-center text-2xl font-bold border-gray-300 rounded-xl py-2"
                                  value={currentLine.received_qty}
                                  onChange={(e) => handleQtyDetailChange('received_qty', parseInt(e.target.value) || 0)}
                              />
                              <button 
                                  className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 text-2xl font-bold"
                                  onClick={() => handleQtyDetailChange('received_qty', currentLine.received_qty + 1)}
                              >+</button>
                          </div>
                      </div>

                      <div>
                          <label className="block text-sm font-medium text-red-700 mb-2">💔 파손 (Damage)</label>
                          <div className="flex items-center gap-3">
                              <button 
                                  className="w-12 h-12 rounded-xl bg-gray-100 text-2xl font-bold"
                                  onClick={() => handleQtyDetailChange('damaged_qty', Math.max(0, currentLine.damaged_qty - 1))}
                              >-</button>
                              <input 
                                  type="number" 
                                  className="flex-1 text-center text-2xl font-bold border-red-300 text-red-600 rounded-xl py-2"
                                  value={currentLine.damaged_qty}
                                  onChange={(e) => handleQtyDetailChange('damaged_qty', parseInt(e.target.value) || 0)}
                              />
                              <button 
                                  className="w-12 h-12 rounded-xl bg-red-100 text-red-600 text-2xl font-bold"
                                  onClick={() => handleQtyDetailChange('damaged_qty', currentLine.damaged_qty + 1)}
                              >+</button>
                          </div>
                      </div>

                      <div className="bg-gray-50 p-4 rounded-xl text-center">
                          <p className="text-sm text-gray-500">예정: {currentLine.expected_qty}</p>
                          <p className={`text-lg font-bold mt-1 ${
                              currentLine.expected_qty === (currentLine.received_qty + currentLine.damaged_qty + currentLine.missing_qty)
                              ? 'text-green-600' : 'text-orange-500'
                          }`}>
                              합계: {currentLine.received_qty + currentLine.damaged_qty + currentLine.missing_qty}
                          </p>
                      </div>

                      <button 
                          onClick={() => setQtyModalOpen(false)}
                          className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg"
                      >
                          확인
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* 바코드 스캐너 모달 */}
      {scannerOpen && (
          <BarcodeScanner 
              onScan={handleScan}
              onClose={() => setScannerOpen(false)}
          />
      )}
    </div>
  );
}
