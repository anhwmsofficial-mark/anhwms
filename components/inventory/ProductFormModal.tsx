'use client';

import { useEffect, useState } from 'react';
import { useForm, Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Product, ProductCategory } from '@/types';
import { CustomerOption } from '@/lib/api/partners';
import { PencilIcon, PlusIcon } from '@heroicons/react/24/outline';

const productSchema = z.object({
  customerId: z.string().min(1, '고객사를 선택해주세요'),
  name: z.string().min(1, '제품명을 입력해주세요'),
  manageName: z.string().optional(),
  userCode: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  productDbNo: z.string().optional(),
  category: z.string().min(1, '카테고리를 입력해주세요'),
  manufactureDate: z.string().optional(),
  expiryDate: z.string().optional(),
  optionSize: z.string().optional(),
  optionColor: z.string().optional(),
  optionLot: z.string().optional(),
  optionEtc: z.string().optional(),
  quantity: z.number().min(0),
  unit: z.string(),
  minStock: z.number().min(0),
  price: z.number().min(0),
  costPrice: z.number().min(0),
  location: z.string().optional(),
  description: z.string().optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ProductFormData) => void;
  initialData?: Product | null;
  customers: CustomerOption[];
  categories: ProductCategory[];
  isSubmitting: boolean;
}

export default function ProductFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  customers,
  categories,
  isSubmitting,
}: ProductFormModalProps) {
  const [isGeneratingDbNo, setIsGeneratingDbNo] = useState(false);
  const [isDbNoGenerated, setIsDbNoGenerated] = useState(false);
  const [generatedSignature, setGeneratedSignature] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema) as unknown as Resolver<ProductFormData>,
    defaultValues: {
      customerId: '',
      name: '',
      manageName: '',
      userCode: '',
      sku: '',
      barcode: '',
      productDbNo: '',
      category: '',
      manufactureDate: '',
      expiryDate: '',
      optionSize: '',
      optionColor: '',
      optionLot: '',
      optionEtc: '',
      quantity: 0,
      unit: 'EA',
      minStock: 0,
      price: 0,
      costPrice: 0,
      location: '',
      description: '',
    }
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        reset({
          customerId: initialData.customerId ?? '',
          name: initialData.name,
          manageName: initialData.manageName ?? '',
          userCode: initialData.userCode ?? '',
          sku: initialData.sku,
          barcode: initialData.barcode ?? '',
          productDbNo: initialData.productDbNo ?? '',
          category: initialData.category,
          manufactureDate: initialData.manufactureDate ? new Date(initialData.manufactureDate).toISOString().slice(0, 10) : '',
          expiryDate: initialData.expiryDate ? new Date(initialData.expiryDate).toISOString().slice(0, 10) : '',
          optionSize: initialData.optionSize ?? '',
          optionColor: initialData.optionColor ?? '',
          optionLot: initialData.optionLot ?? '',
          optionEtc: initialData.optionEtc ?? '',
          quantity: initialData.quantity ?? 0,
          unit: initialData.unit ?? 'EA',
          minStock: initialData.minStock ?? 0,
          price: initialData.price ?? 0,
          costPrice: initialData.costPrice ?? 0,
          location: initialData.location ?? '',
          description: initialData.description ?? '',
        });
      } else {
        reset({
          quantity: 0,
          minStock: 0,
          price: 0,
          costPrice: 0,
          unit: 'EA',
          customerId: '',
          category: '',
        });
      }
    }
  }, [isOpen, initialData, reset]);

  const customerId = watch('customerId');
  const category = watch('category');
  const barcode = watch('barcode');
  const productDbNo = watch('productDbNo');

  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setIsDbNoGenerated(Boolean(initialData.productDbNo));
      setGeneratedSignature(
        `${initialData.customerId ?? ''}|${initialData.category ?? ''}|${initialData.barcode ?? ''}`
      );
      return;
    }

    const baseSignature = `${customerId || ''}|${category || ''}|${barcode || ''}`;
    setIsDbNoGenerated(Boolean(productDbNo) && baseSignature === generatedSignature);
  }, [isOpen, initialData, customerId, category, barcode, productDbNo, generatedSignature]);

  const handleGenerateDbNo = async () => {
    if (!customerId) {
      alert('고객사를 먼저 선택해주세요.');
      return;
    }
    if (!category) {
      alert('카테고리를 먼저 선택해주세요.');
      return;
    }

    try {
      setIsGeneratingDbNo(true);
      const res = await fetch('/api/admin/products/generate-db-no', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          category,
          barcode: barcode || null,
        }),
      });
      const payload = await res.json();

      if (!res.ok) {
        alert(payload?.error || '제품DB번호 생성에 실패했습니다.');
        return;
      }

      const nextBarcode = payload?.data?.barcode || '';
      const nextProductDbNo = payload?.data?.product_db_no || '';

      setValue('barcode', nextBarcode, { shouldDirty: true });
      setValue('productDbNo', nextProductDbNo, { shouldDirty: true });

      setGeneratedSignature(`${customerId}|${category}|${nextBarcode}`);
      setIsDbNoGenerated(true);
    } catch (error) {
      console.error(error);
      alert('제품DB번호 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGeneratingDbNo(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div 
          className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity" 
          onClick={onClose}
        ></div>
        
        <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8 transform transition-all">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            {initialData ? (
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
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">고객사 <span className="text-red-500">*</span></label>
                <select
                  {...register('customerId')}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                >
                  <option value="">고객사 선택</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
                {errors.customerId && <p className="text-xs text-red-500">{errors.customerId.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">제품명 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  {...register('name')}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                  placeholder="예: 무선 마우스"
                />
                {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">카테고리 <span className="text-red-500">*</span></label>
                <select
                  {...register('category')}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                >
                  <option value="">카테고리 선택</option>
                  {categories.map((c) => (
                    <option key={c.code} value={c.nameKo}>
                      {c.nameKo} ({c.nameEn})
                    </option>
                  ))}
                </select>
                {errors.category && <p className="text-xs text-red-500">{errors.category.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">바코드</label>
                <input
                  type="text"
                  {...register('barcode')}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">SKU (식별코드)</label>
                <input
                  type="text"
                  {...register('sku')}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                  placeholder="선택 입력"
                />
                {errors.sku && <p className="text-xs text-red-500">{errors.sku.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">관리명</label>
                <input
                  type="text"
                  {...register('manageName')}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">사용자코드</label>
                <input
                  type="text"
                  {...register('userCode')}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">제품DB번호</label>
                <input
                  type="text"
                  {...register('productDbNo')}
                  readOnly
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-600"
                  placeholder="버튼으로 생성하세요"
                />
                {!initialData && (
                  <button
                    type="button"
                    onClick={handleGenerateDbNo}
                    disabled={isGeneratingDbNo}
                    className="w-full rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isGeneratingDbNo ? '제품DB번호 생성 중...' : '제품DB번호 생성하기'}
                  </button>
                )}
                {!initialData && !isDbNoGenerated && (
                  <p className="text-xs text-amber-600">제품DB번호를 생성한 후 제품을 추가할 수 있습니다.</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">제조일</label>
                <input
                  type="date"
                  {...register('manufactureDate')}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">유통기한</label>
                <input
                  type="date"
                  {...register('expiryDate')}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                />
              </div>

              {/* 옵션 필드들 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">옵션 - 사이즈</label>
                <input
                  type="text"
                  {...register('optionSize')}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">옵션 - 색상</label>
                <input
                  type="text"
                  {...register('optionColor')}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">옵션 - 롯트번호</label>
                <input
                  type="text"
                  {...register('optionLot')}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">옵션 - 기타</label>
                <input
                  type="text"
                  {...register('optionEtc')}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">단위</label>
                <input
                  type="text"
                  {...register('unit')}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">최소 재고(알림 기준)</label>
                <input
                  type="number"
                  {...register('minStock', { valueAsNumber: true })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                />
                {errors.minStock && <p className="text-xs text-red-500">{errors.minStock.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">판매가 (KRW)</label>
                <input
                  type="number"
                  {...register('price', { valueAsNumber: true })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">원가 (KRW)</label>
                <input
                  type="number"
                  {...register('costPrice', { valueAsNumber: true })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">보관 위치</label>
                <input
                  type="text"
                  {...register('location')}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-medium text-gray-700">설명</label>
                <textarea
                  {...register('description')}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all resize-none"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-200 px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-50 hover:text-gray-900 transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isSubmitting || (!initialData && !isDbNoGenerated)}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-white font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting && (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                )}
                {initialData ? '수정 내용 저장' : '제품 추가하기'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
