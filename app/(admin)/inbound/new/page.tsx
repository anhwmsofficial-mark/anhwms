'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { createInboundPlan } from '@/app/actions/inbound';
import { getProductsByClient, searchProducts } from '@/app/actions/product';

export default function NewInboundPlanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  
  // 상품 검색 관련 상태
  const [lines, setLines] = useState<any[]>([{ product_id: '', product_name: '', expected_qty: 0, notes: '' }]);
  const [productSearchResults, setProductSearchResults] = useState<any[]>([]);
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [userOrgId, setUserOrgId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchMeta();
  }, []);

  // 화주사가 변경되면 해당 화주사의 상품을 미리 로드하거나 초기화
  useEffect(() => {
      if (selectedClientId) {
          // 상품 리스트 초기화 (화주사가 바뀌었으므로)
          setLines([{ product_id: '', product_name: '', expected_qty: 0, notes: '' }]);
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

  // 상품 검색 핸들러
  const handleProductSearch = (index: number, query: string) => {
      const newLines = [...lines];
      newLines[index].product_name = query; // 입력값 유지
      newLines[index].product_id = ''; // ID 초기화 (새로 검색 중이므로)
      setLines(newLines);
      
      setActiveSearchIndex(index);

      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

      if (query.length < 2) {
          setProductSearchResults([]);
          return;
      }

      searchTimeoutRef.current = setTimeout(async () => {
          // 화주사 필터링을 위해 clientId 전달 가능 (actions 수정 필요할 수 있음)
          const results = await searchProducts(query); 
          // 클라이언트 측에서 화주사 상품만 필터링 (선택사항)
          // const filtered = results.filter(...) 
          setProductSearchResults(results);
      }, 300);
  };

  const selectProduct = (index: number, product: any) => {
      const newLines = [...lines];
      newLines[index].product_id = product.id;
      newLines[index].product_name = `${product.name} (${product.sku})`;
      setLines(newLines);
      setProductSearchResults([]);
      setActiveSearchIndex(null);
  };

  const handleLineChange = (index: number, field: string, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const addLine = () => {
    setLines([...lines, { product_id: '', product_name: '', expected_qty: 0, notes: '' }]);
  };

  const removeLine = (index: number) => {
    const newLines = lines.filter((_, i) => i !== index);
    setLines(newLines);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userOrgId) {
      alert('조직 정보를 불러올 수 없습니다.');
      return;
    }
    
    // 유효성 검사
    const invalidLines = lines.filter(l => !l.product_id || l.expected_qty <= 0);
    if (invalidLines.length > 0) {
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
    const processedLines = lines.map(l => ({
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

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-6">신규 입고 예정 등록</h1>
      
      <form onSubmit={handleSubmit} className="space-y-8 bg-white p-8 rounded-xl shadow-sm border border-gray-200">
        
        {/* 기본 정보 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">화주사 (Client)</label>
            <select 
                name="client_id" 
                required 
                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">입고 예정일</label>
            <input type="date" name="planned_date" required className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">비고 (Notes)</label>
          <textarea name="notes" rows={3} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"></textarea>
        </div>

        {/* 품목 리스트 */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">입고 품목 (SKU)</h3>
            <button type="button" onClick={addLine} className="text-sm text-blue-600 hover:text-blue-800 font-medium">+ 품목 추가</button>
          </div>
          
          <div className="space-y-4">
            {lines.map((line, index) => (
              <div key={index} className="flex gap-4 items-start bg-gray-50 p-4 rounded-lg relative">
                <div className="flex-1 relative">
                  <label className="block text-xs font-medium text-gray-500 mb-1">상품 검색 (SKU/명칭)</label>
                  <input
                    type="text"
                    placeholder="상품명 또는 SKU 검색..."
                    value={line.product_name}
                    onChange={(e) => handleProductSearch(index, e.target.value)}
                    className={`w-full border-gray-300 rounded-md text-sm ${!line.product_id && line.product_name.length > 0 ? 'border-red-300 focus:border-red-500' : ''}`}
                  />
                  {!line.product_id && line.product_name.length > 0 && activeSearchIndex !== index && (
                      <p className="text-xs text-red-500 mt-1">목록에서 상품을 선택해주세요.</p>
                  )}
                  
                  {/* 검색 결과 드롭다운 */}
                  {activeSearchIndex === index && productSearchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                          {productSearchResults.map((prod) => (
                              <button
                                  key={prod.id}
                                  type="button"
                                  className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm border-b last:border-b-0"
                                  onClick={() => selectProduct(index, prod)}
                              >
                                  <div className="font-medium text-gray-900">{prod.name}</div>
                                  <div className="text-xs text-gray-500">SKU: {prod.sku}</div>
                              </button>
                          ))}
                      </div>
                  )}
                </div>
                <div className="w-32">
                  <label className="block text-xs font-medium text-gray-500 mb-1">예정 수량</label>
                  <input 
                    type="number" 
                    min="1"
                    value={line.expected_qty}
                    onChange={(e) => handleLineChange(index, 'expected_qty', parseInt(e.target.value))}
                    className="w-full border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div className="pt-6">
                  <button type="button" onClick={() => removeLine(index)} className="text-red-500 hover:text-red-700">
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-6 border-t border-gray-200 flex justify-end gap-4">
          <button type="button" onClick={() => router.back()} className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
            취소
          </button>
          <button 
            type="submit" 
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '등록 중...' : '입고 예정 등록'}
          </button>
        </div>
      </form>
    </div>
  );
}
