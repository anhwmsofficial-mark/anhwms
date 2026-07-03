'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import { useLayout } from '@/components/LayoutWrapper';
import {
  ScaleIcon,
  QrCodeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import BarcodeInput from '@/components/BarcodeInput';
import { SampleDataNotice } from '@/components/global-fulfillment/SampleDataNotice';

interface WeightItem {
  id: string;
  orderId: string;
  trackingNumber: string;
  expectedWeight: number;
  actualWeight?: number;
  variance?: number;
  variancePercent?: number;
  dimensions?: string;
  status: 'pending' | 'measuring' | 'pass' | 'warning' | 'fail';
  measuredBy?: string;
  measuredAt?: Date;
}

const SAMPLE_ITEMS: WeightItem[] = [
  {
    id: 'WGT-001',
    orderId: 'ORD-2025-001',
    trackingNumber: 'TRK-123456',
    expectedWeight: 0.5,
    actualWeight: 0.52,
    variance: 0.02,
    variancePercent: 4,
    dimensions: '20x15x10cm',
    status: 'pass',
    measuredBy: '김철수',
    measuredAt: new Date()
  },
  {
    id: 'WGT-002',
    orderId: 'ORD-2025-002',
    trackingNumber: 'TRK-123457',
    expectedWeight: 1.2,
    actualWeight: 1.5,
    variance: 0.3,
    variancePercent: 25,
    dimensions: '30x25x15cm',
    status: 'fail',
    measuredBy: '이영희',
    measuredAt: new Date()
  },
  {
    id: 'WGT-003',
    orderId: 'ORD-2025-003',
    trackingNumber: 'TRK-123458',
    expectedWeight: 0.8,
    status: 'pending'
  }
];

export default function WeightCheckPage() {
  const { toggleSidebar } = useLayout();
  const [items, setItems] = useState<WeightItem[]>(SAMPLE_ITEMS);
  const [scanMode, setScanMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.trackingNumber.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const handleBarcodeScan = (barcode: string) => {
    console.log('바코드 스캔:', barcode);
  };

  const handleMeasure = (itemId: string) => {
    const weight = prompt('측정 무게를 입력하세요 (kg):');
    if (weight) {
      const actualWeight = parseFloat(weight);
      const item = items.find(i => i.id === itemId);
      if (item) {
        const variance = actualWeight - item.expectedWeight;
        const variancePercent = (variance / item.expectedWeight) * 100;
        const status = 
          Math.abs(variancePercent) <= 5 ? 'pass' :
          Math.abs(variancePercent) <= 10 ? 'warning' :
          'fail';

        setItems(items.map(i =>
          i.id === itemId ? {
            ...i,
            actualWeight,
            variance,
            variancePercent,
            status,
            measuredBy: '현재 사용자',
            measuredAt: new Date()
          } : i
        ));
      }
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, React.ReactElement> = {
      'pending': <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">대기</span>,
      'measuring': <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">측정중</span>,
      'pass': <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold flex items-center gap-1"><CheckCircleIcon className="h-4 w-4" /> 정상</span>,
      'warning': <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold flex items-center gap-1"><ExclamationTriangleIcon className="h-4 w-4" /> 주의</span>,
      'fail': <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold flex items-center gap-1"><XCircleIcon className="h-4 w-4" /> 불일치</span>,
    };
    return badges[status] || null;
  };

  const stats = {
    total: items.length,
    pending: items.filter(i => i.status === 'pending').length,
    pass: items.filter(i => i.status === 'pass').length,
    warning: items.filter(i => i.status === 'warning').length,
    fail: items.filter(i => i.status === 'fail').length,
  };

  return (
    <div className="flex flex-col h-screen">
      <Header title="⚖️ 무게 측정" onMenuClick={toggleSidebar} />
      
      <main className="flex-1 overflow-y-auto bg-gray-50 p-4 lg:p-6">
        <div className="space-y-6">
          <SampleDataNotice description="중량 검증 목록과 측정 결과는 샘플 데이터입니다. 실제 운임 산정이나 출고 보류 판단에 사용하지 마세요." />

          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">무게 측정 (Weight Check)</h1>
              <p className="text-sm text-gray-600 mt-1">
                중량 검증, 불일치 처리, 운송비 정산 기준
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

          {/* 통계 */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">전체</div>
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">대기</div>
              <div className="text-2xl font-bold text-gray-500">{stats.pending}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">정상</div>
              <div className="text-2xl font-bold text-green-600">{stats.pass}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">주의</div>
              <div className="text-2xl font-bold text-yellow-600">{stats.warning}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">불일치</div>
              <div className="text-2xl font-bold text-red-600">{stats.fail}</div>
            </div>
          </div>

          {/* 바코드 스캔 */}
          {scanMode && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <QrCodeIcon className="h-6 w-6 text-green-600" />
                바코드/QR 스캔 모드
              </h3>
              <BarcodeInput onScan={handleBarcodeScan} />
            </div>
          )}

          {/* 검색 및 필터 */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="flex-1 relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="주문번호, 운송장번호 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="all">전체 상태</option>
                <option value="pending">대기</option>
                <option value="measuring">측정중</option>
                <option value="pass">정상</option>
                <option value="warning">주의</option>
                <option value="fail">불일치</option>
              </select>
            </div>
          </div>

          {/* 무게 측정 목록 */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">주문번호</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">운송장</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">예상 무게</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">실제 무게</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">차이</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">차이율</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">크기</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium">{item.orderId}</td>
                      <td className="px-4 py-3 text-sm font-mono text-blue-600">{item.trackingNumber}</td>
                      <td className="px-4 py-3 text-sm font-semibold">{item.expectedWeight} kg</td>
                      <td className="px-4 py-3 text-sm font-semibold">
                        {item.actualWeight ? `${item.actualWeight} kg` : <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {item.variance ? (
                          <span className={item.variance > 0 ? 'text-red-600' : 'text-green-600'}>
                            {item.variance > 0 ? '+' : ''}{item.variance.toFixed(3)} kg
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {item.variancePercent !== undefined ? (
                          <span className={Math.abs(item.variancePercent) > 10 ? 'text-red-600 font-semibold' : 'text-gray-900'}>
                            {item.variancePercent > 0 ? '+' : ''}{item.variancePercent.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-xs">
                        {item.dimensions || <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-4 py-3 text-sm">{getStatusBadge(item.status)}</td>
                      <td className="px-4 py-3 text-sm">
                        {item.status === 'pending' && (
                          <button
                            onClick={() => handleMeasure(item.id)}
                            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs flex items-center gap-1"
                          >
                            <ScaleIcon className="h-3 w-3" /> 측정
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 가이드 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold text-blue-900 mb-3">💡 무게 측정 프로세스</h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li>• <strong>중량 측정</strong>: 전자저울로 정확한 무게 측정</li>
              <li>• <strong>허용 오차</strong>: ±5% 이내 정상, ±10% 이내 주의, 그 이상 불일치</li>
              <li>• <strong>불일치 처리</strong>: 10% 이상 차이 시 재포장 또는 고객 확인</li>
              <li>• <strong>운송비 정산</strong>: 실제 무게 기준으로 운송비 정산</li>
              <li>• <strong>데이터 기록</strong>: 모든 측정 데이터는 자동 저장 및 분석</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
