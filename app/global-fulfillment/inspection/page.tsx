'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import { useLayout } from '@/components/LayoutWrapper';
import {
  ClipboardDocumentCheckIcon,
  QrCodeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  PhotoIcon,
  MagnifyingGlassIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import BarcodeInput from '@/components/BarcodeInput';

interface InspectionItem {
  id: string;
  orderId: string;
  sku: string;
  productName: string;
  quantity: number;
  inspectionType: 'quality' | 'quantity' | 'damage' | 'label' | 'packaging';
  result: 'pending' | 'pass' | 'fail' | 'conditional';
  issues?: string[];
  notes?: string;
  inspectedBy?: string;
  inspectedAt?: Date;
  photos?: string[];
}

const SAMPLE_ITEMS: InspectionItem[] = [
  {
    id: 'INSP-001',
    orderId: 'ORD-2025-001',
    sku: 'SKU-CN-001',
    productName: '무선 이어폰',
    quantity: 5,
    inspectionType: 'quality',
    result: 'pass',
    inspectedBy: '김철수',
    inspectedAt: new Date(),
    notes: '양호'
  },
  {
    id: 'INSP-002',
    orderId: 'ORD-2025-002',
    sku: 'SKU-CN-002',
    productName: '스마트워치',
    quantity: 3,
    inspectionType: 'damage',
    result: 'fail',
    issues: ['화면 스크래치', '박스 손상'],
    notes: '교환 필요',
    photos: ['damage1.jpg', 'damage2.jpg']
  },
  {
    id: 'INSP-003',
    orderId: 'ORD-2025-003',
    sku: 'SKU-CN-003',
    productName: 'USB 케이블',
    quantity: 10,
    inspectionType: 'quantity',
    result: 'pending'
  }
];

export default function InspectionPage() {
  const { toggleSidebar } = useLayout();
  const [items, setItems] = useState<InspectionItem[]>(SAMPLE_ITEMS);
  const [scanMode, setScanMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterResult, setFilterResult] = useState('all');
  const [filterType, setFilterType] = useState('all');

  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.productName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesResult = filterResult === 'all' || item.result === filterResult;
    const matchesType = filterType === 'all' || item.inspectionType === filterType;

    return matchesSearch && matchesResult && matchesType;
  });

  const handleBarcodeScan = (barcode: string) => {
    console.log('바코드 스캔:', barcode);
  };

  const handleInspectionResult = (itemId: string, result: InspectionItem['result'], issues?: string[], notes?: string) => {
    setItems(items.map(item =>
      item.id === itemId ? {
        ...item,
        result,
        issues,
        notes,
        inspectedBy: '현재 사용자',
        inspectedAt: new Date()
      } : item
    ));
  };

  const getResultBadge = (result: string) => {
    const badges: Record<string, React.ReactElement> = {
      'pending': <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">대기</span>,
      'pass': <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold flex items-center gap-1"><CheckCircleIcon className="h-4 w-4" /> 합격</span>,
      'fail': <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold flex items-center gap-1"><XCircleIcon className="h-4 w-4" /> 불합격</span>,
      'conditional': <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold flex items-center gap-1"><ExclamationTriangleIcon className="h-4 w-4" /> 조건부</span>,
    };
    return badges[result] || null;
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'quality': '품질 검사',
      'quantity': '수량 확인',
      'damage': '파손 검사',
      'label': '라벨 검사',
      'packaging': '포장 검사',
    };
    return labels[type] || type;
  };

  const stats = {
    total: items.length,
    pending: items.filter(i => i.result === 'pending').length,
    pass: items.filter(i => i.result === 'pass').length,
    fail: items.filter(i => i.result === 'fail').length,
  };

  return (
    <div className="flex flex-col h-screen">
      <Header title="✅ 검증/검사" onMenuClick={toggleSidebar} />
      
      <main className="flex-1 overflow-y-auto bg-gray-50 p-4 lg:p-6">
        <div className="space-y-6">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">검증/검사 (Inspection)</h1>
              <p className="text-sm text-gray-600 mt-1">
                상품 품질 확인, 파손 검사, 불량품 처리
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
                  placeholder="주문번호, SKU, 상품명 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={filterResult}
                onChange={(e) => setFilterResult(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="all">전체 결과</option>
                <option value="pending">대기</option>
                <option value="pass">합격</option>
                <option value="fail">불합격</option>
                <option value="conditional">조건부</option>
              </select>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="all">전체 검사</option>
                <option value="quality">품질</option>
                <option value="quantity">수량</option>
                <option value="damage">파손</option>
                <option value="label">라벨</option>
                <option value="packaging">포장</option>
              </select>
            </div>
          </div>

          {/* 검사 목록 */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">주문번호</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상품명</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">수량</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">검사 유형</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">결과</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">문제점</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">검사자</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium">{item.orderId}</td>
                      <td className="px-4 py-3 text-sm font-mono text-blue-600">{item.sku}</td>
                      <td className="px-4 py-3 text-sm">{item.productName}</td>
                      <td className="px-4 py-3 text-sm text-center font-semibold">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                          {getTypeLabel(item.inspectionType)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{getResultBadge(item.result)}</td>
                      <td className="px-4 py-3 text-sm">
                        {item.issues && item.issues.length > 0 ? (
                          <div className="text-red-600 text-xs">
                            {item.issues.map((issue, idx) => (
                              <div key={idx}>• {issue}</div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {item.inspectedBy || <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {item.result === 'pending' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleInspectionResult(item.id, 'pass')}
                              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                            >
                              합격
                            </button>
                            <button
                              onClick={() => {
                                const issues = prompt('문제점을 입력하세요 (쉼표로 구분):');
                                if (issues) {
                                  handleInspectionResult(item.id, 'fail', issues.split(',').map(s => s.trim()));
                                }
                              }}
                              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
                            >
                              불합격
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
            <h3 className="font-semibold text-blue-900 mb-3">💡 검증/검사 프로세스</h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li>• <strong>품질 검사</strong>: 상품의 외관, 기능, 성능 확인</li>
              <li>• <strong>수량 확인</strong>: 주문 수량과 실제 수량 일치 여부</li>
              <li>• <strong>파손 검사</strong>: 운송 중 파손 여부 확인 및 사진 촬영</li>
              <li>• <strong>라벨 검사</strong>: 바코드, QR코드, 상품 라벨 정확성 확인</li>
              <li>• <strong>불합격 처리</strong>: 불량품은 별도 보관 및 교환/반품 처리</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
