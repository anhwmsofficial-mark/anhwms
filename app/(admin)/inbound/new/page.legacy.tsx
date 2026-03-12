'use client';
// DO NOT EDIT (baseline)

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { createInboundPlan } from '@/app/actions/inbound';
import ExcelUpload from '@/components/ExcelUpload';
import BarcodeScanner from '@/components/BarcodeScanner';
import { searchProducts, type ProductSearchItem, type ProductBarcodeItem } from '@/app/actions/product';
import NumberInput from '@/components/inputs/NumberInput';
import { showError } from '@/lib/toast';

interface ClientOption {
  id: string;
  name: string;
}

interface WarehouseOption {
  id: string;
  name: string;
}

interface ManagerOption {
  id: string;
  name: string;
}

function getListFromApiResponse<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (
    payload &&
    typeof payload === 'object' &&
    'data' in payload &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: T[] }).data;
  }
  if (
    payload &&
    typeof payload === 'object' &&
    'data' in payload &&
    (payload as { data?: unknown }).data &&
    typeof (payload as { data?: unknown }).data === 'object' &&
    'data' in ((payload as { data: { data?: unknown } }).data) &&
    Array.isArray((payload as { data: { data?: unknown } }).data.data)
  ) {
    return (payload as { data: { data: T[] } }).data.data;
  }
  return [];
}

interface ExcelInboundRow {
  product_sku: string;
  product_name: string;
  product_category: string;
  product_barcode: string;
  expected_qty: number;
  box_count: number | string;
  pallet_text: string;
  mfg_date: string;
  expiry_date: string;
  line_notes: string;
}

interface InboundLine {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  barcode_primary: string;
  barcode_type_primary: string;
  barcodes: ProductBarcodeItem[];
  box_count: number | string;
  pallet_text: string;
  expected_qty: number;
  mfg_date: string;
  expiry_date: string;
  line_notes: string;
  notes: string;
}

const createLineId = () => `${Date.now()}-${Math.random()}`;

function createEmptyLine(): InboundLine {
  return {
    id: createLineId(),
    product_id: '',
    product_name: '',
    product_sku: '',
    barcode_primary: '',
    barcode_type_primary: '',
    barcodes: [],
    box_count: '',
    pallet_text: '',
    expected_qty: 0,
    mfg_date: '',
    expiry_date: '',
    line_notes: '',
    notes: '',
  };
}

// --- Inline Product Autocomplete Component ---
function ProductAutocomplete({ 
    value, 
    clientId, 
    onSelect, 
    onChange 
}: { 
    value: string; 
    clientId: string; 
    onSelect: (product: ProductSearchItem) => void; 
    onChange: (val: string) => void;
}) {
    const [suggestions, setSuggestions] = useState<ProductSearchItem[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSearch = async (query: string) => {
        onChange(query);
        if (query.length < 2) {
            setSuggestions([]);
            return;
        }
        // Client-side debounce or simple call
        // Using a direct call for responsiveness, debounce could be added if needed
        try {
            const results = await searchProducts(query, clientId);
            setSuggestions(results || []);
            setShowSuggestions(true);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div ref={wrapperRef} className="relative w-full">
            <input
                type="text"
                className="w-full border-gray-300 rounded-lg text-sm px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="상품명/SKU 입력..."
                value={value}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
            />
            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-xl mt-1 max-h-60 overflow-y-auto">
                    {suggestions.map((product) => (
                        <div
                            key={product.id}
                            className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
                            onClick={() => {
                                onSelect(product);
                                setShowSuggestions(false);
                            }}
                        >
                            <div className="font-bold text-sm text-gray-800">{product.name}</div>
                            <div className="text-xs text-gray-500 flex justify-between">
                                <span>{product.sku}</span>
                                {product.barcode && <span>{product.barcode}</span>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function NewInboundPlanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  
  // Form States
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [plannedDate, setPlannedDate] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [inboundManager, setInboundManager] = useState('');
  const [planNotes, setPlanNotes] = useState('');

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanAccumulate] = useState(true);

  const [submitted, setSubmitted] = useState(false);

  // 입고 라인
  const [lines, setLines] = useState<InboundLine[]>([createEmptyLine()]);

  const [userOrgId, setUserOrgId] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  // 화주사가 변경되면 라인 초기화 (옵션)
  useEffect(() => {
      if (selectedClientId) {
          // Keep lines but warn? Or just clear. Clearing is safer to avoid cross-client data.
          // But user might want to keep if they selected wrong client. 
          // Let's just keep them for now, the search will filter by client anyway.
      }
  }, [selectedClientId]);

  const fetchMeta = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: orgs } = await supabase.from('org').select('id').limit(1);
      if (orgs && orgs.length > 0) setUserOrgId(orgs[0].id);
    }

    // Fetch Clients (전체 서비스 공통 API 사용)
    const clientRes = await fetch('/api/admin/customers?status=ACTIVE&limit=2000');
    const clientResult = await clientRes.json();
    if (clientRes.ok) {
        setClients(getListFromApiResponse<ClientOption>(clientResult));
    }

    // Fetch Warehouses (ANH 자체 창고만 노출)
    const { data: whData } = await supabase
        .from('warehouse')
        .select('id, name')
        .eq('status', 'ACTIVE')
        .eq('type', 'ANH_OWNED')
        .order('name');
    if (whData) {
        setWarehouses(whData);
        if (whData.length > 0) setSelectedWarehouseId(whData[0].id);
    }

    // Fetch Managers
    try {
        const res = await fetch('/api/admin/users/managers');
        const result = await res.json();
        if (res.ok) {
            setManagers(getListFromApiResponse<ManagerOption>(result));
        }
    } catch (e) {
        console.error('Failed to fetch managers', e);
    }
  }, [supabase]);

  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  // --- Line Helpers ---

  const addLine = () => {
      setLines([...lines, createEmptyLine()]);
  };

  const removeLine = (index: number) => {
      if (lines.length === 1) {
          // If only one line, just clear it
          const newLines = [...lines];
          newLines[0] = createEmptyLine();
          setLines(newLines);
          return;
      }
      const newLines = lines.filter((_, i) => i !== index);
      setLines(newLines);
  };

  const handleLineChange = <K extends keyof InboundLine>(index: number, field: K, value: InboundLine[K]) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const handleProductSelect = (index: number, product: ProductSearchItem) => {
      const newLines = [...lines];
      const barcodes = product.barcodes || [];
      const primary = barcodes.find((b) => b.is_primary)
          || barcodes.find((b) => b.barcode_type === 'RETAIL')
          || barcodes[0];

      newLines[index] = {
          ...newLines[index],
          product_id: product.id,
          product_name: product.name,
          product_sku: product.sku,
          barcode_primary: primary?.barcode || '',
          barcode_type_primary: primary?.barcode_type || '',
          barcodes: barcodes
      };
      setLines(newLines);
  };

  // --- Bulk & Scan Handlers ---

  const handleScan = async (barcode: string | null) => {
      if (!barcode) return;
      try {
          const results = await searchProducts(barcode, selectedClientId);
          const result = (results || [])[0];
          
          if (!result) {
              showError(`바코드 매칭 실패: ${barcode}`);
              return;
          }

          // Accumulate logic
          const existingIndex = lines.findIndex((l) => l.product_id === result.id);
          if (existingIndex >= 0 && scanAccumulate) {
              const newLines = [...lines];
              newLines[existingIndex].expected_qty = newLines[existingIndex].expected_qty + 1;
              setLines(newLines);
          } else {
              // Add new line with this product
              // Check if last line is empty, if so replace it, else push
              const lastLine = lines[lines.length - 1];
              const isLastEmpty = !lastLine.product_id && !lastLine.product_name;
              
              const newLineData = {
                  id: createLineId(),
                  product_id: result.id,
                  product_name: result.name,
                  product_sku: result.sku,
                  barcode_primary: result.barcodes?.[0]?.barcode || '',
                  barcode_type_primary: result.barcodes?.[0]?.barcode_type || '',
                  expected_qty: 1,
                  box_count: '',
                  pallet_text: '',
                  barcodes: result.barcodes || [],
                  mfg_date: '',
                  expiry_date: '',
                  line_notes: '',
                  notes: ''
              };

              if (isLastEmpty) {
                  const newLines = [...lines];
                  newLines[lines.length - 1] = { ...lastLine, ...newLineData };
                  setLines(newLines);
              } else {
                  setLines([...lines, newLineData]);
              }
          }
      } finally {
          setScannerOpen(false);
      }
  };

  const handleExcelData = async (data: ExcelInboundRow[]) => {
      if (!data || data.length === 0) {
          showError('엑셀 데이터가 없습니다.');
          return;
      }

      const normalized = data
          .map((item) => ({
              product_sku: (item.product_sku || '').toString().trim(),
              product_name: (item.product_name || '').toString().trim(),
              product_category: (item.product_category || '').toString().trim(),
              product_barcode: (item.product_barcode || '').toString().trim(),
              expected_qty: Number(item.expected_qty || 0),
              box_count: item.box_count ?? '',
              pallet_text: item.pallet_text ?? '',
              mfg_date: item.mfg_date ?? '',
              expiry_date: item.expiry_date ?? '',
              line_notes: item.line_notes ?? ''
          }))
          .filter((item) => item.product_sku && item.expected_qty > 0);

      if (normalized.length === 0) {
          showError('유효한 SKU/수량 데이터가 없습니다.');
          return;
      }

      // SKU 기준 합산 (동일 SKU 여러 줄 업로드 대비)
      const mergedBySku = normalized.reduce<Record<string, ExcelInboundRow>>((acc, cur) => {
          if (!acc[cur.product_sku]) {
              acc[cur.product_sku] = { ...cur };
          } else {
              acc[cur.product_sku].expected_qty += cur.expected_qty;
          }
          return acc;
      }, {});

      const mergedItems = Object.values(mergedBySku);

      const createdLines: InboundLine[] = [];
      const failedSkus: string[] = [];

      for (const item of mergedItems) {
          let matchedProduct: ProductSearchItem | null = null;
          try {
              const results = await searchProducts(item.product_sku, selectedClientId);
              matchedProduct = results?.find((p) => p.sku === item.product_sku) || null;

              if (!matchedProduct && item.product_barcode) {
                  const barcodeResults = await searchProducts(item.product_barcode, selectedClientId);
                  matchedProduct = barcodeResults?.[0] || null;
              }

              if (!matchedProduct) {
                  const res = await fetch('/api/admin/products', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                          name: item.product_name || item.product_sku,
                          sku: item.product_sku,
                          barcode: item.product_barcode || null,
                          category: item.product_category || '기타',
                          quantity: 0,
                          unit: '개',
                          min_stock: 0,
                          price: 0,
                          location: '',
                          description: '엑셀 업로드로 자동 생성',
                      })
                  });
                  const payload = await res.json();
                  if (!res.ok) {
                      throw new Error(payload?.error || '제품 생성 실패');
                  }
                  matchedProduct = payload.data as ProductSearchItem;
              }

              createdLines.push({
                  id: createLineId(),
                  product_id: matchedProduct.id,
                  product_name: matchedProduct.name || item.product_name || item.product_sku,
                  product_sku: matchedProduct.sku || item.product_sku,
                  barcode_primary: matchedProduct.barcode || item.product_barcode || '',
                  barcode_type_primary: matchedProduct.barcode ? 'RETAIL' : '',
                  expected_qty: item.expected_qty,
                  box_count: item.box_count,
                  pallet_text: item.pallet_text,
                  mfg_date: item.mfg_date,
                  expiry_date: item.expiry_date,
                  line_notes: item.line_notes,
                  notes: '',
                  barcodes: matchedProduct.barcodes || []
              });
          } catch (e) {
              console.error(e);
              failedSkus.push(item.product_sku);
          }
      }

      if (failedSkus.length > 0) {
          showError(`일부 SKU 처리 실패: ${failedSkus.join(', ')}`);
      }

      const cleanLines = lines.filter(l => l.product_id || l.product_name);
      setLines([...cleanLines, ...createdLines]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);

    if (!userOrgId || !selectedClientId || !plannedDate || !selectedWarehouseId || !inboundManager) {
        // Basic validation alert handled by UI hints mostly, but safety check
        if (!inboundManager) showError('입고담당자를 입력해주세요.');
        return;
    }

    const effectiveLines = lines.filter(l => l.product_id); // Only lines with valid ID
    if (effectiveLines.length === 0) {
        showError('입고 품목(SKU)이 유효하지 않습니다. 상품을 검색하여 선택해주세요.');
        return;
    }
    
    const invalidQty = effectiveLines.filter(l => !l.expected_qty || l.expected_qty <= 0);
    if (invalidQty.length > 0) {
        showError('모든 품목의 수량을 입력해주세요.');
        return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('org_id', userOrgId);
    formData.append('client_id', selectedClientId);
    formData.append('planned_date', plannedDate);
    formData.append('warehouse_id', selectedWarehouseId);
    formData.append('inbound_manager', inboundManager);
    formData.append('notes', planNotes);

    const processedLines = effectiveLines.map(l => ({
        ...l,
        product_id: l.product_id // Validated above
    }));
    formData.append('lines', JSON.stringify(processedLines));

    const result = await createInboundPlan(formData);
    
    setLoading(false);
    if ('error' in result) {
      showError('오류 발생: ' + result.error);
    } else {
      // Success - Redirect or Reset?
      // Server action revalidates, we can redirect
      router.push('/inbound');
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto py-4 px-4 sm:px-6 lg:px-8 lg:py-8">
      {/* Mobile Header with Back Button */}
      <div className="lg:hidden flex items-center mb-4">
        <button 
          onClick={() => router.back()}
          className="mr-3 p-2 -ml-2 rounded-full hover:bg-gray-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-gray-600">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900">신규 입고 예정 등록</h1>
      </div>

      <div className="hidden lg:flex mb-6 justify-between items-end">
        <div>
            <h1 className="text-3xl font-bold text-gray-900">신규 입고 예정 등록</h1>
            <p className="text-sm text-gray-500 mt-1">현장 입고 정보를 등록합니다.</p>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header Inputs */}
        <div className="p-4 lg:p-6 grid grid-cols-1 md:grid-cols-4 gap-4 lg:gap-6 bg-blue-50/50 border-b border-gray-200">
            <div className="md:col-span-4 mb-2 lg:mb-0">
                <h3 className="font-bold text-lg text-blue-900 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    기본 정보
                </h3>
            </div>
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">업체명 (Client) <span className="text-red-500">*</span></label>
                <select 
                    required 
                    className={`w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 py-2.5 ${submitted && !selectedClientId ? 'border-red-500' : ''}`}
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                >
                    <option value="">선택하세요</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">입고 예정일 <span className="text-red-500">*</span></label>
                <input
                    type="date"
                    required
                    value={plannedDate}
                    onChange={(e) => setPlannedDate(e.target.value)}
                    className={`w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 py-2.5 ${submitted && !plannedDate ? 'border-red-500' : ''}`}
                />
            </div>
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">입고지 주소 <span className="text-red-500">*</span></label>
                <select
                    required
                    className={`w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 py-2.5 ${submitted && !selectedWarehouseId ? 'border-red-500' : ''}`}
                    value={selectedWarehouseId}
                    onChange={(e) => setSelectedWarehouseId(e.target.value)}
                >
                    <option value="">선택하세요</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">입고담당 <span className="text-red-500">*</span></label>
                <select
                    required
                    className={`w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 py-2.5 ${submitted && !inboundManager ? 'border-red-500' : ''}`}
                    value={inboundManager}
                    onChange={(e) => setInboundManager(e.target.value)}
                >
                    <option value="">담당자 선택</option>
                    {managers.map(m => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                    ))}
                </select>
            </div>
            <div className="md:col-span-4">
                <input 
                    type="text"
                    placeholder="비고 (전체 메모)"
                    value={planNotes}
                    onChange={(e) => setPlanNotes(e.target.value)}
                    className="w-full rounded-lg border-gray-300 shadow-sm py-2.5"
                />
            </div>
        </div>

        {/* Toolbar */}
        <div className="px-4 lg:px-6 py-4 flex flex-wrap justify-between items-center border-b border-gray-200 bg-white">
            <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                </svg>
                입고 품목 (SKU)
            </h3>
            <div className="flex gap-2 mt-2 lg:mt-0 w-full lg:w-auto">
                <ExcelUpload onDataLoaded={handleExcelData} />
                <button
                    type="button"
                    onClick={() => setScannerOpen(true)}
                    className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium text-sm border border-gray-300"
                >
                    📷 바코드 스캔
                </button>
            </div>
        </div>

        {/* Grid Header - Desktop Only */}
        <div className="hidden lg:grid grid-cols-12 gap-2 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
            <div className="col-span-3 text-left pl-2">상품명 / SKU (검색)</div>
            <div className="col-span-1">박스</div>
            <div className="col-span-1 text-blue-700">수량 (Qty)</div>
            <div className="col-span-2 text-yellow-700">비고 (PLT)</div>
            <div className="col-span-2">제조일</div>
            <div className="col-span-2">유통기한</div>
            <div className="col-span-1">삭제</div>
        </div>

        {/* Grid Lines */}
        <div className="divide-y divide-gray-100">
            {lines.map((line, index) => (
                <div key={line.id} className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-2 p-4 lg:px-6 lg:py-3 items-start hover:bg-gray-50 transition-colors border-b lg:border-none last:border-b-0">
                    {/* Mobile Label */}
                    <div className="lg:hidden text-sm font-bold text-gray-900 mb-1 flex justify-between items-center">
                        <span>#{index + 1} 상품 정보</span>
                        <button 
                            type="button" 
                            onClick={() => removeLine(index)}
                            className="text-red-500 text-xs font-medium"
                        >
                            삭제
                        </button>
                    </div>

                    {/* Product Search */}
                    <div className="col-span-1 lg:col-span-3">
                        <ProductAutocomplete 
                            value={line.product_name}
                            clientId={selectedClientId}
                            onChange={(val) => handleLineChange(index, 'product_name', val)}
                            onSelect={(prod) => handleProductSelect(index, prod)}
                        />
                        {line.product_sku && (
                            <div className="text-xs text-gray-500 mt-1 px-1 truncate font-mono bg-gray-50 inline-block rounded">
                                {line.product_sku} {line.barcode_primary && `| ${line.barcode_primary}`}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 lg:contents">
                        {/* Box (Optional) */}
                        <div className="lg:col-span-1">
                            <label className="lg:hidden block text-xs font-medium text-gray-500 mb-1">박스</label>
                            <NumberInput
                                mode="integer"
                                min={0}
                                placeholder="Box"
                                className="w-full border-gray-300 rounded-md text-sm text-center px-1 py-2 focus:ring-blue-500"
                                value={Number(line.box_count) || 0}
                                onValueChange={(next) => handleLineChange(index, 'box_count', next)}
                            />
                        </div>

                        {/* Qty (Required, Blue) */}
                        <div className="lg:col-span-1">
                            <label className="lg:hidden block text-xs font-bold text-blue-700 mb-1">수량 (Qty)</label>
                            <NumberInput
                                mode="integer"
                                min={1}
                                placeholder="Qty"
                                className={`w-full rounded-md text-sm text-center font-bold px-1 py-2 border-2 focus:ring-blue-500 ${
                                    submitted && (!line.expected_qty || line.expected_qty <= 0)
                                    ? 'border-red-500 bg-red-50'
                                    : 'border-blue-200 text-blue-700'
                                }`}
                                value={line.expected_qty}
                                onValueChange={(next) => handleLineChange(index, 'expected_qty', next)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 lg:contents">
                         {/* PLT Notes (Yellow) */}
                        <div className="lg:col-span-2">
                            <label className="lg:hidden block text-xs font-medium text-yellow-700 mb-1">비고 (PLT)</label>
                            <input
                                type="text"
                                placeholder="예: 5 PLT"
                                className="w-full border-gray-300 rounded-md text-sm px-2 py-2 bg-yellow-50 focus:bg-white focus:ring-yellow-500 border-yellow-200"
                                value={line.pallet_text}
                                onChange={(e) => handleLineChange(index, 'pallet_text', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 lg:contents">
                        {/* Mfg Date */}
                        <div className="lg:col-span-2">
                             <label className="lg:hidden block text-xs font-medium text-gray-500 mb-1">제조일자</label>
                            <input
                                type="date"
                                className="w-full border-gray-300 rounded-md text-sm px-1 py-2"
                                value={line.mfg_date}
                                onChange={(e) => handleLineChange(index, 'mfg_date', e.target.value)}
                            />
                        </div>

                        {/* Expiry Date */}
                        <div className="lg:col-span-2">
                            <label className="lg:hidden block text-xs font-medium text-gray-500 mb-1">유통기한</label>
                            <input
                                type="date"
                                className="w-full border-gray-300 rounded-md text-sm px-1 py-2"
                                value={line.expiry_date}
                                onChange={(e) => handleLineChange(index, 'expiry_date', e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Delete (Desktop) */}
                    <div className="hidden lg:block col-span-1 text-center pt-1">
                        <button 
                            type="button" 
                            onClick={() => removeLine(index)}
                            className="text-gray-400 hover:text-red-600 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mx-auto">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </div>
            ))}
        </div>

        {/* Add Row Button */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 text-center">
            <button
                type="button"
                onClick={addLine}
                className="inline-flex items-center gap-2 px-6 py-2 border-2 border-dashed border-gray-400 rounded-xl text-gray-600 font-bold hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                품목 추가하기
            </button>
        </div>

        {/* Footer Actions */}
        <div className="p-4 lg:p-6 border-t border-gray-200 flex flex-col-reverse lg:flex-row justify-end gap-3">
             <button type="button" onClick={() => router.back()} className="w-full lg:w-auto px-6 py-3 border border-gray-300 rounded-xl text-gray-700 font-bold hover:bg-gray-50">
                취소
              </button>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full lg:w-auto px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 shadow-lg hover:shadow-xl transition-all"
              >
                {loading ? '저장 중...' : '입고 예정 등록 완료'}
              </button>
        </div>
      </form>

      {/* Barcode Scanner Modal */}
      {scannerOpen && (
          <BarcodeScanner
              onScan={handleScan}
              onClose={() => setScannerOpen(false)}
          />
      )}
    </div>
  );
}
