'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScanner } from 'html5-qrcode';

interface BarcodeScannerProps {
  onScan: (data: string | null) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // 스캐너 초기화 (약간의 지연 후 실행하여 DOM 마운트 보장)
    const timeoutId = setTimeout(() => {
      startScanner();
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      stopScanner();
    };
  }, []);

  const startScanner = async () => {
    try {
      // facingMode: "environment"를 사용하여 후면 카메라 자동 선택
      const html5QrCode = new Html5Qrcode("reader");
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" }, 
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        (decodedText) => {
          onScan(decodedText);
          stopScanner(); // 스캔 성공 시 중지
        },
        (errorMessage) => {
          // 스캔 중 에러는 무시 (계속 스캔)
        }
      );
    } catch (err) {
      console.error(err);
      setError('카메라 시작 실패: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
        try {
            await scannerRef.current.stop();
            scannerRef.current.clear();
        } catch (err) {
            // 이미 중지된 경우 무시
        }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex justify-between items-center p-4 text-white bg-black bg-opacity-50 absolute top-0 left-0 right-0 z-10">
        <h3 className="font-bold">바코드/QR 스캔</h3>
        <button onClick={onClose} className="text-2xl font-bold">&times;</button>
      </div>
      
      <div className="flex-1 flex items-center justify-center bg-black relative">
        <div id="reader" className="w-full h-full max-w-sm"></div>
        {error && (
            <div className="absolute inset-0 flex items-center justify-center text-white bg-black bg-opacity-80 p-4 text-center">
                {error}
            </div>
        )}
      </div>

      <div className="p-6 bg-white text-center">
        <p className="text-gray-600 mb-2">바코드를 사각형 안에 맞춰주세요</p>
        <button 
            onClick={onClose}
            className="w-full bg-gray-200 text-gray-800 py-3 rounded-xl font-bold"
        >
            닫기
        </button>
      </div>
    </div>
  );
}
