import ScannerView from '@/components/scanner/ScannerView';
import Header from '@/components/Header';

export default function ScannerV2Page() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header title="🚀 WMS Scanner V2" />
      <main className="flex-1 px-4 py-6">
        <div className="mx-auto mb-6 max-w-6xl">
          <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-white p-5 shadow-sm">
            <div className="flex gap-3">
              <div className="flex-shrink-0 pt-0.5">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="space-y-3">
                <p className="text-sm leading-6 text-blue-900">
                  새로운 스캐너 시스템입니다. <strong>USB 스캐너</strong>와 <strong>카메라</strong>를 모두 지원하며,
                  상단에서 <strong>Lookup / Inbound / Outbound / Relocation / Count</strong> 모드를 전환해 작업할 수 있습니다.
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-white px-3 py-1 font-semibold text-blue-700 shadow-sm">Lookup: 상품 조회</span>
                  <span className="rounded-full bg-white px-3 py-1 font-semibold text-emerald-700 shadow-sm">Inbound: 입고 검수</span>
                  <span className="rounded-full bg-white px-3 py-1 font-semibold text-amber-700 shadow-sm">Outbound: 출고 확인</span>
                  <span className="rounded-full bg-white px-3 py-1 font-semibold text-violet-700 shadow-sm">Relocation: 재고 이동</span>
                  <span className="rounded-full bg-white px-3 py-1 font-semibold text-sky-700 shadow-sm">Count: 재고 실사</span>
                </div>
                <p className="text-xs text-blue-700">
                  현장 작업자는 상단 모드 선택 후 바로 스캔하면 되고, 상세 사용법은 우측 안내 카드에서 즉시 확인할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        </div>
        <ScannerView />
      </main>
    </div>
  );
}
