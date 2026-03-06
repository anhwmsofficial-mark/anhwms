import ScannerView from '@/components/scanner/ScannerView';
import Header from '@/components/Header';

export default function ScannerV2Page() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header title="🚀 WMS Scanner V2" />
      <main className="flex-1 p-4">
        <div className="max-w-md mx-auto mb-6">
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r shadow-sm">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  새로운 스캐너 시스템입니다. <strong>USB 스캐너</strong>와 <strong>카메라</strong>를 모두 지원하며, 
                  상단의 모드 버튼을 통해 <strong>조회/입고/출고/재고실사</strong> 업무를 전환할 수 있습니다.
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
