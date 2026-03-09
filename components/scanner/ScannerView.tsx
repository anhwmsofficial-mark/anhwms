'use client';

import { useState, useCallback } from 'react';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { ScanMode, ScanResult } from '@/types/scanner';
import { handleScanWorkflow } from '@/lib/workflows/scanWorkflow';
import ScannerOverlay from '@/components/scanner/ScannerOverlay';
import RecentScanList from '@/components/scanner/RecentScanList';
import ScanQueueList from '@/components/scanner/ScanQueueList';

const MODE_ORDER: ScanMode[] = ['lookup', 'inbound', 'outbound', 'relocation', 'count'];

const MODE_META: Record<
  ScanMode,
  {
    label: string;
    subtitle: string;
    description: string;
    primaryHint: string;
    secondaryHint: string;
    accentClass: string;
    badgeClass: string;
  }
> = {
  lookup: {
    label: 'Lookup',
    subtitle: '상품 조회',
    description: '바코드나 SKU를 스캔해 상품명, 위치, 현재고를 바로 확인합니다.',
    primaryHint: '조회 중심 작업: 상품 정보, 위치, 재고 빠른 확인',
    secondaryHint: 'CS 응대, 현장 확인, 입출고 전 사전 체크에 적합합니다.',
    accentClass: 'border-sky-200 bg-sky-50',
    badgeClass: 'bg-sky-100 text-sky-700',
  },
  inbound: {
    label: 'Inbound',
    subtitle: '입고 확인',
    description: '입고 예정 상품을 스캔해 예상 수량과 현재 수량을 비교하며 검수합니다.',
    primaryHint: '입고 검수: 예정 입고 수량과 현재고 비교',
    secondaryHint: '도착 상품 확인이나 입고 누락 체크 단계에서 사용하세요.',
    accentClass: 'border-emerald-200 bg-emerald-50',
    badgeClass: 'bg-emerald-100 text-emerald-700',
  },
  outbound: {
    label: 'Outbound',
    subtitle: '출고 확인',
    description: '출고 대상 상품을 스캔해 출고 가능 여부와 위치를 확인합니다.',
    primaryHint: '출고 작업: 재고 부족 여부와 피킹 위치 확인',
    secondaryHint: '피킹 전 검증이나 출고 오류 방지용으로 유용합니다.',
    accentClass: 'border-amber-200 bg-amber-50',
    badgeClass: 'bg-amber-100 text-amber-700',
  },
  relocation: {
    label: 'Relocation',
    subtitle: '재고 이동',
    description: '상품의 현재 위치를 확인하고 재배치 작업 전 기준 위치를 파악합니다.',
    primaryHint: '이동 작업: 현재 위치 기준으로 재배치 진행',
    secondaryHint: '상품 스캔 후 실제 이동 위치 라벨과 함께 현장 작업을 진행하세요.',
    accentClass: 'border-violet-200 bg-violet-50',
    badgeClass: 'bg-violet-100 text-violet-700',
  },
  count: {
    label: 'Count',
    subtitle: '재고 실사',
    description: '같은 상품을 반복 스캔해 수량을 누적 집계합니다.',
    primaryHint: '실사 작업: 동일 상품 반복 스캔 시 수량 자동 증가',
    secondaryHint: '진열 구역별 실사나 재고조사 때 가장 빠르게 사용할 수 있습니다.',
    accentClass: 'border-blue-200 bg-blue-50',
    badgeClass: 'bg-blue-100 text-blue-700',
  },
};

const QUICK_START_STEPS = [
  {
    title: '1. 모드 선택',
    description: '상단에서 현재 작업에 맞는 모드를 선택합니다.',
  },
  {
    title: '2. 입력 방식 선택',
    description: 'USB 스캐너는 바로 스캔하고, 카메라가 필요하면 우측 버튼을 눌러 켭니다.',
  },
  {
    title: '3. 코드 스캔',
    description: '상품 바코드 또는 SKU를 스캔하면 결과 카드와 이력이 즉시 갱신됩니다.',
  },
  {
    title: '4. 작업 확인',
    description: '에러, 누락, 재고 부족은 빨간 상태로 표시되며 Count 모드는 누적 수량이 보입니다.',
  },
];

export default function ScannerView() {
  const [mode, setMode] = useState<ScanMode>('lookup');
  const [scannedItem, setScannedItem] = useState<ScanResult | null>(null);
  const [countMap, setCountMap] = useState<Record<string, number>>({});

  const processScan = useCallback(async (barcode: string, currentMode: ScanMode) => {
    // This function is the bridge between the scanner hook and your business logic
    // It should return the data you want to store in the scan result
    try {
      const data = await handleScanWorkflow(barcode, currentMode);
      
      if (currentMode === 'count') {
        const nextQty = (countMap[barcode] || 0) + 1;
        setCountMap(prev => ({
          ...prev,
          [barcode]: nextQty
        }));
        return { ...data, qty: nextQty };
      }
      
      return data;
    } catch (error) {
      throw error;
    }
  }, [countMap]);

  const {
    queue,
    history,
    isCameraActive,
    toggleCamera,
    clearHistory
  } = useBarcodeScanner({
    mode,
    processScan,
    onScanSuccess: (result) => {
      setScannedItem(result);
    },
    onScanError: (result) => {
      setScannedItem(result);
    }
  });

  const clearCounts = () => setCountMap({});
  const activeMode = MODE_META[mode];


  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-4 p-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-900">Scanner Console</h2>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                    {isCameraActive ? '카메라 스캔 활성화' : 'USB 스캐너 대기 중'}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${activeMode.badgeClass}`}>
                    {activeMode.label}
                  </span>
                </div>
                <p className="text-sm leading-6 text-gray-600">
                  USB 스캐너는 즉시 입력되며, 모바일이나 노트북에서는 카메라 스캔을 함께 사용할 수 있습니다.
                </p>
              </div>

              <button
                onClick={() => toggleCamera('scanner-reader')}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                  isCameraActive
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <span className="text-base">📷</span>
                {isCameraActive ? '카메라 닫기' : '카메라 열기'}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
              {MODE_ORDER.map((m) => {
                const meta = MODE_META[m];

                return (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`rounded-2xl border px-3 py-3 text-left transition-all ${
                      mode === m
                        ? `border-transparent shadow-sm ring-2 ring-offset-1 ${meta.accentClass}`
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    <span className="block text-sm font-semibold text-gray-900">{meta.label}</span>
                    <span className="mt-1 block text-xs text-gray-500">{meta.subtitle}</span>
                  </button>
                );
              })}
            </div>

            <div className={`mt-4 rounded-2xl border p-4 ${activeMode.accentClass}`}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">현재 작업 모드</p>
                  <h3 className="mt-1 text-lg font-bold text-gray-900">
                    {activeMode.label} · {activeMode.subtitle}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-gray-700">{activeMode.description}</p>
                </div>
                <span className={`self-start rounded-full px-3 py-1 text-xs font-semibold ${activeMode.badgeClass}`}>
                  {activeMode.subtitle}
                </span>
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-2">
                <div className="rounded-xl bg-white/80 p-3 text-sm text-gray-700 shadow-sm">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500">핵심 포인트</span>
                  <span className="mt-1 block">{activeMode.primaryHint}</span>
                </div>
                <div className="rounded-xl bg-white/80 p-3 text-sm text-gray-700 shadow-sm">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500">사용 팁</span>
                  <span className="mt-1 block">{activeMode.secondaryHint}</span>
                </div>
              </div>
            </div>
          </div>

          <div
            className={`rounded-2xl border-2 p-6 shadow-md transition-all ${
              scannedItem?.status === 'success'
                ? 'border-green-500 bg-green-50'
                : scannedItem?.status === 'error'
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200 bg-white'
            }`}
          >
            {scannedItem ? (
              <div className="text-center">
                <div
                  className={`mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full ${
                    scannedItem.status === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                  }`}
                >
                  <span className="text-3xl">{scannedItem.status === 'success' ? '✓' : '!'}</span>
                </div>
                <h3 className="mb-1 break-all text-2xl font-bold">{scannedItem.barcode}</h3>
                <p
                  className={`mb-4 font-medium ${
                    scannedItem.status === 'success' ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  {scannedItem.message}
                </p>

                {scannedItem.data && (
                  <div className="space-y-2 rounded-2xl border border-gray-100 bg-white/70 p-4 text-left">
                    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <span className="block text-xs text-gray-500">상품명</span>
                        <span className="text-base font-bold text-gray-800">{scannedItem.data.name || '-'}</span>
                      </div>
                      <div>
                        <span className="block text-xs text-gray-500">SKU</span>
                        <span className="font-mono text-gray-800">{scannedItem.data.sku || '-'}</span>
                      </div>
                      <div>
                        <span className="block text-xs text-gray-500">카테고리</span>
                        <span className="text-gray-800">{scannedItem.data.category || '-'}</span>
                      </div>
                      <div>
                        <span className="block text-xs text-gray-500">위치</span>
                        <span className="font-bold text-blue-600">
                          {scannedItem.data.location || scannedItem.data.current_location || '-'}
                        </span>
                      </div>
                      <div>
                        <span className="block text-xs text-gray-500">현재고</span>
                        <span className="font-bold text-gray-800">
                          {scannedItem.data.qty ?? scannedItem.data.current_qty ?? scannedItem.data.qty_available ?? '-'}{' '}
                          {scannedItem.data.unit || ''}
                        </span>
                      </div>

                      {scannedItem.data.expected_qty !== undefined && (
                        <div className="rounded-xl bg-green-50 p-3 sm:col-span-2">
                          <span className="block text-xs font-bold text-green-700">예정 입고 수량</span>
                          <span className="text-xl font-bold text-green-800">
                            {scannedItem.data.expected_qty} {scannedItem.data.unit || ''}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-gray-400">
                <p className="mb-2 text-4xl">📦</p>
                <p className="text-lg font-semibold text-gray-600">스캔 대기 중</p>
                <p className="mt-2 text-sm text-gray-500">USB 스캐너 또는 카메라로 상품 코드를 읽어 주세요.</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <ScanQueueList queue={queue} />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-bold text-gray-800">스캔 이력</h3>
              <div className="flex gap-2">
                {mode === 'count' && (
                  <button
                    onClick={clearCounts}
                    className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
                  >
                    실사 수량 초기화
                  </button>
                )}
                <button
                  onClick={clearHistory}
                  className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
                >
                  이력 지우기
                </button>
              </div>
            </div>

            {mode === 'count' && Object.keys(countMap).length > 0 && (
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-bold text-blue-800">현재 실사 집계</h4>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-blue-700">
                    {Object.keys(countMap).length}품목
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(countMap).map(([code, qty]) => (
                    <div key={code} className="flex justify-between rounded-xl bg-white px-3 py-2 text-sm shadow-sm">
                      <span className="mr-2 truncate font-mono text-gray-600">{code}</span>
                      <span className="font-bold text-blue-600">{qty}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <RecentScanList history={history} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-bold text-gray-900">빠른 사용법</h3>
            <div className="mt-4 space-y-3">
              {QUICK_START_STEPS.map((step) => (
                <div key={step.title} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-sm font-semibold text-gray-800">{step.title}</p>
                  <p className="mt-1 text-sm leading-6 text-gray-600">{step.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-bold text-gray-900">모드별 안내</h3>
            <div className="mt-4 space-y-3">
              {MODE_ORDER.map((m) => {
                const meta = MODE_META[m];
                const isActive = m === mode;

                return (
                  <div
                    key={m}
                    className={`rounded-2xl border p-4 transition-colors ${
                      isActive ? meta.accentClass : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{meta.label}</p>
                        <p className="mt-1 text-xs text-gray-500">{meta.subtitle}</p>
                      </div>
                      {isActive && (
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.badgeClass}`}>
                          현재 선택됨
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-gray-700">{meta.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Camera Overlay */}
      <ScannerOverlay 
        active={isCameraActive} 
        onClose={() => toggleCamera()}
        onScan={() => {
          // The hook handles queueing, we just need to close if desired
          // For continuous scanning, keep open
          // toggleCamera(); 
        }}
      />
    </div>
  );
}
