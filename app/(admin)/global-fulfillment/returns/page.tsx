'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import { useLayout } from '@/components/LayoutWrapper';
import {
  QrCodeIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import BarcodeInput from '@/components/BarcodeInput';

interface Return {
  id: string;
  orderId: string;
  sku: string;
  productName: string;
  quantity: number;
  returnReason: 'defective' | 'wrong_item' | 'customer_change' | 'damage' | 'other';
  returnStatus: 'requested' | 'received' | 'inspecting' | 'approved' | 'rejected' | 'refunded';
  customerName: string;
  requestDate: Date;
  receiveDate?: Date;
  inspectionResult?: 'pass' | 'fail';
  refundAmount?: number;
  notes?: string;
  photos?: string[];
}

const SAMPLE_RETURNS: Return[] = [
  {
    id: 'RET-001',
    orderId: 'ORD-2025-001',
    sku: 'SKU-CN-001',
    productName: '무선 이어폰',
    quantity: 1,
    returnReason: 'defective',
    returnStatus: 'inspecting',
    customerName: '홍길동',
    requestDate: new Date('2025-01-10'),
    receiveDate: new Date('2025-01-13'),
    notes: '충전 불량'
  },
  {
    id: 'RET-002',
    orderId: 'ORD-2025-002',
    sku: 'SKU-CN-002',
    productName: '스마트워치',
    quantity: 1,
    returnReason: 'wrong_item',
    returnStatus: 'approved',
    customerName: '김철수',
    requestDate: new Date('2025-01-11'),
    receiveDate: new Date('2025-01-14'),
    inspectionResult: 'pass',
    refundAmount: 150000,
    notes: '다른 제품 배송됨'
  },
  {
    id: 'RET-003',
    orderId: 'ORD-2025-003',
    sku: 'SKU-CN-003',
    productName: 'USB 케이블',
    quantity: 2,
    returnReason: 'customer_change',
    returnStatus: 'requested',
    customerName: '이영희',
    requestDate: new Date('2025-01-14')
  }
];

export default function ReturnsPage() {
  const { toggleSidebar } = useLayout();
  const [returns, setReturns] = useState<Return[]>(SAMPLE_RETURNS);
  const [scanMode, setScanMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const filteredReturns = returns.filter(ret => {
    const matchesSearch = 
      ret.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ret.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ret.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || ret.returnStatus === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const handleBarcodeScan = (barcode: string) => {
    console.log('바코드 스캔:', barcode);
  };

  const handleUpdateStatus = (retId: string, newStatus: Return['returnStatus']) => {
    setReturns(returns.map(ret =>
      ret.id === retId ? { ...ret, returnStatus: newStatus } : ret
    ));
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, React.ReactElement> = {
      'requested': <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">접수</span>,
      'received': <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">수령</span>,
      'inspecting': <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">검수중</span>,
      'approved': <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">승인</span>,
      'rejected': <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">거부</span>,
      'refunded': <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">환불완료</span>,
    };
    return badges[status] || null;
  };

  const getReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      'defective': '불량',
      'wrong_item': '오배송',
      'customer_change': '단순변심',
      'damage': '파손',
      'other': '기타',
    };
    return labels[reason] || reason;
  };

  const stats = {
    total: returns.length,
    requested: returns.filter(r => r.returnStatus === 'requested').length,
    inspecting: returns.filter(r => r.returnStatus === 'inspecting').length,
    approved: returns.filter(r => r.returnStatus === 'approved').length,
  };

  return (
    <div className="flex flex-col h-screen">
      <Header title="↩️ 교환/반품" onMenuClick={toggleSidebar} />
      
      <main className="flex-1 overflow-y-auto bg-gray-50 p-4 lg:p-6">
        <div className="space-y-6">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">교환/반품 (Returns)</h1>
              <p className="text-sm text-gray-600 mt-1">
                반품 접수, 검수, 환불 처리
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
              <div className="text-sm text-gray-600">접수</div>
              <div className="text-2xl font-bold text-gray-500">{stats.requested}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">검수중</div>
              <div className="text-2xl font-bold text-yellow-600">{stats.inspecting}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">승인</div>
              <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
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
                  placeholder="주문번호, SKU, 고객명 검색..."
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
                <option value="requested">접수</option>
                <option value="received">수령</option>
                <option value="inspecting">검수중</option>
                <option value="approved">승인</option>
                <option value="rejected">거부</option>
                <option value="refunded">환불완료</option>
              </select>
            </div>
          </div>

          {/* 반품 목록 */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">반품 ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">주문번호</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상품</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">수량</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">고객명</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">사유</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">신청일</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredReturns.map((ret) => (
                    <tr key={ret.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium">{ret.id}</td>
                      <td className="px-4 py-3 text-sm">{ret.orderId}</td>
                      <td className="px-4 py-3 text-sm">
                        <div>{ret.productName}</div>
                        <div className="text-xs text-gray-500">{ret.sku}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-center font-semibold">{ret.quantity}</td>
                      <td className="px-4 py-3 text-sm">{ret.customerName}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                          {getReasonLabel(ret.returnReason)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{getStatusBadge(ret.returnStatus)}</td>
                      <td className="px-4 py-3 text-sm">
                        {ret.requestDate.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {ret.returnStatus === 'requested' && (
                          <button
                            onClick={() => handleUpdateStatus(ret.id, 'received')}
                            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                          >
                            수령 확인
                          </button>
                        )}
                        {ret.returnStatus === 'received' && (
                          <button
                            onClick={() => handleUpdateStatus(ret.id, 'inspecting')}
                            className="px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-xs"
                          >
                            검수 시작
                          </button>
                        )}
                        {ret.returnStatus === 'inspecting' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdateStatus(ret.id, 'approved')}
                              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                            >
                              승인
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(ret.id, 'rejected')}
                              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
                            >
                              거부
                            </button>
                          </div>
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
            <h3 className="font-semibold text-blue-900 mb-3">💡 교환/반품 프로세스</h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li>• <strong>반품 접수</strong>: 고객이 반품 신청 시 시스템에 자동 등록</li>
              <li>• <strong>수령 확인</strong>: 반품 상품 입고 시 바코드 스캔으로 확인</li>
              <li>• <strong>검수</strong>: 상품 상태 확인 (불량, 사용흔적, 포장 등)</li>
              <li>• <strong>승인/거부</strong>: 검수 결과에 따라 반품 승인 또는 거부</li>
              <li>• <strong>환불 처리</strong>: 승인 시 자동으로 환불 프로세스 진행</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
