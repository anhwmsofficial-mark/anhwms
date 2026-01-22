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
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  
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

  const [plannedDate, setPlannedDate] = useState('');
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
    // 세션 체크 (쿠키 동기화)
    const { data: { session } } = await supabase.auth.getSession();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: orgs } = await supabase.from('org').select('id').limit(1);
      if (orgs && orgs.length > 0) setUserOrgId(orgs[0].id);
    }

    const { data: clientData, error } = await supabase.from('customer_master').select('id, name, code');
    if (error) {
        console.error('Error fetching clients:', error);
        // 테이블이 없을 수도 있으니 에러 처리를 유연하게
    }
    if (clientData) setClients(clientData);
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
      // 엑셀 데이터 파싱 후 실제 상품 정보와 매칭 (SKU 기준)
      const matchedLines = await Promise.all(data.map(async (item) => {
          // SKU로 상품 검색 (DB 조회)
          const res = await fetchProducts({ q: item.product_sku });
          const results = res.data || [];
          // 정확히 일치하는 SKU 찾기
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

      // 기존 라인에 추가 (빈 라인 있으면 제거)
      const cleanLines = lines.filter(l => l.product_id || l.product_name);
      setLines([...cleanLines, ...matchedLines]);

      const unmatched = matchedLines.filter((l) => l.is_unmatched);
      if (unmatched.length > 0) {
          alert(`SKU 매칭 실패: ${unmatched.length}건\n목록에서 수동으로 선택해주세요.`);
      }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userOrgId) {
      alert('조직 정보를 불러올 수 없습니다.');
      return;
    }
    
    const effectiveLines = lines.filter(l => l.product_id);
    if (effectiveLines.length === 0) {
        setSubmitted(true);
        alert('입고 품목을 1개 이상 추가해주세요.');
        return;
    }
    // 유효성 검사
    const invalidLines = effectiveLines.filter(l => l.expected_qty <= 0);
    if (invalidLines.length > 0) {
        setSubmitted(true);
        alert('모든 품목의 상품을 선택하고 수량을 입력해주세요.');
        return;
    }

    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.append('org_id', userOrgId);
    
    const { data: wh } = await supabase.from('warehouse').select('id').limit(1);
    const warehouseId = wh && wh.length > 0 ? wh[0].id : userOrgId;
    formData.append('warehouse_id', warehouseId);

    // Lines 처리
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
      // 성공 시 목록으로 이동은 Server Action에서 redirect 처리
    }
  };
  const isClientInvalid = submitted && !selectedClientId;
  const isDateInvalid = submitted && !plannedDate;

  return (
    <div className="max-w-6xl mx-auto py-10 px-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">신규 입고 예정 등록</h1>
        <p className="text-sm text-gray-500 mt-1">현장 기준 데이터로 입고 예정 정보를 등록합니다.</p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-10 bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
        
        {/* 기본 정보 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-2">화주사 (Client)</label>
            <select 
                name="client_id" 
                required 
                className={`w-full rounded-xl shadow-sm px-4 py-3 text-base border ${
                    isClientInvalid ? 'border-red-400 focus:border-red-500' : 'border-gray-300'
                } focus:ring-blue-500`}
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
            >
              <option value="">선택하세요</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-base font-semibold text-gray-800 mb-2">입고 예정일</label>
            <input
                type="date"
                name="planned_date"
                required
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                className={`w-full rounded-xl shadow-sm px-4 py-3 text-base border ${
                    isDateInvalid ? 'border-red-400 focus:border-red-500' : 'border-gray-300'
                } focus:ring-blue-500`}
            />
          </div>
        </div>

        <div>
          <label className="block text-base font-semibold text-gray-800 mb-2">비고 (Notes)</label>
          <textarea name="notes" rows={3} className="w-full border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 px-4 py-3 text-base"></textarea>
        </div>

        {/* 품목 리스트 */}
        <div>
          <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
            <h3 className="text-xl font-bold text-gray-900">입고 품목 (SKU)</h3>
            <div className="flex gap-3 items-center">
                <ExcelUpload onDataLoaded={handleExcelData} />
                <button
                    type="button"
                    onClick={() => setScannerOpen(true)}
                    className="px-4 py-2 border border-gray-700 text-gray-800 rounded-xl hover:bg-gray-50 text-sm font-medium"
                >
                    📷 바코드 스캔
                </button>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input
                        type="checkbox"
                        checked={scanAccumulate}
                        onChange={(e) => setScanAccumulate(e.target.checked)}
                    />
                    동일 SKU 누적
                </label>
            </div>
          </div>

          {/* 상품 선택 탭 */}
          <div className="mb-6">
            <div className="flex gap-2 mb-4">
                <button
                    type="button"
                    onClick={() => setActiveTab('search')}
                    className={`px-5 py-2 rounded-xl text-base font-semibold ${activeTab === 'search' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                    검색
                </button>
                <button
                    type="button"
                    onClick={() => { setActiveTab('list'); fetchProductList(1); }}
                    className={`px-5 py-2 rounded-xl text-base font-semibold ${activeTab === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                    목록
                </button>
            </div>

            {activeTab === 'search' && (
                <div className="bg-white border rounded-2xl p-5 space-y-4">
                    <input
                        type="text"
                        placeholder="품명 / SKU / 바코드 검색..."
                        value={searchQuery}
                        onChange={(e) => handleProductSearch(e.target.value)}
                        className="w-full border-gray-300 rounded-xl text-base px-4 py-3"
                    />
                    <div className="max-h-64 overflow-auto border rounded-xl">
                        {searchLoading && <div className="p-3 text-sm text-gray-500">검색 중...</div>}
                        {!searchLoading && productSearchResults.length === 0 && searchQuery.length >= 2 && (
                            <div className="p-3 text-sm text-gray-500">검색 결과가 없습니다.</div>
                        )}
                        {!searchLoading && productSearchResults.map((prod) => (
                            <label key={prod.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0 text-sm hover:bg-blue-50">
                                <input
                                    type="checkbox"
                                    checked={!!selectedProductIds[prod.id]}
                                    onChange={() => toggleSelectProduct(prod.id)}
                                />
                                <div className="flex-1">
                                    <div className="font-semibold">{prod.name}</div>
                                    <div className="text-xs text-gray-500">SKU: {prod.sku}{prod.category ? ` · ${prod.category}` : ''}</div>
                                </div>
                            </label>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={() => addSelectedProductsToLines(productSearchResults)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl text-base font-semibold"
                    >
                        선택 추가
                    </button>
                </div>
            )}

            {activeTab === 'list' && (
                <div className="bg-white border rounded-2xl p-5 space-y-4">
                    <div className="max-h-64 overflow-auto border rounded-xl">
                        {listLoading && <div className="p-3 text-sm text-gray-500">불러오는 중...</div>}
                        {!listLoading && listProducts.length === 0 && (
                            <div className="p-3 text-sm text-gray-500">목록이 없습니다.</div>
                        )}
                        {!listLoading && listProducts.map((prod) => (
                            <label key={prod.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0 text-sm hover:bg-blue-50">
                                <input
                                    type="checkbox"
                                    checked={!!selectedProductIds[prod.id]}
                                    onChange={() => toggleSelectProduct(prod.id)}
                                />
                                <div className="flex-1">
                                    <div className="font-semibold">{prod.name}</div>
                                    <div className="text-xs text-gray-500">SKU: {prod.sku}{prod.category ? ` · ${prod.category}` : ''}</div>
                                </div>
                            </label>
                        ))}
                    </div>
                    <div className="flex justify-between items-center">
                        <div className="text-xs text-gray-500">페이지 {listPage} / {listTotalPages}</div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => { const p = Math.max(1, listPage - 1); setListPage(p); fetchProductList(p); }}
                                className="px-3 py-1 border rounded text-xs"
                                disabled={listPage <= 1}
                            >
                                이전
                            </button>
                            <button
                                type="button"
                                onClick={() => { const p = Math.min(listTotalPages, listPage + 1); setListPage(p); fetchProductList(p); }}
                                className="px-3 py-1 border rounded text-xs"
                                disabled={listPage >= listTotalPages}
                            >
                                다음
                            </button>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => addSelectedProductsToLines(listProducts)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl text-base font-semibold"
                    >
                        선택 추가
                    </button>
                </div>
            )}
          </div>

          {/* 라인 테이블 */}
          <div className="space-y-4">
            {lines.filter(l => l.product_id).length === 0 && (
                <div className="text-sm text-gray-500 bg-gray-50 border rounded-xl p-4">
                    선택된 품목이 없습니다. 검색/목록/바코드 스캔으로 품목을 추가하세요.
                </div>
            )}
            {lines.map((line, index) => line.product_id ? (
              <div key={index} className={`p-5 rounded-2xl border ${submitted && line.expected_qty <= 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50'}`}>
                <div className="grid grid-cols-1 md:grid-cols-10 gap-4 items-end">
                    <div className="md:col-span-2">
                        <div className="text-xs text-gray-500">품명</div>
                        <div className="text-base font-semibold">{line.product_name || '-'}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500">SKU</div>
                        <div className="text-base">{line.product_sku || '-'}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500">바코드</div>
                        <button
                            type="button"
                            className="text-sm text-blue-600 underline"
                            onClick={() => setBarcodeModal({ open: true, barcodes: line.barcodes || [], title: line.product_name })}
                        >
                            {line.barcode_primary ? `${line.barcode_primary} (${line.barcode_type_primary || 'RETAIL'})` : '보기'}
                        </button>
                    </div>
                    <div>
                        <label className="text-xs text-gray-500">박스수</label>
                        <input
                            type="number"
                            className="w-full border-gray-300 rounded-xl text-base px-3 py-2"
                            value={line.box_count}
                            onChange={(e) => handleLineChange(index, 'box_count', parseInt(e.target.value) || '')}
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500">팔렛</label>
                        <input
                            type="text"
                            className="w-full border-gray-300 rounded-xl text-base px-3 py-2"
                            value={line.pallet_text}
                            onChange={(e) => handleLineChange(index, 'pallet_text', e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500">수량</label>
                        <input
                            type="number"
                            min="1"
                            className={`w-full rounded-xl text-base px-3 py-2 border ${
                                submitted && line.expected_qty <= 0 ? 'border-red-400' : 'border-gray-300'
                            }`}
                            value={line.expected_qty}
                            onChange={(e) => handleLineChange(index, 'expected_qty', parseInt(e.target.value) || 0)}
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500">제조일</label>
                        <input
                            type="date"
                            className="w-full border-gray-300 rounded-xl text-base px-3 py-2"
                            value={line.mfg_date}
                            onChange={(e) => handleLineChange(index, 'mfg_date', e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500">유통기한</label>
                        <input
                            type="date"
                            className="w-full border-gray-300 rounded-xl text-base px-3 py-2"
                            value={line.expiry_date}
                            onChange={(e) => handleLineChange(index, 'expiry_date', e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500">비고</label>
                        <input
                            type="text"
                            className="w-full border-gray-300 rounded-xl text-base px-3 py-2"
                            value={line.line_notes}
                            onChange={(e) => handleLineChange(index, 'line_notes', e.target.value)}
                        />
                    </div>
                    <div className="text-right md:col-span-10">
                        <button type="button" onClick={() => removeLine(index)} className="text-red-500 text-sm hover:text-red-700">
                            삭제
                        </button>
                    </div>
                </div>
              </div>
            ) : null)}
          </div>
        </div>

        <div className="pt-6 border-t border-gray-200 flex justify-end gap-4">
          <button type="button" onClick={() => router.back()} className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
            취소
          </button>
          <button 
            type="submit" 
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 text-base font-semibold"
          >
            {loading ? '등록 중...' : '입고 예정 등록'}
          </button>
        </div>
      </form>

      {/* 모바일 하단 고정 액션 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex gap-3 md:hidden">
          <button type="button" onClick={() => router.back()} className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-gray-700">
              취소
          </button>
          <button type="submit" formAction="#" onClick={(e) => (document.querySelector('form') as HTMLFormElement)?.requestSubmit()} className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-semibold">
              {loading ? '등록 중...' : '입고 예정 등록'}
          </button>
      </div>

      {scannerOpen && (
          <BarcodeScanner
              onScan={handleScan}
              onClose={() => setScannerOpen(false)}
          />
      )}

      {barcodeModal.open && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-60 flex items-center justify-center">
              <div className="bg-white w-96 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-3">
                      <h3 className="font-bold text-gray-900">{barcodeModal.title || '바코드 목록'}</h3>
                      <button className="text-gray-500 text-xl" onClick={() => setBarcodeModal({ open: false, barcodes: [], title: '' })}>&times;</button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-auto">
                      {barcodeModal.barcodes.length === 0 ? (
                          <div className="text-sm text-gray-500">등록된 바코드가 없습니다.</div>
                      ) : (
                          barcodeModal.barcodes.map((b: any, idx: number) => (
                              <div key={`${b.barcode}-${idx}`} className="text-sm border rounded px-3 py-2 flex justify-between">
                                  <span>{b.barcode}</span>
                                  <span className="text-gray-500">{b.barcode_type}</span>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
