import ScannerView from '@/components/scanner/ScannerView';

export default function ScannerV2Page() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="text-xl font-bold text-gray-800">WMS Scanner V2</h1>
      </header>
      <main className="flex-1 p-4">
        <ScannerView />
      </main>
    </div>
  );
}
