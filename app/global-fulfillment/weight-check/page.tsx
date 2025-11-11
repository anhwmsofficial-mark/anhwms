'use client';

import { useState } from 'react';
import {
  QrCodeIcon,
  ScaleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import BarcodeInput from '@/components/BarcodeInput';

interface WeightRecord {
  id: string;
  orderId: string;
  sku: string;
  productName: string;
  packageType: string;
  carrier: string;
  trackingNumber: string;
  estimatedWeight: number;
  actualWeight?: number;
  weightDifference?: number;
  weightDifferencePercent?: number;
  shippingCost?: number;
  status: 'pending' | 'weighing' | 'completed' | 'error';
  measuredAt?: Date;
  issues?: string[];
}

// 샘플 데이터
const SAMPLE_RECORDS: WeightRecord[] = [
  {
    id: 'WGT-001',
    orderId: 'TB-20250104-001',
    sku: 'SKU-CN-001',
    productName: '무선 이어폰',
    packageType: '2S',
    carrier: 'hanjin',
    trackingNumber: 'HJ-2025-001234',
    estimatedWeight: 0.8,
    status: 'pending'
  },
  {
    id: 'WGT-002',
    orderId: 'TB-20250104-002',
    sku: 'SKU-CN-002',
    productName: '스마트워치',
    packageType: '2B',
    carrier: 'cj',
    trackingNumber: 'CJ-2025-567890',
    estimatedWeight: 1.2,
    status: 'pending'
  },
  {
    id: 'WGT-003',
    orderId: 'TB-20250104-003',
    sku: 'SKU-CN-001',
    productName: '무선 이어폰',
    packageType: '2S',
    carrier: 'hanjin',
    trackingNumber: 'HJ-2025-001235',
    estimatedWeight: 0.5,
    status: 'pending'
  },
  {
    id: 'WGT-004',
    orderId: 'TB-20250104-004',
    sku: 'SKU-CN-003',
    productName: '블루투스 스피커',
    packageType: '2B',
    carrier: 'shunfeng',
    trackingNumber: 'SF-2025-789012',
    estimatedWeight: 1.5,
    status: 'pending'
  }
];

// 물류사별 요금표 (kg당 기본요금 + 추가요금)
const SHIPPING_RATES: Record<string, { base: number; perKg: number; minWeight: number }> = {
  hanjin: { base: 3000, perKg: 500, minWeight: 0.5 },
  cj: { base: 3500, perKg: 550, minWeight: 0.5 },
  lotte: { base: 3200, perKg: 520, minWeight: 0.5 },
  shunfeng: { base: 8000, perKg: 2000, minWeight: 0.5 }, // 顺丰 국제특송
  ems: { base: 5000, perKg: 1500, minWeight: 0.5 }
};

const CARRIER_NAMES: Record<string, string> = {
  hanjin: '한진택배',
  cj: 'CJ대한통운',
  lotte: '롯데택배',
  shunfeng: '顺丰速运',
  ems: 'EMS'
};

export default function WeightCheckPage() {
  const [records, setRecords] = useState<WeightRecord[]>(SAMPLE_RECORDS);
  const [scanMode, setScanMode] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<WeightRecord | null>(null);
  const [weightInput, setWeightInput] = useState('');
  const [autoWeighMode, setAutoWeighMode] = useState(false);
  const [simulatedWeight, setSimulatedWeight] = useState<number | null>(null);

  // 운임 계산
  const calculateShippingCost = (carrier: string, weight: number): number => {
    const rate = SHIPPING_RATES[carrier];
    if (!rate) return 0;

    const effectiveWeight = Math.max(weight, rate.minWeight);
    return rate.base + Math.ceil(effectiveWeight) * rate.perKg;
  };

  // 바코드 스캔 처리
  const handleBarcodeScan = (barcode: string) => {
    const record = records.find(
      r => r.id === barcode || r.orderId === barcode || r.trackingNumber === barcode
    );

    if (!record) {
      alert(`❌ 기록을 찾을 수 없습니다: ${barcode}`);
      return;
    }

    setCurrentRecord(record);
    setRecords(prev =>
      prev.map(r =>
        r.id === record.id ? { ...r, status: 'weighing' } : r
      )
    );

    // 자동 무게 측정 모드면 시뮬레이션
    if (autoWeighMode) {
      simulateWeightMeasurement(record);
    }
  };

  // 무게 측정 시뮬레이션 (실제 환경에서는 저울 API 연동)
  const simulateWeightMeasurement = (record: WeightRecord) => {
    setTimeout(() => {
      // 예상 무게의 ±10% 범위에서 랜덤
      const variance = (Math.random() - 0.5) * 0.2;
      const weight = record.estimatedWeight * (1 + variance);
      setSimulatedWeight(parseFloat(weight.toFixed(2)));
      setWeightInput(weight.toFixed(2));
    }, 1000);
  };

  // 무게 입력 처리
  const handleWeightSubmit = () => {
    if (!currentRecord) return;

    const weight = parseFloat(weightInput);
    if (isNaN(weight) || weight <= 0) {
      alert('올바른 무게를 입력하세요');
      return;
    }

    const issues: string[] = [];
    const weightDiff = weight - currentRecord.estimatedWeight;
    const weightDiffPercent = (Math.abs(weightDiff) / currentRecord.estimatedWeight) * 100;

    // 허용오차 ±5% 체크
    if (weightDiffPercent > 5) {
      issues.push(`중량 오차 ${weightDiffPercent.toFixed(1)}%`);
    }

    // 운임 계산
    const shippingCost = calculateShippingCost(currentRecord.carrier, weight);

    setRecords(prev =>
      prev.map(r =>
        r.id === currentRecord.id
          ? {
              ...r,
              actualWeight: weight,
              weightDifference: weightDiff,
              weightDifferencePercent: weightDiffPercent,
              shippingCost,
              status: issues.length > 0 ? 'error' : 'completed',
              measuredAt: new Date(),
              issues: issues.length > 0 ? issues : undefined
            }
          : r
      )
    );

    // 초기화
    setWeightInput('');
    setSimulatedWeight(null);
    setCurrentRecord(null);
  };

  // 통계
  const stats = {
    total: records.length,
    pending: records.filter(r => r.status === 'pending').length,
    weighing: records.filter(r => r.status === 'weighing').length,
    completed: records.filter(r => r.status === 'completed').length,
    error: records.filter(r => r.status === 'error').length,
    totalWeight: records
      .filter(r => r.actualWeight)
      .reduce((sum, r) => sum + (r.actualWeight || 0), 0),
    totalCost: records
      .filter(r => r.shippingCost)
      .reduce((sum, r) => sum + (r.shippingCost || 0), 0)
  };

  // 물류사별 통계
  const carrierStats = Object.keys(SHIPPING_RATES).map(carrier => {
    const carrierRecords = records.filter(r => r.carrier === carrier && r.actualWeight);
    return {
      carrier,
      name: CARRIER_NAMES[carrier],
      count: carrierRecords.length,
      totalWeight: carrierRecords.reduce((sum, r) => sum + (r.actualWeight || 0), 0),
      totalCost: carrierRecords.reduce((sum, r) => sum + (r.shippingCost || 0), 0)
    };
  }).filter(s => s.count > 0);

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">무게 측정 (Weight Check)</h1>
          <p className="text-sm text-gray-600 mt-1">
            출고 요금 산정 및 중량 검증
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setAutoWeighMode(!autoWeighMode)}
            className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
              autoWeighMode
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100'
            }`}
          >
            <ScaleIcon className="h-5 w-5" />
            {autoWeighMode ? '자동측정 ON' : '자동측정 OFF'}
          </button>
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
          <div className="text-sm text-gray-600">측정중</div>
          <div className="text-2xl font-bold text-yellow-600 mt-1">{stats.weighing}</div>
        </div>
        <div className="bg-green-50 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">완료</div>
          <div className="text-2xl font-bold text-green-600 mt-1">{stats.completed}</div>
        </div>
        <div className="bg-blue-50 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">총 중량</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">{stats.totalWeight.toFixed(2)}</div>
          <div className="text-xs text-gray-500">kg</div>
        </div>
        <div className="bg-purple-50 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">총 운임</div>
          <div className="text-2xl font-bold text-purple-600 mt-1">
            {(stats.totalCost / 1000).toFixed(0)}K
          </div>
          <div className="text-xs text-gray-500">₩{stats.totalCost.toLocaleString()}</div>
        </div>
      </div>

      {/* 바코드 스캔 모드 */}
      {scanMode && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <QrCodeIcon className="h-6 w-6 text-green-600" />
            바코드 스캔 모드
            {autoWeighMode && (
              <span className="text-sm font-normal text-purple-600 ml-2">
                ⚡ 자동 무게측정 활성화
              </span>
            )}
          </h3>
          <BarcodeInput onScan={handleBarcodeScan} />
        </div>
      )}

      {/* 현재 측정 */}
      {currentRecord && (
        <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                ⚖️ 무게 측정 중
              </h3>
              <div className="space-y-1 text-sm">
                <div><strong>주문번호:</strong> {currentRecord.orderId}</div>
                <div><strong>상품:</strong> {currentRecord.productName}</div>
                <div><strong>물류사:</strong> {CARRIER_NAMES[currentRecord.carrier]}</div>
                <div><strong>운송장:</strong> {currentRecord.trackingNumber}</div>
                <div><strong>예상 무게:</strong> {currentRecord.estimatedWeight}kg</div>
              </div>
            </div>
            {simulatedWeight && (
              <div className="text-center">
                <div className="text-6xl font-bold text-purple-600">{simulatedWeight}</div>
                <div className="text-sm text-gray-600">kg (시뮬레이션)</div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg p-4 border-2 border-purple-300">
            <div className="flex items-center gap-2 mb-3">
              <ScaleIcon className="h-6 w-6 text-purple-600" />
              <h4 className="font-semibold">실제 무게 입력</h4>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <input
                  type="number"
                  step="0.01"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-lg font-semibold"
                  autoFocus
                />
                <div className="text-xs text-gray-500 mt-1">
                  허용오차: ±5% (
                  {(currentRecord.estimatedWeight * 0.95).toFixed(2)}kg ~ 
                  {(currentRecord.estimatedWeight * 1.05).toFixed(2)}kg)
                </div>
              </div>
              <button
                onClick={handleWeightSubmit}
                disabled={!weightInput}
                className="px-8 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold"
              >
                기록
              </button>
            </div>

            {/* 예상 운임 미리보기 */}
            {weightInput && !isNaN(parseFloat(weightInput)) && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">예상 운임:</span>
                  <span className="text-lg font-bold text-blue-600">
                    ₩{calculateShippingCost(currentRecord.carrier, parseFloat(weightInput)).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* 측정 기록 */}
        <div className="col-span-2">
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">측정 기록</h2>
            </div>

            <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
              {records.map(record => (
                <div
                  key={record.id}
                  className={`p-4 hover:bg-gray-50 transition ${
                    currentRecord?.id === record.id ? 'bg-purple-50' : ''
                  } ${record.status === 'error' ? 'bg-red-50' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-semibold text-gray-900">{record.orderId}</span>
                        <StatusBadge status={record.status} />
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>{record.productName} • {CARRIER_NAMES[record.carrier]}</div>
                        {record.actualWeight ? (
                          <>
                            <div className="flex items-center gap-4 font-semibold">
                              <span>무게: {record.actualWeight}kg</span>
                              {record.weightDifference !== undefined && (
                                <span className={
                                  Math.abs(record.weightDifference) > currentRecord?.estimatedWeight! * 0.05
                                    ? 'text-red-600'
                                    : 'text-green-600'
                                }>
                                  {record.weightDifference > 0 ? '+' : ''}
                                  {record.weightDifference.toFixed(2)}kg 
                                  ({record.weightDifferencePercent?.toFixed(1)}%)
                                </span>
                              )}
                            </div>
                            {record.shippingCost && (
                              <div className="text-purple-600 font-semibold flex items-center gap-1">
                                <CurrencyDollarIcon className="h-4 w-4" />
                                운임: ₩{record.shippingCost.toLocaleString()}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-gray-500">예상: {record.estimatedWeight}kg</div>
                        )}
                      </div>
                      {record.issues && record.issues.length > 0 && (
                        <div className="text-xs text-red-600 mt-2 flex items-center gap-1">
                          <ExclamationTriangleIcon className="h-4 w-4" />
                          {record.issues.join(', ')}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      {record.status === 'completed' && (
                        <CheckCircleIcon className="h-8 w-8 text-green-600" />
                      )}
                      {record.status === 'error' && (
                        <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
                      )}
                      {record.measuredAt && (
                        <div className="text-xs text-gray-500 mt-2">
                          {record.measuredAt.toLocaleTimeString('ko-KR')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 물류사별 통계 */}
        <div>
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <ChartBarIcon className="h-5 w-5" />
                물류사별 통계
              </h2>
            </div>

            <div className="p-4 space-y-4">
              {carrierStats.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <ChartBarIcon className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">측정된 데이터가 없습니다</p>
                </div>
              )}

              {carrierStats.map(stat => (
                <div key={stat.carrier} className="bg-gray-50 rounded-lg p-4">
                  <div className="font-semibold text-gray-900 mb-2">{stat.name}</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">패키지 수:</span>
                      <span className="font-semibold">{stat.count}건</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">총 중량:</span>
                      <span className="font-semibold">{stat.totalWeight.toFixed(2)}kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">총 운임:</span>
                      <span className="font-semibold text-purple-600">
                        ₩{stat.totalCost.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">평균 운임:</span>
                      <span className="font-semibold text-blue-600">
                        ₩{Math.round(stat.totalCost / stat.count).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 요금표 */}
          <div className="bg-white rounded-lg shadow mt-4">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <CurrencyDollarIcon className="h-4 w-4" />
                운임 요금표
              </h3>
            </div>
            <div className="p-4 text-xs space-y-2">
              {Object.entries(SHIPPING_RATES).map(([carrier, rate]) => (
                <div key={carrier} className="flex justify-between items-center py-1">
                  <span className="font-medium">{CARRIER_NAMES[carrier]}</span>
                  <span className="text-gray-600">
                    ₩{rate.base.toLocaleString()} + ₩{rate.perKg.toLocaleString()}/kg
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 사용 가이드 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-3">💡 사용 가이드</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>• <strong>바코드 스캔</strong>: 주문번호, 운송장 번호 또는 패키지 ID를 스캔</li>
          <li>• <strong>자동측정 모드</strong>: 전자저울 연동 시 스캔만으로 자동 측정 (현재 시뮬레이션)</li>
          <li>• <strong>중량 오차</strong>: 예상 무게 대비 ±5% 이상 차이 시 경고 표시</li>
          <li>• <strong>운임 자동 산출</strong>: 물류사별 요금표에 따라 자동 계산</li>
          <li>• <strong>실시간 통계</strong>: 물류사별 중량 및 운임 통계 제공</li>
        </ul>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: WeightRecord['status'] }) {
  const styles = {
    pending: 'bg-gray-100 text-gray-700',
    weighing: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700'
  };

  const labels = {
    pending: '⚪ 대기',
    weighing: '🟡 측정중',
    completed: '🟢 완료',
    error: '🔴 오류'
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
