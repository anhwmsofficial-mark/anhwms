'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ClipboardDocumentCheckIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowLeftIcon,
  InformationCircleIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import {
  formatClientApiErrorMessage,
  getPermissionErrorMessage,
  isForbiddenError,
  isUnauthenticatedError,
  normalizeInlineError,
  toClientApiError,
} from '@/lib/api/client';
import { showError, showSuccess } from '@/lib/toast';

function getUiErrorMessage(status: number, payload: unknown, fallback: string) {
  const apiError = toClientApiError(status, payload, fallback);
  if (isUnauthenticatedError(apiError) || isForbiddenError(apiError)) {
    return getPermissionErrorMessage(apiError);
  }
  return formatClientApiErrorMessage(apiError, fallback);
}

export default function InboundInspectPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [inbound, setInbound] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [receivedQty, setReceivedQty] = useState<number>(0);
  const [rejectedQty, setRejectedQty] = useState<number>(0);
  const [condition, setCondition] = useState('GOOD');
  const [note, setNote] = useState('');
  const [photos] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [inspectionLines, setInspectionLines] = useState<
    Array<{
      receiptLineId: string;
      planLineId?: string | null;
      productId: string;
      productName: string;
      sku?: string;
      expectedQty: number;
      acceptedQty: number;
      damagedQty: number;
      note: string;
    }>
  >([]);

  const [inboundId, setInboundId] = useState<string>('');

  const fetchInbound = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/inbound/${id}`);
      if (!res.ok) {
        throw new Error('입고 정보를 불러올 수 없습니다.');
      }

      const raw = await res.json();
      const data = raw?.data ?? raw;
      setInbound(data);

      const lines = Array.isArray(data?.lines) ? data.lines : [];
      if (lines.length > 1) {
        setInspectionLines(
          lines.map((line: any) => ({
            receiptLineId: line.receiptLineId || line.id,
            planLineId: line.planLineId || null,
            productId: line.productId,
            productName: line.productName || 'Unknown Product',
            sku: line.sku || '',
            expectedQty: Number(line.expectedQty || 0),
            acceptedQty: Number(line.acceptedQty ?? line.receivedQty ?? 0),
            damagedQty: Number(line.damagedQty || 0),
            note: line.note || '',
          })),
        );
      } else {
        const singleLine = lines[0];
        setReceivedQty(Number(singleLine?.acceptedQty ?? data.received_quantity ?? data.quantity ?? 0));
        setRejectedQty(Number(singleLine?.damagedQty ?? 0));
        setNote(singleLine?.note || '');
      }
    } catch (err) {
      console.error(err);
      showError('입고 정보를 불러올 수 없습니다.');
      router.push('/admin/inbound');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    params.then(p => {
        setInboundId(p.id);
        fetchInbound(p.id);
    });
  }, [params, fetchInbound]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inboundId) return;

    setSubmitting(true);
    try {
      const isMultiLine = inbound?.lines && inbound.lines.length > 1;
      const payload = isMultiLine
        ? {
            lines: inspectionLines.map((line) => ({
              receiptLineId: line.receiptLineId,
              planLineId: line.planLineId,
              productId: line.productId,
              expectedQty: line.expectedQty,
              acceptedQty: line.acceptedQty,
              damagedQty: line.damagedQty,
              note: line.note,
            })),
            photos,
            completeInbound: isComplete,
          }
        : {
            receivedQty,
            rejectedQty,
            condition,
            note,
            photos,
            completeInbound: isComplete,
          };

      const res = await fetch(`/api/inbound/${inboundId}/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorPayload = await res.json().catch(() => null);
        throw new Error(getUiErrorMessage(res.status, errorPayload, '검수 처리 실패'));
      }

      const result = await res.json().catch(() => null);
      const nextStatus = result?.data?.status;
      if (nextStatus === 'DISCREPANCY') {
        showSuccess('검수 결과가 저장되었으며 수량 차이로 이슈 상태로 전환되었습니다.');
      } else {
        showSuccess(isComplete ? '검수가 완료되고 입고가 확정되었습니다.' : '검수 결과가 저장되었습니다.');
      }
      router.push('/admin/inbound');
    } catch (err: unknown) {
      showError(normalizeInlineError(err, '검수 처리 중 오류가 발생했습니다.').message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center">로딩 중...</div>;
  if (!inbound) return <div className="p-8 text-center">정보를 찾을 수 없습니다.</div>;

  const isMultiLine = inbound.lines && inbound.lines.length > 1;
  const isLocked = ['CONFIRMED', 'PUTAWAY_READY', 'CANCELLED'].includes(inbound.status);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/inbound" className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
            <h1 className="text-2xl font-bold text-gray-900">입고 검수</h1>
            <p className="text-sm text-gray-500">
                {inbound.productName} ({inbound.quantity}개 예정) - {inbound.supplierName}
            </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {isMultiLine && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
            <InformationCircleIcon className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-bold mb-1">다품목 검수 모드</p>
              <p>라인별 양품/불량/비고를 입력한 뒤 저장하거나 바로 확정할 수 있습니다.</p>
            </div>
          </div>
        )}

        {isLocked && (
          <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4 flex gap-3">
            <LockClosedIcon className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-700">
              <p className="font-bold mb-1">수정 불가</p>
              <p>이미 확정되거나 취소된 입고 건은 수정할 수 없습니다.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {!isMultiLine && (
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">실제 도착 수량 (양품)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    className="block w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-lg font-bold text-blue-600 disabled:bg-gray-100 disabled:text-gray-500"
                    value={receivedQty}
                    onChange={(e) => setReceivedQty(Number(e.target.value))}
                    disabled={isLocked}
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">EA</div>
                </div>
                {receivedQty + rejectedQty !== inbound.quantity && (
                  <p className="text-sm text-orange-600 mt-1 flex items-center gap-1">
                    <ExclamationTriangleIcon className="w-4 h-4" />
                    양품 + 불량 합계가 예정 수량({inbound.quantity})과 다릅니다.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">불량/거절 수량</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    className="block w-full border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500 text-lg font-bold text-red-600 disabled:bg-gray-100 disabled:text-gray-500"
                    value={rejectedQty}
                    onChange={(e) => setRejectedQty(Number(e.target.value))}
                    disabled={isLocked}
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">EA</div>
                </div>
              </div>
            </div>
          )}

          {!isMultiLine && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">상품 상태</label>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { id: 'GOOD', label: '양호', icon: CheckCircleIcon, color: 'text-green-600 bg-green-50 border-green-200' },
                  { id: 'DAMAGED', label: '파손됨', icon: XCircleIcon, color: 'text-red-600 bg-red-50 border-red-200' },
                  { id: 'WRONG_ITEM', label: '오배송', icon: ExclamationTriangleIcon, color: 'text-orange-600 bg-orange-50 border-orange-200' },
                  { id: 'EXPIRED', label: '유통기한', icon: ExclamationTriangleIcon, color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCondition(item.id)}
                    disabled={isLocked}
                    className={`
                      flex flex-col items-center justify-center p-3 rounded-lg border transition-all
                      ${condition === item.id
                        ? `ring-2 ring-offset-1 ring-blue-500 ${item.color}`
                        : 'border-gray-200 hover:bg-gray-50 text-gray-600'}
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    <item.icon className="w-6 h-6 mb-1" />
                    <span className="text-xs font-medium">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {isMultiLine && (
            <div className="space-y-4">
              <div className="md:hidden space-y-3">
                {inspectionLines.map((line, index) => {
                  const total = Number(line.acceptedQty || 0) + Number(line.damagedQty || 0);
                  const mismatch = total !== Number(line.expectedQty || 0);
                  return (
                    <div key={line.receiptLineId} className="rounded-lg border border-gray-200 p-4 space-y-3">
                      <div>
                        <p className="font-semibold text-gray-900">{line.productName}</p>
                        <p className="text-xs text-gray-500">{line.sku || 'SKU 없음'}</p>
                      </div>
                      <div className="text-sm text-gray-600">예정 수량: {line.expectedQty} EA</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">양품</label>
                          <input
                            type="number"
                            min="0"
                            value={line.acceptedQty}
                            disabled={isLocked}
                            onChange={(e) =>
                              setInspectionLines((prev) =>
                                prev.map((item, idx) =>
                                  idx === index ? { ...item, acceptedQty: Number(e.target.value) } : item,
                                ),
                              )
                            }
                            className="block w-full rounded-lg border-gray-300 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">불량</label>
                          <input
                            type="number"
                            min="0"
                            value={line.damagedQty}
                            disabled={isLocked}
                            onChange={(e) =>
                              setInspectionLines((prev) =>
                                prev.map((item, idx) =>
                                  idx === index ? { ...item, damagedQty: Number(e.target.value) } : item,
                                ),
                              )
                            }
                            className="block w-full rounded-lg border-gray-300 text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">비고</label>
                        <textarea
                          rows={2}
                          value={line.note}
                          disabled={isLocked}
                          onChange={(e) =>
                            setInspectionLines((prev) =>
                              prev.map((item, idx) => (idx === index ? { ...item, note: e.target.value } : item)),
                            )
                          }
                          className="block w-full rounded-lg border-gray-300 text-sm"
                        />
                      </div>
                      {mismatch && (
                        <p className="text-xs text-orange-600 flex items-center gap-1">
                          <ExclamationTriangleIcon className="w-4 h-4" />
                          양품 + 불량 합계가 예정 수량과 다릅니다.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">상품</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">예정</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">양품</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">불량</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">비고</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {inspectionLines.map((line, index) => {
                      const total = Number(line.acceptedQty || 0) + Number(line.damagedQty || 0);
                      const mismatch = total !== Number(line.expectedQty || 0);
                      return (
                        <tr key={line.receiptLineId}>
                          <td className="px-4 py-3 align-top">
                            <div className="font-medium text-gray-900">{line.productName}</div>
                            <div className="text-xs text-gray-500">{line.sku || 'SKU 없음'}</div>
                            {mismatch && (
                              <div className="mt-1 text-xs text-orange-600">합계와 예정 수량이 다릅니다.</div>
                            )}
                          </td>
                          <td className="px-4 py-3 align-top text-sm text-gray-700">{line.expectedQty} EA</td>
                          <td className="px-4 py-3 align-top">
                            <input
                              type="number"
                              min="0"
                              value={line.acceptedQty}
                              disabled={isLocked}
                              onChange={(e) =>
                                setInspectionLines((prev) =>
                                  prev.map((item, idx) =>
                                    idx === index ? { ...item, acceptedQty: Number(e.target.value) } : item,
                                  ),
                                )
                              }
                              className="block w-24 rounded-lg border-gray-300 text-sm"
                            />
                          </td>
                          <td className="px-4 py-3 align-top">
                            <input
                              type="number"
                              min="0"
                              value={line.damagedQty}
                              disabled={isLocked}
                              onChange={(e) =>
                                setInspectionLines((prev) =>
                                  prev.map((item, idx) =>
                                    idx === index ? { ...item, damagedQty: Number(e.target.value) } : item,
                                  ),
                                )
                              }
                              className="block w-24 rounded-lg border-gray-300 text-sm"
                            />
                          </td>
                          <td className="px-4 py-3 align-top">
                            <textarea
                              rows={2}
                              value={line.note}
                              disabled={isLocked}
                              onChange={(e) =>
                                setInspectionLines((prev) =>
                                  prev.map((item, idx) => (idx === index ? { ...item, note: e.target.value } : item)),
                                )
                              }
                              className="block min-w-[220px] rounded-lg border-gray-300 text-sm"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!isMultiLine && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">검수 메모</label>
              <textarea
                rows={3}
                className="block w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                placeholder="특이사항을 입력하세요..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={isLocked}
              />
            </div>
          )}

          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <input
                id="complete"
                type="checkbox"
                className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                checked={isComplete}
                onChange={(e) => setIsComplete(e.target.checked)}
                disabled={isLocked}
              />
              <label htmlFor="complete" className={`font-medium cursor-pointer ${isLocked ? 'text-gray-400 cursor-not-allowed' : 'text-gray-900'}`}>
                검수를 마치고 입고를 확정합니다.
              </label>
            </div>
            {isComplete && (
              <p className="text-sm text-gray-500 mb-4 ml-7">
                * 확정 시 재고가 즉시 반영되며, 수량 차이가 있으면 이슈 상태로 전환될 수 있습니다.
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || isLocked}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <ClipboardDocumentCheckIcon className="w-5 h-5" />
              {submitting ? '처리 중...' : (isLocked ? '검수 완료됨' : isComplete ? '검수 저장 후 확정' : '검수 결과 저장')}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

