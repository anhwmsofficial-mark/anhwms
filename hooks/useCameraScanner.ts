import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface UseCameraScannerProps {
  onScan: (barcode: string) => void;
  onError?: (error: string) => void;
  startDelay?: number;
}

export function useCameraScanner({ 
  onScan, 
  onError, 
  startDelay = 100 
}: UseCameraScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
        setIsScanning(false);
      } catch (err) {
        console.warn('Failed to stop scanner', err);
      }
    }
  }, [isScanning]);

  const startScanner = useCallback(async (elementId: string) => {
    if (isScanning) return;

    try {
      const html5QrCode = new Html5Qrcode(elementId, {
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        verbose: false
      });
      
      scannerRef.current = html5QrCode;

      const config = { fps: 10, qrbox: { width: 250, height: 250 } };
      
      // Prefer back camera
      const cameraIdOrConfig = { facingMode: "environment" };

      await html5QrCode.start(
        cameraIdOrConfig, 
        config,
        (decodedText) => {
          onScan(decodedText);
          // Optional: Stop on first scan? Or verify and continue?
          // Typically we continue scanning unless explicitly stopped.
          // But for mobile, it's often better to stop after success to give feedback.
          // Let the parent component decide via prop or state management.
        },
        (errorMessage) => {
            // Very noisy, usually ignored
            // if (onError) onError(errorMessage);
        }
      );
      
      setIsScanning(true);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      if (onError) onError(msg);
    }
  }, [isScanning, onScan, onError]);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear();
      }
    };
  }, []);

  return {
    startScanner,
    stopScanner,
    isScanning,
    error
  };
}
