'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  MagnifyingGlassIcon, 
  ArchiveBoxIcon, 
  ArrowsRightLeftIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { Product } from '@/types';
import { createClient } from '@/utils/supabase/client';
import { formatInteger } from '@/utils/number-format';
import NumberInput from '@/components/inputs/NumberInput';

export default function InventoryAdjustmentPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const supabase = createClient();
  
  // 조정 폼 상태
  const [adjustType, setAdjustType] = useState<'INCREASE' | 'DECREASE' | 'SET'>('SET');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const fetchWarehouses = async () => {
    const { data } = await supabase
      .from('warehouse')
      .select('id, name')
      .eq('status', 'ACTIVE')
      .order('name');
    setWarehouses(data || []);
    if (data && data.length > 0) setSelectedWarehouseId(data[0].id);
  };

  // 상품 검색
  const searchProducts = async () => {
    if (!searchTerm.trim()) return;
    setLoading(true);
    setProducts([]);
    try {
      // 기존 상품 검색 API 활용 (없으면 직접 구현 필요, 여기서는 예시)
      // 실제로는 /api/products?search=... 호출
      const res = await fetch(`/api/admin/products?search=${encodeURIComponent(searchTerm)}`); 
      if (!res.ok) throw new Error('검색 실패');
      const data = await res.json();
      // data 구조에 따라 products 추출
      const rows = data.data || data.products || data;
      const mapped = (rows || []).map((row: any) => ({
        ...row,
        quantity: row.inventory_total?.[0]?.sum || row.quantity || 0,
      }));
      setProducts(mapped); 
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setQuantity('');
    setReason('');
    setSuccessMsg('');
    setAdjustType('SET');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || quantity === '' || !reason.trim()) return;

    // 안전장치: 대량 변경 경고
    const qtyNum = Number(quantity);
    if (adjustType === 'SET' && Math.abs(qtyNum - selectedProduct.quantity) > 100) {
      if (!confirm(`재고 차이가 큽니다 (${selectedProduct.quantity} -> ${qtyNum}). 진행하시겠습니까?`)) return;
    }

    setSubmitLoading(true);
    try {
      const res = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          adjustType,
          quantity: qtyNum,
          reason,
          warehouseId: selectedWarehouseId
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '조정 실패');
      }

      const result = await res.json();
      setSuccessMsg(`재고가 조정되었습니다. (현재고: ${result.currentStock})`);
      
      // 로컬 상태 업데이트
      setSelectedProduct({
        ...selectedProduct,
        quantity: result.currentStock
      });
      
      // 폼 초기화
      setQuantity('');
      setReason('');
      
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">재고 조정 (실사 반영)</h1>
        <p className="text-sm text-gray-500 mt-1">
          파손, 분실, 실사 차이 등으로 인한 재고 수량을 수동으로 조정합니다. 모든 변경은 기록됩니다.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* 왼쪽: 상품 검색 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MagnifyingGlassIcon className="w-5 h-5" />
            상품 검색
          </h2>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="상품명, SKU, 바코드..."
              className="flex-1 border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchProducts()}
            />
            <button 
              onClick={searchProducts}
              disabled={loading}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              검색
            </button>
          </div>
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1">창고</label>
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            >
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>{wh.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="text-center py-4 text-gray-500">검색 중...</div>
            ) : products.length > 0 ? (
              products.map(product => (
                <div 
                  key={product.id}
                  onClick={() => handleSelectProduct(product)}
                  className={`
                    p-3 rounded-lg border cursor-pointer transition-all
                    ${selectedProduct?.id === product.id 
                      ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' 
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
                  `}
                >
                  <div className="font-medium text-gray-900">{product.name}</div>
                  <div className="text-sm text-gray-500 flex justify-between mt-1">
                    <span>{product.sku}</span>
                    <span className="font-mono bg-gray-100 px-1 rounded">
                      현재고: {formatInteger(product.quantity)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">
                상품을 검색하여 선택해주세요.
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽: 조정 폼 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 relative">
          {!selectedProduct && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-xl">
              <div className="text-gray-400 flex flex-col items-center">
                <ArchiveBoxIcon className="w-10 h-10 mb-2" />
                <span>왼쪽에서 상품을 선택해주세요</span>
              </div>
            </div>
          )}

          <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <ArrowsRightLeftIcon className="w-5 h-5" />
            수량 조정
          </h2>

          {selectedProduct && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="font-medium text-lg">{selectedProduct.name}</div>
              <div className="flex gap-4 mt-2 text-sm text-gray-600">
                <div>SKU: {selectedProduct.sku}</div>
                <div>위치: {selectedProduct.location || '미지정'}</div>
                <div className="font-bold text-blue-600">현재고: {formatInteger(selectedProduct.quantity)}</div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">조정 유형</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'SET', label: '수량 변경 (실사)' },
                  { id: 'INCREASE', label: '입고 (추가)' },
                  { id: 'DECREASE', label: '출고 (차감)' },
                ].map(type => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setAdjustType(type.id as any)}
                    className={`
                      py-2 px-3 text-sm font-medium rounded-lg border
                      ${adjustType === type.id
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}
                    `}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {adjustType === 'SET' ? '실제 수량 (변경 후)' : '조정 수량'}
              </label>
              <NumberInput
                mode="integer"
                min={0}
                className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder="0"
                value={typeof quantity === 'number' ? quantity : 0}
                onValueChange={(next) => setQuantity(next)}
              />
              {adjustType === 'SET' && selectedProduct && quantity !== '' && (
                 <p className={`text-sm mt-1 ${
                   Number(quantity) - selectedProduct.quantity > 0 ? 'text-green-600' : 'text-red-600'
                 }`}>
                   변동폭: {Number(quantity) - selectedProduct.quantity > 0 ? '+' : ''}
                   {formatInteger(Number(quantity) - selectedProduct.quantity)}
                 </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                사유 (필수)
              </label>
              <textarea
                required
                rows={3}
                className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder="예: 정기 재고 실사 차이 반영, 파손 폐기 등"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            {/* 경고 메시지 (차감 시) */}
            {adjustType === 'DECREASE' && (
              <div className="flex items-start gap-2 p-3 bg-yellow-50 text-yellow-800 rounded-lg text-sm">
                <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
                <span>재고를 차감하면 복구할 수 없습니다. 파손/분실이 확실한지 확인하세요.</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitLoading || quantity === ''}
              className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
            >
              {submitLoading ? '처리 중...' : '재고 조정 실행'}
            </button>

            {successMsg && (
              <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg animate-fade-in">
                <CheckCircleIcon className="w-5 h-5" />
                {successMsg}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

