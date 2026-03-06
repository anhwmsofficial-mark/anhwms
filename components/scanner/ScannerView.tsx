'use client';

import { useState, useCallback } from 'react';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { ScanMode, ScanResult } from '@/types/scanner';
import { handleScanWorkflow } from '@/lib/workflows/scanWorkflow';
import ScannerOverlay from '@/components/scanner/ScannerOverlay';
import RecentScanList from '@/components/scanner/RecentScanList';
import ScanQueueList from '@/components/scanner/ScanQueueList';

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
        setCountMap(prev => ({
            ...prev,
            [barcode]: (prev[barcode] || 0) + 1
        }));
        return { ...data, qty: (countMap[barcode] || 0) + 1 };
      }
      
      return data;
    } catch (error) {
      throw error;
    }
  }, [countMap]);

  const {
    queue,
    history,
    isProcessing,
    isCameraActive,
    toggleCamera,
    manualScan,
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


  return (
    <div className="flex flex-col h-full space-y-4 p-4 max-w-md mx-auto w-full">
      {/* Header / Mode Selector */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-800">Scanner</h2>
          <div className="flex gap-2">
            <button 
              onClick={() => toggleCamera('scanner-reader')}
              className={`p-2 rounded-full ${isCameraActive ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}
            >
              📷
            </button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {(['lookup', 'inbound', 'outbound', 'relocation', 'count'] as ScanMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                mode === m 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Main Scan Result Area */}
      <div className={`bg-white p-6 rounded-xl shadow-md border-2 transition-all ${
        scannedItem?.status === 'success' ? 'border-green-500 bg-green-50' :
        scannedItem?.status === 'error' ? 'border-red-500 bg-red-50' :
        'border-gray-200'
      }`}>
        {scannedItem ? (
          <div className="text-center">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
              scannedItem.status === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
            }`}>
              <span className="text-3xl">
                {scannedItem.status === 'success' ? '✓' : '!'}
              </span>
            </div>
            <h3 className="text-2xl font-bold mb-1 break-all">
              {scannedItem.barcode}
            </h3>
            <p className={`font-medium mb-4 ${
              scannedItem.status === 'success' ? 'text-green-700' : 'text-red-700'
            }`}>
              {scannedItem.message}
            </p>
            
            {scannedItem.data && (
              <div className="bg-white/50 p-4 rounded-lg text-left space-y-2 border border-gray-100">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="col-span-2">
                    <span className="text-gray-500 block text-xs">Product Name</span>
                    <span className="font-bold text-gray-800 text-base">{scannedItem.data.name || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs">SKU</span>
                    <span className="font-mono text-gray-800">{scannedItem.data.sku || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs">Category</span>
                    <span className="text-gray-800">{scannedItem.data.category || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs">Location</span>
                    <span className="font-bold text-blue-600">{scannedItem.data.location || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs">Current Stock</span>
                    <span className="font-bold text-gray-800">
                      {scannedItem.data.qty ?? scannedItem.data.current_qty ?? '-'} {scannedItem.data.unit}
                    </span>
                  </div>
                  
                  {/* Inbound specific */}
                  {scannedItem.data.expected_qty !== undefined && (
                    <div className="col-span-2 mt-2 pt-2 border-t border-gray-200 bg-green-50 p-2 rounded">
                      <span className="text-green-700 block text-xs font-bold">Expected Inbound</span>
                      <span className="font-bold text-green-800 text-xl">
                        {scannedItem.data.expected_qty} {scannedItem.data.unit || ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <p className="text-4xl mb-2">📦</p>
            <p>Ready to scan...</p>
            <p className="text-sm mt-2">Use scanner or camera</p>
          </div>
        )}
      </div>

      {/* Queue & History */}
      <div className="space-y-4">
        <ScanQueueList queue={queue} />
        
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-gray-700">History</h3>
          <div className="flex gap-2">
            {mode === 'count' && (
              <button 
                onClick={clearCounts}
                className="text-xs text-blue-500 hover:text-blue-700 font-bold"
              >
                Reset Counts
              </button>
            )}
            <button 
              onClick={clearHistory}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Clear History
            </button>
          </div>
        </div>
        
        {mode === 'count' && Object.keys(countMap).length > 0 && (
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-4">
            <h4 className="font-bold text-blue-800 text-sm mb-2">Current Counts</h4>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(countMap).map(([code, qty]) => (
                <div key={code} className="flex justify-between bg-white px-2 py-1 rounded text-sm">
                  <span className="font-mono text-gray-600 truncate mr-2">{code}</span>
                  <span className="font-bold text-blue-600">{qty}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <RecentScanList history={history} />
      </div>

      {/* Camera Overlay */}
      <ScannerOverlay 
        active={isCameraActive} 
        onClose={() => toggleCamera()}
        onScan={(code) => {
          // The hook handles queueing, we just need to close if desired
          // For continuous scanning, keep open
          // toggleCamera(); 
        }}
      />
    </div>
  );
}
