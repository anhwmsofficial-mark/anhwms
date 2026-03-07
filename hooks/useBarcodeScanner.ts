import { useState, useCallback, useRef, useEffect } from 'react';
import { useHidScanner } from './useHidScanner';
import { useCameraScanner } from './useCameraScanner';
import { useScanQueue } from './useScanQueue';
import { useScanHistory } from './useScanHistory';
import { DuplicateGuard } from '@/lib/scanner/duplicateGuard';
import { parseBarcode } from '@/lib/scanner/barcodeParser';
import { scanFeedback } from '@/lib/scanner/scanFeedback';
import { ScanMode, ScanResult, BarcodeType } from '@/types/scanner';

import { scanCache } from '@/lib/scanner/scanCache';

interface UseBarcodeScannerProps {
  mode?: ScanMode;
  onScanSuccess?: (result: ScanResult) => void;
  onScanError?: (result: ScanResult) => void;
  processScan: (barcode: string, mode: ScanMode) => Promise<any>;
  useCache?: boolean;
}

export function useBarcodeScanner({
  mode = 'lookup',
  onScanSuccess,
  onScanError,
  processScan,
  useCache = true
}: UseBarcodeScannerProps) {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const duplicateGuard = useRef(new DuplicateGuard(1500));
  
  // Update duplicate guard cooldown when mode changes
  useEffect(() => {
    if (mode === 'count') {
      // In count mode, we allow rapid duplicates, maybe just minimal debounce
      duplicateGuard.current = new DuplicateGuard(200); 
    } else {
      duplicateGuard.current = new DuplicateGuard(1500);
    }
  }, [mode]);

  const { history, addHistory, clearHistory } = useScanHistory();

  // Unified scan handler
  const handleScan = useCallback(async (barcode: string) => {
    // 1. Check duplicate guard
    if (duplicateGuard.current.isDuplicate(barcode)) {
      console.log('Duplicate scan guarded:', barcode);
      const duplicateResult: ScanResult = {
        barcode,
        type: 'unknown',
        status: 'warning',
        message: 'Duplicate scan ignored',
        timestamp: Date.now(),
        mode,
      };
      return duplicateResult;
    }

    // 2. Parse barcode
    const parsed = parseBarcode(barcode);

    try {
      let data;
      
      // Check cache if enabled and not in count mode (count mode always needs to increment)
      const shouldCache = useCache && mode !== 'count';
      
      if (shouldCache) {
        const cached = scanCache.get(`${mode}:${parsed.value}`);
        if (cached) {
          console.log('Cache hit:', parsed.value);
          data = cached;
        }
      }

      if (!data) {
        // 3. Process based on mode via external handler
        data = await processScan(parsed.value, mode);
        
        if (shouldCache) {
          scanCache.set(`${mode}:${parsed.value}`, data);
        }
      }

      const result: ScanResult = {
        barcode: parsed.value,
        type: parsed.type,
        status: 'success',
        message: 'Scan successful',
        timestamp: Date.now(),
        data,
        mode
      };

      // 4. Feedback & History
      scanFeedback.success();
      addHistory(result);
      onScanSuccess?.(result);
      
      return result;

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Scan processing failed';
      
      const result: ScanResult = {
        barcode: parsed.value,
        type: parsed.type,
        status: 'error',
        message: errorMsg,
        timestamp: Date.now(),
        mode
      };

      scanFeedback.error();
      addHistory(result);
      onScanError?.(result);
      
      // Re-throw if needed by queue
      throw err;
    }
  }, [mode, onScanSuccess, onScanError, processScan, addHistory]);

  // Queue system for handling rapid inputs
  const { queue, addToQueue, isProcessing } = useScanQueue({
    onProcess: handleScan,
    maxConcurrency: 1
  });

  // HID Scanner Hook
  useHidScanner({
    onScan: addToQueue,
  });

  // Camera Scanner Hook (controlled by UI state)
  const { startScanner, stopScanner } = useCameraScanner({
    onScan: (code) => {
      addToQueue(code);
      // Typically we don't stop scanner automatically in continuous mode
      // But for mobile single-scan flow, we might want to.
      // Let UI control this.
    },
    onError: (err) => console.warn(err)
  });

  const toggleCamera = useCallback((elementId: string = 'scanner-reader') => {
    setIsCameraActive(prev => {
        if (prev) {
            stopScanner();
            return false;
        } else {
            startScanner(elementId);
            return true;
        }
    });
  }, [startScanner, stopScanner]);

  return {
    queue,
    history,
    isProcessing,
    isCameraActive,
    toggleCamera,
    manualScan: addToQueue,
    clearHistory
  };
}
