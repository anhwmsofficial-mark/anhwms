'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { getInboundPhotos, deleteInboundPhoto } from '@/app/actions/inbound-photo';
import { createReceiptDocument } from '@/lib/api/receiptDocuments';

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
  const [snapshots, setSnapshots] = useState<Record<string, { before: number; after: number }>>({});
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareSummaryKo, setShareSummaryKo] = useState('');
  const [shareSummaryEn, setShareSummaryEn] = useState('');
  const [shareSummaryZh, setShareSummaryZh] = useState('');
  const [sharePassword, setSharePassword] = useState('');
  const [shareExpiry, setShareExpiry] = useState('');
  const [shareSaving, setShareSaving] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareTranslating, setShareTranslating] = useState(false);
  const [shareList, setShareList] = useState<any[]>([]);
  const [shareLines, setShareLines] = useState<any[]>([]);
  const [shareDefaultLang, setShareDefaultLang] = useState<'ko' | 'en' | 'zh'>('ko');
  const [shareExtendDays, setShareExtendDays] = useState<Record<string, number>>({});
  const [receiptLang, setReceiptLang] = useState<'ko' | 'zh'>('ko');
  const [receiptTranslating, setReceiptTranslating] = useState(false);
  const [receiptZh, setReceiptZh] = useState<{
    clientName?: string;
    warehouseName?: string;
    shipFromAddress?: string;
    inboundAddress?: string;
    manager?: string;
    notes?: string;
    productNames?: string[];
    lineNotes?: string[];
  } | null>(null);
  const receiptRef = useRef<HTMLDivElement | null>(null);
  const formatNumber = (value: number | null | undefined) =>
    new Intl.NumberFormat('ko-KR').format(value ?? 0);
  const formatNumber = (value: number | null | undefined) =>
    new Intl.NumberFormat('ko-KR').format(value ?? 0);

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
                field_check_notes: rl?.notes || '',
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
            line_notes: planLineMap.get(rl.plan_line_id)?.line_notes,
            field_check_notes: rl?.notes || ''
        }));
    }
    
    setLines(displayLines || []);

    const { data: snapshotRows } = await supabase
      .from('inbound_inventory_snapshots')
      .select('product_id, qty_before, qty_after')
      .eq('receipt_id', receiptData.id);
    const snapshotMap: Record<string, { before: number; after: number }> = {};
    (snapshotRows || []).forEach((row: any) => {
      snapshotMap[row.product_id] = { before: row.qty_before, after: row.qty_after };
    });
    setSnapshots(snapshotMap);

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

  const buildShareLinesBase = () => {
    return (lines || []).map((line: any) => ({
      product_id: line.product_id || line.product?.id,
      product_sku: line.product?.sku || line.product_sku || '',
      barcode: line.product?.barcode || line.barcode_primary || '',
      expected_qty: line.expected_qty || 0,
      accepted_qty: (line.accepted_qty ?? line.received_qty) || 0,
      damaged_qty: line.damaged_qty || 0,
      missing_qty: line.missing_qty || 0,
      other_qty: line.other_qty || 0,
      product_name_ko: line.product?.name || line.product_name || '',
      product_name_en: '',
      product_name_zh: '',
      line_notes_ko: line.field_check_notes || line.line_notes || '',
      line_notes_en: '',
      line_notes_zh: ''
    }));
  };

  const buildShareContent = (contentLines?: any[]) => {
    const photos = (slots || []).map((slot: any) => ({
      title: slot.title,
      urls: (slot.photos || []).map((p: any) => p.url)
    }));

    return {
      receipt_no: receipt.receipt_no,
      planned_date: receipt.plan?.planned_date || receipt.arrived_at || '',
      client_name: receipt.client?.name || '',
      warehouse_name: receipt.warehouse?.name || '',
      inbound_manager: receipt.plan?.inbound_manager || '',
      notes: receipt.plan?.notes || receipt.notes || '',
      lines: contentLines || [],
      photos
    };
  };

  const buildShareSummaryKo = () => {
    const baseLines = [
      `인수번호: ${receipt.receipt_no}`,
      `고객사: ${receipt.client?.name || '-'}`,
      `입고지: ${receipt.warehouse?.name || '-'}`,
      `입고일: ${receipt.plan?.planned_date || receipt.arrived_at || '-'}`,
      `담당: ${receipt.plan?.inbound_manager || '-'}`,
    ];
    const noteLines = [receipt.plan?.notes, receipt.notes].filter(Boolean);
    const lineNotes = (lines || []).map((l: any) => l.field_check_notes || l.line_notes).filter(Boolean);
    const notesBlock = noteLines.length > 0 ? `비고:\n${noteLines.join('\n')}` : '';
    const lineNotesBlock = lineNotes.length > 0 ? `품목 비고:\n${lineNotes.map((n: string) => `- ${n}`).join('\n')}` : '';
    return [baseLines.join('\n'), notesBlock, lineNotesBlock].filter(Boolean).join('\n\n');
  };

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
        scale: 1.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        onclone: (doc) => {
          const target = doc.querySelector('.print-receipt');
          if (target) {
            target.classList.add('pdf-safe');
          }
          const style = doc.createElement('style');
          style.textContent = `
            .pdf-safe, .pdf-safe * {
              color: #111111 !important;
              background-color: #ffffff !important;
              border-color: #d1d5db !important;
              box-shadow: none !important;
            }
          `;
          doc.head.appendChild(style);
        },
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const printableWidth = pageWidth - margin * 2;
      const printableHeight = pageHeight - margin * 2;
      const pxPerMm = canvas.width / printableWidth;
      const pageHeightPx = Math.floor(printableHeight * pxPerMm);

      let renderedPages = 0;
      for (let y = 0; y < canvas.height; y += pageHeightPx) {
        const sliceHeight = Math.min(pageHeightPx, canvas.height - y);
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        const pageCtx = pageCanvas.getContext('2d');
        if (!pageCtx) continue;
        pageCtx.drawImage(
          canvas,
          0,
          y,
          canvas.width,
          sliceHeight,
          0,
          0,
          canvas.width,
          sliceHeight
        );
        const imgData = pageCanvas.toDataURL('image/jpeg', 0.95);
        const sliceHeightMm = sliceHeight / pxPerMm;
        if (renderedPages > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', margin, margin, printableWidth, sliceHeightMm);
        renderedPages += 1;
      }

      const fileName = `receipt-${receipt.receipt_no}.pdf`;
      const arrayBuffer = pdf.output('arraybuffer');
      const fileBlob = new Blob([arrayBuffer], { type: 'application/pdf' });
      const supabase = createClient();
      const safeReceiptNo = String(receipt.receipt_no || 'unknown').replace(/[^a-zA-Z0-9-_]/g, '');
      const storagePath = `receipts/${safeReceiptNo}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('inbound')
        .upload(storagePath, fileBlob, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: publicUrlData } = supabase.storage.from('inbound').getPublicUrl(storagePath);

      try {
        await createReceiptDocument({
          receiptId: receipt.id,
          receiptNo: receipt.receipt_no,
          fileName,
          storagePath,
          publicUrl: publicUrlData?.publicUrl || null,
          fileSize: fileBlob.size,
          mimeType: 'application/pdf',
        });
      } catch (err: any) {
        alert('문서관리 저장 실패: ' + (err?.message || '알 수 없는 오류'));
      }

      pdf.save(fileName);
    } catch (err: any) {
      console.error('PDF 생성 실패:', err);
      alert('PDF 생성 실패: ' + (err?.message || '알 수 없는 오류'));
    } finally {
      setPdfLoading(false);
    }
  };

  const translateTextsToZh = async (texts: string[]) => {
    if (texts.length === 0) return [];
    const res = await fetch('/api/share/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceLang: 'ko', targetLang: 'zh', texts }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.translatedTexts || []) as string[];
  };

  const handleTranslateReceiptZh = async () => {
    if (receiptLang === 'zh') {
      setReceiptLang('ko');
      return;
    }
    if (receiptZh) {
      setReceiptLang('zh');
      return;
    }

    setReceiptTranslating(true);
    try {
      const shipFromAddress =
        [receipt.client?.address_line1, receipt.client?.address_line2, receipt.client?.city].filter(Boolean).join(' ') || '미등록';
      const inboundAddress =
        [receipt.warehouse?.address_line1, receipt.warehouse?.address_line2, receipt.warehouse?.city].filter(Boolean).join(' ') || '미등록';
      const manager = receipt.plan?.inbound_manager || receipt.client?.contact_name || '미지정';
      const noteValue = receipt.plan?.notes || '없음';
      const productNames = lines.map((line: any) => line.product?.name || '상품명 없음');
      const lineNotes = lines.map((line: any) => {
        const baseNote = line.field_check_notes || line.line_notes || line.notes || line.pallet_text || '';
        const issueParts = [
          line.damaged_qty > 0 ? `파손 ${formatNumber(line.damaged_qty)}개` : null,
          line.missing_qty > 0 ? `분실 ${formatNumber(line.missing_qty)}개` : null,
          line.other_qty > 0 ? `기타 ${formatNumber(line.other_qty)}개` : null,
        ].filter(Boolean);
        return [baseNote, issueParts.join(', ')].filter(Boolean).join(' · ') || '-';
      });

      const [headerZh, productZh, notesZh] = await Promise.all([
        translateTextsToZh([
          receipt.client?.name || '-',
          receipt.warehouse?.name || '미지정',
          shipFromAddress,
          inboundAddress,
          manager,
          noteValue,
        ]),
        translateTextsToZh(productNames),
        translateTextsToZh(lineNotes),
      ]);

      setReceiptZh({
        clientName: headerZh[0] || '',
        warehouseName: headerZh[1] || '',
        shipFromAddress: headerZh[2] || '',
        inboundAddress: headerZh[3] || '',
        manager: headerZh[4] || '',
        notes: headerZh[5] || '',
        productNames: productZh,
        lineNotes: notesZh,
      });
      setReceiptLang('zh');
    } finally {
      setReceiptTranslating(false);
    }
  };

  const totalExpected = lines.reduce((sum, line: any) => sum + Number(line.expected_qty || 0), 0);
  const totalAccepted = lines.reduce((sum, line: any) => sum + Number(line.accepted_qty ?? line.received_qty ?? 0), 0);
  const totalDamaged = lines.reduce((sum, line: any) => sum + Number(line.damaged_qty || 0), 0);
  const totalMissing = lines.reduce((sum, line: any) => sum + Number(line.missing_qty || 0), 0);
  const totalOther = lines.reduce((sum, line: any) => sum + Number(line.other_qty || 0), 0);
  const totalActual = totalAccepted + totalDamaged + totalMissing + totalOther;

  const loadShareList = async () => {
    if (!receipt?.id) return;
    const res = await fetch(`/api/admin/inbound-share?receipt_id=${encodeURIComponent(receipt.id)}`);
    const data = await res.json();
    if (res.ok) {
      setShareList(data.data || []);
    }
  };

  const openShareModal = () => {
    const summaryKo = buildShareSummaryKo();
    setShareSummaryKo(summaryKo);
    setShareSummaryEn('');
    setShareSummaryZh('');
    setSharePassword('');
    setShareUrl('');
    setShareDefaultLang('ko');
    setShareLines(buildShareLinesBase());
    const base = new Date();
    base.setDate(base.getDate() + 7);
    setShareExpiry(base.toISOString().slice(0, 10));
    setShareOpen(true);
    loadShareList();
  };

  const handleAutoTranslate = async () => {
    if (!shareSummaryKo.trim()) return;
    setShareTranslating(true);
    try {
      const nameKo = shareLines.map((line) => line.product_name_ko || '');
      const noteKo = shareLines.map((line) => line.line_notes_ko || '');
      const [enRes, zhRes, enNamesRes, zhNamesRes, enNotesRes, zhNotesRes] = await Promise.all([
        fetch('/api/share/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceLang: 'ko', targetLang: 'en', text: shareSummaryKo }),
        }),
        fetch('/api/share/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceLang: 'ko', targetLang: 'zh', text: shareSummaryKo }),
        }),
        fetch('/api/share/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceLang: 'ko', targetLang: 'en', texts: nameKo }),
        }),
        fetch('/api/share/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceLang: 'ko', targetLang: 'zh', texts: nameKo }),
        }),
        fetch('/api/share/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceLang: 'ko', targetLang: 'en', texts: noteKo }),
        }),
        fetch('/api/share/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceLang: 'ko', targetLang: 'zh', texts: noteKo }),
        }),
      ]);
      const enData = await enRes.json();
      const zhData = await zhRes.json();
      const enNamesData = await enNamesRes.json();
      const zhNamesData = await zhNamesRes.json();
      const enNotesData = await enNotesRes.json();
      const zhNotesData = await zhNotesRes.json();
      if (enRes.ok) setShareSummaryEn(enData?.translatedTexts?.[0] || '');
      if (zhRes.ok) setShareSummaryZh(zhData?.translatedTexts?.[0] || '');
      if (enNamesRes.ok || zhNamesRes.ok || enNotesRes.ok || zhNotesRes.ok) {
        const next = shareLines.map((line, idx) => ({
          ...line,
          product_name_en: enNamesData?.translatedTexts?.[idx] || line.product_name_en,
          product_name_zh: zhNamesData?.translatedTexts?.[idx] || line.product_name_zh,
          line_notes_en: enNotesData?.translatedTexts?.[idx] || line.line_notes_en,
          line_notes_zh: zhNotesData?.translatedTexts?.[idx] || line.line_notes_zh,
        }));
        setShareLines(next);
      }
    } finally {
      setShareTranslating(false);
    }
  };

  const handleCreateShare = async () => {
    setShareSaving(true);
    try {
      const expiresAt = shareExpiry ? new Date(`${shareExpiry}T23:59:59`).toISOString() : null;
      const content = buildShareContent(shareLines);
      const res = await fetch('/api/admin/inbound-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receipt_id: receipt.id,
          expires_at: expiresAt,
          password: sharePassword || null,
          summary_ko: shareSummaryKo || null,
          summary_en: shareSummaryEn || null,
          summary_zh: shareSummaryZh || null,
          language_default: shareDefaultLang,
          content,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || '공유 링크 생성 실패');
      setShareUrl(data?.shareUrl || '');
      loadShareList();
    } catch (e: any) {
      alert(e?.message || '공유 링크 생성 실패');
    } finally {
      setShareSaving(false);
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
      {receipt?.plan_id && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => window.open(`/ops/inbound/${receipt.plan_id}?step=4&mode=edit`, '_blank', 'noopener,noreferrer')}
            className="px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-sm font-medium hover:bg-amber-100"
          >
            현장체크 수정
          </button>
        </div>
      )}

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
                    예정: {formatNumber(line.expected_qty)} · 정상: {formatNumber(line.accepted_qty ?? line.received_qty ?? 0)}
                    · 파손: {formatNumber(line.damaged_qty || 0)} · 분실: {formatNumber(line.missing_qty || 0)} · 기타: {formatNumber(line.other_qty || 0)}
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
              onClick={handleTranslateReceiptZh}
              disabled={receiptTranslating}
              className="px-4 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
            >
              {receiptTranslating ? '번역 중...' : receiptLang === 'zh' ? '원문 보기' : '중국어 번역'}
            </button>
            <button
              type="button"
              onClick={openShareModal}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              공유 링크
            </button>
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
              <div className="border-b md:border-b-0 md:border-r p-2">
                <div className="text-xs text-gray-500">거래처명</div>
                <div className="font-semibold text-gray-900">
                  {receiptLang === 'zh' ? (receiptZh?.clientName || receipt.client?.name || '-') : (receipt.client?.name || '-')}
                </div>
              </div>
              <div className="p-2">
                <div className="text-xs text-gray-500">입고지점</div>
                <div className="font-semibold text-gray-900">
                  {receiptLang === 'zh' ? (receiptZh?.warehouseName || receipt.warehouse?.name || '미지정') : (receipt.warehouse?.name || '미지정')}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 text-sm border-t">
              <div className="border-b md:border-b-0 md:border-r p-2">
                <div className="text-xs text-gray-500">출하지주소</div>
                <div className="font-semibold text-gray-900">
                  {receiptLang === 'zh'
                    ? (receiptZh?.shipFromAddress || (receipt.client?.address_line1 || receipt.client?.address_line2 || receipt.client?.city
                        ? [receipt.client?.address_line1, receipt.client?.address_line2, receipt.client?.city].filter(Boolean).join(' ')
                        : '미등록'))
                    : (receipt.client?.address_line1 || receipt.client?.address_line2 || receipt.client?.city
                        ? [receipt.client?.address_line1, receipt.client?.address_line2, receipt.client?.city].filter(Boolean).join(' ')
                        : '미등록')}
                </div>
              </div>
              <div className="p-2">
                <div className="text-xs text-gray-500">입고지주소</div>
                <div className="font-semibold text-gray-900">
                  {receiptLang === 'zh'
                    ? (receiptZh?.inboundAddress || (receipt.warehouse?.address_line1 || receipt.warehouse?.address_line2 || receipt.warehouse?.city
                        ? [receipt.warehouse?.address_line1, receipt.warehouse?.address_line2, receipt.warehouse?.city].filter(Boolean).join(' ')
                        : '미등록'))
                    : (receipt.warehouse?.address_line1 || receipt.warehouse?.address_line2 || receipt.warehouse?.city
                        ? [receipt.warehouse?.address_line1, receipt.warehouse?.address_line2, receipt.warehouse?.city].filter(Boolean).join(' ')
                        : '미등록')}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 text-sm border-t">
              <div className="border-b md:border-b-0 md:border-r p-2">
                <div className="text-xs text-gray-500">입고날짜</div>
                <div className="font-semibold text-gray-900">{receipt.plan?.planned_date || receipt.arrived_at || '-'}</div>
              </div>
              <div className="border-b md:border-b-0 md:border-r p-2">
                <div className="text-xs text-gray-500">관리담당자</div>
                <div className="font-semibold text-gray-900">
                  {receiptLang === 'zh' ? (receiptZh?.manager || receipt.plan?.inbound_manager || receipt.client?.contact_name || '미지정') : (receipt.plan?.inbound_manager || receipt.client?.contact_name || '미지정')}
                </div>
              </div>
              <div className="p-2">
                <div className="text-xs text-gray-500">연락처</div>
                <div className="font-semibold text-gray-900">{receipt.client?.contact_phone || '-'}</div>
              </div>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden print-block">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col style={{ width: '24%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '20%' }} />
              </colgroup>
              <thead className="bg-gray-50 text-xs font-semibold text-gray-600 print-table-header">
                <tr>
                  <th className="p-2 border-r text-left">제품 정보</th>
                  <th className="p-2 border-r text-left">바코드</th>
                  <th className="p-2 border-r text-right">박스</th>
                  <th className="p-2 border-r text-right">수량</th>
                  <th className="p-2 border-r text-left">재고 전/후</th>
                  <th className="p-2 border-r text-left">유통/제조일자</th>
                  <th className="p-2 text-left">비고</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lines.map((line, idx) => (
                  <tr key={line.id} className="print-table-row align-top">
                    <td className="p-2 border-r break-words">
                      <div className="font-semibold text-gray-900">
                        {receiptLang === 'zh'
                          ? (receiptZh?.productNames?.[idx] || line.product?.name || '상품명 없음')
                          : (line.product?.name || '상품명 없음')}
                      </div>
                    </td>
                    <td className="p-2 border-r text-gray-700 font-mono text-[11px] break-all">{line.product?.barcode || '-'}</td>
                    <td className="p-2 border-r text-gray-700 text-right">{line.box_count || '-'}</td>
                    <td className="p-2 border-r text-gray-700 text-right">{formatNumber(line.accepted_qty ?? line.received_qty ?? 0)}</td>
                    <td className="p-2 border-r text-gray-700">
                      {snapshots[line.product_id]?.before !== undefined
                        ? `${formatNumber(snapshots[line.product_id].before)} → ${formatNumber(snapshots[line.product_id].after)}`
                        : '-'}
                    </td>
                    <td className="p-2 border-r text-gray-700 break-words">
                      {line.mfg_date || line.expiry_date
                        ? `${line.mfg_date || '-'} / ${line.expiry_date || '-'}`
                        : '-'}
                    </td>
                    <td className="p-2 text-gray-700 break-words">
                      {(() => {
                        const baseNote = line.field_check_notes || line.line_notes || line.notes || line.pallet_text || '';
                        const issueParts = [
                          line.damaged_qty > 0 ? `파손 ${formatNumber(line.damaged_qty)}개` : null,
                          line.missing_qty > 0 ? `분실 ${formatNumber(line.missing_qty)}개` : null,
                          line.other_qty > 0 ? `기타 ${formatNumber(line.other_qty)}개` : null,
                        ].filter(Boolean);
                        const issueNote = issueParts.length > 0 ? issueParts.join(', ') : '';
                        const combined = [baseNote, issueNote].filter(Boolean).join(' · ');
                        const displayNote = combined || '-';
                        return receiptLang === 'zh'
                          ? (receiptZh?.lineNotes?.[idx] || displayNote)
                          : displayNote;
                      })()}
                    </td>
                  </tr>
                ))}
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-gray-400">표시할 품목이 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="border rounded-lg p-3 text-sm text-gray-700 print-block">
            <div className="font-semibold mb-1">합계</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>예정 {formatNumber(totalExpected)}</span>
              <span>정상 {formatNumber(totalAccepted)}</span>
              <span>파손 {formatNumber(totalDamaged)}</span>
              <span>분실 {formatNumber(totalMissing)}</span>
              <span>기타 {formatNumber(totalOther)}</span>
              <span className="font-semibold">실합계 {formatNumber(totalActual)}</span>
              <span className={`font-semibold ${totalExpected === totalActual ? 'text-green-700' : 'text-red-700'}`}>
                차이 {formatNumber(totalActual - totalExpected)}
              </span>
            </div>
          </div>

          <div className="border rounded-lg p-3 text-sm text-gray-600 print-block">
            비고: {receiptLang === 'zh' ? (receiptZh?.notes || receipt.plan?.notes || '없음') : (receipt.plan?.notes || '없음')}
          </div>
          </div>
        </div>
      )}

      {shareOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShareOpen(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">공유 링크 생성</h3>
                <p className="text-xs text-gray-500">기본 만료 7일, 비밀번호 선택</p>
              </div>
              <button
                type="button"
                onClick={() => setShareOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">만료일</label>
                <input
                  type="date"
                  value={shareExpiry}
                  onChange={(e) => setShareExpiry(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">비밀번호 (선택)</label>
                <input
                  type="password"
                  value={sharePassword}
                  onChange={(e) => setSharePassword(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="미입력 시 비밀번호 없음"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">기본 언어</label>
                <select
                  value={shareDefaultLang}
                  onChange={(e) => setShareDefaultLang(e.target.value as 'ko' | 'en' | 'zh')}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="ko">한국어</option>
                  <option value="en">English</option>
                  <option value="zh">中文</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800">요약/비고 번역</div>
              <button
                type="button"
                onClick={handleAutoTranslate}
                disabled={shareTranslating}
                className="text-xs px-3 py-1 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-60"
              >
                {shareTranslating ? '번역 중...' : '자동 번역'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">한국어</label>
                <textarea
                  value={shareSummaryKo}
                  onChange={(e) => setShareSummaryKo(e.target.value)}
                  rows={6}
                  className="w-full border rounded-lg px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">English</label>
                <textarea
                  value={shareSummaryEn}
                  onChange={(e) => setShareSummaryEn(e.target.value)}
                  rows={6}
                  className="w-full border rounded-lg px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">中文</label>
                <textarea
                  value={shareSummaryZh}
                  onChange={(e) => setShareSummaryZh(e.target.value)}
                  rows={6}
                  className="w-full border rounded-lg px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="border rounded-lg">
              <div className="px-3 py-2 text-xs font-semibold text-gray-600 border-b bg-gray-50">
                품목별 번역
              </div>
              <div className="divide-y">
                {shareLines.map((line, idx) => (
                  <div key={`${line.product_id}-${idx}`} className="p-3 space-y-2">
                    <div className="text-xs text-gray-500">
                      {line.product_sku || '-'} {line.barcode ? `| ${line.barcode}` : ''}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <input
                        type="text"
                        className="border rounded px-2 py-1 text-xs"
                        value={line.product_name_ko || ''}
                        onChange={(e) => {
                          const next = [...shareLines];
                          next[idx] = { ...next[idx], product_name_ko: e.target.value };
                          setShareLines(next);
                        }}
                        placeholder="상품명 (KO)"
                      />
                      <input
                        type="text"
                        className="border rounded px-2 py-1 text-xs"
                        value={line.product_name_en || ''}
                        onChange={(e) => {
                          const next = [...shareLines];
                          next[idx] = { ...next[idx], product_name_en: e.target.value };
                          setShareLines(next);
                        }}
                        placeholder="Product (EN)"
                      />
                      <input
                        type="text"
                        className="border rounded px-2 py-1 text-xs"
                        value={line.product_name_zh || ''}
                        onChange={(e) => {
                          const next = [...shareLines];
                          next[idx] = { ...next[idx], product_name_zh: e.target.value };
                          setShareLines(next);
                        }}
                        placeholder="产品 (ZH)"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <input
                        type="text"
                        className="border rounded px-2 py-1 text-xs"
                        value={line.line_notes_ko || ''}
                        onChange={(e) => {
                          const next = [...shareLines];
                          next[idx] = { ...next[idx], line_notes_ko: e.target.value };
                          setShareLines(next);
                        }}
                        placeholder="비고 (KO)"
                      />
                      <input
                        type="text"
                        className="border rounded px-2 py-1 text-xs"
                        value={line.line_notes_en || ''}
                        onChange={(e) => {
                          const next = [...shareLines];
                          next[idx] = { ...next[idx], line_notes_en: e.target.value };
                          setShareLines(next);
                        }}
                        placeholder="Notes (EN)"
                      />
                      <input
                        type="text"
                        className="border rounded px-2 py-1 text-xs"
                        value={line.line_notes_zh || ''}
                        onChange={(e) => {
                          const next = [...shareLines];
                          next[idx] = { ...next[idx], line_notes_zh: e.target.value };
                          setShareLines(next);
                        }}
                        placeholder="备注 (ZH)"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border rounded-lg">
              <div className="px-3 py-2 text-xs font-semibold text-gray-600 border-b bg-gray-50">
                공유 링크 목록
              </div>
              <div className="divide-y">
                {shareList.length === 0 ? (
                  <div className="p-3 text-xs text-gray-400">생성된 공유 링크가 없습니다.</div>
                ) : (
                  shareList.map((item) => {
                    const shareBase = `${window.location.origin}/share/inbound/${item.slug}`;
                    const expired = item.expires_at && new Date(item.expires_at).getTime() < Date.now();
                    const extendDays = shareExtendDays[item.id] ?? 7;
                    return (
                      <div key={item.id} className="p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-xs">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-700 truncate">{shareBase}</div>
                          <div className="text-gray-400">
                            만료: {item.expires_at ? new Date(item.expires_at).toLocaleDateString() : '없음'}
                            {expired && <span className="ml-2 text-red-500">만료됨</span>}
                          </div>
                          <div className="mt-1 text-gray-400 flex items-center gap-2">
                            <span>기본 언어</span>
                            <select
                              value={item.language_default || 'ko'}
                              onChange={async (e) => {
                                const next = e.target.value;
                                const res = await fetch('/api/admin/inbound-share', {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    id: item.id,
                                    updates: { language_default: next },
                                  }),
                                });
                                if (res.ok) loadShareList();
                              }}
                              className="border rounded px-1 py-0.5 text-xs"
                            >
                              <option value="ko">한국어</option>
                              <option value="en">English</option>
                              <option value="zh">中文</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(shareBase)}
                            className="px-2 py-1 border rounded"
                          >
                            복사
                          </button>
                          <select
                            value={extendDays}
                            onChange={(e) => {
                              setShareExtendDays((prev) => ({
                                ...prev,
                                [item.id]: Number(e.target.value),
                              }));
                            }}
                            className="border rounded px-1 py-0.5 text-xs"
                          >
                            <option value={7}>7일</option>
                            <option value={14}>14일</option>
                            <option value={30}>30일</option>
                          </select>
                          <button
                            type="button"
                            onClick={async () => {
                              const next = new Date();
                              next.setDate(next.getDate() + extendDays);
                              const res = await fetch('/api/admin/inbound-share', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  id: item.id,
                                  updates: { expires_at: next.toISOString() },
                                }),
                              });
                              if (res.ok) loadShareList();
                            }}
                            className="px-2 py-1 border rounded text-blue-600 border-blue-200"
                          >
                            7일 연장
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm('해당 링크를 삭제하시겠습니까?')) return;
                              const res = await fetch(`/api/admin/inbound-share?id=${item.id}`, { method: 'DELETE' });
                              if (res.ok) loadShareList();
                            }}
                            className="px-2 py-1 border rounded text-red-600 border-red-200"
                          >
                            삭제
                          </button>
                          <button
                            type="button"
                            onClick={handleCreateShare}
                            className="px-2 py-1 border rounded text-blue-600 border-blue-200"
                          >
                            재발급
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {shareUrl && (
              <div className="rounded-lg border bg-gray-50 p-3 text-sm flex items-center justify-between gap-2">
                <div className="truncate">{shareUrl}</div>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(shareUrl)}
                  className="px-3 py-1 rounded border text-xs"
                >
                  복사
                </button>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShareOpen(false)}
                className="px-4 py-2 rounded-lg border text-sm"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={handleCreateShare}
                disabled={shareSaving}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-60"
              >
                {shareSaving ? '생성 중...' : '공유 링크 생성'}
              </button>
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
