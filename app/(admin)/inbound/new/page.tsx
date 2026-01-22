'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { createInboundPlan } from '@/app/actions/inbound';

export default function NewInboundPlanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]); // SKU 목록
  const [lines, setLines] = useState<any[]>([{ product_id: '', expected_qty: 0, notes: '' }]);
  const [userOrgId, setUserOrgId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchMeta();
  }, []);

  const fetchMeta = async () => {
    // 1. 사용자 정보 및 Org ID 가져오기
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // 실제로는 users 테이블에서 org_id 조회해야 함. 여기서는 데모용으로 첫 번째 Org 선택
      const { data: orgs } = await supabase.from('org').select('id').limit(1);
      if (orgs && orgs.length > 0) setUserOrgId(orgs[0].id);
    }

    // 2. 화주사 목록
    const { data: clientData } = await supabase.from('customer_master').select('id, name, code');
    if (clientData) setClients(clientData);

    // 3. 상품 목록 (SKU) - 실제로는 화주사 선택 시 필터링해야 함
    // 임시로 전체 조회 (데모용)
    // products 테이블이 없으면 생성 필요. 여기서는 일단 빈 배열 혹은 하드코딩
    // const { data: productData } = await supabase.from('products').select('id, name, sku');
    // if (productData) setProducts(productData);
    
    // 데모용 상품 데이터 (DB에 products 테이블이 없거나 비어있을 수 있음)
    setProducts([
      { id: 'prod-001', name: '기본 티셔츠 Black/L', sku: 'TS-BLK-L' },
      { id: 'prod-002', name: '기본 티셔츠 Black/M', sku: 'TS-BLK-M' },
      { id: 'prod-003', name: '청바지 Blue/30', sku: 'JN-BLU-30' },
    ]);
  };

  const handleLineChange = (index: number, field: string, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const addLine = () => {
    setLines([...lines, { product_id: '', expected_qty: 0, notes: '' }]);
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

    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.append('org_id', userOrgId);
    
    // Warehouse ID도 필수 (데모용 하드코딩 또는 조회)
    // 실제로는 창고 선택 UI 필요
    const { data: wh } = await supabase.from('warehouse').select('id').limit(1);
    const warehouseId = wh && wh.length > 0 ? wh[0].id : userOrgId; // Fallback
    formData.append('warehouse_id', warehouseId);

    // Lines 데이터를 JSON 문자열로 변환하여 전송
    // 실제 SKU ID 매핑 필요 (데모에서는 하드코딩된 ID 사용)
    const processedLines = lines.map(l => ({
        ...l,
        product_id: l.product_id || '00000000-0000-0000-0000-000000000000' // UUID 형식 필요
    }));
    formData.append('lines', JSON.stringify(processedLines));

    const result = await createInboundPlan(formData);
    
    setLoading(false);
    if (result?.error) {
      alert('오류 발생: ' + result.error);
    } else {
      // 성공 시 목록으로 이동
      // actions.ts에서 redirect 처리하므로 여기는 도달 안 할 수 있음
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
            <select name="client_id" required className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500">
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
              <div key={index} className="flex gap-4 items-start bg-gray-50 p-4 rounded-lg">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">상품 선택</label>
                  <select 
                    value={line.product_id}
                    onChange={(e) => handleLineChange(index, 'product_id', e.target.value)}
                    className="w-full border-gray-300 rounded-md text-sm"
                  >
                    <option value="">상품을 선택하세요</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                    ))}
                  </select>
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
