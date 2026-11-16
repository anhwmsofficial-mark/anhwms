'use client';

import { useEffect, useMemo, useState } from 'react';
import Header from '@/components/Header';
import { useLayout } from '@/components/LayoutWrapper';

type JobItem = {
  id: string;
  channelProductNo: string;
  productName: string | null;
  deployedImageUrls: string[];
  afterHtml: string;
  beforeHtml: string | null;
  contentHash: string;
  status: string;
  attemptCount: number;
  errorMessage: string | null;
};

type Job = {
  id: string;
  status: string;
  requestedCount: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  createdAt: string;
  items: JobItem[];
};

type Overview = {
  schemaReady: boolean;
  storeName: string;
  configured: boolean;
  status: string;
  publishLimit: number | null;
  publishedProductCount: number;
  lastError: string | null;
  guide: string[];
  notice: string;
  jobs: Job[];
};

type Draft = {
  key: string;
  channelProductNo: string;
  productName: string;
  imageUrls: string;
  files: File[];
};

const STATUS_LABEL: Record<string, string> = {
  unconfigured: '자격증명 없음',
  ready: '연결됨',
  error: '연결 오류',
  preview_ready: '미리보기',
  publishing: '반영 중',
  completed: '완료',
  partial_failed: '일부 실패',
  failed: '실패',
  published: '반영됨',
  skipped: '중복 생략',
};

async function readApi<T>(response: Response): Promise<T> {
  const body = await response.json() as { ok?: boolean; data?: T; message?: string; error?: string };
  if (!response.ok || body.ok === false) {
    throw new Error(body.message || body.error || '요청에 실패했습니다.');
  }
  return body.data as T;
}

export default function SmartstoreDetailPage() {
  const { toggleSidebar } = useLayout();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [channelProductNo, setChannelProductNo] = useState('');
  const [productName, setProductName] = useState('');
  const [imageUrls, setImageUrls] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadOverview() {
    const overview = await readApi<Overview>(await fetch('/api/operations/smartstore-detail'));
    setOverview(overview);
    return overview;
  }

  useEffect(() => {
    loadOverview().catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : '연결 상태를 불러오지 못했습니다.');
    });
  }, []);

  const activeItem = useMemo(
    () => activeJob?.items.find((item) => item.id === activeItemId) || activeJob?.items[0] || null,
    [activeItemId, activeJob],
  );
  const actionableCount = activeJob?.items.filter((item) => item.status === 'preview_ready' || item.status === 'failed').length || 0;
  const publishLimit = overview?.publishLimit ?? 1;
  const overLimit = publishLimit != null && actionableCount > publishLimit;

  function addDraft() {
    const channel = channelProductNo.trim();
    const urls = imageUrls.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!/^\d{5,20}$/.test(channel)) {
      setError('채널 상품번호는 5~20자리 숫자여야 합니다.');
      return;
    }
    if (urls.length === 0 && files.length === 0) {
      setError('이미지 주소 또는 파일을 추가해 주세요.');
      return;
    }
    setDrafts((current) => [
      ...current.filter((draft) => draft.channelProductNo !== channel),
      { key: channel, channelProductNo: channel, productName, imageUrls: urls.join('\n'), files },
    ]);
    setChannelProductNo('');
    setProductName('');
    setImageUrls('');
    setFiles([]);
    setError(null);
  }

  async function createPreview() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const form = new FormData();
      form.set('payload', JSON.stringify(drafts.map((draft) => ({
        channelProductNo: draft.channelProductNo,
        productName: draft.productName,
        imageUrls: draft.imageUrls.split(/\r?\n/).filter(Boolean),
      }))));
      for (const draft of drafts) {
        draft.files.forEach((file) => form.append(`images:${draft.channelProductNo}`, file));
      }
      const job = await readApi<Job>(await fetch('/api/operations/smartstore-detail/preview', { method: 'POST', body: form }));
      setActiveJob(job);
      setActiveItemId(job.items[0]?.id || null);
      setMessage('모바일용 JPG HTML 미리보기를 만들었습니다. 확인 후 승인 반영해 주세요.');
      await loadOverview();
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : '미리보기에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!activeJob) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const job = await readApi<Job>(await fetch('/api/operations/smartstore-detail/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: activeJob.id }),
      }));
      setActiveJob(job);
      setMessage('승인 반영을 처리했습니다. 스마트스토어 모바일 화면에서 테스트 상품을 확인해 주세요.');
      await loadOverview();
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : '반영에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function retry(target = activeJob) {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      const job = await readApi<Job>(await fetch('/api/operations/smartstore-detail/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: target.id }),
      }));
      setActiveJob(job);
      setMessage('실패한 항목을 다시 반영했습니다.');
      await loadOverview();
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : '재시도에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function changeLimit(next: 1 | 5 | null) {
    setBusy(true);
    setError(null);
    try {
      await readApi(await fetch('/api/operations/smartstore-detail/limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publishLimit: next }),
      }));
      setMessage(next == null ? '전체 반영을 허용했습니다.' : `한 번에 ${next}개까지 반영할 수 있습니다.`);
      await loadOverview();
    } catch (limitError) {
      setError(limitError instanceof Error ? limitError.message : '반영 범위를 바꾸지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header title="스마트스토어 상세" onMenuClick={toggleSidebar} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 lg:px-8">
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          {overview?.notice || '승인 반영한 상품은 HTML 상세로 전환되며, API만으로 SmartEditor ONE을 되돌릴 수 없습니다.'}
        </section>

        <section className="grid gap-4 rounded-lg border border-gray-200 bg-white p-4 md:grid-cols-4">
          <Status label="스토어" value={overview?.storeName || '아하득템'} />
          <Status label="연결" value={STATUS_LABEL[overview?.status || 'unconfigured'] || overview?.status || '-'} />
          <Status label="반영 범위" value={publishLimit == null ? '전체' : `${publishLimit}개`} />
          <Status label="반영한 상품" value={String(overview?.publishedProductCount ?? 0)} />
          {overview?.lastError && <p className="md:col-span-4 text-sm text-red-700">{overview.lastError}</p>}
          {overview && !overview.schemaReady && (
            <p className="md:col-span-4 text-sm text-red-700">작업 테이블이 없습니다. 스마트스토어 상세 마이그레이션을 적용해 주세요.</p>
          )}
          {overview && !overview.configured && (
            <ol className="md:col-span-4 list-decimal space-y-1 pl-5 text-sm text-gray-700">
              {overview.guide.map((step) => <li key={step}>{step}</li>)}
            </ol>
          )}
          <div className="md:col-span-4 flex flex-wrap gap-2">
            <button className="rounded border px-3 py-2 text-sm" disabled={busy} onClick={() => changeLimit(1)} type="button">1개로 제한</button>
            <button className="rounded border px-3 py-2 text-sm" disabled={busy || (overview?.publishedProductCount || 0) < 1} onClick={() => changeLimit(5)} type="button">5개까지 확대</button>
            <button className="rounded border px-3 py-2 text-sm" disabled={busy || (overview?.publishedProductCount || 0) < 5} onClick={() => changeLimit(null)} type="button">전체 허용</button>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-base font-bold">상품 선택</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-sm">채널 상품번호
              <input className="mt-1 w-full rounded border px-3 py-2" value={channelProductNo} onChange={(event) => setChannelProductNo(event.target.value)} placeholder="13868826874" />
            </label>
            <label className="text-sm">상품명
              <input className="mt-1 w-full rounded border px-3 py-2" value={productName} onChange={(event) => setProductName(event.target.value)} />
            </label>
            <label className="text-sm md:col-span-2">이미지 주소 (한 줄에 하나)
              <textarea className="mt-1 h-28 w-full rounded border px-3 py-2" value={imageUrls} onChange={(event) => setImageUrls(event.target.value)} />
            </label>
            <label className="text-sm md:col-span-2">이미지 파일
              <input className="mt-1 block w-full text-sm" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setFiles(Array.from(event.target.files || []))} />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="rounded bg-gray-900 px-3 py-2 text-sm text-white" type="button" onClick={addDraft}>목록에 추가</button>
            <button className="rounded bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-50" type="button" disabled={busy || drafts.length === 0} onClick={createPreview}>미리보기 생성</button>
          </div>
          <ul className="mt-3 space-y-1 text-sm text-gray-700">
            {drafts.map((draft) => (
              <li key={draft.key}>{draft.channelProductNo} {draft.productName} · URL {draft.imageUrls ? draft.imageUrls.split('\n').length : 0} · 파일 {draft.files.length}</li>
            ))}
          </ul>
        </section>

        {error && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {message && <p className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">{message}</p>}

        {activeItem && (
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-bold">{activeItem.channelProductNo} 미리보기</h2>
              <div className="flex flex-wrap gap-2">
                <button className="rounded bg-orange-600 px-3 py-2 text-sm text-white disabled:opacity-50" type="button" disabled={busy || !overview?.configured || overLimit || actionableCount === 0} onClick={publish}>승인 후 반영</button>
                <button className="rounded border px-3 py-2 text-sm disabled:opacity-50" type="button" disabled={busy || !activeJob?.items.some((item) => item.status === 'failed')} onClick={() => void retry()}>실패 항목 재시도</button>
              </div>
            </div>
            {overLimit && <p className="mt-2 text-sm text-red-700">현재 범위는 {publishLimit}개입니다. 테스트 반영 후 범위를 확대해 주세요.</p>}
            {!overview?.configured && <p className="mt-2 text-sm text-gray-600">자격증명이 없어 실제 스마트스토어 반영은 실행되지 않습니다.</p>}
            <div className="mt-4 flex gap-4 overflow-x-auto">
              <PreviewFrame title="PC" html={activeItem.afterHtml} width={860} />
              <PreviewFrame title="모바일" html={activeItem.afterHtml} width={390} />
            </div>
            {activeItem.beforeHtml && (
              <label className="mt-4 block text-sm">적용 전 HTML (수동 롤백용)
                <textarea className="mt-1 h-28 w-full rounded border px-3 py-2 font-mono text-xs" readOnly value={activeItem.beforeHtml} />
              </label>
            )}
          </section>
        )}

        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-base font-bold">작업 이력</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-gray-500">
                <tr>
                  <th className="py-2 pr-3">생성</th>
                  <th className="py-2 pr-3">상태</th>
                  <th className="py-2 pr-3">성공</th>
                  <th className="py-2 pr-3">실패</th>
                  <th className="py-2">상품</th>
                </tr>
              </thead>
              <tbody>
                {(overview?.jobs || []).map((job) => (
                  <tr key={job.id} className="border-t">
                    <td className="py-2 pr-3 whitespace-nowrap">{new Date(job.createdAt).toLocaleString('ko-KR')}</td>
                    <td className="py-2 pr-3">{STATUS_LABEL[job.status] || job.status}</td>
                    <td className="py-2 pr-3">{job.successCount}/{job.requestedCount}</td>
                    <td className="py-2 pr-3">{job.failedCount}</td>
                    <td className="py-2">
                      {job.items.map((item) => (
                        <button key={item.id} className="mr-2 underline" type="button" onClick={() => { setActiveJob(job); setActiveItemId(item.id); }}>
                          {item.channelProductNo} ({STATUS_LABEL[item.status] || item.status}{item.attemptCount ? ` · ${item.attemptCount}회` : ''})
                        </button>
                      ))}
                      {job.failedCount > 0 && (
                        <button className="ml-2 rounded border px-2 py-1" type="button" onClick={() => { setActiveJob(job); void retry(job); }}>재시도</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function PreviewFrame({ title, html, width }: { title: string; html: string; width: number }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{title} {width}px</p>
      <iframe
        title={`${title} 상세 미리보기`}
        sandbox=""
        className="h-[640px] rounded border bg-white"
        style={{ width }}
        srcDoc={html}
      />
    </div>
  );
}
