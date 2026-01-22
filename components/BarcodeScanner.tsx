'use client';

import { useState, useEffect } from 'react';
import { QrReader } from 'react-qr-reader';

interface BarcodeScannerProps {
  onScan: (data: string | null) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const [error, setError] = useState<string>('');

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex justify-between items-center p-4 text-white bg-black bg-opacity-50 absolute top-0 left-0 right-0 z-10">
        <h3 className="font-bold">바코드/QR 스캔</h3>
        <button onClick={onClose} className="text-2xl font-bold">&times;</button>
      </div>
      
      <div className="flex-1 flex items-center justify-center bg-black">
        <div className="w-full max-w-sm aspect-square relative overflow-hidden rounded-xl border-2 border-blue-500">
          <QrReader
            onResult={(result, error) => {
              if (!!result) {
                onScan(result?.getText());
              }
              if (!!error) {
                // console.info(error); // 스캔 중이 아닐 때 계속 발생하므로 로그 생략
              }
            }}
            constraints={{ facingMode: 'environment' }}
            className="w-full h-full"
          />
          {/* 스캔 가이드라인 */}
          <div className="absolute inset-0 border-2 border-white opacity-50 rounded-xl pointer-events-none">
             <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500 opacity-80"></div>
          </div>
        </div>
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
