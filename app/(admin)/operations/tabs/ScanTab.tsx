'use client';

import { useState } from 'react';
import {
  QrCodeIcon,
  CheckCircleIcon,
  XCircleIcon,
  MagnifyingGlassIcon,
  CubeIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';

interface ScanResult {
  id: string;
  code: string;
  type: 'barcode' | 'qrcode';
  productName: string;
  location: string;
  quantity: number;
  unit: string;
  status: 'success' | 'error';
  timestamp: Date;
  message?: string;
}

export default function ScanTab() {
  const [scanInput, setScanInput] = useState('');
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  // 샘플 제품 데이터
  const products: Record<string, any> = {
    'LAP-001': { name: '노트북 A', location: 'A-1-01', quantity: 45, unit: '개' },
    'MOU-001': { name: '무선 마우스', location: 'A-2-05', quantity: 120, unit: '개' },
    'KEY-001': { name: '키보드', location: 'A-2-06', quantity: 8, unit: '개' },
    'MON-001': { name: '모니터 27인치', location: 'B-1-03', quantity: 32, unit: '개' },
    'CAB-001': { name: 'USB 케이블', location: 'C-1-01', quantity: 5, unit: '개' },
  };

  const handleScan = () => {
    if (!scanInput.trim()) return;

    setIsScanning(true);

    // 스캔 시뮬레이션
    setTimeout(() => {
      const product = products[scanInput.toUpperCase()];
      
      const newResult: ScanResult = {
        id: `scan-${Date.now()}`,
        code: scanInput,
        type: scanInput.startsWith('QR-') ? 'qrcode' : 'barcode',
        productName: product ? product.name : '알 수 없는 제품',
        location: product ? product.location : '-',
        quantity: product ? product.quantity : 0,
        unit: product ? product.unit : '개',
        status: product ? 'success' : 'error',
        timestamp: new Date(),
        message: product ? '스캔 성공' : '제품을 찾을 수 없습니다',
      };

      setScanResults([newResult, ...scanResults]);
      setScanInput('');
      setIsScanning(false);
    }, 800);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleScan();
    }
  };

  const clearResults = () => {
    setScanResults([]);
  };

  return (
    <div className="space-y-6">
      {/* 스캔 입력 영역 */}
      <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-2xl shadow-lg p-8 border-2 border-orange-200">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <QrCodeIcon className="h-8 w-8 text-orange-600" />
              바코드 / QR 스캔
            </h2>
            <p className="text-sm text-gray-600 mt-2">
              바코드 또는 QR 코드를 스캔하거나 직접 입력하세요
            </p>
          </div>
        </div>

        {/* 입력 필드 */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="relative">
            <input
              type="text"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="바코드 스캔 또는 입력 (예: LAP-001, MOU-001)"
              className="w-full px-4 py-4 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              disabled={isScanning}
              autoFocus
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              {isScanning ? (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600"></div>
              ) : (
                <QrCodeIcon className="h-6 w-6 text-gray-400" />
              )}
            </div>
          </div>

          <button
            onClick={handleScan}
            disabled={isScanning || !scanInput.trim()}
            className="w-full mt-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg"
          >
            {isScanning ? '스캔 중...' : '스캔하기'}
          </button>
        </div>

        {/* 샘플 코드 */}
        <div className="mt-4 bg-white rounded-lg p-4">
          <div className="text-xs text-gray-600 mb-2">💡 테스트용 샘플 코드</div>
          <div className="flex flex-wrap gap-2">
            {Object.keys(products).map((code) => (
              <button
                key={code}
                onClick={() => setScanInput(code)}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-xs font-mono rounded transition"
              >
                {code}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-5">
          <div className="text-sm text-gray-600">총 스캔</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{scanResults.length}</div>
        </div>
        <div className="bg-green-50 rounded-lg shadow p-5">
          <div className="text-sm text-gray-600">성공</div>
          <div className="text-2xl font-bold text-green-600 mt-1">
            {scanResults.filter(r => r.status === 'success').length}
          </div>
        </div>
        <div className="bg-red-50 rounded-lg shadow p-5">
          <div className="text-sm text-gray-600">실패</div>
          <div className="text-2xl font-bold text-red-600 mt-1">
            {scanResults.filter(r => r.status === 'error').length}
          </div>
        </div>
      </div>

      {/* 스캔 결과 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">📋 스캔 기록</h3>
          {scanResults.length > 0 && (
            <button
              onClick={clearResults}
              className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              전체 삭제
            </button>
          )}
        </div>

        <div className="divide-y divide-gray-200">
          {scanResults.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <QrCodeIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>스캔 기록이 없습니다</p>
            </div>
          ) : (
            scanResults.map((result) => (
              <div
                key={result.id}
                className={`p-5 hover:bg-gray-50 transition ${
                  result.status === 'error' ? 'bg-red-50' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {result.status === 'success' ? (
                        <CheckCircleIcon className="h-6 w-6 text-green-600 flex-shrink-0" />
                      ) : (
                        <XCircleIcon className="h-6 w-6 text-red-600 flex-shrink-0" />
                      )}
                      <div>
                        <div className="font-mono font-semibold text-lg text-gray-900">
                          {result.code}
                        </div>
                        <div className="text-xs text-gray-500">
                          {result.type === 'qrcode' ? 'QR 코드' : '바코드'} • {result.timestamp.toLocaleTimeString('ko-KR')}
                        </div>
                      </div>
                    </div>

                    {result.status === 'success' ? (
                      <div className="ml-9 grid grid-cols-3 gap-4">
                        <div className="flex items-center gap-2">
                          <CubeIcon className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-700">{result.productName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPinIcon className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-700">{result.location}</span>
                        </div>
                        <div className="text-sm text-gray-700">
                          재고: <strong>{result.quantity}{result.unit}</strong>
                        </div>
                      </div>
                    ) : (
                      <div className="ml-9 text-sm text-red-600">
                        {result.message}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

