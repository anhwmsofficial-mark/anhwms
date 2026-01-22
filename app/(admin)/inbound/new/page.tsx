'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { createInboundPlan } from '@/app/actions/inbound';
import ExcelUpload from '@/components/ExcelUpload';
// @ts-ignore
import BarcodeScanner from '@/components/BarcodeScanner';

export default function NewInboundPlanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  
  // Form States
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [plannedDate, setPlannedDate] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [inboundManager, setInboundManager] = useState('');
  const [planNotes, setPlanNotes] = useState('');

  // 상품 검색/목록/스캔 상태
  const [activeTab, setActiveTab] = useState<'search' | 'list'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [productSearchResults, setProductSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [listProducts, setListProducts] = useState<any[]>([]);
  const [listPage, setListPage] = useState(1);
  const [listTotalPages, setListTotalPages] = useState(1);
  const [selectedProductIds, setSelectedProductIds] = useState<Record<string, boolean>>({});
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanAccumulate, setScanAccumulate] = useState(true);

  const [barcodeModal, setBarcodeModal] = useState<{ open: boolean; barcodes: any[]; title: string }>({
      open: false,
      barcodes: [],
      title: ''
  });

  const [submitted, setSubmitted] = useState(false);

  // 입고 라인
  const [lines, setLines] = useState<any[]>([{
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
      notes: ''
  }]);

  const [userOrgId, setUserOrgId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchMeta();
  }, []);

  // 화주사가 변경되면 해당 화주의 상품 목록/검색 초기화
  useEffect(() => {
      if (selectedClientId) {
          setLines([{
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
              notes: ''
          }]);
          setSearchQuery('');
          setProductSearchResults([]);
          setSelectedProductIds({});
          setListPage(1);
          fetchProductList(1);
      }
  }, [selectedClientId]);

  const fetchMeta = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: orgs } = await supabase.from('org').select('id').limit(1);
      if (orgs && orgs.length > 0) setUserOrgId(orgs[0].id);
      
      // Default manager to current user's email or name if available, or empty
      // setInboundManager(user.email || ''); 
    }

    // Fetch Clients
    const { data: clientData, error } = await supabase.from('customer_master').select('id, name, code');
    if (clientData) setClients(clientData);

    // Fetch Warehouses
    const { data: whData } = await supabase.from('warehouse').select('id, name');
    if (whData) {
        setWarehouses(whData);
        if (whData.length > 0) setSelectedWarehouseId(whData[0].id);
    }
  };

  const fetchProducts = async (params: { q?: string; page?: number }) => {
      const searchParams = new URLSearchParams();
      if (params.q) searchParams.set('q', params.q);
      if (selectedClientId) searchParams.set('clientId', selectedClientId);
      if (params.page) searchParams.set('page', params.page.toString());
      searchParams.set('limit', '20');

      const res = await fetch(`/api/products/search?${searchParams.toString()}`, { cache: 'no-store' });
      if (!res.ok) {
          throw new Error('상품 조회 실패');
      }
      return res.json();
  };

  const resolvePrimaryBarcode = (product: any) => {
      const barcodes = product.barcodes || [];
      const primary = barcodes.find((b: any) => b.is_primary) 
          || barcodes.find((b: any) => b.barcode_type === 'RETAIL') 
          || barcodes[0];
      return {
          barcode_primary: primary?.barcode || '',
          barcode_type_primary: primary?.barcode_type || ''
      };
  };

  const buildLineFromProduct = (product: any) => {
      const { barcode_primary, barcode_type_primary } = resolvePrimaryBarcode(product);
      return {
          product_id: product.id,
          product_name: product.name,
          product_sku: product.sku,
          barcode_primary,
          barcode_type_primary,
          barcodes: product.barcodes || [],
          box_count: '',
          pallet_text: '',
          expected_qty: 0,
          mfg_date: '',
          expiry_date: '',
          line_notes: '',
          notes: ''
      };
  };

  const addLinesFromProducts = (products: any[]) => {
      const existing = new Set(lines.filter(l => l.product_id).map(l => l.product_id));
      const toAdd = products.filter(p => !existing.has(p.id)).map(buildLineFromProduct);
      const cleanLines = lines.filter(l => l.product_id || l.product_name);
      setLines([...cleanLines, ...toAdd]);
  };

  const handleProductSearch = (query: string) => {
      setSearchQuery(query);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

      if (query.trim().length < 2) {
          setProductSearchResults([]);
          return;
      }

      searchTimeoutRef.current = setTimeout(async () => {
          setSearchLoading(true);
          try {
              const res = await fetchProducts({ q: query });
              setProductSearchResults(res.data || []);
          } finally {
              setSearchLoading(false);
          }
      }, 300);
  };

  const fetchProductList = async (page: number) => {
      if (!selectedClientId) return;
      setListLoading(true);
      try {
          const res = await fetchProducts({ page });
          setListProducts(res.data || []);
          setListTotalPages(res.pagination?.totalPages || 1);
      } finally {
          setListLoading(false);
      }
  };

  const handleLineChange = (index: number, field: string, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const removeLine = (index: number) => {
    const newLines = lines.filter((_, i) => i !== index);
    setLines(newLines);
  };

  const toggleSelectProduct = (productId: string) => {
      setSelectedProductIds((prev) => ({
          ...prev,
          [productId]: !prev[productId]
      }));
  };

  const addSelectedProductsToLines = (products: any[]) => {
      const selected = products.filter((p) => selectedProductIds[p.id]);
      if (selected.length === 0) return;
      addLinesFromProducts(selected);
      setSelectedProductIds({});
  };

  const handleScan = async (barcode: string | null) => {
      if (!barcode) return;
      try {
          const res = await fetchProducts({ q: barcode });
          const result = (res.data || [])[0];
          if (!result) {
              alert(`바코드 매칭 실패: ${barcode}`);
              return;
          }
          const existingIndex = lines.findIndex((l) => l.product_id === result.id);
          if (existingIndex >= 0 && scanAccumulate) {
              const newLines = [...lines];
              newLines[existingIndex].expected_qty = (parseInt(newLines[existingIndex].expected_qty) || 0) + 1;
              setLines(newLines);
          } else {
              addLinesFromProducts([result]);
          }
      } finally {
          setScannerOpen(false);
      }
  };

  const handleExcelData = async (data: any[]) => {
      const matchedLines = await Promise.all(data.map(async (item) => {
          const res = await fetchProducts({ q: item.product_sku });
          const results = res.data || [];
          const matchedProduct = results.find((p: any) => p.sku === item.product_sku);
          
          return {
              product_id: matchedProduct ? matchedProduct.id : '',
              product_sku: item.product_sku,
              product_name: matchedProduct ? `${matchedProduct.name} (${matchedProduct.sku})` : item.product_sku + ' (상품 정보 없음)',
              barcode_primary: item.product_barcode || '',
              barcode_type_primary: item.product_barcode_type || '',
              barcodes: item.product_barcode ? [{ barcode: item.product_barcode, barcode_type: item.product_barcode_type || 'RETAIL', is_primary: true }] : [],
              expected_qty: item.expected_qty,
              notes: item.notes || '',
              box_count: item.box_count || '',
              pallet_text: item.pallet_text || '',
              mfg_date: item.mfg_date || '',
              expiry_date: item.expiry_date || '',
              line_notes: item.line_notes || item.notes || '',
              is_unmatched: !matchedProduct
          };
      }));

      const cleanLines = lines.filter(l => l.product_id || l.product_name);
      setLines([...cleanLines, ...matchedLines]);

      const unmatched = matchedLines.filter((l) => l.is_unmatched);
      if (unmatched.length > 0) {
          alert(`SKU 매칭 실패: ${unmatched.length}건\n목록에서 수동으로 선택해주세요.`);
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);

    if (!userOrgId) {
      alert('조직 정보를 불러올 수 없습니다.');
      return;
    }
    
    // Validation
    if (!selectedClientId) return;
    if (!plannedDate) return;
    if (!selectedWarehouseId) return;
    if (!inboundManager) {
        alert('입고담당자를 입력해주세요.');
        return;
    }

    const effectiveLines = lines.filter(l => l.product_id);
    if (effectiveLines.length === 0) {
        alert('입고 품목을 1개 이상 추가해주세요.');
        return;
    }
    const invalidLines = effectiveLines.filter(l => l.expected_qty <= 0);
    if (invalidLines.length > 0) {
        alert('모든 품목의 수량을 입력해주세요.');
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
        product_id: l.product_id
    }));
    formData.append('lines', JSON.stringify(processedLines));

    const result = await createInboundPlan(formData);
    
    setLoading(false);
    if (result?.error) {
      alert('오류 발생: ' + result.error);
    } else {
      // success
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">신규 입고 예정 등록</h1>
        <p className="text-sm text-gray-500 mt-2">현장 입고 정보를 등록합니다. 필수 항목을 정확히 입력해주세요.</p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-8 bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
        
        {/* Row 1: Client & Date */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              업체명 (Client) <span className="text-red-500">*</span>
            </label>
            <select 
                required 
                className={`w-full rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-3 ${submitted && !selectedClientId ? 'border-red-500' : ''}`}
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
            >
              <option value="">선택하세요</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
            {submitted && !selectedClientId && <p className="text-red-500 text-xs mt-1">업체명을 선택해주세요.</p>}
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              입고 날짜 (Planned Date) <span className="text-red-500">*</span>
            </label>
            <input
                type="date"
                required
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                className={`w-full rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-3 ${submitted && !plannedDate ? 'border-red-500' : ''}`}
            />
            {submitted && !plannedDate && <p className="text-red-500 text-xs mt-1">입고 예정일을 입력해주세요.</p>}
          </div>
        </div>

        {/* Row 2: Warehouse & Manager */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              입고지 주소 (Warehouse) <span className="text-red-500">*</span>
            </label>
            <select
                required
                className={`w-full rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-3 ${submitted && !selectedWarehouseId ? 'border-red-500' : ''}`}
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
            >
                <option value="">창고를 선택하세요</option>
                {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                ))}
            </select>
            {submitted && !selectedWarehouseId && <p className="text-red-500 text-xs mt-1">입고 창고를 선택해주세요.</p>}
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              입고담당 (Manager) <span className="text-red-500">*</span>
            </label>
            <input
                type="text"
                required
                placeholder="담당자 이름 입력"
                value={inboundManager}
                onChange={(e) => setInboundManager(e.target.value)}
                className={`w-full rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-3 ${submitted && !inboundManager ? 'border-red-500' : ''}`}
            />
            {submitted && !inboundManager && <p className="text-red-500 text-xs mt-1">담당자를 입력해주세요.</p>}
          </div>
        </div>

        {/* Row 3: Notes */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">비고 (Notes)</label>
          <textarea 
            rows={3} 
            value={planNotes}
            onChange={(e) => setPlanNotes(e.target.value)}
            className="w-full rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-3"
            placeholder="전체 입고 건에 대한 메모를 입력하세요."
          ></textarea>
        </div>

        <hr className="border-gray-200" />

        {/* 품목 리스트 */}
        <div>
          <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
            <h3 className="text-xl font-bold text-gray-900">입고 품목 (SKU) <span className="text-red-500">*</span></h3>
            <div className="flex gap-3 items-center">
                <ExcelUpload onDataLoaded={handleExcelData} />
                <button
                    type="button"
                    onClick={() => setScannerOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium transition-colors"
                >
                    <span className="text-lg">📷</span> 바코드 스캔
                </button>
            </div>
          </div>

          {/* 상품 선택 탭 */}
          <div className="mb-6 bg-gray-50 p-4 rounded-2xl border border-gray-200">
            <div className="flex gap-2 mb-4">
                <button
                    type="button"
                    onClick={() => setActiveTab('search')}
                    className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'search' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                >
                    검색으로 추가
                </button>
                <button
                    type="button"
                    onClick={() => { setActiveTab('list'); fetchProductList(1); }}
                    className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'list' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                >
                    목록에서 선택
                </button>
            </div>

            {activeTab === 'search' && (
                <div className="space-y-4">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="품명, SKU, 바코드 검색..."
                            value={searchQuery}
                            onChange={(e) => handleProductSearch(e.target.value)}
                            className="w-full pl-4 pr-10 py-3 rounded-xl border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <div className="absolute right-3 top-3 text-gray-400">🔍</div>
                    </div>
                    {/* 검색 결과 표시 영역 */}
                    {searchQuery.length >= 2 && (
                        <div className="bg-white rounded-xl border border-gray-200 max-h-60 overflow-y-auto">
                             {searchLoading ? (
                                <div className="p-4 text-center text-gray-500">검색 중...</div>
                             ) : productSearchResults.length > 0 ? (
                                <div className="divide-y divide-gray-100">
                                    {productSearchResults.map((prod) => (
                                        <label key={prod.id} className="flex items-center gap-4 p-3 hover:bg-blue-50 cursor-pointer transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={!!selectedProductIds[prod.id]}
                                                onChange={() => toggleSelectProduct(prod.id)}
                                                className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                            />
                                            <div>
                                                <div className="font-bold text-gray-800">{prod.name}</div>
                                                <div className="text-xs text-gray-500 font-mono mt-0.5">{prod.sku}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                             ) : (
                                <div className="p-4 text-center text-gray-500">검색 결과가 없습니다.</div>
                             )}
                        </div>
                    )}
                    {productSearchResults.length > 0 && (
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={() => addSelectedProductsToLines(productSearchResults)}
                                className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                            >
                                선택한 상품 추가
                            </button>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'list' && (
                <div className="space-y-4">
                    <div className="bg-white rounded-xl border border-gray-200 max-h-80 overflow-y-auto">
                        {listLoading ? (
                            <div className="p-8 text-center text-gray-500">목록을 불러오는 중...</div>
                        ) : listProducts.length > 0 ? (
                            <div className="divide-y divide-gray-100">
                                {listProducts.map((prod) => (
                                    <label key={prod.id} className="flex items-center gap-4 p-3 hover:bg-blue-50 cursor-pointer transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={!!selectedProductIds[prod.id]}
                                            onChange={() => toggleSelectProduct(prod.id)}
                                            className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                        />
                                        <div>
                                            <div className="font-bold text-gray-800">{prod.name}</div>
                                            <div className="text-xs text-gray-500 font-mono mt-0.5">{prod.sku}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-gray-500">표시할 상품이 없습니다.</div>
                        )}
                    </div>
                    
                    {/* Pagination */}
                    <div className="flex justify-between items-center px-2">
                        <div className="text-xs text-gray-500">Page {listPage} of {listTotalPages}</div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => { const p = Math.max(1, listPage - 1); setListPage(p); fetchProductList(p); }}
                                disabled={listPage <= 1}
                                className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                            >
                                이전
                            </button>
                            <button
                                type="button"
                                onClick={() => { const p = Math.min(listTotalPages, listPage + 1); setListPage(p); fetchProductList(p); }}
                                disabled={listPage >= listTotalPages}
                                className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                            >
                                다음
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-end">
                         <button
                            type="button"
                            onClick={() => addSelectedProductsToLines(listProducts)}
                            className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                        >
                            선택한 상품 추가
                        </button>
                    </div>
                </div>
            )}
          </div>

          {/* 라인 테이블 */}
          <div className="space-y-4">
            {lines.filter(l => l.product_id).length === 0 && (
                <div className="text-center py-10 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl text-gray-500">
                    아직 추가된 품목이 없습니다.<br/>위에서 상품을 검색하거나 바코드를 스캔하세요.
                </div>
            )}
            
            {lines.map((line, index) => line.product_id ? (
              <div key={index} className={`p-6 rounded-2xl border-l-4 shadow-sm transition-all ${
                  submitted && line.expected_qty <= 0 ? 'bg-red-50 border-red-500 border-t border-r border-b' : 'bg-white border-blue-500 border-t border-r border-b border-gray-200'
              }`}>
                <div className="grid grid-cols-12 gap-4 items-center">
                    
                    {/* 상품 정보 (4 cols) */}
                    <div className="col-span-12 md:col-span-4">
                        <div className="flex items-start gap-3">
                            <div className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">
                                {index + 1}
                            </div>
                            <div>
                                <div className="font-bold text-gray-900 text-lg">{line.product_name}</div>
                                <div className="text-sm text-gray-500 font-mono">{line.product_sku}</div>
                                <button
                                    type="button"
                                    className="text-xs text-blue-600 underline mt-1"
                                    onClick={() => setBarcodeModal({ open: true, barcodes: line.barcodes || [], title: line.product_name })}
                                >
                                    바코드 보기 ({line.barcodes?.length || 0})
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 입력 필드 (8 cols) */}
                    <div className="col-span-12 md:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                        
                        {/* 박스 (Optional) */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">박스 (Box)</label>
                            <input
                                type="number"
                                placeholder="0"
                                className="w-full border-gray-300 rounded-lg text-sm px-3 py-2"
                                value={line.box_count}
                                onChange={(e) => handleLineChange(index, 'box_count', parseInt(e.target.value) || '')}
                            />
                        </div>

                        {/* 수량 (Required) */}
                        <div>
                            <label className="block text-xs font-bold text-blue-600 mb-1">수량 (Qty) *</label>
                            <input
                                type="number"
                                min="1"
                                placeholder="0"
                                className={`w-full rounded-lg text-sm px-3 py-2 border-2 ${
                                    submitted && line.expected_qty <= 0 ? 'border-red-400 bg-red-50' : 'border-blue-100 focus:border-blue-500'
                                }`}
                                value={line.expected_qty}
                                onChange={(e) => handleLineChange(index, 'expected_qty', parseInt(e.target.value) || 0)}
                            />
                        </div>

                        {/* 제조일 (Optional) */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">제조일자</label>
                            <input
                                type="date"
                                className="w-full border-gray-300 rounded-lg text-sm px-3 py-2"
                                value={line.mfg_date}
                                onChange={(e) => handleLineChange(index, 'mfg_date', e.target.value)}
                            />
                        </div>

                        {/* 유통기한 (Optional) */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">유통기한</label>
                            <input
                                type="date"
                                className="w-full border-gray-300 rounded-lg text-sm px-3 py-2"
                                value={line.expiry_date}
                                onChange={(e) => handleLineChange(index, 'expiry_date', e.target.value)}
                            />
                        </div>

                        {/* 비고(PLT) - Full width in inner grid */}
                        <div className="col-span-2 md:col-span-4">
                            <label className="block text-xs font-bold text-gray-700 mb-1">비고 (PLT) - 그대로 출력됩니다</label>
                            <input
                                type="text"
                                placeholder="예: 5 PLT, 파렛트 적재 요망"
                                className="w-full border-gray-300 rounded-lg text-sm px-3 py-2 bg-yellow-50"
                                value={line.pallet_text}
                                onChange={(e) => handleLineChange(index, 'pallet_text', e.target.value)}
                            />
                        </div>

                    </div>

                    {/* 삭제 버튼 */}
                    <div className="absolute top-4 right-4">
                        <button 
                            type="button" 
                            onClick={() => removeLine(index)} 
                            className="text-gray-400 hover:text-red-500 transition-colors p-1"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
              </div>
            ) : null)}
          </div>
        </div>

        <div className="pt-8 border-t border-gray-200 flex justify-end gap-4">
          <button type="button" onClick={() => router.back()} className="px-8 py-3 border border-gray-300 rounded-xl text-gray-700 font-bold hover:bg-gray-50">
            취소
          </button>
          <button 
            type="submit" 
            disabled={loading}
            className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 shadow-lg hover:shadow-xl transition-all"
          >
            {loading ? '저장 중...' : '입고 예정 등록 완료'}
          </button>
        </div>
      </form>

      {/* 모바일 하단 고정 액션 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex gap-3 md:hidden z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
          <button type="button" onClick={() => router.back()} className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-gray-700 font-bold">
              취소
          </button>
          <button type="button" onClick={(e) => (document.querySelector('form') as HTMLFormElement)?.requestSubmit()} className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold">
              {loading ? '저장 중...' : '등록 완료'}
          </button>
      </div>

      {scannerOpen && (
          <BarcodeScanner
              onScan={handleScan}
              onClose={() => setScannerOpen(false)}
          />
      )}

      {barcodeModal.open && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-60 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl transform transition-all">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-xl text-gray-900">{barcodeModal.title || '바코드 목록'}</h3>
                      <button className="text-gray-400 hover:text-gray-600 text-2xl" onClick={() => setBarcodeModal({ open: false, barcodes: [], title: '' })}>&times;</button>
                  </div>
                  <div className="space-y-3 max-h-60 overflow-auto">
                      {barcodeModal.barcodes.length === 0 ? (
                          <div className="text-sm text-gray-500 text-center py-4">등록된 바코드가 없습니다.</div>
                      ) : (
                          barcodeModal.barcodes.map((b: any, idx: number) => (
                              <div key={`${b.barcode}-${idx}`} className="text-sm border rounded-lg px-4 py-3 flex justify-between bg-gray-50">
                                  <span className="font-mono font-medium">{b.barcode}</span>
                                  <span className="text-gray-500 text-xs bg-white px-2 py-1 rounded border">{b.barcode_type}</span>
                              </div>
                          ))
                      )}
                  </div>
                  <div className="mt-6">
                      <button 
                        onClick={() => setBarcodeModal({ open: false, barcodes: [], title: '' })}
                        className="w-full py-3 bg-gray-100 text-gray-800 font-bold rounded-xl hover:bg-gray-200"
                      >
                          닫기
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
