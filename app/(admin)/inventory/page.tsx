'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { Product } from '@/types';
import { getProducts, createProduct, updateProduct, deleteProduct, getCategories, getInventoryStats } from '@/lib/api/products';
import { getCustomers, CustomerOption } from '@/lib/api/partners';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { showSuccess, showError } from '@/lib/toast';
import { getProductStatus } from '@/utils/inventory-status';
import InventoryFilter from '@/components/inventory/InventoryFilter';
import InventoryTable from '@/components/inventory/InventoryTable';
import ProductFormModal from '@/components/inventory/ProductFormModal';
import ProductBulkUploadModal from '@/components/inventory/ProductBulkUploadModal';

export default function InventoryPage() {
  const queryClient = useQueryClient();
  
  // 상태 관리
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState(''); // 디바운싱용
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledgerRows, setLedgerRows] = useState<any[]>([]); // 타입 정의 필요 (나중에)
  const [ledgerProduct, setLedgerProduct] = useState<Product | null>(null);
  
  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  // 검색어 디바운싱
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // 검색어 변경 시 1페이지로
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // 필터 변경 시 1페이지로
  const handleCategoryChange = (val: string) => {
    setSelectedCategory(val);
    setPage(1);
  };
  const handleStatusChange = (val: string) => {
    setSelectedStatus(val);
    setPage(1);
  };

  // React Query: 제품 목록 조회 (서버 사이드 페이징)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['products', page, debouncedSearch, selectedCategory],
    queryFn: () => getProducts({
      page,
      limit: 20, // 페이지당 20개
      search: debouncedSearch,
      category: selectedCategory,
    }),
    placeholderData: keepPreviousData, // 페이징 시 깜빡임 방지
  });

  // React Query: 카테고리 목록 조회
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
    staleTime: 1000 * 60 * 5, // 5분간 캐시 유지
  });

  // React Query: 재고 통계 조회
  const { data: stats } = useQuery({
    queryKey: ['inventory-stats'],
    queryFn: getInventoryStats,
    refetchInterval: 1000 * 60, // 1분마다 갱신
  });

  const products = data?.data || [];
  const filteredProducts = selectedStatus
    ? products.filter((product) => getProductStatus(product) === selectedStatus)
    : products;
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages || 1;

  const lowStockCount = stats?.lowStockCount || 0;
  const inboundExpectedCount = stats?.inboundExpectedCount || 0;

  // 고객사 목록 로드
  useEffect(() => {
    getCustomers().then(setCustomers).catch(console.error);
  }, []);

  // Mutations
  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      showSuccess('제품이 추가되었습니다.');
      handleCloseModal();
    },
    onError: (err: any) => showError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Product> }) => updateProduct(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      showSuccess('제품이 수정되었습니다.');
      handleCloseModal();
    },
    onError: (err: any) => showError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      showSuccess('제품이 삭제되었습니다.');
    },
    onError: (err: any) => showError(err.message),
  });

  // Handlers
  const handleOpenModal = (product?: Product) => {
    setEditingProduct(product || null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const handleBulkUploadSuccess = ({ successCount, failCount }: { successCount: number; failCount: number }) => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
    if (failCount === 0) {
      showSuccess(`엑셀 대량등록 완료: ${successCount}건`);
    } else {
      showError(`일부 실패: 성공 ${successCount}건 / 실패 ${failCount}건`);
    }
  };

  const handleSubmit = (formData: any) => {
    // React Hook Form 데이터 매핑
    // 날짜 스트링 -> Date 객체 변환 등은 createProduct 내부 혹은 여기서 처리
    // createProduct가 기대하는 타입에 맞춰서 변환
    // 여기서는 formData가 이미 적절한 형태라고 가정 (Zod 스키마가 타입 보장)
    
    // Zod 스키마에서 변환된 데이터 사용
    // 날짜 문자열 처리는 API 호출부나 폼 데이터 처리부에서 유의
    
    if (!editingProduct && !formData?.productDbNo) {
      showError('제품DB번호를 먼저 생성해주세요.');
      return;
    }

    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, updates: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('정말로 삭제하시겠습니까?')) {
      deleteMutation.mutate(id);
    }
  };

  // 원장 조회 (Legacy 코드 유지 - 별도 컴포넌트 분리 권장하지만 일단 여기에 둠)
  const openLedger = async (product: Product) => {
    setLedgerProduct(product);
    setLedgerOpen(true);
    try {
      const res = await fetch(`/api/admin/inventory/ledger?product_id=${product.id}`);
      const json = await res.json();
      setLedgerRows(res.ok ? json.data || [] : []);
    } catch (e) {
      console.error(e);
      setLedgerRows([]);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50/50">
      <Header title="재고 관리" />
      
      <main className="flex-1 p-8 overflow-y-auto">
        <InventoryFilter
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          selectedCategory={selectedCategory}
          onCategoryChange={handleCategoryChange}
          selectedStatus={selectedStatus}
          onStatusChange={handleStatusChange}
          categories={categories}
          lowStockCount={lowStockCount}
          inboundExpectedCount={inboundExpectedCount}
          onAddProduct={() => handleOpenModal()}
          onBulkUpload={() => setIsBulkModalOpen(true)}
        />

        <InventoryTable
          products={filteredProducts}
          isLoading={isLoading}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          onEdit={handleOpenModal}
          onDelete={handleDelete}
          onOpenLedger={openLedger}
        />
      </main>

      <ProductFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        initialData={editingProduct}
        customers={customers}
        categories={categories}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />

      <ProductBulkUploadModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        customers={customers}
        categories={categories}
        onSuccess={handleBulkUploadSuccess}
      />

      {/* 원장 모달 (간단해서 인라인 유지 or 추후 분리) */}
      {ledgerOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity"
              onClick={() => setLedgerOpen(false)}
            ></div>
            <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">재고 원장</h3>
                  <p className="text-xs text-gray-500">{ledgerProduct?.name}</p>
                </div>
                <button onClick={() => setLedgerOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <div className="max-h-[420px] overflow-y-auto border rounded-lg">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">일시</th>
                      <th className="px-3 py-2 text-left">유형</th>
                      <th className="px-3 py-2 text-right">변동</th>
                      <th className="px-3 py-2 text-right">잔고</th>
                      <th className="px-3 py-2 text-left">참조</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {ledgerRows.length === 0 ? (
                      <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-400">내역 없음</td></tr>
                    ) : (
                      ledgerRows.map((row, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2">{new Date(row.created_at).toLocaleString()}</td>
                          <td className="px-3 py-2">{row.transaction_type}</td>
                          <td className="px-3 py-2 text-right">{row.qty_change}</td>
                          <td className="px-3 py-2 text-right">{row.balance_after ?? '-'}</td>
                          <td className="px-3 py-2">{row.reference_type || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
