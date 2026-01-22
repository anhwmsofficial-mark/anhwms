'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import { Inbound, Product } from '@/types';
import { mockInbounds, mockProducts, mockPartners } from '@/lib/mockData';
import { 
  PlusIcon, 
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

export default function InboundPage() {
  const [inbounds, setInbounds] = useState<Inbound[]>(mockInbounds);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('전체');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    productId: '',
    supplierId: '',
    quantity: 0,
    unitPrice: 0,
    inboundDate: new Date().toISOString().split('T')[0],
    status: 'pending' as const,
    note: '',
  });

  const suppliers = mockPartners.filter(p => p.type === 'supplier' || p.type === 'both');
  const products = mockProducts;

  const statuses = ['전체', 'pending', 'completed', 'cancelled'];
  const statusLabels: Record<string, string> = {
    '전체': '전체',
    'pending': '대기중',
    'completed': '완료',
    'cancelled': '취소',
  };

  const filteredInbounds = inbounds.filter(inbound => {
    const matchesSearch = inbound.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         inbound.supplierName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === '전체' || inbound.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  };

  const handleOpenModal = () => {
    setFormData({
      productId: '',
      supplierId: '',
      quantity: 0,
      unitPrice: 0,
      inboundDate: new Date().toISOString().split('T')[0],
      status: 'pending',
      note: '',
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const product = products.find(p => p.id === formData.productId);
    const supplier = suppliers.find(s => s.id === formData.supplierId);
    
    if (!product || !supplier) return;

    const newInbound: Inbound = {
      id: String(inbounds.length + 1),
      productId: formData.productId,
      productName: product.name,
      supplierId: formData.supplierId,
      supplierName: supplier.name,
      quantity: formData.quantity,
      unit: product.unit,
      unitPrice: formData.unitPrice,
      totalPrice: formData.quantity * formData.unitPrice,
      inboundDate: new Date(formData.inboundDate),
      status: formData.status,
      note: formData.note,
      createdAt: new Date(),
    };
    
    setInbounds([newInbound, ...inbounds]);
    handleCloseModal();
  };

  const handleStatusChange = (id: string, newStatus: 'pending' | 'completed' | 'cancelled') => {
    setInbounds(inbounds.map(inbound => 
      inbound.id === id ? { ...inbound, status: newStatus } : inbound
    ));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
      case 'pending':
        return <ClockIcon className="h-5 w-5 text-yellow-600" />;
      case 'cancelled':
        return <XCircleIcon className="h-5 w-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="inline-flex rounded-full bg-green-100 px-2 text-xs font-semibold leading-5 text-green-800">완료</span>;
      case 'pending':
        return <span className="inline-flex rounded-full bg-yellow-100 px-2 text-xs font-semibold leading-5 text-yellow-800">대기중</span>;
      case 'cancelled':
        return <span className="inline-flex rounded-full bg-red-100 px-2 text-xs font-semibold leading-5 text-red-800">취소</span>;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <Header title="입고 관리" />
      
      <main className="flex-1 p-8 overflow-y-auto">
        {/* 검색 및 필터 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="제품명 또는 공급업체로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
            
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {statuses.map(status => (
                <option key={status} value={status}>{statusLabels[status]}</option>
              ))}
            </select>

            <button
              onClick={handleOpenModal}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 transition-colors"
            >
              <PlusIcon className="h-5 w-5" />
              입고 등록
            </button>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-yellow-100 p-3">
                <ClockIcon className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">대기중</p>
                <p className="text-2xl font-bold text-gray-900">
                  {inbounds.filter(i => i.status === 'pending').length}건
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-100 p-3">
                <CheckCircleIcon className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">완료</p>
                <p className="text-2xl font-bold text-gray-900">
                  {inbounds.filter(i => i.status === 'completed').length}건
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-3">
                <PlusIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">총 입고량 (오늘)</p>
                <p className="text-2xl font-bold text-gray-900">
                  {inbounds
                    .filter(i => new Date(i.inboundDate).toDateString() === new Date().toDateString())
                    .reduce((sum, i) => sum + i.quantity, 0)}개
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 입고 목록 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    입고일
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    제품명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    공급업체
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    수량
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    단가
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    총액
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInbounds.map((inbound) => (
                  <tr key={inbound.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(inbound.inboundDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{inbound.productName}</div>
                      {inbound.note && <div className="text-sm text-gray-500">{inbound.note}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {inbound.supplierName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                      +{inbound.quantity} {inbound.unit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatCurrency(inbound.unitPrice)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(inbound.totalPrice)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(inbound.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      {inbound.status === 'pending' && (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleStatusChange(inbound.id, 'completed')}
                            className="text-green-600 hover:text-green-900"
                            title="완료"
                          >
                            <CheckCircleIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleStatusChange(inbound.id, 'cancelled')}
                            className="text-red-600 hover:text-red-900"
                            title="취소"
                          >
                            <XCircleIcon className="h-5 w-5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={handleCloseModal}></div>
            
            <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                입고 등록
              </h3>
              
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      제품 *
                    </label>
                    <select
                      required
                      value={formData.productId}
                      onChange={(e) => {
                        const product = products.find(p => p.id === e.target.value);
                        setFormData({ 
                          ...formData, 
                          productId: e.target.value,
                          unitPrice: product?.price || 0
                        });
                      }}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">제품 선택</option>
                      {products.map(product => (
                        <option key={product.id} value={product.id}>
                          {product.name} ({product.sku})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      공급업체 *
                    </label>
                    <select
                      required
                      value={formData.supplierId}
                      onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">공급업체 선택</option>
                      {suppliers.map(supplier => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      수량 *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      단가 *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.unitPrice}
                      onChange={(e) => setFormData({ ...formData, unitPrice: Number(e.target.value) })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      입고일 *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.inboundDate}
                      onChange={(e) => setFormData({ ...formData, inboundDate: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      총액
                    </label>
                    <input
                      type="text"
                      disabled
                      value={formatCurrency(formData.quantity * formData.unitPrice)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 bg-gray-50"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      비고
                    </label>
                    <textarea
                      value={formData.note}
                      onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 transition-colors"
                  >
                    등록
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

