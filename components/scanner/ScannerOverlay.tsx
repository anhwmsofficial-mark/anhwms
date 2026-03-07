import { useEffect } from 'react';
import { useCameraScanner } from '@/hooks/useCameraScanner';

interface ScannerOverlayProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
  active: boolean;
}

export default function ScannerOverlay({ onScan, onClose, active }: ScannerOverlayProps) {
  const { startScanner, stopScanner, error } = useCameraScanner({
    onScan: (code) => {
      onScan(code);
      // Optional: don't close immediately if continuous mode
      // onClose(); 
    },
    onError: (err) => console.warn(err)
  });

  useEffect(() => {
    if (active) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        startScanner('scanner-reader');
      }, 100);
      return () => clearTimeout(timer);
    } else {
      stopScanner();
    }
  }, [active, startScanner, stopScanner]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex justify-between items-center p-4 bg-black bg-opacity-50 text-white z-10">
        <h3 className="font-bold text-lg">Scan Barcode</h3>
        <button onClick={onClose} className="text-3xl">&times;</button>
      </div>
      
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        <div id="scanner-reader" className="w-full max-w-lg aspect-square"></div>
        
        {/* Visual Guide Overlay */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-64 h-64 border-2 border-white rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-blue-500 -mt-1 -ml-1"></div>
            <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-blue-500 -mt-1 -mr-1"></div>
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-blue-500 -mb-1 -ml-1"></div>
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-blue-500 -mb-1 -mr-1"></div>
          </div>
        </div>

        {error && (
          <div className="absolute bottom-20 left-0 right-0 text-center text-red-500 bg-black bg-opacity-75 p-2">
            {error}
          </div>
        )}
      </div>

      <div className="p-6 bg-white text-center">
        <p className="text-gray-600">Align code within the frame</p>
        <button 
          onClick={onClose}
          className="mt-4 w-full bg-gray-200 text-gray-800 py-3 rounded-xl font-bold"
        >
          Close Scanner
        </button>
      </div>
    </div>
  );
}
