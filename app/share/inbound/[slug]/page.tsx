'use client';

import { useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import { useParams } from 'next/navigation';

type Lang = 'ko' | 'en' | 'zh';

const LABELS: Record<Lang, Record<string, string>> = {
  ko: {
    title: '입고 인수증',
    subtitle: '공유용 상세 페이지',
    receiptNo: '인수번호',
    client: '고객사',
    warehouse: '입고지',
    plannedDate: '입고일',
    manager: '담당자',
    summary: '요약/비고',
    items: '입고 품목',
    product: '제품',
    sku: 'SKU',
    barcode: '바코드',
    expected: '예정',
    normal: '정상',
    damaged: '파손',
    missing: '분실',
    other: '기타',
    total: '합계',
    password: '비밀번호',
    unlock: '열기',
  },
  en: {
    title: 'Inbound Receipt',
    subtitle: 'Shared Detail',
    receiptNo: 'Receipt No',
    client: 'Client',
    warehouse: 'Warehouse',
    plannedDate: 'Date',
    manager: 'Manager',
    summary: 'Summary/Notes',
    items: 'Items',
    product: 'Product',
    sku: 'SKU',
    barcode: 'Barcode',
    expected: 'Expected',
    normal: 'Normal',
    damaged: 'Damaged',
    missing: 'Missing',
    other: 'Other',
    total: 'Total',
    password: 'Password',
    unlock: 'Unlock',
  },
  zh: {
    title: '入库签收单',
    subtitle: '共享详情页',
    receiptNo: '签收单号',
    client: '客户',
    warehouse: '入库仓库',
    plannedDate: '入库日期',
    manager: '负责人',
    summary: '摘要/备注',
    items: '入库明细',
    product: '产品',
    sku: 'SKU',
    barcode: '条码',
    expected: '计划',
    normal: '正常',
    damaged: '破损',
    missing: '丢失',
    other: '其他',
    total: '合计',
    password: '密码',
    unlock: '打开',
  },
};

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

  const loadShare = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/share/inbound?slug=${encodeURIComponent(slug)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || '공유 정보를 불러오지 못했습니다.');
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
  };

  useEffect(() => {
    if (slug) loadShare();
  }, [slug]);

  const handleVerify = async () => {
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch('/api/share/inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || '비밀번호 확인 실패');
      setShare(data.share);
      setLang((data.share?.language_default as Lang) || 'ko');
      setRequiresPassword(false);
    } catch (e: any) {
      setError(e?.message || '비밀번호 확인 실패');
    } finally {
      setVerifying(false);
    }
  };

  const summaryText = useMemo(() => {
    if (!share) return '';
    if (lang === 'en') return share.summary_en || share.summary_ko || '';
    if (lang === 'zh') return share.summary_zh || share.summary_ko || '';
    return share.summary_ko || '';
  }, [share, lang]);

  const content = share?.content || {};
  const lines = content?.lines || [];
  const photos = content?.photos || [];

  const totals = useMemo(() => {
    return lines.reduce(
      (acc: any, line: any) => {
        acc.expected += line.expected_qty || 0;
        acc.normal += line.accepted_qty || 0;
        acc.damaged += line.damaged_qty || 0;
        acc.missing += line.missing_qty || 0;
        acc.other += line.other_qty || 0;
        return acc;
      },
      { expected: 0, normal: 0, damaged: 0, missing: 0, other: 0 }
    );
  }, [lines]);

  const label = LABELS[lang];

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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{label.title}</h1>
            <p className="text-sm text-gray-500">{label.subtitle}</p>
          </div>
          <div className="flex gap-2">
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
        </div>

        <div className="bg-white rounded-xl border p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs text-gray-500">{label.receiptNo}</div>
            <div className="font-semibold text-gray-900">{content.receipt_no || '-'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">{label.client}</div>
            <div className="font-semibold text-gray-900">{content.client_name || '-'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">{label.warehouse}</div>
            <div className="font-semibold text-gray-900">{content.warehouse_name || '-'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">{label.plannedDate}</div>
            <div className="font-semibold text-gray-900">{content.planned_date || '-'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">{label.manager}</div>
            <div className="font-semibold text-gray-900">{content.inbound_manager || '-'}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <div className="text-sm font-semibold text-gray-800 mb-2">{label.summary}</div>
          <div className="text-sm text-gray-700 whitespace-pre-wrap">{summaryText || '-'}</div>
        </div>

        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b text-sm font-semibold text-gray-800">{label.items}</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">{label.product}</th>
                  <th className="px-4 py-3 text-left">{label.sku}</th>
                  <th className="px-4 py-3 text-left">{label.barcode}</th>
                  <th className="px-4 py-3 text-right">{label.expected}</th>
                  <th className="px-4 py-3 text-right">{label.normal}</th>
                  <th className="px-4 py-3 text-right">{label.damaged}</th>
                  <th className="px-4 py-3 text-right">{label.missing}</th>
                  <th className="px-4 py-3 text-right">{label.other}</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line: any, idx: number) => (
                  <tr key={`${line.product_id}-${idx}`} className="border-t">
                    <td className="px-4 py-3">
                      {lang === 'en'
                        ? line.product_name_en || line.product_name_ko || line.product_name || '-'
                        : lang === 'zh'
                        ? line.product_name_zh || line.product_name_ko || line.product_name || '-'
                        : line.product_name_ko || line.product_name || '-'}
                      {line.line_notes_ko || line.line_notes_en || line.line_notes_zh ? (
                        <div className="text-xs text-gray-400 mt-1">
                          {lang === 'en'
                            ? line.line_notes_en || line.line_notes_ko || line.line_notes_zh
                            : lang === 'zh'
                            ? line.line_notes_zh || line.line_notes_ko || line.line_notes_en
                            : line.line_notes_ko || line.line_notes_en || line.line_notes_zh}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{line.product_sku || '-'}</td>
                    <td className="px-4 py-3">{line.barcode || '-'}</td>
                    <td className="px-4 py-3 text-right">{line.expected_qty ?? 0}</td>
                    <td className="px-4 py-3 text-right">{line.accepted_qty ?? 0}</td>
                    <td className="px-4 py-3 text-right">{line.damaged_qty ?? 0}</td>
                    <td className="px-4 py-3 text-right">{line.missing_qty ?? 0}</td>
                    <td className="px-4 py-3 text-right">{line.other_qty ?? 0}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t">
                <tr>
                  <td className="px-4 py-3 font-semibold" colSpan={3}>{label.total}</td>
                  <td className="px-4 py-3 text-right font-semibold">{totals.expected}</td>
                  <td className="px-4 py-3 text-right font-semibold">{totals.normal}</td>
                  <td className="px-4 py-3 text-right font-semibold">{totals.damaged}</td>
                  <td className="px-4 py-3 text-right font-semibold">{totals.missing}</td>
                  <td className="px-4 py-3 text-right font-semibold">{totals.other}</td>
                </tr>
              </tfoot>
            </table>
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
                    <img src={url} alt={group.title || 'photo'} className="w-full h-32 object-cover" />
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
