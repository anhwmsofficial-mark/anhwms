'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import { useLayout } from '@/components/LayoutWrapper';
import {
  QrCodeIcon,
  CheckCircleIcon,
  XCircleIcon,
  MagnifyingGlassIcon,
  PrinterIcon
} from '@heroicons/react/24/outline';
import BarcodeInput from '@/components/BarcodeInput';

interface Package {
  id: string;
  orderId: string;
  trackingNumber: string;
  carrier: string;
  packageType: 'box' | 'envelope' | 'pallet';
  itemCount: number;
  labelAttached: boolean;
  barcodeScanned: boolean;
  sealIntact: boolean;
  status: 'pending' | 'checking' | 'pass' | 'fail';
  issues?: string[];
  checkedBy?: string;
  checkedAt?: Date;
}

const SAMPLE_PACKAGES: Package[] = [
  {
    id: 'PKG-001',
    orderId: 'ORD-2025-001',
    trackingNumber: 'TRK-123456',
    carrier: 'CJ대한통운',
    packageType: 'box',
    itemCount: 5,
    labelAttached: true,
    barcodeScanned: true,
    sealIntact: true,
    status: 'pass',
    checkedBy: '김철수',
    checkedAt: new Date()
  },
  {
    id: 'PKG-002',
    orderId: 'ORD-2025-002',
    trackingNumber: 'TRK-123457',
    carrier: '顺丰速运',
    packageType: 'box',
    itemCount: 3,
    labelAttached: false,
    barcodeScanned: false,
    sealIntact: true,
    status: 'fail',
    issues: ['라벨 누락', '바코드 미부착']
  },
  {
    id: 'PKG-003',
    orderId: 'ORD-2025-003',
    trackingNumber: 'TRK-123458',
    carrier: '한진택배',
    packageType: 'envelope',
    itemCount: 1,
    labelAttached: true,
    barcodeScanned: true,
    sealIntact: true,
    status: 'pending'
  }
];

export default function PackageCheckPage() {
  const { toggleSidebar } = useLayout();
  const [packages, setPackages] = useState<Package[]>(SAMPLE_PACKAGES);
  const [scanMode, setScanMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const filteredPackages = packages.filter(pkg => {
    const matchesSearch = 
      pkg.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pkg.trackingNumber.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || pkg.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const handleBarcodeScan = (barcode: string) => {
    console.log('바코드 스캔:', barcode);
  };

  const handleCheck = (pkgId: string, result: 'pass' | 'fail', issues?: string[]) => {
    setPackages(packages.map(pkg =>
      pkg.id === pkgId ? {
        ...pkg,
        status: result,
        issues,
        checkedBy: '현재 사용자',
        checkedAt: new Date()
      } : pkg
    ));
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, React.ReactElement> = {
      'pending': <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">대기</span>,
      'checking': <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">검사중</span>,
      'pass': <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold flex items-center gap-1"><CheckCircleIcon className="h-4 w-4" /> 합격</span>,
      'fail': <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold flex items-center gap-1"><XCircleIcon className="h-4 w-4" /> 불합격</span>,
    };
    return badges[status] || null;
  };

  const stats = {
    total: packages.length,
    pending: packages.filter(p => p.status === 'pending').length,
    pass: packages.filter(p => p.status === 'pass').length,
    fail: packages.filter(p => p.status === 'fail').length,
  };

  return (
    <div className="flex flex-col h-screen">
      <Header title="📦 패키지 검증" onMenuClick={toggleSidebar} />
      
      <main className="flex-1 overflow-y-auto bg-gray-50 p-4 lg:p-6">
        <div className="space-y-6">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">패키지 검증 (Package Check)</h1>
              <p className="text-sm text-gray-600 mt-1">
                포장 상태 확인, 라벨 검증, 바코드 스캔
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">전체</div>
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">대기</div>
              <div className="text-2xl font-bold text-gray-500">{stats.pending}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">합격</div>
              <div className="text-2xl font-bold text-green-600">{stats.pass}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">불합격</div>
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
                <option value="checking">검사중</option>
                <option value="pass">합격</option>
                <option value="fail">불합격</option>
              </select>
            </div>
          </div>

          {/* 패키지 목록 */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">주문번호</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">운송장</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">물류사</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">포장 유형</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">수량</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">체크리스트</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredPackages.map((pkg) => (
                    <tr key={pkg.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium">{pkg.orderId}</td>
                      <td className="px-4 py-3 text-sm font-mono text-blue-600">{pkg.trackingNumber}</td>
                      <td className="px-4 py-3 text-sm">{pkg.carrier}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                          {pkg.packageType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-center font-semibold">{pkg.itemCount}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="space-y-1 text-xs">
                          <div className={pkg.labelAttached ? 'text-green-600' : 'text-red-600'}>
                            {pkg.labelAttached ? '✓' : '✗'} 라벨
                          </div>
                          <div className={pkg.barcodeScanned ? 'text-green-600' : 'text-red-600'}>
                            {pkg.barcodeScanned ? '✓' : '✗'} 바코드
                          </div>
                          <div className={pkg.sealIntact ? 'text-green-600' : 'text-red-600'}>
                            {pkg.sealIntact ? '✓' : '✗'} 봉인
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">{getStatusBadge(pkg.status)}</td>
                      <td className="px-4 py-3 text-sm">
                        {pkg.status === 'pending' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleCheck(pkg.id, 'pass')}
                              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                            >
                              합격
                            </button>
                            <button
                              onClick={() => {
                                const issues = prompt('문제점을 입력하세요:');
                                if (issues) handleCheck(pkg.id, 'fail', [issues]);
                              }}
                              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
                            >
                              불합격
                            </button>
                          </div>
                        )}
                        {pkg.status === 'pass' && (
                          <button
                            className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-xs flex items-center gap-1"
                          >
                            <PrinterIcon className="h-3 w-3" /> 라벨 재출력
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
            <h3 className="font-semibold text-blue-900 mb-3">💡 패키지 검증 프로세스</h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li>• <strong>라벨 확인</strong>: 배송 라벨 부착 여부 및 정확성</li>
              <li>• <strong>바코드 스캔</strong>: 패키지 바코드 스캔 및 시스템 매칭</li>
              <li>• <strong>봉인 확인</strong>: 포장 테이프, 봉인 씰 무결성 확인</li>
              <li>• <strong>무게/크기</strong>: 규격 초과 또는 이상 여부 확인</li>
              <li>• <strong>출고 승인</strong>: 모든 체크리스트 통과 시 출고 승인</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
