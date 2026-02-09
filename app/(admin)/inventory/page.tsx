'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { Product } from '@/types';
import { getProducts, createProduct, updateProduct, deleteProduct } from '@/lib/api/products';
import { getCustomers, CustomerOption } from '@/lib/api/partners';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { showSuccess, showError } from '@/lib/toast';
import { cn } from '@/lib/utils';

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [selectedStatus, setSelectedStatus] = useState('전체'); // 전체, 정상, 주의, 재고부족, 입고예정
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledgerRows, setLedgerRows] = useState<any[]>([]);
  const [ledgerProduct, setLedgerProduct] = useState<Product | null>(null);
  
  type ProductFormState = {
    customerId: string;
    name: string;
    manageName: string;
    userCode: string;
    sku: string;
    barcode: string;
    productDbNo: string;
    category: string;
    manufactureDate: string;
    expiryDate: string;
    optionSize: string;
    optionColor: string;
    optionLot: string;
    optionEtc: string;
    quantity: number;
    unit: string;
    minStock: number;
    price: number;
    costPrice: number;
    location: string;
    description: string;
  };

  const toDateInput = (value?: Date | null) => {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  };

  const buildFormState = (product?: Product): ProductFormState => ({
    customerId: product?.customerId ?? '',
    name: product?.name ?? '',
    manageName: product?.manageName ?? '',
    userCode: product?.userCode ?? '',
    sku: product?.sku ?? '',
    barcode: product?.barcode ?? '',
    productDbNo: product?.productDbNo ?? '',
    category: product?.category ?? '',
    manufactureDate: toDateInput(product?.manufactureDate ?? null),
    expiryDate: toDateInput(product?.expiryDate ?? null),
    optionSize: product?.optionSize ?? '',
    optionColor: product?.optionColor ?? '',
    optionLot: product?.optionLot ?? '',
    optionEtc: product?.optionEtc ?? '',
    quantity: product?.quantity ?? 0,
    unit: product?.unit ?? '개',
    minStock: product?.minStock ?? 0,
    price: product?.price ?? 0,
    costPrice: product?.costPrice ?? 0,
    location: product?.location ?? '',
    description: product?.description ?? '',
  });

  // 폼 데이터 상태
  const [formData, setFormData] = useState<ProductFormState>(buildFormState());

  // React Query: 제품 목록 조회
  const { data: products = [], isLoading, isError } = useQuery({
    queryKey: ['products'],
    queryFn: getProducts,
  });

  useEffect(() => {
    getCustomers()
      .then(setCustomers)
      .catch((error) => {
        const message = error instanceof Error ? error.message : '고객사 목록을 불러오지 못했습니다.';
        showError(message);
        console.error(error);
      });
  }, []);

  // React Query: 제품 생성
  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      showSuccess('제품이 성공적으로 추가되었습니다.');
      handleCloseModal();
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '제품 추가 중 오류가 발생했습니다.';
      showError(message);
      console.error(error);
    },
  });

  // React Query: 제품 수정
  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Product> }) => 
      updateProduct(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      showSuccess('제품이 성공적으로 수정되었습니다.');
      handleCloseModal();
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '제품 수정 중 오류가 발생했습니다.';
      showError(message);
      console.error(error);
    },
  });

  // React Query: 제품 삭제
  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      showSuccess('제품이 삭제되었습니다.');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '제품 삭제 중 오류가 발생했습니다.';
      showError(message);
      console.error(error);
    },
  });

  // 카테고리 목록 추출
  const categories = ['전체', ...Array.from(new Set(products.map(p => p.category)))];

  // 상태 계산 헬퍼 함수
  const getProductStatus = (product: Product) => {
    if (product.quantity < product.minStock && (product.expectedInbound || 0) > 0) return '입고예정';
    if (product.quantity < product.minStock) return '재고부족';
    if (product.quantity < product.minStock * 2) return '주의';
    return '정상';
  };

  // 필터링 로직
  const filteredProducts = products.filter(product => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = !term || [
      product.customerId || '',
      product.name,
      product.manageName || '',
      product.userCode || '',
      product.sku,
      product.barcode || '',
      product.productDbNo || '',
      product.category,
      product.location,
      product.description || '',
    ].some((value) => (value || '').toLowerCase().includes(term));
    const matchesCategory = selectedCategory === '전체' || product.category === selectedCategory;
    
    let matchesStatus = true;
    if (selectedStatus !== '전체') {
      matchesStatus = getProductStatus(product) === selectedStatus;
    }

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const lowStockCount = products.filter(p => p.quantity < p.minStock && (p.expectedInbound || 0) === 0).length;
  const inboundExpectedCount = products.filter(p => p.quantity < p.minStock && (p.expectedInbound || 0) > 0).length;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  };

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData(buildFormState(product));
    } else {
      setEditingProduct(null);
      setFormData(buildFormState());
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setFormData(buildFormState());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 유효성 검사 (간단)
    if (!formData.customerId || !formData.name || !formData.sku || !formData.category) {
      showError('필수 항목(고객사, 상품명, SKU, 카테고리)을 모두 입력해주세요.');
      return;
    }

    const payload: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> = {
      customerId: formData.customerId || null,
      name: formData.name,
      manageName: formData.manageName || null,
      userCode: formData.userCode || null,
      sku: formData.sku,
      barcode: formData.barcode || undefined,
      productDbNo: formData.productDbNo || null,
      category: formData.category,
      manufactureDate: formData.manufactureDate ? new Date(formData.manufactureDate) : null,
      expiryDate: formData.expiryDate ? new Date(formData.expiryDate) : null,
      optionSize: formData.optionSize || null,
      optionColor: formData.optionColor || null,
      optionLot: formData.optionLot || null,
      optionEtc: formData.optionEtc || null,
      quantity: formData.quantity,
      unit: formData.unit,
      minStock: formData.minStock,
      price: formData.price,
      costPrice: formData.costPrice,
      location: formData.location,
      description: formData.description,
    };

    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, updates: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const computeProductDbNo = () => {
    if (!formData.customerId || !formData.category) return '';
    const categoryRaw = formData.category.replace(/[^0-9a-zA-Z가-힣]/g, '');
    const categoryPart = categoryRaw ? categoryRaw.slice(0, 3).toUpperCase() : 'UNK';
    const customerPart = formData.customerId.replace(/-/g, '').slice(0, 8);
    const barcodePart = formData.barcode || 'AUTO';
    return `${customerPart}${barcodePart}${categoryPart}`;
  };

  const handleDelete = (id: string) => {
    if (confirm('정말로 이 제품을 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.')) {
      deleteMutation.mutate(id);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = 'lowStockAlertAt';
    const last = Number(window.localStorage.getItem(key) || 0);
    const now = Date.now();
    if (now - last > 6 * 60 * 60 * 1000) {
      fetch('/api/admin/alerts/low-stock').finally(() => {
        window.localStorage.setItem(key, String(now));
      });
    }
  }, []);

  const openLedger = async (product: Product) => {
    setLedgerProduct(product);
    setLedgerOpen(true);
    const res = await fetch(`/api/admin/inventory/ledger?product_id=${product.id}`);
    const data = await res.json();
    if (res.ok) {
      setLedgerRows(data.data || []);
    } else {
      setLedgerRows([]);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50/50">
      <Header title="재고 관리" />
      
      <main className="flex-1 p-8 overflow-y-auto">
        {/* 상단 컨트롤 바 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
            {/* 검색 및 필터 그룹 */}
            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
              <div className="relative flex-1 min-w-[280px]">
                <input
                  type="text"
                  placeholder="제품명, SKU, 바코드, 카테고리, 위치 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-11 pr-4 text-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                />
                <MagnifyingGlassIcon className="absolute left-3.5 top-3 h-5 w-5 text-gray-400" />
              </div>
              
              <div className="flex gap-2">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm hover:border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>

                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm hover:border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="전체">모든 상태</option>
                  <option value="정상">🟢 정상</option>
                  <option value="주의">🟡 주의</option>
                  <option value="입고예정">🔵 입고예정</option>
                  <option value="재고부족">🔴 재고부족</option>
                </select>
              </div>
            </div>

            {/* 액션 버튼 */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-3 w-full lg:w-auto">
              <div className="flex gap-2 text-xs">
                <span className="px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
                  재고부족 {lowStockCount}
                </span>
                <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  입고예정 {inboundExpectedCount}
                </span>
              </div>
              <button
                onClick={() => handleOpenModal()}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-all shadow-sm hover:shadow-md active:scale-95 w-full md:w-auto justify-center"
              >
                <PlusIcon className="h-5 w-5" />
                제품 추가
              </button>
            </div>
          </div>
        </div>

        {/* 제품 목록 테이블 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-500 text-sm">데이터를 불러오는 중입니다...</p>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-20 text-red-500">
              <ExclamationTriangleIcon className="h-10 w-10 mb-2" />
              <p>데이터를 불러오는데 실패했습니다.</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <div className="bg-gray-50 p-4 rounded-full mb-4">
                <MagnifyingGlassIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-lg font-medium text-gray-900">검색 결과가 없습니다</p>
              <p className="text-sm">다른 검색어나 필터를 시도해보세요.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">제품 정보</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">카테고리</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">재고 현황</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">입고 예정</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">단가</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">위치</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">상태</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">관리</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filteredProducts.map((product) => {
                    const status = getProductStatus(product);
                    return (
                      <tr key={product.id} className="hover:bg-gray-50/80 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900">{product.name}</span>
                            <span className="text-xs text-gray-500 font-mono mt-0.5">{product.sku}</span>
                            {product.barcode && (
                              <span className="text-xs text-gray-400 font-mono mt-0.5">{product.barcode}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {product.category}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "text-sm font-semibold",
                                status === '재고부족' ? 'text-red-600' : 
                                status === '주의' ? 'text-amber-600' : 
                                status === '입고예정' ? 'text-blue-600' : 'text-gray-900'
                              )}>
                                {product.quantity.toLocaleString()} {product.unit}
                              </span>
                            </div>
                            <span className="text-xs text-gray-400">최소 {product.minStock} {product.unit}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {product.expectedInbound && product.expectedInbound > 0 ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                              +{product.expectedInbound.toLocaleString()} {product.unit}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatCurrency(product.price)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-gray-300"></span>
                            {product.location}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ring-1 ring-inset",
                            status === '재고부족' ? 'bg-red-50 text-red-700 ring-red-600/20' :
                            status === '주의' ? 'bg-amber-50 text-amber-700 ring-amber-600/20' :
                            status === '입고예정' ? 'bg-blue-50 text-blue-700 ring-blue-600/20' :
                            'bg-green-50 text-green-700 ring-green-600/20'
                          )}>
                            {status === '재고부족' && <ExclamationTriangleIcon className="w-3 h-3 mr-1" />}
                            {status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => window.open(`/inbound?sku=${encodeURIComponent(product.sku)}`, '_blank')}
                              className="px-2 py-1 text-xs text-gray-600 border border-gray-200 rounded hover:bg-gray-50"
                              title="입고 현황"
                            >
                              입고
                            </button>
                            <button
                              onClick={() => openLedger(product)}
                              className="px-2 py-1 text-xs text-gray-600 border border-gray-200 rounded hover:bg-gray-50"
                              title="재고 원장"
                            >
                              원장
                            </button>
                            <button
                              onClick={() => handleOpenModal(product)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              title="수정"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(product.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="삭제"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* 모달: 제품 추가/수정 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div 
              className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity" 
              onClick={handleCloseModal}
            ></div>
            
            <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8 transform transition-all">
              <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                {editingProduct ? (
                  <>
                    <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                      <PencilIcon className="w-6 h-6" />
                    </div>
                    제품 수정
                  </>
                ) : (
                  <>
                    <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                      <PlusIcon className="w-6 h-6" />
                    </div>
                    새 제품 추가
                  </>
                )}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">고객사 <span className="text-red-500">*</span></label>
                    <select
                      required
                      value={formData.customerId}
                      onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                    >
                      <option value="">고객사 선택</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">제품명 <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                      placeholder="예: 무선 마우스"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">관리명</label>
                    <input
                      type="text"
                      value={formData.manageName}
                      onChange={(e) => setFormData({ ...formData, manageName: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                      placeholder="내부 관리용 명칭"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">사용자코드</label>
                    <input
                      type="text"
                      value={formData.userCode}
                      onChange={(e) => setFormData({ ...formData, userCode: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                      placeholder="고객사 내부 코드"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">SKU (식별코드) <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                      placeholder="예: ELEC-001"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">바코드</label>
                    <input
                      type="text"
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                      placeholder="예: 8801234567890"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">제품DB번호</label>
                    <input
                      type="text"
                      value={formData.productDbNo || computeProductDbNo()}
                      readOnly
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-600"
                    />
                    <p className="text-xs text-gray-400">고객사ID + 바코드 + 카테고리(약자3개)</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">카테고리 <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                      list="categories-list"
                    />
                    <datalist id="categories-list">
                      {categories.filter(c => c !== '전체').map(c => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">제조일</label>
                    <input
                      type="date"
                      value={formData.manufactureDate}
                      onChange={(e) => setFormData({ ...formData, manufactureDate: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">유통기한</label>
                    <input
                      type="date"
                      value={formData.expiryDate}
                      onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">옵션 - 사이즈</label>
                    <input
                      type="text"
                      value={formData.optionSize}
                      onChange={(e) => setFormData({ ...formData, optionSize: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                      placeholder="예: M, 270"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">옵션 - 색상</label>
                    <input
                      type="text"
                      value={formData.optionColor}
                      onChange={(e) => setFormData({ ...formData, optionColor: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                      placeholder="예: 블랙"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">옵션 - 롯트번호</label>
                    <input
                      type="text"
                      value={formData.optionLot}
                      onChange={(e) => setFormData({ ...formData, optionLot: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                      placeholder="LOT-001"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">옵션 - 기타</label>
                    <input
                      type="text"
                      value={formData.optionEtc}
                      onChange={(e) => setFormData({ ...formData, optionEtc: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                      placeholder="추가 옵션"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">단위 <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                      placeholder="예: 개, 박스, ea"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">현재 수량 <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">최소 재고(알림 기준) <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.minStock}
                      onChange={(e) => setFormData({ ...formData, minStock: Number(e.target.value) })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">판매가 (KRW) <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">원가 (KRW)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.costPrice}
                      onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">보관 위치 <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                      placeholder="예: A-1-01"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-sm font-medium text-gray-700">설명</label>
                    <textarea
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all resize-none"
                      placeholder="제품에 대한 상세 설명을 입력하세요."
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="rounded-lg border border-gray-200 px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-50 hover:text-gray-900 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="rounded-lg bg-blue-600 px-5 py-2.5 text-white font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    )}
                    {editingProduct ? '수정 내용 저장' : '제품 추가하기'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

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
                  <p className="text-xs text-gray-500">{ledgerProduct?.name} ({ledgerProduct?.sku})</p>
                </div>
                <button
                  type="button"
                  onClick={() => setLedgerOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
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
                      <tr>
                        <td className="px-3 py-4 text-center text-gray-400" colSpan={5}>
                          원장 내역이 없습니다.
                        </td>
                      </tr>
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
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (!ledgerProduct) return;
                    window.open(`/api/admin/inventory/ledger/csv?product_id=${ledgerProduct.id}`, '_blank');
                  }}
                  className="px-3 py-2 rounded-lg border text-xs text-gray-600"
                >
                  CSV 다운로드
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}