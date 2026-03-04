'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { saveInboundPhoto, saveReceiptLines, confirmReceipt, getOpsInboundData } from '@/app/actions/inbound';
import { getInboundPhotos, deleteInboundPhoto } from '@/app/actions/inbound-photo';
import { XMarkIcon } from '@heroicons/react/24/outline';
// @ts-expect-error BarcodeScanner default export typing mismatch in this module
import BarcodeScanner from '@/components/BarcodeScanner';
import { formatInteger } from '@/utils/number-format';

function toErrorMessage(error: unknown, fallback = '처리 중 오류가 발생했습니다.') {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const candidate = error as {
      message?: unknown;
      error?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };
    if (typeof candidate.message === 'string' && candidate.message.trim()) return candidate.message;
    if (typeof candidate.error === 'string' && candidate.error.trim()) return candidate.error;
    const detailParts = [candidate.details, candidate.hint]
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
    if (detailParts.length > 0) return detailParts.join(' / ');
    if (typeof candidate.code === 'string' && candidate.code.trim()) return `오류 코드: ${candidate.code}`;
    try {
      return JSON.stringify(error);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export default function InboundProcessPage() {
  const { id } = useParams(); // plan_id
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get('mode') === 'edit';
  const supabase = createClient();

  const [receipt, setReceipt] = useState<any>(null);
  const [slots, setSlots] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [locations, setLocations] = useState<any[]>([]); // 로케이션 목록
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [autoStep, setAutoStep] = useState(true);
  const [stepNotice, setStepNotice] = useState<string | null>(null);

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

  const handleExit = () => {
    if (typeof window === 'undefined') return;
    router.push('/inbound');
  };

  const fetchReceiptData = async () => {
    try {
      setLoading(true);
      setLoadError(null);

      const result = await getOpsInboundData(id as string, { requireAdmin: true });
      if ('error' in result || !result?.receipt) {
        setLoadError('error' in result ? toErrorMessage(result.error, '입고 정보를 찾을 수 없습니다.') : '입고 정보를 찾을 수 없습니다.');
        setLoading(false);
        return;
      }

      setReceipt(result.receipt);
      setLocations(result.locations || []);

      const mergedSlots = (result.slots || []).map((slot: any) => {
          const progress = (result.progress || []).find((p: any) => p.slot_id === slot.id);
          return {
              ...slot,
              uploaded_count: progress?.uploaded_count || 0,
              slot_ok: progress?.slot_ok || false
          };
      });
      setSlots(mergedSlots);

      const safePlanLines = (result.planLines || []).map((pl: any) => ({
          ...pl,
          product: pl.product || { name: '상품명 불러오기 실패', sku: '' },
      }));
      const safeReceiptLines = result.receiptLines || [];

      const mergedLines = safePlanLines?.map((pl: any) => {
          const rl = safeReceiptLines?.find((r: any) => r.plan_line_id === pl.id);
          return {
              plan_line_id: pl.id,
              product_id: pl.product_id,
              product_name: pl.product?.name || 'Unknown Product',
              product_sku: pl.product?.sku,
              product_barcode: pl.product?.barcode,
              expected_qty: pl.expected_qty,
              received_qty: (rl?.accepted_qty ?? rl?.received_qty) || 0,
              damaged_qty: rl?.damaged_qty || 0,
              missing_qty: rl?.missing_qty || 0,
              other_qty: rl?.other_qty || 0,
              notes: rl?.notes || '',
              receipt_line_id: rl?.id,
              location_id: rl?.location_id || null
          };
      }) || [];
      setLines(mergedLines);
      setLoading(false);
    } catch (err: any) {
      setLoadError(toErrorMessage(err, '데이터 로딩 중 오류가 발생했습니다.'));
      setLoading(false);
    }
  };

  // ... (기존 핸들러: handlePhotoUpload, loadSlotPhotos, deletePhoto, qtyModal 등 유지) ...
  const handlePhotoUpload = async (slotId: string, source: 'camera' | 'album', event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    setUploading(true);
    const file = event.target.files[0];
    const slot = slots.find((s: any) => s.id === slotId);
    const slotKey = slot?.slot_key || null;
    const maxPhotos = slotKey === 'LABEL_CLOSEUP' || slotKey === 'UNBOXED' || slotKey === 'BOX_OUTER' ? 20 : slot?.min_photos || 1;
    if (slot && slot.uploaded_count >= maxPhotos) {
      alert('해당 항목의 최대 촬영 수량을 초과했습니다.');
      setUploading(false);
      event.target.value = '';
      return;
    }

    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${receipt.id}/${slotId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
    try {
      const { error: uploadError } = await supabase.storage.from('inbound').upload(fileName, file);
      if (uploadError) throw uploadError;

      const stepMap: Record<string, number> = {
        VEHICLE_LEFT: 1,
        VEHICLE_RIGHT: 1,
        PRODUCT_FULL: 2,
        BOX_OUTER: 2,
        LABEL_CLOSEUP: 3,
        UNBOXED: 3,
      };
      const saveInboundPhotoResult = await saveInboundPhoto({
        org_id: receipt.org_id,
        receipt_id: receipt.id,
        plan_id: id,
        slot_id: slotId,
        storage_bucket: 'inbound',
        storage_path: fileName,
        mime_type: file.type,
        file_size: file.size,
        uploaded_at: new Date().toISOString(),
        source,
        photo_type: slotKey,
        step: slotKey ? stepMap[slotKey] || null : null,
      }, { requireAdmin: true });
      if ((saveInboundPhotoResult as any)?.ok === false || (saveInboundPhotoResult as any)?.error) {
        throw new Error(
          toErrorMessage(
            (saveInboundPhotoResult as any)?.errorDetail || (saveInboundPhotoResult as any)?.error,
            '사진 메타데이터 저장에 실패했습니다.',
          ),
        );
      }
      await fetchReceiptData();
      if (selectedSlot === slotId) loadSlotPhotos(slotId);
    } catch (error: any) {
      console.error(error);
      alert(`업로드 실패: ${toErrorMessage(error, '업로드 중 오류가 발생했습니다.')}`);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const loadSlotPhotos = async (slotId: string) => {
      setPhotoLoading(true);
      const photos = await getInboundPhotos(receipt.id, slotId, { requireAdmin: true });
      setSlotPhotos(photos);
      setPhotoLoading(false);
  };

  const openPhotoModal = (slotId: string) => {
      setSelectedSlot(slotId);
      loadSlotPhotos(slotId);
  };

  const handleDeletePhoto = async (photoId: string) => {
      if (!confirm('사진을 삭제하시겠습니까?')) return;
      await deleteInboundPhoto(photoId, receipt.id, { requireAdmin: true });
      await fetchReceiptData();
      if (selectedSlot) loadSlotPhotos(selectedSlot);
  };

  const openQtyModal = (index: number) => {
      setSelectedLineIndex(index);
      setQtyModalOpen(true);
  };

  const updateLineField = (index: number, field: 'received_qty' | 'damaged_qty' | 'missing_qty' | 'other_qty' | 'location_id' | 'notes', value: any) => {
      const newLines = [...lines];
      newLines[index] = { ...newLines[index], [field]: value };
      setLines(newLines);
  };

  const handleQtyDetailChange = (field: 'received_qty' | 'damaged_qty' | 'missing_qty' | 'other_qty' | 'location_id' | 'notes', value: any) => {
      if (selectedLineIndex === null) return;
      const newLines = [...lines];
      newLines[selectedLineIndex] = { ...newLines[selectedLineIndex], [field]: value };
      setLines(newLines);
  };

  const handleSaveQty = async () => {
    if (!lines.length) {
      alert('저장할 수량 정보가 없습니다.');
      return;
    }

    const mismatches = lines.filter((line) => {
      const total = (line.received_qty || 0) + (line.damaged_qty || 0) + (line.missing_qty || 0) + (line.other_qty || 0);
      return total !== line.expected_qty;
    });
    if (mismatches.length > 0 && typeof window !== 'undefined') {
      const labels = mismatches.map((line) => line.product_name || line.product_barcode || line.plan_line_id).join(', ');
      const confirmed = window.confirm(
        `수량 불일치 항목이 있습니다.\n임시 저장을 계속할까요?\n\n${labels}`
      );
      if (!confirmed) return;
    }

    setSaving(true);
    try {
      const result = await saveReceiptLines(receipt.id, lines, { requireAdmin: true });
      if ('error' in result) {
        throw new Error(result.error);
      }
      await fetchReceiptData();
      alert('수량이 저장되었습니다.');
    } catch (err: any) {
      alert('저장 실패: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    // 1. 필수 사진 검증 (Client Side)
    const missingPhotos = slots.filter(s => s.uploaded_count < s.min_photos);
    if (missingPhotos.length > 0) {
        const missingNames = missingPhotos.map(s => s.title).join(', ');
        alert(`🚨 필수 사진이 누락되었습니다:\n\n${missingNames}\n\n사진을 모두 촬영해야 완료할 수 있습니다.`);
        return;
    }

    // 2. 수량 차이(Discrepancy) 경고
    let hasDiscrepancy = false;
    let discrepancyMsg = '';
    
    lines.forEach(line => {
        const total = (line.received_qty || 0) + (line.damaged_qty || 0) + (line.missing_qty || 0) + (line.other_qty || 0);
        if (total !== line.expected_qty) {
            hasDiscrepancy = true;
            discrepancyMsg += `- ${line.product_name}: 예정 ${line.expected_qty} vs 실계 ${total} (${total - line.expected_qty})\n`;
        }
    });

    if (hasDiscrepancy) {
        const confirmMsg = `⚠️ 수량 차이가 발견되었습니다!\n\n${discrepancyMsg}\n이대로 진행하면 '이슈 발생' 상태로 기록됩니다.\n계속하시겠습니까?`;
        if (!confirm(confirmMsg)) return;
    } else {
        if (!confirm('검수를 완료하시겠습니까? 완료 후에는 수정할 수 없습니다.')) return;
    }

    const saveResult = await saveReceiptLines(receipt.id, lines, { requireAdmin: true });
    if ('error' in saveResult) {
      alert(saveResult.error);
      return;
    }
    const result = await confirmReceipt(receipt.id, { requireAdmin: true });
    if ('error' in result) {
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

  const stepMap: Record<string, number> = {
    VEHICLE_LEFT: 1,
    VEHICLE_RIGHT: 1,
    PRODUCT_FULL: 2,
    BOX_OUTER: 2,
    LABEL_CLOSEUP: 3,
    UNBOXED: 3,
  };
  const stepSlots = (step: number) => slots.filter((s: any) => stepMap[s.slot_key] === step);
  const stepComplete = (step: number) =>
    stepSlots(step).every((s: any) => s.uploaded_count >= Math.max(1, s.min_photos || 1));
  const step1Complete = stepComplete(1);
  const step2Complete = stepComplete(2);
  const step3Complete = stepComplete(3);
  const photosComplete = step1Complete && step2Complete && step3Complete;
  const isFinalized = receipt?.status === 'CONFIRMED' || receipt?.status === 'PUTAWAY_READY';
  const canEditFinalized = !isFinalized || isEditMode;
  const maxAccessibleStep = step1Complete ? (step2Complete ? (step3Complete ? 4 : 3) : 2) : 1;

  useEffect(() => {
    if (!loading && autoStep) {
      const nextStep = step1Complete ? (step2Complete ? (step3Complete ? 4 : 3) : 2) : 1;
      setCurrentStep(nextStep);
    }
  }, [loading, step1Complete, step2Complete, step3Complete, autoStep]);

  useEffect(() => {
    if (loading) return;
    const raw = searchParams.get('step');
    if (!raw) return;
    const desiredStep = Number(raw);
    if (!Number.isFinite(desiredStep)) return;
    const safeStep = Math.min(4, Math.max(1, Math.floor(desiredStep)));
    setAutoStep(false);
    if (safeStep > maxAccessibleStep) {
      setCurrentStep(maxAccessibleStep);
      setStepNotice('해당 단계는 아직 잠금 상태입니다. 가능한 단계로 이동했습니다.');
      return;
    }
    setCurrentStep(safeStep);
    setStepNotice(null);
  }, [loading, searchParams, maxAccessibleStep]);

  if (loading) return <div className="p-6 text-center">로딩 중...</div>;
  if (loadError) return <div className="p-6 text-center text-red-600">{String(loadError)}</div>;
  const currentLine = selectedLineIndex !== null ? lines[selectedLineIndex] : null;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 헤더 */}
      <div className="bg-white p-4 shadow-sm sticky top-0 z-10 flex justify-between items-center">
        <div>
            <h1 className="text-lg font-bold text-gray-900">{receipt.receipt_no}</h1>
            <p className="text-sm text-gray-500">{receipt.client?.name}</p>
        </div>
        <div className="flex gap-2 items-center">
            <button 
                onClick={() => setScannerOpen(true)}
                className="bg-gray-900 text-white p-2 rounded-lg"
                disabled={receipt.status === 'CONFIRMED'}
            >
                📷 스캔
            </button>
            <button
                onClick={handleExit}
                className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                aria-label="목록으로 이동"
                title="목록으로"
            >
                <XMarkIcon className="h-5 w-5" />
            </button>
        </div>
      </div>
      {stepNotice && (
        <div className="mx-4 mt-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-xs text-orange-700">
          {stepNotice}
        </div>
      )}
      {isEditMode && (
        <div className="mx-4 mt-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-700">
          현장 체크 수정 모드입니다. 완료된 입고건도 Step4 수량/비고를 수정할 수 있습니다.
        </div>
      )}

      <div className="p-4 space-y-6">
        {/* 단계 표시 */}
        <section className="mb-4">
          <div className="flex items-center justify-between gap-2">
            {[
              { step: 1, label: '입고 시 촬영' },
              { step: 2, label: '하차 후 촬영' },
              { step: 3, label: '상품 실사 촬영' },
              { step: 4, label: '수량 입력' },
            ].map((item) => {
              const completed = item.step === 1 ? step1Complete : item.step === 2 ? step2Complete : item.step === 3 ? step3Complete : photosComplete;
              const locked = item.step > maxAccessibleStep;
              const isActive = currentStep === item.step;
              return (
                <button
                  key={item.step}
                  type="button"
                  onClick={() => {
                    if (item.step <= maxAccessibleStep) {
                      setCurrentStep(item.step);
                      setAutoStep(false);
                    }
                  }}
                  disabled={locked}
                  className={`flex-1 rounded-lg border px-2 py-2 text-xs font-semibold ${
                    isActive
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : completed
                      ? 'border-green-300 bg-green-50 text-green-700'
                      : locked
                      ? 'border-gray-200 bg-gray-100 text-gray-400'
                      : 'border-gray-200 bg-white text-gray-700'
                  }`}
                >
                  STEP {item.step}
                  <div className="mt-1 text-[11px] font-normal">{item.label}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 사진 섹션 */}
        <section>
          <h2 className="text-md font-bold text-gray-800 mb-3 flex items-center">
            📸 입고 검수 · 촬영
            <span className="ml-2 text-xs font-normal text-gray-500">단계별 진행</span>
          </h2>

          {[1, 2, 3].filter((step) => step === currentStep).map((step) => {
            const locked =
              step === 1 ? false : step === 2 ? !step1Complete : !step2Complete || !step1Complete;
            const completed = stepComplete(step);
            const stepTitle =
              step === 1
                ? 'STEP 1. 입고 시 촬영 (차량 도착 직후)'
                : step === 2
                ? 'STEP 2. 하차 후 입고 대기 공간 촬영'
                : 'STEP 3. 상품 실사 전 촬영 (중요)';
            const stepDesc =
              step === 1
                ? '차량 개방(좌/우) 각 1장'
                : step === 2
                ? '상품 전체, 박스 외관 각 1장'
                : '송장/라벨 · 개봉 후 상태 (각 1장 이상, 최대 20장)';
            const stepHelp =
              step === 1
                ? '차량 도킹/하차 전 상태를 기록해 분쟁 대비 증빙을 확보합니다.'
                : step === 2
                ? '하차 완료 후 대기 존의 외관 상태를 확인합니다.'
                : '라벨/송장과 개봉 상태를 상세 촬영해 파손·누락 증빙을 남깁니다.';

            return (
              <div key={step} className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm font-bold text-gray-900">{stepTitle}</div>
                    <div className="text-xs text-gray-500">{stepDesc}</div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    completed ? 'bg-green-100 text-green-700' : locked ? 'bg-gray-200 text-gray-500' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {completed ? '완료' : locked ? '잠금' : '진행 중'}
                  </span>
                </div>
                <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                  {stepHelp}
                </div>

                <div className={`grid grid-cols-1 gap-4 ${locked ? 'opacity-50' : ''}`}>
                  {stepSlots(step).map((slot: any) => {
                    const maxPhotos = slot.slot_key === 'LABEL_CLOSEUP' || slot.slot_key === 'UNBOXED' || slot.slot_key === 'BOX_OUTER' ? 20 : slot.min_photos;
                    const canUpload = !locked && !isFinalized && slot.uploaded_count < maxPhotos;
                    const allowDelete = !isFinalized;

                    return (
                      <div
                        key={slot.id}
                        className={`relative flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all ${
                          slot.slot_ok ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-white'
                        }`}
                      >
                        <div className={`text-4xl mb-3 p-4 rounded-full ${slot.slot_ok ? 'bg-green-100' : 'bg-gray-100'}`}>
                          {uploading && selectedSlot === slot.id ? <span className="animate-spin block">⏳</span> : slot.slot_ok ? '✅' : '📷'}
                        </div>
                        <div className="text-base font-bold text-gray-900">{slot.title}</div>
                        <div className="text-sm text-gray-500 mt-2">
                          {slot.uploaded_count} / {maxPhotos}장
                        </div>

                        <div className="mt-4 flex gap-3">
                          <label className={`text-sm px-4 py-2 rounded-lg border ${
                            canUpload ? 'border-gray-300 text-gray-700 cursor-pointer bg-white' : 'border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50'
                          }`}>
                            📷 카메라
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              onChange={(e) => handlePhotoUpload(slot.id, 'camera', e)}
                              disabled={!canUpload}
                            />
                          </label>
                          <label className={`text-sm px-4 py-2 rounded-lg border ${
                            canUpload ? 'border-gray-300 text-gray-700 cursor-pointer bg-white' : 'border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50'
                          }`}>
                            🖼 앨범
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handlePhotoUpload(slot.id, 'album', e)}
                              disabled={!canUpload}
                            />
                          </label>
                        </div>

                        {slot.uploaded_count > 0 && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openPhotoModal(slot.id);
                            }}
                            className="absolute top-3 right-3 z-20 bg-white border border-gray-200 rounded-full p-3 shadow-sm hover:bg-gray-50 active:bg-gray-100"
                            type="button"
                          >
                            🔍
                          </button>
                        )}

                        {!allowDelete && (
                          <div className="absolute inset-0 bg-white/70 rounded-xl flex items-center justify-center text-xs font-semibold text-gray-500">
                            최종 제출 완료
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>

        {/* 수량 섹션 */}
        <section className={`${currentStep === 4 ? '' : 'hidden'}`}>
          <h2 className="text-md font-bold text-gray-800 mb-3 flex justify-between items-end">
            <span>📦 수량 확인 및 입력</span>
            <span className="text-xs font-normal text-gray-500">항목 클릭 시 수량 상세 입력, 카드에서 비고를 바로 입력할 수 있습니다</span>
          </h2>
          {!photosComplete && (
            <div className="mb-3 text-sm text-gray-500">
              STEP 1~3 촬영 완료 후 수량 입력이 가능합니다.
            </div>
          )}
          
          <div className="space-y-3">
            {lines.length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center text-gray-500 border border-dashed border-gray-300">
                    <p>등록된 입고 품목이 없습니다.</p>
                    <p className="text-xs mt-1">(관리자 페이지에서 품목이 정상 등록되었는지 확인해주세요)</p>
                </div>
            ) : (
                lines.map((line, idx) => {
                    const totalQty = (line.received_qty || 0) + (line.damaged_qty || 0) + (line.missing_qty || 0) + (line.other_qty || 0);
                    const isCompleted = totalQty >= line.expected_qty;
                    const isPerfect = isCompleted && line.damaged_qty === 0 && line.missing_qty === 0 && (line.other_qty || 0) === 0 && line.received_qty === line.expected_qty;
                    
                    return (
                      <div 
                        key={idx} 
                        className={`bg-white rounded-xl p-4 shadow-sm border-2 transition-all active:scale-[0.98] ${
                            isPerfect ? 'border-green-500 bg-green-50' : 
                            isCompleted ? 'border-orange-300 bg-orange-50' : 'border-transparent'
                        } ${!photosComplete || !canEditFinalized ? 'opacity-60' : ''}`}
                        onClick={() => {
                          if (photosComplete && canEditFinalized) openQtyModal(idx);
                        }}
                      >
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h3 className="font-bold text-gray-900 text-lg leading-tight">{line.product_name}</h3>
                                <p className="text-sm text-gray-500 font-mono mt-1">{line.product_barcode || '-'}</p>
                            </div>
                            {isPerfect && <span className="text-2xl">✅</span>}
                        </div>

                        <div className="flex items-center gap-2">
                            {/* 입력란 시각화 (Click trigger) */}
                            <div className="flex-1 bg-gray-100 rounded-lg p-3 flex flex-col items-center justify-center border border-gray-200">
                                <span className="text-xs text-gray-500 mb-1">실수량 (입력)</span>
                                <span className={`text-2xl font-bold ${line.received_qty > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                                    {line.received_qty > 0 ? formatInteger(line.received_qty) : '-'}
                                </span>
                            </div>
                            
                            <div className="text-gray-400 font-bold">/</div>

                            <div className="flex-1 bg-white rounded-lg p-3 flex flex-col items-center justify-center border border-gray-200">
                                <span className="text-xs text-gray-500 mb-1">예정 수량</span>
                                <span className="text-2xl font-bold text-gray-900">{formatInteger(line.expected_qty)}</span>
                            </div>
                        </div>

                        {(line.damaged_qty > 0 || line.missing_qty > 0 || (line.other_qty || 0) > 0) && (
                            <div className="mt-3 text-xs flex gap-2">
                                {line.damaged_qty > 0 && <span className="text-red-600 bg-red-100 px-2 py-1 rounded">파손 {formatInteger(line.damaged_qty)}</span>}
                                {line.missing_qty > 0 && <span className="text-orange-600 bg-orange-100 px-2 py-1 rounded">분실 {formatInteger(line.missing_qty)}</span>}
                                {(line.other_qty || 0) > 0 && <span className="text-purple-600 bg-purple-100 px-2 py-1 rounded">기타 {formatInteger(line.other_qty)}</span>}
                            </div>
                        )}
                        {!!line.notes && (
                          <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                            비고: {line.notes}
                          </div>
                        )}
                        
                        {/* 수량 차이 경고 아이콘 */}
                        {!isPerfect && isCompleted && totalQty !== line.expected_qty && (
                             <div className="mt-2 text-xs text-red-600 font-bold flex items-center">
                                ⚠️ 수량 불일치 ({totalQty - line.expected_qty > 0 ? '+' : ''}{formatInteger(totalQty - line.expected_qty)})
                             </div>
                        )}

                        {/* 적치 로케이션 (선택) - 수량 섹션 하단 배치 */}
                        <div
                            className="mt-3"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                            }}
                        >
                            <label className="block text-base font-semibold text-gray-700 mb-2">
                                📍 적치 로케이션 (선택)
                            </label>
                            <select
                                className="w-full text-base border-gray-300 rounded-lg py-3 px-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-colors"
                                value={line.location_id || ''}
                                onChange={(e) => updateLineField(idx, 'location_id', e.target.value || null)}
                                disabled={!photosComplete || !canEditFinalized}
                            >
                                <option value="">(미지정)</option>
                                {locations.map((loc) => (
                                    <option key={loc.id} value={loc.id}>
                                        {loc.code} ({loc.type})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* 로케이션 정보 표시 */}
                        {line.location_id && (
                            <div className="mt-2 bg-blue-50 text-blue-800 px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center">
                                📍 {locations.find(l => l.id === line.location_id)?.code || 'Unknown Loc'}
                            </div>
                        )}

                        <div
                            className="mt-3"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                            }}
                        >
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                📝 Step4 비고
                            </label>
                            <textarea
                                className="w-full border border-gray-300 rounded-lg py-2 px-3 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-colors"
                                rows={2}
                                placeholder="사진 미촬영 사유, 특이사항 등을 입력하세요."
                                value={line.notes || ''}
                                onChange={(e) => updateLineField(idx, 'notes', e.target.value)}
                                disabled={!photosComplete || !canEditFinalized}
                            />
                        </div>
                      </div>
                    );
                })
            )}
          </div>
          {currentStep !== 4 && (
            <div className="text-xs text-gray-500">STEP 4에서 수량 입력을 진행해주세요.</div>
          )}
        </section>

        {/* 완료 버튼 */}
        <div className="mt-6 flex flex-col gap-3">
          {/* 임시 저장 버튼은 모든 스텝에서 노출 */}
          <button
            onClick={handleSaveQty}
            disabled={saving || (currentStep === 4 && !photosComplete) || !canEditFinalized}
            className="w-full bg-gray-800 text-white py-3 rounded-xl font-bold shadow-lg disabled:opacity-60"
            type="button"
          >
            {saving ? '저장 중...' : '임시 저장'}
          </button>

          {(receipt.status === 'CONFIRMED' || receipt.status === 'PUTAWAY_READY') ? (
            <button
              type="button"
              disabled
              className="w-full bg-gray-300 text-gray-600 py-4 rounded-xl font-bold text-lg shadow-lg cursor-not-allowed"
            >
              검수 완료됨
            </button>
          ) : currentStep === 4 ? (
            <button
              type="button"
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-blue-700 transition disabled:opacity-60"
              disabled={!photosComplete || !canEditFinalized}
              onClick={handleConfirm}
            >
              검수 제출 완료
            </button>
          ) : (
            <button
              type="button"
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-blue-700 transition disabled:opacity-60"
              disabled={
                (currentStep === 1 && !step1Complete) ||
                (currentStep === 2 && !step2Complete) ||
                (currentStep === 3 && !step3Complete)
              }
              onClick={() => {
                setCurrentStep(Math.min(4, currentStep + 1));
                setAutoStep(false);
              }}
            >
              다음 스텝 가기
            </button>
          )}
        </div>
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
                              <div className="text-xs text-gray-500 min-w-[52px] text-right">{formatInteger(currentLine.received_qty)}</div>
                              <button 
                                  className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 text-2xl font-bold"
                                  onClick={() => handleQtyDetailChange('received_qty', currentLine.received_qty + 1)}
                              >+</button>
                          </div>
                      </div>

                      <div>
                          <label className="block text-sm font-medium text-red-700 mb-2">💔 파손</label>
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
                              <div className="text-xs text-gray-500 min-w-[52px] text-right">{formatInteger(currentLine.damaged_qty)}</div>
                              <button 
                                  className="w-12 h-12 rounded-xl bg-red-100 text-red-600 text-2xl font-bold"
                                  onClick={() => handleQtyDetailChange('damaged_qty', currentLine.damaged_qty + 1)}
                              >+</button>
                          </div>
                      </div>

                      <div>
                          <label className="block text-sm font-medium text-orange-700 mb-2">📉 분실</label>
                          <div className="flex items-center gap-3">
                              <button 
                                  className="w-12 h-12 rounded-xl bg-gray-100 text-2xl font-bold"
                                  onClick={() => handleQtyDetailChange('missing_qty', Math.max(0, currentLine.missing_qty - 1))}
                              >-</button>
                          <input 
                                  type="number" 
                                  className="flex-1 text-center text-2xl font-bold border-orange-300 text-orange-600 rounded-xl py-2"
                                  value={currentLine.missing_qty}
                                  onChange={(e) => handleQtyDetailChange('missing_qty', parseInt(e.target.value) || 0)}
                              />
                              <div className="text-xs text-gray-500 min-w-[52px] text-right">{formatInteger(currentLine.missing_qty)}</div>
                              <button 
                                  className="w-12 h-12 rounded-xl bg-orange-100 text-orange-600 text-2xl font-bold"
                                  onClick={() => handleQtyDetailChange('missing_qty', currentLine.missing_qty + 1)}
                              >+</button>
                          </div>
                      </div>

                      <div>
                          <label className="block text-sm font-medium text-purple-700 mb-2">🟣 기타</label>
                          <div className="flex items-center gap-3">
                              <button 
                                  className="w-12 h-12 rounded-xl bg-gray-100 text-2xl font-bold"
                                  onClick={() => handleQtyDetailChange('other_qty', Math.max(0, (currentLine.other_qty || 0) - 1))}
                              >-</button>
                              <input 
                                  type="number" 
                                  className="flex-1 text-center text-2xl font-bold border-purple-300 text-purple-600 rounded-xl py-2"
                                  value={currentLine.other_qty || 0}
                                  onChange={(e) => handleQtyDetailChange('other_qty', parseInt(e.target.value) || 0)}
                              />
                              <div className="text-xs text-gray-500 min-w-[52px] text-right">{formatInteger(currentLine.other_qty || 0)}</div>
                              <button 
                                  className="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 text-2xl font-bold"
                                  onClick={() => handleQtyDetailChange('other_qty', (currentLine.other_qty || 0) + 1)}
                              >+</button>
                          </div>
                      </div>

                      <div className="bg-gray-50 p-4 rounded-xl text-center">
                          <p className="text-sm text-gray-500">예정: {formatInteger(currentLine.expected_qty)}</p>
                          <p className={`text-lg font-bold mt-1 ${
                              currentLine.expected_qty === (currentLine.received_qty + currentLine.damaged_qty + currentLine.missing_qty + (currentLine.other_qty || 0))
                              ? 'text-green-600' : 'text-orange-500'
                          }`}>
                              합계: {formatInteger(currentLine.received_qty + currentLine.damaged_qty + currentLine.missing_qty + (currentLine.other_qty || 0))}
                          </p>
                      </div>

                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">📝 Step4 비고</label>
                          <textarea
                              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
                              rows={3}
                              placeholder="사진 미촬영 사유, 특이사항 등을 입력하세요."
                              value={currentLine.notes || ''}
                              onChange={(e) => handleQtyDetailChange('notes', e.target.value)}
                          />
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
