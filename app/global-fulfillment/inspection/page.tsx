'use client';

import { useState, useRef } from 'react';
import { 
  CameraIcon, 
  CheckCircleIcon,
  XCircleIcon,
  PhotoIcon,
  QrCodeIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  UserIcon,
  ClockIcon,
  ChartBarIcon,
  DocumentTextIcon,
  BellAlertIcon
} from '@heroicons/react/24/outline';
import BarcodeInput from '@/components/BarcodeInput';

interface InspectionItem {
  id: string;
  orderNumber: string;
  sku: string;
  productName: string;
  quantity: number;
  inspected: number;
  passCount: number;
  failCount: number;
  partialCount: number;
  condition: 'pending' | 'inspecting' | 'pass' | 'fail' | 'partial';
  defectType?: string[]; // 불량 유형
  photos: string[];
  notes: string;
  inspector?: string;
  inspectionTime?: Date;
  checklist?: {
    appearance: boolean; // 외관
    packaging: boolean;  // 포장
    quantity: boolean;   // 수량
    function: boolean;   // 기능
    label: boolean;      // 라벨
  };
}

interface DefectType {
  value: string;
  label: string;
  color: string;
}

const DEFECT_TYPES: DefectType[] = [
  { value: 'damaged', label: '파손', color: 'bg-red-100 text-red-700' },
  { value: 'missing', label: '누락', color: 'bg-orange-100 text-orange-700' },
  { value: 'defective', label: '불량', color: 'bg-purple-100 text-purple-700' },
  { value: 'contaminated', label: '오염', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'wrong_item', label: '오배송', color: 'bg-pink-100 text-pink-700' },
  { value: 'other', label: '기타', color: 'bg-gray-100 text-gray-700' }
];

const SAMPLE_ITEMS: InspectionItem[] = [
  {
    id: '1',
    orderNumber: 'GF-2025-0001',
    sku: 'SKU-CN-001',
    productName: '무선 이어폰',
    quantity: 50,
    inspected: 0,
    passCount: 0,
    failCount: 0,
    partialCount: 0,
    condition: 'pending',
    photos: [],
    notes: ''
  },
  {
    id: '2',
    orderNumber: 'GF-2025-0002',
    sku: 'SKU-CN-002',
    productName: '스마트워치',
    quantity: 30,
    inspected: 0,
    passCount: 0,
    failCount: 0,
    partialCount: 0,
    condition: 'pending',
    photos: [],
    notes: ''
  },
  {
    id: '3',
    orderNumber: 'GF-2025-0003',
    sku: 'SKU-CN-003',
    productName: '블루투스 스피커',
    quantity: 25,
    inspected: 0,
    passCount: 0,
    failCount: 0,
    partialCount: 0,
    condition: 'pending',
    photos: [],
    notes: ''
  },
  {
    id: '4',
    orderNumber: 'GF-2025-0004',
    sku: 'SKU-CN-004',
    productName: '노트북 거치대',
    quantity: 40,
    inspected: 0,
    passCount: 0,
    failCount: 0,
    partialCount: 0,
    condition: 'pending',
    photos: [],
    notes: ''
  },
  {
    id: '5',
    orderNumber: 'GF-2025-0005',
    sku: 'SKU-CN-005',
    productName: '무선 충전기',
    quantity: 35,
    inspected: 0,
    passCount: 0,
    failCount: 0,
    partialCount: 0,
    condition: 'pending',
    photos: [],
    notes: ''
  }
];

export default function InspectionPage() {
  const [items, setItems] = useState<InspectionItem[]>(SAMPLE_ITEMS);
  const [selectedItem, setSelectedItem] = useState<InspectionItem | null>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [scanMode, setScanMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [currentInspector] = useState('검수자A');
  const [selectedDefects, setSelectedDefects] = useState<string[]>([]);
  const [checklist, setChecklist] = useState({
    appearance: false,
    packaging: false,
    quantity: false,
    function: false,
    label: false
  });
  const [customNotes, setCustomNotes] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 바코드 스캔 처리
  const handleBarcodeScan = (barcode: string) => {
    const item = items.find(
      i => i.orderNumber === barcode || i.sku === barcode
    );

    if (!item) {
      alert(`❌ 주문을 찾을 수 없습니다: ${barcode}`);
      return;
    }

    if (item.condition !== 'pending') {
      alert(`⚠️ 이미 검사가 완료된 주문입니다.`);
      return;
    }

    setSelectedItem(item);
    setItems(items.map(i => 
      i.id === item.id ? { ...i, condition: 'inspecting' } : i
    ));
  };

  // 사진 업로드
  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setUploadedPhotos(prev => [...prev, result]);
      };
      reader.readAsDataURL(file);
    });
  };

  // 검사 완료
  const handleInspectionComplete = (
    itemId: string, 
    condition: 'pass' | 'fail' | 'partial'
  ) => {
    if (!selectedItem) return;

    // 체크리스트 확인
    const checklistComplete = Object.values(checklist).every(v => v === true);
    if (!checklistComplete) {
      alert('⚠️ 검사 항목을 모두 체크해주세요.');
      return;
    }

    // 불량/일부 불량인 경우 불량 유형 확인
    if ((condition === 'fail' || condition === 'partial') && selectedDefects.length === 0) {
      alert('⚠️ 불량 유형을 선택해주세요.');
      return;
    }

    // 사진 확인
    if (uploadedPhotos.length === 0) {
      const confirmed = confirm('사진이 없습니다. 계속하시겠습니까?');
      if (!confirmed) return;
    }

    setItems(items.map(item => 
      item.id === itemId 
        ? { 
            ...item, 
            condition, 
            inspected: item.quantity,
            passCount: condition === 'pass' ? item.quantity : (condition === 'partial' ? Math.floor(item.quantity * 0.7) : 0),
            failCount: condition === 'fail' ? item.quantity : (condition === 'partial' ? Math.floor(item.quantity * 0.3) : 0),
            partialCount: condition === 'partial' ? item.quantity : 0,
            photos: uploadedPhotos, 
            notes: customNotes,
            inspector: currentInspector,
            inspectionTime: new Date(),
            defectType: selectedDefects,
            checklist: { ...checklist }
          }
        : item
    ));

    // 리셋
    setSelectedItem(null);
    setUploadedPhotos([]);
    setSelectedDefects([]);
    setChecklist({
      appearance: false,
      packaging: false,
      quantity: false,
      function: false,
      label: false
    });
    setCustomNotes('');

    // 알림
    alert(`✅ 검사가 완료되었습니다!\n결과: ${condition === 'pass' ? '정상' : condition === 'fail' ? '불량' : '일부 문제'}`);
  };

  // 불량품 처리
  const handleDefectiveAction = (itemId: string, action: 'isolate' | 'dispose' | 'exchange') => {
    const actionLabels = {
      isolate: '격리재고로 이동',
      dispose: '폐기 처리',
      exchange: '교환 요청'
    };
    
    const confirmed = confirm(`${actionLabels[action]}하시겠습니까?`);
    if (confirmed) {
      alert(`✅ ${actionLabels[action]} 완료`);
    }
  };

  // 통계
  const stats = {
    total: items.length,
    pending: items.filter(i => i.condition === 'pending').length,
    inspecting: items.filter(i => i.condition === 'inspecting').length,
    pass: items.filter(i => i.condition === 'pass').length,
    fail: items.filter(i => i.condition === 'fail').length,
    partial: items.filter(i => i.condition === 'partial').length,
    totalQuantity: items.reduce((sum, i) => sum + i.quantity, 0),
    inspectedQuantity: items.reduce((sum, i) => sum + i.inspected, 0),
    passRate: items.filter(i => i.condition !== 'pending').length > 0
      ? (items.filter(i => i.condition === 'pass').length / items.filter(i => i.condition !== 'pending').length) * 100
      : 0
  };

  // 불량 유형별 통계
  const defectStats = DEFECT_TYPES.map(type => ({
    ...type,
    count: items.filter(i => i.defectType?.includes(type.value)).length
  })).filter(d => d.count > 0);

  // 필터링
  const filteredItems = items.filter(item => {
    const matchSearch = searchTerm === '' ||
      item.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.productName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchFilter = filterStatus === 'all' || item.condition === filterStatus;

    return matchSearch && matchFilter;
  });

  // Excel 내보내기
  const exportToExcel = () => {
    const csv = [
      ['주문번호', 'SKU', '상품명', '수량', '검사수량', '합격', '불합격', '상태', '불량유형', '검사자', '검사시간', '메모'].join(','),
      ...items.map(i => [
        i.orderNumber,
        i.sku,
        i.productName,
        i.quantity,
        i.inspected,
        i.passCount,
        i.failCount,
        i.condition,
        i.defectType?.join(';') || '-',
        i.inspector || '-',
        i.inspectionTime ? i.inspectionTime.toLocaleString('ko-KR') : '-',
        i.notes || '-'
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `검사결과_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">검증 / 검사 (Inspection)</h1>
          <p className="text-sm text-gray-600 mt-1">
            출고 전 제품 이상 여부를 확인하고 검수 사진을 업로드합니다
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToExcel}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
            Excel 내보내기
          </button>
          <button
            onClick={() => setScanMode(!scanMode)}
            className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
              scanMode
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100'
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
          <div className="text-xs text-gray-500 mt-1">{stats.totalQuantity}개</div>
        </div>
        <div className="bg-gray-50 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">대기</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{stats.pending}</div>
          <div className="text-xs text-gray-500 mt-1">⚪ Pending</div>
        </div>
        <div className="bg-blue-50 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">진행중</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">{stats.inspecting}</div>
          <div className="text-xs text-blue-600 mt-1">🔵 Inspecting</div>
        </div>
        <div className="bg-green-50 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">합격</div>
          <div className="text-2xl font-bold text-green-600 mt-1">{stats.pass}</div>
          <div className="text-xs text-green-600 mt-1">🟢 Pass</div>
        </div>
        <div className="bg-red-50 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">불합격</div>
          <div className="text-2xl font-bold text-red-600 mt-1">{stats.fail}</div>
          <div className="text-xs text-red-600 mt-1">🔴 Fail</div>
        </div>
        <div className="bg-yellow-50 rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">일부문제</div>
          <div className="text-2xl font-bold text-yellow-600 mt-1">{stats.partial}</div>
          <div className="text-xs text-yellow-600 mt-1">🟡 Partial</div>
        </div>
      </div>

      {/* 진행률 및 합격률 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">전체 진행률</span>
            <span className="text-sm font-semibold text-gray-900">
              {stats.inspectedQuantity} / {stats.totalQuantity} ({Math.round((stats.inspectedQuantity / stats.totalQuantity) * 100)}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${(stats.inspectedQuantity / stats.totalQuantity) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">합격률</span>
            <span className={`text-sm font-semibold ${
              stats.passRate >= 95 ? 'text-green-600' : 
              stats.passRate >= 80 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {stats.passRate.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${
                stats.passRate >= 95 ? 'bg-green-600' : 
                stats.passRate >= 80 ? 'bg-yellow-500' : 'bg-red-600'
              }`}
              style={{ width: `${stats.passRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* 바코드 스캔 모드 */}
      {scanMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <QrCodeIcon className="h-6 w-6 text-blue-600" />
            바코드 스캔 모드
          </h3>
          <BarcodeInput onScan={handleBarcodeScan} />
        </div>
      )}

      {/* 불량 유형별 통계 */}
      {defectStats.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-orange-600" />
            불량 유형별 통계
          </h3>
          <div className="flex gap-2 flex-wrap">
            {defectStats.map(stat => (
              <div key={stat.value} className={`px-3 py-2 rounded-lg ${stat.color}`}>
                <span className="font-semibold">{stat.label}</span>
                <span className="ml-2">{stat.count}건</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 검색 및 필터 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="주문번호, SKU, 상품명 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">전체 상태</option>
            <option value="pending">대기</option>
            <option value="inspecting">진행중</option>
            <option value="pass">합격</option>
            <option value="fail">불합격</option>
            <option value="partial">일부문제</option>
          </select>
        </div>
      </div>

      {/* 검사 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 대기/진행 목록 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ClipboardDocumentListIcon className="h-5 w-5" />
              검사 대기 목록
            </h2>
            <p className="text-xs text-gray-600 mt-1">
              검사자: {currentInspector}
            </p>
          </div>
          <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
            {filteredItems.filter(i => i.condition === 'pending' || i.condition === 'inspecting').length === 0 && (
              <div className="text-center py-12 text-gray-500">
                검사 대기 중인 항목이 없습니다
              </div>
            )}
            
            {filteredItems.filter(i => i.condition === 'pending' || i.condition === 'inspecting').map((item) => (
              <div
                key={item.id}
                className={`p-4 hover:bg-gray-50 cursor-pointer transition ${
                  selectedItem?.id === item.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                }`}
                onClick={() => {
                  setSelectedItem(item);
                  if (item.condition === 'pending') {
                    setItems(items.map(i => 
                      i.id === item.id ? { ...i, condition: 'inspecting' } : i
                    ));
                  }
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="font-semibold text-gray-900">{item.productName}</div>
                      <InspectionStatusBadge condition={item.condition} />
                    </div>
                    <div className="text-sm text-gray-600">
                      {item.orderNumber} | <span className="font-mono text-blue-600">{item.sku}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-blue-600">{item.quantity}</div>
                    <div className="text-xs text-gray-500">개</div>
                  </div>
                </div>
                {selectedItem?.id === item.id && (
                  <div className="mt-2 px-3 py-2 bg-blue-100 rounded text-sm text-blue-700">
                    ✓ 검사 중
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 검사 폼 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">검사 수행</h2>
          </div>
          
          <div className="p-4 max-h-[600px] overflow-y-auto">
            {selectedItem ? (
              <div className="space-y-4">
                {/* 상품 정보 */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="font-semibold text-blue-900">{selectedItem.productName}</div>
                  <div className="text-sm text-blue-700 mt-1">
                    {selectedItem.orderNumber} | {selectedItem.sku}
                  </div>
                  <div className="text-sm text-blue-700 mt-1">
                    수량: <span className="font-bold">{selectedItem.quantity}개</span>
                  </div>
                </div>

                {/* 검사 체크리스트 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    검사 항목 체크리스트 *
                  </label>
                  <div className="space-y-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
                    {[
                      { key: 'appearance', label: '외관 상태', icon: '👀' },
                      { key: 'packaging', label: '포장 상태', icon: '📦' },
                      { key: 'quantity', label: '수량 확인', icon: '🔢' },
                      { key: 'function', label: '기능 확인', icon: '⚙️' },
                      { key: 'label', label: '라벨 확인', icon: '🏷️' }
                    ].map(item => (
                      <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checklist[item.key as keyof typeof checklist]}
                          onChange={(e) => setChecklist({ ...checklist, [item.key]: e.target.checked })}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm">
                          {item.icon} {item.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 사진 업로드 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    검수 사진 업로드
                  </label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 cursor-pointer transition"
                  >
                    <CameraIcon className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">클릭하여 사진 업로드</p>
                    <p className="text-xs text-gray-500 mt-1">여러 장 선택 가능</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </div>

                {/* 업로드된 사진 미리보기 */}
                {uploadedPhotos.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      업로드된 사진 ({uploadedPhotos.length})
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {uploadedPhotos.map((photo, idx) => (
                        <div key={idx} className="relative aspect-square">
                          <img
                            src={photo}
                            alt={`검수 사진 ${idx + 1}`}
                            className="w-full h-full object-cover rounded-lg border border-gray-200"
                          />
                          <button
                            onClick={() => setUploadedPhotos(uploadedPhotos.filter((_, i) => i !== idx))}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                          >
                            <XCircleIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 불량 유형 선택 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    불량 유형 (해당되는 경우)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DEFECT_TYPES.map(type => (
                      <button
                        key={type.value}
                        onClick={() => {
                          if (selectedDefects.includes(type.value)) {
                            setSelectedDefects(selectedDefects.filter(d => d !== type.value));
                          } else {
                            setSelectedDefects([...selectedDefects, type.value]);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                          selectedDefects.includes(type.value)
                            ? type.color + ' ring-2 ring-offset-1 ring-gray-400'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 메모 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    검사 메모
                  </label>
                  <textarea
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    placeholder="특이사항이나 메모를 입력하세요..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                  />
                </div>

                {/* 검사 결과 선택 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    검사 결과 *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleInspectionComplete(selectedItem.id, 'pass')}
                      className="px-4 py-3 bg-green-50 text-green-700 border-2 border-green-200 rounded-lg hover:bg-green-100 transition font-medium"
                    >
                      ✓ 정상
                    </button>
                    <button
                      onClick={() => handleInspectionComplete(selectedItem.id, 'partial')}
                      className="px-4 py-3 bg-yellow-50 text-yellow-700 border-2 border-yellow-200 rounded-lg hover:bg-yellow-100 transition font-medium"
                    >
                      ⚠ 일부
                    </button>
                    <button
                      onClick={() => handleInspectionComplete(selectedItem.id, 'fail')}
                      className="px-4 py-3 bg-red-50 text-red-700 border-2 border-red-200 rounded-lg hover:bg-red-100 transition font-medium"
                    >
                      ✗ 불량
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedItem(null);
                    setUploadedPhotos([]);
                    setSelectedDefects([]);
                    setChecklist({
                      appearance: false,
                      packaging: false,
                      quantity: false,
                      function: false,
                      label: false
                    });
                    setCustomNotes('');
                  }}
                  className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                >
                  취소
                </button>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <ClipboardDocumentListIcon className="h-16 w-16 mx-auto mb-3 opacity-30" />
                <p className="text-sm">검사할 항목을 선택하세요</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 완료된 검사 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CheckCircleIcon className="h-5 w-5 text-green-600" />
            검사 완료 ({items.filter(i => i.condition !== 'pending' && i.condition !== 'inspecting').length})
          </h2>
        </div>
        <div className="divide-y divide-gray-200 max-h-[400px] overflow-y-auto">
          {items.filter(i => i.condition !== 'pending' && i.condition !== 'inspecting').length === 0 && (
            <div className="text-center py-12 text-gray-500">
              완료된 검사가 없습니다
            </div>
          )}
          
          {items.filter(i => i.condition !== 'pending' && i.condition !== 'inspecting').map((item) => (
            <div key={item.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="font-semibold text-gray-900">{item.productName}</div>
                    <InspectionStatusBadge condition={item.condition} />
                    {item.defectType && item.defectType.length > 0 && (
                      <div className="flex gap-1">
                        {item.defectType.map(dt => {
                          const defect = DEFECT_TYPES.find(d => d.value === dt);
                          return defect ? (
                            <span key={dt} className={`px-2 py-0.5 rounded text-xs ${defect.color}`}>
                              {defect.label}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 mb-1">
                    {item.orderNumber} | {item.sku}
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    수량: {item.inspected} / {item.quantity} | 합격: {item.passCount} | 불합격: {item.failCount}
                  </div>
                  {item.notes && (
                    <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded mb-2">
                      💬 {item.notes}
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <UserIcon className="h-3 w-3" />
                      {item.inspector}
                    </span>
                    <span className="flex items-center gap-1">
                      <ClockIcon className="h-3 w-3" />
                      {item.inspectionTime?.toLocaleString('ko-KR')}
                    </span>
                  </div>
                  
                  {/* 불량품 처리 옵션 */}
                  {(item.condition === 'fail' || item.condition === 'partial') && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleDefectiveAction(item.id, 'isolate')}
                        className="px-3 py-1 bg-orange-50 text-orange-600 rounded text-xs hover:bg-orange-100 transition"
                      >
                        격리재고
                      </button>
                      <button
                        onClick={() => handleDefectiveAction(item.id, 'dispose')}
                        className="px-3 py-1 bg-red-50 text-red-600 rounded text-xs hover:bg-red-100 transition"
                      >
                        폐기
                      </button>
                      <button
                        onClick={() => handleDefectiveAction(item.id, 'exchange')}
                        className="px-3 py-1 bg-blue-50 text-blue-600 rounded text-xs hover:bg-blue-100 transition"
                      >
                        교환요청
                      </button>
                    </div>
                  )}
                </div>
                
                {/* 사진 미리보기 */}
                {item.photos.length > 0 && (
                  <div className="flex gap-1 ml-4">
                    {item.photos.slice(0, 3).map((photo, idx) => (
                      <img
                        key={idx}
                        src={photo}
                        alt={`검수 사진`}
                        className="w-16 h-16 object-cover rounded border border-gray-200"
                      />
                    ))}
                    {item.photos.length > 3 && (
                      <div className="w-16 h-16 bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-gray-600 text-sm">
                        +{item.photos.length - 3}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 가이드 */}
      <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-6">
        <h3 className="font-semibold text-cyan-900 mb-3">💡 검수 가이드</h3>
        <div className="grid grid-cols-2 gap-4">
          <ul className="space-y-2 text-sm text-cyan-800">
            <li>• <strong>체크리스트</strong>: 5가지 항목을 모두 체크해야 검사 완료</li>
            <li>• <strong>사진 필수</strong>: 모든 상품의 상태를 사진으로 기록</li>
            <li>• <strong>불량 유형</strong>: 불량/일부 불량 시 유형 선택 필수</li>
            <li>• <strong>바코드 스캔</strong>: 주문번호/SKU 스캔으로 빠른 검사</li>
          </ul>
          <ul className="space-y-2 text-sm text-cyan-800">
            <li>• <strong>불량품 처리</strong>: 격리/폐기/교환 중 선택</li>
            <li>• <strong>고객 알림</strong>: 불량 발견 시 자동 알림 전송</li>
            <li>• <strong>검사 이력</strong>: 검사자, 시간, 결과 모두 기록</li>
            <li>• <strong>합격률 관리</strong>: 95% 이상 합격률 유지 목표</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function InspectionStatusBadge({ condition }: { condition: string }) {
  const classes: any = {
    pending: 'bg-gray-100 text-gray-700',
    inspecting: 'bg-blue-100 text-blue-700',
    pass: 'bg-green-100 text-green-700',
    fail: 'bg-red-100 text-red-700',
    partial: 'bg-yellow-100 text-yellow-700'
  };

  const labels: any = {
    pending: '⚪ 대기',
    inspecting: '🔵 진행중',
    pass: '🟢 정상',
    fail: '🔴 불량',
    partial: '🟡 일부문제'
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${classes[condition]}`}>
      {labels[condition]}
    </span>
  );
}
