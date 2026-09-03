'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import JSZip from 'jszip';
import { useParams } from 'next/navigation';
import {
  formatClientApiErrorMessage,
  toClientApiError,
  unwrapApiData,
} from '@/lib/api/client';
import { formatInteger } from '@/utils/number-format';

type Lang = 'ko' | 'en' | 'zh';

const RECEIPT_LABELS: Record<Lang, Record<string, string>> = {
  ko: {
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
    password: '비밀번호',
    unlock: '열기',
    empty: '표시할 품목이 없습니다.',
    unregistered: '미등록',
    unspecified: '미지정',
  },
  en: {
    title: 'Receipt',
    subtitle: 'Inbound inspection and receipt details',
    receiptNo: 'Receipt No',
    clientName: 'Client',
    warehouse: 'Warehouse',
    shipFrom: 'Ship-from address',
    inboundAddress: 'Inbound address',
    inboundDate: 'Inbound date',
    manager: 'Manager',
    contact: 'Contact',
    total: 'Total',
    expected: 'Expected',
    normal: 'Normal',
    damaged: 'Damaged',
    missing: 'Missing',
    other: 'Other',
    actual: 'Actual',
    diff: 'Difference',
    notes: 'Notes',
    none: 'None',
    productInfo: 'Product',
    barcode: 'Barcode',
    box: 'Box',
    qty: 'Qty',
    stockBeforeAfter: 'Stock before/after',
    expMfgDate: 'Expiry / Mfg date',
    password: 'Password',
    unlock: 'Unlock',
    empty: 'No items to display.',
    unregistered: 'Not registered',
    unspecified: 'Unspecified',
  },
  zh: {
    title: '收货单',
    subtitle: '入库检验与交接明细',
    receiptNo: '收货编号',
    clientName: '客户名称',
    warehouse: '入库仓库',
    shipFrom: '发货地址',
    inboundAddress: '入库地址',
    inboundDate: '入库日期',
    manager: '负责人',
    contact: '联系方式',
    total: '合计',
    expected: '预计',
    normal: '正常',
    damaged: '损坏',
    missing: '缺失',
    other: '其他',
    actual: '实合计',
    diff: '差异',
    notes: '备注',
    none: '无',
    productInfo: '产品信息',
    barcode: '条码',
    box: '箱数',
    qty: '数量',
    stockBeforeAfter: '库存前/后',
    expMfgDate: '保质/生产日期',
    password: '密码',
    unlock: '打开',
    empty: '没有可显示的品项。',
    unregistered: '未登记',
    unspecified: '未指定',
  },
};

function pickLocalized(lang: Lang, ko?: string | null, en?: string | null, zh?: string | null) {
  if (lang === 'en') return en || ko || zh || '';
  if (lang === 'zh') return zh || ko || en || '';
  return ko || en || zh || '';
}

export default function InboundSharePage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [share, setShare] = useState<any>(null);
  const [lang, setLang] = useState<Lang>('ko');
  const [zipLoading, setZipLoading] = useState(false);

  const getUiErrorMessage = useCallback((status: number, payload: unknown, fallback: string) => {
    const apiError = toClientApiError(status, payload, fallback);
    if (status === 401) {
      return formatClientApiErrorMessage(apiError, '비밀번호가 올바르지 않습니다.');
    }
    if (status === 410) {
      return formatClientApiErrorMessage(apiError, '공유 링크가 만료되었습니다.');
    }
    return formatClientApiErrorMessage(apiError, fallback);
  }, []);

  const loadShare = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/share/inbound?slug=${encodeURIComponent(slug)}`);
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(getUiErrorMessage(res.status, payload, '공유 정보를 불러오지 못했습니다.'));
      const data = unwrapApiData<any>(payload);
      if (data.requiresPassword) {
        setRequiresPassword(true);
      } else {
        setShare(data.share);
        setLang((data.share?.language_default as Lang) || 'ko');
      }
    } catch (e: any) {
      setError(e?.message || '공유 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [getUiErrorMessage, slug]);

  useEffect(() => {
    if (slug) loadShare();
  }, [slug, loadShare]);

  const handleVerify = async () => {
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch('/api/share/inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, password }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(getUiErrorMessage(res.status, payload, '비밀번호 확인 실패'));
      const data = unwrapApiData<any>(payload);
      setShare(data.share);
      setLang((data.share?.language_default as Lang) || 'ko');
      setRequiresPassword(false);
    } catch (e: any) {
      setError(e?.message || '비밀번호 확인 실패');
    } finally {
      setVerifying(false);
    }
  };

  const content = useMemo(() => share?.content || {}, [share]);
  const lines = useMemo(() => content?.lines || [], [content]);
  const photos = useMemo(() => content?.photos || [], [content]);
  const label = RECEIPT_LABELS[lang];
  const printGeneratedAt = useMemo(() => new Date().toLocaleString('ko-KR'), []);

  const totals = useMemo(() => {
    return lines.reduce(
      (acc: { expected: number; normal: number; damaged: number; missing: number; other: number }, line: any) => {
        acc.expected += Number(line.expected_qty || 0);
        acc.normal += Number(line.accepted_qty || 0);
        acc.damaged += Number(line.damaged_qty || 0);
        acc.missing += Number(line.missing_qty || 0);
        acc.other += Number(line.other_qty || 0);
        return acc;
      },
      { expected: 0, normal: 0, damaged: 0, missing: 0, other: 0 }
    );
  }, [lines]);

  const totalActual = totals.normal + totals.damaged + totals.missing + totals.other;
  const notesText = content.notes || pickLocalized(lang, share?.summary_ko, share?.summary_en, share?.summary_zh);

  if (loading) {
    return <div className="p-6 text-center text-gray-500">로딩 중...</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-red-600">{error}</div>;
  }

  if (requiresPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-sm bg-white border rounded-xl shadow-sm p-6 space-y-4">
          <h1 className="text-lg font-bold text-gray-900">{label.title}</h1>
          <p className="text-sm text-gray-500">{label.subtitle}</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={label.password}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleVerify}
            disabled={verifying}
            className="w-full rounded-lg bg-blue-600 text-white py-2 text-sm font-semibold disabled:opacity-60"
          >
            {verifying ? '...' : label.unlock}
          </button>
        </div>
      </div>
    );
  }

  const handleDownloadAll = async () => {
    if (!photos.length) return;
    setZipLoading(true);
    try {
      const zip = new JSZip();
      const tasks = photos.flatMap((group: any) =>
        (group.urls || []).map(async (url: string, idx: number) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error('이미지 다운로드 실패');
          const blob = await res.blob();
          const title = (group.title || 'photo').replace(/[^\w\-]+/g, '_');
          const ext = blob.type.includes('png') ? 'png' : 'jpg';
          zip.file(`${title}_${idx + 1}.${ext}`, blob);
        })
      );
      await Promise.allSettled(tasks);
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${content?.receipt_no || 'inbound'}_photos.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setZipLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-y-auto bg-gray-50">
      <div className="max-w-[1060px] mx-auto p-6 pb-20 space-y-6">
        <div className="flex justify-end gap-2">
          {(['ko', 'en', 'zh'] as Lang[]).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLang(code)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                lang === code ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600'
              }`}
            >
              {code.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-[12px] border border-gray-300 p-7 md:p-8 space-y-8">
          <div className="flex items-center justify-between text-xs leading-[1.5] text-gray-500">
            <span>{printGeneratedAt}</span>
            <span className="text-sm tracking-wide text-gray-700">ANH Group - 글로벌 물류 플랫폼</span>
            <span>1/1</span>
          </div>
          <div className="pt-6">
            <h2 className="text-2xl font-bold leading-[1.4] text-gray-900 mb-1">{label.title}</h2>
            <p className="text-sm text-gray-500 leading-[1.5] mb-4">{label.subtitle}</p>
            <div className="text-base font-medium leading-[1.5] text-gray-700 mb-6">
              {label.receiptNo}: <span className="font-semibold">{content.receipt_no || '-'}</span>
            </div>
          </div>

          <div className="border border-gray-300 rounded-[10px] p-4 md:p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 py-4 border-b border-gray-200">
              <div>
                <div className="text-xs text-gray-500 mb-1">{label.clientName}</div>
                <div className="text-base font-medium leading-[1.5] text-gray-900">{content.client_name || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">{label.warehouse}</div>
                <div className="text-base font-medium leading-[1.5] text-gray-900">{content.warehouse_name || label.unspecified}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 py-4 border-b border-gray-200">
              <div>
                <div className="text-xs text-gray-500 mb-1">{label.shipFrom}</div>
                <div className="text-base font-medium leading-[1.5] text-gray-900">{content.ship_from_address || label.unregistered}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">{label.inboundAddress}</div>
                <div className="text-base font-medium leading-[1.5] text-gray-900">{content.inbound_address || label.unregistered}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 py-4">
              <div>
                <div className="text-xs text-gray-500 mb-1">{label.inboundDate}</div>
                <div className="text-base font-medium leading-[1.5] text-gray-900">{content.planned_date || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">{label.manager}</div>
                <div className="text-base font-medium leading-[1.5] text-gray-900">{content.inbound_manager || label.unspecified}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">{label.contact}</div>
                <div className="text-base font-medium leading-[1.5] text-gray-900">{content.contact_phone || '-'}</div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 tracking-wide">{label.productInfo}</h3>
            <div className="border border-gray-300 rounded-[10px] overflow-hidden">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col style={{ width: '27%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '84px' }} />
                  <col style={{ width: '128px' }} />
                  <col style={{ width: '104px' }} />
                  <col style={{ width: '17%' }} />
                  <col style={{ width: '20%' }} />
                </colgroup>
                <thead className="bg-gray-100 text-sm font-semibold text-gray-700">
                  <tr>
                    <th className="py-3 px-4 border-r text-left">{label.productInfo}</th>
                    <th className="py-3 px-4 border-r text-left">{label.barcode}</th>
                    <th className="py-3 px-4 border-r text-center whitespace-nowrap">{label.box}</th>
                    <th className="py-3 px-4 border-r text-center whitespace-nowrap">{label.qty}</th>
                    <th className="py-3 px-4 border-r text-center whitespace-nowrap">{label.stockBeforeAfter}</th>
                    <th className="py-3 px-4 border-r text-left">{label.expMfgDate}</th>
                    <th className="py-3 px-4 text-left">{label.notes}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lines.map((line: any, idx: number) => {
                    const productName = pickLocalized(lang, line.product_name_ko || line.product_name, line.product_name_en, line.product_name_zh);
                    const baseNote = pickLocalized(lang, line.line_notes_ko, line.line_notes_en, line.line_notes_zh);
                    const issueParts = [
                      line.damaged_qty > 0 ? `${label.damaged} ${formatInteger(line.damaged_qty)}` : null,
                      line.missing_qty > 0 ? `${label.missing} ${formatInteger(line.missing_qty)}` : null,
                      line.other_qty > 0 ? `${label.other} ${formatInteger(line.other_qty)}` : null,
                    ].filter(Boolean);
                    const displayNote = [baseNote, issueParts.join(', ')].filter(Boolean).join(' · ') || '-';
                    const stockText =
                      line.stock_before !== undefined && line.stock_before !== null
                        ? `${formatInteger(line.stock_before)} → ${formatInteger(line.stock_after)}`
                        : '-';
                    const dateText =
                      line.mfg_date || line.expiry_date
                        ? `${line.mfg_date || '-'} / ${line.expiry_date || '-'}`
                        : '-';

                    return (
                      <tr key={`${line.product_id || line.product_sku || 'line'}-${idx}`} className="align-top">
                        <td className="py-3 px-4 border-r break-words overflow-hidden">
                          <div className="font-semibold text-gray-900 leading-[1.4]">{productName || '-'}</div>
                        </td>
                        <td className="py-3 px-4 border-r text-gray-700 font-mono text-[11px] break-all overflow-hidden leading-[1.4]">
                          {line.barcode || '-'}
                        </td>
                        <td className="py-3 px-4 border-r text-gray-700 text-center whitespace-nowrap leading-[1.4]">
                          {line.box_count || '-'}
                        </td>
                        <td className="py-3 px-4 border-r text-gray-700 text-center whitespace-nowrap leading-[1.4]">
                          {formatInteger(line.accepted_qty ?? 0)}
                        </td>
                        <td className="py-3 px-4 border-r text-gray-700 text-center whitespace-nowrap leading-[1.4]">
                          {stockText}
                        </td>
                        <td className="py-3 px-4 border-r text-gray-700 break-words overflow-hidden leading-[1.4]">
                          {dateText}
                        </td>
                        <td className="py-3 px-4 text-gray-700 break-words overflow-hidden leading-[1.4]">
                          {displayNote}
                        </td>
                      </tr>
                    );
                  })}
                  {lines.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-gray-400">{label.empty}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border border-gray-300 bg-gray-50 rounded-[10px] p-5 text-sm text-gray-700 font-medium">
            <div className="text-sm font-semibold text-gray-700 tracking-wide mb-3">{label.total}</div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-base leading-[1.5]">
              <span>{label.expected} {formatInteger(totals.expected)}</span>
              <span>{label.normal} {formatInteger(totals.normal)}</span>
              <span>{label.damaged} {formatInteger(totals.damaged)}</span>
              <span>{label.missing} {formatInteger(totals.missing)}</span>
              <span>{label.other} {formatInteger(totals.other)}</span>
              <span className="font-semibold">{label.actual} {formatInteger(totalActual)}</span>
              <span className={`font-semibold ${totals.expected === totalActual ? 'text-green-700' : 'text-red-700'}`}>
                {label.diff} {formatInteger(totalActual - totals.expected)}
              </span>
            </div>
          </div>

          <div className="border border-dashed border-gray-300 bg-[#fafafa] rounded-[10px] p-4 md:p-5 min-h-[60px] text-base leading-[1.5] text-gray-600">
            {label.notes}: {notesText || label.none}
          </div>
        </div>

        {photos.length > 0 && (
          <div className="bg-white rounded-xl border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800">Photos</div>
              <button
                type="button"
                onClick={handleDownloadAll}
                disabled={zipLoading}
                className="text-xs px-3 py-1 rounded border text-blue-600 border-blue-200 disabled:opacity-60"
              >
                {zipLoading ? 'Zipping...' : 'Download All (zip)'}
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {photos.flatMap((group: any) =>
                (group.urls || []).map((url: string, idx: number) => (
                  <div key={`${group.title}-${idx}`} className="border rounded-lg overflow-hidden">
                    {/* Native img: share snapshots may use signed storage URLs that next/image rejects. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={group.title || 'photo'}
                      className="w-full h-32 object-cover"
                    />
                    <div className="flex items-center justify-between px-2 py-1 text-xs text-gray-500">
                      <span className="truncate">{group.title || 'Photo'}</span>
                      <a
                        href={url}
                        download
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        Download
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
