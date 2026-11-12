'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ImagePlus, Images, Loader2, RefreshCw, Trash2, UploadCloud } from 'lucide-react';
import { isLooseDetailBatch, parseBulkFiles, SHOWCASE_ID_PATTERN, sortDetailFiles } from '@/lib/product-showcase/file-groups';

type ShowcaseItem = {
  id: string;
  excel_name: string;
  excel_mgmt?: string | null;
  cat?: string | null;
  images: string[];
  thumb: string;
};

const UPLOAD_BATCH_SIZE = 6;

async function readError(response: Response) {
  const body = await response.json().catch(() => null);
  return body?.message || body?.error || '요청 처리에 실패했습니다.';
}

async function uploadProduct(input: {
  id: string;
  name: string;
  managementName?: string;
  category?: string;
  files: File[];
}) {
  for (let start = 0; start < input.files.length; start += UPLOAD_BATCH_SIZE) {
    const batch = input.files.slice(start, start + UPLOAD_BATCH_SIZE);
    const formData = new FormData();
    formData.set('id', input.id);
    formData.set('display_name', input.name);
    formData.set('product_key', input.name.replace(/\s+/g, ''));
    formData.set('management_name', input.managementName || '');
    formData.set('category', input.category || '');
    if (start > 0) formData.set('append', '1');
    batch.forEach((file) => formData.append('images', file));

    const response = await fetch('/api/product-showcase', { method: 'POST', body: formData });
    if (!response.ok) throw new Error(await readError(response));
  }
}

export default function ProductShowcaseAdminPage() {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [managementName, setManagementName] = useState('');
  const [category, setCategory] = useState('');
  const [singleFiles, setSingleFiles] = useState<File[]>([]);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkCategory, setBulkCategory] = useState('');
  const [looseId, setLooseId] = useState('');
  const [looseName, setLooseName] = useState('');
  const [filePickKey, setFilePickKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [progress, setProgress] = useState('');

  const loadItems = useCallback(async () => {
    setLoadingList(true);
    try {
      const response = await fetch('/api/product-showcase?admin=1', { cache: 'no-store' });
      if (!response.ok) throw new Error(await readError(response));
      const body = await response.json();
      setItems(Array.isArray(body.data) ? body.data : []);
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : '목록 조회 실패' });
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const bulkParsed = useMemo(() => parseBulkFiles(bulkFiles), [bulkFiles]);
  const looseMode = isLooseDetailBatch(bulkFiles.length, bulkParsed.groups.length, bulkParsed.errors.length);
  const looseFiles = useMemo(() => (looseMode ? sortDetailFiles(bulkFiles) : []), [looseMode, bulkFiles]);
  const looseReady = SHOWCASE_ID_PATTERN.test(looseId.trim()) && looseName.trim().length > 0 && looseName.trim().length <= 200;

  const submitSingle = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setSubmitting(true);
    try {
      await uploadProduct({ id, name, managementName, category, files: singleFiles });
      setMessage({ kind: 'success', text: `${name} 이미지 ${singleFiles.length}개를 등록했습니다.` });
      setId('');
      setName('');
      setManagementName('');
      setCategory('');
      setSingleFiles([]);
      setFilePickKey((current) => current + 1);
      await loadItems();
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : '등록에 실패했습니다.' });
    } finally {
      setSubmitting(false);
    }
  };

  const submitBulk = async (event: React.FormEvent) => {
    event.preventDefault();
    if (looseMode) {
      if (!looseReady) return;
    } else if (bulkParsed.errors.length || !bulkParsed.groups.length) {
      return;
    }
    setMessage(null);
    setSubmitting(true);
    if (looseMode) {
      const files = sortDetailFiles(bulkFiles);
      setProgress(`1/1 · ${looseId.trim()} 등록 중`);
      try {
        await uploadProduct({
          id: looseId.trim(),
          name: looseName.trim(),
          category: bulkCategory,
          files,
        });
        setMessage({ kind: 'success', text: `${looseName.trim()} 이미지 ${files.length}개를 등록했습니다.` });
        setBulkFiles([]);
        setBulkCategory('');
        setLooseId('');
        setLooseName('');
        setFilePickKey((current) => current + 1);
      } catch (error) {
        setMessage({ kind: 'error', text: error instanceof Error ? error.message : '등록에 실패했습니다.' });
      } finally {
        setProgress('');
        setSubmitting(false);
      }
      await loadItems();
      return;
    }
    let success = 0;
    const failures: string[] = [];
    for (let index = 0; index < bulkParsed.groups.length; index += 1) {
      const group = bulkParsed.groups[index];
      setProgress(`${index + 1}/${bulkParsed.groups.length} · ${group.id} 등록 중`);
      try {
        await uploadProduct({
          id: group.id,
          name: group.name,
          category: bulkCategory,
          files: group.files.map(({ file }) => file),
        });
        success += 1;
      } catch (error) {
        failures.push(`${group.id}: ${error instanceof Error ? error.message : '등록 실패'}`);
      }
    }
    setProgress('');
    setSubmitting(false);
    if (failures.length) {
      setMessage({
        kind: 'error',
        text: `${success}개 성공, ${failures.length}개 실패 · ${failures.slice(0, 3).join(' / ')}`,
      });
    } else {
      setMessage({ kind: 'success', text: `${success}개 상품을 대량 등록했습니다.` });
      setBulkFiles([]);
      setBulkCategory('');
      setFilePickKey((current) => current + 1);
    }
    await loadItems();
  };

  const deleteItem = async (item: ShowcaseItem) => {
    if (!window.confirm(`${item.excel_name}(${item.id})을 삭제할까요?`)) return;
    setMessage(null);
    const response = await fetch(`/api/product-showcase?id=${encodeURIComponent(item.id)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      setMessage({ kind: 'error', text: await readError(response) });
      return;
    }
    setMessage({ kind: 'success', text: `${item.excel_name}을 삭제했습니다.` });
    await loadItems();
  };

  const fieldClass =
    'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900">상품 상세 이미지 관리</h1>
          <p className="mt-1 text-sm text-gray-600">
            등록한 이미지는 <a className="font-medium text-blue-600 hover:underline" href="/product" target="_blank">/product</a>에 즉시 반영됩니다.
          </p>
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-gray-900">등록 가이드</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-gray-700">
            <li>상품 엑셀 일괄등록과 이 화면은 별도입니다. 상품을 먼저 만든 뒤, 여기서는 상세 이미지만 올립니다. 상품 ID는 상품 마스터 ID와 같게 적습니다. 예: p292</li>
            <li>개별 등록은 상품 ID와 상품명을 입력하고 이미지를 고릅니다. 고른 순서대로 /product 상세의 위쪽부터 표시됩니다.</li>
            <li>
              여러 상품을 한 번에 올릴 때는 파일명을 <span className="font-mono text-xs">상품ID__순번__상품명.확장자</span>로 맞춥니다.
              예: <span className="font-mono text-xs">p292__01__반려동물칫솔.webp</span>, <span className="font-mono text-xs">p292__02__반려동물칫솔.webp</span>.
              같은 상품 ID는 상품명이 같아야 하고, 순번은 1 이상입니다.
            </li>
            <li>카카오톡 파일(KakaoTalk_날짜_번호.webp, _01, _02)은 위 형식이 아니라서 여러 상품으로 나뉘지 않습니다. 대량 등록에서 그 파일만 고르면 상품 ID와 상품명을 입력할 수 있습니다. 번호가 없는 원본이 첫 컷이고, 이어서 _01부터 파일명 순서입니다.</li>
            <li>JPG, PNG, WEBP만 등록됩니다. 파일당 10MB, 상품당 30장까지입니다. 이미지는 6장씩 나눠 저장하므로, 장수가 많아도 한 요청에 모두 넣지 않습니다.</li>
            <li>같은 상품 ID로 다시 등록하면 기존 상세 이미지를 새 파일로 바꿉니다.</li>
          </ol>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:px-8">
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex border-b border-gray-200 p-2">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold ${mode === 'single' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <ImagePlus className="h-4 w-4" /> 개별 등록
            </button>
            <button
              type="button"
              onClick={() => setMode('bulk')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold ${mode === 'bulk' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <Images className="h-4 w-4" /> 대량 등록
            </button>
          </div>

          {message && (
            <div className={`mx-6 mt-6 rounded-lg px-4 py-3 text-sm ${message.kind === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              {message.text}
            </div>
          )}

          {mode === 'single' ? (
            <form className="space-y-5 p-6" onSubmit={submitSingle}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-gray-700">
                  상품 ID <span className="text-red-500">*</span>
                  <input className={fieldClass} value={id} onChange={(e) => setId(e.target.value)} placeholder="예: p164" required pattern="[A-Za-z0-9_-]{1,64}" />
                </label>
                <label className="text-sm font-medium text-gray-700">
                  카테고리
                  <input className={fieldClass} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="예: 생활잡화/기타" />
                </label>
              </div>
              <label className="block text-sm font-medium text-gray-700">
                상품명 <span className="text-red-500">*</span>
                <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={200} required />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                관리명
                <input className={fieldClass} value={managementName} onChange={(e) => setManagementName(e.target.value)} maxLength={200} />
              </label>
              <label className="block rounded-xl border-2 border-dashed border-gray-300 p-8 text-center hover:border-blue-400">
                <UploadCloud className="mx-auto h-9 w-9 text-gray-400" />
                <span className="mt-2 block text-sm font-semibold text-gray-700">상세 이미지 선택</span>
                <span className="mt-1 block text-xs text-gray-500">JPG, PNG, WEBP · 파일당 10MB · 최대 30개</span>
                <input
                  key={`single-${filePickKey}`}
                  className="sr-only"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  multiple
                  required
                  onChange={(e) => setSingleFiles(Array.from(e.target.files || []))}
                />
              </label>
              {singleFiles.length > 0 && (
                <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
                  {singleFiles.length}개 선택 · 선택 순서대로 상세 페이지에 표시됩니다.
                </div>
              )}
              <button disabled={submitting || !singleFiles.length} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                등록하기
              </button>
            </form>
          ) : (
            <form className="space-y-5 p-6" onSubmit={submitBulk}>
              <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900">
                <p className="font-bold">파일명 규칙</p>
                <p className="mt-1 font-mono text-xs">상품ID__순번__상품명.확장자</p>
                <p className="mt-2 text-xs">예: p164__01__신상품.webp, p164__02__신상품.webp</p>
              </div>
              <label className="block text-sm font-medium text-gray-700">
                공통 카테고리
                <input className={fieldClass} value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)} placeholder="비워 두면 미분류" />
              </label>
              <label className="block rounded-xl border-2 border-dashed border-gray-300 p-8 text-center hover:border-blue-400">
                <UploadCloud className="mx-auto h-9 w-9 text-gray-400" />
                <span className="mt-2 block text-sm font-semibold text-gray-700">이미지 여러 개 선택</span>
                <span className="mt-1 block text-xs text-gray-500">파일명에서 상품을 자동으로 구분합니다.</span>
                <input
                  key={`bulk-${filePickKey}`}
                  className="sr-only"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  multiple
                  onChange={(e) => setBulkFiles(Array.from(e.target.files || []))}
                />
              </label>
              {bulkFiles.length > 0 && !looseMode && (
                <div className="space-y-2 rounded-lg border border-gray-200 p-4 text-sm">
                  <p className="font-semibold text-gray-900">이미지 {bulkFiles.length}개 · 상품 {bulkParsed.groups.length}개</p>
                  {bulkParsed.groups.slice(0, 8).map((group) => (
                    <div key={group.id} className="flex justify-between text-gray-600">
                      <span>{group.id} · {group.name}</span><span>{group.files.length}컷</span>
                    </div>
                  ))}
                  {bulkParsed.groups.length > 8 && <p className="text-xs text-gray-500">외 {bulkParsed.groups.length - 8}개 상품</p>}
                  {bulkParsed.errors.map((error, index) => <p key={`${error}-${index}`} className="text-xs text-red-600">{error}</p>)}
                </div>
              )}
              {looseMode && (
                <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                  <p>선택한 파일은 <span className="font-mono text-xs">상품ID__순번__상품명</span> 형식이 아닙니다. 카카오톡으로 받은 이미지처럼 한 상품의 컷이면 상품 ID와 상품명을 입력하세요. 번호가 없는 원본이 1번이고, 이어서 _01, _02 순서입니다.</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-medium">
                      상품 ID <span className="text-red-500">*</span>
                      <input className={fieldClass} value={looseId} onChange={(e) => setLooseId(e.target.value)} placeholder="예: p292" required pattern="[A-Za-z0-9_-]{1,64}" />
                    </label>
                    <label className="text-sm font-medium">
                      상품명 <span className="text-red-500">*</span>
                      <input className={fieldClass} value={looseName} onChange={(e) => setLooseName(e.target.value)} maxLength={200} required />
                    </label>
                  </div>
                  <ol className="space-y-1 text-xs text-amber-900">
                    {looseFiles.slice(0, 8).map((file, index) => (
                      <li key={`${file.name}-${index}`}>{index + 1}. {file.name}</li>
                    ))}
                    {looseFiles.length > 8 && <li>외 {looseFiles.length - 8}개</li>}
                  </ol>
                </div>
              )}
              <button disabled={submitting || (looseMode ? !looseReady : !bulkParsed.groups.length || bulkParsed.errors.length > 0)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Images className="h-4 w-4" />}
                {progress || (looseMode ? `${looseFiles.length}개 이미지를 한 상품으로 등록` : `${bulkParsed.groups.length}개 상품 등록하기`)}
              </button>
            </form>
          )}
        </section>

        <aside className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <div>
              <h2 className="font-bold text-gray-900">등록 상품</h2>
              <p className="text-xs text-gray-500">기존 정적 상품 외 {items.length}개</p>
            </div>
            <button type="button" onClick={() => void loadItems()} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="새로고침">
              <RefreshCw className={`h-4 w-4 ${loadingList ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="max-h-[720px] divide-y divide-gray-100 overflow-y-auto">
            {!loadingList && items.length === 0 && <p className="p-8 text-center text-sm text-gray-500">등록된 상품이 없습니다.</p>}
            {items.map((item) => (
              <div key={item.id} className="flex gap-3 p-4">
                {/* Storage URL domains are runtime-configured, so this preview intentionally uses a native image. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.thumb} alt="" className="h-16 w-16 rounded-lg border border-gray-200 object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{item.excel_name}</p>
                  <p className="mt-1 text-xs text-gray-500">{item.id} · {item.images.length}컷</p>
                  <p className="truncate text-xs text-gray-500">{item.cat || '미분류'}</p>
                </div>
                <button type="button" onClick={() => void deleteItem(item)} className="self-center rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label={`${item.excel_name} 삭제`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          {items.length > 0 && (
            <div className="flex items-center gap-2 border-t border-gray-200 px-5 py-3 text-xs text-green-700">
              <CheckCircle2 className="h-4 w-4" /> 공개 페이지와 동기화됨
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
