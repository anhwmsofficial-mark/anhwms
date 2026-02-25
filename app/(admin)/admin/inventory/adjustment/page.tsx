'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  MagnifyingGlassIcon, 
  ArchiveBoxIcon, 
  ArrowsRightLeftIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { Product } from '@/types';
import { createClient } from '@/utils/supabase/client';
import { formatInteger } from '@/utils/number-format';
import NumberInput from '@/components/inputs/NumberInput';

const RESOLVE_MAP_HISTORY_KEY = 'inventory_staging_resolve_map_history_v1';

type ResolveHistoryEntry = {
  productId: string;
  productName?: string;
  productSku?: string;
  updatedAt?: number;
};

const normalizeSkuKey = (sku: string) => sku.toUpperCase().replace(/[^A-Z0-9]/g, '');

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
  const [importFileName, setImportFileName] = useState('');
  const [importLimit, setImportLimit] = useState(1000);
  const [importRunning, setImportRunning] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importError, setImportError] = useState('');
  const [importRuns, setImportRuns] = useState<any[]>([]);
  const [uploadRowsText, setUploadRowsText] = useState('');
  const [uploadRunning, setUploadRunning] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [previewRunning, setPreviewRunning] = useState(false);
  const [filePreview, setFilePreview] = useState<any>(null);
  const [resolveMap, setResolveMap] = useState<Record<string, string>>({});
  const [resolveCandidates, setResolveCandidates] = useState<Record<string, any[]>>({});
  const [resolveSearchText, setResolveSearchText] = useState<Record<string, string>>({});
  const [resolveLoading, setResolveLoading] = useState<Record<string, boolean>>({});
  const [resolveMapHistory, setResolveMapHistory] = useState<Record<string, ResolveHistoryEntry>>({});

  useEffect(() => {
    fetchWarehouses();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(RESOLVE_MAP_HISTORY_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const normalized: Record<string, ResolveHistoryEntry> = {};
        Object.entries(parsed as Record<string, unknown>).forEach(([sku, value]) => {
          if (typeof value === 'string' && value) {
            normalized[sku] = {
              productId: value,
              updatedAt: 0,
            };
            return;
          }
          if (value && typeof value === 'object') {
            const candidate = value as ResolveHistoryEntry;
            if (candidate.productId) {
              normalized[sku] = {
                productId: candidate.productId,
                productName: candidate.productName || undefined,
                productSku: candidate.productSku || undefined,
                updatedAt: candidate.updatedAt || 0,
              };
            }
          }
        });
        setResolveMapHistory(normalized);
      }
    } catch {
      // ignore invalid json
    }
  }, []);

  const fetchWarehouses = async () => {
    const { data } = await supabase
      .from('warehouse')
      .select('id, name, org_id')
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

  const runStagingImport = async (dryRun: boolean) => {
    const selectedWarehouse = warehouses.find((wh) => wh.id === selectedWarehouseId);
    const tenantId = selectedWarehouse?.org_id;
    if (!tenantId) {
      setImportError('선택된 창고의 tenant(org_id) 정보를 찾을 수 없습니다.');
      return;
    }

    setImportRunning(true);
    setImportError('');
    setImportResult(null);
    try {
      const response = await fetch('/api/admin/inventory/import-staging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          sourceFileName: importFileName.trim() || null,
          dryRun,
          limit: importLimit,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'staging import 실행에 실패했습니다.');
      }
      setImportResult(payload);
      await loadImportRuns();
    } catch (error: any) {
      setImportError(error?.message || 'staging import 실행 중 오류가 발생했습니다.');
    } finally {
      setImportRunning(false);
    }
  };

  const unresolvedRows = useMemo(
    () => (Array.isArray(importResult?.unresolved) ? importResult.unresolved : []),
    [importResult],
  );

  const loadImportRuns = async () => {
    const selectedWarehouse = warehouses.find((wh) => wh.id === selectedWarehouseId);
    const tenantId = selectedWarehouse?.org_id;
    if (!tenantId) return;
    const response = await fetch(`/api/admin/inventory/import-staging/runs?tenantId=${encodeURIComponent(tenantId)}&limit=20`);
    const payload = await response.json();
    if (response.ok) {
      setImportRuns(payload?.data || []);
    }
  };

  const uploadStagingRows = async () => {
    const selectedWarehouse = warehouses.find((wh) => wh.id === selectedWarehouseId);
    const tenantId = selectedWarehouse?.org_id;
    if (!tenantId) {
      setImportError('선택된 창고의 tenant(org_id) 정보를 찾을 수 없습니다.');
      return;
    }

    let parsedRows: any[] = [];
    try {
      const json = JSON.parse(uploadRowsText || '[]');
      if (!Array.isArray(json)) throw new Error('배열 형식이어야 합니다.');
      parsedRows = json;
    } catch (error: any) {
      setImportError(`업로드 JSON 파싱 실패: ${error?.message || '형식을 확인해주세요.'}`);
      return;
    }

    if (parsedRows.length === 0) {
      setImportError('업로드할 rows가 없습니다.');
      return;
    }

    setUploadRunning(true);
    setImportError('');
    try {
      const response = await fetch('/api/admin/inventory/import-staging/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          warehouseId: selectedWarehouseId,
          sourceFileName: importFileName.trim() || null,
          rows: parsedRows,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'staging 업로드 실패');
      }
      setImportResult({
        success: true,
        dryRun: false,
        imported: payload?.inserted || 0,
        skipped: 0,
        message: 'staging 업로드 완료',
      });
    } catch (error: any) {
      setImportError(error?.message || 'staging 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploadRunning(false);
    }
  };

  const fetchResolveCandidates = async (sku: string, keyword?: string) => {
    const query = (keyword || sku || '').trim();
    if (!query) return;

    setResolveLoading((prev) => ({ ...prev, [sku]: true }));
    try {
      const response = await fetch(`/api/admin/products?search=${encodeURIComponent(query)}&limit=20`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || '후보 상품 검색 실패');
      }
      const rows = payload?.data || [];
      setResolveCandidates((prev) => ({ ...prev, [sku]: rows }));
    } catch (error) {
      console.error(error);
    } finally {
      setResolveLoading((prev) => ({ ...prev, [sku]: false }));
    }
  };

  const setResolvedProductId = (sku: string, productId: string) => {
    setResolveMap((prev) => ({ ...prev, [sku]: productId }));
    if (productId) {
      setResolveMapHistory((prev) => {
        const matchedCandidate = (resolveCandidates[sku] || []).find((candidate: any) => candidate.id === productId);
        const next: Record<string, ResolveHistoryEntry> = {
          ...prev,
          [sku]: {
            productId,
            productName: matchedCandidate?.name || prev[sku]?.productName,
            productSku: matchedCandidate?.sku || prev[sku]?.productSku,
            updatedAt: Date.now(),
          },
        };
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(RESOLVE_MAP_HISTORY_KEY, JSON.stringify(next));
        }
        return next;
      });
    }
  };

  const findHistoryFallback = (sku: string): ResolveHistoryEntry | undefined => {
    const direct = resolveMapHistory[sku];
    if (direct?.productId) return direct;

    const normalizedTarget = normalizeSkuKey(sku);
    if (!normalizedTarget) return undefined;

    const entries = Object.entries(resolveMapHistory);
    for (const [key, entry] of entries) {
      if (normalizeSkuKey(key) === normalizedTarget) {
        return entry;
      }
    }
    for (const [key, entry] of entries) {
      const normalized = normalizeSkuKey(key);
      if (!normalized) continue;
      if (
        normalizedTarget.includes(normalized) ||
        normalized.includes(normalizedTarget)
      ) {
        return entry;
      }
    }
    return undefined;
  };

  const applySuggestedMappings = (rows: any[]) => {
    if (!rows || rows.length === 0) return;
    const nextMap: Record<string, string> = {};
    for (const row of rows) {
      const sku = String(row?.sku || '');
      if (!sku) continue;
      const suggested = findHistoryFallback(sku);
      if (!suggested?.productId) continue;
      if (resolveMap[sku]) continue;
      nextMap[sku] = suggested.productId;
    }
    if (Object.keys(nextMap).length > 0) {
      setResolveMap((prev) => ({ ...prev, ...nextMap }));
    }
  };

  const uploadStagingFile = async () => {
    const selectedWarehouse = warehouses.find((wh) => wh.id === selectedWarehouseId);
    const tenantId = selectedWarehouse?.org_id;
    if (!tenantId) {
      setImportError('선택된 창고의 tenant(org_id) 정보를 찾을 수 없습니다.');
      return;
    }
    if (!uploadFile) {
      setImportError('업로드할 엑셀 파일을 선택해주세요.');
      return;
    }

    setUploadRunning(true);
    setImportError('');
    setFilePreview(null);
    try {
      const formData = new FormData();
      formData.append('tenantId', tenantId);
      formData.append('warehouseId', selectedWarehouseId);
      formData.append('sourceFileName', importFileName.trim() || uploadFile.name);
      formData.append('file', uploadFile);
      formData.append('resolveMap', JSON.stringify(resolveMap || {}));

      const response = await fetch('/api/admin/inventory/import-staging/upload-file', {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || '엑셀 staging 업로드 실패');
      }
      setImportResult({
        success: true,
        dryRun: false,
        imported: payload?.inserted || 0,
        skipped: payload?.unresolvedCount || 0,
        unresolved: payload?.unresolved || [],
        message: '엑셀 파일 staging 업로드 완료',
      });
      setUploadFile(null);
      setResolveMap({});
      setResolveCandidates({});
      setResolveSearchText({});
      setFilePreview(null);
      await loadImportRuns();
    } catch (error: any) {
      setImportError(error?.message || '엑셀 staging 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploadRunning(false);
    }
  };

  const previewStagingFile = async () => {
    const selectedWarehouse = warehouses.find((wh) => wh.id === selectedWarehouseId);
    const tenantId = selectedWarehouse?.org_id;
    if (!tenantId) {
      setImportError('선택된 창고의 tenant(org_id) 정보를 찾을 수 없습니다.');
      return;
    }
    if (!uploadFile) {
      setImportError('프리뷰할 엑셀 파일을 선택해주세요.');
      return;
    }

    setPreviewRunning(true);
    setImportError('');
    setFilePreview(null);
    try {
      const formData = new FormData();
      formData.append('tenantId', tenantId);
      formData.append('warehouseId', selectedWarehouseId);
      formData.append('sourceFileName', importFileName.trim() || uploadFile.name);
      formData.append('file', uploadFile);
      formData.append('dryRun', 'true');
      formData.append('previewLimit', '30');
      formData.append('resolveMap', JSON.stringify(resolveMap || {}));

      const response = await fetch('/api/admin/inventory/import-staging/upload-file', {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || '엑셀 프리뷰 실패');
      }
      setFilePreview(payload);
      const unresolved = Array.isArray(payload?.unresolved) ? payload.unresolved : [];
      applySuggestedMappings(unresolved);
      for (const row of unresolved) {
        const sku = String(row?.sku || '');
        if (!sku) continue;
        if (!resolveCandidates[sku]) {
          fetchResolveCandidates(sku, sku);
        }
      }
      setImportResult({
        success: true,
        dryRun: true,
        imported: payload?.insertableRows || 0,
        skipped: payload?.unresolvedCount || 0,
        unresolved: payload?.unresolved || [],
      });
    } catch (error: any) {
      setImportError(error?.message || '엑셀 프리뷰 중 오류가 발생했습니다.');
    } finally {
      setPreviewRunning(false);
    }
  };

  useEffect(() => {
    if (selectedWarehouseId) loadImportRuns();
  }, [selectedWarehouseId, warehouses]);

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

      <div className="mt-8 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <ArrowDownTrayIcon className="w-5 h-5" />
          Ledger Staging Import
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          엑셀 staging 데이터를 Ledger로 적재합니다. 먼저 Dry Run으로 미리보기 후 실제 실행하세요.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">소스 파일명(선택)</label>
            <input
              type="text"
              value={importFileName}
              onChange={(e) => setImportFileName(e.target.value)}
              placeholder="예: 2026-02-stock.xlsx"
              className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">처리 건수 제한</label>
            <NumberInput
              mode="integer"
              min={1}
              value={importLimit}
              onValueChange={(next) => setImportLimit(next)}
              className="w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => runStagingImport(true)}
              disabled={importRunning}
              className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              {importRunning ? '처리 중...' : 'Dry Run'}
            </button>
            <button
              type="button"
              onClick={() => runStagingImport(false)}
              disabled={importRunning}
              className="flex-1 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {importRunning ? '처리 중...' : '실행'}
            </button>
          </div>
        </div>

        <div className="mb-3 flex justify-end">
          <a
            href="/api/admin/inventory/import-staging/template"
            className="text-sm text-blue-600 hover:text-blue-700 underline"
          >
            템플릿 다운로드 (CSV)
          </a>
        </div>

        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="text-sm font-medium text-gray-700 mb-2">엑셀 파일 업로드</div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 mb-3">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={previewStagingFile}
              disabled={previewRunning || !uploadFile}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm disabled:opacity-50"
            >
              {previewRunning ? '프리뷰 중...' : '파일 프리뷰'}
            </button>
            <button
              type="button"
              onClick={uploadStagingFile}
              disabled={uploadRunning || !uploadFile}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
            >
              {uploadRunning ? '업로드 중...' : '엑셀 → Staging 업로드'}
            </button>
          </div>
          {unresolvedRows.length > 0 && (
            <div className="mb-3 rounded border border-amber-200 bg-amber-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-amber-800">
                  미매칭 SKU 재매핑 ({formatInteger(unresolvedRows.length)}건)
                </div>
                <button
                  type="button"
                  onClick={() => applySuggestedMappings(unresolvedRows)}
                  className="rounded border border-amber-300 bg-white px-2 py-1 text-[11px] text-amber-700"
                >
                  추천 전체 적용
                </button>
              </div>
              <div className="space-y-2 max-h-64 overflow-auto">
                {unresolvedRows.map((row: any, idx: number) => {
                  const sku = String(row?.sku || '');
                  const candidates = resolveCandidates[sku] || [];
                  const selected = resolveMap[sku] || '';
                  const suggestedEntry = findHistoryFallback(sku);
                  const suggestedProductId = suggestedEntry?.productId || '';
                  const suggestedLabel = suggestedEntry?.productName
                    ? `${suggestedEntry.productName} (${suggestedEntry.productSku || suggestedProductId})`
                    : suggestedProductId;
                  const searching = resolveLoading[sku];
                  const keyword = resolveSearchText[sku] ?? sku;
                  return (
                    <div key={`${sku}-${idx}`} className="grid grid-cols-1 md:grid-cols-[120px_1fr_1fr_auto] gap-2 items-center">
                      <div className="text-xs font-mono text-amber-900">{sku}</div>
                      <input
                        type="text"
                        value={keyword}
                        onChange={(e) =>
                          setResolveSearchText((prev) => ({ ...prev, [sku]: e.target.value }))
                        }
                        className="rounded border border-amber-300 px-2 py-1 text-xs"
                        placeholder="검색어"
                      />
                      <select
                        value={selected}
                        onChange={(e) => setResolvedProductId(sku, e.target.value)}
                        className="rounded border border-amber-300 px-2 py-1 text-xs"
                      >
                        <option value="">상품 선택</option>
                        {candidates.map((candidate: any) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.name} ({candidate.sku})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => fetchResolveCandidates(sku, resolveSearchText[sku] || sku)}
                        className="rounded bg-white border border-amber-300 px-3 py-1 text-xs text-amber-700"
                      >
                        {searching ? '검색중' : '검색'}
                      </button>
                      {suggestedProductId && !selected && (
                        <div className="md:col-start-2 md:col-end-5 flex items-center gap-2 text-[11px] text-amber-700">
                          <span>추천: {suggestedLabel}</span>
                          <button
                            type="button"
                            onClick={() => setResolvedProductId(sku, suggestedProductId)}
                            className="rounded border border-amber-300 bg-white px-2 py-0.5"
                          >
                            추천 적용
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 text-[11px] text-amber-700">
                선택한 매핑은 다음 프리뷰/업로드 요청에 자동 반영됩니다.
              </div>
            </div>
          )}
          {filePreview && (
            <div className="rounded border border-gray-200 bg-white p-3 text-xs text-gray-700">
              <div className="mb-2 font-medium">파일 프리뷰 결과</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                <div>원본행: {formatInteger(filePreview.selectedRows || 0)}</div>
                <div>적재가능: {formatInteger(filePreview.insertableRows || 0)}</div>
                <div>미매칭: {formatInteger(filePreview.unresolvedCount || 0)}</div>
                <div>DryRun: {filePreview.dryRun ? 'Y' : 'N'}</div>
              </div>
              {Array.isArray(filePreview.preview) && filePreview.preview.length > 0 && (
                <div className="max-h-56 overflow-auto rounded border border-gray-100 bg-gray-50 p-2">
                  <table className="w-full text-[11px]">
                    <thead className="sticky top-0 bg-gray-100 text-gray-600">
                      <tr>
                        <th className="px-2 py-1 text-left">product_id</th>
                        <th className="px-2 py-1 text-right">opening</th>
                        <th className="px-2 py-1 text-right">inbound</th>
                        <th className="px-2 py-1 text-right">outbound</th>
                        <th className="px-2 py-1 text-left">memo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filePreview.preview.map((row: any, idx: number) => (
                        <tr key={`${row.product_id}-${idx}`} className="border-t border-gray-200">
                          <td className="px-2 py-1 font-mono">{row.product_id}</td>
                          <td className="px-2 py-1 text-right">{formatInteger(row.opening_stock || 0)}</td>
                          <td className="px-2 py-1 text-right">{formatInteger(row.inbound_qty || 0)}</td>
                          <td className="px-2 py-1 text-right">{formatInteger(row.outbound_qty || 0)}</td>
                          <td className="px-2 py-1">{row.memo || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="text-sm font-medium text-gray-700 mb-2">Staging Rows 업로드(JSON)</div>
          <textarea
            rows={6}
            value={uploadRowsText}
            onChange={(e) => setUploadRowsText(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-mono"
            placeholder='[{"productId":"uuid","openingStock":100,"inboundQty":20,"memo":"초기 업로드"}]'
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={uploadStagingRows}
              disabled={uploadRunning}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm disabled:opacity-50"
            >
              {uploadRunning ? '업로드 중...' : 'Staging 업로드'}
            </button>
          </div>
        </div>

        {importError && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {importError}
          </div>
        )}

        {importResult && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-gray-500">성공</div>
                <div className="font-semibold text-gray-900">{importResult.success ? 'Y' : 'N'}</div>
              </div>
              <div>
                <div className="text-gray-500">Dry Run</div>
                <div className="font-semibold text-gray-900">{importResult.dryRun ? 'Y' : 'N'}</div>
              </div>
              <div>
                <div className="text-gray-500">처리</div>
                <div className="font-semibold text-gray-900">{formatInteger(importResult.imported ?? importResult.previewCount ?? 0)}</div>
              </div>
              <div>
                <div className="text-gray-500">스킵</div>
                <div className="font-semibold text-gray-900">{formatInteger(importResult.skipped ?? 0)}</div>
              </div>
            </div>
            {Array.isArray(importResult.sample) && importResult.sample.length > 0 && (
              <pre className="mt-3 max-h-56 overflow-auto rounded bg-white p-3 text-xs text-gray-700 border border-gray-200">
                {JSON.stringify(importResult.sample, null, 2)}
              </pre>
            )}
            {Array.isArray(importResult.unresolved) && importResult.unresolved.length > 0 && (
              <div className="mt-3 max-h-56 overflow-auto rounded bg-white p-3 text-xs border border-amber-200">
                <div className="mb-2 font-medium text-amber-700">미매칭 목록</div>
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-amber-50 text-amber-700">
                    <tr>
                      <th className="px-2 py-1 text-left">row</th>
                      <th className="px-2 py-1 text-left">sku</th>
                      <th className="px-2 py-1 text-left">reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.unresolved.map((u: any, idx: number) => (
                      <tr key={`${u.sku}-${idx}`} className="border-t border-amber-100">
                        <td className="px-2 py-1">{u.rawRowNo}</td>
                        <td className="px-2 py-1 font-mono">{u.sku}</td>
                        <td className="px-2 py-1">{u.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 rounded-lg border border-gray-200 bg-white">
          <div className="px-3 py-2 border-b border-gray-100 text-sm font-medium text-gray-700">최근 Import 실행 이력</div>
          {importRuns.length === 0 ? (
            <div className="px-3 py-4 text-sm text-gray-500">이력이 없습니다.</div>
          ) : (
            <div className="max-h-56 overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">일시</th>
                    <th className="px-3 py-2 text-left">파일</th>
                    <th className="px-3 py-2 text-left">Dry</th>
                    <th className="px-3 py-2 text-right">선택</th>
                    <th className="px-3 py-2 text-right">적재</th>
                    <th className="px-3 py-2 text-right">스킵</th>
                    <th className="px-3 py-2 text-left">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {importRuns.map((run) => (
                    <tr key={run.id} className="border-t border-gray-100">
                      <td className="px-3 py-2">{new Date(run.created_at).toLocaleString('ko-KR')}</td>
                      <td className="px-3 py-2">{run.source_file_name || '-'}</td>
                      <td className="px-3 py-2">{run.dry_run ? 'Y' : 'N'}</td>
                      <td className="px-3 py-2 text-right">{formatInteger(run.selected_count || 0)}</td>
                      <td className="px-3 py-2 text-right">{formatInteger(run.imported_count || 0)}</td>
                      <td className="px-3 py-2 text-right">{formatInteger(run.skipped_count || 0)}</td>
                      <td className="px-3 py-2">{run.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

