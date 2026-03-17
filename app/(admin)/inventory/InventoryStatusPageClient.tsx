'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { Product } from '@/types';
import { getProducts, createProduct, updateProduct, deleteProduct, getCategories, getInventoryStats } from '@/lib/api/products';
import { getCustomers, CustomerOption } from '@/lib/api/partners';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { showSuccess, showError } from '@/lib/toast';
import { normalizeInlineError } from '@/lib/api/client';
import { queryKeys } from '@/lib/queryKeys';
import { getProductStatus } from '@/utils/inventory-status';
import InventoryFilter from '@/components/inventory/InventoryFilter';
import InventoryTable from '@/components/inventory/InventoryTable';
import ProductFormModal from '@/components/inventory/ProductFormModal';
import ProductBulkUploadModal from '@/components/inventory/ProductBulkUploadModal';
import InventoryVolumeUploadModal from '@/components/inventory/InventoryVolumeUploadModal';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function InventoryStatusPageClient() {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isVolumeModalOpen, setIsVolumeModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledgerRows, setLedgerRows] = useState<any[]>([]);
  const [ledgerProduct, setLedgerProduct] = useState<Product | null>(null);

  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleCategoryChange = (val: string) => {
    setSelectedCategory(val);
    setPage(1);
  };

  const handleStatusChange = (val: string) => {
    setSelectedStatus(val);
    setPage(1);
  };

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.products.list({
      page,
      search: debouncedSearch,
      category: selectedCategory,
    }),
    queryFn: () =>
      getProducts({
        page,
        limit: 20,
        search: debouncedSearch,
        category: selectedCategory,
      }),
    placeholderData: keepPreviousData,
  });

  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.products.categories,
    queryFn: getCategories,
    staleTime: 1000 * 60 * 5,
  });

  const { data: stats } = useQuery({
    queryKey: queryKeys.products.inventoryStats,
    queryFn: getInventoryStats,
    refetchInterval: 1000 * 60,
  });

  const products = data?.data || [];
  const filteredProducts = selectedStatus
    ? products.filter((product) => getProductStatus(product) === selectedStatus)
    : products;
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages || 1;

  const lowStockCount = stats?.lowStockCount || 0;
  const inboundExpectedCount = stats?.inboundExpectedCount || 0;

  useEffect(() => {
    getCustomers().then(setCustomers).catch(console.error);
  }, []);

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      showSuccess('제품이 추가되었습니다.');
      handleCloseModal();
    },
    onError: (err: unknown) => showError(normalizeInlineError(err, '제품 추가에 실패했습니다.').message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Product> }) => updateProduct(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      showSuccess('제품이 수정되었습니다.');
      handleCloseModal();
    },
    onError: (err: unknown) => showError(normalizeInlineError(err, '제품 수정에 실패했습니다.').message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      showSuccess('제품이 삭제되었습니다.');
    },
    onError: (err: unknown) => showError(normalizeInlineError(err, '제품 삭제에 실패했습니다.').message),
  });

  const handleOpenModal = (product?: Product) => {
    setEditingProduct(product || null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const handleBulkUploadSuccess = ({ successCount, failCount }: { successCount: number; failCount: number }) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    if (failCount === 0) {
      showSuccess(`엑셀 대량등록 완료: ${successCount}건`);
    } else {
      showError(`일부 실패: 성공 ${successCount}건 / 실패 ${failCount}건`);
    }
  };

  const handleVolumeUploadSuccess = () => {
    showSuccess('물동량 업로드가 완료되었습니다.');
  };

  const handleSubmit = (formData: any) => {
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
      <Header title="재고 현황" />

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
          onVolumeUpload={() => setIsVolumeModalOpen(true)}
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

      <InventoryVolumeUploadModal
        isOpen={isVolumeModalOpen}
        onClose={() => setIsVolumeModalOpen(false)}
        customers={customers}
        onSuccess={handleVolumeUploadSuccess}
      />

      <Dialog open={ledgerOpen} onOpenChange={(open) => !open && setLedgerOpen(false)}>
        <DialogContent className="max-w-2xl p-6">
          <DialogHeader>
            <DialogTitle>재고 원장</DialogTitle>
            <DialogDescription>{ledgerProduct?.name}</DialogDescription>
          </DialogHeader>
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
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-gray-400">
                      내역 없음
                    </td>
                  </tr>
                ) : (
                  ledgerRows.map((row, idx) => (
                    <tr key={row.id || idx}>
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
          <div className="flex justify-end pt-3">
            <Button variant="outline" onClick={() => setLedgerOpen(false)}>
              닫기
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
