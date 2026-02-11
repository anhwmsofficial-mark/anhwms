'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { CustomerOption } from '@/lib/api/partners';

interface InventoryVolumeUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: CustomerOption[];
  onSuccess?: () => void;
}

type PreviewResult = {
  sheetNames: string[];
  headers: string[];
  rowCount: number;
};

type LatestVolumeRow = {
  id: string;
  record_date: string | null;
  sheet_name: string | null;
  item_name: string | null;
  opening_stock_raw: string | null;
  closing_stock_raw: string | null;
};

type VolumeShareRow = {
  id: string;
  slug: string;
  customer_id: string;
  date_from: string | null;
  date_to: string | null;
  expires_at: string | null;
  has_password?: boolean;
  created_at?: string | null;
};

export default function InventoryVolumeUploadModal({
  isOpen,
  onClose,
  customers,
  onSuccess,
}: InventoryVolumeUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [recordDate, setRecordDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [latestRows, setLatestRows] = useState<LatestVolumeRow[]>([]);
  const [shareDateFrom, setShareDateFrom] = useState('');
  const [shareDateTo, setShareDateTo] = useState('');
  const [shareExpiresAt, setShareExpiresAt] = useState('');
  const [sharePassword, setSharePassword] = useState('');
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [shareRows, setShareRows] = useState<VolumeShareRow[]>([]);
  const [shareUrl, setShareUrl] = useState('');

  const canUpload = !!selectedCustomerId && !!file && !isUploading;
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const latestSummary = useMemo(() => {
    if (!latestRows.length) return null;
    const byDate = new Map<string, number>();
    latestRows.forEach((row) => {
      const key = row.record_date || '날짜없음';
      byDate.set(key, (byDate.get(key) || 0) + 1);
    });
    return Array.from(byDate.entries())
      .sort((a, b) => (a[0] > b[0] ? -1 : 1))
      .slice(0, 5);
  }, [latestRows]);

  const loadLatestRows = async (customerId: string) => {
    if (!customerId) {
      setLatestRows([]);
      return;
    }
    try {
      const res = await fetch(`/api/admin/inventory/volume?customer_id=${encodeURIComponent(customerId)}&limit=100`);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || '물동량 조회 실패');
      setLatestRows((payload?.data || []) as LatestVolumeRow[]);
    } catch (e: unknown) {
      console.error(e);
      setLatestRows([]);
    }
  };

  const loadShareRows = async (customerId: string) => {
    if (!customerId) {
      setShareRows([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/admin/inventory/volume/share?customer_id=${encodeURIComponent(customerId)}`
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || '공유 링크 조회 실패');
      setShareRows((payload?.data || []) as VolumeShareRow[]);
    } catch (e) {
      console.error(e);
      setShareRows([]);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    if (selectedCustomerId) {
      void loadLatestRows(selectedCustomerId);
      void loadShareRows(selectedCustomerId);
    }
  }, [isOpen, selectedCustomerId]);

  const resetState = () => {
    setRecordDate('');
    setFile(null);
    setPreview(null);
    setError('');
    setMessage('');
    setShareUrl('');
    setIsParsing(false);
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const parsePreview = (targetFile: File) => {
    setIsParsing(true);
    setError('');
    setMessage('');
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const array = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(array, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<(string | number | boolean)[]>(firstSheet, {
          header: 1,
          defval: '',
          blankrows: false,
        });
        const headers = ((raw[0] || []) as unknown[]).map((value) => String(value || '').trim());
        const rowCount = Math.max(raw.length - 1, 0);
        setPreview({
          sheetNames: workbook.SheetNames,
          headers,
          rowCount,
        });
      } catch (e) {
        console.error(e);
        setError('엑셀 미리보기 파싱에 실패했습니다.');
        setPreview(null);
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsArrayBuffer(targetFile);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    parsePreview(selected);
  };

  const handleUpload = async () => {
    if (!canUpload || !file) return;
    try {
      setIsUploading(true);
      setError('');
      setMessage('');

      const form = new FormData();
      form.append('customer_id', selectedCustomerId);
      if (recordDate) form.append('record_date', recordDate);
      form.append('file', file);

      const res = await fetch('/api/admin/inventory/volume', {
        method: 'POST',
        body: form,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || '업로드 실패');

      const inserted = payload?.data?.insertedCount || 0;
      const sheets = payload?.data?.sheetCount || 0;
      setMessage(`업로드 완료: ${inserted}행 / ${sheets}개 시트`);
      await loadLatestRows(selectedCustomerId);
      onSuccess?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '업로드 실패';
      setError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateShare = async () => {
    if (!selectedCustomerId) return;
    try {
      setIsCreatingShare(true);
      setError('');
      setMessage('');
      setShareUrl('');

      const body: Record<string, string | null> = {
        customer_id: selectedCustomerId,
        date_from: shareDateFrom || null,
        date_to: shareDateTo || null,
        expires_at: shareExpiresAt || null,
        password: sharePassword || null,
      };

      const res = await fetch('/api/admin/inventory/volume/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || '공유 링크 생성 실패');

      const createdShareUrl = String(payload?.shareUrl || '');
      setShareUrl(createdShareUrl);
      setMessage('공유 링크가 생성되었습니다.');
      setSharePassword('');
      await loadShareRows(selectedCustomerId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '공유 링크 생성 실패';
      setError(msg);
    } finally {
      setIsCreatingShare(false);
    }
  };

  const handleCopyShareUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setMessage('공유 링크가 복사되었습니다.');
    } catch {
      setError('클립보드 복사에 실패했습니다.');
    }
  };

  const handleDeleteShare = async (id: string) => {
    if (!confirm('해당 공유 링크를 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/admin/inventory/volume/share?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || '공유 링크 삭제 실패');
      setMessage('공유 링크가 삭제되었습니다.');
      await loadShareRows(selectedCustomerId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '공유 링크 삭제 실패';
      setError(msg);
    }
  };

  const handleDownload = () => {
    if (!selectedCustomerId) return;
    const params = new URLSearchParams();
    params.set('customer_id', selectedCustomerId);
    if (recordDate) {
      params.set('date_from', recordDate);
      params.set('date_to', recordDate);
    }
    window.open(`/api/admin/inventory/volume/download?${params.toString()}`, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={handleClose} />
        <div className="relative bg-white rounded-2xl shadow-xl max-w-5xl w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900">YBK 물동량 엑셀 업로드</h3>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <select
                  value={selectedCustomerId}
                  onChange={(event) => setSelectedCustomerId(event.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm"
                >
                  <option value="">고객사 선택 (필수)</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>

                <input
                  type="date"
                  value={recordDate}
                  onChange={(event) => setRecordDate(event.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm"
                />

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg border border-purple-300 bg-purple-50 px-4 py-2.5 text-sm font-medium text-purple-700 hover:bg-purple-100"
                >
                  {isParsing ? '파일 분석 중...' : '물동량 엑셀 선택'}
                </button>
              </div>

              {preview && (
                <div className="mb-4 rounded-lg border border-gray-200 p-3 text-sm">
                  <p className="text-gray-700">
                    시트 <span className="font-semibold">{preview.sheetNames.length}</span>개 /
                    데이터행 <span className="font-semibold">{preview.rowCount}</span>개
                  </p>
                  <p className="mt-1 text-xs text-gray-500 break-all">
                    헤더: {preview.headers.filter(Boolean).join(' | ')}
                  </p>
                </div>
              )}

              {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
              {message && <p className="mb-3 text-sm text-green-700">{message}</p>}

              <div className="rounded-lg border border-gray-200">
                <div className="px-3 py-2 text-sm font-semibold border-b bg-gray-50">최근 업로드 행 (최대 100)</div>
                <div className="max-h-64 overflow-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">일자</th>
                        <th className="px-3 py-2 text-left">시트</th>
                        <th className="px-3 py-2 text-left">관리명</th>
                        <th className="px-3 py-2 text-right">전영재고</th>
                        <th className="px-3 py-2 text-right">마감재고</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {latestRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-4 text-center text-gray-400">데이터 없음</td>
                        </tr>
                      ) : (
                        latestRows.map((row) => (
                          <tr key={row.id}>
                            <td className="px-3 py-2">{row.record_date || '-'}</td>
                            <td className="px-3 py-2">{row.sheet_name || '-'}</td>
                            <td className="px-3 py-2">{row.item_name || '-'}</td>
                            <td className="px-3 py-2 text-right">{row.opening_stock_raw || '-'}</td>
                            <td className="px-3 py-2 text-right">{row.closing_stock_raw || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-4 text-sm">
                <h4 className="font-semibold text-purple-900 mb-3">물동량 가이드</h4>
                <div className="space-y-2 text-purple-900/90">
                  <p>1) 고객사를 먼저 선택하세요.</p>
                  <p>2) 원본 물동량 엑셀의 열/행 구조를 그대로 유지하세요.</p>
                  <p>3) `전영재고`, `마감재고`는 문자열(`36/2`) 그대로 저장됩니다.</p>
                  <p>4) 날짜를 지정하지 않으면 시트명에서 날짜를 추정합니다.</p>
                  <p>5) 업로드 후 날짜별 엑셀 다운로드가 가능합니다.</p>
                </div>
                {latestSummary && (
                  <div className="mt-4 rounded-lg bg-white border border-purple-100 p-3">
                    <p className="font-medium text-gray-900 mb-2">최근 일자별 건수</p>
                    <div className="space-y-1 text-xs text-gray-600">
                      {latestSummary.map(([date, count]) => (
                        <p key={date}>{date}: {count}건</p>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-4 rounded-lg bg-white border border-purple-100 p-3">
                  <p className="font-medium text-gray-900 mb-2">외부 공유 링크 생성</p>
                  <div className="grid grid-cols-1 gap-2">
                    <input
                      type="date"
                      value={shareDateFrom}
                      onChange={(e) => setShareDateFrom(e.target.value)}
                      className="rounded border border-gray-300 px-2 py-1 text-xs"
                      placeholder="시작일"
                    />
                    <input
                      type="date"
                      value={shareDateTo}
                      onChange={(e) => setShareDateTo(e.target.value)}
                      className="rounded border border-gray-300 px-2 py-1 text-xs"
                      placeholder="종료일"
                    />
                    <input
                      type="datetime-local"
                      value={shareExpiresAt}
                      onChange={(e) => setShareExpiresAt(e.target.value)}
                      className="rounded border border-gray-300 px-2 py-1 text-xs"
                      placeholder="만료일시"
                    />
                    <input
                      type="text"
                      value={sharePassword}
                      onChange={(e) => setSharePassword(e.target.value)}
                      className="rounded border border-gray-300 px-2 py-1 text-xs"
                      placeholder="공유 비밀번호(선택)"
                    />
                    <button
                      type="button"
                      onClick={handleCreateShare}
                      disabled={!selectedCustomerId || isCreatingShare}
                      className="rounded bg-purple-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                    >
                      {isCreatingShare ? '생성 중...' : '링크 생성'}
                    </button>
                    {shareUrl && (
                      <button
                        type="button"
                        onClick={() => handleCopyShareUrl(shareUrl)}
                        className="rounded border border-purple-300 bg-purple-50 px-2 py-1 text-xs text-purple-700"
                      >
                        링크 복사
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {shareRows.length > 0 && (
            <div className="mt-4 rounded-lg border border-gray-200">
              <div className="px-3 py-2 text-sm font-semibold border-b bg-gray-50">최근 공유 링크</div>
              <div className="max-h-40 overflow-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">기간</th>
                      <th className="px-3 py-2 text-left">만료</th>
                      <th className="px-3 py-2 text-left">보호</th>
                      <th className="px-3 py-2 text-left">작업</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {shareRows.map((row) => {
                      const url = `${baseUrl}/share/inventory/${row.slug}`;
                      return (
                        <tr key={row.id}>
                          <td className="px-3 py-2">{row.date_from || '전체'} ~ {row.date_to || '전체'}</td>
                          <td className="px-3 py-2">{row.expires_at ? new Date(row.expires_at).toLocaleString() : '-'}</td>
                          <td className="px-3 py-2">{row.has_password ? '비밀번호' : '공개'}</td>
                          <td className="px-3 py-2">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleCopyShareUrl(url)}
                                className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 text-[11px] text-indigo-700"
                              >
                                복사
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteShare(row.id)}
                                className="rounded border border-red-300 bg-red-50 px-2 py-1 text-[11px] text-red-700"
                              >
                                삭제
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t mt-4">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!selectedCustomerId}
              className="rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
            >
              날짜 기준 다운로드
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={!canUpload}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? '업로드 중...' : '물동량 업로드'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
