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
      // 1. Native Barcode Detector 활성화 (성능/초점 개선 핵심)
      // Note: Some mobile browsers might have issues with experimental features.
      // If issues persist, try setting this to false.
      const html5QrCode = new Html5Qrcode(elementId, {
        experimentalFeatures: { useBarCodeDetectorIfSupported: false },
        verbose: true
      });
      
      scannerRef.current = html5QrCode;

      const config = { fps: 10, qrbox: { width: 250, height: 250 } };
      
      // Prefer back camera
      const cameraIdOrConfig = { facingMode: "environment" };

      await html5QrCode.start(
        cameraIdOrConfig, 
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODABAR
          ]
        },
        (decodedText) => {
          console.log('Camera scan success:', decodedText);
          onScan(decodedText);
        },
        (errorMessage) => {
            // Very noisy, usually ignored
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
