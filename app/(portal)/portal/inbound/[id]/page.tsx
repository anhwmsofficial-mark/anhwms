'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getPartnerInboundDetail } from '@/app/actions/partner-inbound';
import { formatInteger } from '@/utils/number-format';
import { showError } from '@/lib/toast';

type TabKey = 'info' | 'photos' | 'receipt';

const RECEIPT_LABELS = {
  title: '인수증',
  subtitle: '입고 검수 및 인수 내역',
  receiptNo: '인수번호',
  clientName: '거래처명',
  warehouse: '입고지점',
  shipFrom: '출하지주소',
  inboundAddress: '입고지주소',
  inboundDate: '입고날짜',
  manager: '관리담당자',
  contact: '연락처',
  total: '합계',
  expected: '예정',
  normal: '정상',
  damaged: '파손',
  missing: '분실',
  other: '기타',
  actual: '실합계',
  diff: '차이',
  notes: '비고',
  none: '없음',
  productInfo: '제품 정보',
  barcode: '바코드',
  box: '박스',
  qty: '수량',
  stockBeforeAfter: '재고 전/후',
  expMfgDate: '유통/제조일자',
};

export default function PartnerInboundDetailPage() {
  const params = useParams() as Record<string, string | string[] | undefined> | null;
  const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('info');
  const [receipt, setReceipt] = useState<any>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, { before: number; after: number }>>({});
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const result = await getPartnerInboundDetail(id);
    if (!result.ok) {
      setLoading(false);
      showError(result.error || '입고 정보를 찾을 수 없습니다.');
      return;
    }
    setReceipt(result.data.receipt);
    setLines(result.data.lines || []);
    setSnapshots(result.data.snapshots || {});
    setSlots(result.data.slots || []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) return <div className="p-6 text-center text-gray-500">로딩 중...</div>;
  if (!receipt) return <div className="p-6 text-center text-gray-500">입고 정보를 찾을 수 없습니다.</div>;

  const totalExpected = lines.reduce((sum, line) => sum + Number(line.expected_qty || 0), 0);
  const totalAccepted = lines.reduce((sum, line) => sum + Number(line.accepted_qty ?? line.received_qty ?? 0), 0);
  const totalDamaged = lines.reduce((sum, line) => sum + Number(line.damaged_qty || 0), 0);
  const totalMissing = lines.reduce((sum, line) => sum + Number(line.missing_qty || 0), 0);
  const totalOther = lines.reduce((sum, line) => sum + Number(line.other_qty || 0), 0);
  const totalActual = totalAccepted + totalDamaged + totalMissing + totalOther;
  const printGeneratedAt = new Date().toLocaleString('ko-KR');
  const shipFrom = [receipt.client?.address_line1, receipt.client?.address_line2, receipt.client?.city].filter(Boolean).join(' ') || '미등록';
  const inboundAddress = [receipt.warehouse?.address_line1, receipt.warehouse?.address_line2, receipt.warehouse?.city].filter(Boolean).join(' ') || '미등록';

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body * { visibility: hidden; }
          .print-receipt, .print-receipt * { visibility: visible; }
          .print-receipt { position: fixed; left: 0; top: 0; width: 100%; background: #fff; }
          .print-hide { display: none !important; }
        }
      `}</style>

      <div className="flex items-center justify-between print-hide">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">파트너데이터 · 입고현황</p>
          <h1 className="text-2xl font-bold text-gray-900">{receipt.receipt_no}</h1>
          <div className="text-sm text-gray-500">
            {receipt.client?.name} · {receipt.plan?.plan_no} · {receipt.plan?.planned_date}
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push('/portal/inbound')}
          className="rounded-lg border px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          목록으로
        </button>
      </div>

      <div className="flex gap-2 print-hide">
        {([
          ['info', '기본 정보'],
          ['photos', '사진'],
          ['receipt', '인수증'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              activeTab === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'info' && (
        <div className="rounded-xl border bg-white p-4">
          <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
            <div><span className="text-gray-500">상태:</span> {receipt.status}</div>
            <div><span className="text-gray-500">도착:</span> {receipt.arrived_at || '-'}</div>
            <div><span className="text-gray-500">완료:</span> {receipt.confirmed_at || '-'}</div>
          </div>
          <div className="mt-6">
            <h2 className="mb-2 font-bold text-gray-900">입고 라인</h2>
            <div className="space-y-2">
              {lines.map((line) => (
                <div key={line.id || line.receipt_line_id} className="rounded-lg border p-3 text-sm">
                  <div className="font-medium">{line.product?.name} ({line.product?.sku})</div>
                  <div className="text-gray-500">
                    예정: {formatInteger(line.expected_qty)} · 정상: {formatInteger(line.accepted_qty ?? line.received_qty ?? 0)}
                    · 파손: {formatInteger(line.damaged_qty || 0)} · 분실: {formatInteger(line.missing_qty || 0)} · 기타: {formatInteger(line.other_qty || 0)}
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
            <div key={slot.id} className="rounded-xl border bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="font-bold">{slot.title}</div>
                <div className="text-xs text-gray-500">{slot.photos?.length || 0}장</div>
              </div>
              {!slot.photos?.length ? (
                <div className="text-sm text-gray-400">등록된 사진이 없습니다.</div>
              ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {slot.photos.map((photo: any) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => setSelectedPhotoUrl(photo.url)}
                      className="overflow-hidden rounded-lg border"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt={slot.title || 'inbound'} className="h-32 w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {slots.length === 0 && <div className="text-sm text-gray-500">등록된 사진이 없습니다.</div>}
        </div>
      )}

      {activeTab === 'receipt' && (
        <div className="mx-auto max-w-[1060px] space-y-8 rounded-[12px] border border-gray-300 bg-white p-7 md:p-8">
          <div className="flex justify-end print-hide">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              인쇄
            </button>
          </div>

          <div className="print-receipt space-y-8">
            <div className="flex items-center justify-between text-xs leading-[1.5] text-gray-500">
              <span>{printGeneratedAt}</span>
              <span className="text-sm tracking-wide text-gray-700">ANH Group - 글로벌 물류 플랫폼</span>
              <span>1/1</span>
            </div>
            <div className="pt-6">
              <h2 className="mb-1 text-2xl font-bold leading-[1.4] text-gray-900">{RECEIPT_LABELS.title}</h2>
              <p className="mb-4 text-sm leading-[1.5] text-gray-500">{RECEIPT_LABELS.subtitle}</p>
              <div className="mb-6 text-base font-medium leading-[1.5] text-gray-700">
                {RECEIPT_LABELS.receiptNo}: <span className="font-semibold">{receipt.receipt_no}</span>
              </div>
            </div>

            <div className="rounded-[10px] border border-gray-300 p-4 md:p-5">
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 border-b border-gray-200 py-4 md:grid-cols-2">
                <div>
                  <div className="mb-1 text-xs text-gray-500">{RECEIPT_LABELS.clientName}</div>
                  <div className="text-base font-medium text-gray-900">{receipt.client?.name || '-'}</div>
                </div>
                <div>
                  <div className="mb-1 text-xs text-gray-500">{RECEIPT_LABELS.warehouse}</div>
                  <div className="text-base font-medium text-gray-900">{receipt.warehouse?.name || '미지정'}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 border-b border-gray-200 py-4 md:grid-cols-2">
                <div>
                  <div className="mb-1 text-xs text-gray-500">{RECEIPT_LABELS.shipFrom}</div>
                  <div className="text-base font-medium text-gray-900">{shipFrom}</div>
                </div>
                <div>
                  <div className="mb-1 text-xs text-gray-500">{RECEIPT_LABELS.inboundAddress}</div>
                  <div className="text-base font-medium text-gray-900">{inboundAddress}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 py-4 md:grid-cols-3">
                <div>
                  <div className="mb-1 text-xs text-gray-500">{RECEIPT_LABELS.inboundDate}</div>
                  <div className="text-base font-medium text-gray-900">{receipt.plan?.planned_date || receipt.arrived_at || '-'}</div>
                </div>
                <div>
                  <div className="mb-1 text-xs text-gray-500">{RECEIPT_LABELS.manager}</div>
                  <div className="text-base font-medium text-gray-900">{receipt.plan?.inbound_manager || receipt.client?.contact_name || '미지정'}</div>
                </div>
                <div>
                  <div className="mb-1 text-xs text-gray-500">{RECEIPT_LABELS.contact}</div>
                  <div className="text-base font-medium text-gray-900">{receipt.client?.contact_phone || '-'}</div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold tracking-wide text-gray-700">{RECEIPT_LABELS.productInfo}</h3>
              <div className="overflow-hidden rounded-[10px] border border-gray-300">
                <table className="w-full table-fixed text-sm">
                  <thead className="bg-gray-100 text-sm font-semibold text-gray-700">
                    <tr>
                      <th className="border-r px-4 py-3 text-left">{RECEIPT_LABELS.productInfo}</th>
                      <th className="border-r px-4 py-3 text-left">{RECEIPT_LABELS.barcode}</th>
                      <th className="border-r px-4 py-3 text-center">{RECEIPT_LABELS.box}</th>
                      <th className="border-r px-4 py-3 text-center">{RECEIPT_LABELS.qty}</th>
                      <th className="border-r px-4 py-3 text-center">{RECEIPT_LABELS.stockBeforeAfter}</th>
                      <th className="border-r px-4 py-3 text-left">{RECEIPT_LABELS.expMfgDate}</th>
                      <th className="px-4 py-3 text-left">{RECEIPT_LABELS.notes}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {lines.map((line) => (
                      <tr key={line.id || line.receipt_line_id} className="align-top">
                        <td className="border-r px-4 py-3 font-semibold text-gray-900">{line.product?.name || '상품명 없음'}</td>
                        <td className="border-r px-4 py-3 font-mono text-[11px] text-gray-700">{line.product?.barcode || '-'}</td>
                        <td className="border-r px-4 py-3 text-center text-gray-700">{line.box_count || '-'}</td>
                        <td className="border-r px-4 py-3 text-center text-gray-700">{formatInteger(line.accepted_qty ?? line.received_qty ?? 0)}</td>
                        <td className="border-r px-4 py-3 text-center text-gray-700">
                          {snapshots[line.product_id]
                            ? `${formatInteger(snapshots[line.product_id].before)} → ${formatInteger(snapshots[line.product_id].after)}`
                            : '-'}
                        </td>
                        <td className="border-r px-4 py-3 text-gray-700">
                          {line.mfg_date || line.expiry_date ? `${line.mfg_date || '-'} / ${line.expiry_date || '-'}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {line.field_check_notes || line.line_notes || line.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-[10px] border border-gray-300 bg-gray-50 p-5 text-sm font-medium text-gray-700">
              <div className="mb-3 text-sm font-semibold tracking-wide">{RECEIPT_LABELS.total}</div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-base">
                <span>{RECEIPT_LABELS.expected} {formatInteger(totalExpected)}</span>
                <span>{RECEIPT_LABELS.normal} {formatInteger(totalAccepted)}</span>
                <span>{RECEIPT_LABELS.damaged} {formatInteger(totalDamaged)}</span>
                <span>{RECEIPT_LABELS.missing} {formatInteger(totalMissing)}</span>
                <span>{RECEIPT_LABELS.other} {formatInteger(totalOther)}</span>
                <span className="font-semibold">{RECEIPT_LABELS.actual} {formatInteger(totalActual)}</span>
                <span className={`font-semibold ${totalExpected === totalActual ? 'text-green-700' : 'text-red-700'}`}>
                  {RECEIPT_LABELS.diff} {formatInteger(totalActual - totalExpected)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedPhotoUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setSelectedPhotoUrl(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={selectedPhotoUrl} alt="확대 사진" className="max-h-[80vh] max-w-full object-contain" />
        </div>
      )}
    </div>
  );
}
