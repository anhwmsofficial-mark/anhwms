'use client';

import { useState } from 'react';
import {
  QrCodeIcon,
  CheckCircleIcon,
  PrinterIcon,
  ScaleIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import BarcodeInput from '@/components/BarcodeInput';

interface Package {
  id: string;
  orderId: string;
  sku: string;
  productName: string;
  quantity: number;
  packageType: '2B' | '2S' | 'BOX' | 'ENVELOPE' | 'CUSTOM';
  estimatedWeight: number;
  actualWeight?: number;
  carrier: string;
  trackingNumber: string;
  receiverName: string;
  receiverAddress: string;
  status: 'pending' | 'weighing' | 'labeled' | 'verified' | 'error';
  labelPrinted: boolean;
  verifiedAt?: Date;
  issues?: string[];
}

// 포장 타입
const PACKAGE_TYPES = [
  { value: '2B', label: '2B (박스 중형)', icon: '📦', description: '30x25x20cm' },
  { value: '2S', label: '2S (박스 소형)', icon: '📦', description: '25x20x15cm' },
  { value: 'BOX', label: 'BOX (일반 박스)', icon: '📦', description: '맞춤형' },
  { value: 'ENVELOPE', label: 'ENVELOPE (봉투)', icon: '✉️', description: '서류/의류' },
  { value: 'CUSTOM', label: 'CUSTOM (커스텀)', icon: '🎁', description: '특수 포장' }
];

// 샘플 데이터
const SAMPLE_PACKAGES: Package[] = [
  {
    id: 'PKG-001',
    orderId: 'TB-20250104-001',
    sku: 'SKU-CN-001',
    productName: '무선 이어폰',
    quantity: 5,
    packageType: '2S',
    estimatedWeight: 0.8,
    carrier: 'hanjin',
    trackingNumber: 'HJ-2025-001234',
    receiverName: '김철수',
    receiverAddress: '서울특별시 강남구 테헤란로 123',
    status: 'pending',
    labelPrinted: false
  },
  {
    id: 'PKG-002',
    orderId: 'TB-20250104-002',
    sku: 'SKU-CN-002',
    productName: '스마트워치',
    quantity: 3,
    packageType: '2B',
    estimatedWeight: 1.2,
    carrier: 'cj',
    trackingNumber: 'CJ-2025-567890',
    receiverName: '이영희',
    receiverAddress: '경기도 성남시 분당구 판교역로 235',
    status: 'pending',
    labelPrinted: false
  },
  {
    id: 'PKG-003',
    orderId: 'TB-20250104-003',
    sku: 'SKU-CN-001',
    productName: '무선 이어폰',
    quantity: 2,
    packageType: '2S',
    estimatedWeight: 0.5,
    carrier: 'hanjin',
    trackingNumber: 'HJ-2025-001235',
    receiverName: '박민수',
    receiverAddress: '부산광역시 해운대구 마린시티 456',
    status: 'pending',
    labelPrinted: false
  }
];

export default function PackageCheckPage() {
  const [packages, setPackages] = useState<Package[]>(SAMPLE_PACKAGES);
  const [scanMode, setScanMode] = useState(false);
  const [currentPackage, setCurrentPackage] = useState<Package | null>(null);
  const [weightInput, setWeightInput] = useState('');

  // 바코드 스캔 처리
  const handleBarcodeScan = (barcode: string) => {
    // 패키지 찾기
    const pkg = packages.find(
      p => p.id === barcode || p.orderId === barcode || p.trackingNumber === barcode
    );

    if (!pkg) {
      alert(`❌ 패키지를 찾을 수 없습니다: ${barcode}`);
      return;
    }

    setCurrentPackage(pkg);
    setPackages(prev =>
      prev.map(p =>
        p.id === pkg.id ? { ...p, status: 'weighing' } : p
      )
    );
  };

  // 무게 입력
  const handleWeightInput = () => {
    if (!currentPackage) return;

    const weight = parseFloat(weightInput);
    if (isNaN(weight) || weight <= 0) {
      alert('올바른 무게를 입력하세요');
      return;
    }

    const issues: string[] = [];
    const weightDiff = Math.abs(weight - currentPackage.estimatedWeight);
    const weightDiffPercent = (weightDiff / currentPackage.estimatedWeight) * 100;

    // 무게 차이 5% 이상이면 경고
    if (weightDiffPercent > 5) {
      issues.push(`무게 오차 ${weightDiffPercent.toFixed(1)}% (예상: ${currentPackage.estimatedWeight}kg)`);
    }

    setPackages(prev =>
      prev.map(p =>
        p.id === currentPackage.id
          ? {
              ...p,
              actualWeight: weight,
              status: issues.length > 0 ? 'error' : 'labeled',
              issues: issues.length > 0 ? issues : undefined
            }
          : p
      )
    );

    setWeightInput('');
  };

  // 라벨 인쇄
  const handlePrintLabel = (pkg: Package) => {
    // 새 창에서 라벨 인쇄
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const labelHTML = generateLabelHTML(pkg);
    printWindow.document.write(labelHTML);
    printWindow.document.close();
    printWindow.print();

    // 인쇄 완료 표시
    setPackages(prev =>
      prev.map(p =>
        p.id === pkg.id ? { ...p, labelPrinted: true } : p
      )
    );
  };

  // 라벨 HTML 생성
  const generateLabelHTML = (pkg: Package) => {
    const packageTypeInfo = PACKAGE_TYPES.find(t => t.value === pkg.packageType);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Shipping Label - ${pkg.trackingNumber}</title>
        <style>
          @page { size: 10cm 15cm; margin: 0; }
          body {
            font-family: 'Noto Sans KR', Arial, sans-serif;
            margin: 0;
            padding: 15px;
            width: 10cm;
            height: 15cm;
          }
          .header { text-align: center; border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 10px; }
          .carrier { font-size: 24px; font-weight: bold; }
          .tracking { font-size: 32px; font-weight: bold; font-family: monospace; margin: 10px 0; }
          .barcode { font-family: 'Libre Barcode 128 Text', monospace; font-size: 48px; text-align: center; margin: 10px 0; }
          .section { margin: 15px 0; padding: 10px; border: 2px solid #000; }
          .section-title { font-size: 14px; font-weight: bold; margin-bottom: 5px; }
          .section-content { font-size: 12px; line-height: 1.6; }
          .package-type { display: inline-block; padding: 5px 10px; background: #000; color: #fff; font-weight: bold; margin: 5px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="carrier">${getCarrierName(pkg.carrier)}</div>
          <div class="tracking">${pkg.trackingNumber}</div>
          <div class="barcode">${pkg.trackingNumber}</div>
        </div>

        <div class="section">
          <div class="section-title">📦 수취인 (Receiver)</div>
          <div class="section-content">
            <strong>${pkg.receiverName}</strong><br/>
            ${pkg.receiverAddress}
          </div>
        </div>

        <div class="section">
          <div class="section-title">📋 상품 정보 (Product Info)</div>
          <div class="section-content">
            <strong>${pkg.productName}</strong><br/>
            SKU: ${pkg.sku} | 수량: ${pkg.quantity}개<br/>
            주문번호: ${pkg.orderId}
          </div>
        </div>

        <div class="section">
          <div class="section-title">⚖️ 포장 정보 (Package Info)</div>
          <div class="section-content">
            <div class="package-type">${packageTypeInfo?.icon} ${packageTypeInfo?.label}</div><br/>
            무게: ${pkg.actualWeight || pkg.estimatedWeight}kg<br/>
            ${packageTypeInfo?.description}
          </div>
        </div>

        <div style="text-align: center; margin-top: 20px; font-size: 10px; color: #666;">
          Printed: ${new Date().toLocaleString('ko-KR')}<br/>
          Package ID: ${pkg.id}
        </div>
      </body>
      </html>
    `;
  };

  // 검증 완료
  const handleVerifyPackage = (pkg: Package) => {
    if (!pkg.actualWeight) {
      alert('먼저 무게를 측정하세요');
      return;
    }

    if (!pkg.labelPrinted) {
      alert('먼저 라벨을 인쇄하세요');
      return;
    }

    setPackages(prev =>
      prev.map(p =>
        p.id === pkg.id
          ? {
              ...p,
              status: 'verified',
              verifiedAt: new Date()
            }
          : p
      )
    );
  };

  // 통계
  const stats = {
    total: packages.length,
    pending: packages.filter(p => p.status === 'pending').length,
    weighing: packages.filter(p => p.status === 'weighing').length,
    labeled: packages.filter(p => p.status === 'labeled').length,
    verified: packages.filter(p => p.status === 'verified').length,
    error: packages.filter(p => p.status === 'error').length
  };

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">패키지 검증 (Package Check)</h1>
          <p className="text-sm text-gray-600 mt-1">
            실제 포장단위(2B, 2S 등) 확인 및 송장 부착
          </p>
        </div>
        <button
          onClick={() => setScanMode(!scanMode)}
          className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
            scanMode
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100'
          }`}
        >
          <QrCodeIcon className="h-5 w-5" />
          {scanMode ? '스캔 모드 ON' : '바코드 스캔'}
        </button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-6 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">전체</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</div>
        </div>
        <div className="bg-gray-50 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">대기</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{stats.pending}</div>
        </div>
        <div className="bg-yellow-50 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">무게측정</div>
          <div className="text-2xl font-bold text-yellow-600 mt-1">{stats.weighing}</div>
        </div>
        <div className="bg-blue-50 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">라벨부착</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">{stats.labeled}</div>
        </div>
        <div className="bg-green-50 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">검증완료</div>
          <div className="text-2xl font-bold text-green-600 mt-1">{stats.verified}</div>
        </div>
        <div className="bg-red-50 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">오류</div>
          <div className="text-2xl font-bold text-red-600 mt-1">{stats.error}</div>
        </div>
      </div>

      {/* 바코드 스캔 모드 */}
      {scanMode && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <QrCodeIcon className="h-6 w-6 text-green-600" />
            바코드 스캔 모드
          </h3>
          <BarcodeInput onScan={handleBarcodeScan} />
        </div>
      )}

      {/* 현재 패키지 */}
      {currentPackage && (
        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                📦 현재 작업 중인 패키지
              </h3>
              <div className="space-y-1 text-sm">
                <div><strong>주문번호:</strong> {currentPackage.orderId}</div>
                <div><strong>상품:</strong> {currentPackage.productName} ({currentPackage.quantity}개)</div>
                <div><strong>수취인:</strong> {currentPackage.receiverName}</div>
                <div><strong>운송장:</strong> {currentPackage.trackingNumber}</div>
                <div>
                  <strong>포장 타입:</strong>{' '}
                  <span className="px-2 py-1 bg-blue-200 text-blue-800 rounded text-xs font-semibold">
                    {PACKAGE_TYPES.find(t => t.value === currentPackage.packageType)?.icon}{' '}
                    {PACKAGE_TYPES.find(t => t.value === currentPackage.packageType)?.label}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 무게 입력 */}
          {currentPackage.status === 'weighing' && !currentPackage.actualWeight && (
            <div className="bg-white rounded-lg p-4 border-2 border-yellow-300">
              <div className="flex items-center gap-2 mb-3">
                <ScaleIcon className="h-6 w-6 text-yellow-600" />
                <h4 className="font-semibold">⚖️ 무게 측정</h4>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm text-gray-600 mb-1">
                    실제 무게 (kg) - 예상: {currentPackage.estimatedWeight}kg
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
                <button
                  onClick={handleWeightInput}
                  className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition"
                >
                  무게 기록
                </button>
              </div>
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="flex gap-3 mt-4">
            {currentPackage.actualWeight && (
              <>
                <button
                  onClick={() => handlePrintLabel(currentPackage)}
                  disabled={currentPackage.labelPrinted}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <PrinterIcon className="h-5 w-5" />
                  {currentPackage.labelPrinted ? '✓ 라벨 인쇄됨' : '라벨 인쇄'}
                </button>
                <button
                  onClick={() => handleVerifyPackage(currentPackage)}
                  disabled={!currentPackage.labelPrinted || currentPackage.status === 'verified'}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <ClipboardDocumentCheckIcon className="h-5 w-5" />
                  {currentPackage.status === 'verified' ? '✓ 검증 완료' : '검증 완료'}
                </button>
              </>
            )}
          </div>

          {/* 이슈 */}
          {currentPackage.issues && currentPackage.issues.length > 0 && (
            <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded flex items-start gap-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mt-0.5" />
              <div className="text-sm text-red-800">
                {currentPackage.issues.join(', ')}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 패키지 목록 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">패키지 목록</h2>
        </div>

        <div className="divide-y divide-gray-200">
          {packages.map(pkg => {
            const packageTypeInfo = PACKAGE_TYPES.find(t => t.value === pkg.packageType);

            return (
              <div
                key={pkg.id}
                className={`p-4 hover:bg-gray-50 transition ${
                  currentPackage?.id === pkg.id ? 'bg-blue-50' : ''
                } ${pkg.status === 'error' ? 'bg-red-50' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-semibold text-gray-900">{pkg.orderId}</span>
                      <StatusBadge status={pkg.status} />
                      {pkg.labelPrinted && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-semibold">
                          🏷️ 라벨인쇄됨
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>
                        <strong>{pkg.productName}</strong> ({pkg.quantity}개) • SKU: {pkg.sku}
                      </div>
                      <div>수취인: {pkg.receiverName}</div>
                      <div className="flex items-center gap-3">
                        <span>
                          포장: {packageTypeInfo?.icon} {packageTypeInfo?.label}
                        </span>
                        <span>
                          무게: {pkg.actualWeight ? `${pkg.actualWeight}kg` : `예상 ${pkg.estimatedWeight}kg`}
                        </span>
                      </div>
                      <div className="font-mono text-xs text-blue-600">{pkg.trackingNumber}</div>
                    </div>
                    {pkg.issues && pkg.issues.length > 0 && (
                      <div className="text-xs text-red-600 mt-2 flex items-center gap-1">
                        <ExclamationTriangleIcon className="h-4 w-4" />
                        {pkg.issues.join(', ')}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePrintLabel(pkg)}
                      className="p-2 text-purple-600 hover:bg-purple-50 rounded"
                      title="라벨 인쇄"
                    >
                      <PrinterIcon className="h-5 w-5" />
                    </button>
                    {pkg.status === 'verified' && (
                      <CheckCircleIcon className="h-8 w-8 text-green-600" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 사용 가이드 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-3">💡 사용 가이드</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>• <strong>바코드 스캔</strong>: 패키지 ID, 주문번호, 또는 운송장 번호를 스캔</li>
          <li>• <strong>무게 측정</strong>: 실제 무게를 측정하고 입력 (예상 무게와 5% 이상 차이 시 경고)</li>
          <li>• <strong>라벨 인쇄</strong>: 운송사 라벨을 인쇄하여 패키지에 부착</li>
          <li>• <strong>검증 완료</strong>: 모든 절차가 완료되면 출고 준비 상태로 전환</li>
        </ul>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Package['status'] }) {
  const styles = {
    pending: 'bg-gray-100 text-gray-700',
    weighing: 'bg-yellow-100 text-yellow-700',
    labeled: 'bg-blue-100 text-blue-700',
    verified: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700'
  };

  const labels = {
    pending: '⚪ 대기',
    weighing: '🟡 무게측정',
    labeled: '🔵 라벨부착',
    verified: '🟢 검증완료',
    error: '🔴 오류'
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function getCarrierName(carrier: string): string {
  const carriers: Record<string, string> = {
    hanjin: '한진택배',
    cj: 'CJ대한통운',
    lotte: '롯데택배',
    shunfeng: '顺丰速运',
    ems: 'EMS'
  };
  return carriers[carrier] || carrier;
}
