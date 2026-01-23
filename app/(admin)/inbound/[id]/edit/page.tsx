'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { getInboundPlanDetail, updateInboundPlan } from '@/app/actions/inbound';
import ExcelUpload from '@/components/ExcelUpload';
// @ts-ignore
import BarcodeScanner from '@/components/BarcodeScanner';
import { searchProducts } from '@/app/actions/product';

// --- Inline Product Autocomplete Component (Same as new/page.tsx) ---
function ProductAutocomplete({ 
    value, 
    clientId, 
    onSelect, 
    onChange 
}: { 
    value: string; 
    clientId: string; 
    onSelect: (product: any) => void; 
    onChange: (val: string) => void;
}) {
    const [suggestions, setSuggestions] = useState<any[]>([]);
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

export default function EditInboundPlanPage() {
  const router = useRouter();
  const params = useParams();
  const planId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  
  // Form States
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [plannedDate, setPlannedDate] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [inboundManager, setInboundManager] = useState('');
  const [planNotes, setPlanNotes] = useState('');

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanAccumulate, setScanAccumulate] = useState(true);

  const [submitted, setSubmitted] = useState(false);

  // 입고 라인
  const [lines, setLines] = useState<any[]>([{
      id: Date.now(),
      product_id: '',
      product_name: '',
      product_sku: '',
      barcode_primary: '',
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
    fetchMetaAndData();
  }, [planId]);

  const fetchMetaAndData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: orgs } = await supabase.from('org').select('id').limit(1);
      if (orgs && orgs.length > 0) setUserOrgId(orgs[0].id);
    }

    // Fetch Clients & Warehouses
    const [clientRes, whRes] = await Promise.all([
        supabase.from('customer_master').select('id, name, code').order('name'),
        supabase.from('warehouse').select('id, name').eq('status', 'ACTIVE').order('name')
    ]);
    
    if (clientRes.data) setClients(clientRes.data);
    if (whRes.data) setWarehouses(whRes.data);

    // Fetch Plan Detail
    if (planId) {
        const plan = await getInboundPlanDetail(planId);
        if (plan) {
            setSelectedClientId(plan.client_id);
            setPlannedDate(plan.planned_date);
            setSelectedWarehouseId(plan.warehouse_id);
            setInboundManager(plan.inbound_manager || '');
            setPlanNotes(plan.notes || '');

            // Map Lines (Product 정보는 별도 join이 없으므로, product_id로 이름 등을 가져와야 할 수 있음. 
            // 하지만 getInboundPlanDetail에서 inbound_plan_lines를 가져오지만 product name은 join 되어 있지 않음.
            // 클라이언트에서 다시 조회하거나, getInboundPlanDetail 쿼리 수정이 필요.
            // 간단하게 각 라인의 product 정보를 개별 조회하거나, products 테이블을 join해서 가져오는 게 좋음.
            // 현재 getInboundPlanDetail 쿼리: inbound_plan_lines (*)
            // 개선: inbound_plan_lines (*, product:product_id(name, sku, barcodes)) - Supabase FK 연결 필요.
            // FK가 방금 연결되었으므로 가능할 것임. 하지만 TS 문제나 복잡성을 피하기 위해
            // 여기서는 일단 lines를 매핑하고, product 상세 정보는 Client-side에서 보완하거나, 
            // product_id가 있으니 일단 표시하고 이름은 나중에 로딩? 
            // 아니면 그냥 plan lines에 product 정보가 없으면 표시가 안되므로, 
            // getInboundPlanDetail을 수정하여 product 정보를 가져오도록 하자. 
            // 하지만 getInboundPlanDetail는 서버 액션이므로 이미 수정됨. (쿼리 수정 안함)
            // 클라이언트에서 쿼리 수정이 안되므로, 여기서 직접 fetch 하거나 액션을 수정해야 함.
            // 액션 수정은 번거로우니, 여기서 Supabase로 Lines + Product Join 조회.
            
            const { data: linesWithProd } = await supabase
                .from('inbound_plan_lines')
                .select('*, product:product_id(id, name, sku, barcode)')
                .eq('plan_id', planId);

            if (linesWithProd) {
                const mappedLines = linesWithProd.map((l: any) => ({
                    id: l.id,
                    product_id: l.product_id,
                    product_name: l.product?.name || 'Unknown',
                    product_sku: l.product?.sku || '',
                    barcode_primary: l.product?.barcode || '',
                    barcodes: [], // 이미 등록된 건은 바코드 리스트가 꼭 필요하진 않음 (검색용이므로)
                    expected_qty: l.expected_qty,
                    box_count: l.box_count || '',
                    pallet_text: l.pallet_text || '',
                    mfg_date: l.mfg_date || '',
                    expiry_date: l.expiry_date || '',
                    line_notes: l.line_notes || '',
                    notes: l.notes || ''
                }));
                setLines(mappedLines);
            }
        }
    }
    setLoading(false);
  };

  // --- Helpers (Same as new/page.tsx) ---

  const addLine = () => {
      setLines([...lines, {
          id: Date.now(),
          product_id: '',
          product_name: '',
          product_sku: '',
          expected_qty: 0,
          box_count: '',
          pallet_text: '',
          mfg_date: '',
          expiry_date: '',
          line_notes: '',
          notes: '',
          barcodes: []
      }]);
  };

  const removeLine = (index: number) => {
      if (lines.length === 1) {
          alert('최소 1개의 품목은 있어야 합니다.');
          return;
      }
      const newLines = lines.filter((_, i) => i !== index);
      setLines(newLines);
  };

  const handleLineChange = (index: number, field: string, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const handleProductSelect = (index: number, product: any) => {
      const newLines = [...lines];
      const barcodes = product.barcodes || [];
      const primary = barcodes.find((b: any) => b.is_primary) || barcodes[0];

      newLines[index] = {
          ...newLines[index],
          product_id: product.id,
          product_name: product.name,
          product_sku: product.sku,
          barcode_primary: primary?.barcode || '',
          barcodes: barcodes
      };
      setLines(newLines);
  };

  const handleScan = async (barcode: string | null) => {
      if (!barcode) return;
      try {
          const results = await searchProducts(barcode, selectedClientId);
          const result = (results || [])[0];
          
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
              const lastLine = lines[lines.length - 1];
              const isLastEmpty = !lastLine.product_id && !lastLine.product_name;
              
              const newLineData = {
                  id: Date.now(),
                  product_id: result.id,
                  product_name: result.name,
                  product_sku: result.sku,
                  barcode_primary: result.barcodes?.[0]?.barcode || '',
                  expected_qty: 1,
                  box_count: '',
                  pallet_text: '',
                  barcodes: result.barcodes || []
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

  const handleExcelData = async (data: any[]) => {
      const mappedLines = await Promise.all(data.map(async (item) => {
           const results = await searchProducts(item.product_sku, selectedClientId);
           const matchedProduct = results?.find((p: any) => p.sku === item.product_sku);
           
           return {
               id: Date.now() + Math.random(),
               product_id: matchedProduct ? matchedProduct.id : '',
               product_name: matchedProduct ? matchedProduct.name : (item.product_name || item.product_sku),
               product_sku: item.product_sku,
               expected_qty: item.expected_qty,
               box_count: item.box_count,
               pallet_text: item.pallet_text,
               mfg_date: item.mfg_date,
               expiry_date: item.expiry_date,
               line_notes: item.line_notes,
               barcodes: matchedProduct?.barcodes || []
           };
      }));

      const validNew = mappedLines.filter(l => l.product_sku && l.expected_qty > 0);
      const cleanLines = lines.filter(l => l.product_id || l.product_name);
      setLines([...cleanLines, ...validNew]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);

    if (!userOrgId || !selectedClientId || !plannedDate || !selectedWarehouseId || !inboundManager) {
        if (!inboundManager) alert('입고담당자를 입력해주세요.');
        return;
    }

    const effectiveLines = lines.filter(l => l.product_id);
    if (effectiveLines.length === 0) {
        alert('입고 품목(SKU)이 유효하지 않습니다.');
        return;
    }
    
    const invalidQty = effectiveLines.filter(l => !l.expected_qty || l.expected_qty <= 0);
    if (invalidQty.length > 0) {
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

    // Update Action 호출
    const result = await updateInboundPlan(planId, formData);
    
    setLoading(false);
    if (result?.error) {
      alert('오류 발생: ' + result.error);
    } else {
      alert('입고 예정이 수정되었습니다.');
      router.push('/inbound');
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-500">데이터를 불러오는 중...</div>;

  return (
    <div className="max-w-[1400px] mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex justify-between items-end">
        <div>
            <h1 className="text-3xl font-bold text-gray-900">입고 예정 수정</h1>
            <p className="text-sm text-gray-500 mt-1">등록된 입고 예정 정보를 수정합니다.</p>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header Inputs */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6 bg-gray-50 border-b border-gray-200">
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
                    <option value="주영재">주영재</option>
                    <option value="최보금">최보금</option>
                    <option value="박주희">박주희</option>
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
        <div className="px-6 py-4 flex flex-wrap justify-between items-center border-b border-gray-200">
            <h3 className="font-bold text-lg text-gray-900">입고 품목 (SKU)</h3>
            <div className="flex gap-2">
                <ExcelUpload onDataLoaded={handleExcelData} />
                <button
                    type="button"
                    onClick={() => setScannerOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium text-sm"
                >
                    📷 바코드 스캔
                </button>
            </div>
        </div>

        {/* Grid Header */}
        <div className="grid grid-cols-12 gap-2 px-6 py-3 bg-gray-100 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
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
                <div key={line.id} className="grid grid-cols-12 gap-2 px-6 py-3 items-start hover:bg-gray-50 transition-colors">
                    {/* Product Search */}
                    <div className="col-span-3">
                        <ProductAutocomplete 
                            value={line.product_name}
                            clientId={selectedClientId}
                            onChange={(val) => handleLineChange(index, 'product_name', val)}
                            onSelect={(prod) => handleProductSelect(index, prod)}
                        />
                        {line.product_sku && (
                            <div className="text-xs text-gray-500 mt-1 px-1 truncate font-mono">
                                {line.product_sku} {line.barcode_primary && `| ${line.barcode_primary}`}
                            </div>
                        )}
                    </div>

                    {/* Box */}
                    <div className="col-span-1">
                        <input
                            type="number"
                            placeholder="Box"
                            className="w-full border-gray-300 rounded-md text-sm text-center px-1 py-2 focus:ring-blue-500"
                            value={line.box_count}
                            onChange={(e) => handleLineChange(index, 'box_count', parseInt(e.target.value) || '')}
                        />
                    </div>

                    {/* Qty */}
                    <div className="col-span-1">
                        <input
                            type="number"
                            min="1"
                            placeholder="Qty"
                            className={`w-full rounded-md text-sm text-center font-bold px-1 py-2 border-2 focus:ring-blue-500 ${
                                submitted && (!line.expected_qty || line.expected_qty <= 0) 
                                ? 'border-red-500 bg-red-50' 
                                : 'border-blue-200 text-blue-700'
                            }`}
                            value={line.expected_qty}
                            onChange={(e) => handleLineChange(index, 'expected_qty', parseInt(e.target.value) || 0)}
                        />
                    </div>

                    {/* PLT */}
                    <div className="col-span-2">
                        <input
                            type="text"
                            placeholder="예: 5 PLT"
                            className="w-full border-gray-300 rounded-md text-sm px-2 py-2 bg-yellow-50 focus:bg-white focus:ring-yellow-500 border-yellow-200"
                            value={line.pallet_text}
                            onChange={(e) => handleLineChange(index, 'pallet_text', e.target.value)}
                        />
                    </div>

                    {/* Mfg */}
                    <div className="col-span-2">
                        <input
                            type="date"
                            className="w-full border-gray-300 rounded-md text-sm px-1 py-2"
                            value={line.mfg_date}
                            onChange={(e) => handleLineChange(index, 'mfg_date', e.target.value)}
                        />
                    </div>

                    {/* Expiry */}
                    <div className="col-span-2">
                        <input
                            type="date"
                            className="w-full border-gray-300 rounded-md text-sm px-1 py-2"
                            value={line.expiry_date}
                            onChange={(e) => handleLineChange(index, 'expiry_date', e.target.value)}
                        />
                    </div>

                    {/* Delete */}
                    <div className="col-span-1 text-center pt-1">
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
        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
             <button type="button" onClick={() => router.back()} className="px-6 py-3 border border-gray-300 rounded-xl text-gray-700 font-bold hover:bg-gray-50">
                취소
              </button>
              <button 
                type="submit" 
                disabled={loading}
                className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 shadow-lg hover:shadow-xl transition-all"
              >
                {loading ? '저장 중...' : '수정 완료'}
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
