'use client';

import { useState, useRef } from 'react';
import { 
  ArrowUpTrayIcon, 
  DocumentIcon,
  CheckCircleIcon,
  XCircleIcon,
  QrCodeIcon,
  PencilIcon,
  PrinterIcon,
  TruckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import * as XLSX from 'xlsx';
import BarcodeInput from '@/components/BarcodeInput';
import Header from '@/components/Header';
import { useLayout } from '@/components/LayoutWrapper';
import { showError } from '@/lib/toast';

interface ImportRow {
  id: string;
  platformOrderId: string;
  customerName: string;
  sku: string;
  productName: string;
  quantity: number;
  destinationCountry: string;
  shippingMethod: string;
  carrier?: string; // 물류사
  trackingNumber?: string; // 운송장 번호
  receiverName?: string; // 수취인
  receiverPhone?: string;
  receiverAddress?: string;
  receiverCity?: string;
  receiverZipCode?: string;
  notes?: string;
  status?: 'success' | 'error' | 'pending';
  message?: string;
}

// 물류사 목록
const CARRIERS = [
  { value: 'hanjin', label: '한진택배', icon: '🚚' },
  { value: 'cj', label: 'CJ대한통운', icon: '📦' },
  { value: 'lotte', label: '롯데택배', icon: '🎁' },
  { value: 'shunfeng', label: '顺丰速运 (SF Express)', icon: '⚡' },
  { value: 'ems', label: 'EMS 우편', icon: '✈️' },
];

export default function DropShippingPage() {
  const { toggleSidebar } = useLayout();
  const [importData, setImportData] = useState<ImportRow[]>([]);
  const [processing, setProcessing] = useState(false);
  const [scanMode, setScanMode] = useState(false);
  const [scannedItems, setScannedItems] = useState<string[]>([]);
  const [editingOrder, setEditingOrder] = useState<ImportRow | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Excel/CSV 파일 업로드
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        // 데이터 매핑
        const mappedData: ImportRow[] = jsonData.map((row, idx) => ({
          id: `ORD-${Date.now()}-${idx}`,
          platformOrderId: row['주문번호'] || row['订单号'] || row['Order ID'] || '',
          customerName: row['고객사'] || row['客户'] || row['Customer'] || '',
          sku: row['SKU'] || row['商品编号'] || '',
          productName: row['상품명'] || row['商品名'] || row['Product'] || '',
          quantity: parseInt(row['수량'] || row['数量'] || row['Quantity'] || '0'),
          destinationCountry: row['목적국가'] || row['目的国'] || row['Country'] || 'KR',
          shippingMethod: row['배송방법'] || row['运输方式'] || row['Shipping'] || 'air',
          receiverName: row['수취인'] || row['收件人'] || row['Receiver Name'] || '',
          receiverPhone: row['전화번호'] || row['电话'] || row['Phone'] || '',
          receiverAddress: row['주소'] || row['地址'] || row['Address'] || '',
          receiverCity: row['도시'] || row['城市'] || row['City'] || '',
          receiverZipCode: row['우편번호'] || row['邮编'] || row['Zip'] || '',
          carrier: row['물류사'] || row['快递公司'] || row['Carrier'] || '',
          notes: row['비고'] || row['备注'] || row['Notes'] || '',
          status: 'pending'
        }));

        setImportData(mappedData);
      } catch (error) {
        console.error('파일 파싱 오류:', error);
        showError('파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsBinaryString(file);
  };

  // 주문 편집
  const handleEditOrder = (order: ImportRow) => {
    setEditingOrder({ ...order });
    setShowEditModal(true);
  };

  // 편집 저장
  const handleSaveEdit = () => {
    if (!editingOrder) return;

    setImportData(prev => 
      prev.map(order => 
        order.id === editingOrder.id ? editingOrder : order
      )
    );
    setShowEditModal(false);
    setEditingOrder(null);
  };

  // 데이터 처리 (입고)
  const handleProcessOrders = async () => {
    setProcessing(true);

    // TODO: 실제 API 호출
    // const response = await fetch('/api/global-fulfillment/drop-shipping/import', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ orders: importData })
    // });

    // 임시: 시뮬레이션
    await new Promise(resolve => setTimeout(resolve, 2000));

    const updatedData = importData.map(row => ({
      ...row,
      status: Math.random() > 0.1 ? 'success' : 'error',
      message: Math.random() > 0.1 ? '입고 완료' : 'SKU를 찾을 수 없습니다',
      trackingNumber: Math.random() > 0.1 ? `TRK-${Math.floor(Math.random() * 1000000)}` : undefined
    })) as ImportRow[];

    setImportData(updatedData);
    setProcessing(false);
  };

  // 바코드 스캔 처리
  const handleBarcodeScan = (barcode: string) => {
    if (scannedItems.includes(barcode)) {
      showError('이미 스캔된 항목입니다.');
      return;
    }

    setScannedItems([...scannedItems, barcode]);

    // TODO: 실제 재고 차감 API 호출
    console.log('바코드 스캔:', barcode);
  };

  // 패킹 리스트 출력
  const handlePrintPackingList = (order?: ImportRow) => {
    const ordersToPrint = order ? [order] : importData.filter(o => selectedOrders.includes(o.id));
    
    if (ordersToPrint.length === 0) {
      showError('출력할 주문을 선택하세요.');
      return;
    }

    // 새 창에서 인쇄용 페이지 열기
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = generatePackingListHTML(ordersToPrint);
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  // 패킹 리스트 HTML 생성
  const generatePackingListHTML = (orders: ImportRow[]) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Packing List</title>
        <style>
          @page { size: A4; margin: 20mm; }
          body { font-family: 'Noto Sans KR', Arial, sans-serif; }
          .header { text-align: center; margin-bottom: 30px; }
          .barcode { font-family: 'Libre Barcode 128 Text', monospace; font-size: 48px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #000; padding: 8px; text-align: left; }
          th { background-color: #f0f0f0; }
          .info { margin-bottom: 20px; }
          .page-break { page-break-after: always; }
        </style>
      </head>
      <body>
        ${orders.map((order, idx) => `
          <div ${idx < orders.length - 1 ? 'class="page-break"' : ''}>
            <div class="header">
              <div class="barcode">${order.id}</div>
              <h2>Packing List (Parcel Outbound 一件代发)</h2>
              <p><strong>Warehouse:</strong> RAPID창고충운창</p>
              <p><strong>Total SKU:</strong> 1 | <strong>Total Picks:</strong> ${order.quantity}</p>
              <p><strong>Print Time:</strong> ${new Date().toLocaleString('ko-KR')}</p>
            </div>
            
            <div class="info">
              <p><strong>주문번호:</strong> ${order.platformOrderId}</p>
              <p><strong>고객사:</strong> ${order.customerName}</p>
              <p><strong>물류사:</strong> ${order.carrier ? CARRIERS.find(c => c.value === order.carrier)?.label : '-'}</p>
              <p><strong>운송장번호:</strong> ${order.trackingNumber || '-'}</p>
            </div>

            <table>
              <thead>
                <tr>
                  <th>NO.</th>
                  <th>SKU</th>
                  <th>Barcode</th>
                  <th>Item Name</th>
                  <th>QTY</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1</td>
                  <td>${order.sku}</td>
                  <td style="font-family: monospace;">${order.sku}</td>
                  <td>${order.productName}</td>
                  <td>${order.quantity}</td>
                </tr>
              </tbody>
            </table>

            <div style="margin-top: 30px;">
              <h3>수취인 정보</h3>
              <p><strong>이름:</strong> ${order.receiverName || '-'}</p>
              <p><strong>전화:</strong> ${order.receiverPhone || '-'}</p>
              <p><strong>주소:</strong> ${order.receiverAddress || '-'}</p>
              <p><strong>도시:</strong> ${order.receiverCity || '-'} | <strong>우편번호:</strong> ${order.receiverZipCode || '-'}</p>
            </div>

            ${order.notes ? `<div style="margin-top: 20px;"><strong>비고:</strong> ${order.notes}</div>` : ''}
          </div>
        `).join('')}
      </body>
      </html>
    `;
  };

  // 다운로드 템플릿
  const downloadTemplate = () => {
    const template = [
      {
        '주문번호': 'TB-20250101-001',
        '고객사': '淘宝精品店',
        'SKU': 'SKU-CN-001',
        '상품명': '무선 이어폰',
        '수량': 50,
        '목적국가': 'KR',
        '배송방법': 'air',
        '수취인': '홍길동',
        '전화번호': '010-1234-5678',
        '주소': '서울특별시 강남구 테헤란로 123',
        '도시': '서울',
        '우편번호': '06234',
        '물류사': 'hanjin',
        '비고': '급송'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'drop_shipping_template.xlsx');
  };

  // 선택 토글
  const toggleSelectOrder = (orderId: string) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  return (
    <div className="flex flex-col h-screen">
      <Header title="📦 드롭시핑" onMenuClick={toggleSidebar} />
      
      <main className="flex-1 overflow-y-auto bg-gray-50 p-4 lg:p-6">
        <div className="space-y-6">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">드롭시핑 (Drop Shipping)</h1>
              <p className="text-sm text-gray-600 mt-1">
                해외 플랫폼 주문 데이터를 업로드하고 국내 창고 입고를 관리합니다
              </p>
            </div>
        <div className="flex gap-3">
          <button
            onClick={downloadTemplate}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
          >
            📥 템플릿 다운로드
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
          >
            <ArrowUpTrayIcon className="h-5 w-5" />
            Excel/CSV 업로드
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

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* 바코드 스캔 모드 */}
      {scanMode && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <QrCodeIcon className="h-6 w-6 text-green-600" />
            바코드/QR 스캔 모드
          </h3>
          <BarcodeInput onScan={handleBarcodeScan} />
          
          {scannedItems.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">
                스캔된 항목: {scannedItems.length}개
              </p>
              <div className="flex flex-wrap gap-2">
                {scannedItems.map((item, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-white border border-green-300 rounded-full text-sm"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 업로드된 데이터 테이블 */}
      {importData.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">업로드된 주문 데이터</h2>
              <p className="text-sm text-gray-600">
                총 {importData.length}건 
                {importData.filter(d => d.status === 'success').length > 0 && 
                  ` | 성공: ${importData.filter(d => d.status === 'success').length}건`
                }
                {importData.filter(d => d.status === 'error').length > 0 && 
                  ` | 실패: ${importData.filter(d => d.status === 'error').length}건`
                }
                {selectedOrders.length > 0 && ` | 선택: ${selectedOrders.length}건`}
              </p>
            </div>
            <div className="flex gap-2">
              {selectedOrders.length > 0 && (
                <button
                  onClick={() => handlePrintPackingList()}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
                >
                  <PrinterIcon className="h-5 w-5" />
                  패킹 리스트 출력 ({selectedOrders.length})
                </button>
              )}
              <button
                onClick={handleProcessOrders}
                disabled={processing || importData.every(d => d.status !== 'pending')}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {processing ? '처리 중...' : '일괄 입고 처리'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input 
                      type="checkbox" 
                      checked={selectedOrders.length === importData.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedOrders(importData.map(o => o.id));
                        } else {
                          setSelectedOrders([]);
                        }
                      }}
                      className="rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">주문번호</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">고객사</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상품명</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">수량</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">물류사</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">운송장</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">수취인</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {importData.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input 
                        type="checkbox"
                        checked={selectedOrders.includes(row.id)}
                        onChange={() => toggleSelectOrder(row.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      {row.status === 'success' && (
                        <CheckCircleIcon className="h-5 w-5 text-green-600" title={row.message} />
                      )}
                      {row.status === 'error' && (
                        <XCircleIcon className="h-5 w-5 text-red-600" title={row.message} />
                      )}
                      {row.status === 'pending' && (
                        <div className="h-4 w-4 bg-gray-300 rounded-full animate-pulse" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">{row.platformOrderId}</td>
                    <td className="px-4 py-3 text-sm">{row.customerName}</td>
                    <td className="px-4 py-3 text-sm font-mono text-blue-600">{row.sku}</td>
                    <td className="px-4 py-3 text-sm">{row.productName}</td>
                    <td className="px-4 py-3 text-sm text-center font-semibold">{row.quantity}</td>
                    <td className="px-4 py-3 text-sm">
                      {row.carrier ? (
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-semibold">
                          {CARRIERS.find(c => c.value === row.carrier)?.icon} {CARRIERS.find(c => c.value === row.carrier)?.label}
                        </span>
                      ) : (
                        <span className="text-gray-400">미지정</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono">
                      {row.trackingNumber || <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {row.receiverName || <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditOrder(row)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="편집"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handlePrintPackingList(row)}
                          className="p-1 text-purple-600 hover:bg-purple-50 rounded"
                          title="패킹 리스트"
                        >
                          <PrinterIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 빈 상태 */}
      {importData.length === 0 && !scanMode && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <DocumentIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">주문 데이터를 업로드하세요</h3>
          <p className="text-sm text-gray-600 mb-6">
            Excel 또는 CSV 파일로 주문 데이터를 일괄 업로드하거나<br />
            바코드 스캔을 통해 개별 입고 처리가 가능합니다
          </p>
          <div className="flex justify-center gap-4">
            <button
              onClick={downloadTemplate}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              템플릿 다운로드
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              파일 업로드
            </button>
          </div>
        </div>
      )}

      {/* 사용 가이드 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-3">💡 사용 가이드</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>• <strong>템플릿 다운로드</strong>: 표준 양식을 다운로드하여 데이터를 입력하세요</li>
          <li>• <strong>물류사 연동</strong>: 한진, CJ, 顺丰 등 주요 물류사를 선택하고 운송장 번호를 관리합니다</li>
          <li>• <strong>주문 편집</strong>: 각 주문을 클릭하여 수취인 정보, 물류사 등을 수정할 수 있습니다</li>
          <li>• <strong>패킹 리스트</strong>: 선택한 주문의 패킹 리스트를 바코드와 함께 출력합니다</li>
          <li>• <strong>일괄 처리</strong>: 여러 주문을 한 번에 입고 처리하고 재고를 자동 차감합니다</li>
        </ul>
      </div>

      {/* 편집 모달 */}
      {showEditModal && editingOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-xl font-bold">주문 편집</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingOrder(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* 기본 정보 */}
              <div>
                <h3 className="text-lg font-semibold mb-4">기본 정보</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      주문번호
                    </label>
                    <input
                      type="text"
                      value={editingOrder.platformOrderId}
                      onChange={(e) => setEditingOrder({ ...editingOrder, platformOrderId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      고객사
                    </label>
                    <input
                      type="text"
                      value={editingOrder.customerName}
                      onChange={(e) => setEditingOrder({ ...editingOrder, customerName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SKU
                    </label>
                    <input
                      type="text"
                      value={editingOrder.sku}
                      onChange={(e) => setEditingOrder({ ...editingOrder, sku: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      수량
                    </label>
                    <input
                      type="number"
                      value={editingOrder.quantity}
                      onChange={(e) => setEditingOrder({ ...editingOrder, quantity: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      상품명
                    </label>
                    <input
                      type="text"
                      value={editingOrder.productName}
                      onChange={(e) => setEditingOrder({ ...editingOrder, productName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* 물류 정보 */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <TruckIcon className="h-5 w-5" />
                  물류 정보
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      물류사 *
                    </label>
                    <select
                      value={editingOrder.carrier || ''}
                      onChange={(e) => setEditingOrder({ ...editingOrder, carrier: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">선택하세요</option>
                      {CARRIERS.map(carrier => (
                        <option key={carrier.value} value={carrier.value}>
                          {carrier.icon} {carrier.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      운송장 번호
                    </label>
                    <input
                      type="text"
                      value={editingOrder.trackingNumber || ''}
                      onChange={(e) => setEditingOrder({ ...editingOrder, trackingNumber: e.target.value })}
                      placeholder="자동 생성 또는 수동 입력"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* 수취인 정보 */}
              <div>
                <h3 className="text-lg font-semibold mb-4">수취인 정보</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      수취인 이름 *
                    </label>
                    <input
                      type="text"
                      value={editingOrder.receiverName || ''}
                      onChange={(e) => setEditingOrder({ ...editingOrder, receiverName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      전화번호 *
                    </label>
                    <input
                      type="text"
                      value={editingOrder.receiverPhone || ''}
                      onChange={(e) => setEditingOrder({ ...editingOrder, receiverPhone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      주소 *
                    </label>
                    <input
                      type="text"
                      value={editingOrder.receiverAddress || ''}
                      onChange={(e) => setEditingOrder({ ...editingOrder, receiverAddress: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      도시
                    </label>
                    <input
                      type="text"
                      value={editingOrder.receiverCity || ''}
                      onChange={(e) => setEditingOrder({ ...editingOrder, receiverCity: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      우편번호
                    </label>
                    <input
                      type="text"
                      value={editingOrder.receiverZipCode || ''}
                      onChange={(e) => setEditingOrder({ ...editingOrder, receiverZipCode: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* 비고 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  비고
                </label>
                <textarea
                  value={editingOrder.notes || ''}
                  onChange={(e) => setEditingOrder({ ...editingOrder, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="특이사항을 입력하세요"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3 sticky bottom-0 bg-white">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingOrder(null);
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                취소
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      </main>
    </div>
  );
}
