'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import BarcodeInput from '@/components/BarcodeInput';
import BarcodeGenerator from '@/components/BarcodeGenerator';
import QRCodeGenerator from '@/components/QRCodeGenerator';
import { getProducts } from '@/lib/api/products';
import { Product } from '@/types';

export default function ScannerTestPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const [scanHistory, setScanHistory] = useState<Array<{ code: string; time: Date; found: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'scan' | 'generate'>('scan');

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      const response = await getProducts({ limit: 1000 }); // 테스트용으로 넉넉히
      setProducts(response.data);
    } catch (error) {
      console.error('제품 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleScan = (code: string) => {
    console.log('스캔됨:', code);
    
    // 제품 검색
    const product = products.find(p => p.sku === code || p.name.includes(code));
    
    if (product) {
      setScannedProduct(product);
      setScanHistory(prev => [
        { code, time: new Date(), found: true },
        ...prev.slice(0, 9)
      ]);
      
      // 성공 사운드 (선택사항)
      playSound('success');
    } else {
      setScannedProduct(null);
      setScanHistory(prev => [
        { code, time: new Date(), found: false },
        ...prev.slice(0, 9)
      ]);
      
      // 실패 사운드
      playSound('error');
      
      alert(`❌ 제품을 찾을 수 없습니다: ${code}`);
    }
  };

  const playSound = (type: 'success' | 'error') => {
    // 브라우저 기본 비프음
    const audio = new AudioContext();
    const oscillator = audio.createOscillator();
    const gainNode = audio.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audio.destination);
    
    oscillator.frequency.value = type === 'success' ? 800 : 400;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audio.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audio.currentTime + 0.1);
    
    oscillator.start(audio.currentTime);
    oscillator.stop(audio.currentTime + 0.1);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div>
        <Header title="🔍 스캐너 테스트" />
        <div className="p-8">
          <p>제품 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="🔍 스캐너 테스트 (제품 없이도 가능!)" />
      
      <div className="p-8 no-print">
        {/* 탭 */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setTab('scan')}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              tab === 'scan'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📷 스캔 테스트
          </button>
          <button
            onClick={() => setTab('generate')}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              tab === 'generate'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            🏷️ 바코드 생성
          </button>
        </div>

        {/* 스캔 탭 */}
        {tab === 'scan' && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-bold text-blue-900 mb-2">💡 USB 스캐너 없이 테스트하는 방법</h3>
              <ol className="list-decimal list-inside space-y-1 text-blue-800">
                <li>아래 입력 창에 포커스가 있는지 확인</li>
                <li>테스트용 SKU 입력 (예: PROD-001, PROD-002 등)</li>
                <li>Enter 키를 누르면 스캔한 것처럼 동작합니다!</li>
                <li><strong>실제 USB 스캐너를 연결하면 자동으로 입력됩니다</strong></li>
              </ol>
            </div>

            {/* 스캔 입력 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4">바코드 스캔</h2>
              <BarcodeInput onScan={handleScan} />
            </div>

            {/* 스캔 결과 */}
            {scannedProduct && (
              <div className="bg-green-50 border-2 border-green-500 rounded-lg p-6 shadow-lg animate-pulse-once">
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-2xl font-bold text-green-900">✅ 제품 찾음!</h2>
                  <button
                    onClick={() => setScannedProduct(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-green-700 font-semibold">제품명</p>
                    <p className="text-lg font-bold">{scannedProduct.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-green-700 font-semibold">SKU</p>
                    <p className="text-lg font-bold">{scannedProduct.sku}</p>
                  </div>
                  <div>
                    <p className="text-sm text-green-700 font-semibold">현재 재고</p>
                    <p className="text-lg font-bold">{scannedProduct.quantity} {scannedProduct.unit}</p>
                  </div>
                  <div>
                    <p className="text-sm text-green-700 font-semibold">위치</p>
                    <p className="text-lg font-bold">{scannedProduct.location}</p>
                  </div>
                  <div>
                    <p className="text-sm text-green-700 font-semibold">단가</p>
                    <p className="text-lg font-bold">₩{scannedProduct.price.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-green-700 font-semibold">카테고리</p>
                    <p className="text-lg font-bold">{scannedProduct.category}</p>
                  </div>
                </div>

                {/* 액션 버튼 */}
                <div className="flex gap-4 mt-6">
                  <button className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
                    📦 입고 처리
                  </button>
                  <button className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700">
                    📤 출고 처리
                  </button>
                </div>
              </div>
            )}

            {/* 스캔 이력 */}
            {scanHistory.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-bold mb-4">📜 스캔 이력 (최근 10개)</h3>
                <div className="space-y-2">
                  {scanHistory.map((item, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        item.found ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{item.found ? '✅' : '❌'}</span>
                        <div>
                          <p className="font-semibold">{item.code}</p>
                          <p className="text-sm text-gray-600">
                            {item.time.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <span className={`font-semibold ${item.found ? 'text-green-700' : 'text-red-700'}`}>
                        {item.found ? '제품 찾음' : '제품 없음'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 바코드 생성 탭 */}
        {tab === 'generate' && (
          <div className="space-y-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-bold text-yellow-900 mb-2">🏷️ 테스트용 바코드 생성</h3>
              <p className="text-yellow-800">
                제품의 바코드를 생성하여 인쇄하거나, 스마트폰으로 화면을 찍어서 스캔 테스트를 할 수 있습니다!
              </p>
            </div>

            {/* 제품 목록 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => (
                <div key={product.id} className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="font-bold text-lg mb-2">{product.name}</h3>
                  <p className="text-sm text-gray-600 mb-4">SKU: {product.sku}</p>
                  
                  {/* 바코드 */}
                  <div className="flex justify-center mb-4 p-4 bg-gray-50 rounded-lg">
                    <BarcodeGenerator value={product.sku} height={60} />
                  </div>
                  
                  {/* QR 코드 */}
                  <div className="flex justify-center mb-4">
                    <QRCodeGenerator value={product.sku} size={150} />
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-700">
                    <p>재고: {product.quantity} {product.unit}</p>
                    <p>위치: {product.location}</p>
                    <p>단가: ₩{product.price.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* 인쇄 버튼 */}
            <div className="flex justify-center">
              <button
                onClick={handlePrint}
                className="px-8 py-4 bg-blue-600 text-white rounded-lg font-bold text-lg hover:bg-blue-700 shadow-lg"
              >
                🖨️ 모든 바코드 인쇄
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 인쇄 전용 스타일 */}
      <style jsx>{`
        @media print {
          .no-print {
            display: none !important;
          }
        }
        
        @keyframes pulse-once {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.02); }
        }
        
        .animate-pulse-once {
          animation: pulse-once 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
}

